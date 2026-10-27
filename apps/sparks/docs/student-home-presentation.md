# Home presentation ownership

`StudentActivityHome` retains data and required-work entry points. Its bounded
`preparePresentation()` waits for both the existing Home renderer and a retained
Home stylesheet promise before allowing UI work. A failed stylesheet stays
failed across retries; recovery remains explicit and Units remains reachable.

`studentHomePresentation.js` contains lexical recommendation, summary and week
helpers plus the Home Spark card/panel builders. The existing renderer imports
these directly. Unused presentation forwards were removed from StudentActivities
and the eager Home classes instead of introducing asynchronous public helpers.

Current-Spark fetching, response hydration, cached state, retries and gate
evaluation stay in the eager data owner and its existing data module. They do
not import Home presentation or CSS. Only the UI-host entry requests the renderer;
it preserves the accepted actor, session, school, class, subject, navigation,
render-generation and connected-host guards before rendering or removing UI.
Dependency failures reject distinctly from a valid empty Spark response.

`student-home.css` owns 104 formerly eager Home rule branches. Shared controls,
shell and loading skeleton rules remain eager. Another 74 order-sensitive base
branches stay eager (66 restored branches and eight already-shared branches), so
opening an activity before the first Home does not reverse their cascade.
Seventeen legacy mobile Home overrides
remain in `student-features.css`, their original activity-loaded owner: moving
them into cold Home changed its existing appearance. Their intentional visual
unification is separate from this behavior-preserving extraction.

Verification:

- `node --test tests/student-home-lazy-renderer.test.mjs tests/student-home-spark-scope.test.mjs`
- `node scripts/ui-student-home-presentation-smoke.mjs`
- `node scripts/ui-student-home-spark-scope-smoke.mjs`
- `node scripts/ui-student-presentation-parity-smoke.mjs compare /tmp/sparks-presentation-baseline-20261025 --source`

The presentation smoke supports `UI_STUDENT_HOME_PRESENTATION_DIST=1` after an
official fresh build. Its cold-route measurements block service workers and
describe app requests, while full offline background precaching stays unchanged.
The original anchored presentation reference must not be overwritten.
The maintained presentation smoke also checks both mobile stylesheet load orders;
the independent historical oracle compares all seven widths and normal, focused
and pressed controls using the original recorded styles.
