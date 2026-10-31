# Technical references

The implementation and compatibility checks were based on these primary sources:

- Foundry VTT V13 `ApplicationV2`: https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html
- Foundry VTT V13 application hooks: https://foundryvtt.com/api/v13/modules/hookEvents.html
- Polyglot repository: https://github.com/mclemente/fvtt-module-polyglot
- Polyglot releases: https://github.com/mclemente/fvtt-module-polyglot/releases
- Polyglot 2.8.3 release: https://github.com/mclemente/fvtt-module-polyglot/releases/tag/2.8.3

Illuminated Documents integration is deliberately restricted to `game.illuminatedDocuments.api`. The v1.9.0 source archive was not mounted during this build, so the supplied public-API summary and strict runtime capability checks are the available contract evidence.
