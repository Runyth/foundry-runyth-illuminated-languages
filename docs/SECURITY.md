# Security and secrecy limitations

Illuminated Languages provides immersive concealment, not cryptographic protection.

Foundry may deliver journal source data to a player's browser according to normal document permissions. Scrambling the rendered DOM does not prevent a technically capable player from inspecting network traffic, client documents, browser memory, or module code.

The module therefore:

- never claims secure secret delivery;
- preserves Foundry document permissions;
- requires Owner permission to edit page metadata;
- validates actor ownership for **Read as…** and decipher requests;
- sanitizes registered identifiers;
- uses native DOM APIs;
- performs no `eval`, `Function`, or dynamic script injection;
- does not log source plaintext;
- does not put source plaintext in ARIA labels, hidden spans, titles, tooltips, or diagnostics;
- treats malformed, missing, or incompatible data as unreadable.

A future strict-delivery module could keep authoritative source GM-only and send short-lived viewer-specific payloads from an active GM. Version 1.0.7 deliberately does not implement or advertise a partial secure-delivery design.
