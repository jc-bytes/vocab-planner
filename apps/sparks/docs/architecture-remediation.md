# Sparks architecture remediation

This document tracks the incremental remediation started on 2026-08-24. Each task must leave the project in a tested, known-good state before the next task starts.

## Working rules

- Change one architectural concern at a time.
- Reinspect current callers, persistence, UI, and tests before editing.
- Preserve the existing game registry, lazy loading, repository seams, ownership tests, and security rules.
- Add a test when a change creates a new architectural contract.
- Remove compatibility code when its last caller is migrated.
- Do not reorganize folders unless the files are already changing for a behavioral reason.

## Baseline

| Item | Result |
| --- | --- |
| Date | 2026-08-24 |
| Starting commit | `490b36dc Simplify Sparks module ownership` |
| Remediation branch | `codex/sparks-architecture-remediation` |
| Scoped worktree | Clean before remediation |
| Full suite | `npm test` passed, including student shell, page smoke, and 13 HTML game sandbox checks |
| Student design audit | `npm run test:student-design` passed |
| Production build | `npm run desktop:build:web` passed in 7.83 seconds |
| Built-page smoke | `npm run test:ui:smoke:dist` passed all three routes against a fresh build |
| Dependency audit | `npm audit --audit-level=high` found 0 vulnerabilities |
| Import graph | Independent static check found 0 cycles across 215 first-party modules and 494 imports |
| Deployment size | 15.1 MB, under the 30.0 MB limit |
| Student entry | 263.88 kB raw, 68.28 kB gzip |
| Teacher entry | 165.81 kB raw, 45.35 kB gzip |
| Student CSS | 227.37 kB raw, 35.03 kB gzip |
| Teacher CSS | 149.89 kB raw, 24.40 kB gzip |
| Largest lazy feature | `reportGenerator`, 419.74 kB raw, 135.90 kB gzip |
| Student service worker | 17 files, 1,032,872 bytes precached |

The test suite intentionally exercises handled failure paths that log errors. These logs did not fail the baseline. No baseline failure requires remediation before architectural work begins.

## Task tracker

| Task | Status | Files changed | Verification | Decision or result |
| --- | --- | --- | --- | --- |
| 0. Establish baseline | DONE | `docs/architecture-remediation.md` | Full suite, design audit, production build, built-page smoke, dependency audit, independent review | Source and built application are green. Local Supabase checks remain unknown because Docker is unavailable. |
| 1. Activity catalog foundation | DONE | `js/student/studentActivityRegistry.js`, `js/teacherVocabularyEditorConstants.js`, registry tests | Registry, teacher-flow, 128 activity, build-efficiency tests; UI smoke; production build | Existing registry now owns teacher setting keys, labels, IDs, and order. Rewards stay server-authoritative. |
| 2. Activity catalog validation | TODO | | | |
| 3. Client/server activity parity | TODO | | | |
| 4. Migrate activities one at a time | TODO | | | |
| 5. Consolidate duplicated configuration | TODO | | | |
| 6. Remove confirmed dead code | TODO | | | |
| 7. Investigate legacy quiz implementation | TODO | | | |
| 8. Introduce semantic design tokens | TODO | | | |
| 9. Migrate shared UI families | TODO | | | |
| 10. Reduce literal brand colors | TODO | | | |
| 11. Reduce unnecessary `!important` | TODO | | | |
| 12. Clean up owned inline styles | TODO | | | |
| 13. Create lightweight shared UI modules | TODO | | | |
| 14. Standardize application feedback | TODO | | | |
| 15. Map teacher feature dependencies | TODO | | | |
| 16. Convert one teacher feature | TODO | | | |
| 17. Validate the teacher feature pattern | TODO | | | |
| 18. Migrate remaining teacher features | TODO | | | |
| 19. Create a small page registry | TODO | | | |
| 20. Migrate teacher pages | TODO | | | |
| 21. Remove duplicated navigation wiring | TODO | | | |
| 22. Analyze broad forwarding interfaces | TODO | | | |
| 23. Reduce forwarding where a cohesive use case exists | TODO | | | |
| 24. Remove obsolete facade methods | TODO | | | |
| 25. Move legacy game adapters into descriptors | TODO | | | |
| 26. Define a host/game protocol | TODO | | | |
| 27. Add game registry contract tests | TODO | | | |
| 28. Review Supabase seams | TODO | | | |
| 29. Add interfaces only where justified | TODO | | | |
| 30. Consolidate environment authority | TODO | | | |
| 31. Correct stale documentation | TODO | | | |
| 32. Create `ARCHITECTURE.md` | TODO | | | |
| 33. Organize changed features gradually | TODO | | | |
| 34. Add delivery-size budgets | TODO | | | |
| 35. Preserve lazy loading | TODO | | | |
| 36. Remove code and CSS proven obsolete | TODO | | | |
| 37. Final architecture verification | TODO | | | |

## Change log

### Phase 0, baseline

- Confirmed a clean Sparks-scoped worktree on `main` before creating the remediation branch.
- Ran the complete existing automated suite and the separate student design audit.
- Rebuilt `dist-desktop` and recorded raw, gzip, deployment, and service-worker metrics.
- Ran the built-page smoke test against a fresh production build and found no high-severity dependency advisories.
- An independent import-graph check found no cycles across 215 first-party modules and 494 imports.
- An independent full-suite run saw one Vite development WebSocket refusal during the student-shell test. Its immediate isolated rerun passed. The primary full-suite run also passed. Treat this as a test-runner flake to watch, not an application baseline failure.
- Local Supabase acceptance, lint, and advisor checks remain unknown because Docker is not running. Authenticated production checks also remain outside this credential-free baseline. Existing source-level database, security, and repository tests passed.
- Chose the existing `studentActivityRegistry.js` as the activity-catalog seam. Creating a second catalog would introduce the duplicate authority this remediation is meant to remove.
- Confirmed that all 12 activity modules are dynamic Vite entries. Catalog work must preserve that build property.

### Task 1, activity catalog foundation

- Added each teacher activity setting key to the existing activity registry.
- Derived teacher activity options, IDs, labels, order, and setting-key lookup from that registry. The duplicate 12-entry teacher list is gone.
- Kept launch factories, activity flow defaults, routes, persistence, and SQL unchanged.
- Did not move the unused client XP map into the registry. Supabase calculates rewards and the client displays the returned total delta, so copying the map would create a false reward authority.
- Preserved lazy loading. The production manifest still keeps teacher feature imports separate and the build stays at 15.1 MB.
- Independent review found zero cycles across 288 first-party JavaScript files and 523 resolved imports. The teacher entry kept its five existing lazy features and gained no activity imports.

## Remaining work

Phase 1 starts with a read-only trace of every activity authority. The first implementation must establish the activity descriptor contract without moving all activity launch behavior at once.
