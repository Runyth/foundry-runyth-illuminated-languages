// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  documentApplicationId,
  pickGeometry,
  restoreGeometry
} from "../module/runyth-illuminated-languages/scripts/applications/geometry.js";
import { PageLanguageApp } from "../module/runyth-illuminated-languages/scripts/applications/page-language-app.js";
import { ReaderComparisonApp } from "../module/runyth-illuminated-languages/scripts/applications/comparison-app.js";
import { BulkLanguageApp } from "../module/runyth-illuminated-languages/scripts/applications/bulk-app.js";
import { registerSettings } from "../module/runyth-illuminated-languages/scripts/settings/register.js";
import { SETTINGS } from "../module/runyth-illuminated-languages/scripts/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "module", "runyth-illuminated-languages");

function runtimeHarness() {
  return {
    settings: { get: () => ({}), set: async () => true },
    executor: { run: async (_operation, callback) => callback() },
    adapter: { getLanguages: () => [], getLanguageLabel: (id) => `Display ${id}` },
    localize: (key) => key,
    visibilityOptions: () => [],
    fallbackOptions: () => [],
    engine: { resolve: async () => ({ readable: false }) },
    resolver: { resolveForConnectedUser: () => ({ actorName: null }), getActor: () => null }
  };
}

test("persisted geometry is copied, bounded, and kept partly visible", () => {
  const source = { left: 5000, top: -800, width: 2400, height: 1800, ignored: 1 };
  const restored = restoreGeometry(source, {
    viewportWidth: 1280,
    viewportHeight: 720,
    minimumWidth: 400,
    minimumHeight: 300,
    visibleMargin: 64
  });
  assert.deepEqual(restored, { left: 0, top: 0, width: 1280, height: 720 });
  assert.deepEqual(source, { left: 5000, top: -800, width: 2400, height: 1800, ignored: 1 });
  assert.deepEqual(pickGeometry({ left: 1, top: 2, width: "bad", height: 300 }), { left: 1, top: 2, height: 300 });
});

test("document application IDs are stable, sanitized, and document-specific", () => {
  const first = documentApplicationId("runyth-illuminated-languages-page", "JournalEntry.alpha.JournalEntryPage.one");
  const second = documentApplicationId("runyth-illuminated-languages-page", "JournalEntry.alpha.JournalEntryPage.two");
  assert.notEqual(first, second);
  assert.match(first, /^[a-zA-Z0-9_-]+$/);
  assert.equal(first, documentApplicationId("runyth-illuminated-languages-page", "JournalEntry.alpha.JournalEntryPage.one"));
});

test("page-language and reader-comparison windows no longer share one fixed ID", () => {
  const runtime = runtimeHarness();
  const pageOne = { uuid: "JournalEntry.a.JournalEntryPage.one" };
  const pageTwo = { uuid: "JournalEntry.a.JournalEntryPage.two" };
  const firstPageApp = new PageLanguageApp({ page: pageOne, runtime });
  const secondPageApp = new PageLanguageApp({ page: pageTwo, runtime });
  const firstComparison = new ReaderComparisonApp({ page: pageOne, runtime });
  const secondComparison = new ReaderComparisonApp({ page: pageTwo, runtime });
  assert.notEqual(firstPageApp.options.id, secondPageApp.options.id);
  assert.notEqual(firstComparison.options.id, secondComparison.options.id);
});

test("all four module window geometries are registered as client settings", () => {
  const registrations = [];
  registerSettings({
    gameRef: () => ({ settings: { register: (moduleId, key, data) => registrations.push({ moduleId, key, data }) } })
  });
  for (const key of [
    SETTINGS.SETTINGS_GEOMETRY,
    SETTINGS.BULK_GEOMETRY,
    SETTINGS.PAGE_LANGUAGE_GEOMETRY,
    SETTINGS.COMPARISON_GEOMETRY
  ]) {
    const registration = registrations.find((entry) => entry.key === key);
    assert.ok(registration, `Missing ${key}`);
    assert.equal(registration.data.scope, "client");
    assert.deepEqual(registration.data.default, {});
  }
});

test("bulk assignment fails closed when Foundry confirmation is unavailable", async () => {
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  globalThis.game = { user: { isGM: true } };
  globalThis.foundry = undefined;
  const application = {
    submitting: false,
    element: null,
    runtime: { localize: (key) => key },
    collectTargets: async () => [{ key: "target" }],
    render: async () => true,
    captureUiState() {}
  };
  try {
    const result = await BulkLanguageApp.onSubmit.call(application, null, {}, {
      object: { operation: "assign", language: "elvish", target: { target: true } }
    });
    assert.equal(result, false);
    assert.equal(application.result.message, "ILLUMINATED_LANGUAGES.App.Bulk.ConfirmationUnavailable");
    assert.equal(application.submitting, false);
  } finally {
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});

test("module forms use explicit labels and bulk rows show display labels", async () => {
  const settings = await readFile(path.join(moduleRoot, "templates", "settings.hbs"), "utf8");
  const bulk = await readFile(path.join(moduleRoot, "templates", "bulk.hbs"), "utf8");
  assert.match(settings, /label for="runyth-illuminated-languages-default-language"/);
  assert.match(settings, /data-action="resetGeometry"/);
  assert.match(bulk, /label for="runyth-illuminated-languages-bulk-search"/);
  assert.match(bulk, /\{\{languageLabel\}\}/);
  assert.doesNotMatch(bulk, /<code>\{\{language\}\}<\/code>/);
});

test("localized controls have padding, wrapping, and narrow-window safeguards", async () => {
  const css = await readFile(path.join(moduleRoot, "styles", "runyth-illuminated-languages.css"), "utf8");
  assert.match(css, /padding:\s*0\.35rem 0\.5rem/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /\.runyth-illuminated-languages \[aria-busy="true"\] button/);
});
