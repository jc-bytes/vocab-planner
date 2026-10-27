# Loading presentation audit

Date: 27 October 2026. Follow-up to the oversized class-selector arrow on refresh.

## Scope

Inspect the shipped landing, student, teacher, and student-preview entry documents before application startup code runs. Exercise 20 real student loading templates, including 12 activity layouts, at 1440, 768, 390, and 320 pixels. Check hidden controls, control-icon size, placeholder geometry, narrow-screen overflow, reduced motion, and geometry changes when deferred feature styles arrive. Run the same presentation checks against source and the production build.

Existing focused browser checks cover 18 teacher refresh routes, both sign-in roles, teacher Library toolbars, preview startup/retry, and 13 HTML game launches. Legacy grade-join wrappers are inspected/tested as source redirects; they are not production build entrypoints.

## Confirmed issues and fixes

| Issue | Reproduction | Fix |
| --- | --- | --- |
| Student Arcade and activity loading shapes depend on deferred CSS. | With startup scripts withheld, Arcade collapses into an unstructured stack and activity placeholders use the wrong answer layout. The first-paint test failed before repairs. | Load the small layout and activity-placeholder stylesheets through the student HTML head. Keep full activity/game styles deferred. Remove the skeleton generator's asynchronous style side effects and the duplicate deferred loading-style import. |
| The Sparks reading placeholder changes shape after feature styles arrive. | At 1440px it changed from a 773px stack to a 539px two-column layout. Phone/tablet layouts also shifted. The before/after geometry check failed at all four widths. | Give the loading placeholder its own heading, reading/question columns, step rows, spacing, and responsive borders. Its geometry is now unchanged when the full Spark stylesheet arrives. |
| The teacher's embedded student preview starts unthemed and can mount activity markup before its styles finish. | The bare preview document has no themed background. Holding a required student stylesheet exposed the premature content replacement. | Style the initial preview document immediately. Keep its loading state visible while required stylesheets load; handle load failure or an eight-second deadline as an explicit error. Mount student markup only after the styles are ready. Retry creates a fresh preview. |

The previous teacher arrow fix remains intact: header control styles are eager, hidden selectors stay hidden, and their SVG sizes remain bounded before class-workspace code loads. The follow-up did not find another oversized-arrow case in the inspected entry documents.

## Verification

- `node scripts/ui-loading-first-paint-smoke.mjs`: four entry pages, 20 student loading layouts, four viewport widths, source redirect wrappers, reduced motion, and stable geometry before/after deferred feature CSS.
- `LOADING_FIRST_PAINT_DIST=1 node scripts/ui-loading-first-paint-smoke.mjs`: corresponding checks using production HTML/CSS and built feature stylesheet dependencies.
- `TEACHER_LOADING_DIST=1 node scripts/ui-teacher-loading-smoke.mjs`: 18 refresh routes, hidden class selector, bounded SVGs, narrow layouts, reduced motion, and session-loading behavior.
- `node scripts/ui-library-toolbar-startup-smoke.mjs`: no early control flash or later toolbar movement across three Library tabs and three widths.
- `node scripts/ui-teacher-preview-startup-smoke.mjs`: lost ready event, held stylesheet, themed pending frame, stylesheet failure/retry, and failed bootstrap/retry.
- `node scripts/ui-auth-layout-smoke.mjs` and `AUTH_LAYOUT_DIST=1 node scripts/ui-auth-layout-smoke.mjs`: student/teacher sign-in and account-link/password-toggle layouts at four widths.
- `node scripts/ui-game-sandbox-smoke.mjs`: 13 HTML game launches.
- `npm run test:unit`: 1,562 tests passed.
- Production build passed. Student initial JS/CSS is 189.6 KiB gzip against a 210 KiB budget; teacher initial JS/CSS is 161.5 KiB against 180 KiB. Full activity features remain lazy.

The new first-paint regression runs through `test:checks`; its production variant runs after the web build in `test:release`. Screenshots are in `/tmp/sparks-loading-first-paint/source` and `/tmp/sparks-loading-first-paint/dist`.

## Limits

These checks use local browser fixtures and local production-build assets. They do not establish live deployment, physical-device behavior, real-account authorization, or offline service-worker acceptance. No school records, backend schema, or hosted deployment were changed.
