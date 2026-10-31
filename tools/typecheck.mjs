// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".mjs")) files.push(target);
  }
  return files;
}

const files = await walk(root);
for (const file of files) {
  const relative = path.relative(root, file);
  const syntax = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (syntax.status !== 0) failures.push(`${relative}: ${syntax.stderr.trim()}`);
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/(?:from\s+|import\s*\()["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), match[1]);
    try {
      await readFile(target);
    } catch {
      failures.push(`${relative}: unresolved import ${match[1]}.`);
    }
  }
}

console.log(JSON.stringify({
  passed: failures.length === 0,
  language: "JavaScript",
  checkedFiles: files.length,
  note: "The repository contains JavaScript rather than TypeScript; this gate checks syntax and local import contracts.",
  failures
}, null, 2));
if (failures.length) process.exitCode = 1;
