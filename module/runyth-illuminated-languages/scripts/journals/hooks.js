// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { MODULE_ID, SETTINGS } from "../constants.js";
import { getPageMetadata } from "./metadata.js";

const VIEW_ROOT_SELECTORS = [
  ".journal-page-content",
  "[data-part='content']",
  "article.journal-entry-page"
];

export function resolveJournalTextPage(app) {
  for (const candidate of [app?.document, app?.page]) {
    if (candidate?.documentName === "JournalEntryPage" && candidate.type === "text") return candidate;
  }
  return null;
}

export function isPrimaryJournalPageApplication(app, page = resolveJournalTextPage(app)) {
  if (!page) return false;
  return app?.document === page || app?.page === page;
}

function resolveElement(app, supplied) {
  if (supplied?.nodeType === 1 || typeof supplied?.querySelector === "function") return supplied;
  const candidate = supplied?.element ?? app?.element ?? null;
  return candidate?.nodeType === 1 || typeof candidate?.querySelector === "function" ? candidate : null;
}

export function resolveJournalViewerRoot(element) {
  if (!element?.querySelector) return null;
  for (const selector of VIEW_ROOT_SELECTORS) {
    const root = element.querySelector(selector);
    if (root) return root;
  }
  return null;
}

export function isJournalEditor(app, element, options = {}) {
  return app?.isView === false
    || app?.mode === "edit"
    || app?.options?.mode === "edit"
    || options?.mode === "edit"
    || options?.isEditing === true
    || Boolean(element?.querySelector?.("[contenteditable='true']"));
}

export function registerJournalHooks(runtime, hooks = globalThis.Hooks) {
  const ids = [];
  const register = (name, callback) => {
    const id = hooks?.on?.(name, callback);
    if (id !== undefined && id !== null) ids.push([name, id]);
  };

  register("renderApplicationV2", (app, element, context, options) => {
    void runtime.executor.run(
      "journal.render",
      () => onRender(runtime, app, element, options ?? context ?? {}),
      { componentId: "journal-render", documentUuid: resolveJournalTextPage(app)?.uuid ?? null },
      null
    );
  });
  register("closeApplicationV2", (app) => runtime.views.unregister(app));
  register("getHeaderControlsApplicationV2", (app, controls) => addHeaderControls(runtime, app, controls));
  register("getJournalEntryContextOptions", (_application, entries) => addJournalContextOption(runtime, entries));
  register("controlToken", () => { void runtime.onReadingContextChanged("controlled-token"); });
  register("updateActor", (actor, changes = {}) => {
    if (changes.system || changes.ownership) void runtime.onActorChanged(actor);
  });
  register("createActiveEffect", (effect) => { void runtime.onActorChanged(resolveEffectActor(effect)); });
  register("updateActiveEffect", (effect) => { void runtime.onActorChanged(resolveEffectActor(effect)); });
  register("deleteActiveEffect", (effect) => { void runtime.onActorChanged(resolveEffectActor(effect)); });
  register("updateUser", (_user, changes = {}) => {
    if (Object.hasOwn(changes, "character") || Object.hasOwn(changes, "active") || Object.hasOwn(changes, "role")) {
      void runtime.onReadingContextChanged("user");
    }
  });
  register("polyglot.ready", () => { void runtime.onPolyglotChanged(); });
  register("polyglot.languageProviderReady", () => { void runtime.onPolyglotChanged(); });

  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    for (const [name, id] of ids) hooks?.off?.(name, id);
  };
}

async function onRender(runtime, app, suppliedElement, options = {}) {
  const page = resolveJournalTextPage(app);
  if (!isPrimaryJournalPageApplication(app, page)) return;
  const element = resolveElement(app, suppliedElement);
  if (!element || isJournalEditor(app, element, options)) return;
  const root = resolveJournalViewerRoot(element);
  if (!root) return;

  const metadata = getPageMetadata(page, {
    language: runtime.settings.get(SETTINGS.DEFAULT_LANGUAGE),
    languageNameVisibility: runtime.settings.get(SETTINGS.NAME_VISIBILITY)
  });
  if (!metadata.enabled) return;

  runtime.views.register(app, { documentUuid: page.parent?.uuid ?? page.uuid, pageUuid: page.uuid, root });
  const viewer = runtime.preview.resolveViewerContext();
  const transformResult = await runtime.transformer.transform(root, {
    documentUuid: page.parent?.uuid ?? page.uuid,
    pageUuid: page.uuid,
    languageId: metadata.language,
    requireLiteracy: metadata.requireLiteracy,
    languageNameVisibility: metadata.languageNameVisibility,
    unreadableFallback: metadata.unreadableFallback,
    actor: viewer.actor,
    user: viewer.user,
    originalView: viewer.originalView,
    forceUnreadable: viewer.forceUnreadable,
    source: "journal"
  });
  runtime.previewControls.render(root, { metadata, transformResult });
}

function addHeaderControls(runtime, app, controls) {
  const page = resolveJournalTextPage(app);
  if (!isPrimaryJournalPageApplication(app, page) || !Array.isArray(controls)) return;
  const owner = page.isOwner || globalThis.game?.user?.isGM;
  const viewerMode = app?.isView !== false && app?.mode !== "edit" && app?.options?.mode !== "edit";

  if (owner) insertHeaderControl(controls, {
    action: `${MODULE_ID}-language`,
    icon: "fa-solid fa-language",
    label: "ILLUMINATED_LANGUAGES.Controls.PageLanguage",
    onClick: () => runtime.openPageLanguage(page)
  });

  if (!viewerMode) return;
  insertHeaderControl(controls, {
    action: `${MODULE_ID}-read-as`,
    icon: "fa-solid fa-eye",
    label: globalThis.game?.user?.isGM
      ? "ILLUMINATED_LANGUAGES.Controls.OpenPreview"
      : "ILLUMINATED_LANGUAGES.Controls.ReadAs",
    onClick: () => { void runtime.promptReadAs(); }
  });

  if (globalThis.game?.user?.isGM) {
    insertHeaderControl(controls, {
      action: `${MODULE_ID}-compare`,
      icon: "fa-solid fa-users-viewfinder",
      label: "ILLUMINATED_LANGUAGES.Controls.CompareReaders",
      onClick: () => runtime.openComparison(page)
    });
    insertHeaderControl(controls, {
      action: `${MODULE_ID}-view-original`,
      icon: "fa-solid fa-file-lines",
      label: "ILLUMINATED_LANGUAGES.Controls.ViewOriginal",
      onClick: () => { void runtime.restoreOriginalView(page.uuid); }
    });
  }
}

function insertHeaderControl(controls, control) {
  if (controls.some((entry) => entry?.action === control.action)) return;
  controls.unshift(control);
}

function addJournalContextOption(runtime, entries) {
  if (!Array.isArray(entries) || !globalThis.game?.user?.isGM) return;
  if (entries.some((entry) => entry?.name === "ILLUMINATED_LANGUAGES.Controls.BulkAssign")) return;
  entries.push({
    name: "ILLUMINATED_LANGUAGES.Controls.BulkAssign",
    icon: "<i class='fa-solid fa-language'></i>",
    condition: (target) => Boolean(target?.dataset?.documentId || target?.dataset?.entryId),
    callback: () => runtime.openBulkManager()
  });
}

function resolveEffectActor(effect) {
  if (effect?.parent?.documentName === "Actor") return effect.parent;
  if (effect?.parent?.parent?.documentName === "Actor") return effect.parent.parent;
  return null;
}
