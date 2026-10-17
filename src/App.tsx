import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calldataBytes, CALLDATA_LIMIT } from "./lib/calldata";
import { CONTRACT_ADDRESS, EXPLORER_BASE, SOURCE_SHA256 } from "./lib/config";
import { errorMessage } from "./lib/errors";
import { formatGen, gen, parseGen } from "./lib/gen";
import { connectedWallet, getCredits, getGame, getLimits, requestWallet, sendWrite, waitForVerdict } from "./lib/genlayer";
import { commitmentOf, gameIdOf, idsFromInput, randomSalt, short } from "./lib/ids";
import type { Limits } from "./lib/parse";
import { pyLen, pyStrip } from "./lib/pytext";
import {
  answerBlock, askBlock, deadlineLine, forfeitBlock, guessBlock, isPlayer, isKeeper, MAX_QUESTION_LENGTH, MAX_QUESTIONS,
  MAX_SECRET_LENGTH, openBlock, REVERTS, revealBlock, stampOf, turnLine, UI, withdrawBlock,
} from "./lib/rules";
import type { Credits, Game, TxStatus } from "./lib/types";
import { answerVerified, askVerified, forfeitVerified, guessVerified, openVerified, revealVerified, withdrawalRequested } from "./lib/verify";

type Verify = () => Promise<string | null>;
type View = "overview" | "games" | "open" | "credits" | "verify";
type Kept = { secret: string; salt: string };

const IDLE: TxStatus = { phase: "idle", message: "" };
const NAV: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "games", label: "Game Rooms", icon: "?" },
  { id: "open", label: "Open a Game", icon: "✦" },
  { id: "credits", label: "Credits", icon: "◎" },
  { id: "verify", label: "Verification", icon: "</>" },
];
const GAMES_KEY = `twentyasks.v2.${CONTRACT_ADDRESS}.games`;
const SECRETS_KEY = `twentyasks.v2.${CONTRACT_ADDRESS}.secrets`;
const GUESSED_KEY = `twentyasks.v2.${CONTRACT_ADDRESS}.guessed`;

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the URL still carries the rooms; the keeper keeps the salt */
  }
}

function idsFromUrl(): string[] {
  return idsFromInput(new URLSearchParams(window.location.search).get("g") ?? "");
}

