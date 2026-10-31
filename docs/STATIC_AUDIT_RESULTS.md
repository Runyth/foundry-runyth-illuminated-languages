# Static compatibility and isolation audit

Result: **Passed**

Runtime files: 42
JavaScript files: 30
Templates: 4
CSS selectors checked: 122

## Forbidden-pattern checks

- V1 Application subclass: passed
- Foundry appv1 namespace: passed
- deprecated renderApplication hook: passed
- deprecated renderChatMessage hook: passed
- deprecated Journal V1 hook: passed
- deprecated global Foundry aliases: passed
- jQuery API: passed
- outdated Scene Controls array mutation: passed
- reserved generic tab action: passed
- raw global keyboard listener: passed
- deprecated or unrelated Chat integration: passed
- Actor or Item sheet injection: passed
- Tidy sheet integration: passed
- Token HUD integration: passed
- Scene Controls integration: passed
- canvas lifecycle integration: passed
- PIXI or canvas display-object creation: passed
- unsafe dynamic execution: passed
- private Illuminated Documents import: passed
- private Polyglot import: passed
- prototype monkey patch: passed
- deprecated direct D&D sense access: passed
- live Actor passed directly to deepFreeze: passed
- unscoped CSS selector: passed

## Required architecture evidence

- ApplicationV2-only applications: present
- native HTMLElement traversal: present
- abortable render/listener lifecycle: present
- strict Journal page ownership predicate: present
- editor exclusion: present
- document-specific Journal context hook: present
- idempotent hook cleanup: present
- idempotent lifecycle registration: present
- idempotent socket registration: present
- socket replay suppression: present
- safe asynchronous hook execution: present
- header controls inserted before native cluster: present
- public Illuminated Documents API: present
- public game API namespace: present
- cycle-safe immutable snapshots: present
- current D&D sense ranges: present

No forbidden runtime, template, or stylesheet patterns were found.
