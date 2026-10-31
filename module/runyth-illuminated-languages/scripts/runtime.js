// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import {
  API_VERSION,
  HOOKS,
  MODULE_ID,
  MODULE_VERSION,
  PLAIN_LANGUAGE,
  SETTINGS
} from "./constants.js";
import { SettingsFacade } from "./settings/facade.js";
import { SafeExecutor } from "./utils/safe-executor.js";
import { PolyglotAdapter } from "./integrations/polyglot/adapter.js";
import { ProviderRegistry } from "./comprehension/provider-registry.js";
import { ComprehensionEngine } from "./comprehension/engine.js";
import { ReadingActorResolver } from "./comprehension/actor-resolver.js";
import { GmPreviewController } from "./comprehension/preview-controller.js";
import { LanguageTransformer } from "./rendering/transformer.js";
import { OpenViewRegistry } from "./rendering/view-registry.js";
import { PreviewControls } from "./rendering/preview-controls.js";
import { IlluminatedDocumentsIntegration } from "./integrations/illuminated-documents/integration.js";
import { MigrationManager } from "./migrations/manager.js";
import { SocketRouter } from "./sockets/router.js";
import { IlluminatedLanguagesApi } from "./api/public-api.js";
import { registerSettings } from "./settings/register.js";
import { registerJournalHooks } from "./journals/hooks.js";
import { getPageMetadata, validatePageMetadata } from "./journals/metadata.js";
import { effectiveLanguage, normalizeIlluminatedMetadata } from "./validation/metadata.js";
import { PageLanguageApp } from "./applications/page-language-app.js";
import { IlluminatedLanguagesSettingsApp } from "./applications/settings-app.js";
import { BulkLanguageApp } from "./applications/bulk-app.js";
import { ReaderComparisonApp } from "./applications/comparison-app.js";
import { stableSeed } from "./utils/hash.js";
import { deepFreeze } from "./utils/object.js";

export class IlluminatedLanguagesRuntime {
  constructor({ gameRef = () => globalThis.game, hooks = globalThis.Hooks } = {}) {
    this.gameRef = gameRef;
    this.hooks = hooks;
    this.settings = new SettingsFacade({ gameRef });
    this.executor = new SafeExecutor({ moduleId: MODULE_ID });
    this.adapter = new PolyglotAdapter({ gameRef, settings: this.settings, executor: this.executor, localize: (key) => this.localize(key) });
    this.registry = new ProviderRegistry({ executor: this.executor, hooks });
    this.resolver = new ReadingActorResolver({ gameRef, settings: this.settings, hooks });
    this.preview = new GmPreviewController({ gameRef, settings: this.settings, resolver: this.resolver });
    this.engine = new ComprehensionEngine({ adapter: this.adapter, registry: this.registry, executor: this.executor, hooks });
    this.transformer = new LanguageTransformer({
      adapter: this.adapter,
      engine: this.engine,
      resolver: this.resolver,
      settings: this.settings,
      executor: this.executor,
      localize: (key) => this.localize(key),
      hooks
    });
    this.views = new OpenViewRegistry({ executor: this.executor });
    this.previewControls = new PreviewControls({
      gameRef,
      preview: this.preview,
      resolver: this.resolver,
      adapter: this.adapter,
      executor: this.executor,
      localize: (key) => this.localize(key),
      rerender: () => this.onReadingContextChanged("preview-control")
    });
    this.idocIntegration = new IlluminatedDocumentsIntegration({
      gameRef,
      adapter: this.adapter,
      transformer: this.transformer,
      settings: this.settings,
      executor: this.executor,
      localize: (key) => this.localize(key),
      resolveViewerContext: (fallback) => this.preview.resolveViewerContext(fallback),
      renderPreviewControls: (root, options) => this.previewControls.render(root, options)
    });
    this.migrations = new MigrationManager({ gameRef, settings: this.settings, executor: this.executor, idocIntegration: this.idocIntegration });
    this.sockets = new SocketRouter({ gameRef, resolver: this.resolver, engine: this.engine, executor: this.executor });
    this.api = new IlluminatedLanguagesApi(this);
    this.listenerController = new AbortController();
    this.unregisterHooks = null;
    this.lifecycleHookIds = [];
    this.initialized = false;
    this.readyPromise = null;
    this.destroyed = false;
    this.pendingReadingContextSource = null;
    this.readingContextPromise = null;
  }

