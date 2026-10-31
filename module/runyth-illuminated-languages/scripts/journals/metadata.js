// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import {
  DEFAULT_PAGE_METADATA,
  METADATA_SCHEMA_VERSION,
  MODULE_ID,
  PLAIN_LANGUAGE
} from "../constants.js";
import { clone, deepFreeze, isPlainObject } from "../utils/object.js";

const VISIBILITY = new Set(["always", "recognized", "gm-only", "hidden"]);

export function normalizePageMetadata(value, defaults = {}) {
  const input = isPlainObject(value) ? value : {};
  const metadata = {
    ...clone(DEFAULT_PAGE_METADATA),
    ...defaults,
    schemaVersion: METADATA_SCHEMA_VERSION,
    enabled: input.enabled === true,
    language: typeof input.language === "string" && input.language ? input.language : defaults.language ?? PLAIN_LANGUAGE,
    requireLiteracy: input.requireLiteracy !== false,
    languageNameVisibility: VISIBILITY.has(input.languageNameVisibility)
      ? input.languageNameVisibility
      : defaults.languageNameVisibility ?? "gm-only",
    unreadableFallback: ["polyglot", "generic"].includes(input.unreadableFallback)
      ? input.unreadableFallback
      : defaults.unreadableFallback ?? "polyglot"
  };
  for (const [key, item] of Object.entries(input)) {
    if (!(key in metadata)) metadata[key] = clone(item);
  }
  return deepFreeze(metadata);
}

export function getPageMetadata(page, defaults = {}) {
  const value = page?.getFlag?.(MODULE_ID, "metadata") ?? page?.flags?.[MODULE_ID]?.metadata ?? page?.flags?.[MODULE_ID];
  return normalizePageMetadata(value, defaults);
}

export async function setPageMetadata(page, metadata, { user = globalThis.game?.user } = {}) {
  if (!page) throw new Error("Journal page is required.");
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  if (!user?.isGM && !page.testUserPermission?.(user, owner) && !page.isOwner) {
    throw new Error("Owner permission is required to edit language metadata.");
  }
  const normalized = normalizePageMetadata(metadata);
  if (typeof page.setFlag === "function") await page.setFlag(MODULE_ID, "metadata", normalized);
  else await page.update?.({ [`flags.${MODULE_ID}.metadata`]: normalized });
  globalThis.Hooks?.callAll?.("illuminatedLanguagesLanguageMetadataChanged", {
    documentUuid: page.uuid,
    metadata: normalized
  });
  return normalized;
}

export function validatePageMetadata(page, adapter) {
  const raw = page?.getFlag?.(MODULE_ID, "metadata") ?? page?.flags?.[MODULE_ID]?.metadata;
  const metadata = normalizePageMetadata(raw);
  const messages = [];
  if (raw && raw.schemaVersion !== METADATA_SCHEMA_VERSION) {
    messages.push({ severity: "warning", code: "schema-version", path: "schemaVersion" });
  }
  if (metadata.enabled && metadata.language !== PLAIN_LANGUAGE && adapter && adapter.getLanguage(metadata.language).missing) {
    messages.push({ severity: "warning", code: "missing-language", path: "language", languageId: metadata.language });
  }
  return deepFreeze({ valid: !messages.some((message) => message.severity === "error"), metadata, messages });
}
