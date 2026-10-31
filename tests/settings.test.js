// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { registerSettings } from "../module/runyth-illuminated-languages/scripts/settings/register.js";

function registry() {
  const values = new Map();
  const game = {
    settings: {
      register(moduleId, key, data) {
        values.set(`${moduleId}.${key}`, data);
      }
    }
  };
  registerSettings({ gameRef: () => game });
  return values;
}

test("world language-name visibility defaults to GM only", () => {
  const values = registry();
  const setting = values.get("runyth-illuminated-languages.languageNameVisibility");
  assert.equal(setting.scope, "world");
  assert.equal(setting.default, "gm-only");
});

test("GM preview state is client-scoped and preserves legacy inference", () => {
  const values = registry();
  const mode = values.get("runyth-illuminated-languages.gmPreviewMode");
  const player = values.get("runyth-illuminated-languages.previewUser");
  const actor = values.get("runyth-illuminated-languages.previewActor");
  assert.equal(mode.scope, "client");
  assert.equal(mode.default, "");
  assert.equal(player.scope, "client");
  assert.equal(actor.scope, "client");
});
