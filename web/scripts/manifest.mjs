import { readFile, writeFile, readdir, mkdir, stat } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { keccak256, toBytes } from "viem";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(web, "..");
const prepare = process.argv.includes("--prepare");
const check = process.argv.includes("--check");
const output = resolve(root, prepare ? "web/public" : "dist");
const handoff = JSON.parse(
  await readFile(resolve(web, "deployment/handoff.json"), "utf8"),
);
const chainTable = JSON.parse(
  await readFile(resolve(web, "deployment/network.json"), "utf8"),
);
export const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const abiHash = (abi) =>
  keccak256(toBytes(JSON.stringify(canonical(abi)))).slice(2);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const expected = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts: handoff.contracts.map(({ name, address, abiHash }) => ({
    name,
    address,
    abiHash,
    abiPath: `abi/${name}.json`,
  })),
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: chainTable.network,
  ...(chainTable.walletAddChain
    ? { walletAddChain: chainTable.walletAddChain }
    : {}),
};
if (handoff.chainId !== chainTable.network.chainId)
  throw new Error("Handoff and network chain mismatch");
await mkdir(resolve(output, "abi"), { recursive: true });
for (const name of [
  ...new Set([...handoff.contracts.map((c) => c.name), "RaiderCard"]),
]) {
  const sourcePath = `docs/abi/${name}.json`;
  const raw = await readFile(resolve(root, sourcePath));
  const abi = JSON.parse(raw);
  if (!Array.isArray(abi)) throw new Error(`${name}: ABI must be an array`);
  const bound = handoff.contracts.find((c) => c.name === name);
  if (bound && abiHash(abi) !== bound.abiHash)
    throw new Error(`${name}: ABI hash mismatch`);
  // An available pinned Git object must match byte for byte. Rebuilds of downloaded source also
  // work without Git, with the attested canonical ABI hash remaining mandatory.
  let pinned;
  try {
    pinned = execFileSync(
      "git",
      ["show", `${handoff.sourceCommit}:${sourcePath}`],
      { cwd: root, stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {}
  if (pinned && !pinned.equals(raw))
    throw new Error(`${name}: ABI differs from deployed source commit`);
  if (!check) await writeFile(resolve(output, "abi", `${name}.json`), raw);
}
async function inventory(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = resolve(folder, entry.name);
    if (entry.isSymbolicLink())
      throw new Error("Symlinks are not export assets");
    if (entry.isDirectory()) result.push(...(await inventory(file)));
    else {
      const path = relative(output, file).split("\\").join("/");
      if (path === "imd-deployment.json") continue;
      if (/(^|\/)(node_modules|\.cache|\.vite)(\/|$)|\.tgz$|\.map$/.test(path))
        throw new Error(`Unnecessary export file ${path}`);
      const bytes = await readFile(file);
      if ((await stat(file)).size > 8388608)
        throw new Error(`${path} exceeds file budget`);
      result.push({ path, sha256: sha256(bytes) });
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
const assets = prepare ? [] : await inventory(output);
if (
  assets.length > 128 ||
  (!prepare && !assets.some((a) => a.path === "index.html"))
)
  throw new Error("Invalid export inventory");
if (check) {
  const actual = JSON.parse(
    await readFile(resolve(output, "imd-deployment.json"), "utf8"),
  );
  if (
    JSON.stringify(canonical(actual)) !==
    JSON.stringify(canonical({ ...expected, assets }))
  )
    throw new Error("Deployment manifest or asset hash mismatch");
  for (const contract of actual.contracts) {
    if (
      abiHash(
        JSON.parse(await readFile(resolve(output, contract.abiPath), "utf8")),
      ) !== contract.abiHash
    )
      throw new Error("Exported ABI mismatch");
  }
} else
  await writeFile(
    resolve(output, "imd-deployment.json"),
    JSON.stringify({ ...expected, assets }, null, 2) + "\n",
  );
const bytes = (
  await Promise.all(assets.map((a) => stat(resolve(output, a.path))))
).reduce((sum, s) => sum + s.size, 0);
if (bytes > 8 * 1024 * 1024)
  throw new Error("Export leaves too little submission budget");
console.log(
  `${check ? "Verified" : "Generated"} deployment manifest: ${assets.length} assets, ${bytes} bytes. ABI and pinned source binding verified.`,
);
