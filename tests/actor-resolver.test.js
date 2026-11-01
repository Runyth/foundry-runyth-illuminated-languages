// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import test from "node:test";
import assert from "node:assert/strict";
import { ReadingActorResolver } from "../module/runyth-illuminated-languages/scripts/comprehension/actor-resolver.js";
import { FakeHooks, FakeSettings, actor, collection, user } from "./helpers/fakes.js";

function setup({ actors = [], controlled = [], assigned = null, isGM = false, settings = {} } = {}) {
  const currentUser = user("u1", { character: assigned, isGM });
  actors.forEach((entry) => {
    entry.ownership[currentUser.id] = entry.isOwner ? 3 : 0;
  });
  const game = {
    user: currentUser,
    users: collection([currentUser]),
    actors: collection(actors)
  };
  const hooks = new FakeHooks();
  const resolver = new ReadingActorResolver({
    gameRef: () => game,
    canvasRef: () => ({ tokens: { controlled: controlled.map((entry) => ({ actor: entry })) } }),
    settings: new FakeSettings(settings),
    hooks
  });
  return { resolver, hooks, user: currentUser };
}

test("explicit selection has highest priority", () => {
  const explicit = actor("explicit");
  const controlled = actor("controlled");
  const { resolver } = setup({ actors: [explicit, controlled], controlled: [controlled] });
  resolver.setExplicitActor(explicit.id, { persist: false });
  assert.equal(resolver.resolve().actorId, explicit.id);
  assert.equal(resolver.resolve().source, "explicit");
});

test("exactly one controlled token is used", () => {
  const selected = actor("selected");
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  assert.equal(resolver.resolve().source, "controlled-token");
});

test("multiple controlled tokens resolve no actor", () => {
  const one = actor("one");
  const two = actor("two");
  const { resolver } = setup({ actors: [one, two], controlled: [one, two] });
  assert.equal(resolver.resolve().actorId, null);
  assert.equal(Object.hasOwn(resolver.resolve(), "actor"), false);
  assert.equal(resolver.resolve().source, "multiple-controlled");
});

test("assigned character is used after controlled tokens", () => {
  const assigned = actor("assigned");
  const { resolver } = setup({ actors: [assigned], assigned });
  assert.equal(resolver.resolve().source, "assigned-character");
});

test("exactly one owned character is final fallback", () => {
  const owned = actor("owned");
  const { resolver } = setup({ actors: [owned] });
  assert.equal(resolver.resolve().source, "single-owned-character");
});

test("several owned characters are not merged", () => {
  const one = actor("one");
  const two = actor("two");
  const { resolver } = setup({ actors: [one, two] });
  assert.equal(resolver.resolve().source, "none");
});

test("unauthorized explicit actor is rejected", () => {
  const denied = actor("denied", { isOwner: false, ownership: { u1: 0 } });
  const { resolver } = setup({ actors: [denied] });
  assert.throws(() => resolver.setExplicitActor(denied.id, { persist: false }), /not available/);
});

test("GM may preview any actor", () => {
  const denied = actor("npc", { isOwner: false, hasPlayerOwner: false });
  const { resolver } = setup({ actors: [denied], isGM: true });
  resolver.setExplicitActor(denied.id, { persist: false });
  assert.equal(resolver.resolve().actorId, denied.id);
});

