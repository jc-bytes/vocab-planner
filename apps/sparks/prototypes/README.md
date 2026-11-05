# Ember student guidance

The approved spotlight flow is integrated locally in the real student Flashcards screen. What’s next? sits in the shared top bar immediately left of Class. The sample preview at `/prototypes/ember-flashcards.html` remains available without authentication and does not save sample attempts.

## Behavior

- The first card introduces the word, meaning, and example, omitting the example step when absent.
- Later cards stay independent. The first incorrect answer offers Show a clue; the second opens it automatically once per card.
- Skip guide suppresses automatic instructional help. Manual help remains available and preserves that preference.
- Completion celebrates once and points to Back in the real student screen, or Start again in the sample preview.
- After two visible minutes without pointer, keyboard, input, or scroll activity, Ember offers Show me / Keep thinking without taking focus. It appears at most once per card, never during a spotlight or after completion. Hidden-tab time is excluded. Silent reading cannot be detected.
- Guide preferences are stored beside Flashcards state. Timestamped snapshots prevent an older cloud copy from overriding newer same-assignment local work. This does not claim cross-device conflict resolution.
- Leaving the activity removes its help button, timers, listeners, and popup.

## Local checks

Run from `apps/sparks` with Vite on port 8001:

- `node --test tests/flashcards-activity.test.mjs`
- `node scripts/ui-ember-student-smoke.mjs` tests the real student shell with a synthetic network boundary at four viewport sizes and checks answering, saved state, reopening, and cleanup.
- `node scripts/ui-ember-auth-smoke.mjs` uses the existing local audit fixtures for actual Supabase login, a published assignment, answering, save/exit/reload/reopen, phone help, and cleanup. Configure `SPARKS_TEST_SUPABASE_WORKDIR` and `SPARKS_TEST_DB_CONTAINER` together for an alternate local rehearsal stack.
- `node scripts/ui-ember-auto-help-smoke.mjs`, `node scripts/ui-ember-spotlight-smoke.mjs`, and `node scripts/ui-ember-whats-next-smoke.mjs` cover the sample prototype's triggers, virtual-clock timing, keyboard handling, and contextual help.

The earlier `ui-ember-flashcards-smoke.mjs` targets the retired inline prototype.

No deployment or physical-device acceptance is included. The local production build passes asset, lazy-boundary, and bundle-size checks; see the current measurements below.


## Other activities and screens

Shared guidance now covers Matching, Fill in the Blank, Quiz, Synonym/Antonym, Word Search, Crossword, Hangman, Scramble, Wordle, Speed Match, and Word Hunt, alongside Flashcards. It also covers Today, Units, the activity menu, Sparks library/readers, and the Arcade landing screen. Embedded Arcade games keep their own controls; Ember is suppressed while a game iframe is open. Speed Match suppresses guidance during live play.

Instructions resolve against visible controls and update when content changes. Closed Sparks offer review only. Guide preferences are scoped to the student and unit. Matching, Fill in the Blank, and Scramble offer help after a mistake and a guide after two mistakes. Other activities retain their own feedback. Help does not reveal an answer or change scores.

Additional local checks:

- `node scripts/ui-ember-all-activities-smoke.mjs`: all 12 activity walkthroughs at 1366, 390, and 320px; unchanged scores; Wordle keyboard isolation; generic two-minute idle offers and suppression of repeat offers; timed-round suppression.
- `node scripts/ui-ember-screens-smoke.mjs`: five main screens plus open, reading-only, and closed Spark readers at three widths; help-button placement left of Class; spotlight containment and route cleanup.
- `node scripts/ui-ember-behavior-smoke.mjs`: partial typed answer preservation, first/second mistake behavior, skip suppression, and cleanup in Fill in the Blank.

These broad checks use local fixtures. The authenticated check above uses local Supabase for Flashcards; it does not establish authenticated acceptance of every activity or embedded Arcade game.

Units guidance chooses the first visible in-progress unit, then the first unstarted unit in schedule order. Units with no required work and completed units are excluded. The activity menu points to an available unfinished required activity, prioritizing the existing next-activity marker. With no required work available, Ember offers review guidance instead. `node scripts/ui-ember-next-work-smoke.mjs` checks Cards and Rows, progress priority, exclusion and completion states, and required-activity progression using local fixtures.

Spotlight positioning follows the target while the guide is open, including layout transitions and late-loading content. `node scripts/ui-ember-alignment-smoke.mjs` checks the word, meaning, and example at three widths and a target that moves after opening. The all-activities smoke also checks highlight alignment, in addition to popup containment.

## Bundle readiness (local, 2026-10-17)

The size gate now passes without changing its limits. The validated production snapshot measures student startup at 209.0 KiB gzip (210 KiB limit), teacher startup at 178.4 KiB (180 KiB limit), and total deployment files at 14.4 MB (30 MB limit). Headroom is still small; the size gate must remain enabled.

Production uses Terser, loads activity construction and the CSV parser on demand, opens the IndexedDB helper on first storage access, and defers Spark-library methods. Explicit shared preload and storage-policy chunks keep lazy features from leaking into the teacher startup graph. Ember smoke scripts accept `EMBER_BASE_URL` to test the built artifact, not only the Vite source server. This is local build evidence, not a deployment record.
