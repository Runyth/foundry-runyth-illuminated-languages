// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { readFile, readdir, writeFile } from "node:fs/promises";
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

const runtimeFiles = await walk(moduleRoot);
const scriptFiles = runtimeFiles.filter((file) => file.endsWith(".js"));
const templateFiles = runtimeFiles.filter((file) => file.endsWith(".hbs"));
const sources = await Promise.all(scriptFiles.map(async (file) => ({ file, source: await readFile(file, "utf8") })));
const combined = sources.map(({ source }) => source).join("\n");
const templates = (await Promise.all(templateFiles.map((file) => readFile(file, "utf8")))).join("\n");
const cssPath = path.join(moduleRoot, "styles", "runyth-illuminated-languages.css");
const css = await readFile(cssPath, "utf8");

const checks = [
  ["V1 Application subclass", /extends\s+(?:Application|FormApplication)\b/],
  ["Foundry appv1 namespace", /foundry\.appv1/],
  ["deprecated renderApplication hook", /["']renderApplication["']/],
  ["deprecated renderChatMessage hook", /["']renderChatMessage["']/],
  ["deprecated Journal V1 hook", /["']renderJournalSheet["']/],
  ["deprecated global Foundry aliases", /(?<!\.)\b(?:FormDataExtended|FilePicker|loadTemplates|Tour)\b/],
  ["jQuery API", /html\.(?:find|on|closest)\s*\(|\bjQuery\s*\(|\$\s*\(/],
  ["outdated Scene Controls array mutation", /controls\.push\s*\(/],
  ["reserved generic tab action", /data-action=["']tab["']/],
  ["raw global keyboard listener", /(?:window|document)\.addEventListener\s*\(\s*["']key(?:down|up|press)["']/],
  ["deprecated or unrelated Chat integration", /ChatMessage\.create|["']renderChatMessageHTML["']/],
  ["Actor or Item sheet injection", /["'](?:renderActor|renderItem|getActorSheet|getItemSheet)[^"']*["']/],
  ["Tidy sheet integration", /tidy5e/i],
  ["Token HUD integration", /["']renderTokenHUD["']/],
  ["Scene Controls integration", /["']getSceneControlButtons["']/],
  ["canvas lifecycle integration", /["'](?:canvasInit|canvasReady|canvasDraw|canvasTearDown)["']/],
  ["PIXI or canvas display-object creation", /\bPIXI\.|canvas\.(?:stage|interface|primary|tokens)\b/],
  ["unsafe dynamic execution", /\beval\s*\(|new\s+Function\s*\(/],
  ["private Illuminated Documents import", /from\s+["'](?:\/?modules\/illuminated-documents|illuminated-documents\/)/],
  ["private Polyglot import", /from\s+["'](?:\/?modules\/polyglot|polyglot\/)/],
  ["prototype monkey patch", /\.prototype\.[A-Za-z_$][\w$]*\s*=/],
  ["deprecated direct D&D sense access", /senses\.(?:darkvision|blindsight|tremorsense|truesight)\b/],
  ["live Actor passed directly to deepFreeze", /deepFreeze\s*\(\s*\{\s*actor\b/]
];

const failures = [];
for (const [name, pattern] of checks) {
  const haystacks = name === "reserved generic tab action"
    ? [{ file: "templates", source: templates }]
    : sources;
  for (const { file, source } of haystacks) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) failures.push({ name, file: typeof file === "string" ? path.relative(root, file) : file });
  }
}

function cssSelectors(source) {
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const groups = [];
  for (let index = 0; index < clean.length; index += 1) {
    if (clean[index] !== "{") continue;
    const boundary = Math.max(clean.lastIndexOf("}", index - 1), clean.lastIndexOf("{", index - 1));
    const group = clean.slice(boundary + 1, index).trim();
    if (group && !group.startsWith("@")) groups.push(group);
  }
  return groups.flatMap((group) => group.split(",")).map((selector) => selector.trim()).filter(Boolean);
}

const allowedSelector = /^(?:\.runyth-illuminated-languages(?:\b|[-_])|\.runyth-illuminated-languages-form\b)/;
const unsafeSelectors = cssSelectors(css).filter((selector) => !allowedSelector.test(selector));
for (const selector of unsafeSelectors) failures.push({ name: "unscoped CSS selector", file: path.relative(root, cssPath), selector });

const positive = [
  ["ApplicationV2-only applications", /ApplicationV2/],
  ["native HTMLElement traversal", /createTreeWalker|querySelector/],
  ["abortable render/listener lifecycle", /AbortController/],
  ["strict Journal page ownership predicate", /isPrimaryJournalPageApplication/],
  ["editor exclusion", /isJournalEditor/],
  ["document-specific Journal context hook", /getJournalEntryContextOptions/],
  ["idempotent hook cleanup", /if \(removed\) return/],
  ["idempotent lifecycle registration", /if \(this\.lifecycleHookIds\.length\) return/],
  ["idempotent socket registration", /if \(this\.registered\) return false/],
  ["socket replay suppression", /seenRequests/],
  ["safe asynchronous hook execution", /journal\.render/],
  ["header controls inserted before native cluster", /controls\.unshift/],
  ["public Illuminated Documents API", /illuminatedDocuments\?\.api/],
  ["public game API namespace", /illuminatedLanguages/],
  ["cycle-safe immutable snapshots", /new WeakMap\(\)|new WeakSet\(\)/],
  ["current D&D sense ranges", /senses\?\.ranges/]
];
const missing = positive.filter(([, pattern]) => !pattern.test(combined)).map(([name]) => name);

const report = {
  passed: failures.length === 0 && missing.length === 0,
  scannedRuntimeFiles: runtimeFiles.length,
  scannedJavaScriptFiles: scriptFiles.length,
  scannedTemplateFiles: templateFiles.length,
  cssSelectors: cssSelectors(css).length,
  forbiddenFindings: failures,
  requiredEvidenceMissing: missing,
  checks: checks.map(([name]) => name).concat("unscoped CSS selector"),
  positiveEvidence: positive.map(([name]) => name)
};

const markdown = [
  "# Static compatibility and isolation audit",
  "",
  `Result: **${report.passed ? "Passed" : "Failed"}**`,
  "",
  `Runtime files: ${report.scannedRuntimeFiles}`,
  `JavaScript files: ${report.scannedJavaScriptFiles}`,
  `Templates: ${report.scannedTemplateFiles}`,
  `CSS selectors checked: ${report.cssSelectors}`,
  "",
  "## Forbidden-pattern checks",
  "",
  ...report.checks.map((name) => `- ${name}: ${failures.some((finding) => finding.name === name) ? "FAILED" : "passed"}`),
  "",
  "## Required architecture evidence",
  "",
  ...report.positiveEvidence.map((name) => `- ${name}: ${missing.includes(name) ? "MISSING" : "present"}`),
  "",
  failures.length ? `Findings:\n\n\`\`\`json\n${JSON.stringify(failures, null, 2)}\n\`\`\`` : "No forbidden runtime, template, or stylesheet patterns were found."
].join("\n");
await writeFile(path.join(root, "docs", "STATIC_AUDIT_RESULTS.md"), `${markdown}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
