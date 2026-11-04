# Static export synchronization revision

Finding `bbd8f24ca4f5b669465e0b591751d47cc2082ef4b22aa81615faef04e39fd5d3` reproduced: the delivered HTML loaded `assets/index-D7hgpSRp.js`, which omitted the corrected read-timeout message present in `web/src/errors.ts`. The accepted source corrections had not been built into the delivered site.

Rebuilt with the existing lockfile and build pipeline. The final HTML loads `assets/index-DDK-psNm.js`, which contains `The request timed out. Refresh to retry.` Vite's existing `emptyOutDir: true` removed the old bundles before exporting. No application source, contract, dependency version, wallet configuration, or design token changed. Added one browser regression for an account-fetch `TimeoutError`, and corrected the README's description of separate card reads.

## Export and build evidence

| Check | Result |
| --- | --- |
| `cd web && npm ci --cache ../test/scratch/npm-cache` | Passed with the committed lockfile; no cache or dependency directory is delivered |
| `npm run build --prefix web` | Passed: TypeScript, Vite and manifest generation; upstream pure-annotation notices were nonfatal |
| `npm run typecheck --prefix web` | Passed again after the build |
| `npm run check:export --prefix web` | Passed: all 16 asset hashes, ABI binding, exact deployment identifiers and configuration |
| Pinned inputs | `cmp` confirmed the build handoff and network files match `.imd/reads/` exactly; the manifest script verified implementation ABI bytes at source commit `c11eb28c4e8c355e422cc5d2e2feb2f26107e912` and canonical Keccak |
| Worker HTTP inventory check | Passed at `/preview/`: every declared asset served with its declared SHA-256; the HTML's actual entry contained the corrected timeout message; the old entry returned 404 |
| `node web/scripts/live-check.mjs` | Passed read-only Sepolia checks; refreshed `frontend/live-check.json`, including nonempty game/renderer/Multicall3 code, deployment receipt, immutable dependencies and advance-before-views |

The 16 exported assets total **1,516,535 bytes**, excluding the manifest. The manifest SHA-256 is `1507e8c892888e1202f81858b2f8176bbd93a405bf8c4bda8904fcfd734df302`. The manifest excludes itself. The handoff contains no pool key; its exact contract set and the unchanged network/wallet-add-chain objects remain present. No real transaction was sent.

The worker's Git metadata is read-only: `git add` failed to create `.git/index.lock` with `Read-only file system`. No worker commit was created. The rebuilt export, documentation, regression and root finding-response file are present in the working tree for submission.

## Regression coverage and runtime limitation

The existing tests target the committed `dist/` through `web/scripts/serve.mjs`, rather than the Vite source server:

| Source correction now included in the export | Regression |
| --- | --- |
| `web/src/chain.ts:116`: required state excludes cardURI; `readCard` renders one card per separate call | Six Squeeks plus demo, and a failed renderer with enabled state-dependent actions |
| `web/src/App.tsx:1521`: Refresh retries both account inventory and rest-all enumeration | Restore failed account endpoint, Refresh, recover Squeek heading and clear API errors |
| `web/src/errors.ts:78`: read timeouts offer read recovery | Existing source-level timeout assertions; added browser test rejecting account fetch with a `TimeoutError`, requiring read-retry text and zero wallet sends |
| `web/src/App.tsx:1658`: shared status on Rules and Leaderboards | One mock transaction, route navigation, exactly one pending status and explorer link |

Ran `PLAYWRIGHT_BROWSERS_PATH=../test/scratch/browsers npm test` from `web/` against this exact export. **2 source-level tests passed; 58 browser-dependent tests failed at browser startup, before their interactions ran.** Chromium exits with SIGTRAP and reports `browserType.launch: Target page, context or browser has been closed`. WebKit reports missing shared libraries in the standard run. After extracting the required libraries and software EGL into disposable scratch storage, its smoke check launched but failed at `browser.newPage: Target page, context or browser has been closed`. The supplied browser tool also failed at Chromium initialization. These are worker runtime failures, not passing interaction results or reproduced application failures.

Ran the pinned probe from the repository root with `IMD_PLAYWRIGHT` pointing to the installed Playwright module:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" \
IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" \
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

It exited **2** at Chromium startup. No fresh screenshots, measured contrast, viewport observations, or passing taste checks are claimed for this revision. Earlier screenshots and probe results remain historical evidence only. Browser binaries, downloaded libraries, traces, logs and caches remain in disposable scratch storage and are not submitted.

## Better Interface review

Applied the pinned guide to the existing source and kept the accepted visual design. This revision's coverage is limited as follows:

| Domain | Source recheck | Rendered recheck |
| --- | --- | --- |
| Accessibility | Existing status announcements, native controls and disabled-action gates retained | Not verified: browser startup failed |
| Layout | Existing responsive rules and route structure unchanged | Not verified at 320/390/1440; no new first-screen claim |
| Writing | Read timeout recovery and contextual transaction messages included in the fresh bundle | Not verified in a browser |
| Typography | Accepted scale, weights and wrapping unchanged | Not verified |
| Colors | Accepted semantic tokens unchanged | No new rendered contrast measurements |
| UI | Shared pending status is included on every route; existing card loading/error states retained | Route interactions and state screenshots not verified |

The export mismatch at `web/package.json:9` is fixed by running its existing build and delivering the generated files. `docs/DESIGN.md` remains the applicable design record under the overriding path budget. Live signing, funded actions, physical wallets, screen-reader/native-zoom checks and publication remain untested. Export repair is complete; fresh browser validation remains incomplete because of the recorded worker runtime failures. Machine-readable results are in `frontend/revision-check-summary.json`.
