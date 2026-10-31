# Known limitations

1. This is immersive obfuscation, not secure secret delivery.
2. Live multi-client Foundry V13 acceptance could not be run in the build environment.
3. The Illuminated Documents v1.9.0 source archive was not mounted in this build session; integration follows its supplied public API summary and performs strict runtime capability/version gating without private fallback.
4. Polyglot 2.8.x does not expose one formally versioned standalone API object for every internal behavior used by its own UI. The adapter therefore validates the supported semantic range and exact V13 runtime capabilities before use and fails closed when they differ.
5. A GM preview of a connected player cannot read that player browser's client-scoped explicit **Read as…** selection. It uses the player's assigned character or exactly one owned player character, matching the deterministic remotely resolvable fallback order.
6. Partial comprehension is exposed to companion providers but core 1.0.7 renders partial results as unreadable rather than inventing a system-specific mixed-text mechanic.
7. Socket transport in a client-side Foundry module is not a cryptographic identity channel. Core decipher requests perform ownership checks and no built-in privileged mutation; providers remain responsible for GM-authorized system effects.

## 1.0.1 notes

Illuminated Documents 1.9.0 exposes document-scoped validation and migration methods. Illuminated Languages does not synthesize a world-wide call without a document; registered callbacks run in the normal document lifecycle.

## Illuminated Documents New Document layout

The placement of Visual Templates, Preset controls, and the document-title input is owned by Illuminated Documents. Illuminated Languages contributes extension fields through the public API but does not patch or style Illuminated Documents' private New Document form layout.
