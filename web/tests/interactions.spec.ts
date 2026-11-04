import { test, expect } from "@playwright/test";
import { decodeFunctionData } from "viem";
import { mockApp, connect, abi, game, account } from "./fixtures";

test("first screen, static subpath, disconnected wallet discovery and keyboard sheet", async ({
  page,
}) => {
  const mock = await mockApp(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "The hamster decides." }),
  ).toBeVisible();
  const play = page.getByRole("button", { name: "Play free", exact: true });
  await expect(play).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Connect", exact: true }),
  ).toBeInViewport();
  await play.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Test browser wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Browser wallet", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Coinbase Wallet", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Advance", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  expect((await mock.transactions()).length).toBe(0);
  expect(
    mock.calls
      .filter((c) => c.name === "advance")
      .every((c) => c.args[0] === 128n),
  ).toBeTruthy();
});

test("unknown chain adds exact Sepolia parameters, simulates free play and waits for a receipt", async ({
  page,
}) => {
  const mock = await mockApp(page, {
    chain: "0x1",
    unknownChain: true,
    receiptDelay: 3,
  });
  await page.goto("./");
  await connect(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const requests = await mock.walletRequests();
  expect(
    requests.filter((r) => r.method === "wallet_switchEthereumChain").length,
  ).toBe(2);
  const add = requests.find((r) => r.method === "wallet_addEthereumChain");
  expect((add?.params[0] as any).chainId).toBe("0xaa36a7");
  await page
    .getByRole("combobox", { name: "Stance", exact: true })
    .selectOption("2");
  await expect(
    page.getByRole("button", { name: "Play free", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Play free", exact: true }).click();
  await expect(
    page.getByText("Transaction pending", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Play free · pending/ }),
  ).toBeDisabled();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  const transactions = await mock.transactions();
  expect(transactions).toHaveLength(1);
  expect(transactions[0].to.toLowerCase()).toBe(game.toLowerCase());
  expect(transactions[0].value ?? "0x0").toBe("0x0");
  const decoded = decodeFunctionData({ abi, data: transactions[0].data });
  expect(decoded.functionName).toBe("enlistDemo");
  expect(decoded.args).toEqual([2]);
  expect(
    mock.calls.some((c) => c.name === "enlistDemo" && c.args[0] === 2),
  ).toBeTruthy();
  await expect(
    page.getByRole("link", { name: "Open my raider" }),
  ).toBeVisible();
});

test("wallet rejection is recoverable and wrong-chain events disable game writes", async ({
  page,
}) => {
  await mockApp(page, { rejectConnect: true });
  await page.goto("./");
  await connect(page);
  await expect(
    page.getByText("Request declined. Nothing was sent. You can try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Test browser wallet", exact: true }),
  ).toBeEnabled();
});

test("network changes block actions until switched back", async ({ page }) => {
  const mock = await mockApp(page);
  await page.goto("./");
  await connect(page);
  await page.evaluate(() => (window as any).__wrongChain());
  await expect(
    page.getByRole("button", { name: "Switch to Sepolia", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play free", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play free", exact: true }),
  ).toBeEnabled();
  expect(await mock.transactions()).toHaveLength(0);
});

test("staked Squeek art, cost gates, pending changes and exact batch arguments", async ({
  page,
}) => {
  const mock = await mockApp(page, { staked: true });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(page.getByText("Staked · depositor confirmed")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Squeek 1 artwork" }),
  ).toBeVisible();
  const upgrade = page.getByRole("button", {
    name: "Upgrade · 20 Scrap",
    exact: true,
  });
  await expect(upgrade).toBeEnabled();
  await page.getByLabel("Select Squeek #1").check();
  await page
    .getByRole("combobox", { name: "Stance", exact: true })
    .selectOption("3");
  await page
    .getByRole("button", { name: "Set stance (1)", exact: true })
    .click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const tx = (await mock.transactions())[0];
  const decoded = decodeFunctionData({ abi, data: tx.data });
  expect(decoded.functionName).toBe("setStance");
  expect(decoded.args).toEqual([[1n], 3]);
});

test("insufficient Scrap and KO prevent upgrade; eligible rest stays explicit", async ({
  page,
}) => {
  await mockApp(page, { ko: true, lowScrap: true, enlistedDemo: true });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(
    page
      .getByRole("button", { name: "Upgrade · 20 Scrap", exact: true })
      .first(),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("button", { name: "Revive · 20 Scrap", exact: true })
      .first(),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Rest all eligible KO’d \([12]\)/ }),
  ).toBeEnabled();
  await expect(page.getByText("KO’d", { exact: true }).first()).toBeVisible();
});

