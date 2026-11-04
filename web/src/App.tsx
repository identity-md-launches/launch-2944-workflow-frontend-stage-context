import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getAddress, type Address } from "viem";
import {
  CHANGES,
  DEMO_BIT,
  MOVES,
  STANCES,
  demoId,
  type Runtime,
} from "./config";
import {
  number,
  hp,
  percent,
  readSnapshot,
  sameAddress,
  shortAddress,
  validIds,
  verifyCode,
} from "./chain";
import {
  accountPage,
  confirmOwnership,
  getLiveStatus,
  indexEvents,
  indexFacts,
  scores,
  squeekArt,
  type EventIndex,
  type ScoreRow,
} from "./data";
import {
  Action,
  TransactionStatus,
  Transactions,
  useTransactions,
} from "./transactions";
import { Wallet } from "./Wallet";
import { Hamster, StanceIcon } from "./Art";
import { friendlyError } from "./errors";
import type { Raider, Snapshot } from "./types";

const routes = [
  ["raid", "Raid"],
  ["squeeks", "My Squeeks"],
  ["leaderboards", "Leaderboards"],
  ["rules", "How it works"],
] as const;
const useRoute = () => {
  const [route, setRoute] = useState(location.hash.slice(2) || "raid");
  useEffect(() => {
    const change = () => {
      setRoute(location.hash.slice(2) || "raid");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return route;
};
function Note({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return <p className={error ? "notice error-text" : "notice"}>{children}</p>;
}
function StanceSelect({
  value,
  onChange,
  id = "stance",
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
}) {
  return (
    <label className="field" htmlFor={id}>
      Stance
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {STANCES.map((name, i) => (
          <option value={i} key={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
function FreePlay({ snapshot }: { snapshot?: Snapshot }) {
  const { address } = useAccount();
  const [stance, setStance] = useState(1);
  const demo = snapshot?.raiders.find(
    (r) => r.view.data.isDemo && r.view.data.enlisted,
  );
  return (
    <section className="free-play" aria-labelledby="free-title">
      <div className="free-heading">
        <Hamster className="hamster-small" />
        <div>
          <h2 id="free-title">A tiny raider. A big owl.</h2>
          <p className="muted">One free demo per wallet.</p>
        </div>
      </div>
      {demo ? (
        <>
          <p>
            Your demo is{" "}
            {demo.view.ko
              ? "KO’d"
              : demo.view.data.pending.round
                ? "joining the party"
                : "in the party"}
            .
          </p>
          <a className="button primary" href="#/squeeks">
            Open my raider <span aria-hidden="true">↗</span>
          </a>
        </>
      ) : (
        <>
          <div className="free-controls">
            <StanceSelect
              value={stance}
              onChange={setStance}
              id="free-stance"
            />
            <Action
              actionKey="free"
              label="Play free"
              functionName="enlistDemo"
              args={[stance]}
              primary
              connect
              disabled={!!address && !snapshot}
            />
          </div>
          <p className="small muted">No Squeek needed. Gas uses Sepolia ETH.</p>
        </>
      )}
    </section>
  );
}
function Raid({
  runtime,
  snapshot,
  index,
  liveStatus,
  liveError,
}: {
  runtime: Runtime;
  snapshot?: Snapshot;
  index?: EventIndex;
  liveStatus?: Awaited<ReturnType<typeof getLiveStatus>>;
  liveError?: boolean;
}) {
  const facts = indexFacts(index);
  const b = snapshot?.boss;
  const lag =
    snapshot && snapshot.live > snapshot.processed
      ? snapshot.live - snapshot.processed
      : 0n;
  const measurement = liveStatus?.measurement;
  const fresh =
    measurement?.freshness === "online" &&
    !!measurement.observedAt &&
    Date.now() - Date.parse(measurement.observedAt) <
      (measurement.staleAfterSeconds ?? 120) * 1000;
  const coreStatus = measurement?.coreStatus?.toUpperCase();
  const hamsterState = liveError
    ? "Feed unavailable"
    : !liveStatus
      ? "Reading hamster…"
      : !fresh
        ? "Feed stale"
        : coreStatus === "ACTIVE" ||
            coreStatus === "RUNNING" ||
            coreStatus === "WHEEL"
          ? "Wheel"
          : coreStatus === "IDLE" || coreStatus === "BURROW"
            ? "Burrow"
            : "Status unknown";
  const knownMove =
    !!snapshot &&
    snapshot.burrow >= 2n &&
    (facts.wheelSeen || snapshot.move[2]);
  const cover = snapshot?.cover;
  const coverage =
    cover && cover[2] > 0n ? percent(cover[3] * 2n, cover[2]) : 0;
  return (
    <>
      <div className="page-title">
        <div>
          <h1>The hamster decides.</h1>
          <p className="muted">An idle raid powered by a real hamster.</p>
        </div>
        <span className={`live-state ${fresh ? "fresh" : ""}`}>
          <span className="live-dot" aria-hidden="true" />
          {hamsterState}
        </span>
      </div>
      <div className="raid-grid">
        <section className="raid-scene" aria-labelledby="boss-title">
          <div className="boss-top">
            <span>
              {b ? `Season ${number(b.seasonId)}` : "Reading season…"}
            </span>
            <span>{b ? `Tier ${b.tier + 1} / 3` : "Tier unavailable"}</span>
          </div>
          <div className="owl-stage">
            <span className="pixel-star star-one" aria-hidden="true">
              ✦
            </span>
            <span className="pixel-star star-two" aria-hidden="true">
              +
            </span>
            {snapshot ? (
              <img
                className="boss-art"
                src={snapshot.bossArt}
                width="192"
                height="192"
                alt={`Tier ${b!.tier + 1} pixel owl boss`}
              />
            ) : (
              <div className="art-loading" aria-label="Boss art loading">
                ?
              </div>
            )}
            <div className="ground" aria-hidden="true" />
          </div>
          <div className="boss-details">
            <div className="section-head">
              <h2 id="boss-title">
                {b ? `The Burrow Owl · ${number(b.id)}` : "The Burrow Owl"}
              </h2>
              <span className="small">
                {b
                  ? `${Math.round(percent(b.hpUnits, b.maxHpUnits))}% HP`
                  : "Reading HP…"}
              </span>
            </div>
            <div
              className="meter boss-meter"
              role="progressbar"
              aria-label="Boss health"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={b ? percent(b.hpUnits, b.maxHpUnits) : undefined}
              aria-valuetext={
                b ? `${hp(b.hpUnits)} of ${hp(b.maxHpUnits)} HP` : "Loading"
              }
            >
              <span
                style={{
                  width: b ? `${percent(b.hpUnits, b.maxHpUnits)}%` : "0%",
                }}
              />
            </div>
            <div className="boss-footer">
              <span>
                {b
                  ? `${hp(b.hpUnits)} / ${hp(b.maxHpUnits)} HP`
                  : "Reading boss health"}
              </span>
              <span className="muted">Together, one round at a time.</span>
            </div>
          </div>
        </section>
        <FreePlay snapshot={snapshot} />
        <section className="nap-panel" aria-labelledby="nap-title">
          <div className="section-head">
            <h2 id="nap-title">The next move</h2>
            <span className="muted">
              {snapshot
                ? `${number(snapshot.burrow)} / 18 Burrows`
                : "Waiting for state"}
            </span>
          </div>
          <div className="move-row">
            <span className="move-symbol" aria-hidden="true">
              ☾
            </span>
            <div>
              <strong>
                {knownMove
                  ? MOVES[snapshot!.move[0]]
                  : snapshot?.burrow === 0n && facts.wheelSeen
                    ? "The wheel is turning"
                    : "No observed move yet"}
              </strong>
              <p className="small muted">
                {knownMove
                  ? `Targets ${STANCES[cover![0]]} on the next Wheel ${snapshot!.move[2] ? "· armed" : "after 18 Burrows"}.`
                  : snapshot?.burrow === 0n && facts.wheelSeen
                    ? "A nap of two Burrows reveals the owl’s move."
                    : "A move needs an observed Wheel before the nap."}
              </p>
            </div>
          </div>
          <div className="cover-label">
            <span>Guard cover</span>
            <span>
              {knownMove && cover
                ? cover[4]
                  ? "Protected"
                  : cover[2] === 0n
                    ? "No real targets"
                    : `${number(cover[3] * 2n)} / ${number(cover[2])} covered`
                : "Awaiting a move"}
            </span>
          </div>
          <div
            className="meter cover-meter"
            role="progressbar"
            aria-label="Guard cover"
            aria-valuenow={coverage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${coverage}%` }} />
          </div>
          <p className="small muted">
            One real Guard protects two real targets. Demos do not provide
            cover.
          </p>
        </section>
        <section className="party-panel" aria-labelledby="party-title">
          <h2 id="party-title">The party</h2>
          <div className="party-grid">
            {STANCES.map((name, i) => (
              <div className={`party-stance stance-${i}`} key={name}>
                <StanceIcon stance={i} />
                <span>{name}</span>
                <strong>{snapshot ? number(snapshot.counts[i]) : "…"}</strong>
                <span className="small muted">
                  {snapshot
                    ? `${number(snapshot.realCounts[i])} real`
                    : "Reading"}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="advance-panel">
          <div>
            <h2>Keep the raid moving</h2>
            <p>
              {snapshot
                ? `${number(lag)} rounds behind`
                : "Reading round progress…"}{" "}
              <span className="muted">
                ·{" "}
                {snapshot
                  ? `processed ${number(snapshot.processed)}`
                  : "Sepolia"}
              </span>
            </p>
          </div>
          <Action
            actionKey="advance"
            label="Advance"
            functionName="advance"
            args={[64n]}
          />
          <p className="small muted full-row">
            Reads preview up to 128 steps. Advance saves up to 64 steps on
            chain. The lag includes the live round.{" "}
            {snapshot && !snapshot.anchored
              ? "The next successful source read will anchor the game."
              : ""}
          </p>
        </section>
      </div>
      <details className="observability">
        <summary>Raid observability</summary>
        <dl className="data-grid">
          <dt>Live round</dt>
          <dd>{snapshot ? number(snapshot.live) : "Unavailable"}</dd>
          <dt>Preview processed through</dt>
          <dd>{snapshot ? number(snapshot.processed) : "Unavailable"}</dd>
          <dt>Action takes effect at</dt>
          <dd>
            {snapshot ? `Round ${number(snapshot.effective)}` : "Unavailable"}
          </dd>
          <dt>Previous run work</dt>
          <dd>{snapshot ? number(snapshot.lastRunWork) : "Unavailable"}</dd>
          <dt>Read block</dt>
          <dd>{snapshot ? number(snapshot.block) : "Unavailable"}</dd>
          <dt>Hamster observation</dt>
          <dd>
            {measurement?.observedAt
              ? new Date(measurement.observedAt).toLocaleString()
              : "Unavailable"}
          </dd>
          <dt>Event cache</dt>
          <dd>
            {index
              ? `${index.events.length} events, through block ${BigInt(index.through).toLocaleString()}`
              : "Not loaded"}
          </dd>
          <dt>Data sources</dt>
          <dd>
            Sepolia contract state and Squeekchain sensor API. Live sensor
            status can lead settled rounds.
          </dd>
        </dl>
      </details>
      <TransactionStatus runtime={runtime} />
    </>
  );
}
function RaiderCard({
  runtime,
  raider,
  snapshot,
  restAt,
}: {
  runtime: Runtime;
  raider: Raider;
  snapshot: Snapshot;
  restAt: Record<string, bigint>;
}) {
  const { address } = useAccount();
  const r = raider.view.data;
  const { ready } = useTransactions();
  const art = useQuery({
    queryKey: ["art", String(raider.id)],
    queryFn: ({ signal }) => squeekArt(raider.id, signal),
    enabled: !r.isDemo,
    staleTime: 300000,
    retry: 1,
  });
  const controller = r.isDemo
    ? sameAddress(raider.controller, address)
    : raider.ownership === "wallet" || raider.ownership === "staked";
  const pending = r.pending.round > 0n;
  const canReplace =
    pending &&
    (r.pending.kind === 1 || r.pending.kind === 2) &&
    r.pending.round > snapshot.live;
  const levelCap = r.isDemo ? 3 : 5;
  const upgradeCost = 10n * 2n ** BigInt(r.level);
  const koBurrows = restAt[`${r.stance}:${r.epoch}`];
  const rested =
    raider.view.ko &&
    koBurrows !== undefined &&
    snapshot.burrowTotal - koBurrows >= 6n;
  return (
    <article className="raider-card">
      <div className="raider-picture">
        {raider.card ? (
          <img
            src={raider.card}
            alt={
              r.isDemo
                ? "On-chain demo hamster trading card"
                : `On-chain raider frame for Squeek ${raider.id}`
            }
            width="320"
            height="440"
          />
        ) : (
          <Hamster />
        )}
        {!r.isDemo && art.data && (
          <img
            className="squeek-overlay"
            src={art.data}
            alt={`Squeek ${raider.id} artwork`}
            width="160"
            height="160"
          />
        )}
      </div>
      <div className="raider-info">
        <div className="section-head">
          <h2>{r.isDemo ? "Demo raider" : `Squeek #${raider.id}`}</h2>
          <span className={raider.view.ko ? "warning-text" : "muted"}>
            {!r.enlisted
              ? "Not enlisted"
              : r.buried
                ? "Buried"
                : raider.view.ko
                  ? "KO’d"
                  : "Awake"}
          </span>
        </div>
        <p className="small muted">
          {!r.isDemo
            ? raider.ownership === "staked"
              ? "Staked · depositor confirmed"
              : raider.ownership === "wallet"
                ? "Wallet holder confirmed"
                : "Ownership unconfirmed"
            : "Free play · max level 3"}
          {!r.isDemo && art.isError ? " · artwork unavailable" : ""}
        </p>
        <dl className="raider-stats">
          <div>
            <dt>Stance</dt>
            <dd>{r.enlisted ? (STANCES[r.stance] ?? "Joining") : "None"}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>
              {r.level} / {levelCap}
            </dd>
          </div>
          <div>
            <dt>Scrap</dt>
            <dd>{number(r.scrap)}</dd>
          </div>
          <div>
            <dt>Dreams</dt>
            <dd>{number(r.dreams)}</dd>
          </div>
          <div>
            <dt>Lifetime score</dt>
            <dd>{number(raider.score)}</dd>
          </div>
          <div>
            <dt>Trophies</dt>
            <dd>{number(r.bossesSlain)}</dd>
          </div>
        </dl>
        {pending && (
          <p className="pending-note">
            {CHANGES[r.pending.kind]} → {STANCES[r.pending.to] ?? "None"}
            {r.pending.kind === 3 ? `, level ${r.pending.level}` : ""} · round{" "}
            {number(r.pending.round)}
            {r.pending.round <= snapshot.live ? " · awaiting settlement" : ""}
          </p>
        )}
        {!raider.view.caughtUp && (
          <Note>
            Credit is behind. Poke this raider until it is caught up before
            spending Scrap.
          </Note>
        )}
        <div className="card-actions">
          {!r.enlisted && (
            <Action
              actionKey={`enlist-${raider.id}`}
              label="Enlist as Guard"
              functionName="enlist"
              args={[[raider.id], 1]}
              disabled={!controller}
            />
          )}
          {r.enlisted && !r.buried && (
            <>
              <Action
                actionKey={`upgrade-${raider.id}`}
                label={
                  r.level >= levelCap
                    ? "Level cap"
                    : `Upgrade · ${number(upgradeCost)} Scrap`
                }
                functionName="upgrade"
                args={[raider.id]}
                disabled={
                  !controller ||
                  raider.view.ko ||
                  pending ||
                  r.level >= levelCap ||
                  r.scrap < upgradeCost ||
                  !raider.view.caughtUp
                }
              />
              {raider.view.ko && (
                <>
                  <Action
                    actionKey={`revive-${raider.id}`}
                    label="Revive · 20 Scrap"
                    functionName="revive"
                    args={[raider.id]}
                    disabled={
                      !controller ||
                      pending ||
                      r.scrap < 20n ||
                      !raider.view.caughtUp
                    }
                  />
                  <Action
                    actionKey={`rest-${raider.id}`}
                    label="Rest · free"
                    functionName="rest"
                    args={[[raider.id]]}
                    disabled={!rested || pending}
                  />
                </>
              )}
              <Action
                actionKey={`poke-${raider.id}`}
                label="Poke · checkpoint"
                functionName="poke"
                args={[[raider.id]]}
              />
            </>
          )}
        </div>
        {r.enlisted && !r.buried && (
          <p className="small muted">
            {raider.view.ko
              ? rested
                ? "Free rest is ready."
                : koBurrows === undefined
                  ? "Load the event cache to check free-rest eligibility."
                  : `${number(snapshot.burrowTotal - koBurrows)} / 6 settled Burrows since KO.`
              : pending && !canReplace
                ? "This change must settle before another action."
                : `Next stance change: round ${number(r.lastStanceRound + 6n)} or later.`}
          </p>
        )}
        {!controller && ready && (
          <p className="small warning-text">
            This wallet is not the confirmed controller.
          </p>
        )}
      </div>
    </article>
  );
}
function Squeeks({
  runtime,
  snapshot,
  ownership,
  index,
  manual,
  setManual,
  inventory,
  restAll,
}: {
  runtime: Runtime;
  snapshot?: Snapshot;
  ownership?: Record<string, "wallet" | "staked" | "unverified">;
  index?: EventIndex;
  manual: bigint[];
  setManual: (ids: bigint[]) => void;
  inventory: {
    loading: boolean;
    error?: string;
    hasMore: boolean;
    more: () => void;
    fetching: boolean;
    page: number;
    previous: () => void;
  };
  restAll: {
    ids: bigint[];
    loading: boolean;
    error?: string;
    complete: boolean;
  };
}) {
  const { address } = useAccount();
  const [ids, setIds] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<bigint[]>([]);
  const [stance, setStance] = useState(1);
  const facts = indexFacts(index);
  const raiders = snapshot?.raiders
    .filter((r) => (r.id >= DEMO_BIT ? r.view.data.enlisted : true))
    .map((r) => ({ ...r, ownership: ownership?.[String(r.id)] }));
  const confirmed =
    raiders?.filter(
      (r) =>
        r.view.data.isDemo ||
        r.ownership === "wallet" ||
        r.ownership === "staked",
    ) ?? [];
  const eligibleRest = restAll.ids.slice(0, 64);
  const selectedRaiders = confirmed.filter((r) => selected.includes(r.id));
  const canEnlist =
    selectedRaiders.length > 0 &&
    selectedRaiders.length === selected.length &&
    selectedRaiders.every((r) => !r.view.data.enlisted && r.id < DEMO_BIT);
  const canStance =
    selectedRaiders.length > 0 &&
    selectedRaiders.length === selected.length &&
    selectedRaiders.every(
      (r) =>
        r.view.data.enlisted &&
        !r.view.ko &&
        !r.view.data.buried &&
        r.view.caughtUp &&
        (!r.view.data.pending.round ||
          ((r.view.data.pending.kind === 1 || r.view.data.pending.kind === 2) &&
            r.view.data.pending.round > snapshot!.live)) &&
        (r.view.data.pending.round > snapshot!.live ||
          snapshot!.effective >= r.view.data.lastStanceRound + 6n),
    );
  return (
    <>
      <div className="page-title">
        <div>
          <h1>My Squeeks</h1>
          <p className="muted">Choose a stance. Let the hamster lead.</p>
        </div>
      </div>
      {!address && (
        <Note>
          Connect your wallet to find your Squeeks, including staked Squeeks.
        </Note>
      )}
      {inventory.loading && <Note>Loading the wallet’s Squeek inventory…</Note>}
      {inventory.error && <Note error>{inventory.error}</Note>}
      {address && snapshot && !confirmed.length && !inventory.loading && (
        <>
          <Note>
            No confirmed Squeeks on this page. Play free or look up a Squeek ID
            below.
          </Note>
          <FreePlay snapshot={snapshot} />
        </>
      )}
      <section className="batch-panel" aria-labelledby="party-actions">
        <h2 id="party-actions">Manage the party</h2>
        <div className="batch-layout">
          <StanceSelect value={stance} onChange={setStance} id="batch-stance" />
          <div className="button-row">
            <Action
              actionKey="batch-enlist"
              label={`Enlist selected (${selected.length})`}
              functionName="enlist"
              args={[selected, stance]}
              disabled={!canEnlist}
            />
            <Action
              actionKey="batch-stance"
              label={`Set stance (${selected.length})`}
              functionName="setStance"
              args={[selected, stance]}
              disabled={!canStance}
            />
            <Action
              actionKey="rest-all"
              label={
                restAll.loading
                  ? "Checking all KO’d…"
                  : restAll.ids.length > 64
                    ? `Rest next 64 of ${restAll.ids.length} KO’d`
                    : `Rest all eligible KO’d (${eligibleRest.length})`
              }
              functionName="rest"
              args={[eligibleRest]}
              disabled={
                !eligibleRest.length || !restAll.complete || restAll.loading
              }
            />
          </div>
        </div>
        <p className="small muted">
          Enlist and stance changes cost 0 Scrap. Rest is free after six settled
          Burrows since KO. Up to 64 Squeeks per batch. Rest checks every wallet
          inventory page.
        </p>
        {restAll.error && <p className="small error-text">{restAll.error}</p>}
      </section>
      <TransactionStatus runtime={runtime} />
      <div className="raiders-list">
        {raiders?.map((raider) => (
          <div className="selectable-raider" key={String(raider.id)}>
            <label className="selection">
              <input
                type="checkbox"
                checked={selected.includes(raider.id)}
                disabled={!confirmed.some((r) => r.id === raider.id)}
                onChange={(e) =>
                  setSelected((old) =>
                    e.target.checked
                      ? [...old, raider.id]
                      : old.filter((id) => id !== raider.id),
                  )
                }
              />
              <span>
                Select{" "}
                {raider.view.data.isDemo ? "demo" : `Squeek #${raider.id}`}
              </span>
            </label>
            <RaiderCard
              runtime={runtime}
              raider={raider}
              snapshot={snapshot!}
              restAt={facts.restAt}
            />
          </div>
        ))}
      </div>
      {!manual.length && (
        <div className="button-row">
          <button disabled={inventory.page === 0} onClick={inventory.previous}>
            Previous Squeeks
          </button>
          <span className="small muted">Page {inventory.page + 1}</span>
          <button
            disabled={inventory.fetching || !inventory.hasMore}
            onClick={inventory.more}
          >
            {inventory.fetching ? "Loading…" : "Next Squeeks"}
          </button>
        </div>
      )}
      <details className="utility-panel">
        <summary>Look up Squeek IDs</summary>
        <p className="muted">
          Use this if the inventory API is unavailable. Ownership is always
          confirmed on chain.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const parsed = validIds(ids, false);
              if (parsed.length > 6)
                throw new Error("Look up at most 6 Squeeks at a time.");
              setManual(parsed);
              setError("");
            } catch (error) {
              setError(friendlyError(error));
            }
          }}
        >
          <label className="field" htmlFor="lookup-ids">
            Squeek IDs
            <input
              id="lookup-ids"
              name="squeekIds"
              inputMode="numeric"
              value={ids}
              onChange={(e) => setIds(e.target.value)}
              placeholder="1, 2, 3"
              aria-invalid={!!error}
              aria-describedby="lookup-error"
            />
          </label>
          <button type="submit">Load Squeeks</button>
          <p id="lookup-error" className="error-text" role="status">
            {error}
          </p>
        </form>
        {manual.length > 0 && (
          <button
            onClick={() => {
              setManual([]);
              setIds("");
            }}
          >
            Clear lookup
          </button>
        )}
      </details>
      <Maintenance runtime={runtime} />
    </>
  );
}
function Maintenance({ runtime }: { runtime: Runtime }) {
  const [input, setInput] = useState("");
  const [ids, setIds] = useState<bigint[]>([]);
  const [error, setError] = useState("");
  const state = useQuery({
    queryKey: ["maintenance-state", ids.map(String).join(",")],
    queryFn: () => readSnapshot(runtime, ids, []),
    enabled: ids.length > 0,
    staleTime: 15000,
    retry: 1,
  });
  const stateReady = !!state.data && !state.isError && !state.isFetching;
  return (
    <details className="utility-panel">
      <summary>Permissionless maintenance</summary>
      <p className="muted">
        Poke checkpoints rewards. Bury permanently unpowers a burned real NFT.
        Both require only network gas. Bury must pass the contract’s burned-NFT
        check.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setIds(validIds(input));
            setError("");
          } catch (error) {
            setError(friendlyError(error));
          }
        }}
      >
        <label className="field" htmlFor="maintenance-ids">
          Raider IDs
          <input
            id="maintenance-ids"
            name="raiderIds"
            inputMode="numeric"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setIds([]);
            }}
            placeholder="1, 2"
            aria-describedby="maintenance-error"
            aria-invalid={!!error}
          />
        </label>
        <button type="submit">Check IDs</button>
        <p className="error-text" id="maintenance-error" role="status">
          {error}
        </p>
      </form>
      {state.isFetching && (
        <p role="status" className="small muted">
          Reading raider state…
        </p>
      )}
      {state.error && (
        <p className="error-text">{friendlyError(state.error)}</p>
      )}
      {state.data && (
        <ul className="maintenance-state">
          {state.data.raiders.map((raider) => (
            <li key={String(raider.id)} className="small break-all">
              ID {raider.id.toString()}:{" "}
              {!raider.view.data.enlisted
                ? "not enlisted"
                : raider.view.data.buried
                  ? "buried"
                  : raider.view.ko
                    ? "KO’d"
                    : "awake"}
              ; {number(raider.view.data.scrap)} Scrap;{" "}
              {raider.view.caughtUp ? "credit current" : "needs Poke"};{" "}
              {raider.view.data.pending.round
                ? `pending round ${number(raider.view.data.pending.round)}`
                : "no pending change"}
              .
            </li>
          ))}
        </ul>
      )}
      <div className="button-row">
        <Action
          actionKey="maintenance-poke"
          label="Poke IDs"
          functionName="poke"
          args={[ids]}
          disabled={!ids.length || !stateReady}
        />
        <Action
          actionKey="maintenance-rest"
          label="Rest IDs · free"
          functionName="rest"
          args={[ids]}
          disabled={!ids.length || !stateReady}
        />
        <Action
          actionKey="bury"
          label="Bury burned Squeek"
          functionName="bury"
          args={[ids[0]]}
          disabled={ids.length !== 1 || ids[0] >= DEMO_BIT || !stateReady}
          confirm="Bury permanently removes this burned Squeek from the raid. Historical scores remain. Continue with bury?"
        />
      </div>
    </details>
  );
}
function Leaderboards({
  runtime,
  snapshot,
  index,
  indexLoading,
  indexError,
}: {
  runtime: Runtime;
  snapshot?: Snapshot;
  index?: EventIndex;
  indexLoading: boolean;
  indexError?: string;
}) {
  const [kind, setKind] = useState<"boss" | "season">("boss");
  const [periodInput, setPeriodInput] = useState("");
  const [period, setPeriod] = useState<bigint>();
  const [periodError, setPeriodError] = useState("");
  const [group, setGroup] = useState<"squeek" | "wallet">("squeek");
  const [demo, setDemo] = useState(false);
  const facts = useMemo(() => indexFacts(index), [index]);
  const current = kind === "boss" ? snapshot?.boss.id : snapshot?.boss.seasonId;
  const chosen = period ?? current;
  const leaderboard = useQuery({
    queryKey: [
      "scores",
      facts.ids.map(String).join(","),
      kind,
      String(chosen),
      index?.hash,
    ],
    queryFn: ({ signal }) => scores(runtime, facts.ids, kind, chosen!, signal),
    enabled: !!chosen && !!index,
    staleTime: 15000,
    retry: 1,
  });
  let rows = (leaderboard.data ?? []).filter((r) => r.isDemo === demo);
  if (group === "wallet") {
    const wallets = new Map<string, ScoreRow>();
    for (const row of rows) {
      if (!row.controller || BigInt(row.controller) === 0n) continue;
      const key = row.controller.toLowerCase();
      const previous = wallets.get(key);
      wallets.set(key, { ...row, score: row.score + (previous?.score ?? 0n) });
    }
    rows = [...wallets.values()].sort((a, b) =>
      a.score > b.score ? -1 : a.score < b.score ? 1 : 0,
    );
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Leaderboards</h1>
          <p className="muted">Damage + 300 × Dreams. No prizes.</p>
        </div>
      </div>
      <div className="leader-controls">
        <label className="field">
          Score period
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setPeriod(undefined);
              setPeriodInput("");
            }}
          >
            <option value="boss">Per boss</option>
            <option value="season">Per season</option>
          </select>
        </label>
        <label className="field">
          Rank by
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
          >
            <option value="squeek">Squeek</option>
            <option value="wallet">Wallet</option>
          </select>
        </label>
        <label className="field">
          Raiders
          <select
            value={String(demo)}
            onChange={(e) => setDemo(e.target.value === "true")}
          >
            <option value="false">Real Squeeks</option>
            <option value="true">Demos only</option>
          </select>
        </label>
      </div>
      <form
        className="period-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            /^\d+$/.test(periodInput) &&
            BigInt(periodInput) > 0n &&
            BigInt(periodInput) < 1n << 64n
          ) {
            setPeriod(BigInt(periodInput));
            setPeriodError("");
          } else
            setPeriodError(
              "Enter a whole-number period from 1 to 18,446,744,073,709,551,615.",
            );
        }}
      >
        <label className="field" htmlFor="period">
          {kind === "boss" ? "Boss" : "Season"} number
          <input
            id="period"
            name="period"
            aria-invalid={!!periodError}
            aria-describedby="period-error"
            inputMode="numeric"
            pattern="[0-9]+"
            value={periodInput}
            onChange={(e) => setPeriodInput(e.target.value)}
            placeholder={String(current ?? "")}
            required
          />
        </label>
        <button type="submit">View period</button>
        <button
          type="button"
          onClick={() => {
            setPeriod(undefined);
            setPeriodInput("");
          }}
        >
          Current
        </button>
      </form>
      <p id="period-error" role="status" className="error-text">
        {periodError}
      </p>
      <div className="section-head leaderboard-heading">
        <h2>
          {kind === "boss" ? "Boss" : "Season"} {chosen ? number(chosen) : "…"}
        </h2>
        <span className="small muted">
          {demo ? "Demo raiders" : "Real Squeeks"} ·{" "}
          {group === "wallet" ? "current controllers" : "individual scores"}
        </span>
      </div>
      {indexLoading && <Note>Discovering raiders from deployment events…</Note>}
      {indexError && (
        <Note error>{indexError} Rankings may be incomplete.</Note>
      )}
      {leaderboard.isFetching && <Note>Reading exact on-chain scores…</Note>}
      {leaderboard.error && (
        <Note error>{friendlyError(leaderboard.error)}</Note>
      )}
      {!leaderboard.isFetching &&
        !indexLoading &&
        index &&
        !leaderboard.error &&
        !rows.length && (
          <Note>
            No {demo ? "demo" : "real Squeek"} entries in the indexed events.
            Play a round to join the raid.
          </Note>
        )}
      {rows.length > 0 && (
        <table className="score-table">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">{group === "wallet" ? "Wallet" : "Raider"}</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={group === "wallet" ? row.controller : String(row.id)}>
                <td>{i + 1}</td>
                <td>
                  {group === "wallet" ? (
                    <AddressLink runtime={runtime} address={row.controller!} />
                  ) : row.isDemo ? (
                    <>
                      Demo{" "}
                      <span className="small break-all">
                        {row.controller
                          ? shortAddress(row.controller)
                          : "unavailable"}
                      </span>
                    </>
                  ) : (
                    `Squeek #${row.id}`
                  )}
                </td>
                <td>{number(row.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">
        IDs come from Enlisted events, scores from{" "}
        {kind === "boss" ? "scoreOf" : "seasonScoreOf"}. Wallet totals follow
        current controllers, including staking depositors. Burned Squeeks remain
        in individual history.{" "}
        {index
          ? `Indexed blocks ${BigInt(index.from).toLocaleString()}–${BigInt(index.through).toLocaleString()}.`
          : ""}
      </p>
    </>
  );
}
function AddressLink({
  runtime,
  address,
}: {
  runtime: Runtime;
  address: Address;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="address-control">
      <a
        className="break-all"
        href={`${runtime.deployment.manifest.network.explorer}/address/${address}`}
        target="_blank"
        rel="noreferrer"
      >
        {getAddress(address)}
      </a>
      <button
        className="copy-button"
        onClick={() =>
          void navigator.clipboard.writeText(getAddress(address)).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
function Rules() {
  return (
    <div className="rules">
      <div className="page-title">
        <div>
          <h1>How it works</h1>
          <p className="muted">
            A cooperative raid. The hamster sets the pace.
          </p>
        </div>
      </div>
      <section>
        <h2>Play at the hamster’s pace</h2>
        <p>
          A real hamster’s settled wheel work powers the raid. Wheel rounds deal
          damage. Idle rounds are Burrow rounds; two consecutive Burrows begin a
          nap. Each round is ten minutes. Nothing in this game rewards more
          running.
        </p>
        <p>
          This is an unofficial community game on the Sepolia TEST NETWORK, not
          the Squeek mint. There are no fees, prizes, payouts or valuable game
          tokens. Scrap, Dreams and scores are just game counters. You need
          Sepolia ETH for network gas; USD context is unavailable.
        </p>
      </section>
      <section>
        <h2>Four ways to help</h2>
        <table>
          <thead>
            <tr>
              <th>Stance</th>
              <th>Wheel damage multiplier</th>
              <th>Burrow role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Striker</td>
              <td>150</td>
              <td>Heavy damage</td>
            </tr>
            <tr>
              <td>Guard</td>
              <td>50</td>
              <td>Never targeted; covers real raiders</td>
            </tr>
            <tr>
              <td>Forager</td>
              <td>80</td>
              <td>+1 Scrap</td>
            </tr>
            <tr>
              <td>Dreamer</td>
              <td>25</td>
              <td>+1 Dream</td>
            </tr>
          </tbody>
        </table>
        <p>
          Wheel damage is work × stance multiplier × (100 + 10 × level) /
          10,000. All live raiders gain 1 Scrap per Wheel. Burrow rewards apply
          only on streak rounds 2–37. Score is damage + 300 × Dreams. Levels
          boost damage only.
        </p>
      </section>
      <section>
        <h2>Watch the owl’s next move</h2>
        <p>
          After an observed Wheel, a nap reveals a move: Frenzy targets
          Strikers, Quake targets Foragers, Nightmare targets Dreamers. It lands
          before damage on the next Wheel only if the nap reaches 18 consecutive
          Burrows. A nap with no observed Wheel has no move yet.
        </p>
        <p>
          One real Guard covers two real targets. Cover requires at least one
          real target. Demo guards and demo targets do not count toward cover; a
          successful block protects the whole target stance. Without cover, the
          targeted live cohort is KO’d. KO’d raiders earn nothing until they
          return.
        </p>
      </section>
      <section>
        <h2>Changes take a little time</h2>
        <p>
          Enlisting, stances, upgrades and revivals queue for the round after
          the current live round. You can replace a stance or enlist change
          until its effective round starts. There is one pending change per
          raider and a six-effective-round stance cooldown. Settlement lag
          cannot move a new action into a past round.
        </p>
        <p>
          An upgrade costs 10 × 2^current level Scrap, paid now. Real raiders
          cap at level 5; demos at 3. Upgrades cannot be replaced. A KO before
          the upgrade takes effect cancels it with no Scrap refund, even if that
          KO has not been processed when you pay. A queued revive is not
          canceled this way.
        </p>
        <p>
          Revive costs 20 Scrap. Free rest becomes available after six settled
          Burrow rounds since the KO; they need not be consecutive. Anyone can
          rest eligible raiders. Batch actions are atomic: one ineligible ID
          stops the whole batch.
        </p>
      </section>
      <section>
        <h2>A shared boss, a fresh season</h2>
        <p>
          Boss health uses the previous hamster run, clamped between 1,000 and
          12,000 work, and the live party’s equipment weight. Three tiers grow
          by 1.3× each; three bosses make a season. Health rescales when party
          weight changes. Overkill stays on the slain boss. A raider with a
          positive score earns a trophy for that boss.
        </p>
        <p>
          Rewards checkpoint lazily, at most eight boss segments at a time. Poke
          until caught up if a raider’s credit is behind. Individual boss and
          season score reads remain exact. Transferring a Squeek transfers its
          game state; a staked Squeek belongs to its recorded depositor for game
          controls. Demos are permanent and cannot transfer.
        </p>
      </section>
      <section>
        <h2>What the page knows</h2>
        <p>
          Game reads simulate advance(128) then read views in one Multicall3
          call. This preview does not save progress. The Advance button sends
          advance(64). Events are read from the deployment block in pages of at
          most 10,000 blocks and cached locally; a changed block hash resets the
          cache.
        </p>
        <p>
          Live hamster status is a sensor feed and can be ahead of settled game
          rounds. If a source fails, the page says so and disables actions that
          lack their prerequisites. Every write is simulated with your wallet
          address before signing, and stays pending until its receipt. No owner,
          administrator, pause or recovery switch exists.
        </p>
      </section>
    </div>
  );
}
export default function App({ runtime }: { runtime: Runtime }) {
  const route = useRoute();
  const account = useAccount();
  const [manual, setManual] = useState<bigint[]>([]);
  const [page, setPage] = useState(0);
  const [indexProgress, setIndexProgress] = useState("");
  const inventory = useInfiniteQuery({
    queryKey: ["inventory", account.address],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      accountPage(runtime, account.address!, pageParam, signal),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!account.address,
    staleTime: 30000,
    retry: 1,
  });
  const apiIds =
    inventory.data?.pages.flatMap((p) =>
      p.tokens.map((t) => BigInt(t.tokenId)),
    ) ?? [];
  const visibleIds = manual.length
    ? manual
    : apiIds.slice(page * 6, page * 6 + 6);
  const ids = [
    ...new Set(
      [
        ...visibleIds,
        ...(account.address ? [demoId(account.address)] : []),
      ].map(String),
    ),
  ].map(BigInt);
  const idsKey = ids.map(String).join(",");
  const verification = useQuery({
    queryKey: ["verification"],
    queryFn: () => verifyCode(runtime),
    retry: 1,
    staleTime: 60000,
  });
  const snapshot = useQuery({
    queryKey: ["snapshot", account.address, idsKey],
    queryFn: () => readSnapshot(runtime, ids),
    refetchInterval: 15000,
    retry: 1,
  });
  const ownership = useQuery({
    queryKey: [
      "ownership",
      account.address,
      idsKey,
      snapshot.data?.nft,
      String(snapshot.data?.block),
    ],
    queryFn: () =>
      confirmOwnership(runtime, snapshot.data!, visibleIds, account.address!),
    enabled: !!account.address && !!snapshot.data,
    staleTime: 15000,
    retry: 1,
  });
  const status = useQuery({
    queryKey: ["live"],
    queryFn: ({ signal }) => getLiveStatus(signal),
    refetchInterval: 15000,
    retry: 1,
  });
  const events = useQuery({
    queryKey: ["events"],
    queryFn: ({ signal }) => indexEvents(runtime, signal, setIndexProgress),
    enabled: verification.data === true,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });
  useEffect(() => {
    setPage(0);
    setManual([]);
  }, [account.address]);
  const data = snapshot.data;
  const stale = !!data && (snapshot.isError || Date.now() - data.time > 45000);
  const verified =
    verification.data === true && !verification.isError && !!data && !stale;
  const restAll = useQuery({
    queryKey: [
      "rest-candidates",
      account.address,
      String(data?.block),
      events.data?.hash,
    ],
    enabled:
      route === "squeeks" && !!account.address && !!data && !!events.data,
    staleTime: 15000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const allIds: bigint[] = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      do {
        signal.throwIfAborted();
        const page = await accountPage(
          runtime,
          account.address!,
          cursor,
          signal,
        );
        allIds.push(...page.tokens.map((t) => BigInt(t.tokenId)));
        const next = page.nextCursor ?? undefined;
        if (next && seen.has(next))
          throw new Error(
            "The inventory cursor repeated. Retry inventory before resting all.",
          );
        if (next) seen.add(next);
        cursor = next;
      } while (cursor);
      allIds.push(demoId(account.address!));
      const facts = indexFacts(events.data);
      const eligible: bigint[] = [];
      const unique = [...new Set(allIds.map(String))].map(BigInt);
      for (let i = 0; i < unique.length; i += 48) {
        signal.throwIfAborted();
        const state = await readSnapshot(runtime, unique.slice(i, i + 48), []);
        for (const raider of state.raiders) {
          const r = raider.view.data;
          const at = facts.restAt[`${r.stance}:${r.epoch}`];
          if (
            sameAddress(raider.controller, account.address) &&
            r.enlisted &&
            !r.buried &&
            raider.view.ko &&
            raider.view.caughtUp &&
            !r.pending.round &&
            at !== undefined &&
            state.burrowTotal - at >= 6n
          )
            eligible.push(raider.id);
        }
      }
      return eligible;
    },
  });
  async function refresh() {
    await Promise.all([
      snapshot.refetch(),
      events.refetch(),
      ownership.refetch(),
      verification.refetch(),
    ]);
  }
  return (
    <Transactions runtime={runtime} verified={verified}>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href="#/raid">
          <Hamster className="brand-mark" />
          <span>SqueekRaider</span>
        </a>
        <Wallet runtime={runtime} />
      </header>
      <div className="network-strip">
        <span>
          <span className="network-dot" aria-hidden="true" /> Sepolia{" "}
          <strong>TEST NETWORK</strong>
        </span>
        <span>No prizes</span>
      </div>
      <nav className="main-nav" aria-label="Main navigation">
        {routes.map(([id, label]) => (
          <a
            key={id}
            href={`#/${id}`}
            aria-current={route === id ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>
        {verification.error && (
          <Note error>{friendlyError(verification.error)}</Note>
        )}
        {snapshot.error && (
          <div className="notice error-text">
            <p>
              {friendlyError(snapshot.error)}{" "}
              {data
                ? "The last successful read is shown; actions are disabled."
                : "Game state is unavailable; actions are disabled."}
            </p>
            <button onClick={() => void refresh()}>Retry reads</button>
          </div>
        )}
        {account.isConnected && account.chainId !== runtime.chain.id && (
          <Note error>
            Wrong network. Use Switch to {runtime.chain.name} in the header to
            continue.
          </Note>
        )}
        {route === "raid" ? (
          <Raid
            runtime={runtime}
            snapshot={data}
            index={events.data}
            liveStatus={status.data}
            liveError={status.isError}
          />
        ) : route === "squeeks" ? (
          <Squeeks
            key={account.address ?? "disconnected"}
            runtime={runtime}
            snapshot={data}
            ownership={ownership.data}
            index={events.data}
            manual={manual}
            setManual={setManual}
            inventory={{
              loading: inventory.isLoading && !!account.address,
              error: inventory.error
                ? friendlyError(inventory.error)
                : ownership.error
                  ? friendlyError(ownership.error)
                  : undefined,
              hasMore:
                !!inventory.hasNextPage ||
                (!manual.length && (page + 1) * 6 < apiIds.length),
              fetching: inventory.isFetchingNextPage,
              page,
              previous: () => setPage((p) => Math.max(0, p - 1)),
              more: () => {
                if ((page + 1) * 6 < apiIds.length) setPage((p) => p + 1);
                else
                  void inventory
                    .fetchNextPage()
                    .then(() => setPage((p) => p + 1));
              },
            }}
            restAll={{
              ids: restAll.data ?? [],
              loading: restAll.isFetching,
              complete: restAll.isSuccess && !restAll.isError,
              error: restAll.error ? friendlyError(restAll.error) : undefined,
            }}
          />
        ) : route === "leaderboards" ? (
          <Leaderboards
            runtime={runtime}
            snapshot={data}
            index={events.data}
            indexLoading={events.isFetching}
            indexError={events.error ? friendlyError(events.error) : undefined}
          />
        ) : route === "rules" ? (
          <Rules />
        ) : (
          <>
            <h1>Page not found</h1>
            <a href="#/raid">Return to the raid</a>
          </>
        )}
        <div className="refresh-row">
          <span className="small muted">
            {snapshot.isFetching
              ? "Reading Sepolia…"
              : data
                ? `Read at ${new Date(data.time).toLocaleTimeString()}`
                : "Waiting for Sepolia"}
            {stale ? " · stale" : ""}
          </span>
          <button disabled={snapshot.isFetching} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        {events.isFetching && (
          <p className="small muted" role="status">
            {indexProgress}
          </p>
        )}
        {events.error && route !== "leaderboards" && (
          <p className="small error-text">
            Event history unavailable. Refresh to retry. Move history and
            free-rest eligibility may be unknown.
          </p>
        )}
      </main>
      <footer className="site-footer">
        <div>
          <strong>SqueekRaider</strong>
          <p className="small muted">
            Unofficial community game. Not the Squeek mint.
          </p>
        </div>
        <details>
          <summary>Contracts & network</summary>
          <div className="contract-details">
            <p className="small">
              {runtime.chain.name} · chain {runtime.chain.id}
            </p>
            <p>Game</p>
            <AddressLink
              runtime={runtime}
              address={runtime.deployment.address}
            />
            {data &&
              (
                [
                  ["Core", data.core],
                  ["NFT", data.nft],
                  ["Staking", data.staking],
                  ["Card renderer", data.renderer],
                ] as [string, Address][]
              ).map(([name, address]) => (
                <div key={name}>
                  <p>{name}</p>
                  <AddressLink runtime={runtime} address={address} />
                </div>
              ))}
            <a href="./imd-deployment.json">Deployment manifest</a>
            <a
              href={`${runtime.deployment.manifest.network.explorer}/address/${runtime.deployment.address}#code`}
              target="_blank"
              rel="noreferrer"
            >
              Contract on explorer ↗
            </a>
            <p className="small muted">
              Keyless public RPCs. No site analytics. External wallet services
              have their own policies.
            </p>
          </div>
        </details>
      </footer>
    </Transactions>
  );
}
