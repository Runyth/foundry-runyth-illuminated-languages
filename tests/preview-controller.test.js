// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { GmPreviewController } from "../module/runyth-illuminated-languages/scripts/comprehension/preview-controller.js";
import { ReadingActorResolver } from "../module/runyth-illuminated-languages/scripts/comprehension/actor-resolver.js";
import { FakeHooks, FakeSettings, actor, collection, user } from "./helpers/fakes.js";

function setup() {
  const gm = user("gm", { isGM: true, name: "Game Master" });
  const reader = actor("reader", { name: "Lady Aelinesse", ownership: { player: 3 } });
  const other = actor("other", { name: "Motte", ownership: { otherPlayer: 3 } });
  const player = user("player", { name: "Player One", character: reader });
  player.active = true;
  const offline = user("offline", { name: "Offline Player", character: other });
  offline.active = false;
  const game = {
    user: gm,
    users: collection([gm, player, offline]),
    actors: collection([reader, other])
  };
  const settings = new FakeSettings({ gmPreviewMode: "", previewActor: "", previewUser: "" });
  const resolver = new ReadingActorResolver({
    gameRef: () => game,
    canvasRef: () => ({ tokens: { controlled: [] } }),
    settings,
    hooks: new FakeHooks()
  });
  const preview = new GmPreviewController({ gameRef: () => game, settings, resolver });
  return { game, settings, resolver, preview, gm, player, reader, other, offline };
}

test("GM preview defaults to original view", () => {
  const { preview } = setup();
  assert.equal(preview.getState().mode, "original");
  assert.equal(preview.resolveViewerContext().originalView, true);
});

test("GM can preview the exact resolved reading actor of a connected player", async () => {
  const { preview, player, reader } = setup();
  await preview.setPlayer(player.id);
  const context = preview.resolveViewerContext();
  assert.equal(context.mode, "player");
  assert.equal(context.user.id, player.id);
  assert.equal(context.actor.id, reader.id);
  assert.equal(context.originalView, false);
  assert.equal(context.forceUnreadable, false);
});

test("GM no-language preview forces protected writing unreadable", async () => {
  const { preview } = setup();
  await preview.setUnreadable();
  const context = preview.resolveViewerContext();
  assert.equal(context.mode, "unreadable");
  assert.equal(context.actor, null);
  assert.equal(context.user.isGM, false);
  assert.equal(context.originalView, false);
  assert.equal(context.forceUnreadable, true);
});

test("existing actor preview remains available", async () => {
  const { preview, other } = setup();
  await preview.setActor(other.id);
  const context = preview.resolveViewerContext();
  assert.equal(context.mode, "actor");
  assert.equal(context.actor.id, other.id);
  assert.equal(context.originalView, false);
});

test("player preview options include connected players but not offline users", () => {
  const { preview, player, offline } = setup();
  const values = preview.getOptions().map((entry) => entry.value);
  assert.equal(values.includes(`player:${player.id}`), true);
  assert.equal(values.includes(`player:${offline.id}`), false);
  assert.equal(values.includes("unreadable"), true);
});

test("unavailable player preview is rejected", async () => {
  const { preview, offline } = setup();
  await assert.rejects(() => preview.setPlayer(offline.id), /not available/);
});

test("stored GM preview actor remains authoritative after resolver state is cleared", async () => {
  const { preview, resolver, other } = setup();
  await preview.setActor(other.id);
  resolver.setExplicitActor(null, { persist: false });
  assert.equal(preview.resolveViewerContext().actor.id, other.id);
});

test("player clients never receive GM-only player or no-language preview choices", () => {
  const { game, preview, player } = setup();
  game.user = player;
  const values = preview.getOptions().map((entry) => entry.value);
  assert.equal(values.some((value) => value.startsWith("player:")), false);
  assert.equal(values.includes("unreadable"), false);
});
