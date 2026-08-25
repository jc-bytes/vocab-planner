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

## Task 28 boundary review

The August 2026 remediation review traced authentication/session, activity progress, vocabulary, rewards, leaderboards, and Word Hunt assets from their UI callers through the browser API and database authority. No raw Supabase client, table query, RPC call, Realtime channel, or Storage bucket call was found in UI, activity, game, or teacher-feature implementation code. Raw access remains confined to `supabase*` adapter modules and domain repositories under `js/services/`.

| Domain | Application boundary | Supabase owner | Independent authority or alternate path | Decision |
| --- | --- | --- | --- | --- |
| Student authentication/session | Frozen `studentApi` allowlist, consumed by `StudentAuth` and authentication UI | `supabaseAuthProfileMethods.js` and the single client factory | Supabase Auth session; owner-scoped browser cleanup and stale-initialization aborts | Keep `studentApi`. It prevents student modules from acquiring teacher and raw-client capabilities. |
| Teacher authentication/session | Frozen, injectable `teacherAuthApi` capability | `supabaseAuthProfileMethods.js` | Auth session, current `profiles` verification, teacher allowlist RPC, RLS | Keep the narrow capability and fail the shell closed. Do not create a generic service container. |
| Activity progress | Activity coordinator, attempt service, offline owner-partitioned queue, and `studentApi` | `supabaseStudentWriteMethods.js`; reads and Realtime in `studentProgressRepository.js` | Owner-bound RPCs independently verify `auth.uid()` and return authoritative progress/reward state | Keep the offline queue and explicit student allowlist. Signed-in rewards must not be committed locally before the RPC accepts them. |
| Vocabulary | `vocabularyRepository` plus local/bundled/cloud source selection | `vocabularyRepository.js` | Teacher-only mutations, authenticated reads, local and bundled sources | No new interface. The repository already owns database mapping while source aggregation remains a separate application concern. |
| Rewards and Arcade wallet | Student coin/progress owners call the explicit student API | `supabaseStudentWriteMethods.js` | Transactional server RPCs and returned wallet state | Server remains authoritative. Moving methods merely to make read/write filenames symmetrical is not enough reason for another wrapper. |
| Leaderboards | `leaderboardRepository` for reads; student API for score submission | Repository queries plus score RPC adapter | Score RPC derives identity/grade and enforces allowed games/order independently | Keep the security split. Static parity now requires exact client/server capability and direction agreement without sharing client configuration with SQL. |
| Word Hunt images | Student Word Hunt operations and the teacher review's injected two-method repository | `supabaseStorageMethods.js` | Private bucket, owner path RLS, MIME/size policy; teacher read/delete policy | Existing teacher injection is a useful test seam. Deepen student save into one owner-scoped use case only if it removes arbitrary path construction without broadening access. |

### Confirmed strengths

- The browser creates one Supabase client and uses only a publishable or legacy anonymous key. No privileged key exists in application source.
- Student code cannot reach `getClient`, teacher account operations, or teacher reward operations through `studentApi`; its frozen allowlist has a dedicated contract test.
- UI and manager modules do not build PostgREST queries. Teacher lazy features receive the exact repository or data capabilities they use.
- Student offline replays verify the live authenticated owner in the client adapter and again in owner-bound database RPCs.
- Progress writes, rewards, Arcade time, and scores remain server-authoritative. RLS and RPC grants are independent from client metadata.
- Word Hunt Storage is private, owner-prefixed, WebP-only, and capped at 64 KB. Teacher review owns object-URL cleanup and stale-result suppression.

### Actionable findings and routing

1. **Resolved — signed-in optimistic reward state:** authenticated activity coins now update only from accepted server snapshots; intentional auth-disabled mode retains local rewards.
2. **Resolved — stale teacher role fallback:** the teacher shell now requires current verification, clears rejected state, and allows a fresh same-account retry after transient failures.
3. **Medium — browser secret-key guard:** the shared configuration validator rejects placeholders but not known secret/service-role key formats. No leaked key was found. Task 30 will reject privileged formats in runtime and build validation.
4. **Resolved — game policy drift:** the client leaderboard set and score directions must match the independently defined effective SQL policy. Four stale server-only capabilities were removed.
5. **Medium — broad internal auth file:** `supabaseAuthProfileMethods.js` also contains teacher roster/progress RPC methods. This is internal module organization, not a leaked client interface. Split it only when one of those operations is materially changed; an import-only rearrangement is not justified.
6. **Low — dead or uncertain surfaces:** unused export-repository methods, an unused Storage delete method, dormant auth flows, and the unpopulated `cloudVocabs` collection are candidates for Task 36. Each still requires exact caller and behavior confirmation before removal.

### Interface decision rule

Do not wrap repository objects in another layer. A new or extracted interface is justified only when it enforces a capability/security boundary, supports a real alternate implementation, or enables a needed test double that the current module cannot provide safely. Passing a narrow function or repository into a feature factory is preferred over introducing a generic dependency container.

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
