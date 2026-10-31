// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { parse, compare, satisfies, assertSatisfies } from "../module/runyth-illuminated-languages/scripts/utils/semver.js";
import { hashString, stableSeed, neutralScramble } from "../module/runyth-illuminated-languages/scripts/utils/hash.js";

test("semantic versions parse", () => {
  assert.deepEqual(parse("2.8.3"), [2, 8, 3]);
  assert.deepEqual(parse("1.0.0-beta.1"), [1, 0, 0]);
  assert.equal(parse("v1"), null);
});

test("semantic versions compare", () => {
  assert.equal(compare("1.0.0", "1.0.0"), 0);
  assert.equal(compare("1.0.1", "1.0.0"), 1);
  assert.equal(compare("0.9.9", "1.0.0"), -1);
});

test("semantic ranges support V13 Polyglot range", () => {
  assert.equal(satisfies("2.8.3", ">=2.8.3 <2.9.0"), true);
  assert.equal(satisfies("2.8.4", ">=2.8.3 <2.9.0"), true);
  assert.equal(satisfies("2.8.4+custom.1", ">=2.8.3 <2.9.0"), true);
  assert.equal(satisfies("2.8.2", ">=2.8.3 <2.9.0"), false);
  assert.equal(satisfies("2.9.0", ">=2.8.3 <2.9.0"), false);
});

test("caret ranges are supported", () => {
  assert.equal(satisfies("1.9.4", "^1.0.0"), true);
  assert.equal(satisfies("2.0.0", "^1.0.0"), false);
});

test("assertSatisfies reports incompatible APIs", () => {
  assert.throws(() => assertSatisfies("2.0.0", "^1.0.0", "API"), /does not satisfy/);
});

test("hashString is deterministic", () => {
  assert.equal(hashString("document"), hashString("document"));
  assert.notEqual(hashString("document"), hashString("Document"));
});

test("stableSeed includes every component", () => {
  assert.equal(stableSeed(["a", "b", 1]), stableSeed(["a", "b", 1]));
  assert.notEqual(stableSeed(["a", "b", 1]), stableSeed(["a", "b", 2]));
});

test("neutral scrambling preserves whitespace and punctuation", () => {
  const source = "Secret, text!\nNext";
  const result = neutralScramble(source, 42);
  assert.equal(result.includes(","), true);
  assert.equal(result.includes("!"), true);
  assert.equal(result.includes("\n"), true);
  assert.notEqual(result, source);
});
