# T3 weekly vocabulary source

The approved calendar and glossary replace the former two-word class sets from Week 2. Week 1 files are frozen. Project Weeks 5 and 6 have no vocabulary assignments. Assessment and review weeks have no new completion requirements. Grade 6 group exceptions are explicit in each pool's releaseDates and sections.

`weekly-units.json` contains 33 authored pools. `calendar.json` includes the excluded project and closure weeks. `replacement-map.json` retains links from 83 archived class sets. Existing progress is never copied into a new five-word pool. `spark-patches.json` aligns the separate optional readings and archives project/closure/group-specific readings that the older grade-only Spark scheduler cannot target safely.

Regenerate the static catalog with `python3 tools/planning/weekly_vocab_2026/build_catalog.py --app /path/to/release/apps/sparks`. Generate the transactional database migration with `python3 tools/planning/weekly_vocab_2026/build_migration.py --app /path/to/release/apps/sparks`. The scripts need the approved proposal at `reports/t3-vocabulary-review-2026-09-16/weekly-pool-proposal.json`. Review calendar changes before regenerating; do not rerun the historical t3_vocab_sync scripts.

Normal teaching pools require Flashcards, Matching and Fill in Blank once across the week. Optional activities are available afterward. New multiword activities need at least four eligible words; unavailable activities are hidden. The five-word target is a classroom trial, not a measured timing guarantee. Introduce up to three terms in the first teaching opportunity and the remainder in the next; reuse known terms during short weeks.

The app and SQL changes do not alter formal assessment products or scores. The separate grade guides under each `3rd Trimester/Weekly vocabulary.md` contain meanings, examples, dates and direct unit links.
