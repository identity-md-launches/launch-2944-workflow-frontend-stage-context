import { readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
  parseAbi,
  keccak256,
} from "viem";
import { sepolia } from "viem/chains";
const handoff = JSON.parse(
  await readFile(new URL("../deployment/handoff.json", import.meta.url)),
);
const { network } = JSON.parse(
  await readFile(new URL("../deployment/network.json", import.meta.url)),
);
const abi = JSON.parse(
  await readFile(new URL("../../docs/abi/SqueekRaider.json", import.meta.url)),
);
const client = createPublicClient({
  transport: http(network.rpcUrls[0], { timeout: 20000, retryCount: 0 }),
});
const contract = handoff.contracts[0];
const chainId = await client.getChainId();
if (chainId !== handoff.chainId) throw new Error("Wrong RPC chain");
const code = await client.getCode({ address: contract.address });
if (!code || code === "0x") throw new Error("Empty game code");
const multicall = sepolia.contracts.multicall3.address;
const mcCode = await client.getCode({ address: multicall });
if (!mcCode || mcCode === "0x") throw new Error("Empty Multicall3 code");
const mcAbi = parseAbi([
  "function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] returnData)",
]);
const descriptors = [
  ["advance", [128n]],
  ["core", []],
  ["nft", []],
  ["staking", []],
  ["renderer", []],
  ["boss", []],
  ["processedThrough", []],
  ["liveRound", []],
  ["pendingMove", []],
  ["cover", []],
  ["bossSVG", [0]],
];
const raw = await client.call({
  to: multicall,
  data: encodeFunctionData({
    abi: mcAbi,
    functionName: "aggregate3",
    args: [
      descriptors.map(([functionName, args]) => ({
        target: contract.address,
        allowFailure: false,
        callData: encodeFunctionData({ abi, functionName, args }),
      })),
    ],
  }),
  gas: 16000000n,
});
const decoded = decodeFunctionResult({
  abi: mcAbi,
  functionName: "aggregate3",
  data: raw.data,
});
const reads = Object.fromEntries(
  descriptors.map(([functionName], i) => [
    functionName,
    decodeFunctionResult({ abi, functionName, data: decoded[i].returnData }),
  ]),
);
for (let i = 0; i < 3; i++)
  if (
    reads[["core", "nft", "staking"][i]].toLowerCase() !==
    handoff.manifest.contracts[0].constructorArgs[i].toLowerCase()
  )
    throw new Error("Immutable dependency mismatch");
const receipt = await client.getTransactionReceipt({ hash: contract.txHash });
if (
  receipt.blockNumber !== BigInt(contract.blockNumber) ||
  receipt.status !== "success"
)
  throw new Error("Deployment receipt mismatch");
const rendererCode = await client.getCode({ address: reads.renderer });
if (!rendererCode || rendererCode === "0x")
  throw new Error("Empty renderer code");
const report = {
  checkedAt: new Date().toISOString(),
  publicRpc: network.rpcUrls[0],
  chainId,
  address: contract.address,
  sourceCommit: handoff.sourceCommit,
  abiHash: contract.abiHash,
  codeBytes: (code.length - 2) / 2,
  runtimeCodeKeccak: keccak256(code),
  deploymentBlock: String(receipt.blockNumber),
  deploymentReceipt: "success",
  multicall: {
    address: multicall,
    codeBytes: (mcCode.length - 2) / 2,
    mode: "one eth_call, aggregate3 normal CALL, advance(128) then views",
  },
  reads: { ...reads, bossSVG: `${reads.bossSVG.length} SVG characters` },
  transactionsBroadcast: 0,
};
const json =
  JSON.stringify(
    report,
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n";
await writeFile(
  new URL("../../docs/frontend/live-check.json", import.meta.url),
  json,
);
console.log(json);
