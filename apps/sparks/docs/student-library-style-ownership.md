# Library presentation styles

Units and Sparks acquire one retained shared stylesheet promise through
`studentLibraryStyleLoader.js`. The optional module loads formerly eager student
library rules and the existing shared library appearance sheet. The teacher HTML
keeps its original appearance link; teacher cards, rows and shared controls keep
their existing ownership and priority.

The Units wrapper waits for class readiness and styles before constructing its
browser. The class Sparks renderer captures its UI scope before waiting for
styles, and settles promptly when navigation cancels that wait. Existing class
loading can still establish the initial selection. Teacher Spark preview uses
this same renderer in its isolated document. The legacy demo renderer keeps
stylesheet errors inside its owned recovery path.

Shared styles load before specialized Spark styles. Each has its own retained
promise, including rejection: a failed shared import cannot falsely succeed
through the other consumer, while a specialized Spark failure leaves Units
usable. Early returning-session and reading-skeleton requests use the same
ordered loader; no raw specialized CSS import can seed a separate failed-cache
path. Synchronous skeleton HTML and its generic layout remain independent.

Header class pickers, shell, loading skeletons, primitives, Home foundations and
runtime-only overrides stay in their existing owners. Data reads, Arcade
eligibility, queue replay and unrelated routes do not acquire library styles.
Visible Units preparation and recovery own preload failures; stale hidden errors
do not disable ordinary safe update behavior elsewhere.

Verification:

- `node --test tests/student-library-styles.test.mjs tests/student-spark-style-ownership.test.mjs tests/student-units-lazy.test.mjs tests/student-app-updates.test.mjs`
- `node scripts/ui-student-library-styles-smoke.mjs`
- `UI_STUDENT_LIBRARY_STYLES_DIST=1 node scripts/ui-student-library-styles-smoke.mjs` after an official fresh build
- The immutable 182-snapshot reference plus independent historical warm Home/library comparisons

The source smoke covers cold routes, both renderer orders, cards/rows, held
styles/navigation, shared/specialized failures, first returning skeleton, teacher
Spark preview, and healthy/error demo paths. Compiled fault cases must exercise
actual Vite preload events and retain their document-reload assertions.
