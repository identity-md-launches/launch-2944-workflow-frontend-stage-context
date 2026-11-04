import type { Abi, Address, Hex } from "viem";
export interface Manifest {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: {
    name: string;
    address: Address;
    abiHash: string;
    abiPath: string;
  }[];
  network: {
    chainId: number;
    name: string;
    testnet: boolean;
    rpcUrls: string[];
    explorer: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    uniswapV4: Record<string, string>;
  };
  walletAddChain?: {
    chainId: Hex;
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };
  assets: { path: string; sha256: string }[];
}
export interface Deployment {
  manifest: Manifest;
  abi: Abi;
  address: Address;
}
export interface Pending {
  round: bigint;
  fromEpoch: bigint;
  from: number;
  to: number;
  level: number;
  kind: number;
}
export interface RaiderData {
  enlisted: boolean;
  isDemo: boolean;
  buried: boolean;
  stance: number;
  level: number;
  epoch: bigint;
  cursorBoss: bigint;
  lastStanceRound: bigint;
  checkpoint: { damage: bigint; scrap: bigint; dreams: bigint };
  scrap: bigint;
  dreams: bigint;
  damage: bigint;
  bossesSlain: bigint;
  pending: Pending;
}
export interface RaiderView {
  data: RaiderData;
  ko: boolean;
  caughtUp: boolean;
}
export interface Raider {
  id: bigint;
  view: RaiderView;
  controller?: Address;
  ownership?: "wallet" | "staked" | "unverified";
  art?: string;
  score: bigint;
  seasonScore: bigint;
}
export interface Boss {
  id: bigint;
  seasonId: bigint;
  tier: number;
  summonedAt: bigint;
  slainAt: bigint;
  previousRunWork: bigint;
  hpUnits: bigint;
  maxHpUnits: bigint;
  damageUnits: bigint;
}
export interface Snapshot {
  boss: Boss;
  persisted: bigint;
  processed: bigint;
  live: bigint;
  effective: bigint;
  genesis: bigint;
  anchored: boolean;
  lastRunWork: bigint;
  burrow: bigint;
  burrowTotal: bigint;
  move: readonly [number, bigint, boolean];
  cover: readonly [number, bigint, bigint, bigint, boolean];
  counts: bigint[];
  realCounts: bigint[];
  powers: bigint[];
  core: Address;
  nft: Address;
  staking: Address;
  renderer: Address;
  bossArt: string;
  block: bigint;
  time: number;
  raiders: Raider[];
  wheelSeen: boolean;
}
export interface LiveStatus {
  measurement?: {
    coreStatus?: string;
    freshness?: string;
    observedAt?: string;
    staleAfterSeconds?: number;
  };
  generatedAt?: string;
}
export type GameAction =
  | "advance"
  | "enlistDemo"
  | "enlist"
  | "setStance"
  | "upgrade"
  | "revive"
  | "rest"
  | "poke"
  | "bury";
