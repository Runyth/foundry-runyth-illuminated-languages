// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Daniel Braniewski. See the LICENSE file for rights and obligations.
import { API_VERSION } from "../constants.js";
import { assertSatisfies, satisfies } from "../utils/semver.js";
import { deepFreeze } from "../utils/object.js";

/**
 * Stable public API for companion modules.
 *
 * The API contains immutable results and never exposes mutable registries.
 * Methods which inspect actors require the caller to already have access to the actor.
 */
export class IlluminatedLanguagesApi {
  constructor(runtime) {
    this.runtime = runtime;
    this.version = API_VERSION;
    this.experimental = deepFreeze({
      attemptDecipher: (payload) => runtime.attemptDecipher(payload)
    });
    Object.freeze(this.experimental);
  }

  /** Return all Polyglot languages available from the active provider. */
  getLanguages() {
    return this.runtime.adapter.getLanguages();
  }

  /** Return metadata for one language ID. Unknown IDs remain represented as missing. */
  getLanguage(languageId) {
    return this.runtime.adapter.getLanguageMetadata(languageId);
  }

  /** Resolve the effective document or page language, optionally for a block. */
  getEffectiveLanguage(documentOrPage, blockId = null) {
    return this.runtime.getEffectiveLanguage(documentOrPage, blockId);
  }

  /** Resolve exactly one reading actor according to the documented deterministic order. */
  resolveReadingActor(userId = globalThis.game?.user?.id) {
    return this.runtime.resolver.resolve(userId);
  }

  /** Return a defensive Set of known spoken languages. */
  getKnownLanguages(actor) {
    return this.runtime.adapter.resolveKnownLanguages(actor);
  }

  /** Return a defensive Set of written languages. */
  getLiterateLanguages(actor) {
    return this.runtime.adapter.resolveLiterateLanguages(actor);
  }

  /** Determine spoken or temporary comprehension through Polyglot. */
  canUnderstand(actor, languageId) {
    return this.runtime.adapter.canUnderstand(actor, languageId);
  }

  /** Determine written comprehension through Polyglot and registered providers. */
  async canRead(actor, languageId, options = {}) {
    return (await this.runtime.engine.resolve({ actor, languageId, ...options })).readable;
  }

  /** Render deterministic unreadable text without mutating authoritative documents. */
  renderUnreadableText(text, options = {}) {
    return this.runtime.adapter.scramble(text, options);
  }

  /** Invalidate transient language and render caches for a document. */
  invalidateDocument(documentUuid = null) {
    return this.runtime.invalidateDocument(documentUuid);
  }

  /** Rerender currently open views, optionally scoped to a document UUID. */
  rerenderOpenViews(documentUuid = null) {
    return this.runtime.rerenderOpenViews(documentUuid);
  }

  /** Register an immutable, isolated comprehension provider. */
  registerComprehensionProvider(provider) {
    return this.runtime.registry.registerProvider(provider);
  }

  /** Remove a previously registered comprehension provider. */
  unregisterComprehensionProvider(providerId) {
    return this.runtime.registry.unregisterProvider(providerId);
  }

  /** Register an explicit conflict or script-recognition policy. */
  registerLanguagePolicy(policy) {
    return this.runtime.registry.registerPolicy(policy);
  }

  /** Remove a previously registered language policy. */
  unregisterLanguagePolicy(policyId) {
    return this.runtime.registry.unregisterPolicy(policyId);
  }

  /** Return a plaintext-free diagnostic snapshot. */
  getDiagnostics() {
    return this.runtime.getDiagnostics();
  }

  /** Test semantic compatibility with this API. */
  isApiVersionSupported(range) {
    return satisfies(this.version, range);
  }

  /** Throw when this API does not satisfy a semantic version range. */
  assertApiVersion(range) {
    return assertSatisfies(this.version, range, "Illuminated Languages API");
  }
}
