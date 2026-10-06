# TESTING

```
COMPILE PASS ≠ RUNTIME PASS
SUBMITTED ≠ ACCEPTED ≠ FINALIZED ≠ EXECUTION SUCCESS ≠ POSTCONDITION PASS
```

## Automated gates (run before release; CI runs them on every push)

| Gate | Command | Result |
|---|---|---|
| Kill-set + rubric gate | `python3 HONESTKEEPER_KILLSET_CHECK.py contracts/HonestKeeper.py` | rc 0 — no word or word pair separates the classes; the rubric shares no content word with any case |
| genvm-linter | `python3 -m genvm_linter.cli lint contracts/HonestKeeper.py` | pass |
| Contract tests (Direct Mode: the real py-genlayer v0.2.16 SDK, model mocked) | `python3 -m pytest tests/contract -q -p no:cacheprovider` | 74 passed |
| Mutation check | `python3 tools/mutate.py .` | 28/28 deliberate faults caught |
| Frontend build | `npm run build` | rc 0 |
| Frontend tests | `npm test` | 58 passed |
| Source hash | `npm run verify:source` | `contracts/HonestKeeper.py` matches `SOURCE_SHA256.txt` |
| Calldata table | `node tools/calldata-bytes.mjs` | every write ≤ 255 bytes (largest: `ask` at the 100-character cap, 191) |
| Calldata on the RPC | `node tools/probe-calldata.mjs <address>` | runs in CI against both addresses in `deployments.json` |

The mocked model lists drive the deterministic code paths; they say nothing about what the real model returns. The
on-chain runs do.

### What the mutation check catches

Each fault is applied to the contract alone and the suite must go red (`tests/mutations.py`): a listed lie paying the
keeper instead of the misled asker, the wrong share divisor, six positions paid instead of five, the keeper getting the
whole bond back, the fail-safe flipped, an out-of-range or non-number element skipped instead of voiding the list, the
validator accepting any list, anyone allowed to answer, reveal or forfeit, the deadline off by one, the forfeit remainder
lost, a second question while one is pending, a reveal while a question is pending, the question cap and length cap off
by one, the minimum bond off by one, the reserved-token check dropped, a single-pass fence, a wallet leaking into the
prompt, the commitment skipping whitespace normalization, the state checked after the caller, the latest correct guess
winning, guesses shown before the reveal, withdraw not zeroing the credit, a second guess from one wallet, and the day
arithmetic treating February as part of the year.

### Calldata

Encoded exactly as genlayer-js 1.1.8 `writeContract` does. Every case question measures 100–124 bytes; `ask` at the
100-character cap 191, `guess` at 40 characters 133, `reveal` with a 40-character secret and a 32-character salt 168.
The salt has no cap in the contract: with a 40-character secret a salt longer than 119 ASCII characters would not fit.
The app generates 32-character salts and shows a byte meter on every text write.

## Frontend checks

- **Revert sentences** (`tests/js/rules.test.ts`): the set in `src/lib/rules.ts` equals the 25 sentences in the source,
  and for every write the UI reports the earliest failing check in the source's order — including a wrong salt, caught by
  computing the commitment locally before signing.
- **Commitments and game ids** (`tests/js/ids.test.ts`, `tests/js/ids-html.test.ts`): viem Keccak-256, Python whitespace
  rules, lower-cased secret, salt as typed; equal to vectors produced by the contract on the real SDK and to the
  on-chain game.
- **Postconditions** (`tests/js/verify.test.ts`): a reveal is reported only when the reloaded game is REVEALED with this
  secret, every question's `lie` flag matches the list, each listed position (lowest five) carries `bond // 5`, and the
  keeper's credit grew by exactly the rest.
- **GEN amounts** (`tests/js/gen.test.ts`): GEN ↔ wei with bigint, exact above 2^53.
- **Receipts** (`tests/js/receipt.test.ts`): a leader SUCCESS while validators are still proposing, committing or
  revealing is pending, not success.
- **Interface check** (Playwright against `vite preview`, the RPC mocked by decoding calldata): overview, rooms as the
  keeper with a pending question and as a player, typing a question key by key (the box keeps focus), a reveal ready with
  the stored salt and refused with a wrong one, a revealed and a forfeited room, the open form showing the commitment and
  game id of the on-chain game, an out-of-range bond, credits, and 390 px — no page error, no horizontal scroll.

## On-chain runs

See `RUNTIME_EVIDENCE.md`: the Intelligent Contract run (16 transactions, every must-verify row PASS) and the Project run
through this app, one hash per row.

Intelligent Contract run: for `lighthouse`, one log held a true reply, a plainly false one and an arguable one; the reveal
listed **[2]** only, the asker of question 2 was credited 0.2 GEN of a 1 GEN bond and the keeper 0.8 GEN, and both
withdrew: **PASS**.

## Consensus behaviour

The model is called once per game, in `reveal`, over the whole log (no call when nobody asked). Validators re-run the
reading and must agree on the exact normalized list; a disagreement rotates the leader or reverts the reveal, leaving
the game ASKING. Every other method is deterministic, and GEN leaves the contract only through `withdraw`.

## What this run does NOT prove

- Each case is sent once; only H4, L4 and U2 are sent on-chain. Label stability across repeated runs or validator sets is
  not measured.
- The forfeit path needs three days of chain time and is tested offline only (the clock is moved in the test VM).
- "Already guessed" is predicted only for guesses made from this browser; guesses are hidden, so another guess from the
  same wallet elsewhere is caught by the contract instead.
- Prompt-injection resistance rests on the fence and the reserved-token check; no adversarial model run is done.
