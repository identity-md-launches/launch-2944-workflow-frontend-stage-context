import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeErrorResult,
  encodeEventTopics,
  encodeAbiParameters,
  parseAbi,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import type { Page } from "@playwright/test";

// Explicit test fixtures only. No wallet keys, signing, funding or real broadcasts.
export const handoff = JSON.parse(
  readFileSync(resolve("deployment/handoff.json"), "utf8"),
);
export const abi = JSON.parse(
  readFileSync(resolve("../docs/abi/SqueekRaider.json"), "utf8"),
) as Abi;
export const game = handoff.contracts[0].address as Address;
export const account = "0x598958abf7d8db8dd468cb53dd6ba705581bff54" as Address; // observed Squeek #1 holder, impersonated only in the mock provider
export const dependencies = handoff.manifest.contracts[0].constructorArgs;
export const DEMO = 1n << 255n;
export const demoId = DEMO | BigInt(account);
export const hash = ("0x" + "11".repeat(32)) as Hex;
const blockHash = ("0x" + "22".repeat(32)) as Hex;
const renderer = "0x65d7deD74114466F630edA1C159faA0DC71D3e0C"; // observed renderer, test fixture only
const mcAbi = parseAbi([
  "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)",
  "function getBlockNumber() view returns (uint256)",
]);
const ownershipAbi = parseAbi([
  "function ownerOf(uint256) view returns (address)",
  "function depositor(address,uint256) view returns (address)",
]);
const image = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42"><rect width="32" height="42" fill="#333b5c"/><rect x="2" y="3" width="28" height="25" fill="#191b31"/><circle cx="16" cy="15" r="8" fill="#E8C08A"/></svg>').toString("base64")}`;
const card = `data:application/json;base64,${Buffer.from(JSON.stringify({ image })).toString("base64")}`;
export interface Options {
  chain?: string;
  noInjected?: boolean;
  unenlisted?: boolean;
  failPrimary?: boolean;
  unknownChain?: boolean;
  rejectConnect?: boolean;
  enlistedDemo?: boolean;
  ko?: boolean;
  lowScrap?: boolean;
  revert?: string;
  missingCode?: boolean;
  rpcFail?: boolean;
  inventoryFail?: boolean;
  staked?: boolean;
  pending?: boolean;
  level?: number;
  receiptDelay?: number;
  huge?: boolean;
  apiSecondPage?: boolean;
}
export async function mockApp(page: Page, options: Options = {}) {
  const requests: { method: string; params: unknown[] }[] = [];
  const calls: { name: string; args: readonly unknown[] }[] = [];
  const sent: { data: string; to: string; value?: string }[] = [];
  const ranges: { from: bigint; to: bigint }[] = [];
  let receiptChecks = 0;
  const urls: string[] = [];
  const state = { demo: options.enlistedDemo ?? false, options };
  await page.addInitScript(
    ({ account, options }) => {
      const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
      let chain = options.chain ?? "0xaa36a7",
        known = !options.unknownChain,
        connected = false;
      const walletRequests: { method: string; params: unknown[] }[] = [];
      const provider = {
        on: (event: string, fn: (...args: unknown[]) => void) => {
          (handlers[event] ??= []).push(fn);
        },
        removeListener: (event: string, fn: (...args: unknown[]) => void) => {
          handlers[event] = handlers[event]?.filter((f) => f !== fn) ?? [];
        },
        request: async ({
          method,
          params = [],
        }: {
          method: string;
          params?: unknown[];
        }) => {
          walletRequests.push({ method, params });
          if (method === "eth_accounts") return connected ? [account] : [];
          if (method === "eth_requestAccounts") {
            if (options.rejectConnect)
              throw Object.assign(new Error("User rejected request"), {
                code: 4001,
              });
            connected = true;
            return [account];
          }
          if (method === "eth_chainId") return chain;
          if (method === "wallet_switchEthereumChain") {
            if (!known)
              throw Object.assign(new Error("Unknown chain"), { code: 4902 });
            chain = (params[0] as { chainId: string }).chainId;
            for (const fn of handlers.chainChanged ?? []) fn(chain);
            return null;
          }
          if (method === "wallet_addEthereumChain") {
            known = true;
            return null;
          }
          if (method === "eth_sendTransaction") {
            (window as any).__sent.push(params[0]);
            return "0x" + "11".repeat(32);
          }
          if (method === "wallet_getCapabilities") return {};
          if (method === "wallet_requestPermissions") return [];
          if (method === "wallet_revokePermissions") return null;
          throw new Error("Unexpected wallet request " + method);
        },
      };
      (window as any).__walletRequests = walletRequests;
      (window as any).__sent = [];
      if (!options.noInjected) (window as any).ethereum = provider;
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "f0888b11-0aaf-40a0-8d2b-3da43b5c3b2b",
                name: "Test browser wallet",
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                rdns: "test.squeekraider.wallet",
              },
              provider,
            },
          }),
        );
      if (!options.noInjected) {
        window.addEventListener("eip6963:requestProvider", announce);
        announce();
      }
      (window as any).__wrongChain = () => {
        chain = "0x1";
        for (const fn of handlers.chainChanged ?? []) fn(chain);
      };
      (window as any).__changeAccount = () => {
        for (const fn of handlers.accountsChanged ?? []) fn([]);
      };
    },
    { account, options },
  );
  const raider = (id: bigint) => ({
    data: {
      enlisted: id === demoId ? state.demo : !options.unenlisted,
      isDemo: id >= DEMO && state.demo,
      buried: false,
      stance: 1,
      level: options.level ?? 1,
      epoch: 0n,
      cursorBoss: 1n,
      lastStanceRound: 1100n,
      checkpoint: { damage: 0n, scrap: 0n, dreams: 0n },
      scrap: options.huge ? 10n ** 70n : options.lowScrap ? 2n : 100n,
      dreams: 3n,
      damage: 1234n,
      bossesSlain: 0n,
      pending: {
        round: options.pending ? 1240n : 0n,
        fromEpoch: 0n,
        from: 1,
        to: 1,
        level: 2,
        kind: options.pending ? 3 : 0,
      },
    },
    ko: options.ko ?? false,
    caughtUp: true,
  });
  const value = (name: string, args: readonly unknown[]) => {
    if (name === "boss")
      return {
        id: 1n,
        seasonId: 1n,
        tier: 0,
        summonedAt: 0n,
        slainAt: 0n,
        previousRunWork: 1600n,
        hpUnits: 50000000n,
        maxHpUnits: 72000000n,
        damageUnits: 22000000n,
      };
    if (name === "processedThrough" || name === "advance") return 1234n;
    if (name === "liveRound") return 1235n;
    if (name === "effectiveRound") return 1236n;
    if (name === "GENESIS") return 1793022600n;
    if (name === "anchored") return true;
    if (name === "lastRunWork") return 1600n;
    if (name === "burrowStreak") return 18n;
    if (name === "totalBurrowRounds") return 20n;
    if (name === "pendingMove") return [1, 18n, true];
    if (name === "cover") return [2, 100n, 1n, 1n, true];
    if (name === "core") return dependencies[0];
    if (name === "nft") return dependencies[1];
    if (name === "staking") return dependencies[2];
    if (name === "renderer") return renderer;
    if (name === "bossSVG")
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" fill="#b195ca"/></svg>';
    if (name === "aliveCount") return 3n;
    if (name === "nonDemoCount") return 1n;
    if (name === "alivePower") return 300n;
    if (name === "raider") return raider(args[0] as bigint);
    if (name === "cardURI") return card;
    if (name === "controllerOf") return account;
    if (name === "enlistDemo") return demoId;
    if (name === "scoreOf" || name === "seasonScoreOf")
      return (args[1] as bigint) >= DEMO ? 50n : 1000n;
    return undefined;
  };
  const encode = (contractAbi: Abi, name: string, args: readonly unknown[]) =>
    encodeFunctionResult({
      abi: contractAbi,
      functionName: name,
      result: value(name, args),
    });
  await page.route("https://**/*", async (route) => {
    const url = route.request().url();
    urls.push(url);
    if (url.includes("api.squeekchain.com")) {
      if (url.includes("/status"))
        return route.fulfill({
          json: {
            measurement: {
              coreStatus: "IDLE",
              freshness: "online",
              observedAt: new Date().toISOString(),
              staleAfterSeconds: 120,
            },
          },
        });
      if (url.includes("/accounts/")) {
        if (options.inventoryFail)
          return route.fulfill({ status: 503, json: {} });
        return route.fulfill({
          json: {
            account,
            chain: { chainId: "11155111" },
            tokens: (options.apiSecondPage
              ? url.includes("cursor=")
                ? [7]
                : [1, 2, 3, 4, 5, 6]
              : [1]
            ).map((id) => ({
              tokenId: String(id),
              custody: options.staked ? "staking" : "wallet",
            })),
            nextCursor:
              options.apiSecondPage && !url.includes("cursor=")
                ? "second-page"
                : null,
          },
        });
      }
      if (url.includes("/squeeks/"))
        return route.fulfill({ json: { metadata: { imageDataUri: image } } });
      return route.fulfill({ status: 404 });
    }
    if (!route.request().postData())
      return route.fulfill({ status: 200, json: {} });
    let payload;
    try {
      payload = route.request().postDataJSON();
    } catch {
      return route.fulfill({ json: {} });
    }
    if (!payload.method) return route.fulfill({ json: {} });
    const { method, params = [], id } = payload;
    requests.push({ method, params });
    const ok = (result: unknown) =>
      route.fulfill({ json: { jsonrpc: "2.0", id, result } });
    const fail = (message: string, data?: unknown) =>
      route.fulfill({
        json: { jsonrpc: "2.0", id, error: { code: -32000, message, data } },
      });
    if (
      options.rpcFail ||
      (options.failPrimary && url.includes("publicnode.com"))
    )
      return fail("Service unavailable");
    if (method === "eth_chainId") return ok("0xaa36a7");
    if (method === "eth_getCode") {
      const block = params[1];
      const exists =
        block === "latest" ||
        BigInt(block) >= BigInt(handoff.contracts[0].blockNumber);
      return ok(options.missingCode ? "0x" : exists ? "0x60016001" : "0x");
    }
    if (method === "eth_blockNumber") return ok("0xb805c0"); // 12060096, deliberately greater than deployment
    if (method === "eth_getBlockByNumber")
      return ok({
        number: params[0] === "latest" ? "0xb805c0" : params[0],
        hash: blockHash,
        parentHash: blockHash,
        timestamp: "0x6ae95500",
        transactions: [],
        gasLimit: "0x1c9c380",
        gasUsed: "0x0",
        baseFeePerGas: "0x1",
        difficulty: "0x0",
        extraData: "0x",
        logsBloom: "0x" + "00".repeat(256),
        miner: account,
        mixHash: blockHash,
        nonce: "0x0000000000000000",
        receiptsRoot: blockHash,
        sha3Uncles: blockHash,
        stateRoot: blockHash,
        transactionsRoot: blockHash,
        size: "0x1",
        uncles: [],
      });
    if (method === "eth_getLogs") {
      const range = params[0];
      ranges.push({ from: BigInt(range.fromBlock), to: BigInt(range.toBlock) });
      const topics = encodeEventTopics({
        abi,
        eventName: "Enlisted",
        args: { id: 1n, controller: account },
      });
      const events = [
        {
          address: game,
          topics,
          data: encodeAbiParameters([{ type: "bool" }], [false]),
          blockNumber: "0xb80440",
          blockHash,
          transactionHash: hash,
          transactionIndex: "0x0",
          logIndex: "0x0",
          removed: false,
        },
      ];
      if (options.ko) {
        const idleTopics = encodeEventTopics({
          abi,
          eventName: "RoundApplied",
          args: { fromRound: 1200n, throughRound: 1211n },
        });
        events.push({
          address: game,
          topics: idleTopics,
          data: encodeAbiParameters(
            [{ type: "bool" }, { type: "uint64" }, { type: "uint64" }],
            [false, 0n, 1n],
          ),
          blockNumber: "0xb80441",
          blockHash,
          transactionHash: hash,
          transactionIndex: "0x0",
          logIndex: "0x1",
          removed: false,
        });
        const koTopics = encodeEventTopics({
          abi,
          eventName: "KO",
          args: { stance: 1, epoch: 0n, bossId: 1n },
        });
        events.push({
          address: game,
          topics: koTopics,
          data: encodeAbiParameters(
            [{ type: "uint64" }, { type: "uint256" }],
            [1212n, 100n],
          ),
          blockNumber: "0xb80442",
          blockHash,
          transactionHash: hash,
          transactionIndex: "0x0",
          logIndex: "0x2",
          removed: false,
        });
      }
      if (state.demo) {
        const topics = encodeEventTopics({
          abi,
          eventName: "Enlisted",
          args: { id: demoId, controller: account },
        });
        events.push({
          address: game,
          topics,
          data: encodeAbiParameters([{ type: "bool" }], [true]),
          blockNumber: "0xb80443",
          blockHash,
          transactionHash: hash,
          transactionIndex: "0x0",
          logIndex: "0x3",
          removed: false,
        });
      }
      return ok(
        events.filter(
          (event) =>
            BigInt(event.blockNumber) >= BigInt(range.fromBlock) &&
            BigInt(event.blockNumber) <= BigInt(range.toBlock),
        ),
      );
    }
    if (method === "eth_call") {
      const call = params[0];
      const data = call.data as Hex;
      if (
        call.to?.toLowerCase() === "0xca11bde05977b3631167028862be2a173976ca11"
      ) {
        const decoded = decodeFunctionData({ abi: mcAbi, data });
        const result = (
          decoded.args![0] as {
            target: Address;
            allowFailure: boolean;
            callData: Hex;
          }[]
        ).map((read) => {
          if (read.target.toLowerCase() === dependencies[1].toLowerCase()) {
            return {
              success: true,
              returnData: encodeFunctionResult({
                abi: ownershipAbi,
                functionName: "ownerOf",
                result: options.staked ? dependencies[2] : account,
              }),
            };
          }
          if (read.target.toLowerCase() === dependencies[2].toLowerCase()) {
            return {
              success: true,
              returnData: encodeFunctionResult({
                abi: ownershipAbi,
                functionName: "depositor",
                result: account,
              }),
            };
          }
          if (
            read.target.toLowerCase() ===
            "0xca11bde05977b3631167028862be2a173976ca11"
          )
            return {
              success: true,
              returnData: encodeFunctionResult({
                abi: mcAbi,
                functionName: "getBlockNumber",
                result: 12060096n,
              }),
            };
          const decoded = decodeFunctionData({ abi, data: read.callData });
          const name = String(decoded.functionName),
            args = decoded.args ?? [];
          calls.push({ name, args });
          return { success: true, returnData: encode(abi, name, args) };
        });
        return ok(
          encodeFunctionResult({
            abi: mcAbi,
            functionName: "aggregate3",
            result,
          }),
        );
      }
      const decoded = decodeFunctionData({ abi, data });
      const name = String(decoded.functionName),
        args = decoded.args ?? [];
      calls.push({ name, args });
      if (options.revert)
        return fail(
          "execution reverted",
          encodeErrorResult({ abi, errorName: options.revert }),
        );
      return ok(encode(abi, name, args));
    }
    if (method === "eth_getTransactionReceipt") {
      receiptChecks++;
      await new Promise((resolve) =>
        setTimeout(resolve, (options.receiptDelay ?? 2) * 250),
      );
      state.demo = true;
      return ok({
        transactionHash: hash,
        transactionIndex: "0x0",
        blockHash,
        blockNumber: "0xb805c0",
        from: account,
        to: game,
        cumulativeGasUsed: "0x100000",
        gasUsed: "0x100000",
        contractAddress: null,
        logs: [],
        logsBloom: "0x" + "00".repeat(256),
        status: "0x1",
        effectiveGasPrice: "0x1",
        type: "0x2",
      });
    }
    if (method === "eth_getTransactionByHash") return ok(null);
    return fail("Unsupported mock RPC " + method);
  });
  return {
    requests,
    urls,
    calls,
    sent,
    ranges,
    state,
    walletRequests: () =>
      page.evaluate(
        () =>
          (window as any).__walletRequests as {
            method: string;
            params: unknown[];
          }[],
      ),
    transactions: () =>
      page.evaluate(
        () =>
          (window as any).__sent as { data: Hex; to: Address; value?: Hex }[],
      ),
  };
}
export async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page
    .getByRole("button", { name: "Test browser wallet", exact: true })
    .click();
}
