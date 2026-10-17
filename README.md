# TwentyAsks / HonestKeeper v2

A two-wallet guessing game on GenLayer StudioNet. A keeper commits to a secret
and bonds GEN. One designated player explicitly joins, asks up to twenty yes/no
questions, and can submit one public guess. After reveal, independent validators
audit the answers. The model selects evidence positions; deterministic code alone
selects recipients and amounts.

**Release status: v2 main flow exercised on StudioNet; additional live acceptance cases remain pending.**

- Live app: https://twenty-asks.vercel.app
- Project contract: [0x5BC1C92F9895e05c443163545c284770Da7015a6](https://explorer-studio.genlayer.com/address/0x5BC1C92F9895e05c443163545c284770Da7015a6)
- Source checked at commit `5e340b19c672221ca55ee2299c729d4259bea1a2`. The deployed code has the same content
  after canonicalizing the terminal newline; both raw and canonical hashes are recorded
  in `deployments.json` and `RUNTIME_EVIDENCE.md`.
- Observed game: three answers, VALID audit with lies [1], correct guess, allocations
  of 0.002 GEN to the player and 0.008 GEN to the keeper; both withdrawals have
  successful finalized parents and separately finalized credited Send transactions.

See `RUNTIME_EVIDENCE.md` for exact links and `TESTING.md` for the cases not run.
**Trustless automatic recovery of a failed native transfer remains an open limitation.**

## Rules both wallets accept

| Stage | Rule |
|---|---|
| Invitation | Keeper nominates a separate nonzero player. The player has 24 hours to join. After expiry the keeper can cancel and recover a credit. |
| Participation | Starting at join, the player has one hour for questions and a guess. Keeper cannot reveal early, even after all questions are answered. |
| Reveal | Keeper must answer any pending question, then reveal after the play window and before 72 hours from join. At the deadline, late reveal is blocked and the joined player can claim the entire bond. |
| Audit | Reveal publishes the committed secret. Either participant then calls judge. Valid audits settle immediately. Malformed output, provider exceptions and unusable secrets become INCONCLUSIVE, without releasing the bond. |
| Retry | At most 3 recorded audit attempts before a 24-hour audit deadline. Transactions that never reach consensus do not consume a persistent attempt; the deadline still bounds recovery. |
| Unresolved | After 3 recorded attempts or the audit deadline, either participant may settle UNRESOLVED: floor(bond/2) to player, remainder to keeper. This is a pre-agreed compromise, not a clean audit. |
| Penalty | For a VALID audit, each proven lie pays bond/5 to the designated player, rounded down; at most 5 positions are paid. Remainder to keeper. |
| Guess | Plaintext is public in transaction calldata immediately. The game view merely omits it before reveal. A correct guess is informational and has no additional payout. |
| Withdrawal | Credits are reserved into a durable PENDING_EXTERNAL withdrawal record. A successful parent transaction or zero credit does not prove external delivery. |

Wallet eligibility prevents additional addresses from diluting a forfeiture. It does
not prove distinct humans or prevent two wallets controlled by one person from colluding.
An empty game can settle after the full play window without a model audit.

## Run the frontend

Node 22.18+ or Node 24, Python 3.12 for contract tests.

```sh
npm ci
cp .env.example .env
# Set VITE_CONTRACT_ADDRESS to your newly deployed HonestKeeper v2 address.
npm run dev
```

Deploy `contracts/HonestKeeper.py` as a **new instance**, with no constructor args.
Do not upgrade the v1 instance: storage and method signatures changed. Read get_limits
and confirm version 2.0.0. This package sets the Project address in src/lib/config.ts;
VITE_CONTRACT_ADDRESS is an optional override. If Vercel has an older override,
update it; otherwise no environment variable is required. Redeploy after committing. The frontend refuses writes to an absent or non-v2 contract. This
address is public configuration, never a private key. Keep Project and IC submission
addresses separate if required by the submission rules.

The Vite/Vercel configuration forwards /genlayer-rpc to Studio. There are no bundled
private keys. MetaMask signs writes; the user can reject every request. Secret/salt
are saved only in this browser's local storage, scoped by contract address: keep a
private backup, use a strong random salt, and do not share a secret backup in evidence.

## Review and test

```sh
npm test
npm run build
npm run verify:source
npm run calldata
python3 -m pip install -r requirements-test.txt
python3 -m pytest tests/contract -q -p no:cacheprovider
python3 -m genvm_linter.cli lint contracts/HonestKeeper.py
```

CI pins the real SDK v0.2.16 used by Direct Mode. Model calls are mocked in local
tests; outgoing transfers are captured, not delivered. See `TESTING.md`,
`SECURITY.md`, `RUNTIME_EVIDENCE.md` and `CHANGELOG.md` for scope and limitations.
The original ZIP identifies baseline commit 48e3ede4694baa7a5834ffe8c3f540853c447af9;
confirm it is the steward's final-reviewed base before using it in a pinned compare
URL. The submitted head SHA becomes available only after uploading this revision.
