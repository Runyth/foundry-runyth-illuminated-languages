// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  POLYGLOT_MODULE_ID,
  POLYGLOT_SUPPORTED_RANGE,
  PLAIN_LANGUAGE,
  SETTINGS,
  UNKNOWN_LANGUAGE
} from "../../constants.js";
import { asSet, deepFreeze } from "../../utils/object.js";
import { stableSeed, neutralScramble } from "../../utils/hash.js";
import { satisfies } from "../../utils/semver.js";

export class PolyglotAdapter {
  constructor({ gameRef = () => globalThis.game, settings, executor, localize = (key) => key } = {}) {
    this.gameRef = gameRef;
    this.settings = settings;
    this.executor = executor;
    this.localize = localize;
    this.compatible = false;
    this.lastError = null;
    this.revision = 0;
    this.languageSetCache = new WeakMap();
  }

  initialize() {
    const result = this.validateCompatibility();
    this.compatible = result.compatible;
    this.lastError = result.error ?? null;
    this.revision += 1;
    this.languageSetCache = new WeakMap();
    return result;
  }

  validateCompatibility() {
    const game = this.gameRef();
    const module = game?.modules?.get?.(POLYGLOT_MODULE_ID);
    if (!module) return this.#failure("missing", "ILLUMINATED_LANGUAGES.Errors.PolyglotMissing");
    if (!module.active) return this.#failure("inactive", "ILLUMINATED_LANGUAGES.Errors.PolyglotInactive", module.version);
    if (!satisfies(module.version, POLYGLOT_SUPPORTED_RANGE)) {
      return this.#failure("unsupported", "ILLUMINATED_LANGUAGES.Errors.PolyglotUnsupported", module.version);
    }

    const runtime = game?.polyglot;
    const provider = runtime?.api?.languageProvider;
    const missing = [];
    if (!provider || typeof provider !== "object") missing.push("api.languageProvider");
    if (!provider?.languages || typeof provider.languages !== "object") missing.push("languageProvider.languages");
    if (typeof provider?.getLanguageFont !== "function") missing.push("languageProvider.getLanguageFont");
    if (typeof runtime?.getUserLanguages !== "function" && typeof provider?.getUserLanguages !== "function") {
      missing.push("getUserLanguages");
    }
    if (typeof runtime?.scrambleString !== "function") missing.push("scrambleString");
    if (missing.length) {
      return this.#failure(
        "incompatible-runtime",
        "ILLUMINATED_LANGUAGES.Errors.PolyglotRuntimeUnsupported",
        module.version,
        missing
      );
    }

