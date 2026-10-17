# v2 runtime evidence — NOT RUN

No v2 deployment or live transactions were performed during this revision.
`deployments.json` deliberately has empty current addresses. Local mock results are
not substitutes for the live cases in `TESTING.md`.

The original report remains in `docs/history/v1-evidence.md`, clearly marked v1.
Its UI screenshots show old wording, including an incorrect delivery claim; they do
not establish recipient balances or validate this revision.

For each new case save: exact source SHA, deployment address, game id, wallet role,
method/args (after secret reveal), parent hash, final status, GenVM result, validator
votes, accepted/finalized state and expected versus observed outcome. A mismatching
model result is a failed case, not a reason to silently change expected results.

For a withdrawal also save: withdrawal sequence/amount/recipient; separate outgoing
Send hash linked to the parent; its completion status; recipient balance immediately
before and after; relevant block/time and any intervening transactions or gas adjustments.
Do not infer delivery from an unrelated balance increase or parent SUCCESS alone.

The read-only `tools/collect-evidence.mjs` can collect raw RPC responses into a JSON file.
It deliberately never certifies delivery automatically. Cross-check the outgoing transaction
and parent linkage in the explorer. Missing/unsupported RPC fields remain explicit errors.

When ready, update this document with observed results and the real submitted commit SHA.
Do not resubmit this version as fully live-tested until the required evidence is collected.
