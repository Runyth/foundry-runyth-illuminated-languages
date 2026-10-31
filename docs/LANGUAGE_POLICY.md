# Language policy example

Deny wins by default. A policy may explicitly permit and adjudicate an override.

```javascript
api.registerLanguagePolicy({
  id: "specific-overrides-general",
  version: "1.0.0",
  priority: 10,
  allowGrantAfterDeny: true,
  resolveConflict({ deny, grant }) {
    if (deny?.reason === "general-illiteracy" && grant?.reason === "specific-training") {
      return { readable: true, understood: true, recognized: true };
    }
    return null;
  }
});
```

Policies should be narrow, deterministic, and documented. Avoid broad rules which can reveal plaintext after an unrelated provider denied access.