test("simulation reverts decode to plain language without a broadcast", async ({
  page,
}) => {
  const mock = await mockApp(page, { revert: "SourceUnavailable" });
  await page.goto("./");
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Play free", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Play free", exact: true }).click();
  await expect(
    page.getByText(
      "Hamster settlement is unavailable. Retry when the core is readable.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play free", exact: true }),
  ).toBeEnabled();
  expect(await mock.transactions()).toHaveLength(0);
});

test("every primary write has a control and Advance submits 64, not preview 128", async ({
  page,
}) => {
  const mock = await mockApp(page, { enlistedDemo: true });
  await page.goto("./");
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Advance", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Advance", exact: true }).click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const decoded = decodeFunctionData({
    abi,
    data: (await mock.transactions())[0].data,
  });
  expect(decoded.functionName).toBe("advance");
  expect(decoded.args).toEqual([64n]);
  await page.getByRole("link", { name: "My Squeeks", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Enlist selected (0)", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Upgrade · 20 Scrap/ }).first(),
  ).toBeVisible();
  await page.getByText("Permissionless maintenance", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Poke IDs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Rest IDs · free", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bury burned Squeek", exact: true }),
  ).toBeVisible();
});

test("rankings use events and on-chain score reads, with demo separation", async ({
  page,
}) => {
  const mock = await mockApp(page, { enlistedDemo: true });
  await page.goto("./#/leaderboards");
  await expect(
    page.getByRole("cell", { name: "Squeek #1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "1,000", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Raiders", exact: true })
    .selectOption("true");
  await expect(page.getByRole("cell", { name: /Demo/ })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Squeek #1", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Score period", exact: true })
    .selectOption("season");
  await expect
    .poll(() => mock.calls.some((c) => c.name === "seasonScoreOf"))
    .toBeTruthy();
  await page
    .getByRole("combobox", { name: "Rank by", exact: true })
    .selectOption("wallet");
  await expect(
    page.getByRole("link", { name: account, exact: false }),
  ).toBeVisible();
  expect(mock.ranges.every((r) => r.to - r.from + 1n <= 10000n)).toBeTruthy();
});

test("missing deployment code blocks writes and API failure permits ID lookup", async ({
  page,
}) => {
  const mock = await mockApp(page, { missingCode: true, inventoryFail: true });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(
    page.getByText(
      "Contract code is missing on the configured network. Transactions are disabled.",
    ),
  ).toBeVisible();
  await page.getByText("Look up Squeek IDs", { exact: true }).click();
  await page.getByLabel("Squeek IDs", { exact: true }).fill("1, 1");
  await page.getByRole("button", { name: "Load Squeeks", exact: true }).click();
  await expect(page.getByText("Remove duplicate Squeek IDs.")).toBeVisible();
  await page.getByLabel("Squeek IDs", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Load Squeeks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Squeek #1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Upgrade · 20 Scrap", exact: true }),
  ).toBeDisabled();
  expect(await mock.transactions()).toHaveLength(0);
});

test("all routes reflow at 320 and 390 with huge counters and full addresses", async ({
  page,
}) => {
  await mockApp(page, { enlistedDemo: true, huge: true });
  await page.goto("./");
  await connect(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["raid", "squeeks", "leaderboards", "rules"]) {
      await page.goto(`./#/${route}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBeTruthy();
    }
  }
  await page.getByText("Contracts & network", { exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});

test("enlist batches confirm zero Scrap and use the selected IDs", async ({
  page,
}) => {
  const mock = await mockApp(page, { unenlisted: true });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(page.getByText("Wallet holder confirmed")).toBeVisible();
  await page.getByLabel("Select Squeek #1").check();
  await page
    .getByRole("combobox", { name: "Stance", exact: true })
    .selectOption("0");
  await page
    .getByRole("button", { name: "Enlist selected (1)", exact: true })
    .click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  const decoded = decodeFunctionData({
    abi,
    data: (await mock.transactions())[0].data,
  });
  expect(decoded.functionName).toBe("enlist");
  expect(decoded.args).toEqual([[1n], 0]);
});

for (const scenario of [
  { name: "upgrade", ko: false, label: "Upgrade · 20 Scrap" },
  { name: "revive", ko: true, label: "Revive · 20 Scrap" },
  { name: "poke", ko: false, label: "Poke · checkpoint" },
  { name: "rest", ko: true, label: "Rest · free" },
]) {
  test(`${scenario.name} simulates the exact raider action before signing`, async ({
    page,
  }) => {
    const mock = await mockApp(page, { ko: scenario.ko });
    await page.goto("./#/squeeks");
    await connect(page);
    const button = page.getByRole("button", {
      name: scenario.label,
      exact: true,
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    const decoded = decodeFunctionData({
      abi,
      data: (await mock.transactions())[0].data,
    });
    expect(decoded.functionName).toBe(scenario.name);
    expect(decoded.args).toEqual([
      ["rest", "poke"].includes(scenario.name) ? [1n] : 1n,
    ]);
    expect(mock.calls.some((c) => c.name === scenario.name)).toBeTruthy();
  });
}

test("rest all enumerates every wallet page and pagination can return to the first page", async ({
  page,
}) => {
  const mock = await mockApp(page, { ko: true, apiSecondPage: true });
  await page.goto("./#/squeeks");
  await connect(page);
  const rest = page.getByRole("button", {
    name: "Rest all eligible KO’d (7)",
    exact: true,
  });
  await expect(rest).toBeEnabled();
  await rest.click();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
  const decoded = decodeFunctionData({
    abi,
    data: (await mock.transactions())[0].data,
  });
  expect(decoded.functionName).toBe("rest");
  expect(decoded.args).toEqual([[1n, 2n, 3n, 4n, 5n, 6n, 7n]]);
  await page.getByRole("button", { name: "Next Squeeks", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Squeek #7", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Previous Squeeks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Squeek #1", exact: true }),
  ).toBeVisible();
});

test("bury requires confirmation, uses one real ID and reports a failed burn check", async ({
  page,
}) => {
  const mock = await mockApp(page, { revert: "NotBurned" });
  await page.goto("./#/squeeks");
  await connect(page);
  await page.getByText("Permissionless maintenance", { exact: true }).click();
  await page.getByLabel("Raider IDs", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Check IDs", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Bury burned Squeek", exact: true })
    .click();
  await expect(
    page.getByText(
      "Only a burned real Squeek can be buried. Existing NFTs cannot use this action.",
    ),
  ).toBeVisible();
  expect(
    mock.calls.some((c) => c.name === "bury" && c.args[0] === 1n),
  ).toBeTruthy();
  expect(await mock.transactions()).toHaveLength(0);
});

test("keyless fallback works and the Coinbase connector does not enable analytics", async ({
  page,
}) => {
  const mock = await mockApp(page, { failPrimary: true });
  await page.goto("./");
  await expect(
    page.getByText("5,000 / 7,200 HP", { exact: true }),
  ).toBeVisible();
  expect(mock.urls.some((u) => u.includes("ethpandaops.io"))).toBeTruthy();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Coinbase Wallet", exact: true }),
  ).toBeVisible();
  expect(
    mock.urls.some((u) =>
      /cca-lite|analytics|google-analytics|segment\.io/.test(u),
    ),
  ).toBeFalsy();
});

test("pending upgrades and demo level caps disable another spend", async ({
  page,
}) => {
  await mockApp(page, { pending: true, enlistedDemo: true, level: 3 });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(
    page.getByRole("button", { name: "Level cap", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Upgrade · 80 Scrap", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Upgrade → Guard, level 2 · round 1,240/).first(),
  ).toBeVisible();
});

test("tampered ABI fails closed before rendering transaction controls", async ({
  page,
}) => {
  const mock = await mockApp(page);
  await page.route("**/abi/SqueekRaider.json", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("./");
  await expect(page.getByRole("alert")).toHaveText(
    "Contract ABI verification failed. Transactions are disabled.",
  );
  await expect(
    page.getByRole("button", { name: "Play free", exact: true }),
  ).toHaveCount(0);
  expect(await mock.transactions()).toHaveLength(0);
});

test("the skip link preserves the hash route and focuses the main content", async ({
  page,
}) => {
  await mockApp(page);
  await page.goto("./#/raid");
  await expect(
    page.getByRole("heading", { name: "The hamster decides." }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "The hamster decides." }),
  ).toBeVisible();
  expect(page.url()).toContain("#/raid");
});

test("a phone without an extension offers four wallet browsers and Coinbase Smart Wallet", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1",
  });
  const page = await context.newPage();
  await mockApp(page, { noInjected: true });
  await page.goto("http://127.0.0.1:4185/preview/");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    await expect(
      page.getByRole("link", { name: `Open in ${name}`, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Coinbase Smart Wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Browser wallet", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const rabby = await page
    .getByRole("link", { name: "Open in Rabby", exact: true })
    .getAttribute("href");
  expect(rabby).toContain("_cmd=open-dapp&dapp=");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await context.close();
});

test("automated accessibility review covers each route and the wallet dialog", async ({
  page,
}) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await mockApp(page, { enlistedDemo: true });
  await page.goto("./");
  await connect(page);
  for (const route of ["raid", "squeeks", "leaderboards", "rules"]) {
    await page.goto(`./#/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (
      process.env.CAPTURE_EVIDENCE &&
      test.info().project.name === "chromium" &&
      ["squeeks", "leaderboards"].includes(route)
    )
      await page.screenshot({
        path: `../docs/frontend/${route}-mocked-390.png`,
        fullPage: true,
      });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: /0x5989/ }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("six Squeeks plus the demo load with each card in its own bounded read", async ({
  page,
}) => {
  const mock = await mockApp(page, { apiSecondPage: true });
  await page.goto("./#/squeeks");
  await connect(page);
  for (const id of [1, 2, 3, 4, 5, 6])
    await expect(
      page.getByRole("heading", { name: `Squeek #${id}`, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "On-chain raider frame for Squeek 6" }),
  ).toBeVisible();
  // The fixture fails any aggregate with two renders, as the real renderer does at 16M gas.
  for (const batch of mock.batches) {
    expect(batch.filter((n) => n === "cardURI").length).toBeLessThanOrEqual(1);
    if (batch.includes("cardURI"))
      expect(batch.filter((n) => n !== "advance")).toEqual(["cardURI"]);
  }
  expect(
    mock.batches.some((b) => b.filter((n) => n === "raider").length === 7),
  ).toBeTruthy();
});

test("failed card renders leave one real Squeek and its actions usable", async ({
  page,
}) => {
  const mock = await mockApp(page, { cardFail: true });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(
    page.getByRole("heading", { name: "Squeek #1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Poke · checkpoint", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Upgrade · 20 Scrap", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText(/Game state is unavailable/)).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "On-chain raider frame for Squeek 1" }),
  ).toHaveCount(0);
  expect(mock.batches.some((b) => b.includes("cardURI"))).toBeTruthy();
  expect(await mock.transactions()).toHaveLength(0);
});

test("Refresh retries a failed wallet inventory", async ({ page }) => {
  const mock = await mockApp(page, { inventoryFail: true });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(
    page.getByText("Squeekchain is unavailable. Retry or use a Squeek ID.").first(),
  ).toBeVisible({ timeout: 15000 });
  const before = mock.accountRequests();
  mock.state.options.inventoryFail = false;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Squeek #1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Squeekchain is unavailable. Retry or use a Squeek ID."),
  ).toHaveCount(0);
  expect(mock.accountRequests()).toBeGreaterThan(before);
});

test("a read timeout is not described as a transaction", async () => {
  const { friendlyError } = await import("../src/errors");
  expect(
    friendlyError(
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    ),
  ).toBe("The request timed out. Refresh to retry.");
  expect(friendlyError(new Error("The request timed out."))).toBe(
    "The request timed out. Refresh to retry.",
  );
});

test("the static export shows read timeout recovery without a transaction hash", async ({
  page,
}) => {
  const mock = await mockApp(page);
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/v1/accounts/"))
        return Promise.reject(
          new DOMException("The operation was aborted due to timeout", "TimeoutError"),
        );
      return originalFetch.call(window, input, init);
    };
  });
  await page.goto("./#/squeeks");
  await connect(page);
  await expect(
    page.getByText("The request timed out. Refresh to retry.", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Keep the transaction hash/)).toHaveCount(0);
  expect(await mock.transactions()).toHaveLength(0);
});

test("pending transaction status stays visible on every route", async ({
  page,
}) => {
  const mock = await mockApp(page, { receiptDelay: 120 });
  await page.goto("./");
  await connect(page);
  await page.getByRole("button", { name: "Play free", exact: true }).click();
  await expect(page.getByText("Transaction pending", { exact: true })).toBeVisible();
  for (const name of ["How it works", "Leaderboards", "My Squeeks", "Raid"]) {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page.locator(".transaction-status.has-status")).toHaveCount(1);
    await expect(
      page.getByText("Transaction pending", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View transaction ↗" }),
    ).toBeVisible();
  }
  expect(await mock.transactions()).toHaveLength(1);
});