function saveIds(ids: string[]) {
  writeStore(GAMES_KEY, ids.join(","));
  const url = new URL(window.location.href);
  if (ids.length) url.searchParams.set("g", ids.join(","));
  else url.searchParams.delete("g");
  window.history.replaceState(null, "", url.toString());
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export default function App() {
  const fromUrl = idsFromUrl();
  const [view, setView] = useState<View>(fromUrl.length ? "games" : "overview");
  const [me, setMe] = useState("");
  const [ids, setIds] = useState<string[]>(fromUrl.length ? fromUrl : idsFromInput(readStore<string>(GAMES_KEY, "")));
  const [items, setItems] = useState<Record<string, Game | null>>({});
  const [limits, setLimits] = useState<Limits | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");

  const [kept, setKept] = useState<Record<string, Kept>>(() => readStore<Record<string, Kept>>(SECRETS_KEY, {}));
  const [guessed, setGuessed] = useState<string[]>(() => readStore<string[]>(GUESSED_KEY, []));
  const [askDrafts, setAskDrafts] = useState<Record<string, string>>({});
  const [guessDrafts, setGuessDrafts] = useState<Record<string, string>>({});
  const [revealDrafts, setRevealDrafts] = useState<Record<string, Kept>>({});

  const [player, setPlayer] = useState("");
  const [deliveryChecked, setDeliveryChecked] = useState(false);
  const [secret, setSecret] = useState("");
  const [salt, setSalt] = useState(() => randomSalt());
  const [bond, setBond] = useState("0.01");
  const [taken, setTaken] = useState(false);

  const pendingKey = `twentyasks.v2.${CONTRACT_ADDRESS}.pending`;
  const [pendingTx, setPendingTx] = useState<{hash:string; method:string; account:string} | null>(() => readStore(pendingKey, null));
  const [status, setStatus] = useState<TxStatus>(() => {
    const saved = readStore<{hash:string;method:string} | null>(pendingKey,null);
    return saved ? {phase:"delayed",message:"A previous transaction is unresolved. Recheck it before sending another.",hash:saved.hash,action:saved.method} : IDLE;
  });
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const recheck = useRef<Verify | null>(null);

  // ---------- reads ----------
  const loadItems = useCallback(async (list: string[]) => {
    const entries = await Promise.all(list.map(async (id) => {
      try {
        return [id, await getGame(id)] as const;
      } catch {
        return [id, null] as const;
      }
    }));
    setItems((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  const loadCredits = useCallback(async (wallet: string) => {
    if (!wallet) return setCredits(null);
    try {
      setCredits(await getCredits(wallet));
    } catch {
      setCredits(null);
    }
  }, []);

  useEffect(() => {
    connectedWallet().then(setMe).catch(() => setMe(""));
    window.ethereum?.on?.("accountsChanged", (accounts: string[]) => {
      setMe((accounts?.[0] ?? "").toLowerCase());
      setDeliveryChecked(false);
      recheck.current = null;
      setStatus(IDLE);
      setFresh(null);
    });
    getLimits().then(setLimits).catch(() => setLimits(null));
  }, []);

  useEffect(() => {
    void loadCredits(me);
  }, [me, loadCredits]);

  useEffect(() => {
    saveIds(ids);
    void loadItems(ids);
  }, [ids, loadItems]);

  useEffect(() => writeStore(SECRETS_KEY, kept), [kept]);
  useEffect(() => writeStore(GUESSED_KEY, guessed), [guessed]);

  // ---------- derived ----------
  const bondCheck = parseGen(bond);
  const bondWei = bondCheck.ok ? bondCheck.wei : null;
  const newCommitment = pyLen(pyStrip(secret)) > 0 && salt ? commitmentOf(secret, salt) : "";
  const newId = me && newCommitment ? gameIdOf(me, newCommitment) : "";
  useEffect(() => {
    let live = true;
    setTaken(false);
    if (!newId) return;
    const t = setTimeout(() => {
      getGame(newId).then((g) => live && setTaken(!!g)).catch(() => undefined);
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [newId]);
  const openReason = openBlock({ me, secret, salt, bondWei, exists: taken, player }) || (calldataBytes("reveal", [newId || "0".repeat(64), secret, salt]) > CALLDATA_LIMIT ? "Secret and salt would exceed the reveal calldata limit; shorten them before bonding." : null);
  const openBytes = useMemo(() => calldataBytes("open_game", [newCommitment || "0".repeat(64), player || "0x" + "1".repeat(40)]), [newCommitment, player]);
  const withdrawReason = withdrawBlock(me, credits);
  useEffect(() => writeStore(pendingKey, pendingTx), [pendingKey, pendingTx]);
  const rooms = ids.map((id) => [id, items[id]] as const);
  const guessKey = (id: string) => `${id}|${me.toLowerCase()}`;

  // ---------- writes ----------
  async function connect() {
    try {
      setMe(await requestWallet());
    } catch (e) {
      setStatus({ phase: "error", message: errorMessage(e) });
    }
  }

  async function runWrite(action: string, method: string, args: unknown[], value: bigint, verify: Verify) {
    if (pendingTx) { setStatus({phase:"delayed",hash:pendingTx.hash,action:pendingTx.method,message:"Recheck the previous transaction before sending another."}); return; }
    if (limits?.version !== "2.0.0") { setStatus({phase:"error", message:"Configure and verify a new HonestKeeper v2 deployment before signing."}); return; }
    if (calldataBytes(method, args) > CALLDATA_LIMIT) { setStatus({phase:"error", message:UI.tooManyBytes}); return; }
    setBusy(true);
    recheck.current = null;
    try {
      setStatus({ phase: "signing", message: "Confirm the transaction in your wallet…", action });
      const hash = await sendWrite(me, method, args, value);
      const pending = {hash,method,account:me};
      writeStore(pendingKey,pending); setPendingTx(pending);
      setStatus({ phase: "submitted", message: "Submitted. Waiting for validators to accept it…", hash, action });
      const verdict = await waitForVerdict(hash);
      if (verdict.kind === "error") {
        writeStore(pendingKey,null); setPendingTx(null);
        setStatus({ phase: "error", message: verdict.reason, hash, action });
        return;
      }
      if (verdict.kind === "pending") {
        recheck.current = verify;
        setStatus({ phase: "delayed", message: "Submitted — confirmation delayed. Check again re-reads the accepted state; do not send it twice.", hash, action });
        return;
      }
      setStatus({ phase: "checking", message: "Executed. Reading the accepted state…", hash, action });
      const done = await verify();
      if (done) {
        writeStore(pendingKey,null); setPendingTx(null);
        setStatus({ phase: "success", message: done, hash, action });
      } else {
        recheck.current = verify;
        setStatus({ phase: "delayed", message: "Executed, but the accepted state does not show the change yet. Check again in a moment.", hash, action });
      }
    } catch (e) {
      setStatus({ phase: "error", message: errorMessage(e), action });
    } finally {
      setBusy(false);
    }
  }

  async function checkAgain() {
    if (!pendingTx) return;
    setBusy(true);
    try {
      const verdict=await waitForVerdict(pendingTx.hash);
      if(verdict.kind === "pending") {
        setStatus({phase:"delayed",hash:pendingTx.hash,action:pendingTx.method,message:"Still unresolved. Do not resend; inspect the explorer and recheck later."});
        return;
      }
      if(verdict.kind === "error") {
        setStatus({phase:"error",hash:pendingTx.hash,action:pendingTx.method,message:verdict.reason});
      } else {
        const done = recheck.current && me === pendingTx.account ? await recheck.current() : null;
        await loadItems(ids); await loadCredits(me);
        setStatus({phase:done ? "success" : "idle",hash:pendingTx.hash,action:pendingTx.method,
          message:done ?? "Execution accepted. State reloaded; review it before proceeding. A withdrawal still needs separate external-delivery evidence."});
      }
      writeStore(pendingKey,null); setPendingTx(null); recheck.current=null;
    } catch(e) { setStatus((s)=>({...s,phase:"delayed",message:errorMessage(e)})); }
    finally { setBusy(false); }
  }

  function addRooms(list: string[]) {
    setIds((prev) => [...list.filter((id) => !prev.includes(id)), ...prev]);
  }

  function putGame(g: Game | null, id: string) {
    setItems((prev) => ({ ...prev, [id]: g }));
  }

  async function onOpen() {
    if (openReason || bondWei === null) return;
    const s = { id: gameIdOf(me, newCommitment), me, commitment: newCommitment, bondWei, player };
    if (await getGame(s.id)) {
      setTaken(true);
      return;
    }
    // Keep the secret and salt BEFORE signing: the reveal needs both exactly.
    setKept((k) => ({ ...k, [s.id]: { secret: pyStrip(secret), salt } }));
    await runWrite("Open", "open_game", [newCommitment, player], bondWei, async () => {
      const g = await getGame(s.id);
      if (!openVerified(g, s)) return null;
      putGame(g, s.id);
      addRooms([s.id]);
      setSecret("");
      setSalt(randomSalt());
      setFresh(s.id);
      setView("games");
      return `Invitation created with ${gen(bondWei)} bonded. Share the room with the designated player; keep your secret and salt.`;
    });
  }

  async function onAsk(g0: Game) {
    const id = g0.game_id;
    const text = askDrafts[id] ?? "";
    const g = await getGame(id);
    if (!g) return;
    putGame(g, id);
    if (askBlock(g, me, text, calldataBytes("ask", [id, text]))) return;
    await runWrite("Ask", "ask", [id, pyStrip(text)], 0n, async () => {
      const after = await getGame(id);
      if (!askVerified(g, after, me, text)) return null;
      putGame(after, id);
      setAskDrafts((d) => ({ ...d, [id]: "" }));
      setFresh(id);
      return `Question ${after!.q_count} asked. Waiting for the keeper's YES or NO.`;
    });
  }

  async function onAnswer(g0: Game, yes: boolean) {
    const id = g0.game_id;
    const g = await getGame(id);
    if (!g) return;
    putGame(g, id);
    if (answerBlock(g, me)) return;
    await runWrite("Answer", "answer", [id, yes], 0n, async () => {
      const after = await getGame(id);
      if (!answerVerified(g, after, yes)) return null;
      putGame(after, id);
      setFresh(id);
      return `You answered ${yes ? "YES" : "NO"} to question ${after!.q_count}. Nobody checks it until you reveal.`;
    });
  }

  async function onGuess(g0: Game) {
    const id = g0.game_id;
    const word = guessDrafts[id] ?? "";
    const g = await getGame(id);
    if (!g) return;
    putGame(g, id);
    if (guessBlock(g, me, word, guessed.includes(guessKey(id)))) return;
    await runWrite("Guess", "guess", [id, pyStrip(word)], 0n, async () => {
      const after = await getGame(id);
      if (!guessVerified(g, after)) return null;
      putGame(after, id);
      setGuessed((list) => [...list, guessKey(id)]);
      setGuessDrafts((d) => ({ ...d, [id]: "" }));
      return "Guess recorded. Its plaintext is public in transaction calldata, even before reveal.";
    });
  }

  async function onReveal(g0: Game) {
    const id = g0.game_id;
    const draft = revealDrafts[id] ?? kept[id] ?? { secret: "", salt: "" };
    const g = await getGame(id);
    if (!g) return;
    putGame(g, id);
    if (revealBlock(g, me, draft.secret, draft.salt, calldataBytes("reveal", [id, draft.secret, draft.salt]))) return;
    await runWrite("Reveal", "reveal", [id, draft.secret, draft.salt], 0n, async () => {
      const after = await getGame(id);
      if (!revealVerified(after, draft.secret)) return null;
      putGame(after, id);
      return after!.state === "JUDGING" ? "Secret revealed. Request the audit as either participant." : "Empty game settled without a model audit.";
    });
  }

  async function onGameAction(g: Game, method: string, expected: string[]) {
    await runWrite(method, method, [g.game_id], 0n, async () => {
      const after = await getGame(g.game_id);
      if (!after || !expected.includes(after.state) || (method === "judge" && after.audit_attempts <= g.audit_attempts)) return null;
      putGame(after, g.game_id);
      await loadCredits(me);
      return `${method}: accepted state is ${after.state}. ${after.state === "INCONCLUSIVE" ? "No settlement or clean audit has been claimed." : "Review the state and allocations."}`;
    });
  }

  async function acknowledge() {
    if (!deliveryChecked || !credits?.pending_sequence) return;
    const sequence = credits.pending_sequence;
    await runWrite("Acknowledge receipt", "acknowledge_delivery", [sequence], 0n, async () => {
      const after = await getCredits(me);
      if (after?.pending_sequence !== 0 || after.last_withdrawal?.sequence !== sequence || after.last_withdrawal.status !== "RECIPIENT_ACKNOWLEDGED") return null;
      setCredits(after); setDeliveryChecked(false);
      return "Your receipt attestation is recorded. This is not protocol verification of delivery.";
    });
  }

  async function onForfeit(g0: Game) {
    const id = g0.game_id;
    const [g, mine] = await Promise.all([getGame(id), getCredits(me)]);
    if (!g) return;
    putGame(g, id);
    if (forfeitBlock(g, me)) return;
    await runWrite("Forfeit", "forfeit", [id], 0n, async () => {
      const [after, c] = await Promise.all([getGame(id), getCredits(me)]);
      if (!forfeitVerified({ credits: mine }, { g: after, credits: c })) return null;
      putGame(after, id);
      setCredits(c);
      return `Forfeited. The keeper missed the reveal deadline; the ${gen(g.bond_wei)} bond is credited to the joined player. Your credits: ${gen(c!.credit_wei)}.`;
    });
  }

  async function onWithdraw() {
    if (withdrawReason) return;
    const before = await getCredits(me);
    await runWrite("Withdraw", "withdraw", [], 0n, async () => {
      const after = await getCredits(me);
      if (!withdrawalRequested(before, after)) return null;
      setCredits(after);
      return `Withdrawal of ${gen(before!.credit_wei)} requested. External delivery is UNCONFIRMED; inspect the outgoing transfer and recipient balance. Do not resend.`;
    });
  }

  function onAdd() {
    const found = idsFromInput(addInput);
    if (!found.length) {
      setAddError("Paste a 64-character game id, several ids, or a TwentyAsks room link");
      return;
    }
    setAddError("");
    setAddInput("");
    addRooms(found);
  }

  async function copyText(text: string, ok: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ phase: "success", message: ok, action: "Copy" });
    } catch {
      setStatus({ phase: "error", message: "Could not copy; select the text and copy it by hand.", action: "Copy" });
    }
  }

  // ---------- one game room (a render function, not a component: inputs keep focus) ----------
  function renderRoom(id: string, g: Game | null | undefined) {
    if (g === undefined) return <article key={id} className="piece loading"><p className="muted mono">Reading {short(id, 8, 6)}…</p></article>;
    if (g === null) {
      return (
        <article key={id} className="piece missing">
          <p className="mono muted">{short(id, 10, 6)}</p>
          <p className="reason">{REVERTS.unknown}</p>
          <button className="btn btn-ghost" onClick={() => setIds((prev) => prev.filter((x) => x !== id))}>Remove</button>
        </article>
      );
    }
    const stamp = stampOf(g);
    const keeper = isKeeper(g, me);
    const revealed = g.state === "REVEALED";
    const ask = askDrafts[id] ?? "";
    const askBytes = calldataBytes("ask", [id, ask]);
    const askReason = askBlock(g, me, ask, askBytes);
    const ansReason = answerBlock(g, me);
    const word = guessDrafts[id] ?? "";
    const guessReason = guessBlock(g, me, word, guessed.includes(guessKey(id)));
    const rv = revealDrafts[id] ?? kept[id] ?? { secret: "", salt: "" };
    const rvBytes = calldataBytes("reveal", [id, rv.secret, rv.salt]);
    const rvReason = revealBlock(g, me, rv.secret, rv.salt, rvBytes);
    const ffReason = forfeitBlock(g, me);
    const share = BigInt(g.lie_share_wei);
    return (
      <article key={id} className={`piece room tone-${stamp.tone} ${fresh === id ? "fresh" : ""}`}>
        <div className="piece-top">
          <span className="kicker">KEEPER {short(g.keeper)}{keeper ? " · YOU" : ""}</span>
          <span className={`stamp stamp-${stamp.tone}`}>{stamp.label}</span>
        </div>
        {revealed ? (
          <h3 className="headline">The secret was <span className="secret-word">{g.secret}</span></h3>
        ) : (
          <h3 className="headline">{g.state === "FORFEITED" ? "Never revealed" : "A secret item, committed"}</h3>
        )}
        <dl className="piece-facts">
          <div><dt>Bond</dt><dd>{gen(g.bond_wei)}</dd></div>
          <div><dt>Questions</dt><dd>{g.q_count} / {MAX_QUESTIONS}</dd></div>
          <div><dt>Each plainly false reply pays</dt><dd>{gen(share)}</dd></div>
        </dl>
        <p className="fine">{deadlineLine(g)}</p>
        <p className="turn">{turnLine(g, me)}</p>
        <p className="fine mono">Designated player: {g.player}</p>
        <button className="btn btn-ghost" disabled={busy} onClick={() => loadItems([id])}>Refresh state and deadlines</button>
        {g.state === "INVITED" && <div className="reply">
          <p>Joining accepts the one-hour play window, public guess calldata, 72-hour reveal deadline, and the 50/50 unresolved-audit fallback. Withdrawals need separate delivery verification.</p>
          {isPlayer(g, me) && <button className="btn btn-primary" disabled={busy || g.now >= g.join_deadline} onClick={() => onGameAction(g, "join_game", ["ASKING"])}>Accept rules and join</button>}
          {keeper && <button className="btn btn-ghost" disabled={busy || g.now < g.join_deadline} onClick={() => onGameAction(g, "cancel_unjoined", ["CANCELLED"])}>Cancel expired invitation</button>}
        </div>}
        {["JUDGING", "INCONCLUSIVE"].includes(g.state) && <div className="reply">
          <p>Secret: <b>{g.secret}</b> · Audit attempts {g.audit_attempts}/3. Inconclusive output does not release the bond.</p>
          <button className="btn btn-primary" disabled={busy || !(keeper || isPlayer(g, me)) || g.audit_attempts >= 3 || g.now >= g.audit_deadline} onClick={() => onGameAction(g, "judge", ["REVEALED", "INCONCLUSIVE"])}>Request audit</button>
          <button className="btn btn-ghost" disabled={busy || !(keeper || isPlayer(g, me)) || (g.audit_attempts < 3 && g.now < g.audit_deadline)} onClick={() => onGameAction(g, "resolve_inconclusive", ["UNRESOLVED"])}>Resolve without a verdict (50/50)</button>
          <pre>{JSON.stringify(g.audits, null, 2)}</pre>
        </div>}
        {g.state === "UNRESOLVED" && <p className="reason">No valid audit. Player allocation: {gen(g.player_credit_wei)}; keeper allocation: {gen(g.keeper_credit_wei)}.</p>}


        <ol className="letters">
          {g.questions.length === 0 && <li className="letter empty muted">No question yet.</li>}
          {g.questions.map((q) => {
            const mine = !!me && q.asker === me.toLowerCase();
            const tone = revealed ? (q.lie ? "lie" : "stands") : q.answer ? "answered" : "waiting";
            return (
              <li key={q.index} className={`letter q-${tone}`}>
                <div className="letter-head">
                  <span className="mono muted">Q{q.index} · {short(q.asker)}{mine ? " · YOU" : ""}</span>
                  <span className="chips">
                    {q.answer ? <span className={`chip ${q.answer === "YES" ? "chip-yes" : "chip-no"}`}>{q.answer}</span> : <span className="chip chip-wait">WAITING</span>}
                    {revealed && (q.lie
                      ? <span className="chip chip-lie">PLAINLY FALSE · {gen(q.paid_wei)}</span>
                      : <span className="chip chip-stands">STANDS</span>)}
                  </span>
                </div>
                <p className="letter-text">{q.text}</p>
              </li>
            );
          })}
        </ol>

        {revealed && (
          <div className="outcome">
            <p>
              {g.q_count === 0 ? "Empty game: no model audit. " : "Completed audit: "} Listed {g.lies && g.lies.length ? <b>question {g.lies.join(", ")}</b> : <b>no reply</b>} as plainly false.
              Keeper credited <b>{gen(g.keeper_credit_wei)}</b>.
            </p>
            <p>
              {g.winner ? <>Winner: <span className="mono">{short(g.winner)}</span>{me && g.winner === me.toLowerCase() ? " · YOU" : ""}</> : "No correct guess."}
              {g.guesses.length > 0 && <> · Guesses: {g.guesses.map((x) => `${x.word}${x.correct ? " ✓" : ""}`).join(", ")}</>}
            </p>
          </div>
        )}

        {g.state === "ASKING" && keeper && g.pending && (
          <div className="reply">
            <label className="fine">Answer question {g.q_count} as the keeper</label>
            <div className="yesno">
              <button className="btn btn-yes" onClick={() => onAnswer(g, true)} disabled={busy || !!ansReason}>Answer YES</button>
              <button className="btn btn-no" onClick={() => onAnswer(g, false)} disabled={busy || !!ansReason}>Answer NO</button>
            </div>
          </div>
        )}

        {g.state === "ASKING" && isPlayer(g, me) && (
          <div className="reply">
            <label className="fine" htmlFor={`ask-${id}`}>Ask a yes/no question</label>
            <textarea id={`ask-${id}`} rows={2} placeholder="Is it…?" value={ask} disabled={busy}
              onChange={(e) => setAskDrafts((d) => ({ ...d, [id]: e.target.value }))} />
            <div className="form-foot">
              <span className={`meter mono ${askBytes > CALLDATA_LIMIT ? "over" : ""}`}>
                {pyLen(pyStrip(ask))} / {MAX_QUESTION_LENGTH} · {askBytes} / {CALLDATA_LIMIT} bytes
              </span>
              <span className="action">
                {askReason && (ask || askReason !== REVERTS.questionEmpty) && <span className="reason">{askReason}</span>}
                <button className="btn btn-primary" onClick={() => onAsk(g)} disabled={busy || !!askReason}>Ask</button>
              </span>
            </div>
            <p className="reason">Your guess is PUBLIC transaction data immediately. The read view omits it until reveal; that does not make it private.</p>
            <div className="row">
              <input aria-label="Your guess" placeholder="Your one guess" value={word} disabled={busy} spellCheck={false}
                onChange={(e) => setGuessDrafts((d) => ({ ...d, [id]: e.target.value }))} />
              <button className="btn btn-ghost" onClick={() => onGuess(g)} disabled={busy || !!guessReason}>Guess</button>
            </div>
            {guessReason && (word || guessReason !== REVERTS.guessEmpty) && <span className="reason">{guessReason}</span>}
            {g.guess_count > 0 && <span className="fine">{plural(g.guess_count, "guess", "guesses")} in, recorded. Guess calldata is public.</span>}
          </div>
        )}

        {g.state === "ASKING" && keeper && (
          <div className="reply">
            <label className="fine">Reveal the secret and the salt you committed with</label>
            <div className="row">
              <input aria-label="Secret" placeholder="Secret item" value={rv.secret} disabled={busy} spellCheck={false}
                onChange={(e) => setRevealDrafts((d) => ({ ...d, [id]: { ...rv, secret: e.target.value } }))} />
              <input className="mono" aria-label="Salt" placeholder="Salt" value={rv.salt} disabled={busy} spellCheck={false}
                onChange={(e) => setRevealDrafts((d) => ({ ...d, [id]: { ...rv, salt: e.target.value } }))} />
            </div>
            <div className="form-foot">
              <span className={`meter mono ${rvBytes > CALLDATA_LIMIT ? "over" : ""}`}>{rvBytes} / {CALLDATA_LIMIT} bytes</span>
              <span className="action">
                {rvReason && (rv.secret || rv.salt || rvReason !== REVERTS.mismatch) && <span className="reason">{rvReason}</span>}
                <button className="btn btn-primary" onClick={() => onReveal(g)} disabled={busy || !!rvReason}>Reveal</button>
              </span>
            </div>
            {kept[id] && !revealDrafts[id] && <span className="fine">Secret and salt filled from this browser, where the game was opened.</span>}
          </div>
        )}

        <div className="piece-actions">
          {g.state === "ASKING" && isPlayer(g, me) && (
            <span className="action">
              <button className="btn btn-ghost" onClick={() => onForfeit(g)} disabled={busy || !!ffReason}>Forfeit</button>
              {ffReason && ffReason !== REVERTS.over && <span className="fine">{ffReason}</span>}
            </span>
          )}
          <a className="link mono" href={`${window.location.origin}/?g=${g.game_id}`}>{short(g.game_id, 8, 6)}</a>
        </div>
      </article>
    );
  }

  // ---------- view ----------
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo-192.png" alt="" width={40} height={40} />
          <div>
            <div className="brand-name">Twenty<span>Asks</span></div>
            <div className="brand-sub">TWENTY QUESTIONS, AN HONEST KEEPER</div>
          </div>
        </div>
        <div className="top-right">
          <div className="contract-chip">
            <span className="chip-tag">STUDIONET</span>
            <span className="dot" aria-hidden="true" />
            <div>
              <div className="chip-label">Contract</div>
              <div className="mono chip-value">{short(CONTRACT_ADDRESS, 6, 4)}</div>
            </div>
            <a className="chip-link" href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" aria-label="Open contract in explorer">↗</a>
          </div>
          {me ? (
            <div className="wallet-chip mono" title={me}><span className="dot" aria-hidden="true" />{short(me)}</div>
          ) : (
            <button className="btn btn-connect" onClick={connect}>▣ Connect wallet</button>
          )}
        </div>
      </header>

      <div className="body">
        <nav className="sidebar" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} className={`nav ${view === n.id ? "active" : ""}`} onClick={() => setView(n.id)}>
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
              {view === n.id && <span className="nav-dot" aria-hidden="true" />}
            </button>
          ))}
          <div className="help">
            <p className="help-title">Need help?</p>
            <p>The keeper commits to an item and stakes GEN. After a valid audit, each plainly false reply pays the player it misled a fifth of the bond.</p>
            <button className="btn btn-ghost wide" onClick={() => setView("overview")}>How it works</button>
          </div>
        </nav>

        <main className="main">
          <div className={`runtime runtime-${status.phase}`} aria-live="polite">
            <span className="dot" aria-hidden="true" />
            <span className="runtime-tag">{status.phase === "idle" ? "RUNTIME" : (status.action ?? "STATUS").toUpperCase()}</span>
            <span className="runtime-msg">
              {status.message || "Connect a wallet or load a room. Writes require a configured HonestKeeper v2 deployment."}
            </span>
            {status.hash && (
              <a className="mono runtime-link" href={`${EXPLORER_BASE}/tx/${status.hash}`} target="_blank" rel="noreferrer">tx {short(status.hash, 10, 8)}</a>
            )}
            {pendingTx && (
              <button className="btn btn-ghost small" onClick={checkAgain} disabled={busy}>Check again</button>
            )}
          </div>

          {view === "overview" && (
            <>
              <section className="panel hero">
                <img className="hero-logo" src="/logo.png" alt="" width={120} height={120} />
                <div className="hero-text">
                  <p className="eyebrow">GENLAYER · STUDIONET</p>
                  <h1>Twenty questions, an honest keeper</h1>
                  <p className="hero-sub">A plainly false reply <em>pays the player it misled.</em></p>
                  <p className="hero-body">
                    TwentyAsks does not guess the secret, and it does not referee the game while it is played. When the keeper
                    reveals, validators audit the revealed log for replies that are plainly false — and each one pays the
                    player who was misled out of the keeper's bond.
                  </p>
                  <div className="pills">
                    <span className="pill">✓ Committed before the first question</span>
                    <span className="pill">✓ Separate reveal and audit</span>
                    <span className="pill">✓ Arguable replies cost nothing</span>
                  </div>
                </div>
                <div className="contract-card">
                  <div className="cc-head"><span>Connected contract</span><span className="ready">{limits?.version === "2.0.0" ? "v2 loaded" : "Setup required"}</span></div>
                  <p className="mono cc-addr">{CONTRACT_ADDRESS}</p>
                  <div className="cc-foot">
                    <span><span className="dot" aria-hidden="true" /> StudioNet · 61999</span>
                    <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">View on Explorer ↗</a>
                  </div>
                </div>
              </section>

              <section className="panel steps">
                {[
                  ["1", "Commit and stake", "The keeper locks a hash of the item and a salt, with a GEN bond."],
                  ["2", "Ask, one at a time", "One invited player accepts, then asks during a one-hour window."],
                  ["3", "Reveal, then audit", "Validators list the plainly false replies; each pays its asker a fifth of the bond."],
                ].map(([n, t, d], i) => (
                  <div className="step" key={n}>
                    <span className="step-n">{n}</span>
                    <div><p className="step-t">{t}</p><p className="step-d">{d}</p></div>
                    {i < 2 && <span className="step-arrow" aria-hidden="true">›</span>}
                  </div>
                ))}
              </section>

              <section className="cards">
                <div className="panel card">
                  <p className="eyebrow muted">STANDS</p>
                  <h2>"Is it usually near water?" — YES</h2>
                  <p>For a lighthouse the reply is true. It costs the keeper nothing.</p>
                  <div className="tags"><span className="tag tag-within">STANDS · 0 GEN</span></div>
                </div>
                <div className="panel card">
                  <p className="eyebrow muted">PLAINLY FALSE</p>
                  <h2>"Is it usually in a desert?" — YES</h2>
                  <p>Anyone who knows the item would call it false. The player who asked is paid a fifth of the bond.</p>
                  <div className="tags"><span className="tag tag-over">bond ÷ 5 → the misled player</span></div>
                </div>
                <div className="panel card">
                  <p className="eyebrow muted">ARGUABLE</p>
                  <h2>"Is it old?" — YES</h2>
                  <p>It could fairly go either way, so it is left out. Broken output or an unusable secret leaves the audit INCONCLUSIVE, without settling the bond.</p>
                  <div className="tags"><span className="tag">LEFT OUT</span><span className="tag tag-void">3-day reveal deadline</span></div>
                </div>
              </section>
            </>
          )}

          {view === "games" && (
            <>
              <section className="panel section-head">
                <div>
                  <p className="eyebrow">GAME ROOMS</p>
                  <h1>Games in this list</h1>
                  <p className="muted">Each room shows the log as it was played; after the reveal, every reply is marked as standing or plainly false.</p>
                </div>
                <button className="btn btn-ghost" onClick={() => copyText(window.location.href, "Room link copied. It carries every game in this list.")} disabled={!ids.length}>Copy room link</button>
              </section>
              <form className="adder" onSubmit={(e) => { e.preventDefault(); onAdd(); }}>
                <input aria-label="Game ids or link" placeholder="Paste game ids or a TwentyAsks link" value={addInput} onChange={(e) => setAddInput(e.target.value)} spellCheck={false} />
                <button className="btn btn-primary" type="submit">Add</button>
              </form>
              {addError && <p className="reason">{addError}</p>}
              {rooms.length === 0 && <section className="panel empty"><p className="muted">No games yet. Open one, or paste a link someone shared.</p></section>}
              <div className="board">
                {rooms.map(([id, g]) => renderRoom(id, g))}
              </div>
            </>
          )}

          {view === "open" && (
            <section className="panel form">
              <p className="eyebrow">OPEN A GAME</p>
              <h1>Commit to an item and stake a bond</h1>
              <p className="muted">
                The secret commitment goes on chain; keep the secret and salt private. Invite one separate wallet. After they join, questions and a public guess are allowed for one hour. Reveal after that hour and before 72 hours, or the joined player receives the full bond.
              </p>
              <label htmlFor="player">Invited player wallet</label>
              <input id="player" placeholder="0x… separate player wallet" value={player} onChange={(e) => setPlayer(e.target.value.trim())} />
              <p className="reason">Both participants accept: if the audit remains inconclusive after 3 recorded attempts or 24 hours, the player receives half the bond and the keeper receives the rest. This is not an honesty verdict. GEN transfers are asynchronous; failed delivery is not automatically recoverable on Studio.</p>
              <label htmlFor="secret">Secret item</label>
              <input id="secret" placeholder="A single everyday thing, e.g. a kettle" value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} />
              <span className="fine">{pyLen(pyStrip(secret))} / {MAX_SECRET_LENGTH} characters · case and extra spaces do not matter</span>
              <label htmlFor="salt">Salt</label>
              <div className="row">
                <input id="salt" className="mono" value={salt} onChange={(e) => setSalt(e.target.value)} spellCheck={false} />
                <button className="btn btn-ghost" type="button" onClick={() => setSalt(randomSalt())}>New salt</button>
                <button className="btn btn-ghost" type="button" disabled={!pyStrip(secret)}
                  onClick={() => copyText(`secret: ${pyStrip(secret)}\nsalt: ${salt}`, "Secret and salt copied. Keep them: the reveal needs the salt exactly.")}>Copy secret + salt</button>
              </div>
              <span className="fine">The reveal needs this salt exactly. This browser keeps it for you; copy it too if you may reveal from elsewhere.</span>
              <label htmlFor="bond">Bond (GEN)</label>
              <input id="bond" className="mono" value={bond} onChange={(e) => setBond(e.target.value)} spellCheck={false} />
              <span className="fine">
                0.001 to 1 GEN{bondWei !== null && bondWei > 0n ? ` · each plainly false reply pays ${gen(bondWei / 5n)} (five use up the bond)` : ""}
              </span>
              <div className="form-foot">
                <span className={`meter mono ${openBytes > CALLDATA_LIMIT ? "over" : ""}`}>{openBytes} / {CALLDATA_LIMIT} bytes</span>
                <span className="action">
                  {(secret || bond !== "0.01") && openReason && <span className="reason">{openReason}</span>}
                  <button className="btn btn-primary" onClick={onOpen} disabled={busy || !!openReason}>
                    Open game{bondWei !== null && !openReason ? ` · ${formatGen(bondWei)} GEN` : ""}
                  </button>
                </span>
              </div>
              {newCommitment && <p className="fine mono">Commitment: {newCommitment}</p>}
              {newId && <p className="fine mono">Game id: {newId}</p>}
            </section>
          )}

          {view === "credits" && (
            <section className="panel form">
              <p className="eyebrow">CREDITS</p>
              <h1>GEN waiting for you</h1>
              <p className="muted">
                Credits come from finished games: a fifth of the bond for each plainly false reply you were given, the rest of
                the bond for a keeper, or the full forfeited bond for the designated player. Only <span className="mono">withdraw</span> sends GEN out.
              </p>
              {me ? (
                <>
                  <button className="btn btn-ghost" onClick={() => loadCredits(me)} disabled={busy}>Refresh credits and withdrawal</button>
                  {credits?.last_withdrawal && <div className="reply">
                    <p>Withdrawal #{credits.last_withdrawal.sequence}: {credits.last_withdrawal.status}</p>
                    <p>Amount {gen(credits.last_withdrawal.amount_wei)} · Recipient <span className="mono">{credits.last_withdrawal.wallet}</span></p>
                    <p className="reason">Credit debited does not mean delivered. Wait for parent FINALIZED, match the outgoing transfer recipient/value and confirm its completion plus recipient balance. Timeout alone is not failure. No automatic resend or unfunded refund is available.</p>
                    {!!credits.pending_sequence && <>
                      <label><input type="checkbox" checked={deliveryChecked} onChange={(e) => setDeliveryChecked(e.target.checked)} /> I personally verified the outgoing transfer and receipt of this amount in my wallet.</label>
                      <button className="btn btn-ghost" disabled={busy || !deliveryChecked} onClick={acknowledge}>Record my receipt acknowledgement</button>
                    </>}
                  </div>}
                  <p className="credit-big">{credits ? gen(credits.credit_wei) : "reading…"}</p>
                  <div className="form-foot">
                    <span className="mono muted">{short(me)}</span>
                    <span className="action">
                      {credits && withdrawReason && <span className="reason">{withdrawReason}</span>}
                      <button className="btn btn-primary" onClick={onWithdraw} disabled={busy || !!withdrawReason}>Withdraw</button>
                    </span>
                  </div>
                </>
              ) : (
                <p className="fine">{UI.noWallet} to see your credits.</p>
              )}
            </section>
          )}

          {view === "verify" && (
            <section className="panel form">
              <p className="eyebrow">VERIFICATION</p>
              <h1>What you are talking to</h1>
              <dl className="facts">
                <div><dt>Contract</dt><dd className="mono"><a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a></dd></div>
                <div><dt>Source SHA-256</dt><dd className="mono">{SOURCE_SHA256}</dd></div>
                <div><dt>Contract name · version</dt><dd className="mono">{limits ? `${limits.contract_name ?? "?"} · ${limits.version ?? "?"}` : "reading…"}</dd></div>
                <div><dt>Rubric hash (from get_limits)</dt><dd className="mono">{limits?.rubric_hash ?? "reading…"}</dd></div>
                <div><dt>Bond range · reveal deadline</dt><dd className="mono">{limits ? `${formatGen(limits.min_bond_wei ?? "0")}–${formatGen(limits.max_bond_wei ?? "0")} GEN · 72 hours after join` : "reading…"}</dd></div>
              </dl>
              <p className="muted">
                The app checks common prerequisites; the contract remains authoritative. Refresh state when a deadline passes. Whether a reply is
                plainly false is decided only by validators inside judge(); the app reads the list back from the contract.
                The contract holds GEN: bonds of open games and credits not yet withdrawn.
              </p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
