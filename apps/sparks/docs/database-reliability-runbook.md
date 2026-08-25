# Database reliability runbook

> **Status (2026-08-25):** The normalized progress cutover and legacy-table retirement are complete. This document is the retained reliability, verification, and rollback record; it is not a pending migration checklist.

## Purpose

This runbook defines the safety rules, service objectives, rollout gates, and
rollback requirements for the student-progress storage migration. It applies to
browser, desktop, offline, teacher, and database changes.

## Non-negotiable invariants

1. An acknowledged student result must not disappear.
2. Replaying the same client event must not award XP or coins twice.
3. Best score and completed status must not move backward.
4. Coin and XP changes must be committed atomically with the progress event that
   caused them.
5. Two devices updating different activities must not overwrite one another.
6. Offline work must remain local until the server acknowledges its event ID.
7. A student may access only their own data. Teachers retain their existing
   authorized access.
8. Cached clients must be refreshed at the normalized-only release boundary;
   legacy mutation RPCs are removed after that release is verified live.
9. Images and large binary payloads belong in Storage, never in progress JSON.
10. Every rollout step must have a read-only verification query and a tested
    recovery path before it can be enabled.

## Service objectives

| Signal | Objective |
| --- | --- |
| Acknowledged progress saves retained | 100% |
| Duplicate XP or coin application | 0 |
| Progress mutation success rate | >= 99.9% |
| Progress mutation p95, excluding client network loss | <= 500 ms |
| Meaningful database writes per student action | <= 1 |
| Typical progress mutation response | <= 2 KB |
| Offline replay backlog | drained within 5 minutes of reconnect |
| Reconciliation between legacy and normalized models during migration | 100% |
| Realtime database execution share after cutover | < 10% |
| WAL generated per active student after cutover | >= 60% below baseline |

## Baseline captured 2026-08-16

The linked Supabase project reported statistics accumulated since its May 2026
creation:

| Signal | Baseline |
| --- | ---: |
| Database size | 34 MB |
| `student_progress` rows | 236 |
| `student_progress` total relation size | 9.6 MB |
| `student_progress` updates | 366,698 |
| HOT updates | 89 |
| Full-row progress reads | 78,689 |
| Activity-progress RPC calls | 146,387 across the old and current signatures |
| Unit-work RPC calls | 73,464 |
| Realtime `list_changes` calls | 3,178,912 |
| Realtime share of recorded execution time | 85.8% |
| Cumulative WAL generated | 6.2 GB |
| Current WAL retained on disk | 128 MB |
| Average `units` JSON size | 8,973 bytes |
| Average `coin_history` JSON size | 5,492 bytes |

The PostgreSQL statistics reset timestamps must always be captured with later
measurements. Cumulative values from different reset windows must not be compared
as if they were daily values.

## Phase gates

### Phase 1: client write reduction

- No generic unit-work save follows an activity-progress RPC for the same event.
- Intermediate progress is coalesced; completion and lifecycle flushes remain
  immediate.
- Duplicate and unchanged payloads do not call the server.
- Contract, activity, offline, and UI smoke tests pass.

### Phase 2: normalized model

- All new exposed tables have RLS, explicit grants, constraints, and indexed RLS
  keys.
- Security-definer implementation functions remain in `private`.
- Mutation RPCs require an idempotency key and return compact results.
- Concurrent and repeated submissions produce one logical outcome.

### Phase 3: dual write and reconciliation

- Backfill reports no unexplained student, unit, activity, XP, or coin drift.
- One database transaction owns both legacy and normalized writes.
- Clients never perform independent dual writes.
- A reconciliation query can be run repeatedly without changing data.

### Phase 4: notification cutover

- Notifications contain no full progress document.
- Missed notifications are recovered on reconnect, focus, or stale-version check.
- The writing client does not perform a redundant echo refresh.
- `student_progress` can leave the Postgres Changes publication safely.

### Phase 5: read cutover

- New reads can be enabled per client through one local/server feature flag.
- Legacy RPC wrappers remain operational.
- Snapshot parity remains exact before each rollout increase.
- Rollback requires a flag change, not a down migration.

### Phase 6: retirement

- Full-row logical decoding and its replica-identity amplification are removed.
- The normalized-only app and account-creation function are deployed and
  verified before the legacy table is removed.
- The deletion transaction refuses to run if any current student lacks a
  normalized summary or any legacy row lacks a normalized recovery copy.
- Index and replica-identity cleanup is verified from live catalogs.
- Advisors, release tests, backup/restore instructions, and monitoring checks pass.

## Rollback policy

Schema migrations are forward-only. Before legacy deletion, rollback means
redeploying the last compatible app while both models still exist. After the
verified deletion, the normalized tables, XP ledger, coin ledger, and idempotency
receipts are the source of recovery; the removed JSON document is not recreated.

Never recover by deleting normalized rows or reconstructing an unchecked full
document. Investigate from stored event IDs and ledger records, repair with a
reviewed forward migration, and run the normalized integrity report afterward.

This project did not have physical backups or point-in-time recovery available
at the August 2026 cutover. Enable a supported backup tier before the next
destructive schema retirement, and perform a restore drill at least quarterly.

## Operational review cadence

- Per release: repository contracts, Supabase acceptance tests, RLS tests,
  advisors, migration list, and workload comparison.
- Weekly during rollout: reconciliation, RPC errors, offline backlog, WAL rate,
  Realtime execution share, and old-client compatibility calls.
- Quarterly: backup restore drill, concurrent-device test, offline replay test,
  dependency review, and retention review.
