// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { IlluminatedLanguagesRuntime } from "../module/runyth-illuminated-languages/scripts/runtime.js";
import { SafeExecutor } from "../module/runyth-illuminated-languages/scripts/utils/safe-executor.js";

function runtimeHarness({ resolve, rerender = async () => 1 } = {}) {
  const logs = [];
  const game = { user: { id: "gm", isGM: true }, modules: new Map(), settings: {} };
  const runtime = new IlluminatedLanguagesRuntime({ gameRef: () => game, hooks: { callAll() {} } });
  runtime.executor = new SafeExecutor({ logger: { error: (...args) => logs.push(args) }, throttleMs: 60_000 });
  runtime.resolver = { resolve };
  runtime.adapter = { invalidate() {} };
  runtime.rerenderOpenViews = rerender;
  return { runtime, logs };
}

test("reading-context resolver failure is isolated without an unhandled rejection", async () => {
  const { runtime, logs } = runtimeHarness({ resolve: () => { throw new Error("resolver failed"); } });
  let unhandled = null;
  const listener = (error) => { unhandled = error; };
  process.once("unhandledRejection", listener);
  try {
    const result = await runtime.onReadingContextChanged("controlled-token");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(result.resolved, false);
    assert.equal(result.source, "controlled-token");
    assert.equal(unhandled, null);
    assert.equal(logs.length, 1);
  } finally {
    process.removeListener("unhandledRejection", listener);
  }
});

test("bursts of reading-context changes are coalesced without stack growth or corrupted state", async () => {
  let rerenders = 0;
  const resolution = Object.freeze({ actorId: "reader", tokenUuid: "Scene.s.Token.t", source: "controlled-token" });
  const { runtime } = runtimeHarness({
    resolve: () => resolution,
    rerender: async () => { rerenders += 1; return 1; }
  });
  const operations = [];
  for (let index = 0; index < 500; index += 1) operations.push(runtime.onReadingContextChanged("controlled-token"));
  const results = await Promise.all(operations);
  assert.equal(results.every((result) => result.resolved && result.actorId === "reader"), true);
  assert.equal(rerenders, 1);
  assert.equal(Object.isFrozen(resolution), true);
});

test("a change arriving during an active rerender is processed once afterward", async () => {
  let rerenders = 0;
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const { runtime } = runtimeHarness({
    resolve: () => Object.freeze({ actorId: "reader", tokenUuid: null }),
    rerender: async () => {
      rerenders += 1;
      if (rerenders === 1) await firstGate;
      return 1;
    }
  });
  const first = runtime.onReadingContextChanged("first");
  await new Promise((resolve) => setImmediate(resolve));
  const second = runtime.onReadingContextChanged("second");
  releaseFirst();
  await Promise.all([first, second]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rerenders, 2);
});
