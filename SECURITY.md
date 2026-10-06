# SECURITY

## The contract holds GEN

It holds the bond of every game still `ASKING` and every wallet's credits not yet withdrawn. `reveal` and `forfeit`
only write credits; GEN leaves the contract only through `withdraw()`, which sets the caller's credit to zero before
sending it and never calls the model. `open_game` is the only payable write; the app sends value 0 with every other one.

## Where the central rule lives

Whether a reply is plainly false is decided only by validators inside `reveal`, over the whole log at once. What follows
is deterministic in the contract: each listed position pays `bond // 5` to its asker (the lowest five), the keeper gets
the rest. The app never decides a reply and never screens question text for meaning: it reads `lies`, each question's
`lie` and `paid_wei`, and `keeper_credit_wei` back from `get_game` (checked by `tests/js/verify.test.ts`).

## Fail-safe

Unusable output lists nothing: an honest keeper is never penalised by a broken reading.

## Commitment

The keeper commits to `keccak256(secret, salt)` before the first question and cannot reveal any other item. The salt is
generated in the browser from `crypto.getRandomValues` and kept in local storage for the keeper before the transaction
is signed; it never goes on chain until the reveal. A keeper who loses the salt cannot reveal, and after three days the
players may forfeit the game.

## Prompt fence

The secret and the log sit inside `<UNTRUSTED_SECRET>` and `<UNTRUSTED_LOG>` tags. The four tags and `"LIES":` are
refused in any letter case on input and stripped to a fixed point inside the prompt. The model sees no wallet, bond,
guess, salt or state.

## Grinding

One reading per game: a revealed game cannot be revealed again. One guess per wallet. A question cannot be asked while
the last one waits for its reply, and there are at most twenty.

## Frontend

- No MetaMask Snap: the app switches the network with `wallet_switchEthereumChain` / `wallet_addEthereumChain`.
- One same-origin RPC proxy (`/genlayer-rpc`, in `vite.config.ts` and `vercel.json`) for reads, receipts and writes.
- A write is reported only after the leader receipt says SUCCESS **and** consensus has reached ACCEPTED, and only after
  the reloaded state shows the change; otherwise "confirmation delayed" with a Check again button that re-reads state.
- Every revert predictable from state disables the button with the contract's own sentence; the reveal button checks the
  commitment locally first, so a wrong salt is caught before signing.
- GEN amounts are parsed and shown with bigint only; no wei value passes through a JS number.
- Contract text is rendered as React text; no raw HTML. Local storage holds the game list, the keeper's own secret and
  salt, and which games this wallet guessed in — nothing else.

## Remaining limits

See "Honest limitation" in the README.
