// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensions = new Set([".css", ".hbs", ".js", ".json", ".md", ".yml", ".yaml"]);
const failures = [];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (extensions.has(path.extname(entry.name))) files.push(target);
  }
  return files;
}

for (const file of await walk(root)) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(root, file);
  if (source.includes("\r")) failures.push(`${relative}: contains CRLF or bare carriage returns.`);
  if (!source.endsWith("\n")) failures.push(`${relative}: does not end with a newline.`);
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (/\s+$/.test(lines[index])) failures.push(`${relative}:${index + 1}: trailing whitespace.`);
    if (/\t/.test(lines[index])) failures.push(`${relative}:${index + 1}: tab indentation.`);
  }
}

console.log(JSON.stringify({ passed: failures.length === 0, failures }, null, 2));
if (failures.length) process.exitCode = 1;
