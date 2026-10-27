# Unit menu ownership

`StudentActivityMenu` is the eager entry point. It owns session invalidation,
bounded code/style preparation, account/unit/school/navigation checks and report
snapshots. `studentUnitWorkspace.js` is private presentation: cards, required-path
markup, scroll cue and export popover. Its factory receives only fixed readers,
a guarded view action and the report-generator loader; it cannot access the
manager or install methods on it.

Normal unit loads and teacher preview await the workspace before rendering.
Direct activities and direct Quiz preview do not request it. Result application
and gate refresh remain synchronous: they can refresh an already styled, visible
workspace, but cannot import one. Export may acquire the implementation without
styles; that does not grant presentation readiness.

`resetForSession()` invalidates pending preparation before awaiting anything,
disposes scroll listeners and drops private UI state. Ordinary unit/activity
navigation retains the workspace and leaves pending progress receipts alone.
Reports capture their educational data before imports; later edits in the same
unit remain valid, while account, school, session, unit and navigation changes
cancel output. Import and export deadlines also prevent late output.

The retained stylesheet loader preserves failure. A missing stylesheet keeps the
unit recovery message visible on retry rather than treating Vite's cached failed
import as success. Back/Home remain available; recovery advises a real reload.

## Verification

Run `node --test tests/student-unit-workspace.test.mjs
tests/student-school-export.test.mjs` for held imports, reset/owner changes,
same-hash navigation, timeout/retry, retained CSS failure and report snapshots.

Run `node scripts/ui-student-unit-workspace-smoke.mjs` for mocked real controllers,
cold route ownership, export/popover, activity/Back and failure navigation. Set
`UI_STUDENT_UNIT_WORKSPACE_DIST=1` after an official fresh build to exercise the
compiled graph. These controls block service workers to measure requested app
execution assets; full offline background precaching intentionally remains.

Presentation parity uses the separately anchored source and historical built
references documented in `student-presentation-parity.md`. The extraction must
preserve the known narrow teacher-preview clipping until its separate repair.
