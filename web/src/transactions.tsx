import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useConfig } from "wagmi";
import { getAccount, getWalletClient } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { type Hash } from "viem";
import type { Runtime } from "./config";
import type { GameAction } from "./types";
import { verifyCode } from "./chain";
import { friendlyError } from "./errors";

type Phase =
  "simulating" | "wallet" | "pending" | "unknown" | "success" | "error";
interface TxState {
  key: string;
  label: string;
  phase: Phase;
  message: string;
  hash?: Hash;
}
interface Intent {
  key: string;
  label: string;
  functionName: GameAction;
  args: readonly unknown[];
  confirm?: string;
}
const Context = createContext<{
  state?: TxState;
  run: (intent: Intent) => Promise<void>;
  busy: boolean;
  ready: boolean;
  disabledReason: string;
  checkReceipt: () => Promise<void>;
} | null>(null);
export function Transactions({
  runtime,
  verified,
  children,
}: {
  runtime: Runtime;
  verified: boolean;
  children: ReactNode;
}) {
  const account = useAccount();
  const config = useConfig();
  const query = useQueryClient();
  const [state, setState] = useState<TxState>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const ready =
    verified && account.isConnected && account.chainId === runtime.chain.id;
  const disabledReason = !account.isConnected
    ? "Connect a wallet to play."
    : account.chainId !== runtime.chain.id
      ? `Switch to ${runtime.chain.name} to play.`
      : !verified
        ? "Verifying deployment before transactions."
        : "";
  async function settle(hash: Hash, key: string, label: string) {
    let replacement: string | undefined;
    let resolvedHash = hash;
    let receipt;
    try {
      receipt = await runtime.client.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 120000,
        onReplaced: ({ reason, transactionReceipt }) => {
          replacement = reason;
          resolvedHash = transactionReceipt.transactionHash;
          setState((s) => (s ? { ...s, hash: resolvedHash } : s));
        },
      });
    } catch {
      setState({
        key,
        label,
        phase: "unknown",
        hash: resolvedHash,
        message:
          "Confirmation could not be checked yet. Check the transaction on the explorer before retrying, or use Check receipt.",
      });
      return false;
    }
    if (
      receipt.status !== "success" ||
      replacement === "cancelled" ||
      replacement === "replaced"
    ) {
      setState({
        key,
        label,
        phase: "error",
        hash: receipt.transactionHash,
        message:
          receipt.status !== "success"
            ? "The transaction reverted. No game change was saved. Refresh and try again."
            : "The transaction was canceled or replaced. Refresh game state before retrying.",
      });
      await query.invalidateQueries({ queryKey: ["snapshot"] });
      return false;
    }
    setState({
      key,
      label,
      phase: "success",
      message: `${label} confirmed. Refreshing game state.`,
      hash: receipt.transactionHash,
    });
    await query.invalidateQueries({
      predicate: (q) =>
        [
          "snapshot",
          "events",
          "ownership",
          "scores",
          "rest-candidates",
          "maintenance-state",
        ].includes(String(q.queryKey[0])),
    });
    return true;
  }
  async function run(intent: Intent) {
    if (lock.current) return;
    if (!account.isConnected) {
      window.dispatchEvent(new Event("squeekraider:connect"));
      return;
    }
    if (!ready) return;
    if (intent.confirm && !window.confirm(intent.confirm)) return;
    lock.current = true;
    setBusy(true);
    const { key, label, functionName, args } = intent;
    setState({
      key,
      label,
      phase: "simulating",
      message: `Checking ${label.toLowerCase()} before asking your wallet.`,
    });
    try {
      const caller = getAccount(config).address;
      if (!caller) throw new Error("Reconnect your wallet, then retry.");
      await verifyCode(runtime);
      const simulation = await runtime.client.simulateContract({
        address: runtime.deployment.address,
        abi: runtime.deployment.abi,
        functionName,
        args,
        account: caller,
        gas: 16_000_000n,
      });
      const wallet = await getWalletClient(config);
      const current = getAccount(config);
      if (
        current.address?.toLowerCase() !== caller.toLowerCase() ||
        current.chainId !== runtime.chain.id
      )
        throw new Error(
          "Your wallet account or network changed. Refresh before retrying.",
        );
      setState({
        key,
        label,
        phase: "wallet",
        message: `Confirm ${label.toLowerCase()} in your wallet. Only Sepolia network gas is paid.`,
      });
      const hash = await wallet.writeContract({
        ...simulation.request,
        chain: runtime.chain,
        account: caller,
      });
      setState({
        key,
        label,
        phase: "pending",
        message: `${label} sent. Waiting for its receipt.`,
        hash,
      });
      const settled = await settle(hash, key, label);
      // Unknown receipt state remains locked until explicitly rechecked; never allow a blind retry.
      if (!settled) {
        const receipt = await runtime.client
          .getTransactionReceipt({ hash })
          .catch(() => null);
        if (!receipt) return;
      }
    } catch (error) {
      setState({ key, label, phase: "error", message: friendlyError(error) });
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function checkReceipt() {
    if (!state?.hash || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await settle(state.hash, state.key, state.label);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const outstanding = state?.phase === "unknown";
  return (
    <Context.Provider
      value={{
        state,
        run,
        busy: busy || !!outstanding,
        ready,
        disabledReason,
        checkReceipt,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useTransactions() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing transaction provider");
  return context;
}
export function Action({
  actionKey,
  label,
  functionName,
  args,
  disabled = false,
  primary = false,
  confirm,
  connect = false,
}: {
  actionKey: string;
  label: string;
  functionName: GameAction;
  args: readonly unknown[];
  disabled?: boolean;
  primary?: boolean;
  confirm?: string;
  connect?: boolean;
}) {
  const { state, run, busy, ready } = useTransactions();
  const account = useAccount();
  const active =
    state?.key === actionKey &&
    ["simulating", "wallet", "pending"].includes(state.phase);
  return (
    <button
      className={primary ? "primary" : ""}
      disabled={
        disabled || busy || (!ready && !(connect && !account.isConnected))
      }
      onClick={() =>
        void run({ key: actionKey, label, functionName, args, confirm })
      }
    >
      {active
        ? `${label} · ${state?.phase === "simulating" ? "checking…" : state?.phase === "wallet" ? "confirm…" : "pending…"}`
        : label}
    </button>
  );
}
export function TransactionStatus({ runtime }: { runtime: Runtime }) {
  const { state, checkReceipt } = useTransactions();
  return (
    <div
      className={`transaction-status ${state ? "has-status" : ""}`}
      role="status"
      aria-live="polite"
    >
      {state && (
        <>
          <strong>
            {state.phase === "success"
              ? "Confirmed"
              : state.phase === "error"
                ? "Action stopped"
                : state.phase === "unknown"
                  ? "Confirmation unverified"
                  : state.phase === "simulating"
                    ? "Simulating"
                    : state.phase === "wallet"
                      ? "Wallet confirmation"
                      : "Transaction pending"}
          </strong>
          <p>{state.message}</p>
          {state.hash && (
            <a
              href={`${runtime.deployment.manifest.network.explorer}/tx/${state.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction ↗
            </a>
          )}
          {state.phase === "unknown" && (
            <button onClick={() => void checkReceipt()}>Check receipt</button>
          )}
        </>
      )}
    </div>
  );
}
