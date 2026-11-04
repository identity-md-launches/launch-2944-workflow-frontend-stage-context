# SqueekRaider frontend validation

The latest export synchronization revision is documented in [REVISION-VALIDATION.md](REVISION-VALIDATION.md). The implementation review and browser measurements below are retained from the earlier delivery; they were not repeated successfully on this revision's worker. The latest report records the rebuilt export and the browser runtime failures explicitly.

Worker validation of source in `web/` and the static export in `dist/`. This report is evidence of checks performed by this worker, not an independent audit or certification. No transaction was broadcast. Publication, IPFS naming/CID checks and the control plane's later checks have not run in this assignment.

## Scope and approved requirements

| Requirement | Implementation and evidence |
| --- | --- |
| Static Sepolia test-network game, no analytics, four hash routes | Vite/React/TypeScript; relative base; Raid, My Squeeks, Leaderboards and How it works. All pages label Sepolia TEST NETWORK and no prizes. Coinbase telemetry is disabled. |
| Deployment-bound runtime configuration | The app fetches `dist/imd-deployment.json`, verifies/loads its referenced ABI, and derives its chain and RPC settings there. Exact handed-off identifiers and contract set, no independent application address map. |
| Source/ABI integrity | Deployed source commit `c11eb28c4e8c355e422cc5d2e2feb2f26107e912`; `docs/abi/SqueekRaider.json` and `RaiderCard.json` matched the pinned Git bytes. Canonical SqueekRaider ABI Keccak: `1c4327160f223a420585435e30f95ad10b36d6bea2652b737c831e333bd6de2c`. |
| Raid observability | On-chain bossSVG/HP, tier, season, previous run work, party counts/power, nap/move arming, cover, round lag and block/time; live `/v1/status` sensor state with stale/unavailable handling. |
| Bounded, coherent reads | Each game snapshot uses one normal-CALL Multicall3 eth_call: advance(128) followed by views. Explicit Advance writes 64. Preview state is described as ephemeral. |
| Wallet inventory including staking | Paged Squeekchain account API, ownerOf and depositor confirmation, contract cards, real `metadata.imageDataUri`, costs/counters/KO/level/score/pending changes. Manual IDs recover from API failure. |
| Free demo and real Squeek play | Deterministic demo registration; level caps 3/5. All primary actions below have controls. |
| Real and demo leaderboards | IDs from Enlisted events; exact `scoreOf`/`seasonScoreOf`; boss/season and Squeek/current-wallet modes; demos separated. No seeded players. |
| Event observability | Creation boundary discovered/validated from historical code; logs from that block in ranges ≤10,000, confirmed cursor/hash cache, reorg invalidation, volatile 12-block tail re-read. |
| Rules | Plain explanation of Wheel/Burrow, stances/rewards, 18-round move, real guard cover, pending timing, cooldown, costs, KO cancellation without upgrade refund, free rest, boss scaling, no prizes and no admin. |
| Wallet connection | Named EIP-6963 extensions, four mobile wallet-browser links, Coinbase Smart Wallet, reconnect/disconnect, wrong-chain lock and switch/add/switch fallback with exact supplied parameters. |
| Accessible responsive entry | Live export inspected at 320, 390 and 1440; all routes also tested at 768 with huge counters. Wallet and Play free fit the first 390×844 screen. Labels, keyboard paths, visible focus, native dialog, reduced motion, metadata/favicon/share image. |
| Delivery scope | Only web/, dist/ and docs/ are delivered. `docs/DESIGN.md` substitutes for the requested root location because the overriding path budget prohibits creating a root file. No contracts, lib, root configuration or workflows changed. |

No poolKey is present in the supplied handoff: this is an application-contract game without a token or pool. Swap, quote, allowance and liquidity controls are not applicable. The network's Uniswap block is copied unchanged, without using it or inventing addresses. There are no owner settings to configure.

## Primary actions

| Contract action | Page/control | Worker interaction coverage |
| --- | --- | --- |
| `enlistDemo(stance)` | Raid / Play free | Chosen stance, simulation, mocked wallet send, pending lock, receipt and refresh |
| `enlist(ids,stance)` | My Squeeks / selected batch; individual Guard enlist | Exact batch and stance encoded, zero Scrap context, receipt |
| `setStance(ids,stance)` | My Squeeks / batch | Staked controller confirmation, selected stance and IDs, receipt |
| `upgrade(id)` | Raider card / cost-labelled button | Scrap gate, pending/cap gate, exact call and receipt |
| `revive(id)` | KO card / 20 Scrap | KO/Scrap gates, exact call and receipt |
| `rest(ids)` | Rest all, individual rest, maintenance | Six-Burrow cohort eligibility, all API pages enumerated, exact seven-ID batch, receipt |
| `poke(ids)` | Card / checkpoint; maintenance | Exact array encoding and receipt, credit-backlog guidance |
| `bury(id)` | Permissionless maintenance | State read prerequisite, single real ID, destructive confirmation, decoded NotBurned revert, no broadcast on failure |
| `advance(maxRounds)` | Raid / Advance | Write explicitly encodes 64; read snapshots encode 128 |

