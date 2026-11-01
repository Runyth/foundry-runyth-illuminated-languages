// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { SETTINGS } from "../constants.js";

const VALID_MODES = new Set(["original", "actor", "player", "unreadable"]);

export class GmPreviewController {
  constructor({ gameRef = () => globalThis.game, settings, resolver } = {}) {
    this.gameRef = gameRef;
    this.settings = settings;
    this.resolver = resolver;
  }

  getState() {
    const game = this.gameRef();
    const user = game?.user;
    if (!user?.isGM) return Object.freeze({ mode: "reader", active: false, value: "automatic" });

    const configured = this.settings.get(SETTINGS.GM_PREVIEW_MODE);
    const inferred = this.settings.get(SETTINGS.GM_ORIGINAL_VIEW) === false ? "actor" : "original";
    const mode = VALID_MODES.has(configured) ? configured : inferred;
    const actorId = mode === "actor"
      ? this.settings.get(SETTINGS.PREVIEW_ACTOR) || this.resolver.resolve().actorId
      : null;
    const userId = mode === "player" ? this.settings.get(SETTINGS.PREVIEW_USER) || null : null;
    const candidateUser = userId ? game?.users?.get?.(userId) : null;
    const targetUser = candidateUser?.active === false ? null : candidateUser;
    const storedActor = actorId ? game?.actors?.get?.(actorId) : null;
    const resolution = mode === "player" && targetUser
      ? this.resolver.resolveForConnectedUser(targetUser.id)
      : mode === "actor"
        ? {
            actorId: storedActor?.id ?? null,
            actorName: storedActor?.name ?? null,
            source: storedActor ? "preview-actor" : "missing-preview-actor"
          }
        : { actorId: null, actorName: null, source: mode };

    return Object.freeze({
      mode,
      active: mode !== "original",
      value: mode === "actor"
        ? `actor:${actorId ?? ""}`
        : mode === "player"
          ? `player:${userId ?? ""}`
          : mode,
      actorId: resolution.actorId ?? null,
      actorName: resolution.actorName ?? null,
      userId: targetUser?.id ?? null,
      userName: targetUser?.name ?? null,
      source: resolution.source ?? mode
    });
  }

  async applySelection(value) {
    if (!this.gameRef()?.user?.isGM) {
      const actorId = String(value ?? "").startsWith("actor:") ? String(value).slice(6) : String(value ?? "");
      this.resolver.setExplicitActor(actorId || null);
      return this.getState();
    }

    const selection = String(value ?? "original");
    if (selection === "original" || selection === "") return this.setOriginal();
    if (selection === "unreadable") return this.setUnreadable();
    if (selection.startsWith("player:")) return this.setPlayer(selection.slice(7));
    if (selection.startsWith("actor:")) return this.setActor(selection.slice(6));
    return this.setActor(selection);
  }

  async setOriginal() {
    this.resolver.setExplicitActor(null);
    await Promise.all([
      this.settings.set(SETTINGS.GM_PREVIEW_MODE, "original"),
      this.settings.set(SETTINGS.GM_ORIGINAL_VIEW, true),
      this.settings.set(SETTINGS.PREVIEW_USER, "")
    ]);
    return this.getState();
  }

  async setActor(actorId) {
    const actor = this.gameRef()?.actors?.get?.(actorId);
    if (!actor) throw new Error("The selected actor is not available for preview.");
    this.resolver.setExplicitActor(actorId);
    await Promise.all([
      this.settings.set(SETTINGS.GM_PREVIEW_MODE, "actor"),
      this.settings.set(SETTINGS.GM_ORIGINAL_VIEW, false),
      this.settings.set(SETTINGS.PREVIEW_ACTOR, actorId),
      this.settings.set(SETTINGS.PREVIEW_USER, "")
    ]);
    return this.getState();
  }

