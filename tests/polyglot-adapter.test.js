// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { PolyglotAdapter } from "../module/runyth-illuminated-languages/scripts/integrations/polyglot/adapter.js";
import { SafeExecutor } from "../module/runyth-illuminated-languages/scripts/utils/safe-executor.js";
import { FakeSettings, actor, compatibleGame } from "./helpers/fakes.js";

function adapterFor(game, settingValues = {}) {
  return new PolyglotAdapter({
    gameRef: () => game,
    settings: new FakeSettings(settingValues),
    executor: new SafeExecutor({ logger: { error() {} } }),
    localize: (key) => key
  });
}

test("missing Polyglot is incompatible", () => {
  const game = compatibleGame();
  game.modules.delete("polyglot");
  const adapter = adapterFor(game);
  assert.equal(adapter.initialize().compatible, false);
  assert.equal(adapter.getDiagnostics().installed, false);
});

test("inactive Polyglot is incompatible", () => {
  const game = compatibleGame({ active: false });
  const adapter = adapterFor(game);
  assert.equal(adapter.initialize().error.code, "inactive");
});

test("unsupported Polyglot is incompatible", () => {
  const game = compatibleGame({ moduleVersion: "2.9.0" });
  const adapter = adapterFor(game);
  assert.equal(adapter.initialize().error.code, "unsupported");
});

test("missing runtime capability is incompatible", () => {
  const game = compatibleGame();
  delete game.polyglot.scrambleString;
  const adapter = adapterFor(game);
  const result = adapter.initialize();
  assert.equal(result.compatible, false);
  assert.deepEqual(result.error.missingCapabilities, ["scrambleString"]);
});

test("compatible Polyglot 2.8.x patch releases are accepted", () => {
  for (const moduleVersion of ["2.8.4", "2.8.4+custom.1", "2.8.99"]) {
    const game = compatibleGame({ moduleVersion });
    const adapter = adapterFor(game);
    const result = adapter.initialize();
    assert.equal(result.compatible, true, moduleVersion);
    assert.equal(result.version, moduleVersion);
  }
});

test("compatible startup reports provider", () => {
  const game = compatibleGame();
  const adapter = adapterFor(game);
  const result = adapter.initialize();
  assert.equal(result.compatible, true);
  assert.equal(result.providerId, "fake-provider");
});

test("language enumeration is dynamic and sorted", () => {
  const game = compatibleGame();
  const adapter = adapterFor(game);
  adapter.initialize();
  assert.deepEqual(adapter.getLanguages().map((language) => language.id), ["common", "dwarvish", "elvish"]);
});

test("language label and font resolve", () => {
  const game = compatibleGame();
  const adapter = adapterFor(game);
  adapter.initialize();
  assert.equal(adapter.getLanguageLabel("elvish"), "Elvish");
  assert.equal(adapter.getLanguageFont("elvish"), "Elven Script");
});

test("Polyglot object language definitions use their display labels", () => {
  const game = compatibleGame();
  game.polyglot.api.languageProvider.languages.imperial_varan = {
    label: "OB: Imperial Varan",
    font: "Imperial Varan Script"
  };
  const adapter = adapterFor(game);
  adapter.initialize();
  assert.equal(adapter.getLanguageLabel("imperial_varan"), "OB: Imperial Varan");
  assert.equal(adapter.getLanguageFont("imperial_varan"), "Imperial Varan Script");
});

test("language selector labels can include internal IDs", () => {
  const game = compatibleGame();
  game.polyglot.api.languageProvider.languages.imperial_varan = { label: "OB: Imperial Varan", font: "Script" };
  const adapter = adapterFor(game, { languageLabelMode: "display-and-id" });
  adapter.initialize();
  assert.equal(adapter.getLanguageLabel("imperial_varan"), "OB: Imperial Varan (imperial_varan)");
});

test("language selector labels can use only internal IDs", () => {
  const game = compatibleGame();
  game.polyglot.api.languageProvider.languages.imperial_varan = { label: "OB: Imperial Varan", font: "Script" };
  const adapter = adapterFor(game, { languageLabelMode: "id" });
  adapter.initialize();
  assert.equal(adapter.getLanguageLabel("imperial_varan"), "imperial_varan");
});

