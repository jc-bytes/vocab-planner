# Reward-protection resolution

Date: 2026-11-16  
Finding: R1, Major, from the [single-agent review](review_report.md)  
Classification: PROPOSE FIX, accepted and applied under the user's instruction to fix reward protection first.  
Status: Resolved in design. Implementation and SQL acceptance remain pending.  
Method: The same agent traced local source and revised the documents without subagents or an independent Goldfish review.

## Discrepancy and rationale

The original design linked learning results to ordinary attempt rows without a trusted protocol discriminator or a complete list of legacy write guards. Its summary-first lock order conflicted with existing attempt-first reward writes. An existing completion trigger could also grant XP outside the new bridge. These omissions left reward ownership and concurrency behavior undefined.

## Applied changes

Section 2 and section 5 of the [design](activity-results.md) now require typed immutable protocol/link fields, deferred pair integrity, atomic creation on claim, precise finished/completed markers and bounded compatibility references. Legacy progress and general-time paths reject owned learning attempts before locks, shortcuts or reward effects. Startup counts, reuse and cleanup select ordinary legacy rows. Teacher late annotations retain their existing narrow authorization.

The same sections define one summary-first lock order for shared reward writers and restrict attempt-only operations to writes that never acquire reward locks. A private learning bridge derives facts from accepted evidence, uses typed revision/completion checkpoints and shares reward calculation with validated legacy writes. Execution grants are explicitly closed for trusted helpers. The completion XP trigger skips learning rows; the amount-normalization trigger and required-first/optional-repeat uniqueness rules remain authoritative.

A typed progress completion mode preserves historical completion while preventing new coverage of 100 from becoming an implicit pass. Mixed old/new attempts serialize reward deltas under the same locks. Only successful unique ledger/XP insertions change wallet totals. Results, compatibility projections, checkpoints, receipts and rewards commit or roll back together.

The retained [draft](design_draft.md), migration/file manifest and verification matrix contain the same requirements. No scoring allocation, passing target, reward schedule, device access or teacher replacement-credit rule changes.

## Source trace

These historical migrations are evidence for current local entry points. Implementation must amend current definitions through the planned forward migration, leaving these files unchanged.

| Source | Relevant owner |
| --- | --- |
| [strict progress](../../../supabase/migrations/20261026121540_simplify_progress_compatibility_and_row_lock.sql) | Strict legacy wrapper, receipt shortcut and attempt-first lock |
| [normalized progress](../../../supabase/migrations/20260816054503_direct_normalized_student_progress_operations.sql) | Legacy v2, reward deltas, completion shortcut and unit-work state boundary |
| [workspace access](../../../supabase/migrations/20260909033621_private_workspace_access_cutover.sql) | Current private v3 and summary-first unit-work synchronization |
| [owned replay guards](../../../supabase/migrations/20260816225620_cross_user_offline_replay_guard.sql) | Owned progress/synchronization wrappers |
| [startup](../../../supabase/migrations/20260822144658_replace_expired_activity_attempts.sql) | Legacy rate count, stale deletion and attempt reuse |
| [time reporting](../../../supabase/migrations/20260909035308_finish_workspace_scope_guards.sql) | General-time mutation |
| [completion trigger](../../../supabase/migrations/20260816060159_remove_legacy_student_progress.sql) | Current fallback XP trigger and retired unversioned functions |
| [school ownership](../../../supabase/migrations/20260917131024_school_classroom_ownership.sql) | Summary row lock and authorized late annotation |

## Verification and limits

Documentation checks verify final/draft identity, relative links, Markdown fences, the retained original review digest and coverage of named guard/trigger/lock requirements. These checks do not execute the proposed SQL.

Implementation acceptance requires actual SQL calls against every retained legacy progress entry point and private executable leaf in each learning lifecycle state. It also requires protocol forgery/collision rejection, seven-day cleanup isolation, time/annotation boundaries, controlled overlapping legacy/new transactions, trigger exclusion, exact reward parity and rollback after ledger/completion writes. The design's R1 verification rows specify these cases. A migration-text check alone cannot satisfy them.

R2–R5 remain open. The next issue is R2's evidence upload and finalization contract. No feature code, migration, hosted database or deployment changed for this resolution.
