# SqueekRaider frontend

A dark, mobile-first, static React/TypeScript interface for the deployed SqueekRaider game on Sepolia. Routes are `#/raid`, `#/squeeks`, `#/leaderboards`, and `#/rules`. There is no backend, site analytics, token, pool, approval, swap, admin, or NFT custody flow. Scrap, Dreams and scores are game counters; writes use the visitor's Sepolia ETH for gas.

## Install, build and preview

Use Node 22.12+ and npm. From the repository root:

```sh
npm ci --prefix web --cache /tmp/squeekraider-npm
npm run typecheck --prefix web
npm run build --prefix web
npm run check:export --prefix web
node web/scripts/serve.mjs
```

The last command serves the committed `dist/` at `http://127.0.0.1:4185/preview/`, deliberately under a subpath. `npm run dev --prefix web` prepares runtime configuration and ABIs before starting Vite. `npm run preview --prefix web` also previews the export. Build output goes directly to repository-root `dist/`; Vite uses `base: './'`. Publish that directory as plain files, without rewrites. No published URL or IPFS CID is needed to build or run it.

All frontend dependencies, lockfile and build configuration are in `web/`. `web/node_modules/`, generated development files and caches are excluded. The only changed ignore file is `web/.gitignore`, explicitly budgeted as one file, less than 1 KiB; its directory patterns apply recursively inside `web/`. No registry, dependency archive or package cache is delivered.

## Deployment binding and configuration

`dist/imd-deployment.json` is the application's runtime deployment configuration. `src/config.ts` fetches it relative to the current document, loads each referenced ABI, and verifies the canonical Keccak hash before rendering game controls. It builds the network and wallet configuration from that same manifest. There is no independent application address, chain or ABI map in the bundle.

Build inputs are preserved in `deployment/handoff.json` and `deployment/network.json`; they are build-time records, not alternate runtime configuration. `scripts/manifest.mjs` reads implementation-derived ABI arrays from `../docs/abi/`, checks their canonical hashes against the handoff and, when the Git object is available, checks their exact bytes at deployed source commit `c11eb28c4e8c355e422cc5d2e2feb2f26107e912`. Both SqueekRaider and its child RaiderCard ABI exports are retained. The manifest's contract set contains exactly the handed-off SqueekRaider, not an invented independent renderer deployment.

After Vite builds, that script emits the ABIs and final manifest, copies identifiers and network objects unchanged, and inventories every other exported file with lowercase SHA-256. `--check` independently inventories the export again and compares all configuration and ABI bindings. This handoff is `evm_contracts`, with no pool key, token or pool; the supplied network's Uniswap addresses are preserved but unused.

`src/config.ts` also centralizes the approved Squeekchain API, public workflow RPC fallbacks, and the standard Multicall3 address from viem's Sepolia definition. Application dependency addresses come from `core()`, `nft()`, `staking()` and `renderer()` at runtime. Before writes, the client verifies the RPC chain ID and nonempty application/Multicall3 code again. This verifies presence and ABI binding; it is not a new independent contract audit.

RPC order is the supplied network's PublicNode, ethpandaops and Sentio URLs, followed by the workflow's dRPC and Tenderly endpoints. A connected wallet on Sepolia is the last read fallback. No private endpoint, credential, project ID or relay is used. A source outage produces an explicit read error and stale state disables writes.

## Wallets and actions

The first-screen Connect control lists EIP-6963 extensions by their names and icons, hides the duplicate generic provider, and includes Coinbase Wallet. A phone without an injected wallet offers MetaMask, Coinbase Wallet, Rabby and Phantom browser links, then Coinbase Smart Wallet. Coinbase SDK telemetry is explicitly disabled. There is no WalletConnect relay. Unknown-chain errors cause `wallet_addEthereumChain` with the handoff network's exact parameters, followed by another switch. Wrong-chain state remains visible and writes stay disabled.

Free play calls `enlistDemo`. My Squeeks includes enlist, batch stance selection, upgrade, revive, free rest and Poke. Permissionless maintenance also exposes Poke, rest and confirmed Bury for a single burned real NFT. Costs and eligibility are shown before signing. All writes are simulated with the actual wallet account; the account/network are checked again before sending. Only the active action gets a pending label, while a submission lock prevents conflicting writes. Receipt success triggers refreshed state. An unverified receipt remains locked with an explorer link and a Check receipt control; reverted/canceled/replaced transactions do not report a successful game change.

