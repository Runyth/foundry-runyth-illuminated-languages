# Complementary-module developer guide

Wait for `illuminatedLanguagesApiReady` or detect `game.illuminatedLanguages.api` after `ready`. Assert the API range before registration.

```javascript
const api = game.illuminatedLanguages.api;
api.assertApiVersion("^1.0.0");

api.registerComprehensionProvider({
  id: "example-literacy",
  version: "1.0.0",
  priority: 50,
  resolveComprehension({ actor, languageId }) {
    return actor.getFlag("example-literacy", languageId)
      ? { decision: "grant", reason: "trained-literacy" }
      : { decision: "abstain" };
  }
});
```

Provider callbacks receive copied context and must not mutate authoritative documents. Return `grant`, `deny`, `abstain`, `recognize`, or `partial`. Errors are isolated and fail closed.

Do not put plaintext in provider diagnostics, flags, chat, tooltips, or decipher results.
