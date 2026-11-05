# Vocabulary grading audit and implementation

## Findings

The audited local Sparks implementation had required/additional/hidden activity
settings, verified assignment activity progress, accuracy, coins, and reading
feedback. It had no academic gradebook, opt-in vocabulary grading policy, or
published vocabulary grade records. Activity progress scores measure completion;
they must not be relabelled as accuracy or academic grades.

The existing publisher snapshots `activitySettings` into
`private.class_material_versions.student_content`. That supports a grading default
in the vocabulary draft while preserving previously assigned copies. Assignment
overrides allow teachers to grade existing copies without rewriting their content.

MiClase was inspected read-only. Its gradebook has sticky student rows, assessment
columns, clickable details, provisional averages, and a mobile student selector.
Its student view exposes published marks only. Relevant source files are
`/Users/pjriosc/Documents/miclase/components/nexo/gradebook/gradebook-grid.tsx`,
`student-grades.tsx`, `grade-cell.tsx`, and
`/Users/pjriosc/Documents/miclase/lib/grades/calculation.ts`.

MiClase's institutional scale is 1.0–5.0, but its `maxPoints` field is a reference,
not a points-to-grade conversion. Sparks therefore displays earned points and
percentages. No new institutional conversion, passing threshold, or category
weighting is assumed.

## Implemented grading policy

Grading is off by default, including for legacy vocabularies. Teachers can enable
it for future assigned copies in the vocabulary editor or for an existing assigned
copy in Students → Grades. Draft defaults are stored as:

```json
{
  "enabled": false,
  "maxPoints": 100,
  "bonusPerActivity": 0,
  "bonusCap": null,
  "capAtMaxPoints": false
}
```

Each distinct required activity receives an equal share of the base points. Only
verified completion counts: `verified = true` and either `is_complete = true` or
completion score at least 100. The total base award is rounded to two decimals.
Accuracy remains a separate measurement.

Only distinct, explicitly additional activities can earn bonus points. Replays,
hidden activities, unverified results, and unrelated assignments add no points.
An optional bonus limit and a separate final-score cap are supported. With no
final-score cap, extra credit can exceed the base maximum and 100%. The awarded
bonus satisfies `basePoints + bonusPoints = earnedPoints`; activity details state
that individual activity points are shown before limits.

Missing, unsupported, or unplayable required activities make the grade unavailable,
not zero or complete. Publishing rejects these recipes. Incomplete measurable
required work earns partial base points by completed activity count. The calculated
grade remains provisional until explicitly published. Ungraded and unavailable
results are excluded from weighted totals; coverage remains visible.

## Grade displays and publication

Students → Grades uses the selected class and the same school-timezone trimester
or custom assigned-date filters as progress. Desktop rows show students against
vocabulary columns and a provisional total weighted by base points. Phones select
a student and show a vertical list. Headers open assignment grading settings;
cells open required/bonus breakdowns and the last published grade. Student names
open the existing work detail view, retaining the period and return filters.

Live calculations and published grades are separate. Publish records immutable
per-student snapshots. Later attempts or changed settings do not update issued
grades until another explicit publication. Disabling a published vocabulary is
also a draft change; Publish ungraded status removes it from the student-visible
latest publication. Old publication history remains stored.

Assigned student units read their own published grade from the server. They show
points, percentage, required/bonus detail, and publication date. Unpublished and
failed reads have distinct messages and retry controls. Local or unsynced activity
results never create a student-visible grade.

## Data access and migration

Migration `20261104045454_vocabulary_grading_and_gradebook.sql` adds private
assignment grading overrides, append-only publication records, grade snapshots,
validation, and class-scoped grade reads. Public RPCs are security-invoker wrappers
around private implementations. Direct client table access is revoked and RLS is
enabled. Teacher authority is checked in the database, writes verify the initiating
account and expected revision, and class locks serialize conflicting writes.
Student reads derive the user from authentication and require active membership.

Existing vocabulary JSON is preserved. Numeric config fields are validated at
save time. Required playability mirrors the student activity registry, including
weekly minimum round sizes. Published version content supplies the denominator;
editing Library cannot change previously assigned grading or published snapshots.

The hosted database has not been changed. Apply the grading migration and the
preceding class-progress migration before releasing the matching frontend. The
deployment readiness check requires exact anonymous execution denials for
`teacher_class_progress_v1`, `teacher_class_gradebook_v1`, and
`my_class_vocabulary_grades_v1`, alongside the grading writes and existing owned
operations. It uses browser credentials and harmless arguments; it changes no
schema or grades.

## Verification

`npm run test:vocabulary-grading` covers policy arithmetic, repository scoping,
route preservation, teacher gradebook interactions, editor validation, and student
published-grade states. The new browser scripts are registered in normal checks.

`npm run test:student-insight:database` creates a schema-only disposable clone,
installs missing migrations, and runs grading alongside existing insight, review,
and class-progress database checks. Grading coverage includes actual authenticated
library saves and publication snapshots, bonus caps, invalid/unplayable work,
student isolation, cross-class authority, stale accounts, concurrent publication,
and immutable issued grades. The rehearsal also checks database function lint and
a 30-student × 12-vocabulary fixture. It removes its disposable database afterward.

Local checks and production build results are reported separately from deployment
and real classroom acceptance. No real student grades were published by this work.
