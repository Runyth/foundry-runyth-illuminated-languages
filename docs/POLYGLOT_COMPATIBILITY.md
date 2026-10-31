# Polyglot compatibility guide

## Target

The V13 release requires Polyglot 2.8.3 or newer at the Foundry package relationship layer. It intentionally does not declare a hard dependency maximum, because Foundry enforces dependency maximums before Illuminated Languages can initialize or explain an incompatibility.

At runtime, the adapter supports `>=2.8.3 <2.9.0` and independently verifies installation, activation, semantic version, active language provider, dynamic language map, font resolution, user-language extraction, and scrambling. This allows compatible 2.8.x custom patch releases while still failing closed when a future version changes required capabilities.

## Runtime contract used

- `game.polyglot.api.languageProvider`
- provider `languages`
- provider `getLanguageFont(languageId)`
- `game.polyglot.getUserLanguages([actor])`, with provider fallback
- `game.polyglot.scrambleString(text, stableSalt, languageId)`

The adapter preserves provider/custom language IDs and does not duplicate a language database.

## Literacy

When Polyglot returns distinct written languages, those determine readability. If the provider does not distinguish literacy, the world setting **Treat known spoken languages as literate** controls compatibility fallback and defaults to enabled.

## Failure mode

Missing, inactive, unsupported, or structurally incompatible Polyglot never reveals plaintext to a non-original viewer. Protected text is replaced with neutral deterministic glyphs and a localized dependency warning.
