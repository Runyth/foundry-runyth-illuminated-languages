// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { INHERIT_LANGUAGE, METADATA_SCHEMA_VERSION, PLAIN_LANGUAGE } from "../constants.js";
import { isPlainObject, deepFreeze } from "../utils/object.js";

export function normalizeIlluminatedMetadata(value, defaults = {}) {
  const input = isPlainObject(value) ? value : {};
  const document = isPlainObject(input.document) ? input.document : {};
  const blocks = isPlainObject(input.blocks) ? input.blocks : {};
  const normalized = {
    schemaVersion: METADATA_SCHEMA_VERSION,
    document: {
      enabled: document.enabled !== false,
      defaultLanguage: typeof document.defaultLanguage === "string"
        ? document.defaultLanguage
        : defaults.defaultLanguage ?? PLAIN_LANGUAGE,
      requireLiteracy: document.requireLiteracy !== false,
      languageNameVisibility: ["always", "recognized", "gm-only", "hidden"].includes(document.languageNameVisibility)
        ? document.languageNameVisibility
        : defaults.languageNameVisibility ?? "gm-only",
      unreadableFallback: document.unreadableFallback ?? "polyglot"
    },
    blocks: {}
  };
  for (const [blockId, block] of Object.entries(blocks)) {
    if (!isPlainObject(block)) continue;
    normalized.blocks[blockId] = {
      ...block,
      language: block.language === null || block.language === undefined ? INHERIT_LANGUAGE : String(block.language)
    };
  }
  for (const [key, item] of Object.entries(input)) {
    if (!(key in normalized)) normalized[key] = item;
  }
  return deepFreeze(normalized);
}

export function effectiveLanguage(metadata, blockId, fallbackLanguage = PLAIN_LANGUAGE) {
  const normalized = normalizeIlluminatedMetadata(metadata, { defaultLanguage: fallbackLanguage });
  const blockLanguage = blockId ? normalized.blocks[blockId]?.language : null;
  if (blockLanguage && blockLanguage !== INHERIT_LANGUAGE) return blockLanguage;
  return normalized.document.defaultLanguage || fallbackLanguage;
}

export function validateIlluminatedMetadata(value, adapter) {
  const metadata = normalizeIlluminatedMetadata(value);
  const messages = [];
  const validateLanguage = (languageId, path, { allowInherit = false } = {}) => {
    if (languageId === PLAIN_LANGUAGE || (allowInherit && languageId === INHERIT_LANGUAGE)) return;
    if (!languageId || adapter?.getLanguage(languageId)?.missing) {
      messages.push({ severity: "warning", code: "missing-language", path, languageId });
    }
  };
  validateLanguage(metadata.document.defaultLanguage, "document.defaultLanguage");
  for (const [blockId, block] of Object.entries(metadata.blocks)) {
    validateLanguage(block.language, `blocks.${blockId}.language`, { allowInherit: true });
  }
  return deepFreeze({ valid: true, metadata, messages });
}
