// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { deepFreeze } from "../module/runyth-illuminated-languages/scripts/utils/object.js";

test("deepFreeze copies and freezes cyclic module-owned plain data", () => {
  const source = { name: "root", nested: { value: 1 } };
  source.self = source;
  const result = deepFreeze(source);
  assert.notEqual(result, source);
  assert.equal(result.self, result);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.nested), true);
  source.name = "mutable source";
  assert.equal(source.name, "mutable source");
});

test("deepFreeze does not invoke accessors", () => {
  let reads = 0;
  const source = {};
  Object.defineProperty(source, "dangerous", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("must not run");
    }
  });
  const result = deepFreeze(source);
  assert.equal(reads, 0);
  assert.equal(result.dangerous, null);
});

test("deepFreeze replaces unsupported external instances without freezing them", () => {
  class ExternalDocument {
    constructor() {
      this.name = "Mutable";
    }
  }
  const external = new ExternalDocument();
  const result = deepFreeze({ external });
  assert.equal(result.external, null);
  assert.equal(Object.isFrozen(external), false);
  external.name = "Changed";
  assert.equal(external.name, "Changed");
});
