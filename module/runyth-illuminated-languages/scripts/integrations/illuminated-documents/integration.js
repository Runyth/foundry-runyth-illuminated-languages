// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import {
  IDOC_API_RANGE,
  IDOC_MINIMUM_VERSION,
  IDOC_MODULE_ID,
  INHERIT_LANGUAGE,
  MODULE_ID,
  MODULE_VERSION,
  PLAIN_LANGUAGE,
  SETTINGS
} from "../../constants.js";
import { satisfies } from "../../utils/semver.js";
import { normalizeIlluminatedMetadata, effectiveLanguage, validateIlluminatedMetadata } from "../../validation/metadata.js";

export class IlluminatedDocumentsIntegration {
  constructor({ gameRef = () => globalThis.game, adapter, transformer, settings, executor, localize = (key) => key, resolveViewerContext = (value) => value, renderPreviewControls = () => {} } = {}) {
    this.gameRef = gameRef;
    this.adapter = adapter;
    this.transformer = transformer;
    this.settings = settings;
    this.executor = executor;
    this.localize = localize;
    this.resolveViewerContext = resolveViewerContext;
    this.renderPreviewControls = renderPreviewControls;
    this.registration = null;
    this.lastError = null;
  }

  get api() {
    return this.gameRef()?.illuminatedDocuments?.api ?? null;
  }

  initialize() {
    const module = this.gameRef()?.modules?.get?.(IDOC_MODULE_ID);
    if (!module?.active) return { installed: Boolean(module), active: false, registered: false };
    if (!satisfies(module.version, `>=${IDOC_MINIMUM_VERSION}`)) {
      return this.#failure(`Illuminated Documents ${module.version} is older than ${IDOC_MINIMUM_VERSION}.`);
    }
    const api = this.api;
    if (!api) return this.#failure("Illuminated Documents public API is unavailable.");
    const apiVersion = api.version ?? api.apiVersion;
    const supported = typeof api.isApiVersionSupported === "function"
      ? api.isApiVersionSupported(IDOC_API_RANGE)
      : satisfies(apiVersion, IDOC_API_RANGE);
    if (!supported) return this.#failure(`Illuminated Documents API ${apiVersion ?? "unknown"} does not satisfy ${IDOC_API_RANGE}.`);
    if (this.registration) return this.getDiagnostics();

    const descriptor = this.createDescriptor();
    const registration = this.executor.runSync(
      "illuminatedDocuments.registerExtension",
      () => api.registerExtension(descriptor),
      { componentId: MODULE_ID },
      null
    );
    if (!registration) return this.#failure("Extension registration failed.");
    this.registration = registration;
    this.lastError = null;
    return this.getDiagnostics();
  }

  createDescriptor() {
    const languageChoices = () => this.#languageChoices({ includeInherit: false });
    const blockChoices = () => this.#languageChoices({ includeInherit: true });
    return Object.freeze({
      id: MODULE_ID,
      version: MODULE_VERSION,
      apiVersion: IDOC_API_RANGE,
      priority: 100,
      capabilities: Object.freeze([
        "document-fields",
        "block-fields",
        "viewer-transform",
        "validation",
        "migration",
        "import-export",
        "preset-defaults",
        "cache-invalidation"
      ]),
      documentFields: Object.freeze([
        Object.freeze({
          key: "defaultLanguage",
          type: "select",
          label: "ILLUMINATED_LANGUAGES.Fields.DocumentLanguage",
          hint: "ILLUMINATED_LANGUAGES.Fields.DocumentLanguageHint",
          choices: languageChoices,
          default: () => this.settings.get(SETTINGS.DEFAULT_LANGUAGE) ?? PLAIN_LANGUAGE
        }),
        Object.freeze({
          key: "requireLiteracy",
          type: "checkbox",
          label: "ILLUMINATED_LANGUAGES.Fields.RequireLiteracy",
          default: () => this.settings.get(SETTINGS.REQUIRE_LITERACY) !== false
        }),
        Object.freeze({
          key: "languageNameVisibility",
          type: "select",
          label: "ILLUMINATED_LANGUAGES.Fields.NameVisibility",
          choices: () => this.#visibilityChoices(),
          default: () => this.settings.get(SETTINGS.NAME_VISIBILITY) ?? "gm-only"
        }),
        Object.freeze({
          key: "unreadableFallback",
          type: "select",
          label: "ILLUMINATED_LANGUAGES.Fields.UnreadableFallback",
          choices: () => this.#fallbackChoices(),
          default: () => this.settings.get(SETTINGS.UNREADABLE_FALLBACK) ?? "polyglot"
        })
      ]),
      blockFields: Object.freeze([
        Object.freeze({
          key: "language",
          type: "select",
          label: "ILLUMINATED_LANGUAGES.Fields.BlockLanguage",
          hint: "ILLUMINATED_LANGUAGES.Fields.BlockLanguageHint",
          choices: blockChoices,
          default: INHERIT_LANGUAGE
        })
      ]),
      hooks: Object.freeze({
        prepareCreationContext: (context) => this.#prepareContext(context),
        prepareEditorContext: (context) => this.#prepareContext(context),
        prepareViewerContext: (context) => this.#prepareContext(context),
        transformRenderedDocument: (...args) => this.#transformRenderedDocument(...args),
        validateDocument: (context) => this.#validate(context),
        migrateMetadata: (context) => this.#migrate(context),
        exportMetadata: (context) => this.#exportMetadata(context),
        importMetadata: (context) => this.#importMetadata(context),
        invalidateCache: (context) => this.#invalidate(context)
      })
    });
  }

