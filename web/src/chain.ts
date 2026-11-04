import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { MULTICALL, type Runtime } from "./config";
import type { Boss, Raider, RaiderView, Snapshot } from "./types";

export const multicallAbi = parseAbi([
  "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)",
  "function getBlockNumber() view returns (uint256 blockNumber)",
]);
export const ownerAbi = parseAbi([
  "function ownerOf(uint256 id) view returns (address)",
]);
export const stakingAbi = parseAbi([
  "function depositor(address collection,uint256 id) view returns (address)",
]);
export type Read = {
  key: string;
  name: string;
  args?: readonly unknown[];
  address?: Address;
  abi?: Abi;
  optional?: boolean;
};
export async function aggregate(
  runtime: Runtime,
  reads: Read[],
  advance = true,
) {
  const { address, abi } = runtime.deployment;
  const descriptors: Read[] = [
    ...(advance ? [{ key: "advance", name: "advance", args: [128n] }] : []),
    ...reads,
  ];
  const calls = descriptors.map((read) => ({
    target: read.address ?? address,
    allowFailure: read.optional ?? false,
    callData: encodeFunctionData({
      abi: read.abi ?? abi,
      functionName: read.name,
      args: read.args,
    }),
  }));
  const response = await runtime.client.call({
    to: MULTICALL,
    data: encodeFunctionData({
      abi: multicallAbi,
      functionName: "aggregate3",
      args: [calls],
    }),
    gas: 16_000_000n,
  });
  if (!response.data)
    throw new Error("The RPC returned no game state. Try Refresh.");
  const values = decodeFunctionResult({
    abi: multicallAbi,
    functionName: "aggregate3",
    data: response.data,
  });
  const result: Record<string, unknown> = {};
  descriptors.forEach((read, i) => {
    const value = values[i];
    if (!value.success) {
      if (!read.optional)
        throw new Error(`Unable to read ${read.name}. Try Refresh.`);
      return;
    }
    result[read.key] = decodeFunctionResult({
      abi: read.abi ?? abi,
      functionName: read.name,
      data: value.returnData,
    });
  });
  return result;
}
const baseNames = [
  "boss",
  "processedThrough",
  "liveRound",
  "effectiveRound",
  "GENESIS",
  "anchored",
  "lastRunWork",
  "burrowStreak",
  "totalBurrowRounds",
  "pendingMove",
  "cover",
  "core",
  "nft",
  "staking",
  "renderer",
] as const;
export async function readSnapshot(
  runtime: Runtime,
  ids: bigint[],
  cardIds: bigint[] = ids,
): Promise<Snapshot> {
  const reads: Read[] = baseNames.map((name) => ({ key: name, name }));
  reads.push({
    key: "block",
    name: "getBlockNumber",
    address: MULTICALL,
    abi: multicallAbi,
  });
  for (let s = 0; s < 4; s++)
    for (const name of ["aliveCount", "alivePower", "nonDemoCount"])
      reads.push({ key: `${name}${s}`, name, args: [BigInt(s)] });
  for (let tier = 0; tier < 3; tier++)
    reads.push({ key: `bossArt${tier}`, name: "bossSVG", args: [tier] });
  // A nap before the first observed Wheel has no move. Storage does not expose wheelSeen;
  // the event index resolves this later. Never label an unset default Frenzy as a real move.
  for (const id of ids) {
    reads.push({ key: `raider${id}`, name: "raider", args: [id] });
    if (cardIds.includes(id))
      reads.push({
        key: `card${id}`,
        name: "cardURI",
        args: [id],
        optional: true,
      });
    reads.push({
      key: `controller${id}`,
      name: "controllerOf",
      args: [id],
      optional: true,
    });
  }
  const v = await aggregate(runtime, reads);
  const boss = v.boss as Boss;
  const raiders: Raider[] = ids.map((id) => {
    const view = v[`raider${id}`] as RaiderView;
    return {
      id,
      view,
      controller: v[`controller${id}`] as Address | undefined,
      card: cardImage(v[`card${id}`]),
      score: view.data.damage + 300n * view.data.dreams,
      seasonScore: 0n,
    };
  });
  return {
    boss,
    persisted: v.processedThrough as bigint,
    processed: v.processedThrough as bigint,
    live: v.liveRound as bigint,
    effective: v.effectiveRound as bigint,
    genesis: v.GENESIS as bigint,
    anchored: v.anchored as boolean,
    lastRunWork: v.lastRunWork as bigint,
    burrow: v.burrowStreak as bigint,
    burrowTotal: v.totalBurrowRounds as bigint,
    move: v.pendingMove as Snapshot["move"],
    cover: v.cover as Snapshot["cover"],
    counts: [0, 1, 2, 3].map((s) => v[`aliveCount${s}`] as bigint),
    powers: [0, 1, 2, 3].map((s) => v[`alivePower${s}`] as bigint),
    realCounts: [0, 1, 2, 3].map((s) => v[`nonDemoCount${s}`] as bigint),
    core: v.core as Address,
    nft: v.nft as Address,
    staking: v.staking as Address,
    renderer: v.renderer as Address,
    bossArt: svgImage(v[`bossArt${boss.tier}`] as string),
    block: v.block as bigint,
    time: Date.now(),
    raiders,
    wheelSeen: false,
  };
}
export function svgImage(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export function safeImage(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^data:image\/(svg\+xml|png|webp|jpeg|gif);(?:base64,|charset=utf-8,)/i.test(
      value,
    ) &&
    value.length < 1_000_000
    ? value
    : undefined;
}
export function cardImage(value: unknown) {
  try {
    if (
      typeof value !== "string" ||
      !value.startsWith("data:application/json;base64,")
    )
      return;
    return safeImage(JSON.parse(atob(value.split(",")[1])).image);
  } catch {
    return undefined;
  }
}
export async function verifyCode(runtime: Runtime) {
  const chainId = await runtime.client.getChainId();
  if (chainId !== runtime.deployment.manifest.chainId)
    throw new Error("RPC network mismatch. Transactions are disabled.");
  for (const address of [runtime.deployment.address, MULTICALL]) {
    const code = await runtime.client.getCode({ address });
    if (!code || code === "0x")
      throw new Error(
        "Contract code is missing on the configured network. Transactions are disabled.",
      );
  }
  return true;
}
export function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
export function number(value: bigint | undefined) {
  return value === undefined ? "Unavailable" : value.toLocaleString("en-US");
}
export function hp(value: bigint) {
  const whole = value / 10000n,
    fraction = (value % 10000n) / 100n;
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction.toString().padStart(2, "0")}` : ""}`;
}
export function percent(current: bigint, total: bigint) {
  return total > 0n
    ? Math.min(100, Number((current * 10000n) / total) / 100)
    : 0;
}
export const sameAddress = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export function validIds(input: string, allowDemo = true): bigint[] {
  const parts = input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!parts.length || parts.length > 64 || parts.some((p) => !/^\d+$/.test(p)))
    throw new Error(
      "Enter 1 to 64 whole-number Squeek IDs, separated by commas.",
    );
  const ids = parts.map(BigInt);
  if (ids.some((id) => id < 0n || id >= 1n << (allowDemo ? 256n : 255n)))
    throw new Error("An ID is outside the allowed range.");
  if (new Set(ids.map(String)).size !== ids.length)
    throw new Error("Remove duplicate Squeek IDs.");
  return ids;
}
export type { Hex };