  init() {
    if (this.initialized) return this.api;
    this.initialized = true;
    registerSettings({ gameRef: this.gameRef, onChange: () => { void this.onReadingContextChanged("setting"); } });
    this.#registerMenu();
    this.#expose();
    this.hooks?.callAll?.(HOOKS.API_INIT, this.api);
    return this.api;
  }

  async ready() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.executor.run(
      "runtime.ready",
      () => this.#ready(),
      { componentId: "runtime" },
      this.api
    );
    return this.readyPromise;
  }

  async #ready() {
    this.executor.runSync(
      "polyglot.initialize",
      () => this.adapter.initialize(),
      { componentId: "polyglot" },
      null
    );
    this.unregisterHooks?.();
    this.unregisterHooks = registerJournalHooks(this, this.hooks);
    this.sockets.register();
    this.#registerLifecycleHooks();
    this.executor.runSync(
      "illuminatedDocuments.initialize",
      () => this.idocIntegration.initialize(),
      { componentId: "illuminated-documents" },
      null
    );
    await this.executor.run(
      "migration.startup",
      () => this.migrations.migrateAll(),
      { componentId: "migration" },
      { skipped: true, reason: "failure" }
    );
    this.#notifyCompatibility();
    this.hooks?.callAll?.(HOOKS.API_READY, this.api);
    return this.api;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unregisterHooks?.();
    this.unregisterHooks = null;
    for (const [name, id] of this.lifecycleHookIds.splice(0)) this.hooks?.off?.(name, id);
    this.listenerController.abort();
    this.sockets.unregister();
    void this.executor.run(
      "illuminatedDocuments.unregister",
      () => this.idocIntegration.unregister(),
      { componentId: "illuminated-documents" },
      false
    );
  }

  localize(key) {
    return this.gameRef()?.i18n?.localize?.(key) ?? key;
  }

  fallbackOptions() {
    return [
      { id: "polyglot", label: this.localize("ILLUMINATED_LANGUAGES.Fallback.Polyglot") },
      { id: "generic", label: this.localize("ILLUMINATED_LANGUAGES.Fallback.Generic") }
    ];
  }

  visibilityOptions() {
    return ["always", "recognized", "gm-only", "hidden"].map((id) => ({
      id,
      label: this.localize(`ILLUMINATED_LANGUAGES.Visibility.${id === "gm-only" ? "GmOnly" : id[0].toUpperCase() + id.slice(1)}`)
    }));
  }

  openPageLanguage(page) {
    return new PageLanguageApp({ page, runtime: this }).render({ force: true });
  }

  openSettings() {
    return new IlluminatedLanguagesSettingsApp({ runtime: this }).render({ force: true });
  }

  openComparison(page) {
    if (!this.gameRef()?.user?.isGM) throw new Error("GM permission is required.");
    return new ReaderComparisonApp({ runtime: this, page }).render({ force: true });
  }

  openBulkManager() {
    if (!this.gameRef()?.user?.isGM) throw new Error("GM permission is required.");
    return new BulkLanguageApp({ runtime: this }).render({ force: true });
  }

  async promptReadAs() {
    const options = this.preview.getOptions();
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;
    if (!DialogV2?.prompt) return options;
    const currentValue = this.gameRef()?.user?.isGM
      ? this.preview.getState().value
      : this.resolver.resolve().source === "explicit"
        ? `actor:${this.resolver.resolve().actorId ?? ""}`
        : "";
    const isGM = Boolean(this.gameRef()?.user?.isGM);
    const titleKey = isGM
      ? "ILLUMINATED_LANGUAGES.Controls.GmPreviewTitle"
      : "ILLUMINATED_LANGUAGES.Controls.ReadAs";
    const hintKey = isGM
      ? "ILLUMINATED_LANGUAGES.Controls.GmPreviewDialogHint"
      : "ILLUMINATED_LANGUAGES.Controls.ReaderHint";
    const labelKey = isGM
      ? "ILLUMINATED_LANGUAGES.Controls.PreviewPerspective"
      : "ILLUMINATED_LANGUAGES.Controls.ReadAs";
    const selection = await DialogV2.prompt({
      window: { title: this.localize(titleKey) },
      content: `<div class="runyth-illuminated-languages-preview-dialog"><p>${this.#escape(this.localize(hintKey))}</p><label><span>${this.#escape(this.localize(labelKey))}</span><select name="preview">${options.map((option) => `<option value="${this.#escape(option.value)}"${option.value === currentValue ? " selected" : ""}>${this.#escape(this.previewControls.optionLabel(option))}</option>`).join("")}</select></label></div>`,
      ok: {
        label: this.localize("ILLUMINATED_LANGUAGES.Controls.ApplyPreview"),
        callback: (_event, button) => button.form.elements.preview.value
      }
    });
    if (selection === null || selection === undefined) return false;
    await this.preview.applySelection(selection);
    return this.onReadingContextChanged("preview-dialog");
  }

  getEffectiveLanguage(documentOrPage, blockId = null) {
    if (documentOrPage?.documentName === "JournalEntryPage") return getPageMetadata(documentOrPage).language;
    const metadata = this.idocIntegration.api?.getDocumentExtensionData?.(documentOrPage, MODULE_ID)
      ?? documentOrPage?.extensionData?.[MODULE_ID]
      ?? {};
    return effectiveLanguage(normalizeIlluminatedMetadata(metadata), blockId, this.settings.get(SETTINGS.DEFAULT_LANGUAGE) ?? PLAIN_LANGUAGE);
  }

  async invalidateDocument(documentUuid = null) {
    this.adapter.invalidate();
    this.views.invalidate(documentUuid);
    this.executor.runSync(
      "illuminatedDocuments.invalidate",
      () => this.idocIntegration.invalidate(documentUuid),
      { componentId: "illuminated-documents", documentUuid },
      false
    );
    return true;
  }

  async rerenderOpenViews(documentUuid = null) {
    this.views.invalidate(documentUuid);
    const [journals, illuminatedDocuments] = await Promise.all([
      this.views.rerender(documentUuid),
      this.executor.run(
        "illuminatedDocuments.rerender",
        () => Promise.resolve(this.idocIntegration.rerender(documentUuid) ?? 0),
        { componentId: "illuminated-documents", documentUuid },
        0
      )
    ]);
    return Number(journals ?? 0) + Number(illuminatedDocuments ?? 0);
  }

  clearCaches() {
    this.adapter.invalidate();
    this.views.invalidate();
    this.executor.runSync(
      "illuminatedDocuments.invalidate",
      () => this.idocIntegration.invalidate(),
      { componentId: "illuminated-documents" },
      false
    );
    this.executor.clear();
  }

  onReadingContextChanged(source) {
    this.pendingReadingContextSource = source;
    if (this.readingContextPromise) return this.readingContextPromise;
    this.readingContextPromise = Promise.resolve()
      .then(() => this.#applyReadingContextChange())
      .finally(() => {
        this.readingContextPromise = null;
        if (this.pendingReadingContextSource !== null) void this.onReadingContextChanged(this.pendingReadingContextSource);
      });
    return this.readingContextPromise;
  }

  async #applyReadingContextChange() {
    const source = this.pendingReadingContextSource ?? "unknown";
    this.pendingReadingContextSource = null;
    const fallback = deepFreeze({ source, resolved: false, actorId: null, rerendered: 0 });
    return this.executor.run(
      "reading-context.change",
      async () => {
        const resolution = this.resolver.resolve(undefined, { notify: true });
        this.adapter.invalidate();
        const rerendered = await this.rerenderOpenViews();
        return deepFreeze({
          source,
          resolved: true,
          actorId: resolution.actorId,
          tokenUuid: resolution.tokenUuid,
          rerendered: Number(rerendered ?? 0)
        });
      },
      { componentId: "reading-actor-resolver" },
      fallback
    );
  }

  async onActorChanged(actor) {
    if (actor?.documentName && actor.documentName !== "Actor") return false;
    if (!actor?.id) return false;
    return this.executor.run(
      "actor.change",
      async () => {
        this.adapter.invalidate(actor);
        const resolved = this.resolver.resolve();
        if (resolved.actorId === actor.id) await this.rerenderOpenViews();
        return true;
      },
      { componentId: "actor-change", documentUuid: actor.uuid ?? null },
      false
    );
  }

  async onPolyglotChanged() {
    return this.executor.run(
      "polyglot.change",
      async () => {
        this.adapter.initialize();
        await this.invalidateDocument();
        await this.rerenderOpenViews();
        return true;
      },
      { componentId: "polyglot" },
      false
    );
  }

  async restoreOriginalView(documentUuid = null) {
    await this.preview.setOriginal();
    return this.onReadingContextChanged(documentUuid ? `view-original:${documentUuid}` : "view-original");
  }

  attemptDecipher(payload) {
    return this.sockets.requestDecipher(payload);
  }

  async validateAllMetadata() {
    const journals = [];
    for (const journal of this.gameRef()?.journal?.contents ?? []) {
      for (const page of journal.pages?.contents ?? []) {
        const result = validatePageMetadata(page, this.adapter);
        if (result.messages.length) journals.push({ uuid: page.uuid, ...result });
      }
    }
    const illuminatedDocuments = await this.idocIntegration.validateAll();
    return deepFreeze({ journals, illuminatedDocuments });
  }

  async runSelfTest() {
    const checks = [];
    const run = async (name, callback) => {
      try {
        const detail = await callback();
        checks.push({ name, passed: true, detail });
      } catch (error) {
        checks.push({ name, passed: false, detail: error.message });
      }
    };
    await run("polyglot-compatibility", () => this.adapter.validateCompatibility());
    await run("language-enumeration", () => ({ count: this.adapter.getLanguages().length }));
    await run("language-label", () => this.adapter.getLanguageLabel(this.adapter.getLanguages()[0]?.id ?? PLAIN_LANGUAGE));
    await run("deterministic-scrambling", () => {
      const a = this.adapter.scramble("Deterministic text", { languageId: this.adapter.getLanguages()[0]?.id, seedParts: [1] });
      const b = this.adapter.scramble("Deterministic text", { languageId: this.adapter.getLanguages()[0]?.id, seedParts: [1] });
      if (a !== b) throw new Error("Scrambling is not deterministic.");
      return stableSeed([a]);
    });
    await run("reading-actor", () => this.resolver.resolve());
    await run("illuminated-documents", () => this.idocIntegration.getDiagnostics());
    await run("cache-invalidation", () => this.invalidateDocument());
    return deepFreeze({ passed: checks.every((check) => check.passed), checks });
  }

  getDiagnostics() {
    return deepFreeze({
      moduleVersion: MODULE_VERSION,
      apiVersion: API_VERSION,
      foundryVersion: this.gameRef()?.version ?? this.gameRef()?.release?.version ?? null,
      polyglot: this.adapter.getDiagnostics(),
      illuminatedDocuments: this.idocIntegration.getDiagnostics(),
      extensions: this.registry.getDiagnostics(),
      readingActor: this.resolver.resolve(),
      preview: this.#previewDiagnostics(),
      caches: this.views.getDiagnostics(),
      errors: this.executor.getDiagnostics()
    });
  }


  #previewDiagnostics() {
    const state = this.preview.getState();
    return {
      mode: state.mode,
      active: state.active,
      actorId: state.actorId ?? null,
      userId: state.userId ?? null,
      source: state.source ?? null
    };
  }

  #registerMenu() {
    this.gameRef()?.settings?.registerMenu?.(MODULE_ID, "configuration", {
      name: "ILLUMINATED_LANGUAGES.App.Settings.Title",
      label: "ILLUMINATED_LANGUAGES.App.Settings.Open",
      hint: "ILLUMINATED_LANGUAGES.App.Settings.Hint",
      icon: "fa-solid fa-language",
      type: IlluminatedLanguagesSettingsApp,
      restricted: false
    });
  }

  #expose() {
    const namespace = { api: this.api, runtime: this, ComparisonApp: ReaderComparisonApp };
    this.gameRef().illuminatedLanguages = namespace;
    const module = this.gameRef()?.modules?.get?.(MODULE_ID);
    if (module) module.api = this.api;
  }

  #registerLifecycleHooks() {
    if (this.lifecycleHookIds.length) return;
    const register = (name, callback) => {
      const id = this.hooks?.on?.(name, callback);
      if (id !== undefined && id !== null) this.lifecycleHookIds.push([name, id]);
    };
    register("illuminatedDocumentsApiInit", () => {
      this.executor.runSync(
        "illuminatedDocuments.initialize",
        () => this.idocIntegration.initialize(),
        { componentId: "illuminated-documents" },
        null
      );
    });
    register("illuminatedDocumentsApiReady", () => {
      this.executor.runSync(
        "illuminatedDocuments.initialize",
        () => this.idocIntegration.initialize(),
        { componentId: "illuminated-documents" },
        null
      );
    });
    register("hotReload", (data) => {
      if (data?.extension === "js" && String(data?.path ?? "").includes(MODULE_ID)) this.clearCaches();
    });
  }

  #notifyCompatibility() {
    if (!this.gameRef()?.user?.isGM || this.adapter.compatible) return;
    const key = this.adapter.lastError?.localizationKey ?? "ILLUMINATED_LANGUAGES.Errors.PolyglotRuntimeUnsupported";
    globalThis.ui?.notifications?.error?.(this.localize(key), { permanent: true });
  }

  #escape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
}