  async unregister() {
    if (!this.registration) return false;
    const api = this.api;
    const removed = typeof this.registration.unregister === "function"
      ? await this.registration.unregister()
      : await api?.unregisterExtension?.(MODULE_ID);
    this.registration = null;
    return removed !== false;
  }

  getDocumentMetadata(document) {
    return this.api?.getDocumentExtensionData?.(document, MODULE_ID) ?? null;
  }

  setDocumentMetadata(document, data) {
    if (!this.api?.setDocumentExtensionData) throw new Error("Illuminated Documents document metadata API is unavailable.");
    return this.api.setDocumentExtensionData(document, MODULE_ID, normalizeIlluminatedMetadata(data));
  }

  getBlockMetadata(document, blockId) {
    return this.api?.getBlockExtensionData?.(document, blockId, MODULE_ID) ?? null;
  }

  setBlockMetadata(document, blockId, data) {
    if (!this.api?.setBlockExtensionData) throw new Error("Illuminated Documents block metadata API is unavailable.");
    return this.api.setBlockExtensionData(document, blockId, MODULE_ID, data);
  }

  async migrateAll() {
    if (!this.registration) return { skipped: true, reason: "not-registered" };
    if (typeof this.api?.migrateAllExtensionData === "function") {
      const result = await this.api.migrateAllExtensionData(MODULE_ID);
      return { skipped: false, result };
    }
    // Illuminated Documents 1.9.0 exposes a document-scoped migration method.
    // Registered migrateMetadata callbacks therefore run lazily in its document lifecycle.
    return { skipped: true, reason: "document-scoped-api", lazy: true };
  }

  async validateAll() {
    if (!this.registration) return { skipped: true, reason: "not-registered" };
    if (typeof this.api?.validateAllExtensionData === "function") {
      return this.api.validateAllExtensionData(MODULE_ID);
    }
    return { skipped: true, reason: "document-scoped-api" };
  }

  async rerender(documentUuid = null) {
    return this.api?.rerenderOpenDocumentViews?.(documentUuid);
  }

  invalidate(documentUuid = null) {
    return this.api?.invalidateDocumentRender?.(documentUuid, MODULE_ID);
  }

  getDiagnostics() {
    const module = this.gameRef()?.modules?.get?.(IDOC_MODULE_ID);
    return Object.freeze({
      installed: Boolean(module),
      active: Boolean(module?.active),
      version: module?.version ?? null,
      requiredModuleVersion: `>=${IDOC_MINIMUM_VERSION}`,
      apiVersion: this.api?.version ?? this.api?.apiVersion ?? null,
      requiredApiVersion: IDOC_API_RANGE,
      registered: Boolean(this.registration),
      lastError: this.lastError
    });
  }

