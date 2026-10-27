# Student Units loading

Authentication starts shared class preparation without rendering the Units view.
Home and Arcade can await that same class request; an empty successful class list
is ready data, while failures and unfinished requests cannot authorize Arcade.
The data preparation deadline cancels only its captured pending class read.
A later ignored transport result cannot replace a newer selection.

`StudentActivityVocabularyData.prepareClassData` returns a ready-data lease.
It captures the account/session, selected class and school; callers must check it
after asynchronous work. Deep-link lookup reads this data directly, including
own-grade archived material, without loading Units. Cancellation returns a
separate result from a successfully read missing unit.

`lazyStudentUnits.renderStudentUnits` is the single presentation entry. It clears
previous private cards before awaiting data, captures navigation identity, and
loads Browser/Cards/Navigation only on the Units route. The prepared lease is
passed to Browser so cache expiry during import cannot trigger a duplicate read.
Row/card switches and visible progress refreshes return through this same entry.
Shared labels and vocabulary preloading do not depend on a Browser instance.

The durable queue, result processor, active-attempt runtime, Menu and Word Hunt
retain their existing owners in this change.

Verification:

- `node --test tests/student-units-lazy.test.mjs` covers held imports, owner/session/
  class/navigation changes, same-read timeout/retry, privacy, cache expiry and
  headless current/archived routes.
- `npm run test:ui:student-units-lazy` checks actual cold module requests and hidden
  DOM paints with synthetic network responses and the real application.
- `UI_STUDENT_UNITS_DIST=1 npm run test:ui:student-units-lazy` repeats against the
  emitted production graph with service workers blocked and fresh contexts.
  This measures application demand loading; the service worker still intentionally
  precaches the complete offline graph in the background.

The production size gate remains unchanged. A passing student graph does not
imply the teacher graph or combined release has passed.
