// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
import { PLAIN_LANGUAGE } from "../constants.js";
import { asSet, deepFreeze } from "../utils/object.js";

const VALID_DECISIONS = new Set(["grant", "deny", "abstain", "partial", "recognize"]);

export class ComprehensionEngine {
  constructor({ adapter, registry, executor, hooks = globalThis.Hooks } = {}) {
    this.adapter = adapter;
    this.registry = registry;
    this.executor = executor;
    this.hooks = hooks;
  }

  async resolve({ actor, languageId, requireLiteracy = true, user = globalThis.game?.user, context = {} } = {}) {
    if (languageId === PLAIN_LANGUAGE) return this.#finish({ readable: true, understood: true, recognized: true, reason: "plain" }, context);
    if (user?.isGM && context.originalView !== false) {
      return this.#finish({ readable: true, understood: true, recognized: true, reason: "gm-original" }, context);
    }
    if (context.forceUnreadable === true) {
      return this.#finish({ readable: false, understood: false, recognized: false, reason: "forced-unreadable", partial: null }, context);
    }
    if (!actor || !languageId) return this.#finish({ readable: false, understood: false, recognized: false, reason: "no-actor" }, context);

    const base = {
      readable: this.adapter.canRead(actor, languageId, { requireLiteracy }),
      understood: this.adapter.canUnderstand(actor, languageId),
      recognized: this.adapter.canUnderstand(actor, languageId),
      reason: "polyglot",
      partial: null
    };
    const decisions = [];
    for (const provider of this.registry.getProviders()) {
      if (!this.registry.isCompatible(provider)) continue;
      if (provider.extractLanguages) {
        const extracted = await this.executor.run(
          "provider.extractLanguages",
          () => provider.extractLanguages({ actor, user, context: { ...context } }),
          { componentId: provider.id, documentUuid: context.documentUuid, languageId },
          null
        );
        if (extracted) {
          const known = asSet(extracted.knownLanguages ?? extracted.known);
          const literate = asSet(extracted.literateLanguages ?? extracted.literate);
          const comprehension = asSet(extracted.comprehensionLanguages ?? extracted.comprehension);
          if (comprehension.has(languageId) || literate.has(languageId)) {
            decisions.push({ providerId: provider.id, decision: "grant", reason: "extracted-language" });
          } else if (known.has(languageId)) {
            decisions.push({ providerId: provider.id, decision: requireLiteracy ? "recognize" : "grant", reason: "extracted-language" });
          }
        }
      }
      if (!provider.resolveComprehension) continue;
      const result = await this.executor.run(
        "provider.resolveComprehension",
        () => provider.resolveComprehension({ actor, languageId, requireLiteracy, user, context: { ...context } }),
        { componentId: provider.id, documentUuid: context.documentUuid, languageId },
        { decision: "deny", reason: "provider-error" }
      );
      if (!result) continue;
      const decision = typeof result === "string" ? result : result.decision;
      if (!VALID_DECISIONS.has(decision)) continue;
      decisions.push({ providerId: provider.id, ...result, decision });
    }

    const deny = decisions.find((entry) => entry.decision === "deny");
    const grant = decisions.find((entry) => entry.decision === "grant");
    const partial = decisions.find((entry) => entry.decision === "partial");
    const recognize = decisions.find((entry) => entry.decision === "recognize");
    let result = { ...base };

    if (deny) {
      result = { readable: false, understood: false, recognized: Boolean(recognize), reason: deny.reason ?? deny.providerId, partial: null };
      for (const policy of this.registry.getPolicies()) {
        if (!policy.allowGrantAfterDeny || !policy.resolveConflict) continue;
        const override = await this.executor.run(
          "policy.resolveConflict",
          () => policy.resolveConflict({ deny, grant, partial, decisions: [...decisions], base: { ...base }, context: { ...context } }),
          { componentId: policy.id, documentUuid: context.documentUuid, languageId },
          null
        );
        if (override?.readable === true) {
          result = { ...result, ...override, reason: override.reason ?? policy.id };
          break;
        }
      }
    } else if (grant) {
      result = { readable: true, understood: true, recognized: true, reason: grant.reason ?? grant.providerId, partial: null };
    } else if (partial) {
      result = {
        readable: false,
        understood: false,
        recognized: true,
        reason: partial.reason ?? partial.providerId,
        partial: partial.value ?? partial.fraction ?? null
      };
    } else if (recognize) {
      result.recognized = true;
      result.reason = recognize.reason ?? recognize.providerId;
    }

    for (const policy of this.registry.getPolicies()) {
      if (!this.registry.isCompatible(policy) || !policy.recognizeLanguage) continue;
      const recognizedByPolicy = await this.executor.run(
        "policy.recognizeLanguage",
        () => policy.recognizeLanguage({ actor, languageId, user, context: { ...context }, result: { ...result } }),
        { componentId: policy.id, documentUuid: context.documentUuid, languageId },
        false
      );
      if (recognizedByPolicy) result.recognized = true;
    }

    return this.#finish({ ...result, decisions }, context);
  }

  async attemptDecipher(payload) {
    const results = [];
    for (const provider of this.registry.getProviders()) {
      if (!provider.attemptDecipher) continue;
      const result = await this.executor.run(
        "provider.attemptDecipher",
        () => provider.attemptDecipher({ ...payload }),
        { componentId: provider.id, documentUuid: payload.documentUuid, languageId: payload.languageId },
        { status: "failure", reason: "provider-error" }
      );
      if (result) results.push(deepFreeze({ providerId: provider.id, ...result }));
    }
    this.hooks?.callAll?.("illuminatedLanguagesAttemptDecipher", deepFreeze({ ...payload, results }));
    return deepFreeze(results);
  }

  #finish(result, context) {
    const frozen = deepFreeze({ ...result });
    this.hooks?.callAll?.("illuminatedLanguagesComprehensionResolved", deepFreeze({ result: frozen, context: { ...context } }));
    return frozen;
  }
}
