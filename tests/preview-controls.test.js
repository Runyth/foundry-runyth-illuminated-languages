// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { PreviewControls } from "../module/runyth-illuminated-languages/scripts/rendering/preview-controls.js";
import { FakeDocument } from "./helpers/dom.js";

function setup({ mode = "original", isGM = true } = {}) {
  const document = new FakeDocument();
  const root = document.createElement("article");
  const calls = [];
  const state = {
    mode,
    value: mode === "original" ? "original" : "unreadable",
    actor: null,
    user: null
  };
  const preview = {
    getState: () => state,
    getOptions: () => [
      { value: "original", label: "original", group: "gm" },
      { value: "unreadable", label: "unreadable", group: "gm" },
      { value: "actor:reader", label: "Reader", group: "actors" },
      { value: "actor:other", label: "Other Reader", group: "actors" }
    ],
    applySelection: async (value) => calls.push(["selection", value]),
    setOriginal: async () => calls.push(["original"])
  };
  const localizations = {
    "ILLUMINATED_LANGUAGES.Controls.GmPreviewTitle": "GM Language Preview",
    "ILLUMINATED_LANGUAGES.Controls.GmPreviewHint": "Choose a player, actor, or no-language perspective.",
    "ILLUMINATED_LANGUAGES.Controls.PreviewPerspective": "Preview perspective",
    "ILLUMINATED_LANGUAGES.Controls.ViewOriginal": "View Original",
    "ILLUMINATED_LANGUAGES.Controls.PreviewNoLanguages": "Preview with no language knowledge",
    "ILLUMINATED_LANGUAGES.Controls.OriginalState": "Current view: Original GM text.",
    "ILLUMINATED_LANGUAGES.Controls.PreviewNoLanguagesState": "Previewing with no language knowledge.",
    "ILLUMINATED_LANGUAGES.Controls.ReaderTitle": "Reading character",
    "ILLUMINATED_LANGUAGES.Controls.ReaderHint": "Choose the permitted actor.",
    "ILLUMINATED_LANGUAGES.Controls.ReadAs": "Read as…"
  };
  const controls = new PreviewControls({
    gameRef: () => ({ user: { isGM } }),
    preview,
    resolver: { resolve: () => ({ source: "automatic", actorId: null }) },
    localize: (key) => localizations[key] ?? key,
    rerender: async () => calls.push(["rerender"])
  });
  return { document, root, controls, calls };
}

test("GM preview toolbar is visibly titled and explains where preview is selected", () => {
  const { root, controls } = setup();
  controls.render(root);
  const toolbar = root.querySelector(":scope > .runyth-illuminated-languages-controls");
  assert.ok(toolbar);
  assert.equal(toolbar.getAttribute("role"), "region");
  assert.equal(toolbar.getAttribute("aria-label"), "GM Language Preview");
  assert.match(toolbar.textContent, /GM Language Preview/);
  assert.match(toolbar.textContent, /Choose a player, actor, or no-language perspective/);
  assert.match(toolbar.textContent, /Preview perspective/);
  assert.match(toolbar.textContent, /Current view: Original GM text/);
});

test("active GM preview exposes a labeled View Original button", async () => {
  const { root, controls, calls } = setup({ mode: "unreadable" });
  controls.render(root);
  const button = root.querySelector(".runyth-illuminated-languages-view-original");
  assert.ok(button);
  assert.equal(button.textContent, "View Original");
  await button.dispatchEvent({ type: "click" });
  assert.deepEqual(calls, [["original"], ["rerender"]]);
});

test("player control remains clearly identified as the reading-character selector", () => {
  const { root, controls } = setup({ isGM: false });
  controls.render(root);
  assert.match(root.textContent, /Reading character/);
  assert.match(root.textContent, /Read as…/);
  assert.doesNotMatch(root.textContent, /GM Language Preview/);
});
