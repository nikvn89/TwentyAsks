# v2.0.0 — steward-feedback revision

Breaking changes require a new deployment and fresh runtime evidence.

- open_game adds a designated player; join_game requires consent. Removed wallet-count forfeiture splitting.
- One-hour participation window; exact 72-hour reveal deadline from join. Expired invitations can be cancelled.
- reveal publishes the secret separately from judge. Strict VALID/INCONCLUSIVE result, independent validator comparison, 3 recorded attempts and 24-hour recovery deadline.
- Explicit UNRESOLVED 50/50 fallback; never labels an unusable audit clean.
- Corrected public-guess disclosure throughout UI/docs.
- Durable withdrawal requests, no credit-zero delivery claim, recipient attestation, fully funded optional compensation. Trustless failed-payment recovery remains unavailable on Studio.
- Frontend checks v2 ABI, wallet changes, encoded calldata, pending transaction persistence and postconditions; scoped room/secret storage.
- Replaced incompatible v1 scenario tests with v2 regression cases; retained hashing, encoding and payment-format tests. Removed obsolete v1 mutation counts and semantic-gate report from current acceptance claims.
- Archived v1 evidence explicitly as historical. No v2 chain hashes or results fabricated.
