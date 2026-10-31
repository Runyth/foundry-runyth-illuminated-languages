# Illuminated Languages 1.0.8 release notes

## Dependency activation fix

Version 1.0.7 declared Polyglot with `minimum`, `maximum`, and `verified` all set to `2.8.3`. Foundry VTT hard-enforces a dependency maximum before activating a module, so a compatible custom Polyglot patch release such as 2.8.4 caused Illuminated Languages to be refused with **Cannot be enabled due to issues in required dependencies** before Illuminated Languages could run diagnostics.

Version 1.0.8 removes the hard dependency maximum while retaining `minimum: 2.8.3`. The runtime adapter continues to enforce `>=2.8.3 <2.9.0` and validates every required Polyglot capability before protected content is rendered. Unsupported runtimes therefore still fail closed and produce the existing GM-facing compatibility diagnostics.

## Server log assessment

The supplied `kctg-5e.kctg-dnd5e` errors are unrelated to Illuminated Languages or Polyglot dependency activation. They report compendium Item records created by a newer Foundry core version than the currently running server can migrate. No workaround for that external package/database condition is included in this release.

## Compatibility

- Foundry VTT: V13
- Polyglot package dependency: `>=2.8.3`
- Illuminated Languages runtime adapter: `>=2.8.3 <2.9.0` plus capability checks
- Illuminated Documents: optional `>=1.9.0`

No metadata migration is required.
