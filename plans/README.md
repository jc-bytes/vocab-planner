# Technology Planning Workspace

The planning vault uses one consistent structure for every grade. Keep official plans, working drafts, classroom materials, and assessments separate so a teacher can find the correct source quickly.

```text
plans/
  00 Navigation/
  6th Grade Technology/
  7th Grade Technology/
  8th Grade Technology/
  9th Grade Technology/
  Shared/
  Administration/
  Inbox/
```

## Grade folders

Each grade follows this contract:

```text
{grade} Grade Technology/
  Planning/
    Annual/
    Monthly/
      1st Trimester/
      2nd Trimester/
      3rd Trimester/
    Drafts/
      1st Trimester/
      2nd Trimester/
      3rd Trimester/
    Reviews/
  Materials/
    Class Notes/
    Study and Review/
    Review Games/
    Lesson Packages/        # created when complete class packages are built
  Assessments/
    Rubrics/
    Project Drafts/         # when applicable
```

- `Planning/Annual` contains the curriculum spine.
- `Planning/Monthly` contains official school-facing DOCX plans.
- `Planning/Drafts` contains editable Markdown or working monthly plans.
- `Planning/Reviews` contains audits, feasibility checks, curriculum breakdowns, and assessment maps.
- `Materials` contains resources used to teach or review—not planning documents.
- `Assessments` contains scoring tools and assessment-specific work.

## Shared and operational folders

- `00 Navigation/` contains the Obsidian dashboard, indexes, schedules, and generated navigation pages.
- `Shared/Templates/` contains canonical templates used across grades.
- `Shared/Generated Outputs/` contains mirrored batches produced by generators; the authoritative grade copy must still exist in the appropriate grade folder.
- `Administration/` contains attendance and student records. Treat it as private teacher material.
- `Inbox/` contains unsorted notes and proposals. Files in the inbox do not count as prepared lesson materials until they are reviewed and moved.

Do not recreate the former `Assestments`, grade-prefixed monthly-planning, `Class Notes (Generated)`, `gimkit and blooket`, or inconsistent draft-folder names.
