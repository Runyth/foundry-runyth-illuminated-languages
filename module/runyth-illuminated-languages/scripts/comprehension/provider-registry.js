// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { deepFreeze, sanitizeIdentifier } from "../utils/object.js";
import { satisfies } from "../utils/semver.js";

function validateCallback(value, name) {
  if (value !== undefined && typeof value !== "function") throw new TypeError(`${name} must be a function.`);
}

export class ProviderRegistry {
  constructor({ executor, hooks = globalThis.Hooks } = {}) {
    this.executor = executor;
    this.hooks = hooks;
    this.providers = new Map();
    this.policies = new Map();
  }

  registerProvider(input) {
    const id = sanitizeIdentifier(input?.id);
    if (this.providers.has(id)) throw new Error(`Comprehension provider ${id} is already registered.`);
    validateCallback(input.extractLanguages, "extractLanguages");
    validateCallback(input.resolveComprehension, "resolveComprehension");
    validateCallback(input.attemptDecipher, "attemptDecipher");
    const provider = deepFreeze({
      id,
      version: String(input.version ?? "0.0.0"),
      priority: Number.isFinite(input.priority) ? input.priority : 0,
      compatibility: input.compatibility ? deepFreeze({ ...input.compatibility }) : null,
      extractLanguages: input.extractLanguages,
      resolveComprehension: input.resolveComprehension,
      attemptDecipher: input.attemptDecipher
    });
    this.providers.set(id, provider);
    this.hooks?.callAll?.("illuminatedLanguagesProviderRegistered", deepFreeze({ id, type: "provider" }));
    return provider;
  }

  unregisterProvider(id) {
    const removed = this.providers.delete(id);
    if (removed) this.hooks?.callAll?.("illuminatedLanguagesProviderUnregistered", deepFreeze({ id, type: "provider" }));
    return removed;
  }

  registerPolicy(input) {
    const id = sanitizeIdentifier(input?.id);
    if (this.policies.has(id)) throw new Error(`Language policy ${id} is already registered.`);
    validateCallback(input.resolveConflict, "resolveConflict");
    validateCallback(input.recognizeLanguage, "recognizeLanguage");
    const policy = deepFreeze({
      id,
      version: String(input.version ?? "0.0.0"),
      priority: Number.isFinite(input.priority) ? input.priority : 0,
      allowGrantAfterDeny: input.allowGrantAfterDeny === true,
      resolveConflict: input.resolveConflict,
      recognizeLanguage: input.recognizeLanguage
    });
    this.policies.set(id, policy);
    this.hooks?.callAll?.("illuminatedLanguagesProviderRegistered", deepFreeze({ id, type: "policy" }));
    return policy;
  }

  unregisterPolicy(id) {
    const removed = this.policies.delete(id);
    if (removed) this.hooks?.callAll?.("illuminatedLanguagesProviderUnregistered", deepFreeze({ id, type: "policy" }));
    return removed;
  }

  getProviders() {
    return deepFreeze([...this.providers.values()].sort(sortByPriority));
  }

  getPolicies() {
    return deepFreeze([...this.policies.values()].sort(sortByPriority));
  }


  isCompatible(component, game = globalThis.game) {
    const compatibility = component?.compatibility;
    if (!compatibility) return true;
    if (Array.isArray(compatibility.systemIds) && !compatibility.systemIds.includes(game?.system?.id)) return false;
    if (compatibility.foundry && !satisfies(game?.version ?? game?.release?.version, compatibility.foundry)) return false;
    if (compatibility.modules && typeof compatibility.modules === "object") {
      for (const [moduleId, range] of Object.entries(compatibility.modules)) {
        const module = game?.modules?.get?.(moduleId);
        if (!module?.active || !satisfies(module.version, range)) return false;
      }
    }
    return true;
  }

  getDiagnostics() {
    return deepFreeze({
      providers: this.getProviders().map(({ id, version, priority, compatibility }) => ({ id, version, priority, compatibility })),
      policies: this.getPolicies().map(({ id, version, priority, allowGrantAfterDeny }) => ({ id, version, priority, allowGrantAfterDeny }))
    });
  }
}

function sortByPriority(left, right) {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}