Every write verifies the chain/code again, simulates with the real caller, rechecks account/network before the wallet request and waits for its receipt. Writes are disabled for missing/stale state, missing verification, wrong chain or relevant game prerequisites. Failed receipt retrieval stays in an unverified/locked state. Reverted or canceled/replaced transactions do not report game success.

## Commands and results

The final build and test summaries, asset measurements and hashes are recorded in `frontend/check-summary.json`. Source tests are delivered in `web/tests/`; their raw transient reports/traces are in `test/scratch/` and are not delivery dependencies.

- `npm ci --prefix web --cache /tmp/squeekraider-npm`: dependencies installed from public npm, with cache outside the repository. The lockfile is delivered. No node_modules/cache/archive is part of the submission.
- `npm run typecheck --prefix web`: passed (`tsc --noEmit`).
- `npm run build --prefix web`: passed, including typecheck, Vite production export and manifest generation. Upstream Rollup pure-annotation notices were nonfatal; no missing local runtime asset was observed.
- `npm run check:export --prefix web`: passed exact handoff/network/ABI checks and a fresh file inventory comparison.
- `npm test --prefix web`: Chromium and WebKit, with every transaction/signing/RPC response mocked. The full suite passed 48/48. After the final rank-column CSS correction, responsive and accessibility cases passed again on both engines; exact counts are in the machine-readable summary. The suite covers primary actions, wallet rejection, switch/add/switch, network events, ownership/staking, costs/caps/pending/KO gates, lookup recovery, fallback RPCs, phone wallet links, ABI tampering, ranking separation, huge values/reflow, skip-link routing, and axe scans.
- `node web/scripts/live-check.mjs`: read-only Sepolia verification passed. See `frontend/live-check.json`: chain 11155111, 24,542-byte deployed game code, successful deployment receipt at block 12,059,712, nonempty Multicall3/renderer code, exact constructor dependencies and one successful advance-before-views call. Public source RPC: `https://ethereum-sepolia-rpc.publicnode.com`.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/squeekraider-browsers IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`: measured the production export at 320, 390 and 1440, and reduced motion. 15/16 checks passed. The sole failed check was the expressly required capitalized “TEST NETWORK” notice; it remains by brief precedence, not as an unexplained design defect. A portable sanitized copy is `frontend/taste.json`.

WebKit initially lacked shared libraries and an EGL vendor configuration. Browser dependencies were downloaded/extracted under `/tmp`, using the public Ubuntu package when an optional ESM endpoint returned 401. The final WebKit checks used the extracted libraries and software EGL. This changed no repository/system build configuration and no browser/dependency archive is delivered. Chromium and WebKit emulation are not physical phone or native wallet validation.

Initial test scaffolding issues (select-label matching, constant-block receipt fixtures, Poke's array expectation, and pressing Tab before runtime configuration loaded) were corrected. They were not masked with skipped tests. The final summary reports only the completed final suite.

## Better Interface consolidated review

Design idea: a quiet night-time raid board, carried by the prescribed pixel hamster and the on-chain owl, with the health bar and play control immediately available.

| Domain | Coverage | Limitations |
| --- | --- | --- |
| Accessibility | Checked native links/buttons/selects/labels, names/roles, skip path, native modal trap/close/focus return, disabled/pending states, status text, visible keyboard focus, 44px transaction buttons, forced-colors CSS, axe checks across all routes and wallet dialog | No screen-reader session, native 200% zoom, physical-device or OS forced-colors session; axe is not proof of complete compliance |
| Layout | Checked live screenshots at 320/390/1440, all routes at 320/390/768/1440 with large bigint counters/full addresses, wallet dialog at 390, shared margins and grouping, action within the first phone screen | English only; no translated/RTL interface was requested or manually tested |
| Writing | Checked action labels vs calls, Scrap prices/units, empty/loading/error/retry copy, controller explanations, honest stale/API/cache states, timing/no-refund/no-prizes rules | Live service outages and wallet vendor messages can differ from mocked cases |
| Typography | Checked five-role size scale, three weights, title dominance, input 16px floor, wraps/measure, tabular values and readable long IDs | System font availability varies; no custom font loading is claimed |
| Colors | Measured actual text/background pairs and probe contrast; all measured pairs met the probe thresholds. Plain text accompanies KO/pending/cover/errors | Contract illustrations and wallet marks were not exhaustively contrast-measured |
| UI | Checked neutral/primary controls, hover/focus/pressed/disabled/loading/error/empty states, border/tonal hierarchy, native dialog, metadata, static pixel art and reduced-motion behavior | No live passkey enrollment, real extension transaction or device app-link launch |

### Findings, fixes and rechecks

Locations point to the final source and the shared root cause, not generated bundles.

| Severity / domain | Source and observed problem | Correction and recheck |
| --- | --- | --- |
| High / privacy | `web/src/config.ts:140`: default Coinbase SDK preference loaded its telemetry host during the first probe, contrary to “no analytics” | Set `preference.telemetry:false`. Both browser suites assert no analytics host request; final live/probe network record omits it. |
| High / accessibility | `web/src/App.tsx:1511`: `href="#main"` could be interpreted as a game hash route | Prevent navigation, focus/scroll the existing main. Final skip-link tests run with the loaded app and preserve `#/raid`. |
| High / correctness | `web/src/App.tsx:672`: unregistered demo storage has `isDemo=false`, so filtering by the unset field could display its huge ID as a real NFT | Filter deterministic demo IDs by bit 255 and require enlistment. Fixtures reproduce unset demo flags. Browser tests render the free-play state without a fake real NFT. |
| Medium / writing | `web/src/App.tsx:298`: a zero Burrow streak before the first observed Wheel implied “wheel turning” | Display “No observed move yet” unless observed history/arming supports a move. Rechecked on the actual freshly anchored deployment and final screenshots. |
| Medium / layout | `web/src/styles.css:1082` (mobile free-play rule): `align-self:start` shrank the free-play surface on the stacked layout | Mobile sets `align-self:stretch`. Final 390 screenshot shows the shared outside edge, and measured scroll width equals viewport. |
| Medium / functionality | `web/src/App.tsx:1444`: rest eligibility derived only from the visible inventory page | Rest-all query enumerates all pages, reads groups of 48, confirms current controllers and submits at most 64 eligible IDs. Both engines test a seven-ID wallet spanning two pages, plus previous/next navigation. |
| Medium / transaction safety | `web/src/transactions.tsx:65`: a generic receipt RPC failure could release a retry, and a canceled replacement could be mistaken for game success | Unknown receipts remain locked with Check receipt; receipt status and replacement reason are checked. Pending-through-receipt is interaction-tested; real replacement and long outage paths remain unbroadcast/source-reviewed. |
| Medium / state clarity | `web/src/App.tsx:867`: permissionless maintenance originally validated only ID syntax | Check IDs now reads raider state and gates controls on successful reads; the bury test exercises a decoded burn-check refusal. |
| Medium / typography | `web/src/styles.css:1197` (mobile rank column): the 44px column made “Rank” wrap in the populated 390px ranking screenshot | Increased the column to 56px so the full label fits. Re-ran responsive and accessibility checks on both engines and replaced the mocked screenshot. |
| Brief exception | `web/src/App.tsx:1532` (network strip): probe rejects all-caps content | Keep exact required “TEST NETWORK”. No tracked capital kicker or repeated slogan system was introduced. |

