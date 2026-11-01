// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  EXCLUDED_SELECTOR,
  HOOKS,
  MODULE_ID,
  PLAIN_LANGUAGE,
  SETTINGS
} from "../constants.js";
import { neutralScramble, stableSeed } from "../utils/hash.js";

const TRANSFORM_MARKER = "illuminatedLanguagesTransformed";

export class LanguageTransformer {
  constructor({ adapter, engine, resolver, settings, executor, localize = (key) => key, hooks = globalThis.Hooks } = {}) {
    this.adapter = adapter;
    this.engine = engine;
    this.resolver = resolver;
    this.settings = settings;
    this.executor = executor;
    this.localize = localize;
    this.hooks = hooks;
    this.activeControllers = new WeakMap();
  }

  async transform(root, options = {}) {
    if (!root || typeof root.querySelectorAll !== "function") return { transformed: false, reason: "invalid-root" };
    if (root.dataset?.[TRANSFORM_MARKER] === "true" && !options.force) return { transformed: false, reason: "duplicate" };
    const previous = this.activeControllers.get(root);
    previous?.abort?.();
    const controller = new AbortController();
    this.activeControllers.set(root, controller);
    if (options.signal) options.signal.addEventListener("abort", () => controller.abort(), { once: true });

    const user = options.user ?? globalThis.game?.user;
    const resolvedOriginalView = options.originalView ?? (user?.isGM ? this.settings.get(SETTINGS.GM_ORIGINAL_VIEW) !== false : false);
    const context = {
      documentUuid: options.documentUuid ?? null,
      pageUuid: options.pageUuid ?? null,
      blockId: options.blockId ?? null,
      languageId: options.languageId,
      originalView: resolvedOriginalView,
      forceUnreadable: options.forceUnreadable === true,
      source: options.source ?? "journal"
    };
    const beforeHookContext = this.#publicContext(context, options, null);
    this.hooks?.callAll?.(HOOKS.BEFORE_TRANSFORM, { root, context: beforeHookContext, mutable: false });

    const result = await this.executor.run(
      "render.transform",
      () => this.#transform(root, { ...options, user, originalView: resolvedOriginalView, context, signal: controller.signal }),
      { componentId: options.source ?? "renderer", documentUuid: context.documentUuid, languageId: options.languageId },
      { transformed: false, reason: "failure" }
    );
    if (!controller.signal.aborted && root.dataset) root.dataset[TRANSFORM_MARKER] = "true";
    this.hooks?.callAll?.(HOOKS.AFTER_TRANSFORM, {
      root,
      context: this.#publicContext(context, options, result),
      result,
      mutable: false
    });
    return result;
  }

  async #transform(root, options) {
    const languageId = options.languageId || PLAIN_LANGUAGE;
    if (languageId === PLAIN_LANGUAGE) {
      this.#renderBadge(root, { ...options, languageId, readable: true, recognized: true });
      return { transformed: false, readable: true, languageId };
    }

    const actorResult = Object.hasOwn(options, "actor")
      ? null
      : this.resolver.resolve(options.userId, { notify: false });
    const actor = Object.hasOwn(options, "actor")
      ? options.actor ?? null
      : this.resolver.getActor(actorResult);
    const comprehension = await this.engine.resolve({
      actor,
      languageId,
      requireLiteracy: options.requireLiteracy !== false,
      user: options.user ?? globalThis.game?.user,
      context: this.#publicContext(options.context, options, null)
    });
    if (options.signal.aborted) return { transformed: false, reason: "cancelled" };

    this.#renderBadge(root, { ...options, languageId, ...comprehension });
    if (comprehension.readable) return { transformed: false, readable: true, languageId, actorId: actor?.id ?? null };

    const compatible = this.adapter.compatible;
    if (!actor
      && options.forceUnreadable !== true
      && !(options.user?.isGM && options.originalView !== false)
      && this.settings.get(SETTINGS.NO_ACTOR_BEHAVIOUR) !== "unreadable") this.#renderActorWarning(root);
    const nodes = this.#collectTextNodes(root);
    for (const [index, node] of nodes.entries()) {
      if (options.signal.aborted) return { transformed: false, reason: "cancelled" };
      const source = node.nodeValue;
      if (!source?.trim()) continue;
      const path = this.#nodePath(node, root, index);
      const seedParts = [
        options.documentUuid,
        options.pageUuid,
        options.blockId,
        languageId,
        path,
        source
      ];
      node.nodeValue = options.unreadableFallback === "generic"
        ? neutralScramble(source, stableSeed(seedParts))
        : this.adapter.scramble(source, { languageId, seedParts });
    }

