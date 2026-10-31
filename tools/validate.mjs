// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "module", "runyth-illuminated-languages");

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function flatten(value, prefix = "", output = new Set()) {
  for (const [key, item] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === "object" && !Array.isArray(item)) flatten(item, next, output);
    else output.add(next);
  }
  return output;
}

const failures = [];
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(moduleRoot, "module.json"), "utf8"));
if (manifest.id !== "runyth-illuminated-languages") failures.push("Manifest ID is invalid.");
if (manifest.version !== packageJson.version) failures.push("Manifest and package versions differ.");
if (manifest.compatibility?.minimum !== "13" || manifest.compatibility?.maximum !== "13") failures.push("Foundry compatibility is not constrained to V13.");
if (manifest.relationships?.requires?.[0]?.id !== "polyglot") failures.push("Polyglot is not a required relationship.");
if (manifest.relationships?.recommends?.[0]?.id !== "illuminated-documents") failures.push("Illuminated Documents is not optional/recommended.");

for (const entry of manifest.esmodules ?? []) {
  try { await readFile(path.join(moduleRoot, entry)); }
  catch { failures.push(`Missing manifest ES module: ${entry}`); }
}
for (const entry of manifest.styles ?? []) {
  try { await readFile(path.join(moduleRoot, entry)); }
  catch { failures.push(`Missing manifest stylesheet: ${entry}`); }
}
for (const entry of manifest.languages ?? []) {
  try { await readFile(path.join(moduleRoot, entry.path)); }
  catch { failures.push(`Missing manifest localization file: ${entry.path}`); }
}

const en = JSON.parse(await readFile(path.join(moduleRoot, "lang", "en.json"), "utf8"));
const de = JSON.parse(await readFile(path.join(moduleRoot, "lang", "de.json"), "utf8"));
const enKeys = [...flatten(en)].sort();
const deKeys = [...flatten(de)].sort();
if (JSON.stringify(enKeys) !== JSON.stringify(deKeys)) failures.push("Localization key parity failed.");

const files = await walk(moduleRoot);
for (const file of files.filter((entry) => entry.endsWith(".json"))) {
  try {
    JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    failures.push(`Invalid JSON: ${path.relative(root, file)}: ${error.message}`);
  }
}
for (const file of files.filter((entry) => entry.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`JavaScript syntax failed: ${path.relative(root, file)}: ${result.stderr}`);
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    try {
      await readFile(target);
    } catch {
      failures.push(`Unresolved import ${match[1]} in ${path.relative(root, file)}.`);
    }
  }
}

const allowedTopLevel = new Set(["module.json", "scripts", "styles", "templates", "lang", "assets", "README.md", "CHANGELOG.md", "LICENSE"]);
const actualTopLevel = await readdir(moduleRoot);
for (const entry of actualTopLevel) if (!allowedTopLevel.has(entry)) failures.push(`Unexpected installable top-level entry: ${entry}`);
for (const entry of ["module.json", "scripts", "styles", "templates", "lang", "assets", "README.md", "CHANGELOG.md"]) {
  if (!actualTopLevel.includes(entry)) failures.push(`Missing installable entry: ${entry}`);
}
if (files.some((file) => file.endsWith(".map"))) failures.push("Installable archive contains source maps.");
if (files.some((file) => file.includes(`${path.sep}tests${path.sep}`))) failures.push("Installable module contains tests.");

const report = {
  passed: failures.length === 0,
  moduleFiles: files.length,
  JavaScriptFiles: files.filter((file) => file.endsWith(".js")).length,
  localizationKeys: enKeys.length,
  failures
};
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
