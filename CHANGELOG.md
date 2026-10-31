# Changelog

## 1.0.10 — 2026-11-01

- Declared the `AGPL-3.0-or-later` licence and the tested Node `>=22.13.0 <27` range in the lockfile root package.
- Preserved all behaviour, dependency, and migration contracts; this patch changes packaging metadata only and requires no content migration.

## 1.0.9 — 2026-10-31

- Licensed the program under AGPL-3.0-or-later.
- Aligned the unpublished module id with `runyth-illuminated-languages`.
- Published install, source, and documentation archives as `-mod`, `-src`, and `-doc`.

## 1.0.8 — 2026-08-08

- Removed the hard `maximum: 2.8.3` Polyglot dependency constraint that caused Foundry to refuse activation after a compatible custom Polyglot patch update.
- Kept `minimum: 2.8.3` in the Foundry relationship while retaining the runtime adapter range `>=2.8.3 <2.9.0` and structural capability validation.
- Added compatibility coverage for Polyglot 2.8.4, custom SemVer build metadata, and later compatible 2.8.x patch releases.
- Updated GM-facing compatibility text and documentation to distinguish package activation requirements from runtime adapter validation.
- Documented that the supplied `kctg-5e.kctg-dnd5e` newer-core compendium migration errors are external and unrelated to Illuminated Languages dependency activation.

## 1.0.7 — 2026-08-02

- Added document-specific ApplicationV2 IDs for Journal Page Language and Reader Comparison windows so different documents no longer compete for one fixed application identity.
- Added remembered client-side size and position for all four module windows, with viewport-aware recovery when monitor layout or browser size changes.
- Added a maintenance action to clear saved module window geometry without touching language metadata or world settings.
- Preserved Settings scroll position and Bulk Assignment filters, operation values, selection state, and list scroll position across safe rerenders.
- Made broad bulk changes fail closed when Foundry's confirmation dialog is unavailable and guarded submissions against duplicate activation.
- Changed Bulk Assignment rows to show the configured Polyglot display label instead of exposing only internal language IDs.
- Added explicit form-label associations, localized integration status values, padded inputs, wrapping buttons, overflow-safe status text, and narrow-window layouts.
- Parallelized reader-comparison evaluation without changing its results or permission model.
- Added regression coverage for geometry recovery, document-specific application IDs, client geometry settings, bulk confirmation safety, display labels, accessibility labels, and localization-safe UI sizing.

## 1.0.6 — 2026-07-29

- Restricted generic ApplicationV2 rendering to primary ordinary Journal text-page viewers with a positively identified module-owned content root; editors and Actor-related child applications are excluded.
- Isolated asynchronous Journal, preview-control, socket, settings-geometry, and rerender operations so hook and DOM event callbacks cannot emit unhandled promise rejections.
- Made Journal hooks, runtime lifecycle hooks, sockets, application listeners, controls, and open-view tracking idempotent with explicit cleanup and stale-view removal.
- Scoped every stylesheet selector to an Illuminated Languages application or integration root, preventing changes to unrelated Foundry and third-party windows.
- Kept module header controls deduplicated and inserted before Foundry's native header-control cluster.
- Enforced GM-only writes for world-scoped defaults and maintenance operations while retaining player access to legitimate client-scoped reading and appearance settings.
- Added validated, expiring, replay-resistant decipher socket requests and preserved fail-closed permission checks.
- Coalesced bursts of reading-context changes to prevent redundant rerender loops while preserving a follow-up update that arrives during an active render.
- Confirmed by full-source audit that the module does not inject Actor or Item sheet controls, Tidy controls, Token HUD controls, Scene Controls, Chat hooks/cards, keybindings, or canvas display objects.
- Added comprehensive compatibility, interference, CSS-isolation, lifecycle, permission, socket, and absence regression coverage.

## 1.0.5 — 2026-07-29

- Fixed a critical reading-context stack overflow caused by recursively freezing live Foundry Actor document graphs.
- Replaced resolver results containing live Actor references with minimal immutable plain-data snapshots containing only identity, selected-token, source, and supported sense-range values.
- Prevented Foundry Actors, synthetic token Actors, embedded Items, Midi-QOL document subclasses, collections, parents, and application-owned objects from becoming read-only.
- Replaced unrestricted recursive freezing with cycle-safe module-owned snapshot creation that ignores accessors and rejects unsupported complex instances without mutating caller-owned data.
- Read D&D 5e special senses only through `system.attributes.senses.ranges.darkvision`, `blindsight`, `tremorsense`, and `truesight`; deprecated compatibility getters are never enumerated.
- Isolated reading-context resolution failures through the throttled safe executor so token selection cannot create an unhandled promise rejection or uncontrolled retry loop.
- Added regression coverage for standard, synthetic, circular, embedded-item, and Midi-QOL-like document graphs, source mutability, current sense fields, failure isolation, and repeated token changes.

## 1.0.4 — 2026-07-26

- Replaced the ambiguous compact GM selector with a clearly titled **GM Language Preview** toolbar at the top of rendered ordinary journals and Illuminated Documents.
- Added concise instructions directly in the toolbar explaining that it previews as a player, actor, or viewer with no language knowledge and changes only the GM browser.
- Renamed the ordinary Journal header action to **Language Preview…** for GMs while retaining **Read as…** for players.
- Added an always-visible current-view status and a dedicated **View Original** button whenever a preview is active.
- Improved the preview dialog with a descriptive title, explanation, explicit perspective label, and localized apply action.
- Added English/German localization parity and regression tests for preview discoverability and restoration.

## 1.0.3 — 2026-07-26

- Added a subtle GM-only **Read as…** option for previewing through a specific connected player's resolved reading actor.
- Added a GM-only **Preview with no language knowledge** mode which forces all protected languages unreadable while leaving Plain content universally readable.
- Applied both preview modes to ordinary journal pages and Illuminated Documents through their supported rendering pipelines.
- Preserved existing actor preview, View Original, metadata, literacy, language-label, and creation-default behaviour.
- Added client-scoped preview state and regression tests for player resolution, forced unreadability, provider-grant suppression, and Illuminated Documents transformation.

## 1.0.2 — 2026-07-26

- Changed the default language-name visibility for newly created metadata to **GM only**.
- Kept the language-name visibility as a world-configurable default in Configure Settings.
- Made the New Document language defaults explicit in the settings UI and exposed the resolved creation defaults through the public Illuminated Documents creation context.
- Preserved all existing document metadata and explicit world settings without forced migration.

## 1.0.1 — 2026-07-25

- Fixed Illuminated Documents startup migration by no longer calling document-scoped APIs without a document.
- Fixed extension validation to return Illuminated Documents structured validation results, preventing valid documents from being blocked during save.
- Fixed Polyglot language choices to read display labels and fonts from object-shaped provider metadata.
- Added a global setting for display names, display names with internal IDs, or internal IDs only.
- Added regression tests for all reported failures and language-label modes.

## 1.0.0 — 2026-07-25

- Added written-language metadata for ordinary JournalEntryPage text pages.
- Added viewer-specific, deterministic Polyglot rendering with language fonts.
- Added literacy-aware, fail-closed comprehension resolution.
- Added deterministic reading-actor selection and compact **Read as…** controls.
- Added GM original and actor-preview behavior.
- Added Illuminated Documents 1.9.0 extension registration for document and block languages.
- Added ApplicationV2 settings, page configuration, bulk management, diagnostics, migration, and self-test tools.
- Added stable public API, hooks, comprehension providers, policies, and decipher extension surface.
- Added English and German localization, accessibility safeguards, tests, audits, and documentation.
