# Deploy the web game and prepare TV builds

Start with the complete pinned workspace and installed web dependencies from [SETUP.md](SETUP.md). The shared source is bundled into the Convex backend and frontend outputs; deployed browsers and TVs do not fetch engine source at runtime.

Environment configuration is documented by the [web repository](https://github.com/SamFeltip/stockmarket.js/blob/main/ENVIRONMENT.md) and [TV repository](https://github.com/SamFeltip/stockmarket-tv/blob/master/ENVIRONMENT.md). There is no parent env file; CLI/CI variables are supplied to the relevant project's command.

## Production web and backend

The current frontend is <https://stockmarket.samfelton.com> (Pages alias <https://stockmarket-convex.pages.dev>), using <https://effervescent-flamingo-244.convex.cloud>.

The deployment commands require access to the existing Convex project and Cloudflare Pages project. From `stockmarket-convex`, authenticate with `npx convex login` and `npx wrangler login` on a new machine; verify Cloudflare access with `npx wrangler whoami`. CLI configuration is local to the machine, not part of Git.

From the workspace root:

```sh
npm run deploy --prefix stockmarket-convex
```

This runs all web quality checks, deploys Convex and rebuilds the frontend against the production backend URL, then uploads `dist` to the `stockmarket-convex` Pages project on branch `main`. Each step must pass before the next runs. Wrangler performs the existing Pages direct upload.

For separate steps, always deploy the backend and build first:

```sh
npm run deploy:backend --prefix stockmarket-convex
npm run deploy:frontend --prefix stockmarket-convex
```

The frontend command uploads only. A plain development `npm run build` uses `.env.local` and must not replace the production bundle. Production signing keys already exist; only initialize keys with `node scripts/init-auth.mjs --prod` when configuring an entirely new production deployment.

For validation without applying a backend deployment:

```sh
(cd stockmarket-convex && npx convex deploy --dry-run --yes --typecheck enable)
(cd stockmarket-convex && VITE_CONVEX_URL=https://effervescent-flamingo-244.convex.cloud npm run build)
```

Convex dry-run skips its build hook, so the explicit build is separate. Check live sign-in, lobby creation/joining, trading and period progression after publishing. [Release verification](RELEASE_VERIFICATION.md) records the previous automated and live checks and their limits.

If configuring Git-connected Pages builds, use this parent repository with submodules initialized, root directory `stockmarket-convex`, output `dist`, and build command `npx convex deploy --cmd 'npm run build' --cmd-url-env-var-name VITE_CONVEX_URL`. Provide a production `CONVEX_DEPLOY_KEY` through hosting secrets. A checkout of the web repository alone lacks the shared engine. The existing direct-upload workflow does not require changing hosting configuration.

## TV build

Deploy compatible backend changes before distributing a TV update. Configure both TV environment URLs for the same intended backend and phone frontend, as described in [setup](SETUP.md#tv-browser-development). Environment changes require rebuilding the bundled assets.

```sh
npm test --prefix stockmarket-tv
npm run build --prefix stockmarket-tv
# Requires the Android toolchain described in the TV README:
npm run android:debug --prefix stockmarket-tv
```

The TV repository's `Verify TV Android build` GitHub Actions workflow also tests, builds a debug APK, runs Android lint and compares all bundled web assets byte-for-byte against `dist`. Debug builds are for testing; store signing, submission materials and device installation belong to the TV project's [publishing](https://github.com/SamFeltip/stockmarket-tv/blob/master/PUBLISHING.md) and [private installation](https://github.com/SamFeltip/stockmarket-tv/blob/master/PRIVATE_INSTALL.md) guides. Release signing files are not in Git. Preserve the existing signing identity for updates.

The shared/headless packages have no service to deploy. The original Go project is independent of these releases.