Final applicable findings were repaired. The remaining probe exception and unperformed checks are explicit. `docs/DESIGN.md` records the actual tokens, typography, components and responsive behavior.

## Rendered evidence

- `frontend/raid-390.png`: live Sepolia/API data, 390×844. Product, wallet, owl/HP and Play free are visible. Play free was measured at y=694.39–738.78; wallet y=16–60; scroll width 390.
- `frontend/raid-320.png`: live 320px reflow, two-row navigation; scroll width 320. No clipping of critical values is used to obtain this result.
- `frontend/raid-1440.png`: live desktop arrangement and visible returned wallet focus ring.
- `frontend/wallet-390.png`: live disconnected desktop-browser wallet list at phone width, bottom-sheet geometry x=0, y=567, width=390, bottom=844. Native focus initially lands on Close. The four actual phone-browser choices are separately exercised with a mobile user agent and no injected provider.
- `frontend/squeeks-mocked-390.png` and `frontend/leaderboards-mocked-390.png`: explicitly mocked populated states captured by the browser suite; not evidence of real ownership, earned rewards or real players.

Measured rendered contrast: primary text/page 16.13:1; secondary text/page 9.53:1; secondary text/surface 8.57:1; main action text/fill 12.63:1. Live browser console contained no script errors; no local resource failures were found. The externally supplied API and RPC remain runtime availability dependencies.

## Limits and completion

The worker builds and checks the frontend; it does not deploy, audit, publish source, name an IPFS site or establish a fixed CID. No real free-play, NFT action, funded wallet, ETH payment, passkey enrollment, wallet app-link launch or transaction replacement was broadcast/executed on the live chain. Read-only live calls do not certify those behaviors. Contract-level economics and security testing belong to the pinned deployed implementation and prior stages, which this assignment preserves.

A nap in a simulated preview can precede its persisted event history; until observed history or the armed flag confirms it, the interface conservatively withholds an unobserved move. Rest-all requires a working complete account API and event history; the UI identifies failures and offers individual lookup/maintenance instead. Public historical code/log access is needed to reconstruct the creation boundary and rankings. Pending receipt UI is in-memory across hash routes; after reloading, the wallet/explorer remains the source for any uncertain transaction.

Complete for the frontend/source/export scope with the documented path-precedence exception and live/manual limitations, subject to the final check summary. This is the worker's report only. The verifier's path/byte checks do not independently certify browser behavior.
