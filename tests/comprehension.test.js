// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { ProviderRegistry } from "../module/runyth-illuminated-languages/scripts/comprehension/provider-registry.js";
import { ComprehensionEngine } from "../module/runyth-illuminated-languages/scripts/comprehension/engine.js";
import { SafeExecutor } from "../module/runyth-illuminated-languages/scripts/utils/safe-executor.js";
import { FakeHooks, actor } from "./helpers/fakes.js";

function setup(adapter = { canRead: () => false, canUnderstand: () => false }) {
  const hooks = new FakeHooks();
  const executor = new SafeExecutor({ logger: { error() {} }, throttleMs: 0 });
  const registry = new ProviderRegistry({ executor, hooks });
  const engine = new ComprehensionEngine({ adapter, registry, executor, hooks });
  return { registry, engine, executor, hooks };
}

test("plain language is readable", async () => {
  const { engine } = setup();
  assert.equal((await engine.resolve({ languageId: "__plain__" })).readable, true);
});

test("missing actor fails closed", async () => {
  const { engine } = setup();
  assert.equal((await engine.resolve({ languageId: "elvish" })).readable, false);
});

test("base adapter can grant reading", async () => {
  const { engine } = setup({ canRead: () => true, canUnderstand: () => true });
  assert.equal((await engine.resolve({ actor: actor("a"), languageId: "elvish" })).readable, true);
});

test("provider registration rejects duplicates", () => {
  const { registry } = setup();
  registry.registerProvider({ id: "example", resolveComprehension() {} });
  assert.throws(() => registry.registerProvider({ id: "example" }), /already registered/);
});

test("provider registration validates callbacks", () => {
  const { registry } = setup();
  assert.throws(() => registry.registerProvider({ id: "bad", resolveComprehension: true }), /must be a function/);
});

test("higher-priority provider executes first", () => {
  const { registry } = setup();
  registry.registerProvider({ id: "low", priority: 1 });
  registry.registerProvider({ id: "high", priority: 100 });
  assert.deepEqual(registry.getProviders().map((entry) => entry.id), ["high", "low"]);
});

test("provider grant reveals readable result", async () => {
  const { registry, engine } = setup();
  registry.registerProvider({ id: "grant", resolveComprehension: () => ({ decision: "grant" }) });
  assert.equal((await engine.resolve({ actor: actor("a"), languageId: "elvish" })).readable, true);
});

test("deny overrides grant by default", async () => {
  const { registry, engine } = setup();
  registry.registerProvider({ id: "grant", priority: 100, resolveComprehension: () => ({ decision: "grant" }) });
  registry.registerProvider({ id: "deny", priority: 1, resolveComprehension: () => ({ decision: "deny" }) });
  assert.equal((await engine.resolve({ actor: actor("a"), languageId: "elvish" })).readable, false);
});

test("explicit policy can override a narrow deny", async () => {
  const { registry, engine } = setup();
  registry.registerProvider({ id: "grant", resolveComprehension: () => ({ decision: "grant", reason: "specific" }) });
  registry.registerProvider({ id: "deny", resolveComprehension: () => ({ decision: "deny", reason: "general" }) });
  registry.registerPolicy({
    id: "override",
    allowGrantAfterDeny: true,
    resolveConflict: ({ deny, grant }) => deny.reason === "general" && grant.reason === "specific"
      ? { readable: true, understood: true, recognized: true }
      : null
  });
  assert.equal((await engine.resolve({ actor: actor("a"), languageId: "elvish" })).readable, true);
});

test("provider failure is isolated and fails closed", async () => {
  const { registry, engine, executor } = setup({ canRead: () => true, canUnderstand: () => true });
  registry.registerProvider({ id: "broken", resolveComprehension: () => { throw new Error("broken"); } });
  const result = await engine.resolve({ actor: actor("a"), languageId: "elvish" });
  assert.equal(result.readable, false);
  assert.equal(executor.getDiagnostics()[0].componentId, "broken");
});

test("partial comprehension remains unreadable but recognized", async () => {
  const { registry, engine } = setup();
  registry.registerProvider({ id: "partial", resolveComprehension: () => ({ decision: "partial", fraction: 0.5 }) });
  const result = await engine.resolve({ actor: actor("a"), languageId: "elvish" });
  assert.equal(result.readable, false);
  assert.equal(result.recognized, true);
  assert.equal(result.partial, 0.5);
});

test("providers and policies unregister cleanly", () => {
  const { registry } = setup();
  registry.registerProvider({ id: "provider" });
  registry.registerPolicy({ id: "policy" });
  assert.equal(registry.unregisterProvider("provider"), true);
  assert.equal(registry.unregisterPolicy("policy"), true);
  assert.deepEqual(registry.getDiagnostics(), { providers: [], policies: [] });
});

test("forced unreadable preview overrides adapter and provider grants", async () => {
  const { registry, engine } = setup({ canRead: () => true, canUnderstand: () => true });
  registry.registerProvider({ id: "grant", resolveComprehension: () => ({ decision: "grant" }) });
  const result = await engine.resolve({
    actor: actor("a"),
    languageId: "elvish",
    user: { id: "preview", isGM: false },
    context: { forceUnreadable: true, originalView: false }
  });
  assert.equal(result.readable, false);
  assert.equal(result.recognized, false);
  assert.equal(result.reason, "forced-unreadable");
});

test("forced unreadable preview does not scramble universally readable plain text", async () => {
  const { engine } = setup();
  const result = await engine.resolve({
    languageId: "__plain__",
    context: { forceUnreadable: true, originalView: false }
  });
  assert.equal(result.readable, true);
  assert.equal(result.reason, "plain");
});
