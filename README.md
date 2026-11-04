# Stockmarket workspace

The web game and headless AI environment use one implementation of the game rules. Start with [SETUP.md](SETUP.md) to clone, install and run the projects, and [DEPLOYMENT.md](DEPLOYMENT.md) to release the backend, frontend and TV builds.

```text
stockmarket/
├── stockmarket-shared/   Rules, game lifecycle, contracts, catalog and existing NPC strategies
├── stockmarket-ai/       In-memory environment API and tests
├── stockmarket-convex/   React game and Convex persistence/auth/scheduling adapter (submodule)
├── stockmarket-tv/       Android TV / Fire TV application (submodule)
└── stockmarket-old/      Original Go/templ/HTMX application (submodule)
```

This public repository is [stockmarket-game-engine](https://github.com/SamFeltip/stockmarket-game-engine). It owns the shared engine and headless environment directly; the three apps retain their Git histories as submodules pinned to compatible commits. The [stockmarket GitHub Project](https://github.com/users/SamFeltip/projects/3) groups the four repositories. Keep the sibling layout: the web app imports shared TypeScript source directly.

The extraction preserves the existing game rules, including £500 cash rounding and the £8 NatWest opening price. Persistence, authentication, subscriptions and live scheduling remain in the Convex app. The headless environment uses an in-memory adapter and needs no Convex service. No training GUI, terminal trainer or learning algorithm is included.

- [Shared engine architecture](stockmarket-shared/README.md) and [rules comparison](stockmarket-shared/docs/RULES_COMPARISON.md)
- [Headless API](stockmarket-ai/README.md)
- [Web application](https://github.com/SamFeltip/stockmarket.js/blob/main/README.md)
- [TV application and device guides](https://github.com/SamFeltip/stockmarket-tv/blob/master/README.md)
- [Last release verification](RELEASE_VERIFICATION.md)
- [Documentation ownership and historical records](docs/README.md)
