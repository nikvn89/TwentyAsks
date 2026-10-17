# TwentyAsks v2 runtime evidence — 2026-10-17

## Scope

One real two-wallet game was operated by the owner through the dApp. Screenshots were
reviewed and the final game, limits, credits, linked withdrawal parents and Sends were
independently read from Studio RPC. This is a main-flow result, not full coverage of
all steward acceptance cases. Live app: https://twenty-asks.vercel.app

Contract: [0x5BC1C92F9895e05c443163545c284770Da7015a6](https://explorer-studio.genlayer.com/address/0x5BC1C92F9895e05c443163545c284770Da7015a6).
Game id: `5fbfc88717e84afab07025ab5affa3456a289ba0594c3397366bec821819618c`.
Keeper: `0x6276095FAEA15108740445ff277fdA8c304657F4`.
Player: `0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE`.

## Source correspondence

[Checked source at commit 5e340b19c672221ca55ee2299c729d4259bea1a2](https://github.com/nikvn89/TwentyAsks/blob/5e340b19c672221ca55ee2299c729d4259bea1a2/contracts/HonestKeeper.py).
Canonical SHA-256: `06189c50d9adb5c15692389b3da8e8dac08b23665fa160578e1deae795faa22a`.
Deployed raw SHA-256: `5098d899d2198bf94cb457318750dec21b552928bf5deb1bf142ab4e6bb40074`.
The deployed source lacks the final newline. LF normalization plus exactly one terminal
newline makes it identical to the repository source. Raw-byte identity is not claimed.
get_limits readback: HonestKeeper / 2.0.0, play_seconds 3600, reveal_seconds 259200,
automatic_failed_payment_recovery false.

## Observed game

| Step | Observed result | Evidence level |
|---|---|---|
| Open / join | 0.01 GEN bonded, designated player joined | Owner screenshots; final game readback |
| Before play deadline | Reveal button disabled | UI only; no early-reveal rollback transaction supplied |
| Q1: Is it used to boil water? / NO | lie=true, paid 0.002 GEN | Final game readback |
| Q2: Is it a living animal? / NO | lie=false, paid 0 | Final game readback |
| Q3: Is it beautiful? / YES | lie=false, paid 0 | Final game readback |
| Guess a kettle | One guess, correct, player winner | Final game readback; pre-reveal disclosure not independently captured |
| Reveal / audit | REVEALED, one audit, VALID, lies [1] | Owner screenshots + final get_game; full audit hash/votes not collected |
| Allocation | Player 0.002 GEN, keeper 0.008 GEN | Final get_game and pre-withdrawal credit screenshots |
| Third wallet | Ask/Guess/Reveal controls absent | UI screenshot only; active address cropped, no unauthorized rollback transaction |

## Withdrawals and recipient acknowledgements

| Recipient | Parent withdraw | Outgoing Send | Observed result |
|---|---|---|---|
| Player, 0.002 GEN | [parent](https://explorer-studio.genlayer.com/tx/0x57aa33812ab22d9d275a553bf0172175997eb87cec429f43d1af3b1250bae0f9) | [Send](https://explorer-studio.genlayer.com/tx/0x3e5907728bb5767a8ae230cae4f983ee38da9df30ddc401081ff805268114a6d) | Parent FINALIZED / SUCCESS / MAJORITY_AGREE; Send FINALIZED, value_credited=true, correct recipient/value, triggered_by matches parent |
| Keeper, 0.008 GEN | [parent](https://explorer-studio.genlayer.com/tx/0x159e9821d9ea536a2c0439ae5abdc185114329d76a41c66dcbb558ce6595fb2f) | [Send](https://explorer-studio.genlayer.com/tx/0x7c28c680df82a3b31b9a04010dd299cd79510770960e702b406f2f242a305180) | Parent FINALIZED / SUCCESS / MAJORITY_AGREE; Send FINALIZED, value_credited=true, correct recipient/value, triggered_by matches parent |

Both get_credits views now show credit_wei=0, pending_sequence=0 and withdrawal #1
RECIPIENT_ACKNOWLEDGED. The contract balance was zero at collection. These views alone
are not delivery proof; the separate Sends above are the additional chain evidence.
The player reported receiving 0.002 GEN and supplied a correct-network wallet screenshot.
The keeper recorded receipt acknowledgement. Correct-network balance snapshots from
immediately before each withdraw were not collected, so an isolated balance delta is
not claimed. The earlier 3 GEN screenshot was a different network and is excluded.

The RPC labels these plain Sends result_name=NO_MAJORITY while exposing no validator
round. Do not describe that field as a semantic failure or invent validator votes.
The relevant transfer evidence is final status, credited value, recipient and parent linkage.

Sanitized readback: `docs/evidence/v2/runtime-summary.json`. Private node configuration,
keys, signatures and unrevealed secrets are excluded. The already revealed secret is public.
Sequential reads requested finalized state but do not establish a single-block snapshot.

## NOT RUN live / open

72-hour forfeiture and late-reveal rejection; on-chain early reveal rejection;
onparticipant rollback transactions; ambiguous/injected secrets; malformed/conflicting
provider output; bounded inconclusive recovery; failed or ambiguous native delivery.
Local mocked regression tests are separate evidence. Automatic native payment failure
recovery is still OPEN; a recipient acknowledgement or newly funded replacement does
not implement trustless recovery of the original payment.

Historical v1 evidence stays in `docs/history/v1-evidence.md` and is not a v2 pass.
The final documentation commit SHA is known only after this upload. If an immutable
comparison is required, confirm the steward's actual final-reviewed BASE, then use
compare/BASE_SHA...SUBMITTED_HEAD_SHA. Do not use main or assume the old ZIP commit is BASE.
