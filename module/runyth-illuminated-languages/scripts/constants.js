// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
export const MODULE_ID = "runyth-illuminated-languages";
export const MODULE_TITLE = "Illuminated Languages";
export const MODULE_VERSION = "1.0.7";
export const API_VERSION = "1.0.0";
export const METADATA_SCHEMA_VERSION = 1;
export const POLYGLOT_MODULE_ID = "polyglot";
export const POLYGLOT_SUPPORTED_RANGE = ">=2.8.3 <2.9.0";
export const IDOC_MODULE_ID = "illuminated-documents";
export const IDOC_MINIMUM_VERSION = "1.9.0";
export const IDOC_API_RANGE = "^1.0.0";
export const PLAIN_LANGUAGE = "__plain__";
export const INHERIT_LANGUAGE = "__inherit__";
export const UNKNOWN_LANGUAGE = "__unknown__";
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;

export const HOOKS = Object.freeze({
  API_INIT: "illuminatedLanguagesApiInit",
  API_READY: "illuminatedLanguagesApiReady",
  READING_ACTOR_CHANGED: "illuminatedLanguagesReadingActorChanged",
  BEFORE_TRANSFORM: "illuminatedLanguagesBeforeTransform",
  AFTER_TRANSFORM: "illuminatedLanguagesAfterTransform",
  COMPREHENSION_RESOLVED: "illuminatedLanguagesComprehensionResolved",
  METADATA_CHANGED: "illuminatedLanguagesLanguageMetadataChanged",
  PROVIDER_REGISTERED: "illuminatedLanguagesProviderRegistered",
  PROVIDER_UNREGISTERED: "illuminatedLanguagesProviderUnregistered",
  ATTEMPT_DECIPHER: "illuminatedLanguagesAttemptDecipher"
});

export const SETTINGS = Object.freeze({
  DEFAULT_LANGUAGE: "defaultLanguage",
  LANGUAGE_LABEL_MODE: "languageLabelMode",
  REQUIRE_LITERACY: "requireLiteracy",
  SPOKEN_AS_LITERATE: "spokenAsLiterate",
  NAME_VISIBILITY: "languageNameVisibility",
  UNREADABLE_FALLBACK: "unreadableFallback",
  GM_ORIGINAL_VIEW: "gmOriginalView",
  GM_PREVIEW_MODE: "gmPreviewMode",
  NO_ACTOR_BEHAVIOUR: "noActorBehaviour",
  USE_EXPLICIT: "useExplicitReadAs",
  USE_CONTROLLED: "useControlledToken",
  USE_ASSIGNED: "useAssignedCharacter",
  USE_OWNED: "useSingleOwnedCharacter",
  REMEMBER_SELECTION: "rememberReadAs",
  MULTIPLE_CONTROLLED: "multipleControlledBehaviour",
  USE_POLYGLOT_FONTS: "usePolyglotFonts",
  SCRIPT_SCALE: "scriptScale",
  LINE_HEIGHT: "lineHeight",
  SHOW_BADGE: "showLanguageBadge",
  ACCESSIBILITY_DESCRIPTION: "accessibilityDescription",
  LAST_READ_ACTOR: "lastReadActor",
  PREVIEW_ACTOR: "previewActor",
  PREVIEW_USER: "previewUser",
  SETTINGS_GEOMETRY: "settingsGeometry",
  BULK_GEOMETRY: "bulkGeometry",
  PAGE_LANGUAGE_GEOMETRY: "pageLanguageGeometry",
  COMPARISON_GEOMETRY: "comparisonGeometry",
  MIGRATION_VERSION: "migrationVersion"
});

export const DEFAULT_PAGE_METADATA = Object.freeze({
  schemaVersion: METADATA_SCHEMA_VERSION,
  enabled: false,
  language: PLAIN_LANGUAGE,
  requireLiteracy: true,
  languageNameVisibility: "gm-only",
  unreadableFallback: "polyglot"
});

export const EXCLUDED_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "option",
  "script",
  "style",
  "code",
  "pre",
  "nav",
  "[contenteditable='true']",
  "[data-illuminated-language-ignore]",
  "[data-idoc-language-ignore]",
  ".inline-roll",
  ".content-link",
  ".runyth-illuminated-languages-controls",
  ".runyth-illuminated-languages-badge"
].join(",");
