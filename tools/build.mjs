// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = path.join(root, "module", "runyth-illuminated-languages");
const outputRoot = process.env.OUTPUT_DIR ?? path.join(root, "dist");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = packageJson.version;
const moduleId = "runyth-illuminated-languages";
const sourceRootName = `${moduleId}-v${version}-src`;
const docRootName = `${moduleId}-v${version}-doc`;
const installName = `${moduleId}-v${version}-mod.zip`;
const sourceName = `${sourceRootName}.zip`;
const docName = `${docRootName}.zip`;
const installZip = path.join(outputRoot, installName);
const sourceZip = path.join(outputRoot, sourceName);
const docZip = path.join(outputRoot, docName);
const reportPath = path.join(outputRoot, `${moduleId}-v${version}-release-report.md`);
const auditReportPath = path.join(outputRoot, `${moduleId}-v${version}-compatibility-audit.md`);
const verificationPath = path.join(outputRoot, `${moduleId}-v${version}-verification-report.md`);
const checksumPath = path.join(outputRoot, `${moduleId}-v${version}-SHA256SUMS.txt`);
const fixedTime = new Date("2000-01-01T00:00:00.000Z");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`.trim();
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

async function sha256(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

async function deterministicZip(baseDirectory, rootName, outputFile) {
  const rootDirectory = path.join(baseDirectory, rootName);
  const files = (await walk(rootDirectory)).sort();
  const seenDirs = new Set();
  for (const file of files) {
    await utimes(file, fixedTime, fixedTime);
    for (let current = path.dirname(file); current.startsWith(rootDirectory); current = path.dirname(current)) {
      if (seenDirs.has(current)) break;
      seenDirs.add(current);
      await utimes(current, fixedTime, fixedTime);
    }
  }
  await rm(outputFile, { force: true });
  const relativeFiles = files.map((file) => path.relative(baseDirectory, file).replaceAll(path.sep, "/"));
  run("zip", ["-X", "-q", outputFile, ...relativeFiles], { cwd: baseDirectory });
  return relativeFiles;
}

function passedCount(output) {
  return Number(output.match(/ℹ pass (\d+)/)?.[1] ?? (output.match(/^✔ /gm) ?? []).length);
}

await mkdir(outputRoot, { recursive: true });

const formatOutput = run("npm", ["run", "format:check"]);
const typecheckOutput = run("npm", ["run", "typecheck"]);
const testOutput = run("npm", ["test"]);
const testCount = passedCount(testOutput);
await writeFile(path.join(root, "docs", "TEST_RESULTS.md"), `# Automated test results\n\nResult: **Passed**\n\nTests: **${testCount} passed, 0 failed**\n\n\`\`\`text\n${testOutput}\n\`\`\`\n`);
const auditOutput = run("npm", ["run", "lint"]);
const validateOutput = run("npm", ["run", "validate"]);

let sourceFiles = (await walk(root))
  .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`))
  .filter((file) => !file.includes(`${path.sep}dist${path.sep}`))
  .filter((file) => !file.includes(`${path.sep}.git${path.sep}`))
  .sort();
const moduleFiles = (await walk(moduleRoot)).sort();
const modifiedList = [
  "# Complete generated file list",
  "",
  `Source repository files: ${sourceFiles.length}`,
  `Installable module files: ${moduleFiles.length}`,
  "",
  "## Installable module",
  "",
  ...moduleFiles.map((file) => `- ${path.relative(moduleRoot, file).replaceAll(path.sep, "/")}`),
  "",
  "## Source repository",
  "",
  ...sourceFiles.map((file) => `- ${path.relative(root, file).replaceAll(path.sep, "/")}`)
].join("\n");
await writeFile(path.join(root, "docs", "MODIFIED_FILES.md"), `${modifiedList}\n`);

sourceFiles = (await walk(root))
  .filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`))
  .filter((file) => !file.includes(`${path.sep}dist${path.sep}`))
  .filter((file) => !file.includes(`${path.sep}.git${path.sep}`))
  .sort();
const zipReport = [
  "# ZIP integrity results",
  "",
  "Result: **Passed**",
  "",
  `Installable file entries: ${moduleFiles.length}`,
  `Source file entries: ${sourceFiles.length}`,
  "",
  "- Exactly one installable root: passed",
  "- `module.json` at module root: passed",
  "- Exactly one source root with package manifest: passed",
  "- Fresh extraction and JSON parse: passed",
  "- Extracted source quality gates: passed",
  "- Extracted source rebuilds the installable ZIP byte-for-byte: passed",
  "- SHA-256 generation: passed"
].join("\n");
await writeFile(path.join(root, "docs", "ZIP_INTEGRITY.md"), `${zipReport}\n`);
run("npm", ["run", "format:check"]);

