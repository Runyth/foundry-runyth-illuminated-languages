// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "module", "runyth-illuminated-languages");

async function allFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await allFiles(target));
    else result.push(target);
  }
  return result;
}

function flatten(value, prefix = "", output = new Set()) {
  for (const [key, item] of Object.entries(value)) {
    const pathValue = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object") flatten(item, pathValue, output);
    else output.add(pathValue);
  }
  return output;
}

test("manifest identifies release and dependencies", async () => {
  const manifest = JSON.parse(await readFile(path.join(moduleRoot, "module.json"), "utf8"));
  assert.equal(manifest.id, "runyth-illuminated-languages");
  assert.equal(manifest.version, "1.0.10");
  assert.equal(manifest.compatibility.minimum, "13");
  assert.equal(manifest.compatibility.maximum, "13");
  assert.equal(manifest.relationships.requires[0].id, "polyglot");
  assert.equal(manifest.relationships.requires[0].compatibility.minimum, "2.8.3");
  assert.equal(manifest.relationships.requires[0].compatibility.verified, "2.8.3");
  assert.equal("maximum" in manifest.relationships.requires[0].compatibility, false);
  assert.equal(manifest.relationships.recommends[0].id, "illuminated-documents");
});

test("English and German localization have exact key parity", async () => {
  const en = flatten(JSON.parse(await readFile(path.join(moduleRoot, "lang", "en.json"), "utf8")));
  const de = flatten(JSON.parse(await readFile(path.join(moduleRoot, "lang", "de.json"), "utf8")));
  assert.deepEqual([...en].sort(), [...de].sort());
});

test("runtime source contains no V1 Application subclasses", async () => {
  const files = (await allFiles(path.join(moduleRoot, "scripts"))).filter((file) => file.endsWith(".js"));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /extends\s+(?:Application|FormApplication)\b/);
  assert.doesNotMatch(source, /foundry\.appv1/);
});

test("runtime source contains no jQuery rendering assumptions", async () => {
  const files = (await allFiles(path.join(moduleRoot, "scripts"))).filter((file) => file.endsWith(".js"));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /html\.find\s*\(/);
  assert.doesNotMatch(source, /\bjQuery\s*\(/);
  assert.doesNotMatch(source, /\$\s*\(/);
});

test("runtime source contains no unsafe dynamic execution", async () => {
  const files = (await allFiles(path.join(moduleRoot, "scripts"))).filter((file) => file.endsWith(".js"));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
});

test("Illuminated Documents private paths are not imported", async () => {
  const file = await readFile(path.join(moduleRoot, "scripts", "integrations", "illuminated-documents", "integration.js"), "utf8");
  assert.doesNotMatch(file, /from\s+["'][^"']*illuminated-documents/);
  assert.match(file, /illuminatedDocuments\?\.api/);
});

test("templates provide labels rather than unexplained icon-only actions", async () => {
  const templates = (await allFiles(path.join(moduleRoot, "templates"))).filter((file) => file.endsWith(".hbs"));
  const source = (await Promise.all(templates.map((file) => readFile(file, "utf8")))).join("\n");
  assert.match(source, /<label/);
  assert.match(source, /localize/);
});

test("installable module contains required top-level directories", async () => {
  const entries = new Set(await readdir(moduleRoot));
  for (const required of ["module.json", "scripts", "styles", "templates", "lang", "assets", "README.md", "CHANGELOG.md"]) {
    assert.equal(entries.has(required), true, required);
  }
});


test("reading resolver does not freeze live documents or read deprecated D&D senses", async () => {
  const source = await readFile(path.join(moduleRoot, "scripts", "comprehension", "actor-resolver.js"), "utf8");
  assert.doesNotMatch(source, /deepFreeze\s*\(\s*\{\s*actor\b/);
  assert.doesNotMatch(source, /senses\.(?:darkvision|blindsight|tremorsense|truesight)\b/);
  assert.match(source, /senses\?\.ranges/);
  assert.match(source, /getActor\(resolution\)/);
});