    root.classList?.add?.("runyth-illuminated-languages-unreadable");
    const accessibility = this.#localizeSetting(SETTINGS.ACCESSIBILITY_DESCRIPTION, "ILLUMINATED_LANGUAGES.Accessibility.Unreadable");
    root.setAttribute?.("aria-description", accessibility);
    if (this.settings.get(SETTINGS.USE_POLYGLOT_FONTS) !== false) {
      const font = this.adapter.getLanguageFont(languageId);
      if (font) root.style?.setProperty?.("--illuminated-language-font", this.#safeFont(font));
    }
    root.style?.setProperty?.("--illuminated-language-scale", String(this.settings.get(SETTINGS.SCRIPT_SCALE) ?? 1));
    root.style?.setProperty?.("--illuminated-language-line-height", String(this.settings.get(SETTINGS.LINE_HEIGHT) ?? 1.25));
    if (!compatible) this.#renderDependencyWarning(root);
    return {
      transformed: true,
      readable: false,
      recognized: comprehension.recognized,
      languageId,
      actorId: actor?.id ?? null,
      textNodeCount: nodes.length,
      failClosed: !compatible
    };
  }

  #collectTextNodes(root) {
    const nodeFilter = globalThis.NodeFilter ?? { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
    const walker = root.ownerDocument?.createTreeWalker?.(
      root,
      nodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => this.#isExcluded(node) ? nodeFilter.FILTER_REJECT : nodeFilter.FILTER_ACCEPT
      }
    );
    if (!walker) return [];
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  #isExcluded(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest?.(EXCLUDED_SELECTOR));
  }

  #nodePath(node, root, fallbackIndex) {
    const path = [];
    let current = node;
    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) break;
      path.unshift(Array.prototype.indexOf.call(parent.childNodes ?? [], current));
      current = parent;
    }
    return path.length ? path.join(".") : String(fallbackIndex);
  }

  #renderBadge(root, options) {
    if (this.settings.get(SETTINGS.SHOW_BADGE) === false || options.showBadge === false) return;
    const visibility = options.languageNameVisibility ?? "gm-only";
    const user = options.user ?? globalThis.game?.user;
    if (visibility === "hidden" && !user?.isGM) return;
    const existing = root.querySelector?.(":scope > .runyth-illuminated-languages-badge");
    existing?.remove?.();
    const badge = root.ownerDocument?.createElement?.("div");
    if (!badge) return;
    badge.className = "runyth-illuminated-languages-badge";
    badge.dataset.illuminatedLanguageIgnore = "true";
    let label;
    if (visibility === "always" || user?.isGM || (visibility === "recognized" && options.recognized)) {
      label = this.localize("ILLUMINATED_LANGUAGES.Badge.WrittenIn").replace("{language}", this.adapter.getLanguageLabel(options.languageId));
    } else if (visibility === "gm-only") {
      label = this.localize("ILLUMINATED_LANGUAGES.Badge.UnreadableWriting");
    } else {
      label = this.localize("ILLUMINATED_LANGUAGES.Badge.UnknownScript");
    }
    badge.textContent = label;
    root.prepend?.(badge);
  }

  #renderActorWarning(root) {
    if (root.querySelector?.(":scope > .runyth-illuminated-languages-actor-warning")) return;
    const warning = root.ownerDocument?.createElement?.("div");
    if (!warning) return;
    warning.className = "runyth-illuminated-languages-actor-warning";
    warning.dataset.illuminatedLanguageIgnore = "true";
    warning.setAttribute?.("role", "status");
    warning.textContent = this.localize("ILLUMINATED_LANGUAGES.Warnings.NoReadingActor");
    root.prepend?.(warning);
  }

  #renderDependencyWarning(root) {
    if (root.querySelector?.(":scope > .runyth-illuminated-languages-dependency-warning")) return;
    const warning = root.ownerDocument?.createElement?.("div");
    if (!warning) return;
    warning.className = "runyth-illuminated-languages-dependency-warning";
    warning.dataset.illuminatedLanguageIgnore = "true";
    warning.setAttribute?.("role", "alert");
    warning.textContent = this.localize("ILLUMINATED_LANGUAGES.Errors.ProtectedContentUnavailable");
    root.prepend?.(warning);
  }

  #publicContext(context, options, result) {
    const user = options.user ?? globalThis.game?.user;
    const visibility = options.languageNameVisibility ?? "gm-only";
    const revealLanguage = user?.isGM
      || visibility === "always"
      || (visibility === "recognized" && result?.recognized === true);
    return Object.freeze({
      ...context,
      languageId: revealLanguage ? context.languageId : null
    });
  }

  #safeFont(value) {
    const font = String(value).replace(/[;{}]/g, "").trim();
    return font.includes(",") ? font : `"${font.replaceAll('"', "")}"`;
  }

  #localizeSetting(setting, fallbackKey) {
    const value = this.settings.get(setting);
    if (typeof value === "string" && value) {
      return globalThis.game?.i18n?.has?.(value) ? globalThis.game.i18n.localize(value) : value;
    }
    return this.localize(fallbackKey);
  }
}

export function deterministicRenderKey(options) {
  return stableSeed([
    options.documentUuid,
    options.pageUuid,
    options.blockId,
    options.languageId,
    options.sourceText
  ]);
}