    return {
      compatible: true,
      installed: true,
      active: true,
      version: module.version,
      providerId: provider.id ?? provider.constructor?.name ?? "unknown",
      capabilities: {
        languages: true,
        fonts: true,
        knownLanguages: true,
        literacy: true,
        deterministicScrambling: true,
        temporaryComprehension: Boolean(provider.conditions || provider.comprehendLanguages)
      }
    };
  }

  #failure(code, localizationKey, version = null, missingCapabilities = []) {
    return {
      compatible: false,
      installed: code !== "missing",
      active: !["missing", "inactive"].includes(code),
      version,
      error: {
        code,
        localizationKey,
        missingCapabilities
      }
    };
  }

  get provider() {
    return this.gameRef()?.polyglot?.api?.languageProvider ?? null;
  }

  get runtime() {
    return this.gameRef()?.polyglot ?? null;
  }

  getLanguages() {
    const languages = this.executor.runSync("polyglot.getLanguages", () => {
      const provider = this.provider;
      if (!this.compatible || !provider) return [];
      return Object.entries(provider.languages)
        .map(([id, definition]) => {
          const rawLabel = typeof definition === "string"
            ? definition
            : definition?.label ?? definition?.name ?? id;
          const displayLabel = this.#resolveLabel(rawLabel, id);
          const providerFont = typeof definition === "object" && definition
            ? definition.font ?? definition.family ?? null
            : null;
          return {
            id,
            label: this.#formatLanguageLabel(id, displayLabel),
            displayLabel,
            font: providerFont ?? this.getLanguageFont(id),
            recognized: true,
            source: provider.id ?? provider.constructor?.name ?? "polyglot"
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label, this.gameRef()?.i18n?.lang));
    }, { componentId: "polyglot" }, []);
    return deepFreeze(languages);
  }

  getLanguage(languageId) {
    if (languageId === PLAIN_LANGUAGE) {
      return deepFreeze({ id: PLAIN_LANGUAGE, label: this.localize("ILLUMINATED_LANGUAGES.Language.Plain"), plain: true });
    }
    const language = this.getLanguages().find((entry) => entry.id === languageId);
    if (language) return language;
    return deepFreeze({
      id: languageId || UNKNOWN_LANGUAGE,
      label: this.localize("ILLUMINATED_LANGUAGES.Language.Unknown"),
      missing: true,
      font: null
    });
  }

  getLanguageLabel(languageId) {
    return this.getLanguage(languageId).label;
  }

  getLanguageFont(languageId) {
    return this.executor.runSync("polyglot.getLanguageFont", () => {
      if (!this.compatible) return null;
      const value = this.provider.getLanguageFont(languageId);
      if (typeof value === "string") return value;
      if (value && typeof value === "object") return value.font ?? value.family ?? value.name ?? null;
      return null;
    }, { componentId: "polyglot", languageId }, null);
  }

  resolveLanguageSets(actor) {
    if (actor && this.languageSetCache.has(actor)) {
      const cached = this.languageSetCache.get(actor);
      return { ...cached, known: new Set(cached.known), literate: new Set(cached.literate), comprehension: new Set(cached.comprehension) };
    }
    const resolved = this.executor.runSync("polyglot.resolveLanguageSets", () => {
      if (!this.compatible || !actor) return { known: new Set(), literate: new Set(), comprehension: new Set() };
      const resolver = this.runtime.getUserLanguages ?? this.provider.getUserLanguages.bind(this.provider);
      const result = resolver.call(this.runtime, [actor]);
      let known;
      let literate;
      let comprehension;
      if (Array.isArray(result)) {
        [known, literate, comprehension] = result;
      } else {
        known = result?.knownLanguages ?? result?.known ?? result?.languages;
        literate = result?.literateLanguages ?? result?.literate;
        comprehension = result?.comprehensionLanguages ?? result?.comprehension;
      }
      const knownSet = asSet(known);
      const literateSet = asSet(literate);
      const comprehensionSet = asSet(comprehension);
      const hasLiteracyData = Array.isArray(result) ? result.length >= 2 : Boolean(result?.literateLanguages || result?.literate);
      if (!hasLiteracyData && this.settings?.get?.("spokenAsLiterate")) {
        for (const language of knownSet) literateSet.add(language);
      }
      return { known: knownSet, literate: literateSet, comprehension: comprehensionSet, hasLiteracyData };
    }, { componentId: "polyglot" }, { known: new Set(), literate: new Set(), comprehension: new Set(), failed: true });
    if (actor && !resolved.failed) this.languageSetCache.set(actor, resolved);
    return { ...resolved, known: new Set(resolved.known), literate: new Set(resolved.literate), comprehension: new Set(resolved.comprehension) };
  }

  invalidate(actor = null) {
    if (actor) this.languageSetCache.delete(actor);
    else this.languageSetCache = new WeakMap();
    this.revision += 1;
  }

  resolveKnownLanguages(actor) {
    return this.resolveLanguageSets(actor).known;
  }

  resolveLiterateLanguages(actor) {
    return this.resolveLanguageSets(actor).literate;
  }

  canUnderstand(actor, languageId) {
    if (languageId === PLAIN_LANGUAGE) return true;
    if (!this.compatible || !actor || !languageId) return false;
    const sets = this.resolveLanguageSets(actor);
    return sets.known.has(languageId) || sets.comprehension.has(languageId) || this.#providerComprehends(actor, languageId);
  }

  canRead(actor, languageId, { requireLiteracy = true } = {}) {
    if (languageId === PLAIN_LANGUAGE) return true;
    if (!this.compatible || !actor || !languageId) return false;
    const sets = this.resolveLanguageSets(actor);
    if (sets.comprehension.has(languageId) || this.#providerComprehends(actor, languageId)) return true;
    if (!requireLiteracy) return sets.known.has(languageId);
    return sets.literate.has(languageId);
  }

  #providerComprehends(actor, languageId) {
    return this.executor.runSync("polyglot.temporaryComprehension", () => {
      const provider = this.provider;
      if (typeof provider?.canComprehendLanguage === "function") {
        return Boolean(provider.canComprehendLanguage(actor, languageId));
      }
      if (typeof provider?.isLanguageUnderstood === "function") {
        return Boolean(provider.isLanguageUnderstood(languageId, actor));
      }
      return false;
    }, { componentId: "polyglot", languageId }, false);
  }

  scramble(text, { languageId, seedParts = [], salt = null } = {}) {
    const seed = salt ?? stableSeed([...seedParts, languageId, text]);
    return this.executor.runSync("polyglot.scramble", () => {
      if (!this.compatible) return neutralScramble(text, seed);
      return this.runtime.scrambleString(String(text), seed, languageId);
    }, { componentId: "polyglot", languageId }, neutralScramble(text, seed));
  }

  getLanguageMetadata(languageId) {
    const language = this.getLanguage(languageId);
    return deepFreeze({
      ...language,
      font: language.font ?? this.getLanguageFont(languageId),
      available: !language.missing
    });
  }

  getDiagnostics() {
    const module = this.gameRef()?.modules?.get?.(POLYGLOT_MODULE_ID);
    return deepFreeze({
      installed: Boolean(module),
      active: Boolean(module?.active),
      version: module?.version ?? null,
      supportedRange: POLYGLOT_SUPPORTED_RANGE,
      compatible: this.compatible,
      provider: this.provider?.id ?? this.provider?.constructor?.name ?? null,
      languageCount: this.getLanguages().length,
      revision: this.revision,
      lastError: this.lastError
    });
  }

  #resolveLabel(label, fallback) {
    if (typeof label !== "string") return fallback;
    const i18n = this.gameRef()?.i18n;
    return i18n?.has?.(label) ? i18n.localize(label) : label;
  }

  #formatLanguageLabel(languageId, displayLabel) {
    const mode = this.settings?.get?.(SETTINGS.LANGUAGE_LABEL_MODE) ?? "display";
    if (mode === "id") return languageId;
    if (mode === "display-and-id") return `${displayLabel} (${languageId})`;
    return displayLabel;
  }
}
