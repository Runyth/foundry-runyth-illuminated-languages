# Migration notes

Version 1.0.0 uses metadata schema version 1.

## Journal pages

Metadata is normalized below `flags.runyth-illuminated-languages.metadata`. Migration is idempotent, preserves unknown keys and language IDs, and updates the world migration marker only when all page migrations complete without failure.

## Illuminated Documents

Extension metadata migration is delegated through the public `migrateExtensionData` capability. The module never marks third-party migration success itself and never writes private Illuminated Documents flags.

## Reading selection

The last explicit actor ID is a client-scoped setting. Invalid or no-longer-owned actors are ignored without deleting unrelated settings.

## 1.0.1

No metadata migration is required. Existing stable language IDs remain unchanged; only their selector labels are configurable. Illuminated Documents migration remains document-scoped and runs through its normal lifecycle.

## 1.0.2

No metadata schema migration is required. Existing per-document, per-block, and per-page language-name visibility values remain unchanged. Existing explicitly stored world settings remain unchanged. Only newly created metadata without an explicit value uses the new `gm-only` default.

## 1.0.4

No document or actor migration is required. GM preview mode, preview actor, and preview user are client-scoped settings. Existing `gmOriginalView` and explicit actor selections remain compatible; when the new preview-mode setting has no stored value, the prior original/actor behaviour is inferred.

## 1.0.5

No metadata migration is required. The release changes transient reading-context representation only. Cached resolver results from earlier versions are client-memory objects and disappear when Foundry reloads. Existing journal flags, Illuminated Documents extension metadata, settings, and stored Actor IDs remain unchanged.

## 1.0.6

No metadata or world migration is required. The release changes transient UI eligibility, listener lifecycle, socket validation, and stylesheet scope only. Existing Journal flags, Illuminated Documents extension metadata, client preview selections, world defaults, and public API signatures remain compatible.

## 1.0.7

No world or document migration is required. Two new client-scoped settings remember the Journal Page Language and Reader Comparison window geometry. Existing settings, Journal flags, Illuminated Documents metadata, and API contracts are unchanged.
