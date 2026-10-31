# Public API reference

## Lifecycle

- `illuminatedLanguagesApiInit(api)` — API object created; registration is allowed.
- `illuminatedLanguagesApiReady(api)` — integrations, settings, sockets, and migrations are initialized.

The API version is independent from the module version and is currently `1.0.0`.

## Stable methods

| Method | Parameters | Return | Notes |
| --- | --- | --- | --- |
| `getLanguages()` | none | immutable language descriptors | Dynamic Polyglot provider data |
| `getLanguage(id)` | language ID | immutable descriptor | Missing IDs remain represented |
| `getEffectiveLanguage(documentOrPage, blockId?)` | Foundry document/page, optional block ID | language ID | Block → document → default |
| `resolveReadingActor(userId?)` | optional user ID | immutable plain-data resolution | Contains IDs, actor name, token UUID, source, and supported sense ranges; never contains a live Document or merges actors |
| `getKnownLanguages(actor)` | accessible actor | defensive `Set` | Spoken/understood languages |
| `getLiterateLanguages(actor)` | accessible actor | defensive `Set` | Written languages |
| `canUnderstand(actor, id)` | actor, ID | boolean | Polyglot and temporary comprehension |
| `canRead(actor, id, options?)` | actor, ID, options | `Promise<boolean>` | Provider-aware fail-closed result |
| `renderUnreadableText(text, options)` | text, language/seed options | string | Deterministic display text |
| `invalidateDocument(uuid?)` | optional UUID | `Promise<boolean>` | Clears transient state |
| `rerenderOpenViews(uuid?)` | optional UUID | `Promise<number>` | Client-local rerender |
| `registerComprehensionProvider(provider)` | validated descriptor | immutable descriptor | Unique ID and priority |
| `unregisterComprehensionProvider(id)` | provider ID | boolean | Safe removal |
| `registerLanguagePolicy(policy)` | validated descriptor | immutable descriptor | Explicit conflict policy |
| `unregisterLanguagePolicy(id)` | policy ID | boolean | Safe removal |
| `getDiagnostics()` | none | immutable report | No document plaintext |
| `isApiVersionSupported(range)` | semver range | boolean | Compatibility helper |
| `assertApiVersion(range)` | semver range | true or throws | Compatibility helper |

## Experimental

`api.experimental.attemptDecipher(payload)` forwards a validated request to registered decipher providers. The core module stores no plaintext decipher result and performs no game-system roll.

## Hooks

- `illuminatedLanguagesReadingActorChanged`
- `illuminatedLanguagesBeforeTransform`
- `illuminatedLanguagesAfterTransform`
- `illuminatedLanguagesComprehensionResolved`
- `illuminatedLanguagesLanguageMetadataChanged`
- `illuminatedLanguagesProviderRegistered`
- `illuminatedLanguagesProviderUnregistered`
- `illuminatedLanguagesAttemptDecipher`

Transform hooks identify context but do not expose authoritative plaintext as a dedicated payload field.