  #failure(message) {
    this.lastError = message;
    return { ...this.getDiagnostics(), lastError: message };
  }

  #languageChoices({ includeInherit }) {
    const choices = {};
    if (includeInherit) choices[INHERIT_LANGUAGE] = this.localize("ILLUMINATED_LANGUAGES.Language.Inherit");
    choices[PLAIN_LANGUAGE] = this.localize("ILLUMINATED_LANGUAGES.Language.Plain");
    for (const language of this.adapter.getLanguages()) choices[language.id] = language.label;
    return choices;
  }

  #fallbackChoices() {
    return {
      polyglot: this.localize("ILLUMINATED_LANGUAGES.Fallback.Polyglot"),
      generic: this.localize("ILLUMINATED_LANGUAGES.Fallback.Generic")
    };
  }

  #visibilityChoices() {
    return {
      always: this.localize("ILLUMINATED_LANGUAGES.Visibility.Always"),
      recognized: this.localize("ILLUMINATED_LANGUAGES.Visibility.Recognized"),
      "gm-only": this.localize("ILLUMINATED_LANGUAGES.Visibility.GmOnly"),
      hidden: this.localize("ILLUMINATED_LANGUAGES.Visibility.Hidden")
    };
  }

  #prepareContext(context = {}) {
    return {
      ...context,
      illuminatedLanguages: {
        available: this.adapter.compatible,
        languages: this.adapter.getLanguages(),
        creationDefaults: Object.freeze({
          defaultLanguage: this.settings.get(SETTINGS.DEFAULT_LANGUAGE) ?? PLAIN_LANGUAGE,
          requireLiteracy: this.settings.get(SETTINGS.REQUIRE_LITERACY) !== false,
          languageNameVisibility: this.settings.get(SETTINGS.NAME_VISIBILITY) ?? "gm-only",
          unreadableFallback: this.settings.get(SETTINGS.UNREADABLE_FALLBACK) ?? "polyglot"
        }),
        diagnostics: this.getDiagnostics()
      }
    };
  }

  async #transformRenderedDocument(...args) {
    const context = this.#normalizeTransformArguments(args);
    if (!context.root || context.editorMode) return context.root;
    const metadata = normalizeIlluminatedMetadata(context.metadata ?? context.extensionData, {
      defaultLanguage: this.settings.get(SETTINGS.DEFAULT_LANGUAGE),
      languageNameVisibility: this.settings.get(SETTINGS.NAME_VISIBILITY)
    });
    const viewer = this.resolveViewerContext({
      actor: context.actor,
      user: context.user,
      originalView: context.originalView
    });
    let transformResult = null;
    const blockElements = [...context.root.querySelectorAll?.("[data-illuminated-block-id]") ?? []];
    if (blockElements.length) {
      for (const block of blockElements) {
        const blockId = block.getAttribute("data-illuminated-block-id");
        transformResult = await this.transformer.transform(block, {
          documentUuid: context.documentUuid,
          pageUuid: context.pageUuid,
          blockId,
          languageId: effectiveLanguage(metadata, blockId, this.settings.get(SETTINGS.DEFAULT_LANGUAGE)),
          requireLiteracy: metadata.document.requireLiteracy,
          languageNameVisibility: metadata.document.languageNameVisibility,
          unreadableFallback: metadata.document.unreadableFallback,
          actor: viewer.actor,
          user: viewer.user,
          originalView: viewer.originalView,
          forceUnreadable: viewer.forceUnreadable,
          source: "illuminated-documents",
          showBadge: false
        });
      }
    } else {
      transformResult = await this.transformer.transform(context.root, {
        documentUuid: context.documentUuid,
        pageUuid: context.pageUuid,
        languageId: metadata.document.defaultLanguage,
        requireLiteracy: metadata.document.requireLiteracy,
        languageNameVisibility: metadata.document.languageNameVisibility,
        unreadableFallback: metadata.document.unreadableFallback,
        actor: viewer.actor,
        user: viewer.user,
        originalView: viewer.originalView,
        forceUnreadable: viewer.forceUnreadable,
        source: "illuminated-documents"
      });
    }
    this.renderPreviewControls(context.root, { metadata, transformResult });
    return context.root;
  }

  #normalizeTransformArguments(args) {
    const candidate = args.find((entry) => entry && typeof entry === "object" && !entry.nodeType) ?? {};
    const root = args.find((entry) => entry?.nodeType === 1 || typeof entry?.querySelectorAll === "function")
      ?? candidate.root
      ?? candidate.element
      ?? candidate.renderedDocument;
    const document = candidate.document ?? candidate.journal ?? candidate.sourceDocument;
    return {
      ...candidate,
      root,
      documentUuid: candidate.documentUuid ?? document?.uuid ?? null,
      pageUuid: candidate.pageUuid ?? candidate.page?.uuid ?? null,
      metadata: candidate.metadata ?? candidate.extensionData,
      actor: candidate.actor ?? candidate.viewer?.actor,
      user: candidate.user ?? candidate.viewer?.user ?? globalThis.game?.user,
      originalView: candidate.originalView ?? candidate.viewer?.originalView,
      editorMode: candidate.editorMode === true || candidate.mode === "edit"
    };
  }

  #validate(context = {}) {
    const result = validateIlluminatedMetadata(context.metadata ?? context.extensionData, this.adapter);
    return result.messages.map((entry) => {
      const blockMatch = /^blocks\.([^.]*)\./.exec(entry.path ?? "");
      return {
        severity: entry.severity ?? "warning",
        code: entry.code ?? "invalid-metadata",
        fieldPath: entry.path ?? null,
        blockId: blockMatch?.[1] ?? null,
        message: this.localize("ILLUMINATED_LANGUAGES.Validation.InvalidLanguage"),
        localizationKey: "ILLUMINATED_LANGUAGES.Validation.InvalidLanguage",
        repairAction: null
      };
    });
  }

  #migrate(context = {}) {
    return normalizeIlluminatedMetadata(context.metadata ?? context.extensionData, {
      defaultLanguage: this.settings.get(SETTINGS.DEFAULT_LANGUAGE),
      languageNameVisibility: this.settings.get(SETTINGS.NAME_VISIBILITY)
    });
  }

  #exportMetadata(context = {}) {
    return this.#migrate(context);
  }

  #importMetadata(context = {}) {
    return this.#migrate(context);
  }

  #invalidate(context = {}) {
    return this.invalidate(context.documentUuid ?? context.document?.uuid ?? null);
  }
}
