# Security boundaries

## AI audit

The model receives only a fenced secret and numbered question/answer log. It never
selects wallets, money, deadlines or state transitions. Leader and validator independently
produce a strict {status,lies} object and compare the canonical result. A valid empty
list differs from INCONCLUSIVE. Unknown fields, booleans/string positions, out-of-range
indices and malformed JSON cannot masquerade as a clean audit.

Delimiters reduce accidental instruction confusion; they do not guarantee prompt-injection
resistance. Independent models may agree on an incorrect result. Local mocked tests do
not establish real-model accuracy. Ambiguous/instruction-like secrets and prompt injection
must also be exercised on the deployed version. Valid disagreement rejects the leader
proposal; it is not converted into an accepted clean result.

## Economic trade-offs

One invited player must consent before the game starts. This removes wallet-count
weighting, but provides no proof of identity or resistance to keeper/player collusion.
The one-hour participation window is an exact elapsed-time boundary. No question/guess
can be added after it, avoiding a race that lets a player continually obstruct reveal.
A pending answer can be completed until the 72-hour reveal deadline; ignoring it risks
forfeiting the whole bond. An unjoined invitation can be cancelled after 24 hours.

The unresolved 50/50 policy bounds locked funds and avoids falsely exonerating the
keeper. It is a compromise with incentive costs: an attacker may try to force an
inconclusive audit; an honest keeper can lose half the bond, and a dishonest keeper
might recover half. Both participants accept this explicitly. It is not an ideal fair
escrow or a proof that the answers were correct. No admin can change the allocations.

## Public data

Guess calldata is public before reveal. UI omission is not encryption or commit/reveal.
The secret commitment uses Keccak256 and a secret random salt; weak salts permit guessing.
The frontend stores the reveal secret/salt in local storage, which is accessible to that
browser profile. Do not use a shared browser for valuable secrets.

## Withdrawals: remaining platform limitation

Studio simulates consensus and currently supports EOA value transfers, not arbitrary
EVM contract interactions. A Solidity escrow therefore is not a working Studio fix:
https://docs.genlayer.com/developers/intelligent-contracts/features/messages
https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers

withdraw reserves all currently available credit, records recipient/amount/sequence/time,
and emits exactly one external transfer. Pending records block blind replays. Later credits
are retained while the earlier transfer is pending. The record is not marked paid merely
because the parent was accepted/finalized. A parent receipt alone is insufficient evidence.

acknowledge_delivery is an owner-signed attestation after independently checking receipt.
It is not protocol verification; a premature or dishonest acknowledgement cannot recover
money. It clears the pending slot and retains history. There is no automatic failed-transfer
proof, trustless refund, or retry endpoint. A timeout must never restore an unfunded credit,
which could spend another game's bond or cause double delivery.

fund_replacement(wallet, sequence) is optional, explicit sponsor-funded compensation.
It requires EXACTLY the recorded amount in new value, credits the intended recipient once,
and marks the original REPLACEMENT_FUNDED_ORIGINAL_UNRESOLVED. The original transfer may
still arrive later, in addition to the replacement. A sponsor knowingly bears that cost;
this is not recovery of the original funds and is not proof of failure. Do not use this
method to claim the steward's failed-payment-recovery requirement is fully satisfied.

**Release gate:** before claiming real-money safety, establish recipient-side outgoing
transfer evidence and a chain-supported delivery/failure proof or atomic escrow on a
network that actually supports it. This gate remains open in this Studio version.
