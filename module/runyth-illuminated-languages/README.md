# Illuminated Languages

Illuminated Languages 1.0.7 adds viewer-specific written languages to Foundry VTT V13 journal text pages and to Illuminated Documents 1.9.0 through its public extension API.

> **1.0.7 usability and resilience patch:** All module windows now recover safely from stale off-screen geometry, document-specific dialogs use unique ApplicationV2 IDs, rerenders preserve working context, and localized controls remain readable at narrow widths.

## Requirements

- Foundry VTT V13
- Polyglot 2.8.3 or a compatible newer 2.8.x patch release, active and initialized
- Illuminated Documents 1.9.0 or newer is optional

## Installation

Extract the installable archive so the final path is:

```text
Data/modules/runyth-illuminated-languages/module.json
```

Enable Polyglot first, then enable Illuminated Languages. Enable Illuminated Documents only when its document and block integration is needed.

## Core behavior

- Source text is never replaced or saved in scrambled form.
- Transformation is local to each viewer.
- GMs see original text by default and can preview through the clearly titled **GM Language Preview** toolbar.
- Players resolve one reading actor deterministically; actors are never merged.
- Unknown languages, missing actors, extraction errors, provider errors, and unavailable Polyglot integration fail closed.
- Language IDs come from the active Polyglot provider; the module contains no static D&D language database.

## Journal pages

Open a text page and use **Language settings** in the ApplicationV2 header. The metadata is stored below `flags.runyth-illuminated-languages.metadata` with an explicit schema version.

## Illuminated Documents

When Illuminated Documents 1.9.0 exposes extension API 1.x, this module registers document and block fields under extension ID `runyth-illuminated-languages`. No private import, prototype patch, application override, or internal flag write is used.

## GM management

The ApplicationV2 settings window provides integration diagnostics, defaults, reading-actor rules, appearance controls, metadata validation and migration, cache maintenance, self-tests, and the bulk assignment tool. A reader-comparison view can evaluate connected users without exposing it to players.

## Public API

The stable API is available after `illuminatedLanguagesApiInit` at:

```text
game.illuminatedLanguages.api
```

See the source package documentation for the complete API, hook, provider, policy, migration, and security contracts.

## Security limitation

This module provides immersive concealment, not cryptographic secrecy. Normal Foundry permissions may deliver authoritative journal source to a player's browser. A determined player may inspect client-side data even when the rendered document is scrambled. Use ordinary Foundry permissions and do not treat this module as a secure secret-delivery system.

## Language selector labels

Configure **Illuminated Languages → Language selector labels** to show Polyglot display names, display names with internal IDs, or internal IDs only. Stored metadata always retains the stable language ID.

## New document defaults

Configure **Illuminated Languages → New document language defaults** to prefill the extension section when creating an Illuminated Document. Language-name visibility defaults to **GM only** for new metadata and remains overridable globally and per document. Existing metadata is not rewritten.

## GM viewer previews

Open an ordinary Journal text page or Illuminated Document in view/reading mode. The clearly titled **GM Language Preview** toolbar appears at the top of the rendered content and offers actor, connected-player, and no-language perspectives. Ordinary Journal pages also expose an eye action named **Language Preview…** in the page header. **View Original** restores normal GM viewing. These previews are client-local and do not modify document metadata or other users' views.
