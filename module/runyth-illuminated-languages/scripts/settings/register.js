// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { MODULE_ID, SETTINGS, PLAIN_LANGUAGE } from "../constants.js";

const WORLD = "world";
const CLIENT = "client";

export function registerSettings({ gameRef = () => globalThis.game, onChange = () => {} } = {}) {
  const settings = gameRef()?.settings;
  if (!settings?.register) return;
  const register = (key, data) => settings.register(MODULE_ID, key, { config: false, ...data });

  register(SETTINGS.DEFAULT_LANGUAGE, { scope: WORLD, type: String, default: PLAIN_LANGUAGE, onChange });
  register(SETTINGS.LANGUAGE_LABEL_MODE, { scope: WORLD, type: String, default: "display", onChange });
  register(SETTINGS.REQUIRE_LITERACY, { scope: WORLD, type: Boolean, default: true, onChange });
  register(SETTINGS.SPOKEN_AS_LITERATE, { scope: WORLD, type: Boolean, default: true, onChange });
  register(SETTINGS.NAME_VISIBILITY, { scope: WORLD, type: String, default: "gm-only", onChange });
  register(SETTINGS.UNREADABLE_FALLBACK, { scope: WORLD, type: String, default: "polyglot", onChange });
  register(SETTINGS.GM_ORIGINAL_VIEW, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.GM_PREVIEW_MODE, { scope: CLIENT, type: String, default: "", onChange });
  register(SETTINGS.NO_ACTOR_BEHAVIOUR, { scope: WORLD, type: String, default: "unreadable-warning", onChange });
  register(SETTINGS.USE_EXPLICIT, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.USE_CONTROLLED, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.USE_ASSIGNED, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.USE_OWNED, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.REMEMBER_SELECTION, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.MULTIPLE_CONTROLLED, { scope: CLIENT, type: String, default: "require-explicit", onChange });
  register(SETTINGS.USE_POLYGLOT_FONTS, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.SCRIPT_SCALE, { scope: CLIENT, type: Number, default: 1, range: { min: 0.75, max: 1.75, step: 0.05 }, onChange });
  register(SETTINGS.LINE_HEIGHT, { scope: CLIENT, type: Number, default: 1.25, range: { min: 1, max: 2, step: 0.05 }, onChange });
  register(SETTINGS.SHOW_BADGE, { scope: CLIENT, type: Boolean, default: true, onChange });
  register(SETTINGS.ACCESSIBILITY_DESCRIPTION, { scope: CLIENT, type: String, default: "ILLUMINATED_LANGUAGES.Accessibility.Unreadable", onChange });
  register(SETTINGS.LAST_READ_ACTOR, { scope: CLIENT, type: String, default: "", onChange });
  register(SETTINGS.PREVIEW_ACTOR, { scope: CLIENT, type: String, default: "", onChange });
  register(SETTINGS.PREVIEW_USER, { scope: CLIENT, type: String, default: "", onChange });
  register(SETTINGS.SETTINGS_GEOMETRY, { scope: CLIENT, type: Object, default: {} });
  register(SETTINGS.BULK_GEOMETRY, { scope: CLIENT, type: Object, default: {} });
  register(SETTINGS.PAGE_LANGUAGE_GEOMETRY, { scope: CLIENT, type: Object, default: {} });
  register(SETTINGS.COMPARISON_GEOMETRY, { scope: CLIENT, type: Object, default: {} });
  register(SETTINGS.MIGRATION_VERSION, { scope: WORLD, type: Number, default: 0 });
}
