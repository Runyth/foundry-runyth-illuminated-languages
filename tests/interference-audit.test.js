// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isJournalEditor,
  isPrimaryJournalPageApplication,
  registerJournalHooks,
  resolveJournalTextPage,
  resolveJournalViewerRoot
} from "../module/runyth-illuminated-languages/scripts/journals/hooks.js";
import { IlluminatedLanguagesSettingsApp } from "../module/runyth-illuminated-languages/scripts/applications/settings-app.js";
import { SETTINGS } from "../module/runyth-illuminated-languages/scripts/constants.js";
import { FakeDocument } from "./helpers/dom.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "module", "runyth-illuminated-languages");

class HookBus {
  constructor() {
    this.nextId = 1;
    this.callbacks = new Map();
    this.removed = [];
  }

  on(name, callback) {
    const id = this.nextId++;
    const values = this.callbacks.get(name) ?? [];
    values.push({ id, callback });
    this.callbacks.set(name, values);
    return id;
  }

  off(name, id) {
    this.removed.push([name, id]);
    this.callbacks.set(name, (this.callbacks.get(name) ?? []).filter((entry) => entry.id !== id));
  }

  emit(name, ...args) {
    return (this.callbacks.get(name) ?? []).map((entry) => entry.callback(...args));
  }
}

function page(overrides = {}) {
  return {
    id: "page",
    uuid: "JournalEntry.journal.JournalEntryPage.page",
    documentName: "JournalEntryPage",
    type: "text",
    name: "Page",
    isOwner: true,
    parent: { uuid: "JournalEntry.journal" },
    flags: {
      "runyth-illuminated-languages": {
        metadata: {
          schemaVersion: 1,
          enabled: true,
          language: "elvish",
          requireLiteracy: true,
          languageNameVisibility: "gm-only",
          unreadableFallback: "generic"
        }
      }
    },
    ...overrides
  };
}

function viewElement({ editor = false, includeRoot = true } = {}) {
  const document = new FakeDocument();
  const element = document.createElement("div");
  if (includeRoot) {
    const content = document.createElement("article");
    content.className = "journal-page-content";
    if (editor) content.setAttribute("contenteditable", "true");
    element.append(content);
  }
  return element;
}