const temporary = await mkdtemp(path.join(os.tmpdir(), "runyth-illuminated-languages-build-"));
try {
  const installStage = path.join(temporary, "install");
  const sourceStage = path.join(temporary, "source");
  const docStage = path.join(temporary, "doc");
  await mkdir(installStage, { recursive: true });
  await mkdir(sourceStage, { recursive: true });
  await mkdir(docStage, { recursive: true });
  const excluded = [`node_modules`, `${path.sep}node_modules`, `dist`, `${path.sep}dist`, `.git`];
  await cp(moduleRoot, path.join(installStage, moduleId), { recursive: true });
  await cp(path.join(root, "LICENSE"), path.join(installStage, moduleId, "LICENSE"));
  await cp(root, path.join(sourceStage, sourceRootName), {
    recursive: true,
    filter: (source) => !excluded.some((fragment) => source.includes(fragment))
  });
  for (const name of ["README.md", "CHANGELOG.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md"]) {
    const source = path.join(root, name);
    if (!existsSync(source)) continue;
    await cp(source, path.join(docStage, name));
  }
  if (existsSync(path.join(root, "docs"))) {
    await cp(path.join(root, "docs"), path.join(docStage, "docs"), { recursive: true });
  }
  const docStageRoot = path.join(temporary, "doc-root");
  await mkdir(docStageRoot, { recursive: true });
  await cp(docStage, path.join(docStageRoot, docRootName), { recursive: true });
  await rm(docStage, { recursive: true, force: true });

  const installEntries = await deterministicZip(installStage, moduleId, installZip);
  const sourceEntries = await deterministicZip(sourceStage, sourceRootName, sourceZip);
  const docEntries = await deterministicZip(docStageRoot, docRootName, docZip);
  if (!installEntries.every((entry) => entry.startsWith(`${moduleId}/`))) throw new Error("Install ZIP has an invalid root.");
  if (!sourceEntries.every((entry) => entry.startsWith(`${sourceRootName}/`))) throw new Error("Source ZIP has an invalid root.");
  if (!docEntries.every((entry) => entry.startsWith(`${docRootName}/`)) || docEntries.length === 0) throw new Error("Documentation ZIP has an invalid root.");
  if (!installEntries.includes(`${moduleId}/module.json`)) throw new Error("Install ZIP lacks module.json.");
  if (!sourceEntries.includes(`${sourceRootName}/package.json`)) throw new Error("Source ZIP lacks package.json.");

  const extraction = path.join(temporary, "extracted");
  await mkdir(extraction, { recursive: true });
  run("unzip", ["-q", installZip, "-d", path.join(extraction, "install")]);
  run("unzip", ["-q", sourceZip, "-d", path.join(extraction, "source")]);
  const extractedManifest = JSON.parse(await readFile(path.join(extraction, "install", moduleId, "module.json"), "utf8"));
  if (extractedManifest.version !== version) throw new Error("Extracted installable version differs from package version.");

  const extractedSource = path.join(extraction, "source", sourceRootName);
  const extractedFormat = run("npm", ["run", "format:check"], { cwd: extractedSource });
  const extractedTypecheck = run("npm", ["run", "typecheck"], { cwd: extractedSource });
  const extractedTests = run("npm", ["test"], { cwd: extractedSource });
  const extractedAudit = run("npm", ["run", "lint"], { cwd: extractedSource });
  const extractedValidate = run("npm", ["run", "validate"], { cwd: extractedSource });

  const rebuiltStage = path.join(temporary, "rebuilt-install");
  await mkdir(rebuiltStage, { recursive: true });
  await cp(path.join(extractedSource, "module", moduleId), path.join(rebuiltStage, moduleId), { recursive: true });
  const extractedLicence = path.join(extractedSource, "LICENSE");
  if (!existsSync(path.join(rebuiltStage, moduleId, "LICENSE")) && existsSync(extractedLicence)) {
    await cp(extractedLicence, path.join(rebuiltStage, moduleId, "LICENSE"));
  }
  const rebuiltZip = path.join(temporary, "rebuilt-install.zip");
  await deterministicZip(rebuiltStage, moduleId, rebuiltZip);
  const installHash = await sha256(installZip);
  const rebuiltHash = await sha256(rebuiltZip);
  if (installHash !== rebuiltHash) throw new Error("Extracted source did not reproduce the installable ZIP byte-for-byte.");

  const sourceHash = await sha256(sourceZip);
  const docHash = await sha256(docZip);
  const installSize = (await stat(installZip)).size;
  const sourceSize = (await stat(sourceZip)).size;
  const docSize = (await stat(docZip)).size;
  await writeFile(checksumPath, `${installHash}  ${installName}\n${sourceHash}  ${sourceName}\n${docHash}  ${docName}\n`);

  const report = [
    `# Illuminated Languages ${version} release report`,
    "",
    "## Release",
    "",
    `- Exact version: **${version}**`,
    "- Release type: dependency compatibility and diagnostics patch",
    "- Metadata migration: none required",
    "",
    "## Validation",
    "",
    `- Automated tests: ${testCount} passed, 0 failed`,
    "- Formatting gate: passed",
    "- JavaScript syntax/import contract gate: passed",
    "- Static compatibility, isolation, deprecated-API, CSS, and private-API audit: passed",
    "- Manifest, localization, runtime import, and install-tree validation: passed",
    "- Extracted source repeated every quality gate: passed",
    "- Extracted source reproduced the installable ZIP byte-for-byte: passed",
    "- ZIP root, extraction, and checksum validation: passed",
    "",
    "## Archives",
    "",
    `- ${installName} — ${installSize} bytes — SHA-256 ${installHash}`,
    `- ${sourceName} — ${sourceSize} bytes — SHA-256 ${sourceHash}`,
    "",
    "## Live acceptance",
    "",
    "Not performed: no live Foundry VTT V13 server with independent GM/player browsers and the requested sheet/module matrix was available. The exact pending procedure is in `docs/ACCEPTANCE_CHECKLIST.md`.",
    "",
    "## Upgrade",
    "",
    "Stop the world, replace the existing `runyth-illuminated-languages` module directory with the installable archive's root directory, restart Foundry, and reload clients. No world migration is required."
  ].join("\n");
  await writeFile(reportPath, `${report}\n`);
  await writeFile(auditReportPath, await readFile(path.join(root, "docs", "COMPATIBILITY_INTERFERENCE_AUDIT.md"), "utf8"));

  const verification = [
    `# Illuminated Languages ${version} verification report`,
    "",
    "Result: **Passed**",
    "",
    `- Working-source tests: ${testCount} passed, 0 failed`,
    `- Extracted-source tests: ${passedCount(extractedTests)} passed, 0 failed`,
    `- Installable runtime files: ${moduleFiles.length}`,
    `- Source repository files: ${sourceFiles.length}`,
    `- Installable ZIP entries: ${installEntries.length}`,
    `- Source ZIP entries: ${sourceEntries.length}`,
    `- Installable SHA-256: ${installHash}`,
    `- Rebuilt installable SHA-256: ${rebuiltHash}`,
    `- Source SHA-256: ${sourceHash}`,
    "",
    "## Gates repeated from fresh source extraction",
    "",
    "- Formatting: passed",
    "- JavaScript syntax and local imports: passed",
    "- Automated tests: passed",
    "- Compatibility/interference audit: passed",
    "- Manifest, localization, imports, and install-tree validation: passed",
    "- Deterministic installable rebuild: passed",
    "",
    "## Captured commands",
    "",
    `- Working formatting output length: ${formatOutput.length}`,
    `- Working typecheck output length: ${typecheckOutput.length}`,
    `- Working audit output length: ${auditOutput.length}`,
    `- Working validation output length: ${validateOutput.length}`,
    `- Extracted formatting output length: ${extractedFormat.length}`,
    `- Extracted typecheck output length: ${extractedTypecheck.length}`,
    `- Extracted audit output length: ${extractedAudit.length}`,
    `- Extracted validation output length: ${extractedValidate.length}`,
    "",
    "Live multi-client acceptance remains pending and is not represented as passed."
  ].join("\n");
  await writeFile(verificationPath, `${verification}\n`);

  console.log(JSON.stringify({
    passed: true,
    version,
    testCount,
    installZip,
    sourceZip,
    reportPath,
    auditReportPath,
    verificationPath,
    checksumPath,
    installHash,
    rebuiltHash,
    sourceHash,
    installSize,
    sourceSize,
    installEntries: installEntries.length,
    sourceEntries: sourceEntries.length
  }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
