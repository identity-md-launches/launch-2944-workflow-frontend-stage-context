import { BaseError, ContractFunctionRevertedError } from "viem";
const messages: Record<string, string> = {
  NotController: "Connect the current Squeek holder or staking depositor.",
  InvalidStance: "Choose Striker, Guard, Forager or Dreamer.",
  InvalidBatch: "Select 1 to 64 different Squeeks.",
  InvalidId: "Enter a valid Squeek ID.",
  AlreadyEnlisted: "This raider is already enlisted. Refresh its state.",
  NotEnlisted: "Enlist this Squeek before using this action.",
  SourceUnavailable:
    "Hamster settlement is unavailable. Retry when the core is readable.",
  BeforeGenesis: "The round clock has not started yet.",
  PendingLocked:
    "This pending action has started. Advance settlement and refresh before retrying.",
  PendingExists:
    "A pending change must settle before this action. Advance and refresh.",
  Cooldown:
    "Stances can change once every six effective rounds. Wait for the cooldown.",
  NeedsPoke:
    "Checkpoint this raider with Poke, then retry. Several checkpoints may be needed.",
  KnockedOut:
    "This raider is KO’d. Revive it or wait until free rest is available.",
  NotKnockedOut: "This raider is already awake. Refresh its state.",
  NotRested:
    "Free rest needs six settled Burrow rounds after the KO. Wait or spend 20 Scrap to revive.",
  InsufficientScrap:
    "This raider needs more Scrap. Its cost is shown beside the action.",
  MaxLevel: "This raider has reached its level cap.",
  NotBurned:
    "Only a burned real Squeek can be buried. Existing NFTs cannot use this action.",
  Reentrant:
    "A nested action was rejected. Retry once the current action finishes.",
};
export function friendlyError(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | undefined;
    const name = reverted?.data?.errorName;
    if (name && messages[name]) return messages[name];
  }
  let current = error as {
    code?: number;
    name?: string;
    message?: string;
    cause?: unknown;
    data?: { errorName?: string };
  };
  for (
    let i = 0;
    i < 8 && current;
    i++, current = current.cause as typeof current
  ) {
    if (
      current.code === 4001 ||
      current.name === "UserRejectedRequestError" ||
      /user rejected|user denied/i.test(current.message ?? "")
    )
      return "Request declined. Nothing was sent. You can try again.";
    if (current.code === 4902)
      return "This wallet does not know Sepolia. Use Switch to Sepolia to add it.";
    if (current.data?.errorName && messages[current.data.errorName])
      return messages[current.data.errorName];
    for (const [name, message] of Object.entries(messages))
      if (new RegExp(`\\b${name}\\b`).test(current.message ?? ""))
        return message;
    if (/insufficient funds|exceeds the balance/i.test(current.message ?? ""))
      return "You need Sepolia ETH for network gas. Use a testnet faucet, then retry.";
    // Only a receipt wait implies a submitted transaction; the receipt handler in
    // transactions.tsx owns that message because it knows the hash.
    if (
      /transaction receipt|waiting for transaction/i.test(current.message ?? "")
    )
      return "Confirmation could not be checked yet. Keep the transaction hash and check its explorer status before retrying.";
    if (
      current.name === "TimeoutError" ||
      /timed out|timeout/i.test(current.message ?? "")
    )
      return "The request timed out. Refresh to retry.";
  }
  if (
    error instanceof Error &&
    !/0x[0-9a-f]{8}|RPC|HTTP request/i.test(error.message) &&
    error.message.length < 230
  )
    return error.message;
  return "The request could not be completed. Check your network, refresh game state and retry.";
}
