# Illuminated Languages 1.0.5 release notes

## Critical runtime correction

Version 1.0.5 fixes a reading-context stack overflow in Foundry VTT 13.351 with D&D 5e 5.3.3. Earlier resolver results included the live Actor document and passed that object graph to an unrestricted recursive freezer. The traversal could reach embedded Items, parent links, collections, synthetic documents, Midi-QOL subclasses, circular references, and D&D compatibility getters. This caused `Maximum call stack size exceeded` and could leave Actors or Items read-only.

The resolver now returns only a module-owned immutable snapshot:

- Actor ID, UUID, and display name;
- selected TokenDocument UUID where applicable;
- deterministic resolution source;
- four numeric D&D 5e special-sense ranges.

Live Actors are resolved transiently only when Polyglot or a registered comprehension provider needs them. They are never stored in or recursively frozen with the resolver result.

## D&D 5e 5.3 compatibility

Special senses are read only from:

- `system.attributes.senses.ranges.darkvision`;
- `system.attributes.senses.ranges.blindsight`;
- `system.attributes.senses.ranges.tremorsense`;
- `system.attributes.senses.ranges.truesight`.

The deprecated direct properties are neither read nor enumerated.

## Failure isolation

Reading-context updates now execute through the shared throttled safe executor. Resolver or rerender failures return a fail-closed result, generate one concise diagnostic, and do not escape as unhandled promise rejections.

## Interoperability

Regression coverage includes standard D&D 5e Actors, NPCs, synthetic token Actors, linked and unlinked token patterns, embedded Items, circular document graphs, and representative Midi-QOL Actor and Item subclasses. Source documents remain mutable after every resolution.
