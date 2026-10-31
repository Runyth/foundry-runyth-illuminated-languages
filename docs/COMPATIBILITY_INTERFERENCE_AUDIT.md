# Compatibility and interference audit — Illuminated Languages 1.0.8

## Scope

The complete installable production tree was reviewed against Foundry VTT V13 ownership boundaries, ApplicationV2 hooks, native DOM behavior, listener lifecycle, CSS isolation, permissions, sockets, public API lifecycle, data compatibility, and optional integrations.

## Issues found and corrected

| Area | Root cause | Correction | Affected files |
| --- | --- | --- | --- |
| Journal viewer eligibility | The generic `renderApplicationV2` path could track a Journal text page even when rendered through an editor or an application root broader than the actual page content. | Require a directly owned text-page application, positive reading-mode checks, and an explicit Journal viewer root. Never transform the entire application element. | `scripts/journals/hooks.js`, `scripts/rendering/view-registry.js` |
| Asynchronous hook isolation | Several hook and DOM callbacks launched promises without a guaranteed rejection boundary. | Route rendering, reading-context, preview, socket, and geometry persistence operations through the shared safe executor or an explicit rejection boundary. | `scripts/journals/hooks.js`, `scripts/runtime.js`, `scripts/rendering/preview-controls.js`, `scripts/sockets/router.js`, application files |
| Duplicate lifecycle work | Hook, socket, and listener registration relied partly on call ordering rather than explicit idempotency. | Add registration guards, deterministic cleanup, abortable application listeners, and stale-view removal. | `scripts/runtime.js`, `scripts/journals/hooks.js`, `scripts/sockets/router.js`, `scripts/applications/bulk-app.js`, `scripts/rendering/view-registry.js` |
| Rerender bursts | Multiple token/user/provider changes could schedule redundant simultaneous rerenders. | Coalesce each burst and preserve one follow-up change received during an active rerender. | `scripts/runtime.js` |
| CSS leakage risk | Utility selectors such as status, result, validation, and bulk classes were not all anchored to a module-owned root. | Scope all 73 selectors beneath module application roots or uniquely prefixed injected elements. | `styles/runyth-illuminated-languages.css` |
| Header-control ordering | Repeated header preparation needed an explicit deduplication and placement rule. | Deduplicate by module action and prepend controls so native controls remain farthest right. | `scripts/journals/hooks.js` |
| Settings permissions | The shared settings application needed an explicit boundary between client settings and GM-owned world defaults. | Allow non-GMs to submit only approved client-scoped keys; hide world defaults and maintenance controls; assert GM permission for maintenance and bulk actions. | `scripts/applications/settings-app.js`, `templates/settings.hbs` |
| Socket replay and malformed requests | Decipher requests required bounded replay handling and stricter scalar/document validation. | Add request IDs, a 60-second TTL, replay suppression, length/type checks, actor ownership checks, and source-document access checks. | `scripts/sockets/router.js` |

## Hook ownership result

The module uses generic ApplicationV2 rendering and header hooks only where Foundry's supported V13 contract requires them, then applies narrow positive eligibility checks for a directly owned ordinary Journal text page. The Journal Directory context action uses the document-specific `getJournalEntryContextOptions` hook. All registrations are installed once and removed during runtime destruction.

## ApplicationV2 result

All module windows remain ApplicationV2/HandlebarsApplicationMixin applications. Actions use module-specific names rather than the reserved generic `tab` action. Form submission, window geometry, listener replacement, partial rerenders, and close cleanup are covered by static and automated validation.

## DOM and listener result

Runtime rendering uses `HTMLElement`, `querySelector`, `querySelectorAll`, `TreeWalker`, `dataset`, `classList`, `addEventListener`, and `AbortController`. No jQuery API or deprecated jQuery render hook remains. Injected preview controls replace their prior module-owned root before binding listeners, and bulk-window listeners are aborted before each bind and on close.

## Actor, Item, Tidy, HUD, Scene, Chat, and canvas result

These surfaces are not integration points for Illuminated Languages. Complete-source tests and static audit confirm no Actor-sheet, Item-sheet, Tidy Modern/Classic, Token HUD, Scene Controls, Chat-render, Chat-card, raw keybinding, PIXI, or canvas-display-object code exists. Therefore:

- no control can be injected into level-up, advancement, rest, roll, activity, effect, importer, or migration dialogs;
- no Token HUD listener or control can duplicate;
- no Scene Controls structure is mutated;
- no Chat hook or `ChatMessage.create()` call is owned by this module;
- no canvas overlay can accumulate or alter token nameplates.