test("explicit selection is persisted client-side", async () => {
  const selected = actor("selected");
  const { resolver } = setup({ actors: [selected] });
  resolver.setExplicitActor(selected.id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(resolver.settings.get("lastReadActor"), selected.id);
});

test("reading actor change hook fires once for actual change", () => {
  const selected = actor("selected");
  const { resolver, hooks } = setup({ actors: [selected] });
  resolver.setExplicitActor(selected.id, { persist: false });
  assert.equal(hooks.calls.filter((entry) => entry.name === "illuminatedLanguagesReadingActorChanged").length, 1);
});

function dndActor(id, {
  senses = undefined,
  items = [],
  ActorClass = class {},
  ItemClass = class {},
  circular = false
} = {}) {
  const value = new ActorClass();
  Object.assign(value, actor(id), {
    documentName: "Actor",
    system: { attributes: { senses: senses ?? {} } },
    items: collection(items.map((name, index) => {
      const item = new ItemClass();
      Object.assign(item, { id: `${id}-item-${index}`, uuid: `Actor.${id}.Item.${index}`, name, documentName: "Item" });
      return item;
    }))
  });
  for (const item of value.items.contents) item.parent = value;
  if (circular) value.circular = value;
  return value;
}

function guardedSenses(ranges = {}) {
  const senses = { ranges };
  for (const key of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
    Object.defineProperty(senses, key, {
      enumerable: true,
      get() {
        throw new Error(`Deprecated sense property read: ${key}`);
      }
    });
  }
  return senses;
}

test("normal D&D 5e Actor resolves to a plain immutable snapshot", () => {
  const selected = dndActor("normal");
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  const result = resolver.resolve();
  assert.equal(result.actorId, selected.id);
  assert.equal(result.actorName, selected.name);
  assert.equal(Object.hasOwn(result, "actor"), false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
});

test("Actor with no senses resolves with zeroed current-range snapshot", () => {
  const selected = dndActor("no-senses");
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  assert.deepEqual(resolver.resolve().senseRanges, {
    darkvision: 0,
    blindsight: 0,
    tremorsense: 0,
    truesight: 0
  });
});

test("all four D&D 5e 5.3 sense ranges use only senses.ranges", () => {
  const selected = dndActor("all-senses", {
    senses: guardedSenses({ darkvision: 120, blindsight: 10, tremorsense: 30, truesight: 60 })
  });
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  assert.deepEqual(resolver.resolve().senseRanges, {
    darkvision: 120,
    blindsight: 10,
    tremorsense: 30,
    truesight: 60
  });
});

test("synthetic token Actor is recovered transiently by TokenDocument UUID", () => {
  const synthetic = dndActor("synthetic");
  synthetic.uuid = "Scene.scene.Token.token.Actor.synthetic";
  const token = { actor: synthetic, document: { uuid: "Scene.scene.Token.token" } };
  const currentUser = user("u1");
  synthetic.ownership[currentUser.id] = 3;
  const game = { user: currentUser, users: collection([currentUser]), actors: collection([]) };
  const resolver = new ReadingActorResolver({
    gameRef: () => game,
    canvasRef: () => ({ tokens: { controlled: [token], placeables: [token] } }),
    settings: new FakeSettings(),
    hooks: new FakeHooks()
  });
  const result = resolver.resolve();
  assert.equal(result.tokenUuid, token.document.uuid);
  assert.equal(resolver.getActor(result), synthetic);
  assert.equal(Object.hasOwn(result, "actor"), false);
});

test("embedded Items are neither traversed nor frozen", () => {
  const selected = dndActor("embedded", { items: ["Sword", "Book"] });
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  resolver.resolve();
  selected.name = "Renamed Actor";
  selected.items.contents[0].name = "Renamed Sword";
  assert.equal(selected.name, "Renamed Actor");
  assert.equal(selected.items.contents[0].name, "Renamed Sword");
  assert.equal(Object.isFrozen(selected), false);
  assert.equal(Object.isFrozen(selected.items.contents[0]), false);
});

test("circular Actor-like graphs do not recurse", () => {
  const selected = dndActor("circular", { items: ["Loop"], circular: true });
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  assert.doesNotThrow(() => resolver.resolve());
});

test("Midi-QOL-like Actor and Item subclasses remain mutable", () => {
  class MidiActor {}
  class MidiItem {}
  const selected = dndActor("midi", { items: ["Midi Item"], ActorClass: MidiActor, ItemClass: MidiItem });
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  const result = resolver.resolve();
  selected.name = "Mutable MidiActor";
  selected.items.contents[0].name = "Mutable MidiItem";
  assert.equal(selected.name, "Mutable MidiActor");
  assert.equal(selected.items.contents[0].name, "Mutable MidiItem");
  assert.equal(result.actorId, selected.id);
  assert.equal(Object.hasOwn(result, "items"), false);
});

test("resolver output contains no live external document references", () => {
  const selected = dndActor("safe-output", { items: ["Item"] });
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  const result = resolver.resolve();
  const visited = new Set();
  const inspect = (value) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    assert.notEqual(value, selected);
    assert.notEqual(value, selected.items);
    for (const item of selected.items.contents) assert.notEqual(value, item);
    assert.equal(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, true);
    for (const child of Object.values(value)) inspect(child);
  };
  inspect(result);
});

test("repeated controlled-token resolution remains bounded and source documents stay mutable", () => {
  const selected = dndActor("repeated", { items: ["Item"], circular: true });
  const { resolver } = setup({ actors: [selected], controlled: [selected] });
  for (let index = 0; index < 2_000; index += 1) {
    const result = resolver.resolve(undefined, { notify: true });
    assert.equal(result.actorId, selected.id);
  }
  selected.name = "Still mutable";
  selected.items.contents[0].name = "Still mutable too";
  assert.equal(selected.name, "Still mutable");
  assert.equal(selected.items.contents[0].name, "Still mutable too");
});