function journalRuntimeHarness() {
  const state = { registered: 0, transformed: 0, previewControls: 0, readingChanges: 0 };
  return {
    state,
    runtime: {
      executor: {
        async run(_operation, callback, _context, fallback) {
          try {
            return await callback();
          } catch {
            return fallback;
          }
        }
      },
      views: {
        register() { state.registered += 1; },
        unregister() {}
      },
      settings: { get: () => undefined },
      preview: { resolveViewerContext: () => ({ actor: null, user: { isGM: false }, originalView: false, forceUnreadable: false }) },
      transformer: { async transform() { state.transformed += 1; return { transformed: true }; } },
      previewControls: { render() { state.previewControls += 1; } },
      onReadingContextChanged: async () => { state.readingChanges += 1; },
      onActorChanged: async () => true,
      onPolyglotChanged: async () => true,
      openPageLanguage() {},
      promptReadAs() {},
      openComparison() {},
      restoreOriginalView() {},
      openBulkManager() {}
    }
  };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("Journal integration accepts only a directly owned text-page application", () => {
  const target = page();
  assert.equal(resolveJournalTextPage({ document: target }), target);
  assert.equal(resolveJournalTextPage({ page: target }), target);
  assert.equal(resolveJournalTextPage({ object: target }), null);
  assert.equal(isPrimaryJournalPageApplication({ document: target }, target), true);
  assert.equal(isPrimaryJournalPageApplication({ page: target }, target), true);
  assert.equal(isPrimaryJournalPageApplication({ document: { documentName: "Actor" }, object: target }, target), false);
});

test("Journal rendering requires an owned viewer root and excludes edit mode", () => {
  const viewer = viewElement();
  const editor = viewElement({ editor: true });
  const unrelated = viewElement({ includeRoot: false });
  assert.ok(resolveJournalViewerRoot(viewer));
  assert.equal(resolveJournalViewerRoot(unrelated), null);
  assert.equal(isJournalEditor({ isView: true }, viewer, {}), false);
  assert.equal(isJournalEditor({ isView: false }, viewer, {}), true);
  assert.equal(isJournalEditor({ isView: true }, editor, {}), true);
  assert.equal(isJournalEditor({ isView: true }, viewer, { mode: "edit" }), true);
});

test("editors and Actor-related child applications never enter the open-view registry", async () => {
  const hooks = new HookBus();
  const { runtime, state } = journalRuntimeHarness();
  const cleanup = registerJournalHooks(runtime, hooks);
  const target = page();

  hooks.emit("renderApplicationV2", { appId: 1, document: target, isView: false }, viewElement({ editor: true }), {}, { mode: "edit" });
  hooks.emit("renderApplicationV2", { appId: 2, document: { documentName: "Actor" }, object: target }, viewElement(), {}, {});
  await flush();
  assert.equal(state.registered, 0);
  assert.equal(state.transformed, 0);

  hooks.emit("renderApplicationV2", { appId: 3, document: target, isView: true }, viewElement(), {}, {});
  await flush();
  assert.equal(state.registered, 1);
  assert.equal(state.transformed, 1);
  assert.equal(state.previewControls, 1);

  cleanup();
  const removedAfterFirstCleanup = hooks.removed.length;
  assert.ok(removedAfterFirstCleanup > 0);
  cleanup();
  assert.equal(hooks.removed.length, removedAfterFirstCleanup);
});

test("header and Journal-directory controls are idempotent and remain before native controls", () => {
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const hooks = new HookBus();
    const { runtime } = journalRuntimeHarness();
    registerJournalHooks(runtime, hooks);
    const target = page();
    const controls = [{ action: "core-close" }];
    const app = { document: target, isView: true };
    hooks.emit("getHeaderControlsApplicationV2", app, controls);
    hooks.emit("getHeaderControlsApplicationV2", app, controls);
    const actions = controls.map((entry) => entry.action);
    for (const action of [
      "runyth-illuminated-languages-language",
      "runyth-illuminated-languages-read-as",
      "runyth-illuminated-languages-compare",
      "runyth-illuminated-languages-view-original"
    ]) assert.equal(actions.filter((entry) => entry === action).length, 1);
    assert.equal(actions.at(-1), "core-close");

    const entries = [];
    hooks.emit("getJournalEntryContextOptions", {}, entries);
    hooks.emit("getJournalEntryContextOptions", {}, entries);
    assert.equal(entries.length, 1);
    assert.equal(hooks.callbacks.has("getDocumentContextOptions"), false);
  } finally {
    globalThis.game = previousGame;
  }
});

test("player settings submission cannot write world-scoped defaults", async () => {
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: false } };
  const writes = [];
  const application = {
    runtime: { settings: { set: async (key, value) => writes.push([key, value]) }, invalidateDocument: async () => true },
    render: async () => true
  };
  try {
    await IlluminatedLanguagesSettingsApp.onSubmit.call(application, null, {}, {
      object: {
        [SETTINGS.DEFAULT_LANGUAGE]: "elvish",
        [SETTINGS.REQUIRE_LITERACY]: false,
        [SETTINGS.USE_CONTROLLED]: false,
        [SETTINGS.SCRIPT_SCALE]: 1.2
      }
    });
    assert.deepEqual(writes, [
      [SETTINGS.USE_CONTROLLED, false],
      [SETTINGS.SCRIPT_SCALE, 1.2]
    ]);
  } finally {
    globalThis.game = previousGame;
  }
});

test("production hooks do not target Actor sheets, Item sheets, Tidy, HUD, Scene Controls, Chat, or canvas", async () => {
  const source = await readFile(path.join(moduleRoot, "scripts", "journals", "hooks.js"), "utf8");
  assert.doesNotMatch(source, /renderActor|renderItem|getActorSheet|getItemSheet|tidy5e|renderTokenHUD|getSceneControlButtons|renderChatMessage|canvasReady|canvasDraw/);
  assert.match(source, /renderApplicationV2/);
  assert.match(source, /isPrimaryJournalPageApplication/);
  assert.match(source, /resolveJournalViewerRoot/);
});