Core D&D 5e and Tidy sheet compatibility is achieved by non-interference, not by fragile sheet DOM injection.

## Public API and data result

`game.illuminatedLanguages.api` and the module package API retain their existing signatures and API version. Optional Illuminated Documents failure remains isolated. Existing Journal flags, Illuminated Documents metadata, settings, preview selections, and language IDs require no migration. Module disablement leaves persisted metadata intact.

## Intentionally unchanged

- Language resolution, literacy behavior, deterministic scrambling, preview modes, import/export behavior, and public extension points.
- Polyglot minimum dependency 2.8.3 with runtime capability validation for compatible 2.8.x patch releases, plus optional Illuminated Documents public API integration.
- The security statement that visible scrambling is immersive concealment rather than cryptographic secrecy.
- No unrelated-module monkey patches, DOM workarounds, or warning suppression were added.

## Unrelated external errors identified from the previously supplied world log

The earlier world log independently attributed `html.find` misuse to `playlist_import`, `controls.push` misuse to `objects-interactions-fx`, a null message-history access to `lame-messenger`, and several deprecated global or V1 APIs to their respective packages. Those errors were not modified or masked by Illuminated Languages.

## Automated result

See `TEST_RESULTS.md`, `STATIC_AUDIT_RESULTS.md`, and `ZIP_INTEGRITY.md`. Live multi-client acceptance remains pending because the build environment did not provide a running Foundry VTT server.


## 1.0.8 dependency-activation finding

| Finding | Root cause | Correction | Affected files |
|---|---|---|---|
| Illuminated Languages could not be re-enabled after a compatible Polyglot patch update | The required relationship declared `maximum: 2.8.3`. Foundry evaluates dependency compatibility before module startup, so a 2.8.4-style patch was rejected before Illuminated Languages could produce its own diagnostics. | Remove the hard relationship maximum, retain `minimum: 2.8.3`, and keep runtime enforcement at `>=2.8.3 <2.9.0` with structural capability checks. | `module.json`, compatibility tests, localization, Polyglot documentation |
| The activation failure was opaque | Because Foundry blocked activation at the package layer, runtime diagnostics and GM notifications never ran. | Let compatible newer dependency patches reach normal startup; unsupported runtime versions still fail closed with actionable diagnostics. | `module.json`, `PolyglotAdapter`, tests |
| Supplied `kctg-5e.kctg-dnd5e` migration errors appeared temporally related | Those messages concern compendium Item records created by a newer Foundry core version than the running server, not the Polyglot relationship. | No workaround added; the condition is documented as external to Illuminated Languages. | Documentation only |

## 1.0.7 supplemental findings

| Finding | Root cause | Correction | Affected files |
|---|---|---|---|
| Document dialogs shared fixed IDs | Page-language and comparison applications inherited one static ID per class. | Derive stable sanitized IDs from the page UUID, retaining no Document reference in persisted UI data. | `applications/page-language-app.js`, `applications/comparison-app.js`, `applications/geometry.js` |
| Two windows did not remember geometry | Geometry settings existed only for Settings and Bulk Assignment. | Add client settings and geometry persistence for Page Language and Reader Comparison. | `constants.js`, `settings/register.js`, application files |
| Stale positions could be inaccessible | Stored coordinates were reapplied without viewport checks. | Bound dimensions and guarantee visible placement after viewport or monitor changes. | `applications/geometry.js` |
| Rerenders discarded working context | Settings and Bulk Assignment fully rerendered without restoring module-owned scroll/filter state. | Capture only scalar module-owned UI values, selection keys, and scroll positions; restore after render. | `settings-app.js`, `bulk-app.js` |
| Bulk confirmation failed open | Missing `DialogV2.confirm` defaulted to approval. | Fail closed, report the issue, and make no changes. | `bulk-app.js` |
| Localized controls could clip | Controls relied on Foundry defaults without module-scoped padding and wrapping safeguards. | Add scoped padding, `min-width: 0`, wrapping buttons, overflow handling, and narrow layouts. | `styles/runyth-illuminated-languages.css`, templates |
| Bulk rows exposed raw IDs | Row presentation used stored internal language IDs directly. | Present the configured Polyglot display label while retaining stable IDs in metadata and data attributes. | `bulk-app.js`, `bulk.hbs` |

No Actor-sheet, Item-sheet, Token HUD, Scene Controls, Chat, keybinding, or canvas integration was introduced. The prior non-interference guarantees remain intact.
