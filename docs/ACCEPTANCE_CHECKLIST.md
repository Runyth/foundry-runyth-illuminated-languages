# Multi-client Foundry V13 acceptance checklist

## Environment required

- Cloned Foundry VTT V13 world
- Polyglot 2.8.3 or a compatible 2.8.x patch release
- Illuminated Documents 1.9.0
- One GM browser and two independent player browsers
- Literate, illiterate, and spoken-but-not-literate actors where the provider supports literacy

## Build-environment result

No live Foundry server or independent browser clients were available in the build environment. The following checks are therefore **Not run — live acceptance required** rather than reported as passed.

| # | Check | Result |
| --- | --- | --- |
| 1 | Ordinary journal is plaintext for literate character | Not run |
| 2 | Same journal is Polyglot script for illiterate character | Not run |
| 3 | Clients simultaneously receive different local results | Not run |
| 4 | GM sees original text | Not run |
| 5 | GM View as matches selected actor | Not run |
| 6 | Illuminated Documents document language works | Not run |
| 7 | Per-block overrides work | Not run |
| 8 | Mixed-language document works | Not run |
| 9 | Show Players transforms independently | Not run |
| 10 | Controlled token change rerenders | Not run |
| 11 | Actor language change rerenders | Not run |
| 12 | Active-effect comprehension rerenders | Not run |
| 13 | Editing and saving never stores scrambled text | Not run |
| 14 | Import/export preserves metadata | Not run |
| 15 | Duplication remaps block metadata | Not run |
| 16 | Disabling module preserves metadata and restores source view | Not run |
| 17 | Players cannot edit metadata without permission | Not run |
| 18 | No deprecated API warnings | Not run |
| 19 | No duplicate-listener errors | Not run |
| 20 | No plaintext leaks through UI/accessibility/diagnostics | Not run |
| 21 | GM connected-player preview matches that player's assigned or uniquely owned reading actor | Not run |
| 22 | GM no-language preview keeps all protected languages unreadable and Plain content readable | Not run |
| 23 | Preview controls work in both ordinary journals and Illuminated Documents | Not run |
| 24 | View Original restores source display after every preview mode | Not run |

Record the Foundry build, system version, module versions, browsers, console output, and actual result beside each item during acceptance.

| 25 | GM Language Preview toolbar is clearly visible at the top of ordinary Journal and Illuminated Document reading views | Not run |
| 26 | Ordinary Journal header exposes the labeled Language Preview… action | Not run |
| 27 | Active preview exposes View Original and restoring it updates all open views | Not run |

## 1.0.5 critical compatibility acceptance

Use Foundry VTT 13.351 and D&D 5e 5.3.3. Repeat the following once with Midi-QOL enabled and once without it. These checks were not runnable in the build container and remain pending live verification.

| # | Check | Result |
| --- | --- | --- |
| 28 | Select a player-character token without stack overflow | Not run |
| 29 | Change selection repeatedly between multiple tokens | Not run |
| 30 | Open, edit, and rename the selected Actor | Not run |
| 31 | Open, edit, and rename an embedded Item | Not run |
| 32 | Repeat with a synthetic or unlinked token Actor | Not run |
| 33 | Repeat with Midi-QOL enabled | Not run |
| 34 | Repeat with Midi-QOL disabled | Not run |
| 35 | Language rendering and reading-context changes still work | Not run |
| 36 | No recursive `deepFreeze`, maximum-stack, or read-only document errors originate from Illuminated Languages | Not run |
| 37 | No deprecated direct D&D sense-property warnings originate from Illuminated Languages | Not run |

## 1.0.6 compatibility and interference acceptance

Run these checks with one GM and one player client. Include core D&D 5e sheets, Tidy 5e Modern, Tidy 5e Classic, Midi-QOL, and DAE where available.

| # | Check | Result |
| --- | --- | --- |
| 38 | Ordinary Journal reading view receives one language toolbar and transforms correctly | Not run |
| 39 | Journal edit mode contains original source and receives no transformed viewer root | Not run |
| 40 | Character level-up and advancement windows receive no Illuminated Languages controls | Not run |
| 41 | Roll, rest, activity-use, effect, importer, migration, and confirmation dialogs receive no controls | Not run |
| 42 | Core D&D 5e character and NPC sheets remain unaffected | Not run |
| 43 | Tidy Modern and Tidy Classic sheets remain unaffected | Not run |
| 44 | Unsupported custom sheets fail without affecting settings, API, Journals, or previews | Not run |
| 45 | Repeated partial Journal renders create exactly one toolbar and one action per control | Not run |
| 46 | Token HUD remains unchanged and its actions execute normally | Not run |
| 47 | Scene Controls remain unchanged with other tool-registering modules enabled | Not run |
| 48 | Chat messages and cards remain unchanged; no module-owned deprecated Chat warning occurs | Not run |
| 49 | Multiple selected tokens fail closed without merging Actor languages | Not run |
| 50 | Browser refresh and world reload do not duplicate hooks, controls, sockets, or listeners | Not run |
| 51 | Disable and re-enable preserves all metadata and restores normal Foundry behavior | Not run |
| 52 | Narrow and large windows retain scoped, readable, unclipped module UI | Not run |
| 53 | Player cannot write world defaults or invoke GM maintenance actions | Not run |
| 54 | Malformed, expired, replayed, or unauthorized decipher requests are rejected | Not run |
| 55 | No normal-use warning or error originates from the Illuminated Languages module path | Not run |

## 1.0.7 UI resilience acceptance

- [ ] Open language configuration for two different Journal pages simultaneously; verify each window belongs to the correct page.
- [ ] Open reader comparison for two different pages simultaneously; verify the windows do not replace or confuse each other.
- [ ] Resize and move Settings, Bulk Assignment, Journal Page Language, and Reader Comparison; close and reopen each.
- [ ] Move a saved window near a secondary monitor edge, disconnect or change the monitor layout, and verify the window reopens at least partially visible.
- [ ] Use **Reset saved window positions**, close the windows, and verify they reopen with defaults.
- [ ] Scroll the Settings window, save, and verify the same section remains visible.
- [ ] Set Bulk Assignment filters and scroll the target list; refresh and verify the working context is retained.
- [ ] Complete a successful bulk assignment and verify the previous selection is cleared to prevent accidental duplicate application.
- [ ] Verify bulk rows show configured language display names, including the display-name/internal-ID mode.
- [ ] Verify all buttons and labels remain readable at narrow widths in light and dark themes.
- [ ] Verify changing client window geometry does not alter Journal or Illuminated Documents language metadata.