test("unknown language metadata is preserved", () => {
  const game = compatibleGame();
  const adapter = adapterFor(game);
  adapter.initialize();
  assert.deepEqual(adapter.getLanguageMetadata("ancient-imperial"), {
    id: "ancient-imperial",
    label: "ILLUMINATED_LANGUAGES.Language.Unknown",
    missing: true,
    font: null,
    available: false
  });
});

test("known and literate languages remain distinct", () => {
  const reader = actor("reader", { known: ["elvish", "dwarvish"], literate: ["elvish"] });
  const game = compatibleGame({ actors: [reader] });
  const adapter = adapterFor(game);
  adapter.initialize();
  assert.equal(adapter.canUnderstand(reader, "dwarvish"), true);
  assert.equal(adapter.canRead(reader, "dwarvish"), false);
  assert.equal(adapter.canRead(reader, "elvish"), true);
});

test("temporary comprehension grants reading", () => {
  const reader = actor("reader", { comprehension: ["dwarvish"] });
  const game = compatibleGame({ actors: [reader] });
  const adapter = adapterFor(game);
  adapter.initialize();
  assert.equal(adapter.canRead(reader, "dwarvish"), true);
});

test("spoken-as-literate fallback applies only without literacy data", () => {
  const reader = actor("reader", { known: ["elvish"] });
  const game = compatibleGame({ actors: [reader] });
  game.polyglot.getUserLanguages = ([selected]) => ({ knownLanguages: selected.known });
  const adapter = adapterFor(game, { spokenAsLiterate: true });
  adapter.initialize();
  assert.equal(adapter.canRead(reader, "elvish"), true);
});

test("spoken-as-literate fallback can be disabled", () => {
  const reader = actor("reader", { known: ["elvish"] });
  const game = compatibleGame({ actors: [reader] });
  game.polyglot.getUserLanguages = ([selected]) => ({ knownLanguages: selected.known });
  const adapter = adapterFor(game, { spokenAsLiterate: false });
  adapter.initialize();
  assert.equal(adapter.canRead(reader, "elvish"), false);
});

test("scrambling is deterministic for the same seed", () => {
  const adapter = adapterFor(compatibleGame());
  adapter.initialize();
  const one = adapter.scramble("Readable words", { languageId: "elvish", seedParts: ["Journal.1"] });
  const two = adapter.scramble("Readable words", { languageId: "elvish", seedParts: ["Journal.1"] });
  assert.equal(one, two);
});

test("scrambling differs by language", () => {
  const adapter = adapterFor(compatibleGame());
  adapter.initialize();
  const one = adapter.scramble("Readable words", { languageId: "elvish", seedParts: ["Journal.1"] });
  const two = adapter.scramble("Readable words", { languageId: "dwarvish", seedParts: ["Journal.1"] });
  assert.notEqual(one, two);
});

test("scrambling fails closed when adapter is unavailable", () => {
  const game = compatibleGame();
  game.modules.delete("polyglot");
  const adapter = adapterFor(game);
  adapter.initialize();
  const result = adapter.scramble("Plain source", { languageId: "elvish", seedParts: [1] });
  assert.notEqual(result, "Plain source");
});

test("language extraction is cached and invalidated", () => {
  const reader = actor("reader", { known: ["elvish"], literate: ["elvish"] });
  const game = compatibleGame({ actors: [reader] });
  let calls = 0;
  const base = game.polyglot.getUserLanguages;
  game.polyglot.getUserLanguages = (...args) => {
    calls += 1;
    return base(...args);
  };
  const adapter = adapterFor(game);
  adapter.initialize();
  adapter.resolveLanguageSets(reader);
  adapter.resolveLanguageSets(reader);
  assert.equal(calls, 1);
  adapter.invalidate(reader);
  adapter.resolveLanguageSets(reader);
  assert.equal(calls, 2);
});
