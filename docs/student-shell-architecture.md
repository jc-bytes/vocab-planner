# Student shell architecture

This document describes the accepted responsive shell contract. It records the effective behavior already implemented in `css/student.css` and the matching JavaScript state boundary; it does not replace the stylesheet or define a second layout system.

## Responsive contract

The student shell has exactly two states:

| State | Width | Effective behavior |
| --- | --- | --- |
| Compact | `<= 1120px` | The compact header is active, the sidebar and desktop rail are absent, and Vocabulary uses its page-level subject picker. |
| Wide | `>= 1121px` | The fixed desktop sidebar and identity/XP top bar frame an inset rounded content surface. Vocabulary's page picker is hidden, the sidebar subject picker is visible, and the student can collapse the sidebar to a 76px icon rail without moving its navigation icons. |

The paired canonical media queries are in the **Canonical responsive student shell ownership** section near the end of `css/student.css`. They intentionally follow the historical shell blocks so they can establish the final effective ownership without deleting the older styling.

JavaScript mirrors the same boundary through the exported `STUDENT_WIDE_SHELL_MEDIA_QUERY` constant in `js/studentShellMethods.js`. `js/studentListenerMethods.js` imports that constant, creates the one `matchMedia` listener used by the student shell, and asks `syncStudentShellState()` to update the existing `student-mobile-compact` class when the boundary changes. The class is a renderer hook; CSS remains responsible for layout and visibility.

## Ownership map

| Responsibility | Canonical owner |
| --- | --- |
| Sidebar | The `min-width: 1121px` canonical block fixes `.student-app-header` at 256px and exposes its sidebar content. The optional `student-sidebar-collapsed` state reduces it to a 76px icon rail and persists in local storage. The `max-width: 1120px` block converts the same header to the compact header and hides sidebar-only context. |
| Identity top bar | `.student-top-bar` owns the wide-shell student name, level title, XP meter, and XP metadata. Its left edge follows the shared sidebar-width variable during collapse. It is absent in compact shell. |
| Content scrolling | On wide screens, `main` is a fixed viewport-height rounded surface and the active direct `.view` owns vertical scrolling. Compact screens continue to use document scrolling. Scroll persistence follows whichever element owns scrolling. |
| Compact header | The `max-width: 1120px` canonical block owns sticky, full-width header geometry and compact actions. JavaScript only synchronizes the existing compact class at the same boundary. |
| Navigation | The canonical compact block exposes `.student-mobile-menu-toggle` and collapses `.student-tabs`; its wide counterpart hides the toggle and exposes the tab list. The 701px refinement changes how compact menu items look, not which navigation owns the shell. |
| Page subject picker | `#vocab-selection-view .vocab-header-subject-picker:not(:empty)` is exposed by the canonical compact block only when Vocabulary has picker content. The canonical wide block hides it. |
| Sidebar subject picker | It lives inside `.student-sidebar-context`. The canonical compact block hides that context; the canonical wide block exposes it with the rest of the sidebar. Subject selection, synchronization, rendering, and storage are outside responsive-shell ownership. |
| Framed content surface | Wide-shell `main` begins after the shared sidebar width plus a 12px frame gap, below the 68px top bar, and uses a 22px rounded surface. Compact shell resets `main` to the existing full-width content layout. |
| Arcade wide placement | Arcade uses the same framed content origin as every other wide-shell section, preventing a second rail offset and keeping collapse geometry consistent. |

## Breakpoint meanings

Only 1120/1121 changes shell state. The other boundaries remain because page and component presentation still changes there.

| Boundary | Meaning |
| --- | --- |
| `700px` | Last width of narrow compact refinements, including full-viewport shell width and narrower main padding. It is not the end of compact shell. |
| `701px` | First width of tablet-oriented compact navigation and Today refinements. Rules beginning here remain bounded within compact shell. |
| `900px` | Last width for several historical mobile/content refinements, including Vocabulary header arrangement and Today panels. It is not the end of compact shell. |
| `901px` | First width for historical desktop-era component and shell styling. Canonical compact rules still own effective shell geometry and visibility through 1120px. Some 901px rules continue to style content at tablet/compact widths. |
| `1120px` | Last compact-shell width. |
| `1121px` | First wide-shell width and the sole JavaScript shell-state media-query boundary. |

## Why historical shell rules remain

`css/student.css` is layered chronologically and contains earlier 901px desktop-shell attempts plus later corrective blocks. Some of those blocks also contain unrelated, still-active component presentation. Removing or merging them safely requires declaration-level dependency analysis and visual comparison across views. The accepted consolidation therefore preserves every historical block and lets the later canonical section own the final state.

A future cleanup may remove declarations proven redundant under both canonical states, or split component refinements away from superseded shell declarations. Such cleanup should be a separate milestone, preserve selector behavior, and pass the guardrail below before and after each change. Historical blocks must not be removed merely because their shell declarations appear overridden.

## Regression guardrail

Run:

```sh
npm run test:ui:student-shell
```

The guardrail loads `student.html` through the real application renderer, injects deterministic in-browser subject and vocabulary fixture data, and exercises Today, Vocabulary, the activity menu, the activity runner view, and Arcade at 1280, 1121, 1120, 1024, 901, 900, 768, 390, and 320px. It also performs a live 1120 -> 1121 -> 1120 resize sequence.

The assertions cover effective compact/wide ownership, sidebar and top-bar geometry, the rounded content frame, stable icon coordinates during collapse, normal and Arcade placement, navigation ownership, exactly one visible Vocabulary subject picker, control heights, zero document overflow, hidden controls rejecting programmatic focus, and hidden controls remaining outside sequential keyboard navigation. The Activity menu additionally verifies that all activity choices render and that its enabled narrow-width controls remain available to pointer and keyboard interaction.

This test is not authenticated validation. Its fixture uses the real renderer but bypasses authentication and injects local data at runtime; it does not replace a seeded Supabase smoke test when a compatible local stack is available. Setting `STUDENT_SHELL_TEST_BASE_URL` runs the same assertions against an already served source or production build. Setting `STUDENT_SHELL_SNAPSHOT_DIR` additionally writes diagnostic screenshots and a state manifest to the chosen directory.

## Architectural observations

The student shell has one shared JavaScript shell boundary: `STUDENT_WIDE_SHELL_MEDIA_QUERY`. The historical CSS queries at 700/701 and 900/901 remain independent presentation boundaries, but the later canonical max-1120/min-1121 pair determines effective shell ownership. Teacher layout and game-internal media queries are separate interfaces and are not student-shell state definitions.
