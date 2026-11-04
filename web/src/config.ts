import { createConfig, fallback, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import {
  createPublicClient,
  custom,
  defineChain,
  getAddress,
  isAddress,
  keccak256,
  toBytes,
  type Abi,
  type EIP1193Provider,
} from "viem";
import { sepolia } from "viem/chains";
import type { Deployment, Manifest } from "./types";

export const SITE_NAME = "SqueekRaider";
export const API_BASE = "https://api.squeekchain.com/v1";
// Approved keyless fallbacks from workflow.md; primary URLs always come from the runtime manifest.
export const WORKFLOW_RPC_FALLBACKS = [
  "https://sepolia.drpc.org",
  "https://sepolia.gateway.tenderly.co",
];
// Standard infrastructure, taken from viem's Sepolia definition, not an application deployment.
export const MULTICALL = sepolia.contracts.multicall3.address;
export const STANCES = ["Striker", "Guard", "Forager", "Dreamer"] as const;
export const MOVES = ["Frenzy", "Quake", "Nightmare"] as const;
export const CHANGES = [
  "None",
  "Enlist",
  "Stance",
  "Upgrade",
  "Revive",
  "Rest",
  "Bury",
];
export const DEMO_BIT = 1n << 255n;
export const demoId = (address: string) => DEMO_BIT | BigInt(address);
export const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
        )
      : value;
export async function loadDeployment(): Promise<Deployment> {
  const response = await fetch(
    new URL("./imd-deployment.json", document.baseURI),
    { cache: "no-cache" },
  );
  if (!response.ok)
    throw new Error(
      "Deployment configuration could not be loaded. Reload to retry.",
    );
  const manifest = (await response.json()) as Manifest;
  if (
    manifest.version !== 1 ||
    !manifest.network ||
    manifest.chainId !== manifest.network.chainId ||
    !manifest.network.rpcUrls.length
  )
    throw new Error(
      "Deployment configuration is inconsistent. Transactions are disabled.",
    );
  const contracts = await Promise.all(
    manifest.contracts.map(async (contract) => {
      if (
        !isAddress(contract.address) ||
        !/^abi\/[A-Za-z0-9_-]+\.json$/.test(contract.abiPath)
      )
        throw new Error("Invalid contract configuration.");
      const res = await fetch(new URL(contract.abiPath, document.baseURI));
      if (!res.ok)
        throw new Error("The deployed contract ABI could not be loaded.");
      const abi = (await res.json()) as Abi;
      if (
        !Array.isArray(abi) ||
        keccak256(toBytes(JSON.stringify(canonical(abi)))).slice(2) !==
          contract.abiHash
      )
        throw new Error(
          "Contract ABI verification failed. Transactions are disabled.",
        );
      return { ...contract, abi };
    }),
  );
  const game = contracts.find((c) => c.name === "SqueekRaider");
  if (!game) throw new Error("SqueekRaider is missing from the deployment.");
  return { manifest, abi: game.abi, address: getAddress(game.address) };
}
export function createRuntime(deployment: Deployment) {
  const network = deployment.manifest.network;
  const chain = defineChain({
    id: deployment.manifest.chainId,
    name: network.name,
    testnet: network.testnet,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: { default: { http: network.rpcUrls } },
    blockExplorers: { default: { name: "Explorer", url: network.explorer } },
    contracts: { multicall3: sepolia.contracts.multicall3 },
  });
  const rpcUrls = [...new Set([...network.rpcUrls, ...WORKFLOW_RPC_FALLBACKS])];
  let walletProvider: EIP1193Provider | undefined;
  const transports = rpcUrls.map((url) =>
    http(url, { timeout: 10000, retryCount: 0 }),
  );
  // The connected wallet is last, read-only fallback. Signing always uses its own connector.
  const walletFallback = custom(
    {
      request: async (request) => {
        if (!walletProvider) throw new Error("No wallet RPC fallback");
        const id = await walletProvider.request({ method: "eth_chainId" });
        if (Number(id) !== chain.id)
          throw new Error("Wallet is on another network");
        return walletProvider.request(
          request as Parameters<EIP1193Provider["request"]>[0],
        );
      },
    },
    { retryCount: 0 },
  );
  const client = createPublicClient({
    chain,
    transport: fallback([...transports, walletFallback], {
      rank: false,
      retryCount: 0,
    }),
    batch: undefined,
  });
  const wagmi = createConfig({
    chains: [chain],
    multiInjectedProviderDiscovery: true,
    connectors: [
      injected(),
      coinbaseWallet({
        appName: SITE_NAME,
        preference: { options: "all", telemetry: false },
      }),
    ],
    transports: {
      [chain.id]: fallback(transports, { rank: false, retryCount: 0 }),
    },
  });
  return {
    deployment,
    chain,
    client,
    wagmi,
    setWalletProvider: (provider?: EIP1193Provider) => {
      walletProvider = provider;
    },
  };
}
export type Runtime = ReturnType<typeof createRuntime>;
