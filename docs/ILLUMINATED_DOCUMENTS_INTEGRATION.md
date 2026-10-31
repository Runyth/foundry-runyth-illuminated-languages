# Illuminated Documents integration guide

## Compatibility

- Illuminated Documents module: 1.9.0 or newer
- Extension API: 1.x (`^1.0.0`)
- Extension ID: `runyth-illuminated-languages`

## Registration

The module checks `game.illuminatedDocuments.api`, verifies the independent API version, and calls `registerExtension`. It registers during the API lifecycle hooks and also detects an API that became available earlier.

## Fields

Document fields:

- `defaultLanguage`
- `requireLiteracy`
- `languageNameVisibility`
- `unreadableFallback`

Block field:

- `language` with Inherit, Plain, and dynamic Polyglot choices

## Callbacks

The descriptor contributes creation, editor, and viewer context; rendered-document transformation; validation; migration; import/export normalization; and cache invalidation. Rendering looks for stable public `data-illuminated-block-id` associations supplied by the viewer pipeline.

## Storage

All data is managed through Illuminated Documents' public extension metadata helpers. Unknown language IDs survive validation, transfer, duplication, preset changes, module disablement, and reinstallation.

## Contract verification limitation

The build environment contained the published v1.9.0 API summary but not the original v1.9.0 source archive itself. The integration therefore gates every public capability at runtime, performs no private fallback, and reports registration incompatibility rather than patching internals.

## Creation defaults

The creation context exposes an immutable `illuminatedLanguages.creationDefaults` object resolved from world settings. Registered document-field defaults read the same live settings. The default language-name visibility for newly created metadata is `gm-only`; GMs may change it globally in Configure Settings or override it per document. Existing extension metadata is never rewritten merely because the default changed.

## GM preview controls

The extension's public `transformRenderedDocument` callback resolves the current Illuminated Languages viewer context before each transformation. It adds a clearly titled, ignored **GM Language Preview** toolbar at the top of the public rendered-document root. The toolbar explains its purpose, exposes the preview perspective, reports the current view, and provides **View Original** while a preview is active. No Illuminated Documents template, application class, prototype, private flag, or undocumented internal property is patched.
