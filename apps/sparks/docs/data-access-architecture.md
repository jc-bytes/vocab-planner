# Data access architecture

## Rule for first-party code

First-party application code must use domain-specific repositories or domain-specific RPC clients. Do not introduce Firestore-shaped collection, document, snapshot, query, or batch abstractions.

The browser uses the existing initialized `@supabase/supabase-js` client. Repositories own table names, database field names, query construction, and row-to-application mapping for their domain. UI and manager modules consume business-oriented methods and do not build PostgREST queries.

## Why the compatibility layer was removed

The previous implementation translated Firestore-style collection names, document references, snapshots, filters, and timestamps into Supabase queries. It added a second data model over Postgres and included a misleading `writeBatch()` method that executed independent requests sequentially without a transaction. No runtime consumer used that pseudo-batch when the layer was removed.

The migration preserved the existing camelCase application record shapes while moving their conversion next to the owning domain. No database schema or persisted browser-storage format changed.

## Repository ownership

| Repository or domain service | Owned resources | Public operations |
| --- | --- | --- |
| `settingsRepository` | `app_settings` | `get`, `save` |
| `subjectsRepository` | `subjects` | `list`, `saveAll` |
| `vocabularyRepository` | `vocabularies` | `list`, `get`, `save`, `update`, `remove` |
| `sparksRepository` | `weekly_sparks` | `list`, `listScheduledForStudent`, `save`, `update` |
| `studentProgressRepository` | `student_progress` reads and Realtime | `get`, `subscribe` |
| `leaderboardRepository` | `scores` reads | `get`, `listTop`, `listForUser` |
| `teacherExportRepository` | export reads from `student_progress`, `profiles`, and `scores`; writes to `export_logs` | `getStudentProgress`, `getProfile`, `listScores`, `logExport` |
| Auth/profile service | Supabase Auth and `profiles` | sign-in, sign-up, profile reads/writes, student roster reads |
| Student RPC client | validated progress and score writes | domain-specific RPC methods such as `submitStudentActivityProgress` and `submitStudentGameScore` |
| Word Hunt Storage service | `word-hunt-images` bucket | path construction, upload, download, delete |

`studentApi.js` and `teacherApi.js` expose only the existing authenticated domain service. They do not re-export data primitives.

## Mapping and timestamps

Repositories map snake_case database fields to the pre-existing camelCase application shapes. Shared scalar/profile/progress mappings that are also required by Auth, RPC results, or Realtime live in `services/supabaseValues.js`. It contains no table registry, generic query builder, document reference, or snapshot abstraction.

Application-facing timestamps retain the legacy `{ seconds, nanoseconds, toDate() }` shape where existing rendering/export code relies on it. Writes use ISO timestamps. This is a result-shape compatibility decision, not a database API abstraction.

## Transactions and multi-record operations

No compatibility `writeBatch()` consumer existed at migration time, so no replacement transaction RPC was required.

Subject saves and calendar-driven vocabulary placement updates remain explicitly independent writes, preserving their previous partial-failure behavior. Existing Student progress and score writes continue through narrowly scoped Postgres RPCs, which own their current validation and transactional guarantees. Future atomic multi-record behavior must be implemented as a domain-specific Postgres function/RPC, never as a generic client batch.

## Realtime and lifecycle

`studentProgressRepository.subscribe()` owns the `student_progress` channel, user filter, row mapping, and unsubscribe operation. `StudentProgress` remains responsible for starting and stopping the subscription with the rest of its existing offline, visibility, focus, and safety-refresh lifecycle.

## Authorization and RLS

Repositories use the signed-in browser client and do not use privileged keys or bypass RLS. Existing table policies and domain RPC authorization remain authoritative. The migration introduced no schema, grant, policy, or service-role changes.

## Tests

`tests/repository-contracts.test.mjs` verifies mapping and result-shape compatibility with built-in `node:test`. Local authenticated smoke tests and Supabase lint/advisors verify integration behavior when the Docker-backed local stack is available. UI smoke and Student Shell tests remain behavior-level guardrails.

## Migration inventory

| Domain | Previous operations | Risk and preserved behavior |
| --- | --- | --- |
| Settings | document read/upsert of `app_settings` | Medium; flattened setting values and local fallbacks preserved. |
| Subjects | collection read and independent upserts | Medium; normalization, defaults, and independent writes preserved. |
| Vocabulary | list/get/upsert/update/delete | High; source merging, cloud overrides, placement recalculation, and record shape preserved. |
| Sparks | list, scheduled filtered query, save/archive | High; ordering, grade targeting, duplicate constraint errors, and cache behavior preserved. |
| Progress | document reads plus Realtime | Critical; RPC writes, offline queue, local storage, retry, and subscription teardown preserved. |
| Leaderboards | score read and filtered/ordered list | High; deterministic IDs, lower-is-better SpacePi ordering, limits, and RPC writes preserved. |
| Teacher exports | progress/profile reads, score lists, export-log insert | Medium; per-student error isolation and export shapes preserved. |

The removed adapter fully emulated basic reads and snapshots, partially emulated merge/upsert semantics, ignored unsupported filter operators, created client timestamps rather than database-generated timestamps, and mislabeled sequential independent requests as a batch. It provided no retry or error transformation.
