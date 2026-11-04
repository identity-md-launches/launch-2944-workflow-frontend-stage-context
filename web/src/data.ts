import { decodeEventLog, type Address, type Hex } from "viem";
import { API_BASE, DEMO_BIT, type Runtime } from "./config";
import {
  aggregate,
  ownerAbi,
  sameAddress,
  stakingAbi,
  safeImage,
} from "./chain";
import type { LiveStatus, Snapshot } from "./types";

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error("Squeekchain is unavailable. Retry or use a Squeek ID.");
  return response.json() as Promise<T>;
}
export const getLiveStatus = (signal?: AbortSignal) =>
  api<LiveStatus>("status", signal);
export interface AccountPage {
  tokens: { tokenId: string; custody: string }[];
  nextCursor: string | null;
  account: string;
  chain: { chainId: string };
}
export async function accountPage(
  runtime: Runtime,
  address: Address,
  cursor?: string,
  signal?: AbortSignal,
) {
  const page = await api<AccountPage>(
    `accounts/${address}?limit=6${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    signal,
  );
  if (
    Number(page.chain?.chainId) !== runtime.chain.id ||
    !sameAddress(page.account, address) ||
    !Array.isArray(page.tokens)
  )
    throw new Error(
      "Squeekchain inventory does not match this wallet and network.",
    );
  return page;
}
export async function confirmOwnership(
  runtime: Runtime,
  snapshot: Snapshot,
  ids: bigint[],
  address: Address,
) {
  if (!ids.length)
    return {} as Record<string, "wallet" | "staked" | "unverified">;
  const ownership: Record<string, "wallet" | "staked" | "unverified"> = {};
  for (let i = 0; i < ids.length; i += 64) {
    const group = ids.slice(i, i + 64);
    const values = await aggregate(
      runtime,
      group.flatMap((id) => [
        {
          key: `owner${id}`,
          name: "ownerOf",
          args: [id],
          address: snapshot.nft,
          abi: ownerAbi,
          optional: true,
        },
        {
          key: `depositor${id}`,
          name: "depositor",
          args: [snapshot.nft, id],
          address: snapshot.staking,
          abi: stakingAbi,
          optional: true,
        },
      ]),
      false,
    );
    for (const id of group) {
      const owner = values[`owner${id}`] as Address | undefined;
      const depositor = values[`depositor${id}`] as Address | undefined;
      ownership[String(id)] = sameAddress(owner, address)
        ? "wallet"
        : sameAddress(owner, snapshot.staking) &&
            sameAddress(depositor, address)
          ? "staked"
          : "unverified";
    }
  }
  return ownership;
}
export async function squeekArt(id: bigint, signal?: AbortSignal) {
  const value = await api<{ metadata?: { imageDataUri?: string } }>(
    `squeeks/${id}`,
    signal,
  );
  return safeImage(value.metadata?.imageDataUri);
}
export interface IndexedEvent {
  name: string;
  args: Record<string, string | boolean | number>;
  block: string;
  hash: Hex;
  tx: Hex;
  logIndex: number;
}
export interface EventIndex {
  events: IndexedEvent[];
  from: string;
  through: string;
  head: string;
  hash: Hex;
  complete: boolean;
}
interface StoredIndex {
  through: string;
  hash: Hex;
  events: IndexedEvent[];
}
const cacheKey = (runtime: Runtime) =>
  `squeekraider:events:v1:${runtime.chain.id}:${runtime.deployment.address.toLowerCase()}`;
export async function deploymentBlock(runtime: Runtime) {
  // Discover the actual creation boundary without another deployment/address map.
  // getCode at the supplied source deployment transaction would require an independently
  // maintained tx hash; binary search is fully derived from the runtime deployment address.
  const key = `${cacheKey(runtime)}:creation`;
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(key);
  } catch {
    /* Private browsing can disable storage. */
  }
  if (cached && /^\d+$/.test(cached)) {
    const block = BigInt(cached);
    const code = await runtime.client.getCode({
      address: runtime.deployment.address,
      blockNumber: block,
    });
    const before =
      block > 0n
        ? await runtime.client.getCode({
            address: runtime.deployment.address,
            blockNumber: block - 1n,
          })
        : undefined;
    if (code && code !== "0x" && (!before || before === "0x")) return block;
    try {
      localStorage.removeItem(key);
    } catch {
      /* Optional cache. */
    }
  }
  let low = 0n,
    high = await runtime.client.getBlockNumber({ cacheTime: 0 });
  while (low < high) {
    const middle = (low + high) / 2n;
    const code = await runtime.client.getCode({
      address: runtime.deployment.address,
      blockNumber: middle,
    });
    if (code && code !== "0x") high = middle;
    else low = middle + 1n;
  }
  try {
    localStorage.setItem(key, low.toString());
  } catch {
    /* Cache is optional. */
  }
  return low;
}
export async function indexEvents(
  runtime: Runtime,
  signal: AbortSignal,
  progress?: (text: string) => void,
): Promise<EventIndex> {
  const from = await deploymentBlock(runtime);
  const head = await runtime.client.getBlockNumber({ cacheTime: 0 });
  const safe = head > 12n ? head - 12n : 0n;
  const key = cacheKey(runtime);
  let stored: StoredIndex | undefined;
  try {
    stored = JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined;
    if (stored) {
      const block = await runtime.client.getBlock({
        blockNumber: BigInt(stored.through),
      });
      if (block.hash !== stored.hash || BigInt(stored.through) > safe) {
        stored = undefined;
        localStorage.removeItem(key);
      }
    }
  } catch {
    stored = undefined;
  }
  let events: IndexedEvent[] = stored?.events ?? [];
  let cursor = stored ? BigInt(stored.through) + 1n : from;
  let step = 10000n;
  while (cursor <= head) {
    signal.throwIfAborted();
    let end = cursor + step - 1n;
    if (end > head) end = head;
    // Keep a confirmed cache separate from the volatile tail, which is always re-read.
    if (cursor <= safe && end > safe) end = safe;
    progress?.(
      `Reading event blocks ${cursor.toLocaleString()}–${end.toLocaleString()}`,
    );
    let logs;
    try {
      logs = await runtime.client.getLogs({
        address: runtime.deployment.address,
        fromBlock: cursor,
        toBlock: end,
      });
    } catch (error) {
      if (step > 100n) {
        step = step / 2n;
        continue;
      }
      throw error;
    }
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: runtime.deployment.abi,
          data: log.data,
          topics: log.topics,
          strict: false,
        });
        const args = Object.fromEntries(
          Object.entries(decoded.args ?? {}).map(([k, v]) => [
            k,
            typeof v === "bigint" ? v.toString() : v,
          ]),
        ) as IndexedEvent["args"];
        events.push({
          name: String(decoded.eventName),
          args,
          block: String(log.blockNumber),
          hash: log.blockHash!,
          tx: log.transactionHash!,
          logIndex: log.logIndex!,
        });
      } catch {
        /* Other, non-ABI logs cannot be attributed to game events. */
      }
    }
    if (end <= safe) {
      const block = await runtime.client.getBlock({ blockNumber: end });
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ through: String(end), hash: block.hash, events }),
        );
      } catch {
        /* Quota/private browsing: keep in memory. */
      }
    }
    cursor = end + 1n;
  }
  const block = await runtime.client.getBlock({ blockNumber: head });
  return {
    events,
    from: String(from),
    through: String(head),
    head: String(head),
    hash: block.hash!,
    complete: true,
  };
}
export function indexFacts(index?: EventIndex) {
  const ids = new Set<string>();
  const restAt: Record<string, bigint> = {};
  let burrows = 0n,
    wheelSeen = false;
  for (const event of index?.events ?? []) {
    if (event.name === "Enlisted") ids.add(String(event.args.id));
    if (event.name === "RoundApplied") {
      if (event.args.wheel) wheelSeen = true;
      else
        burrows +=
          BigInt(String(event.args.throughRound)) -
          BigInt(String(event.args.fromRound)) +
          1n;
    }
    if (event.name === "KO")
      restAt[`${event.args.stance}:${event.args.epoch}`] = burrows;
  }
  return { ids: [...ids].map(BigInt), restAt, wheelSeen };
}
export interface ScoreRow {
  id: bigint;
  score: bigint;
  controller?: Address;
  isDemo: boolean;
}
export async function scores(
  runtime: Runtime,
  ids: bigint[],
  kind: "boss" | "season",
  period: bigint,
  signal?: AbortSignal,
): Promise<ScoreRow[]> {
  const result: ScoreRow[] = [];
  for (let i = 0; i < ids.length; i += 48) {
    signal?.throwIfAborted();
    const group = ids.slice(i, i + 48);
    const values = await aggregate(
      runtime,
      group.flatMap((id) => [
        {
          key: `score${id}`,
          name: kind === "boss" ? "scoreOf" : "seasonScoreOf",
          args: [period, id],
        },
        {
          key: `controller${id}`,
          name: "controllerOf",
          args: [id],
          optional: true,
        },
      ]),
    );
    group.forEach((id) =>
      result.push({
        id,
        score: values[`score${id}`] as bigint,
        controller: values[`controller${id}`] as Address | undefined,
        isDemo: id >= DEMO_BIT,
      }),
    );
  }
  return result.sort((a, b) =>
    a.score === b.score ? (a.id < b.id ? -1 : 1) : a.score > b.score ? -1 : 1,
  );
}