  async setPlayer(userId) {
    const game = this.gameRef();
    if (!game?.user?.isGM) throw new Error("GM permission is required.");
    const user = game.users?.get?.(userId);
    if (!user || user.isGM || user.active === false) throw new Error("The selected connected player is not available for preview.");
    await Promise.all([
      this.settings.set(SETTINGS.GM_PREVIEW_MODE, "player"),
      this.settings.set(SETTINGS.GM_ORIGINAL_VIEW, false),
      this.settings.set(SETTINGS.PREVIEW_USER, user.id)
    ]);
    return this.getState();
  }

  async setUnreadable() {
    if (!this.gameRef()?.user?.isGM) throw new Error("GM permission is required.");
    await Promise.all([
      this.settings.set(SETTINGS.GM_PREVIEW_MODE, "unreadable"),
      this.settings.set(SETTINGS.GM_ORIGINAL_VIEW, false),
      this.settings.set(SETTINGS.PREVIEW_USER, "")
    ]);
    return this.getState();
  }

  resolveViewerContext(fallback = {}) {
    const game = this.gameRef();
    const currentUser = game?.user;
    if (!currentUser?.isGM) {
      const resolution = fallback.actor
        ? null
        : this.resolver.resolve(fallback.user?.id ?? currentUser?.id, { notify: false });
      return Object.freeze({
        active: false,
        mode: "reader",
        actor: fallback.actor ?? this.resolver.getActor(resolution),
        user: fallback.user ?? currentUser,
        originalView: false,
        forceUnreadable: false,
        source: resolution?.source ?? "provided"
      });
    }

    const state = this.getState();
    if (state.mode === "original") {
      return Object.freeze({
        active: false,
        mode: "original",
        actor: fallback.actor ?? null,
        user: fallback.user ?? currentUser,
        originalView: fallback.originalView ?? true,
        forceUnreadable: false,
        source: "gm-original"
      });
    }
    if (state.mode === "player") {
      const targetUser = state.userId ? game?.users?.get?.(state.userId) : null;
      const resolution = targetUser ? this.resolver.resolveForConnectedUser(targetUser.id) : null;
      return Object.freeze({
        active: true,
        mode: "player",
        actor: this.resolver.getActor(resolution),
        user: targetUser ?? { id: "missing-player", name: "", isGM: false },
        originalView: false,
        forceUnreadable: false,
        source: resolution?.source ?? "missing-player"
      });
    }
    if (state.mode === "unreadable") {
      return Object.freeze({
        active: true,
        mode: "unreadable",
        actor: null,
        user: { id: "runyth-illuminated-languages-unreadable-preview", name: "", isGM: false },
        originalView: false,
        forceUnreadable: true,
        source: "forced-unreadable"
      });
    }
    return Object.freeze({
      active: true,
      mode: "actor",
      actor: state.actorId ? game?.actors?.get?.(state.actorId) ?? null : null,
      user: currentUser,
      originalView: false,
      forceUnreadable: false,
      source: state.source ?? "actor"
    });
  }

  getOptions() {
    const game = this.gameRef();
    const currentUser = game?.user;
    const actorOptions = this.resolver.getSelectableActors(currentUser).map((actor) => ({
      value: `actor:${actor.id}`,
      label: actor.name,
      group: "actors"
    }));
    if (!currentUser?.isGM) {
      return Object.freeze([
        { value: "", label: "automatic", group: "general" },
        ...actorOptions
      ]);
    }
    const playerOptions = (game?.users?.contents ?? [])
      .filter((user) => !user.isGM && user.active !== false)
      .map((user) => {
        const resolution = this.resolver.resolveForConnectedUser(user.id);
        return {
          value: `player:${user.id}`,
          label: user.name,
          actorName: resolution.actorName ?? null,
          group: "players"
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    return Object.freeze([
      { value: "original", label: "original", group: "general" },
      ...actorOptions,
      ...playerOptions,
      { value: "unreadable", label: "unreadable", group: "special" }
    ]);
  }
}
