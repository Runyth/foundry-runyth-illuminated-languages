// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { IlluminatedDocumentsIntegration } from "../module/runyth-illuminated-languages/scripts/integrations/illuminated-documents/integration.js";
import { IlluminatedLanguagesApi } from "../module/runyth-illuminated-languages/scripts/api/public-api.js";
import { SafeExecutor } from "../module/runyth-illuminated-languages/scripts/utils/safe-executor.js";
import { FakeSettings } from "./helpers/fakes.js";

function integration({ active = true, version = "1.9.0", apiVersion = "1.0.0", missingLanguages = [], transformer = { transform: async () => ({ transformed: true }) }, resolveViewerContext = (value) => value, renderPreviewControls = () => {} } = {}) {
  let descriptor;
  let documentMigrationCalls = 0;
  let documentValidationCalls = 0;
  const api = {
    version: apiVersion,
    isApiVersionSupported: (range) => range === "^1.0.0" && apiVersion.startsWith("1."),
    registerExtension(value) {
      descriptor = value;
      return { id: value.id, unregister: () => true };
    },
    invalidateDocumentRender: () => true,
    rerenderOpenDocumentViews: () => 1,
    validateExtensionData: () => {
      documentValidationCalls += 1;
      throw new Error("document argument required");
    },
    migrateExtensionData: () => {
      documentMigrationCalls += 1;
      throw new Error("document argument required");
    }
  };
  const game = {
    modules: new Map([["illuminated-documents", { active, version }]]),
    illuminatedDocuments: { api }
  };
  const adapter = {
    compatible: true,
    getLanguages: () => [{ id: "elvish", label: "Elvish" }],
    getLanguage: (id) => ({ missing: missingLanguages.includes(id) })
  };
  const instance = new IlluminatedDocumentsIntegration({
    gameRef: () => game,
    adapter,
    transformer,
    settings: new FakeSettings({ defaultLanguage: "__plain__", languageNameVisibility: "recognized" }),
    executor: new SafeExecutor({ logger: { error() {} } }),
    localize: (key) => key,
    resolveViewerContext,
    renderPreviewControls
  });
  return {
    instance,
    descriptor: () => descriptor,
    api,
    documentMigrationCalls: () => documentMigrationCalls,
    documentValidationCalls: () => documentValidationCalls
  };
}

test("integration remains optional when inactive", () => {
  const { instance } = integration({ active: false });
  assert.equal(instance.initialize().registered, false);
});

test("older Illuminated Documents is rejected", () => {
  const { instance } = integration({ version: "1.8.9" });
  assert.equal(instance.initialize().registered, false);
  assert.match(instance.getDiagnostics().lastError, /older/);
});

test("unsupported extension API is rejected", () => {
  const { instance } = integration({ apiVersion: "2.0.0" });
  assert.equal(instance.initialize().registered, false);
});

test("supported public API registers extension", () => {
  const { instance } = integration();
  assert.equal(instance.initialize().registered, true);
});

test("descriptor includes document and block fields", () => {
  const { instance, descriptor } = integration();
  instance.initialize();
  assert.deepEqual(descriptor().documentFields.map((field) => field.key), ["defaultLanguage", "requireLiteracy", "languageNameVisibility", "unreadableFallback"]);
  assert.deepEqual(descriptor().blockFields.map((field) => field.key), ["language"]);
});

test("field choices are dynamic", () => {
  const { instance, descriptor } = integration();
  instance.initialize();
  assert.equal(descriptor().documentFields[0].choices().elvish, "Elvish");
  assert.equal(descriptor().blockFields[0].choices().__inherit__, "ILLUMINATED_LANGUAGES.Language.Inherit");
});

test("descriptor exposes all extension lifecycle capabilities", () => {
  const { instance, descriptor } = integration();
  instance.initialize();
  const names = Object.keys(descriptor().hooks);
  for (const required of ["prepareCreationContext", "prepareEditorContext", "prepareViewerContext", "transformRenderedDocument", "validateDocument", "migrateMetadata", "exportMetadata", "importMetadata", "invalidateCache"]) {
    assert.equal(names.includes(required), true);
  }
});

test("late initialize is idempotent", () => {
  const { instance } = integration();
  instance.initialize();
  assert.equal(instance.initialize().registered, true);
});

test("public API version helpers are stable", () => {
  const runtime = {
    adapter: { getLanguages: () => [], getLanguageMetadata: () => ({}), resolveKnownLanguages: () => new Set(), resolveLiterateLanguages: () => new Set(), canUnderstand: () => false, scramble: () => "" },
    getEffectiveLanguage: () => "__plain__",
    resolver: { resolve: () => ({ actor: null }) },
    engine: { resolve: async () => ({ readable: false }) },
    invalidateDocument: () => true,
    rerenderOpenViews: () => 0,
    registry: { registerProvider: (value) => value, unregisterProvider: () => true, registerPolicy: (value) => value, unregisterPolicy: () => true },
    getDiagnostics: () => ({})
  };
  const api = new IlluminatedLanguagesApi(runtime);
  assert.equal(api.isApiVersionSupported("^1.0.0"), true);
  assert.equal(api.assertApiVersion("^1.0.0"), true);
  assert.throws(() => api.assertApiVersion("^2.0.0"));
});


