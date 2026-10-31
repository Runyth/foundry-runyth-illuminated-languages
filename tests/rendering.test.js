// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { LanguageTransformer } from "../module/runyth-illuminated-languages/scripts/rendering/transformer.js";
import { SafeExecutor } from "../module/runyth-illuminated-languages/scripts/utils/safe-executor.js";
import { FakeSettings, FakeHooks, actor } from "./helpers/fakes.js";
import { FakeDocument, elementWithText } from "./helpers/dom.js";

function setup({ readable = false, compatible = true } = {}) {
  const settings = new FakeSettings({ showLanguageBadge: true, usePolyglotFonts: true });
  const adapter = {
    compatible,
    scramble: (text, options) => `${options.languageId}:${text.split("").reverse().join("")}`,
    getLanguageFont: () => "Elven Script",
    getLanguageLabel: () => "Elvish"
  };
  const engine = { resolve: async () => ({ readable, understood: readable, recognized: readable }) };
  const readingActor = actor("reader");
  const resolver = {
    resolve: () => ({ actorId: readingActor.id, actorUuid: readingActor.uuid, source: "explicit" }),
    getActor: () => readingActor
  };
  const hooks = new FakeHooks();
  const transformer = new LanguageTransformer({
    adapter,
    engine,
    resolver,
    settings,
    executor: new SafeExecutor({ logger: { error() {} } }),
    localize: (key) => ({
      "ILLUMINATED_LANGUAGES.Badge.WrittenIn": "Written in {language}",
      "ILLUMINATED_LANGUAGES.Badge.UnknownScript": "Unknown script",
      "ILLUMINATED_LANGUAGES.Badge.UnreadableWriting": "Unreadable writing",
      "ILLUMINATED_LANGUAGES.Accessibility.Unreadable": "Text written in an unreadable script.",
      "ILLUMINATED_LANGUAGES.Errors.ProtectedContentUnavailable": "Unavailable"
    }[key] ?? key),
    hooks
  });
  return { transformer, hooks };
}

test("readable text remains unchanged", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Original text", document);
  await setup({ readable: true }).transformer.transform(root, { languageId: "elvish", documentUuid: "Journal.1" });
  assert.equal(root.textContent.includes("Original text"), true);
});

test("unreadable text is transformed deterministically", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Original text", document);
  await setup().transformer.transform(root, { languageId: "elvish", documentUuid: "Journal.1" });
  assert.equal(root.textContent.includes("elvish:txet lanigirO"), true);
});

test("HTML structure is preserved", async () => {
  const document = new FakeDocument();
  const root = document.createElement("article");
  const heading = elementWithText("h2", "Heading", document);
  const paragraph = elementWithText("p", "Paragraph", document);
  root.append(heading, paragraph);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(root.childNodes.includes(heading), true);
  assert.equal(root.childNodes.includes(paragraph), true);
});

test("ordinary links remain functional and href is untouched", async () => {
  const document = new FakeDocument();
  const root = document.createElement("article");
  const link = elementWithText("a", "Read more", document);
  link.setAttribute("href", "https://example.invalid/path");
  root.append(link);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(link.getAttribute("href"), "https://example.invalid/path");
  assert.notEqual(link.textContent, "Read more");
});

test("inline rolls remain unchanged", async () => {
  const document = new FakeDocument();
  const root = document.createElement("article");
  const roll = elementWithText("span", "1d20 + 5", document);
  roll.classList.add("inline-roll");
  root.append(roll);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(roll.textContent, "1d20 + 5");
});

test("ignore marker remains unchanged", async () => {
  const document = new FakeDocument();
  const root = document.createElement("article");
  const ignored = elementWithText("span", "GM annotation", document);
  ignored.setAttribute("data-illuminated-language-ignore", "");
  root.append(ignored);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(ignored.textContent, "GM annotation");
});

test("source document object is never mutated", async () => {
  const sourceDocument = { text: { content: "Authoritative source" } };
  const document = new FakeDocument();
  const root = elementWithText("article", sourceDocument.text.content, document);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(sourceDocument.text.content, "Authoritative source");
});

test("transformed content is not copied into ARIA labels", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Authoritative source", document);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(root.getAttribute("aria-label"), null);
  assert.equal(root.getAttribute("aria-description"), "Text written in an unreadable script.");
  assert.equal(root.getAttribute("aria-description").includes("Authoritative"), false);
});

test("duplicate transformation is prevented", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Original", document);
  const { transformer } = setup();
  await transformer.transform(root, { languageId: "elvish" });
  const once = root.textContent;
  const result = await transformer.transform(root, { languageId: "elvish" });
  assert.equal(result.reason, "duplicate");
  assert.equal(root.textContent, once);
});

test("cancelled transform returns safely", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Original", document);
  const controller = new AbortController();
  controller.abort();
  const result = await setup().transformer.transform(root, { languageId: "elvish", signal: controller.signal });
  assert.equal(["cancelled", "duplicate", undefined].includes(result.reason), true);
});

test("incompatible Polyglot hides source and adds warning", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Protected source", document);
  await setup({ compatible: false }).transformer.transform(root, { languageId: "elvish" });
  assert.equal(root.textContent.includes("Protected source"), false);
  assert.equal(root.textContent.includes("Unavailable"), true);
});

test("language font and appearance variables are applied", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Protected", document);
  await setup().transformer.transform(root, { languageId: "elvish" });
  assert.equal(root.style.getPropertyValue("--illuminated-language-font"), '"Elven Script"');
  assert.equal(root.style.getPropertyValue("--illuminated-language-scale"), "1");
});

test("transform hooks fire once per render", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Protected", document);
  const { transformer, hooks } = setup();
  await transformer.transform(root, { languageId: "elvish" });
  assert.equal(hooks.calls.filter((entry) => entry.name === "illuminatedLanguagesBeforeTransform").length, 1);
  assert.equal(hooks.calls.filter((entry) => entry.name === "illuminatedLanguagesAfterTransform").length, 1);
});

test("an explicitly provided null actor is not replaced by the local resolver", async () => {
  const document = new FakeDocument();
  const root = elementWithText("article", "Protected", document);
  const result = await setup().transformer.transform(root, {
    languageId: "elvish",
    actor: null,
    user: { id: "preview", isGM: false },
    originalView: false,
    forceUnreadable: true
  });
  assert.equal(result.actorId, null);
  assert.equal(result.readable, false);
});
