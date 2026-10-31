# Illuminated Languages 1.0.6 release notes

## Compatibility and interference patch

Version 1.0.6 audits the complete runtime module for Foundry VTT V13 application ownership, DOM handling, listener lifecycle, CSS scope, permissions, sockets, and optional integration isolation. Existing language, literacy, preview, Polyglot, ordinary Journal, Illuminated Documents, metadata, migration, and public API behavior remains intact.

## Corrections

- Ordinary Journal transformation now requires a directly owned `JournalEntryPage` text-page application, reading mode, and an explicit Journal content root. Edit views, contenteditable roots, broad application roots, and Actor-related child applications are excluded.
- Hook callbacks and injected DOM controls isolate asynchronous work through the module safe executor, preventing unhandled rejections from disrupting Foundry interaction.
- Hook, socket, listener, and lifecycle registration is idempotent and reversible. Open-view rerendering removes stale applications and isolates failures per view.
- Reading-context changes are coalesced during bursts and process at most one required follow-up update after an active rerender.
- Every stylesheet selector is scoped below an Illuminated Languages root or a uniquely prefixed injected integration element.
- Header controls are deduplicated and prepended so Foundry's native ellipsis and close controls remain at the far right.
- World-scoped defaults and maintenance actions remain GM-only; player-editable client settings remain available.
- Decipher requests use validated scalar payloads, document access checks, expiry, unique request IDs, and replay suppression.

## Confirmed absence

Illuminated Languages does not register Actor-sheet, Item-sheet, Tidy 5e, Token HUD, Scene Controls, Chat-render, keybinding, or canvas-display-object integrations. No compatibility shim or monkey patch was added for those unrelated surfaces.

## Compatibility

- Foundry VTT: 13
- Polyglot: exactly 2.8.3
- Illuminated Documents: optional, 1.9.0 or newer through its public extension API
- D&D 5e 5.3.3 and Midi-QOL document subclasses remain covered by the safe reading-context snapshot regressions introduced in 1.0.5.

No data migration is required. Reload the world after replacing the module directory.
