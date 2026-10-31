// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { SocketRouter } from "../module/runyth-illuminated-languages/scripts/sockets/router.js";
import { SafeExecutor } from "../module/runyth-illuminated-languages/scripts/utils/safe-executor.js";

function collection(items) {
  const map = new Map(items.map((item) => [item.id, item]));
  map.contents = items;
  return map;
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("socket handler registers once, unregisters once, and rejects replayed requests", async () => {
  const callbacks = new Map();
  let onCalls = 0;
  let offCalls = 0;
  const socket = {
    on(channel, callback) { onCalls += 1; callbacks.set(channel, callback); },
    off(channel, callback) {
      offCalls += 1;
      if (callbacks.get(channel) === callback) callbacks.delete(channel);
    }
  };
  const player = { id: "player", name: "Player", active: true, isGM: false };
  const actor = { id: "actor", ownership: { player: 3 } };
  const game = {
    user: { id: "gm", isGM: true },
    users: collection([player]),
    actors: collection([actor]),
    socket
  };
  let attempts = 0;
  const router = new SocketRouter({
    gameRef: () => game,
    resolver: { canUseActor: () => true },
    engine: { async attemptDecipher() { attempts += 1; return []; } },
    executor: new SafeExecutor({ logger: { error() {} } })
  });
  const previousFromUuidSync = globalThis.fromUuidSync;
  const previousConst = globalThis.CONST;
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { LIMITED: 1 } };
  globalThis.fromUuidSync = () => ({ testUserPermission: () => true });
  try {
    assert.equal(router.register(), true);
    assert.equal(router.register(), false);
    assert.equal(onCalls, 1);
    const receive = callbacks.get("module.runyth-illuminated-languages");
    const request = {
      action: "attemptDecipher",
      payload: {
        requestId: "request-1",
        requestedAt: Date.now(),
        userId: "player",
        actorId: "actor",
        documentUuid: "JournalEntry.document",
        pageUuid: null,
        blockId: null,
        languageId: "elvish",
        sourceHash: "hash"
      }
    };
    receive(request);
    receive(request);
    await flush();
    assert.equal(attempts, 1);
    assert.equal(router.unregister(), true);
    assert.equal(router.unregister(), false);
    assert.equal(offCalls, 1);
  } finally {
    globalThis.fromUuidSync = previousFromUuidSync;
    globalThis.CONST = previousConst;
  }
});

test("malformed, expired, and unauthorized socket requests fail closed", async () => {
  let callback;
  const game = {
    user: { id: "gm", isGM: true },
    users: collection([{ id: "player", active: true, isGM: false }]),
    actors: collection([]),
    socket: { on(_channel, value) { callback = value; }, off() {} }
  };
  let attempts = 0;
  const router = new SocketRouter({
    gameRef: () => game,
    resolver: { canUseActor: () => false },
    engine: { async attemptDecipher() { attempts += 1; } },
    executor: new SafeExecutor({ logger: { error() {} }, throttleMs: 60_000 })
  });
  const previousFromUuidSync = globalThis.fromUuidSync;
  globalThis.fromUuidSync = () => ({ testUserPermission: () => false });
  try {
    router.register();
    callback({ action: "attemptDecipher", payload: null });
    callback({
      action: "attemptDecipher",
      payload: {
        requestId: "expired",
        requestedAt: Date.now() - 120_000,
        userId: "player",
        documentUuid: "JournalEntry.document",
        languageId: "elvish",
        sourceHash: "hash"
      }
    });
    callback({
      action: "attemptDecipher",
      payload: {
        requestId: "unauthorized",
        requestedAt: Date.now(),
        userId: "player",
        documentUuid: "JournalEntry.document",
        languageId: "elvish",
        sourceHash: "hash"
      }
    });
    await flush();
    assert.equal(attempts, 0);
  } finally {
    globalThis.fromUuidSync = previousFromUuidSync;
  }
});

test("socket provider failures are isolated without an unhandled rejection", async () => {
  let callback;
  const player = { id: "player", active: true, isGM: false };
  const game = {
    user: { id: "gm", isGM: true },
    users: collection([player]),
    actors: collection([]),
    socket: { on(_channel, value) { callback = value; }, off() {} }
  };
  const logs = [];
  const router = new SocketRouter({
    gameRef: () => game,
    resolver: { canUseActor: () => true },
    engine: { async attemptDecipher() { throw new Error("provider failed"); } },
    executor: new SafeExecutor({ logger: { error: (...args) => logs.push(args) } })
  });
  const previousFromUuidSync = globalThis.fromUuidSync;
  globalThis.fromUuidSync = () => ({ testUserPermission: () => true });
  let unhandled = null;
  const listener = (error) => { unhandled = error; };
  process.once("unhandledRejection", listener);
  try {
    router.register();
    callback({
      action: "attemptDecipher",
      payload: {
        requestId: "provider-failure",
        requestedAt: Date.now(),
        userId: "player",
        documentUuid: "JournalEntry.document",
        languageId: "elvish",
        sourceHash: "hash"
      }
    });
    await flush();
    assert.equal(unhandled, null);
    assert.equal(logs.length, 1);
  } finally {
    process.removeListener("unhandledRejection", listener);
    globalThis.fromUuidSync = previousFromUuidSync;
  }
});
