# Student presentation reference

This control protects presentation while a view's JavaScript and styles move to an owned lazy feature. It uses the real application and teacher preview with synthetic network fixtures. It never uses the default authenticated audit accounts or database.

Capture before changing styles:

```sh
node scripts/ui-student-presentation-parity-smoke.mjs capture /tmp/sparks-presentation-baseline-20261025
node scripts/ui-student-presentation-parity-smoke.mjs verify-reference /tmp/sparks-presentation-baseline-20261025
node scripts/ui-student-presentation-parity-smoke.mjs capture-source /tmp/sparks-presentation-baseline-20261025
```

The capture copies the existing production output. To preserve a particular previously copied build, capture accepts an explicit `--historical-artifact /tmp/reference/artifact` source; that source must still match its own official output stamp. This option is unavailable in normal candidate comparison. Both original and copied files must match the output hashes in that build's official `.vite/artifact-identity.json`; the stamp itself is excluded from its own output map. A separate reference identity hashes every copied file, including that stamp. Original input and public configuration digests are recorded as hashes only. This is a historical build, explicitly independent of current-source freshness. Modified originals and modified reference copies fail closed. Existing captures and source baselines cannot be overwritten accidentally.

Compare a later candidate:

```sh
node scripts/ui-student-presentation-parity-smoke.mjs compare /tmp/sparks-presentation-baseline-20261025 --source
node scripts/ui-student-presentation-parity-smoke.mjs compare /tmp/sparks-presentation-baseline-20261025
```

The normal built comparison uses the existing owned-preview helper, including its current input/configuration/output freshness checks. It cannot serve a stale candidate. Historical serving is restricted to the separately verified reference. Source and built modes have separate golden snapshots; cross-mode differences are recorded rather than silently treated as equality.

The fixture exercises Home with current-week cards and blocked-work notice, Units and Sparks cards/rows, the expanded unit menu, export-open states, Arcade, Flashcards, and the actual teacher iframe menu/activity inside the real teacher shell, using the existing synthetic teacher authentication/repository fixture and actual library owner. The built teacher preview explicitly loads its manifest CSS dependency graph before native import, reproducing Vite's normal preload edge. Every iframe stylesheet and font must settle before measurement.

The matrix is 320/390/430/760/761/768/1280 pixels, at 480-pixel mobile/boundary height or 900-pixel desktop height, with OS dark/light color-scheme preferences. The main app currently uses its fixed semantic palette; these preferences do not imply a separate application theme switch. Reduced motion removes animation timing noise. Snapshots retain text, element/text bounds, computed layout/typography/colors, horizontal clipping flags and visible-center hit metadata. Screenshots show the iframe itself for previews. Differences fail the comparison; quarter-pixel geometry is compared with a 0.75-pixel tolerance.

Cold route results retain actual requested JavaScript/CSS paths, counts and gzip-level-9 emitted byte totals. A separate delta report exposes changes for review; future feature-specific demand assertions belong alongside the actual new manifest entries. Service workers are blocked in these measurements. Complete offline graph precaching remains unchanged and is not part of the claimed cold application savings.

The existing 320-pixel teacher preview clips card/text horizontally once its real stylesheet is loaded: the historical built iframe is approximately 206 pixels wide and a card ends at 253 pixels; the source iframe is approximately 238 pixels wide and the card ends at 252 pixels. Text lines also extend beyond the iframe. This baseline defect is recorded explicitly, not reported as a passing accessibility check. Its layout repair is separate from the proposed extraction.
