// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Runyth. See the LICENSE file for rights and obligations.
const PROVIDER_ID = "runyth-illuminated-languages-example-provider";

Hooks.once("illuminatedLanguagesApiReady", (api) => {
  api.assertApiVersion("^1.0.0");
  api.registerComprehensionProvider({
    id: PROVIDER_ID,
    version: "1.0.0",
    priority: 10,
    resolveComprehension({ actor, languageId }) {
      const trainedLanguages = actor.getFlag(PROVIDER_ID, "literateLanguages") ?? [];
      return trainedLanguages.includes(languageId)
        ? { decision: "grant", reason: "example-training" }
        : { decision: "abstain" };
    }
  });
});
