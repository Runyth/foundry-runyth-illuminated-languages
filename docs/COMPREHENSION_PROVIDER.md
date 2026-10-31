# Comprehension provider example

A provider may contribute actor extraction, written comprehension, temporary comprehension, recognition, partial understanding, and decipher behavior.

```javascript
Hooks.once("illuminatedLanguagesApiReady", (api) => {
  api.registerComprehensionProvider({
    id: "arcane-translation",
    version: "1.0.0",
    priority: 100,
    resolveComprehension({ actor, languageId }) {
      const enabled = actor.effects.some((effect) =>
        effect.getFlag("arcane-translation", "languages")?.includes(languageId)
      );
      return enabled
        ? { decision: "grant", reason: "temporary-translation" }
        : { decision: "abstain" };
    },
    attemptDecipher({ actor, sourceHash }) {
      return { status: "failure", actorId: actor.id, sourceHash };
    }
  });
});
```

A thrown callback is isolated and treated as denial for that operation. Providers must validate their own system-specific mutation and GM requirements.