test("module-owned templates use no reserved generic tab action", async () => {
  const files = await readdir(path.join(moduleRoot, "templates"));
  const source = (await Promise.all(files.filter((name) => name.endsWith(".hbs")).map((name) => readFile(path.join(moduleRoot, "templates", name), "utf8")))).join("\n");
  assert.doesNotMatch(source, /data-action=["']tab["']/);
});

test("all CSS rules are module-scoped or use an runyth-illuminated-languages-prefixed integration selector", async () => {
  const css = await readFile(path.join(moduleRoot, "styles", "runyth-illuminated-languages.css"), "utf8");
  const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectorGroups = [];
  for (let index = 0; index < cleanCss.length; index += 1) {
    if (cleanCss[index] !== "{") continue;
    const previousClose = cleanCss.lastIndexOf("}", index - 1);
    const previousOpen = cleanCss.lastIndexOf("{", index - 1);
    const group = cleanCss.slice(Math.max(previousClose, previousOpen) + 1, index).trim();
    if (group && !group.startsWith("@")) selectorGroups.push(group);
  }
  const selectors = selectorGroups.flatMap((group) => group.split(",")).map((selector) => selector.trim()).filter(Boolean);
  for (const selector of selectors) {
    assert.match(
      selector,
      /^(?:\.runyth-illuminated-languages(?:\b|[-_])|\.runyth-illuminated-languages-form\b)/,
      `Unscoped selector: ${selector}`
    );
  }
  assert.doesNotMatch(css, /(^|})\s*(?:button|input|select|label|\.window-header|\.window-content|\.application|\.sr-only)\s*[,\{]/m);
});

test("runtime source creates no Chat cards, Token HUD controls, Scene tools, keybindings, or canvas objects", async () => {
  const scripts = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.name.endsWith(".js")) scripts.push(await readFile(target, "utf8"));
    }
  }
  await walk(path.join(moduleRoot, "scripts"));
  const source = scripts.join("\n");
  assert.doesNotMatch(source, /ChatMessage\.create|renderChatMessage|renderTokenHUD|getSceneControlButtons|game\.keybindings\.register|PIXI\.|canvas\.(?:stage|tokens|interface)/);
});

test("runtime ready and destroy lifecycle register optional integrations exactly once", async () => {
  const { IlluminatedLanguagesRuntime } = await import("../module/runyth-illuminated-languages/scripts/runtime.js");
  const hooks = new HookBus();
  let socketsRegistered = 0;
  let socketsUnregistered = 0;
  let idocInitialized = 0;
  let idocUnregistered = 0;
  let migrations = 0;
  const game = { user: { id: "gm", isGM: true }, modules: new Map(), settings: {} };
  const runtime = new IlluminatedLanguagesRuntime({ gameRef: () => game, hooks });
  runtime.adapter = { initialize() {}, compatible: true, invalidate() {} };
  runtime.sockets = {
    register() { socketsRegistered += 1; return socketsRegistered === 1; },
    unregister() { socketsUnregistered += 1; return socketsUnregistered === 1; }
  };
  runtime.idocIntegration = {
    initialize() { idocInitialized += 1; return true; },
    unregister() { idocUnregistered += 1; return true; },
    rerender() { return 0; },
    invalidate() {}
  };
  runtime.migrations = { async migrateAll() { migrations += 1; return { migrated: 0 }; } };

  const first = runtime.ready();
  const storedReadyPromise = runtime.readyPromise;
  const second = runtime.ready();
  assert.equal(runtime.readyPromise, storedReadyPromise);
  await Promise.all([first, second]);
  assert.equal(socketsRegistered, 1);
  assert.equal(idocInitialized, 1);
  assert.equal(migrations, 1);

  runtime.destroy();
  runtime.destroy();
  await flush();
  assert.equal(socketsUnregistered, 1);
  assert.equal(idocUnregistered, 1);
  assert.ok(hooks.removed.length > 0);
});

test("open-view registry deduplicates applications and isolates a failing rerender", async () => {
  const { OpenViewRegistry } = await import("../module/runyth-illuminated-languages/scripts/rendering/view-registry.js");
  const failures = [];
  const registry = new OpenViewRegistry({
    executor: {
      async run(_operation, callback, _context, fallback) {
        try { return await callback(); }
        catch (error) { failures.push(error); return fallback; }
      }
    }
  });
  let goodRenders = 0;
  const good = { appId: 1, rendered: true, async render() { goodRenders += 1; return this; } };
  const bad = { appId: 2, rendered: true, async render() { throw new Error("render failed"); } };
  const stale = { appId: 3, rendered: false, async render() {} };
  registry.register(good, { documentUuid: "JournalEntry.one" });
  registry.register(good, { documentUuid: "JournalEntry.one" });
  registry.register(bad, { documentUuid: "JournalEntry.two" });
  registry.register(stale, { documentUuid: "JournalEntry.three" });

  assert.equal(registry.getDiagnostics().openViews, 3);
  assert.equal(await registry.rerender(), 1);
  assert.equal(goodRenders, 1);
  assert.equal(failures.length, 1);
  assert.equal(registry.getDiagnostics().openViews, 2);
});
