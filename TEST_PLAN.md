# TEST_PLAN

## Cases (each pair shares its surface and carries opposite labels)

| Case | Secret ‖ question ‖ reply | Expected |
|---|---|---|
| H1 | volcano ‖ Is it found in nature? ‖ YES | HONEST |
| H2 | violin ‖ Does it need electricity to work? ‖ NO | HONEST |
| H3 | penguin ‖ Can it fly? ‖ NO | HONEST |
| H4 | lighthouse ‖ Is it usually near water? ‖ YES | HONEST |
| H5 | candle ‖ Does it get smaller when used? ‖ YES | HONEST |
| L1 | volcano ‖ Is it found in nature? ‖ NO | LIE |
| L2 | violin ‖ Does it need electricity to work? ‖ YES | LIE |
| L3 | penguin ‖ Can it swim? ‖ NO | LIE |
| L4 | lighthouse ‖ Is it usually in a desert? ‖ YES | LIE |
| L5 | candle ‖ Does it get bigger when used? ‖ YES | LIE |
| U1 | violin ‖ Is it bigger than a breadbox? ‖ NO | ARGUABLE (must not be listed) |
| U2 | lighthouse ‖ Is it old? ‖ YES | ARGUABLE (must not be listed) |

- **Kill tests:** H1/L1, H2/L2, H4/L4 — the same item and question, or one word apart; the rubric does not hint at the
  mechanism.
- **Definition checks:** H3/L3, H5/L5.
- `HONESTKEEPER_KILLSET_CHECK.py` proves no word or word pair separates the classes, and that the rubric shares no
  content word with any case.

## Deterministic behaviour → test (`tests/contract/test_honestkeeper.py`, Direct Mode, model mocked)

| Behaviour | Test |
|---|---|
| The tooth: one log, only the plain lie pays | `test_tooth_same_log_only_the_plain_lie_pays` |
| An honest log returns the whole bond to the keeper | `test_honest_log_returns_the_whole_bond_to_the_keeper` |
| Each listed position pays its own asker; at most five are paid | `test_each_listed_position_pays_its_own_asker`, `test_at_most_five_positions_are_paid` |
| No question, no model call | `test_reveal_without_questions_does_not_call_the_model` |
| The earliest correct guess wins | `test_winner_is_the_earliest_correct_guess`, `test_no_correct_guess_leaves_no_winner` |
| Forfeit after the deadline; a late reveal is still judged | `test_forfeit_splits_the_bond_among_everyone_who_asked`, `test_a_pending_question_counts_as_asked_for_forfeit`, `test_keeper_may_still_reveal_after_the_deadline_if_nobody_forfeited` |
| Withdraw pays once; the ledger balances across games | `test_withdraw_pays_the_credit_once`, `test_credits_accumulate_across_games_and_the_ledger_balances` |
| Roles | `test_third_wallet_is_refused_by_every_keeper_or_player_write`, `test_keeper_is_refused_as_a_player` |
| Commitment and game id | `test_commitment_normalizes_secret_whitespace_and_case`, `test_salt_is_used_verbatim`, `test_commitment_argument_accepts_0x_and_upper_case`, `test_same_commitment_from_another_keeper_is_another_game` |
| Day arithmetic | `test_today_matches_calendar_arithmetic` |
| Fail-safe and the strict list | `test_fail_safe_on_unparseable_output`, `test_fail_safe_on_an_out_of_range_position`, `test_fail_safe_on_an_element_that_is_not_a_whole_number`, `test_list_is_deduplicated_sorted_and_digit_strings_coerced` |
| Validator function | `test_validator_accepts_agreement_and_rejects_everything_else`, `test_validator_accepts_matching_empty_list` |
| Prompt never sees wallets, money, guesses or the salt; fence is a fixed point | `test_prompt_never_sees_wallets_state_money_guesses_or_salt`, `test_fence_strip_is_fixed_point` |
| Guesses stay hidden until the reveal | `test_guesses_stay_hidden_until_reveal` |
| Every revert string has a dedicated test; check order | `test_every_revert_string_has_exactly_one_dedicated_test`, `test_check_order_ask`, `test_check_order_reveal_and_forfeit` |
| The planned on-chain table, replayed in order | `test_runtime_table_in_order` |
| Commitment and game-id vectors shared with the frontend | `test_vectors_match_contract` |

Frontend (`tests/js/*.test.ts`): Python-string parity, commitments and game ids against the contract vectors, GEN ↔ wei
with bigint, view parsing, every revert sentence equal to the source and fired in the source's order, postconditions for
every write (including the payout arithmetic of a reveal), receipt classification, calldata sizes, source hash,
repository rules.
