// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
export class FakeSettings {
  constructor(values = {}) {
    this.values = new Map(Object.entries({
      spokenAsLiterate: true,
      languageLabelMode: "display",
      useExplicitReadAs: true,
      useControlledToken: true,
      useAssignedCharacter: true,
      useSingleOwnedCharacter: true,
      rememberReadAs: true,
      showLanguageBadge: true,
      usePolyglotFonts: true,
      scriptScale: 1,
      lineHeight: 1.25,
      gmOriginalView: true,
      gmPreviewMode: "",
      previewActor: "",
      previewUser: "",
      ...values
    }));
  }

  get(key) {
    return this.values.get(key);
  }

  async set(key, value) {
    this.values.set(key, value);
    return value;
  }
}

export class FakeHooks {
  constructor() {
    this.calls = [];
  }

  callAll(name, payload) {
    this.calls.push({ name, payload });
  }

  on() {
    return 1;
  }

  off() {}
}

export function actor(id, options = {}) {
  return {
    id,
    uuid: `Actor.${id}`,
    name: options.name ?? id,
    type: options.type ?? "character",
    hasPlayerOwner: options.hasPlayerOwner ?? true,
    isOwner: options.isOwner ?? true,
    ownership: options.ownership ?? {},
    known: new Set(options.known ?? []),
    literate: new Set(options.literate ?? []),
    comprehension: new Set(options.comprehension ?? []),
    testUserPermission(user, level) {
      return user?.isGM || Number(this.ownership[user?.id] ?? (this.isOwner ? level : 0)) >= level;
    }
  };
}

export function user(id, options = {}) {
  return {
    id,
    name: options.name ?? id,
    isGM: options.isGM ?? false,
    character: options.character ?? null
  };
}

export function collection(items = []) {
  const map = new Map(items.map((item) => [item.id, item]));
  map.contents = items;
  return map;
}

export function compatibleGame({ actors = [], users = [], currentUser = null, moduleVersion = "2.8.3", active = true } = {}) {
  const provider = {
    id: "fake-provider",
    languages: {
      common: { label: "Common", font: "Common Serif" },
      elvish: { label: "Elvish", font: "Elven Script" },
      dwarvish: { label: "Dwarvish", font: "Dwarven Runes" }
    },
    getLanguageFont(languageId) {
      return this.languages[languageId]?.font ?? null;
    }
  };
  const runtime = {
    api: { languageProvider: provider },
    getUserLanguages([selected]) {
      return [selected?.known ?? new Set(), selected?.literate ?? new Set(), selected?.comprehension ?? new Set()];
    },
    scrambleString(text, salt, languageId) {
      const shift = (Number(salt) + languageId.length) % 26;
      return String(text).replace(/[A-Za-z]/g, (character) => {
        const base = character <= "Z" ? 65 : 97;
        return String.fromCharCode(base + ((character.charCodeAt(0) - base + shift) % 26));
      });
    }
  };
  const modules = new Map([["polyglot", { id: "polyglot", active, version: moduleVersion }]]);
  const actorCollection = collection(actors);
  const userCollection = collection(users);
  const selectedUser = currentUser ?? users[0] ?? user("user");
  return {
    version: "13.351",
    modules,
    polyglot: runtime,
    actors: actorCollection,
    users: userCollection,
    user: selectedUser,
    i18n: {
      lang: "en",
      has: () => false,
      localize: (key) => key
    }
  };
}