The wallet sheet uses native modal focus trapping, Escape/backdrop closing and focus return. Full checksummed addresses, copy controls and explorer links are available in wallet/contract details. Transaction progress remains available while changing hash routes. Pending transaction UI is held in memory; after a reload, check the wallet/explorer before resubmitting an uncertain action.

## Reads, inventory and rankings

Each game snapshot is one `aggregate3` **eth_call**, using normal CALL semantics: `advance(128)` first, then the state views. Card artwork loads separately, one render per call, so an expensive or failed render does not block game state or actions. Nothing from that preview is broadcast or persisted. The Advance control sends `advance(64)`. The lag display is `liveRound - preview processedThrough`, including the live round. State and sensor status refresh every 15 seconds; the event index refreshes every minute. Reads can still be behind after a bounded advance, and the displayed cursor makes this visible.

The hamster feed uses `/v1/status` and its measurement `coreStatus`, freshness and observation time. Sensor state can lead settled game state. An unobserved pre-anchor move is never presented as Frenzy. API failures and stale readings are identified.

Wallet inventory is fetched from `/v1/accounts/{address}` in pages of six, then confirmed using NFT `ownerOf` and staking `depositor`. Cards show stance, KO, level, Scrap, Dreams, score, trophies, credit backlog and pending changes. Real Squeek `metadata.imageDataUri` comes from `/v1/squeeks/{id}` and appears within the on-chain card frame; demo art comes from `cardURI`. Missing artwork is identified rather than replaced by a made-up Squeek. Unregistered deterministic demos are not treated as real NFTs.

Rest all independently enumerates every inventory API page, confirms current controllers through the game, checks KO cohort history and settled Burrows, and offers eligible IDs in batches of at most 64. Larger wallets repeat the explicitly counted batch after its receipt. API failure disables this aggregate path; individual ID lookup/maintenance remains available with on-chain simulation.

The event index discovers the actual creation block from the runtime address using historical code reads (and validates/caches the boundary). The observed deployment boundary is 12,059,712. Log requests cover at most 10,000 blocks, shrinking the range if necessary. The cache is keyed by chain/address and the confirmed cursor's block hash; a reorg clears it and the last 12 blocks are always re-read. Disabled/full storage falls back to in-memory indexing. This path requires an RPC with historical code and log access. A failed scan is shown as incomplete, never as a complete empty leaderboard.

Enlisted events discover IDs. Leaderboards query `scoreOf` or `seasonScoreOf`, not sums of lazy credit logs; demo and real entries are separate. Wallet standings aggregate current controllers, including staking depositors. KO cohort events and inclusive idle ranges reconstruct free-rest eligibility. All IDs, amounts, rounds and scores stay bigint; only bounded percentages are converted to Number. HP uses the contract's 1/10,000 units.

## Validation

```sh
# Install the test browsers; a normal host also needs Playwright's Linux system dependencies.
cd web
npx playwright install chromium webkit
npx playwright install-deps chromium webkit
npm test
# Optional screenshots from the explicitly mocked populated states:
CAPTURE_EVIDENCE=1 npm test
cd ..
node web/scripts/live-check.mjs
node web/scripts/manifest.mjs --check
```

The browser suite manages its subpath preview and mocks every wallet/RPC write. It does not sign or broadcast a real transaction. `live-check.mjs` performs read-only Sepolia checks and writes `docs/frontend/live-check.json`. The tests put disposable output in `test/scratch/`. On restricted hosts, browser caches/libraries can live in `/tmp`; they are not frontend deliverables.

See [validation and limitations](../docs/FRONTEND-VALIDATION.md), [implemented design](../docs/DESIGN.md) and [evidence](../docs/frontend/). Published CID/naming and control-plane verification happen after worker submission and are not claimed here.

## Attribution

The pinned Better Interface and Impeccable guides informed the implemented design and documentation; their combined license is in `docs/frontend/DESIGN-LICENSE`. The pinned ethskills frontend/security references are attributed in `ETHSKILLS-LICENSE`. Wallet marks are copied from RainbowKit's official wallet connector assets under its MIT license (`WALLET-MARKS-LICENSE`). Rabby's browser link follows its official `rabby-mobile` universal link handler (`_cmd=open-dapp&dapp=…`). Wallet service behavior on real phones/passkeys remains a manual integration check.
