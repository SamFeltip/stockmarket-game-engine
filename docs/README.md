# Documentation ownership

Workspace clone, installation and development instructions live in [SETUP.md](../SETUP.md); coordinated deployment instructions live in [DEPLOYMENT.md](../DEPLOYMENT.md). Project READMEs link there rather than maintaining separate setup procedures.

The [shared engine](../stockmarket-shared/README.md) owns rules and architecture, including the [board-game comparison](../stockmarket-shared/docs/RULES_COMPARISON.md), moved from the web app. The [AI package](../stockmarket-ai/README.md) owns the headless API. Web UI, authentication and database-backup reference notes stay in the web repository. TV remote/device setup, signing, store materials and TV-specific verification stay in the TV repository. Legacy Go documentation stays with the legacy app. Ignored private research and SQL exports remain local and are not published here.

## Historical records

These documents preserve previous plans and cross-project release evidence. They are not current setup instructions; their paths, branch names and test counts describe the original work. The [latest release record](../RELEASE_VERIFICATION.md) is separate.

- [NPC implementation plan](history/NPC_IMPLEMENTATION_PLAN.md)
- [NPC implementation notes and earlier benchmark](history/NPC_IMPLEMENTATION_NOTES.md)
- [Web/TV spectator verification](history/SPECTATOR_VERIFICATION.md)
- [Web merge readiness, 3 November 2026](history/WEB_MERGE_READINESS_2026-11-03.md)
- [TV merge readiness, 3 November 2026](history/TV_MERGE_READINESS_2026-11-03.md)

These records were relocated from the app repositories, where they mixed historical cross-project work with current app instructions. The source filename is recorded in each document; Git history in the original repository retains its earlier revisions.
