# Illuminated Languages source repository

This repository builds **Runyth Illuminated Languages**, a Foundry VTT V13 module that adds literacy-aware written languages to ordinary journal pages and Illuminated Documents.

> **1.0.7 usability and resilience patch:** All module windows now recover safely from stale off-screen geometry, document-specific dialogs use unique ApplicationV2 IDs, rerenders preserve working context, and localized controls remain readable at narrow widths.

## Commands

```text
npm run format:check
npm run typecheck
npm test
npm run lint
npm run validate
npm run build
```

The project intentionally has no runtime or build dependencies. Tests use Node's built-in test runner. Packaging uses the host `zip` command and validates both archives after extraction.

## Repository layout

```text
module/runyth-illuminated-languages/  Installable module source
tests/                         Automated tests and Foundry mocks
tools/                         Validation, audit, and packaging tools
docs/                          User, GM, player, API, security, references, and acceptance guides
examples/                      Minimal companion provider module
```

The module is not a cryptographic secrecy mechanism. See `docs/SECURITY.md`.

## Language selector labels

Configure **Illuminated Languages → Language selector labels** to show Polyglot display names, display names with internal IDs, or internal IDs only. Stored metadata always retains the stable language ID.

## New document defaults

Configure **Illuminated Languages → New document language defaults** to prefill the extension section when creating an Illuminated Document. Language-name visibility defaults to **GM only** for new metadata and remains overridable globally and per document. Existing metadata is not rewritten.

## GM viewer previews

Open an ordinary Journal text page or Illuminated Document in view/reading mode. A clearly titled **GM Language Preview** toolbar appears at the top of the rendered content. It supports three workflows without changing source text or metadata:

- preview as a specific actor;
- preview as a connected player using that player's deterministically resolved reading actor;
- preview with no language knowledge, which forces every protected language unreadable.

Ordinary Journal pages also expose the eye action **Language Preview…** in the page header. **View Original** restores the normal GM source view. Preview state is client-scoped and never changes what another client sees.

## Polyglot compatibility

Foundry package activation requires Polyglot 2.8.3 or newer. The runtime adapter supports compatible 2.8.x releases (`>=2.8.3 <2.9.0`) and validates required capabilities before rendering.


## Licence
Copyright © 2026  [Daniel Braniewski](https://brani.dev/)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
