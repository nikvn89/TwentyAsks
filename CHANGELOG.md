# Changelog

## 1.0.0 — 2026-10-06

- Contract `HonestKeeper` (frozen, SHA-256 `3d305aa9…afae009ea`) deployed for this Project at
  `0x04A003704FDFAdE01D79213ab78B8D3c4c6CC0A2` (StudioNet). The Intelligent Contract submission is a separate deployment
  of the same source.
- App: overview; game rooms with the log, YES/NO replies, whose turn it is and the reveal deadline in days, then STANDS /
  PLAINLY FALSE marks with the GEN each paid; an open form that generates the salt and shows the commitment and game id
  before signing; credits with withdraw; a verification page reading `get_limits`.
- Run through the app on StudioNet (11 transactions, `RUNTIME_EVIDENCE.md`): the reveal listed only the plainly false
  reply; 0.002 GEN to the misled player, 0.008 GEN to the keeper; both withdrew.
- Tests: 74 Direct Mode contract tests, 28/28 mutants, frontend tests, calldata table and RPC probe, source hash; CI.
