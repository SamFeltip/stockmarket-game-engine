# Set up the Stockmarket workspace

Use Git, Node.js **22.18 or newer**, and npm. Keep the directories together: the web app imports TypeScript directly from the shared engine. There is no root `package.json`; install each package you need. PostgreSQL and Docker are only relevant to the archived Go application.

## Clone and update

```sh
git clone --recurse-submodules https://github.com/SamFeltip/stockmarket-game-engine.git stockmarket
cd stockmarket
```

All commands below run from this root unless shown in a subshell. For an existing clean checkout:

```sh
git pull --ff-only
git submodule update --init --recursive
```

The parent records compatible commits of the web, TV and legacy repositories. The web app's `shared-workspace.json` also records its required shared-code baseline; later parent commits may change documentation without changing that baseline. Submodules initially have detached HEADs; create a branch inside a submodule before editing it. Do not use `git submodule update --remote` to reproduce the workspace. Default branches are parent `main`, web `main`, TV `master`, and legacy `main`. Commit and push submodule changes in their own repositories first, then commit and push their updated pointers in the parent.

## Shared engine and headless environment

To run the in-memory game tests without Convex, credentials, environment variables or dependency installation:

```sh
npm test --prefix stockmarket-ai
```

For TypeScript checking as well:

```sh
npm ci --prefix stockmarket-shared
npm ci --prefix stockmarket-ai
npm run check --prefix stockmarket-shared
npm run check --prefix stockmarket-ai
```

See the [shared engine](stockmarket-shared/README.md) and [headless API](stockmarket-ai/README.md). The environment reuses the live game's rules and existing NPC policies. No training GUI, terminal trainer or learning algorithm is included.

## Web development

```sh
npm ci --prefix stockmarket-convex
(cd stockmarket-convex && npx convex dev --once)
```

On a fresh machine, Convex prompts for sign-in and project selection. Select the existing `stockmarket-convex` project if you have access, or create your own isolated development project. The CLI writes the deployment selection and `VITE_CONVEX_URL` to ignored `stockmarket-convex/.env.local`. Use the development deployment for local work.

**Only for a new, unconfigured Convex deployment**, initialize password-auth signing keys:

```sh
(cd stockmarket-convex && node scripts/init-auth.mjs)
```

This sets `JWT_PRIVATE_KEY` and `JWKS` directly in Convex. Do not repeat it for an already configured deployment unless deliberately rotating its keys. Existing production keys are already configured. Keep environment files, deployment keys and signing material out of Git.

Start both the Convex watcher and Vite frontend:

```sh
npm run dev --prefix stockmarket-convex
```

Open <http://127.0.0.1:5173>. Ctrl+C stops both. To run them in separate terminals, use `npm run backend --prefix stockmarket-convex` and `npm run dev:frontend --prefix stockmarket-convex`. Accounts and games are specific to the selected deployment; production accounts are not copied into development.

## TV browser development

Set up the web/backend first, then:

```sh
npm ci --prefix stockmarket-tv
# Fresh checkout only; preserve any existing .env.local.
cp stockmarket-tv/.env.example stockmarket-tv/.env.local
```

Edit `stockmarket-tv/.env.local` before starting. The example contains the live production pair; use your development pair for local testing:

```dotenv
VITE_CONVEX_URL=https://your-development-deployment.convex.cloud
VITE_PHONE_URL=http://localhost:5173
```

The Convex URL must match the phone web app's backend. The phone URL is the **phone frontend**, not the TV frontend. `localhost` works only when opening the QR destination on the same computer. For physical phones or TVs, use this computer's LAN address (for example `http://192.168.1.100:5173`), keep devices on the same network, and allow access to the web development server. Use HTTPS for a deployed frontend.

```sh
npm run dev --prefix stockmarket-tv
```

Open <http://localhost:5174>. A browser build needs no Android tooling:

```sh
npm run build --prefix stockmarket-tv
```

For an APK, install JDK 17 and Android SDK Platform 35 / Build Tools 35, accept SDK licenses and configure the SDK path. Follow the TV project's [build instructions](https://github.com/SamFeltip/stockmarket-tv/blob/master/README.md#build-and-sideload-on-a-tv), [Fire TV setup](https://github.com/SamFeltip/stockmarket-tv/blob/master/FIRE_TV.md) and [publishing guide](https://github.com/SamFeltip/stockmarket-tv/blob/master/PUBLISHING.md). Restore existing release signing material for store updates; it is intentionally not in Git.

## Verify changes

After installing the relevant packages:

```sh
npm run check --prefix stockmarket-shared
npm run check --prefix stockmarket-ai
npm test --prefix stockmarket-ai
npm run check --prefix stockmarket-convex
npm test --prefix stockmarket-tv
npm run build --prefix stockmarket-tv
```

The web checks include lint, backend/gameplay integration tests, TypeScript, frontend build and asset validation. Integration tests compare seeded full games through the Convex and memory adapters. The TV tests include installer checks; a physical device is still needed to assess its remote and display.

Use [DEPLOYMENT.md](DEPLOYMENT.md) for production updates and [RELEASE_VERIFICATION.md](RELEASE_VERIFICATION.md) for the last recorded release evidence. The original Go/HTMX app has its own [setup instructions](https://github.com/SamFeltip/stockmarket/blob/main/README.md); it is not needed for the current game.