test("bulk startup does not call document-scoped migration without a document", async () => {
  const { instance, documentMigrationCalls } = integration();
  instance.initialize();
  assert.deepEqual(await instance.migrateAll(), { skipped: true, reason: "document-scoped-api", lazy: true });
  assert.equal(documentMigrationCalls(), 0);
});

test("bulk validation does not call document-scoped validation without a document", async () => {
  const { instance, documentValidationCalls } = integration();
  instance.initialize();
  assert.deepEqual(await instance.validateAll(), { skipped: true, reason: "document-scoped-api" });
  assert.equal(documentValidationCalls(), 0);
});

test("Illuminated Documents validator returns the public structured-result array", () => {
  const { instance, descriptor } = integration({ missingLanguages: ["missing_language"] });
  instance.initialize();
  const valid = descriptor().hooks.validateDocument({
    extensionData: { document: { defaultLanguage: "__plain__" }, blocks: {} }
  });
  assert.deepEqual(valid, []);

  const warnings = descriptor().hooks.validateDocument({
    extensionData: {
      document: { defaultLanguage: "missing_language" },
      blocks: { "idoc-block-1": { language: "missing_language" } }
    }
  });
  assert.equal(Array.isArray(warnings), true);
  assert.equal(warnings.length, 2);
  assert.deepEqual(warnings.map((entry) => entry.severity), ["warning", "warning"]);
  assert.equal(warnings[0].fieldPath, "document.defaultLanguage");
  assert.equal(warnings[1].blockId, "idoc-block-1");
});

test("new Illuminated Document fields use live globally configured defaults", () => {
  const { instance, descriptor } = integration();
  instance.initialize();
  const fields = Object.fromEntries(descriptor().documentFields.map((field) => [field.key, field]));
  assert.equal(fields.languageNameVisibility.default(), "recognized");

  instance.settings.values.set("languageNameVisibility", "gm-only");
  instance.settings.values.set("defaultLanguage", "elvish");
  instance.settings.values.set("requireLiteracy", false);
  instance.settings.values.set("unreadableFallback", "generic");

  assert.equal(fields.defaultLanguage.default(), "elvish");
  assert.equal(fields.requireLiteracy.default(), false);
  assert.equal(fields.languageNameVisibility.default(), "gm-only");
  assert.equal(fields.unreadableFallback.default(), "generic");

  const prepared = descriptor().hooks.prepareCreationContext({ marker: true });
  assert.equal(prepared.marker, true);
  assert.deepEqual(prepared.illuminatedLanguages.creationDefaults, {
    defaultLanguage: "elvish",
    requireLiteracy: false,
    languageNameVisibility: "gm-only",
    unreadableFallback: "generic"
  });
  assert.equal(Object.isFrozen(prepared.illuminatedLanguages.creationDefaults), true);
});


test("Illuminated Documents viewer transformation applies GM preview context and controls", async () => {
  const transformCalls = [];
  const controlCalls = [];
  const previewActor = { id: "reader" };
  const previewUser = { id: "player", isGM: false };
  const { instance, descriptor } = integration({
    transformer: {
      async transform(root, options) {
        transformCalls.push({ root, options });
        return { transformed: true, readable: false };
      }
    },
    resolveViewerContext: () => ({
      active: true,
      mode: "player",
      actor: previewActor,
      user: previewUser,
      originalView: false,
      forceUnreadable: true
    }),
    renderPreviewControls: (root, options) => controlCalls.push({ root, options })
  });
  instance.initialize();
  const root = { nodeType: 1, querySelectorAll: () => [] };
  await descriptor().hooks.transformRenderedDocument({
    root,
    documentUuid: "JournalEntry.test",
    extensionData: {
      document: {
        enabled: true,
        defaultLanguage: "elvish",
        requireLiteracy: true,
        languageNameVisibility: "gm-only",
        unreadableFallback: "polyglot"
      },
      blocks: {}
    }
  });

  assert.equal(transformCalls.length, 1);
  assert.equal(transformCalls[0].options.actor, previewActor);
  assert.equal(transformCalls[0].options.user, previewUser);
  assert.equal(transformCalls[0].options.originalView, false);
  assert.equal(transformCalls[0].options.forceUnreadable, true);
  assert.equal(controlCalls.length, 1);
  assert.equal(controlCalls[0].root, root);
});
