# Architecture summary

## Goals

Illuminated Languages keeps authoritative content separate from viewer-specific presentation. Every transformation is local, deterministic, literacy-aware, and fail-closed.

## Components

```text
main.js
└── IlluminatedLanguagesRuntime
    ├── SettingsFacade
    ├── SafeExecutor
    ├── PolyglotAdapter
    ├── ReadingActorResolver
    ├── GmPreviewController
    ├── ProviderRegistry
    ├── ComprehensionEngine
    ├── LanguageTransformer
    ├── PreviewControls
    ├── OpenViewRegistry
    ├── Journal ApplicationV2 hooks
    ├── IlluminatedDocumentsIntegration
    ├── MigrationManager
    ├── SocketRouter
    └── IlluminatedLanguagesApi
```

### Polyglot boundary

All Polyglot-specific behavior lives in `scripts/integrations/polyglot/adapter.js`. The adapter validates module state, exact V13 compatibility, language-provider shape, language enumeration, fonts, known/literate language extraction, temporary comprehension, and deterministic scrambling. Missing capabilities make protected content unreadable.

### Comprehension

The base decision comes from Polyglot. Complementary providers run in deterministic priority order. A deny result wins by default. Only an explicitly registered policy with `allowGrantAfterDeny: true` can override a deny. Provider errors are isolated and treated as denial.

The special no-language preview is resolved before provider execution for non-Plain languages. It therefore cannot accidentally reveal plaintext through a provider grant, policy override, temporary effect, or literacy fallback.

### Actor resolution

The resolver selects one actor only: explicit **Read as**, exactly one controlled token, assigned character, exactly one owned player character, or none. Multiple controlled tokens never merge language knowledge.

Resolver output is a cycle-safe, immutable, module-owned plain-data snapshot. It contains no Actor, TokenDocument, Item, Collection, parent, application, canvas, or third-party module object. A live Actor is recovered transiently by Actor ID/UUID or selected TokenDocument UUID only at the Polyglot/comprehension boundary and is never recursively frozen.

For D&D 5e 5.3, the snapshot reads only the four explicit fields under `system.attributes.senses.ranges`; it never enumerates the senses model or invokes deprecated direct compatibility getters.

`GmPreviewController` adds client-scoped presentation modes above that resolver. Actor preview uses the selected actor. Connected-player preview resolves that user's assigned character or exactly one owned player character without merging actors. Forced-unreadable preview supplies no actor and an explicit fail-closed comprehension context.

### Rendering

`LanguageTransformer` walks text nodes with `TreeWalker`. It skips controls, editors, navigation, inline rolls, UUID links, ignored content, and module controls. It changes only text node values in the rendered copy. Attributes, links, images, document data, and editor content remain unchanged.

`PreviewControls` injects one compact ignored control into the supported rendered root. Ordinary journals receive it through Foundry V13 rendering hooks. Illuminated Documents receive it only through the public rendered-document transformation context.

### Illuminated Documents

The optional integration registers through `game.illuminatedDocuments.api.registerExtension`. It contributes dynamic document/block fields and callbacks for creation/editor/viewer contexts, transformation, validation, migration, transfer, cache invalidation, and rerendering. It never imports or patches private code.

## Application geometry and UI state

`applications/geometry.js` owns plain-data geometry serialization, viewport-aware restoration, and stable document-specific ApplicationV2 identifiers. Module applications never retain Foundry Documents inside persisted UI state. Settings and Bulk Assignment preserve only module-owned scalar form state and scroll positions across rerenders.
