# Illuminated Languages 1.0.7 release notes

## Summary

Version 1.0.7 is a patch-level usability, ApplicationV2 identity, and window-resilience update. It preserves all language metadata, rendering, literacy, preview, Polyglot, ordinary Journal, Illuminated Documents, socket, migration, and public API behaviour.

## Corrected issues

- Journal Page Language and Reader Comparison previously used one fixed ApplicationV2 ID per application class. Different documents now receive stable document-specific IDs.
- Only Settings and Bulk Assignment remembered window geometry. All four module windows now remember client-side geometry.
- Persisted geometry could reopen a window mostly or completely outside a changed browser or monitor viewport. Geometry is now copied, bounded, and restored with a visible portion guaranteed.
- Settings and Bulk Assignment rerenders could return users to the top or reset filters and list position. Module-owned working state is now restored after rerender.
- Broad bulk assignment assumed confirmation success if the V13 confirmation API was unavailable. It now fails closed and applies nothing.
- Bulk Assignment displayed raw language IDs even when display labels were configured. Rows now use the configured Polyglot display label mode.
- Long localized button labels, status values, and form controls could clip at narrow widths. Controls now have scoped padding, wrapping, minimum-width handling, and responsive footer behaviour.
- Integration diagnostics now display localized yes/no/not-available values rather than raw booleans where practical.

## Compatibility

- Foundry VTT 13.351 target remains unchanged.
- Polyglot 2.8.3 remains required.
- Illuminated Documents 1.9.0 remains optional through its public API.
- No metadata migration is required.
- Public API version remains 1.0.0 because no public signatures changed.

## Verification

Automated tests cover geometry recovery, application identity, client settings registration, bulk confirmation safety, display labels, label associations, and responsive control rules in addition to the existing compatibility and isolation suite.
