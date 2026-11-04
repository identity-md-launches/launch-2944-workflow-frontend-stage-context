import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import type { EIP1193Provider } from "viem";
import type { Runtime } from "./config";
import { getAddress, numberToHex } from "viem";
import { shortAddress } from "./chain";
import { friendlyError } from "./errors";
import { OPEN_IN, isMobileBrowser } from "./open-in";

export async function switchNetwork(
  runtime: Runtime,
  provider: EIP1193Provider,
) {
  const request = { chainId: numberToHex(runtime.chain.id) };
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [request],
    });
  } catch (error) {
    const e = error as {
      code?: number;
      message?: string;
      cause?: { code?: number };
    };
    if (
      e.code !== 4902 &&
      e.cause?.code !== 4902 &&
      !/unknown chain|unrecognized chain|not (?:been )?added|chain.*not.*configured/i.test(
        e.message ?? "",
      )
    )
      throw error;
    if (!runtime.deployment.manifest.walletAddChain)
      throw new Error(
        "This network cannot be added automatically. Add Sepolia in your wallet and retry.",
      );
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [runtime.deployment.manifest.walletAddChain],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [request],
    });
  }
}
export function Wallet({ runtime }: { runtime: Runtime }) {
  const { address, isConnected, chainId, connector } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const mobile = isMobileBrowser();
  useEffect(() => {
    let stopped = false;
    if (connector)
      connector.getProvider().then((provider) => {
        if (!stopped) runtime.setWalletProvider(provider as EIP1193Provider);
      });
    else runtime.setWalletProvider(undefined);
    return () => {
      stopped = true;
      runtime.setWalletProvider(undefined);
    };
  }, [connector, runtime]);
  useEffect(() => {
    const open = () => dialog.current?.showModal();
    window.addEventListener("squeekraider:connect", open);
    return () => window.removeEventListener("squeekraider:connect", open);
  }, []);
  const close = () => {
    dialog.current?.close();
    trigger.current?.focus();
  };
  const named = connectors.some(
    (c) => c.type === "injected" && c.id !== "injected",
  );
  const listed = [
    ...connectors.filter((c) => c.type === "injected"),
    ...connectors.filter((c) => c.type !== "injected"),
  ].filter(
    (c) =>
      !(c.id === "injected" && named) && (!mobile || c.type !== "injected"),
  );
  async function connectWallet(c: Connector) {
    setError("");
    setPending(c.uid);
    try {
      await connectAsync({ connector: c });
      const provider = (await c.getProvider()) as EIP1193Provider;
      await switchNetwork(runtime, provider);
      close();
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setPending("");
    }
  }
  async function switchChain() {
    if (!connector) return;
    setPending("switch");
    setError("");
    try {
      await switchNetwork(
        runtime,
        (await connector.getProvider()) as EIP1193Provider,
      );
      close();
    } catch (error) {
      setError(friendlyError(error));
      dialog.current?.showModal();
    } finally {
      setPending("");
    }
  }
  const wrong = isConnected && chainId !== runtime.chain.id;
  return (
    <>
      <button
        ref={trigger}
        className="wallet-button"
        disabled={!!pending}
        onClick={() => {
          setError("");
          if (wrong) void switchChain();
          else dialog.current?.showModal();
        }}
      >
        <span
          className={`connection-dot ${isConnected ? "connected" : ""}`}
          aria-hidden="true"
        />
        {pending === "switch"
          ? "Switching…"
          : wrong
            ? `Switch to ${runtime.chain.name}`
            : address
              ? shortAddress(getAddress(address))
              : "Connect"}
      </button>
      <dialog
        ref={dialog}
        className="wallet-sheet"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        aria-labelledby="wallet-title"
      >
        <div className="sheet-content">
          <div className="section-head">
            <h2 id="wallet-title">
              {isConnected ? "Connected wallet" : "Connect a wallet"}
            </h2>
            <button
              className="icon-button"
              aria-label="Close wallet sheet"
              onClick={close}
            >
              ×
            </button>
          </div>
          {isConnected && address ? (
            <>
              <p className="break-all">{getAddress(address)}</p>
              <div className="button-row">
                <a
                  className="button"
                  target="_blank"
                  rel="noreferrer"
                  href={`${runtime.deployment.manifest.network.explorer}/address/${address}`}
                >
                  View wallet ↗
                </a>
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(getAddress(address))
                      .then(
                        () => setError("Address copied."),
                        () =>
                          setError(
                            "Copy is unavailable. Select the full address above.",
                          ),
                      )
                  }
                >
                  Copy address
                </button>
              </div>
              {wrong && (
                <button disabled={!!pending} onClick={() => void switchChain()}>
                  Switch to {runtime.chain.name}
                </button>
              )}
              <button
                className="wallet-row"
                onClick={() => {
                  disconnect();
                  close();
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                Use your wallet on the Sepolia test network.
              </p>
              {mobile &&
                OPEN_IN.map((wallet) => (
                  <a
                    className="wallet-row"
                    key={wallet.id}
                    href={wallet.href(location.href)}
                  >
                    <img
                      src={`./wallets/${wallet.id}.svg`}
                      width="28"
                      height="28"
                      alt=""
                    />
                    <span>Open in {wallet.name}</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              {listed.map((c) => (
                <button
                  className="wallet-row"
                  key={c.uid}
                  onClick={() => void connectWallet(c)}
                  disabled={!!pending}
                >
                  <img
                    src={
                      c.icon ??
                      (c.id === "coinbaseWalletSDK"
                        ? "./wallets/coinbase.svg"
                        : "./wallets/browser.svg")
                    }
                    width="28"
                    height="28"
                    alt=""
                  />
                  <span>
                    {c.id === "injected"
                      ? "Browser wallet"
                      : c.id === "coinbaseWalletSDK"
                        ? mobile
                          ? "Coinbase Smart Wallet"
                          : "Coinbase Wallet"
                        : c.name}
                    {pending === c.uid ? " · opening…" : ""}
                  </span>
                </button>
              ))}
            </>
          )}
          <p
            role="status"
            className={error === "Address copied." ? "muted" : "error-text"}
          >
            {error}
          </p>
        </div>
      </dialog>
    </>
  );
}
