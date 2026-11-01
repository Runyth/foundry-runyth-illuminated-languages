// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePageMetadata, getPageMetadata, setPageMetadata, validatePageMetadata } from "../module/runyth-illuminated-languages/scripts/journals/metadata.js";
import { normalizeIlluminatedMetadata, effectiveLanguage, validateIlluminatedMetadata } from "../module/runyth-illuminated-languages/scripts/validation/metadata.js";

test("page metadata normalizes a missing value", () => {
  const result = normalizePageMetadata(null);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.enabled, false);
  assert.equal(result.language, "__plain__");
});

test("page metadata preserves unknown fields", () => {
  const result = normalizePageMetadata({ enabled: true, language: "old-language", future: { x: 1 } });
  assert.deepEqual(result.future, { x: 1 });
});

test("invalid visibility falls back to GM only", () => {
  assert.equal(normalizePageMetadata({ languageNameVisibility: "leak" }).languageNameVisibility, "gm-only");
});

test("getPageMetadata reads namespaced flag", () => {
  const page = { flags: { "runyth-illuminated-languages": { metadata: { enabled: true, language: "elvish" } } } };
  assert.equal(getPageMetadata(page).language, "elvish");
});

test("metadata update requires owner permission", async () => {
  const page = { isOwner: false, testUserPermission: () => false };
  await assert.rejects(() => setPageMetadata(page, {}, { user: { isGM: false } }), /Owner permission/);
});

test("GM may update metadata without ownership", async () => {
  let written;
  const page = { uuid: "JournalEntryPage.1", setFlag: async (_scope, _key, value) => { written = value; } };
  await setPageMetadata(page, { enabled: true, language: "elvish" }, { user: { isGM: true } });
  assert.equal(written.language, "elvish");
});

test("invalid language is preserved and warned", () => {
  const page = { flags: { "runyth-illuminated-languages": { metadata: { enabled: true, language: "missing" } } } };
  const adapter = { getLanguage: () => ({ missing: true }) };
  const result = validatePageMetadata(page, adapter);
  assert.equal(result.metadata.language, "missing");
  assert.equal(result.messages.some((message) => message.code === "missing-language"), true);
});

test("Illuminated metadata preserves block IDs and unknown keys", () => {
  const result = normalizeIlluminatedMetadata({
    schemaVersion: 0,
    future: true,
    document: { defaultLanguage: "elvish" },
    blocks: { "idoc-block-1": { language: "dwarvish", difficulty: 4 } }
  });
  assert.equal(result.blocks["idoc-block-1"].language, "dwarvish");
  assert.equal(result.blocks["idoc-block-1"].difficulty, 4);
  assert.equal(result.future, true);
});

test("null block language becomes inherit", () => {
  const result = normalizeIlluminatedMetadata({ blocks: { a: { language: null } } });
  assert.equal(result.blocks.a.language, "__inherit__");
});

test("block override supersedes document language", () => {
  const metadata = normalizeIlluminatedMetadata({
    document: { defaultLanguage: "elvish" },
    blocks: { a: { language: "dwarvish" } }
  });
  assert.equal(effectiveLanguage(metadata, "a"), "dwarvish");
});

test("inherit uses document language", () => {
  const metadata = normalizeIlluminatedMetadata({
    document: { defaultLanguage: "elvish" },
    blocks: { a: { language: "__inherit__" } }
  });
  assert.equal(effectiveLanguage(metadata, "a"), "elvish");
});

test("Illuminated metadata validator warns without deleting IDs", () => {
  const adapter = { getLanguage: (id) => ({ missing: id === "lost" }) };
  const result = validateIlluminatedMetadata({ document: { defaultLanguage: "lost" } }, adapter);
  assert.equal(result.metadata.document.defaultLanguage, "lost");
  assert.equal(result.messages[0].languageId, "lost");
});

test("new metadata defaults language-name visibility to GM only", () => {
  assert.equal(normalizePageMetadata({}).languageNameVisibility, "gm-only");
  assert.equal(normalizeIlluminatedMetadata({}).document.languageNameVisibility, "gm-only");
});

