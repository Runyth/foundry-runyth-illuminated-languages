// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { SOCKET_CHANNEL } from "../constants.js";

const REQUEST_TTL_MS = 60_000;
const MAX_SEEN_REQUESTS = 500;

export class SocketRouter {
  constructor({ gameRef = () => globalThis.game, resolver, engine, executor } = {}) {
    this.gameRef = gameRef;
    this.resolver = resolver;
    this.engine = engine;
    this.executor = executor;
    this.bound = (request) => {
      const operation = () => this.#receive(request);
      if (this.executor?.run) {
        void this.executor.run("socket.receive", operation, { componentId: "socket" }, null);
      } else {
        void Promise.resolve().then(operation).catch(() => null);
      }
    };
    this.registered = false;
    this.seenRequests = new Map();
  }

  register() {
    if (this.registered) return false;
    const socket = this.gameRef()?.socket;
    if (!socket?.on) return false;
    socket.on(SOCKET_CHANNEL, this.bound);
    this.registered = true;
    return true;
  }

  unregister() {
    if (!this.registered) return false;
    this.gameRef()?.socket?.off?.(SOCKET_CHANNEL, this.bound);
    this.registered = false;
    this.seenRequests.clear();
    return true;
  }

  async requestDecipher(payload) {
    const user = this.gameRef()?.user;
    const actor = payload?.actorId ? this.gameRef()?.actors?.get?.(payload.actorId) : null;
    if (actor && !this.resolver.canUseActor(user, actor)) throw new Error("Unauthorized actor selection.");
    const safe = this.#validatePayload({
      ...payload,
      userId: user?.id,
      requestId: payload?.requestId ?? this.#requestId(),
      requestedAt: Date.now()
    });
    this.#assertDocumentPermission(user, safe);
    if (user?.isGM) return this.engine.attemptDecipher({ ...safe, user, actor });
    this.gameRef()?.socket?.emit?.(SOCKET_CHANNEL, { action: "attemptDecipher", payload: safe });
    return { queued: true, requestId: safe.requestId };
  }

  async #receive(request) {
    if (!this.gameRef()?.user?.isGM || request?.action !== "attemptDecipher") return;
    const payload = this.executor.runSync(
      "socket.validate",
      () => this.#validatePayload(request.payload),
      { componentId: "socket" },
      null
    );
    if (!payload || this.#isReplay(payload)) return;
    const user = this.gameRef()?.users?.get?.(payload.userId);
    const actor = payload.actorId ? this.gameRef()?.actors?.get?.(payload.actorId) : null;
    if (!user?.active || user.isGM || (actor && !this.resolver.canUseActor(user, actor))) return;
    const permitted = this.executor.runSync(
      "socket.permission",
      () => this.#assertDocumentPermission(user, payload),
      { componentId: "socket", documentUuid: payload.documentUuid ?? payload.pageUuid },
      false
    );
    if (permitted === false) return;
    await this.engine.attemptDecipher({ ...payload, user, actor });
  }

  #validatePayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Malformed socket payload.");
    const stringFields = ["requestId", "userId", "actorId", "documentUuid", "pageUuid", "blockId", "languageId", "sourceHash"];
    const output = {};
    for (const field of stringFields) {
      const value = payload[field];
      if (value === undefined || value === null || value === "") {
        output[field] = null;
        continue;
      }
      if (typeof value !== "string" || value.length > 512) throw new Error(`Invalid ${field}.`);
      output[field] = value;
    }
    const requestedAt = Number(payload.requestedAt);
    if (!Number.isFinite(requestedAt) || Math.abs(Date.now() - requestedAt) > REQUEST_TTL_MS) throw new Error("Expired decipher request.");
    if (!output.requestId || !output.userId || !output.languageId || !output.sourceHash) throw new Error("Missing required decipher fields.");
    if (!output.documentUuid && !output.pageUuid) throw new Error("A document or page UUID is required.");
    return Object.freeze({ ...output, requestedAt });
  }

  #assertDocumentPermission(user, payload) {
    const uuid = payload.pageUuid ?? payload.documentUuid;
    const document = this.#fromUuidSync(uuid);
    if (!document) throw new Error("Referenced document is unavailable.");
    if (user?.isGM) return true;
    const limited = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.LIMITED ?? 1;
    const permitted = typeof document.testUserPermission === "function"
      ? document.testUserPermission(user, limited)
      : Number(document.ownership?.[user?.id] ?? document.permission?.[user?.id] ?? 0) >= limited;
    if (!permitted) throw new Error("The requesting user cannot access the referenced document.");
    return true;
  }

  #isReplay(payload) {
    const now = Date.now();
    for (const [id, timestamp] of this.seenRequests) {
      if (timestamp + REQUEST_TTL_MS < now) this.seenRequests.delete(id);
    }
    if (this.seenRequests.has(payload.requestId)) return true;
    this.seenRequests.set(payload.requestId, now);
    while (this.seenRequests.size > MAX_SEEN_REQUESTS) this.seenRequests.delete(this.seenRequests.keys().next().value);
    return false;
  }

  #fromUuidSync(uuid) {
    if (!uuid || typeof globalThis.fromUuidSync !== "function") return null;
    try {
      return globalThis.fromUuidSync(uuid);
    } catch {
      return null;
    }
  }

  #requestId() {
    return globalThis.foundry?.utils?.randomID?.()
      ?? globalThis.crypto?.randomUUID?.()
      ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
