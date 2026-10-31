// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { HOOKS, SETTINGS } from "../constants.js";
import { deepFreeze } from "../utils/object.js";

const SUPPORTED_SENSES = Object.freeze(["darkvision", "blindsight", "tremorsense", "truesight"]);

export class ReadingActorResolver {
  constructor({ gameRef = () => globalThis.game, canvasRef = () => globalThis.canvas, settings, hooks = globalThis.Hooks } = {}) {
    this.gameRef = gameRef;
    this.canvasRef = canvasRef;
    this.settings = settings;
    this.hooks = hooks;
    this.explicitByUser = new Map();
    this.lastResolved = new Map();
  }

  setExplicitActor(actorId, { userId = this.gameRef()?.user?.id, persist = true } = {}) {
    const user = this.gameRef()?.users?.get?.(userId) ?? this.gameRef()?.user;
    const actor = actorId ? this.gameRef()?.actors?.get?.(actorId) : null;
    if (actor && !this.canUseActor(user, actor)) throw new Error("The selected actor is not available for reading.");
    if (actorId) this.explicitByUser.set(userId, actorId);
    else this.explicitByUser.delete(userId);
    if (persist && userId === this.gameRef()?.user?.id && this.settings?.get?.(SETTINGS.REMEMBER_SELECTION)) {
      this.settings.set?.(SETTINGS.LAST_READ_ACTOR, actorId ?? "");
    }
    return this.resolve(userId, { notify: true });
  }

  resolve(userId = this.gameRef()?.user?.id, { notify = false, allowControlled = true } = {}) {
    const game = this.gameRef();
    const user = game?.users?.get?.(userId) ?? (userId === game?.user?.id ? game.user : null);
    if (!user) return this.#result(userId, null, "no-user", notify);

    if (this.settings?.get?.(SETTINGS.USE_EXPLICIT) !== false) {
      const explicitId = this.explicitByUser.get(userId)
        ?? (userId === game.user?.id && this.settings?.get?.(SETTINGS.REMEMBER_SELECTION) ? this.settings.get(SETTINGS.LAST_READ_ACTOR) : null);
      const explicit = explicitId ? game.actors?.get?.(explicitId) : null;
      if (explicit && this.canUseActor(user, explicit)) return this.#result(userId, explicit, "explicit", notify);
    }

    if (allowControlled && userId === game.user?.id && this.settings?.get?.(SETTINGS.USE_CONTROLLED) !== false) {
      const controlled = (this.canvasRef()?.tokens?.controlled ?? []).filter((token) => token?.actor);
      if (controlled.length === 1 && this.canUseActor(user, controlled[0].actor)) {
        return this.#result(userId, controlled[0].actor, "controlled-token", notify, controlled[0]);
      }
      if (controlled.length > 1) return this.#result(userId, null, "multiple-controlled", notify);
    }

    if (this.settings?.get?.(SETTINGS.USE_ASSIGNED) !== false && user.character && this.canUseActor(user, user.character)) {
      return this.#result(userId, user.character, "assigned-character", notify);
    }

    if (this.settings?.get?.(SETTINGS.USE_OWNED) !== false) {
      const actors = (game.actors?.contents ?? [...(game.actors ?? [])]).filter((actor) => this.isPlayerCharacter(actor) && this.canUseActor(user, actor));
      if (actors.length === 1) return this.#result(userId, actors[0], "single-owned-character", notify);
    }

    return this.#result(userId, null, "none", notify);
  }

  resolveForConnectedUser(userId) {
    return this.resolve(userId, { notify: false, allowControlled: false });
  }

  /**
   * Resolve a live Actor only for immediate use. The Actor is never retained in
   * or frozen with the immutable reading-context snapshot.
   */
  getActor(resolution) {
    if (!resolution?.actorId && !resolution?.actorUuid && !resolution?.tokenUuid) return null;

    if (resolution.tokenUuid) {
      const tokens = [
        ...(this.canvasRef()?.tokens?.controlled ?? []),
        ...(this.canvasRef()?.tokens?.placeables ?? [])
      ];
      const token = tokens.find((entry) => this.#tokenUuid(entry) === resolution.tokenUuid);
      if (token?.actor) return token.actor;
      const tokenDocument = this.#fromUuidSync(resolution.tokenUuid);
      if (tokenDocument?.actor) return tokenDocument.actor;
    }

    const worldActor = resolution.actorId ? this.gameRef()?.actors?.get?.(resolution.actorId) : null;
    if (worldActor) return worldActor;
    const actor = this.#fromUuidSync(resolution.actorUuid);
    return actor?.documentName === "Actor" || actor?.id === resolution.actorId ? actor : null;
  }

  canUseActor(user, actor) {
    if (!user || !actor) return false;
    if (user.isGM) return true;
    if (actor.isOwner && user.id === this.gameRef()?.user?.id) return true;
    const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    if (typeof actor.testUserPermission === "function") return actor.testUserPermission(user, ownerLevel);
    return Number(actor.ownership?.[user.id] ?? actor.permission?.[user.id] ?? 0) >= ownerLevel;
  }

  isPlayerCharacter(actor) {
    return actor?.type === "character" || actor?.hasPlayerOwner === true;
  }

  getSelectableActors(user = this.gameRef()?.user) {
    const actors = (this.gameRef()?.actors?.contents ?? []).filter((actor) => this.canUseActor(user, actor));
    return deepFreeze(actors.map((actor) => ({ id: actor.id, uuid: actor.uuid, name: actor.name })).sort((a, b) => a.name.localeCompare(b.name)));
  }

  #result(userId, actor, source, notify, token = null) {
    const result = deepFreeze({
      actorId: actor?.id ?? null,
      actorUuid: actor?.uuid ?? null,
      actorName: actor?.name ?? null,
      tokenUuid: this.#tokenUuid(token),
      source,
      senseRanges: this.#senseRanges(actor)
    });
    const previous = this.lastResolved.get(userId);
    this.lastResolved.set(userId, result);
    if (notify && (previous?.actorId !== result.actorId || previous?.tokenUuid !== result.tokenUuid)) {
      this.hooks?.callAll?.(HOOKS.READING_ACTOR_CHANGED, deepFreeze({ userId, previous, current: result }));
    }
    return result;
  }

  #senseRanges(actor) {
    const ranges = actor?.system?.attributes?.senses?.ranges;
    const result = {};
    for (const sense of SUPPORTED_SENSES) {
      const raw = ranges?.[sense];
      const value = typeof raw === "number" ? raw : raw?.value;
      result[sense] = Number.isFinite(Number(value)) ? Number(value) : 0;
    }
    return result;
  }

  #tokenUuid(token) {
    return token?.document?.uuid ?? token?.uuid ?? null;
  }

  #fromUuidSync(uuid) {
    if (!uuid || typeof globalThis.fromUuidSync !== "function") return null;
    try {
      return globalThis.fromUuidSync(uuid);
    } catch {
      return null;
    }
  }
}
