# Technology Learning Modules

This directory is the central home for reusable web-based Technology learning modules. Modules are designed once, divided into stable sections, and referenced by multiple curriculum plans and lesson packages.

## Responsibility Layers

```text
Curriculum plan -> chooses outcomes and module sections
Learning module -> provides reusable student instruction and practice
Lesson package -> adapts the module to one group, schedule, and submission path
```

Do not copy a complete module into grade planning folders. Plans should reference the module ID, version, sections, track, and published URL recorded in `module-catalog.json`.

## Intended Source Structure

```text
learning-modules/
  README.md
  module-catalog.json
  technology-learning-hub/
    shared/
    modules/
      {module-slug}/
        module.json
        content/
        activities/
        assets/
        tests/
    teacher-materials/
```

The shared Technology Learning Hub is implemented in `technology-learning-hub/`. New modules should use stable routes inside that project and remain marked `prototype` until content, interaction, accessibility, evidence, offline, and classroom-pilot checks pass.

## Status Rules

- `prototype`: concept or early build; not ready for planning references
- `draft`: content/build in progress; not ready for normal classes
- `pilot`: may be used in a monitored class with a verified fallback
- `ready`: fully verified and may satisfy lesson-package artifacts
- `needs-revision`: known problems prevent normal use
- `deprecated`: retained for history or transition; do not assign
- `legacy-prototype`: existing activity registered for migration but not yet audited against the module standard

Only `ready` modules count as prepared resources. A `pilot` module requires an explicit lesson-package fallback.

## Planning Reference Format

```text
MOD-PY-DATA-01 v1.2.0, Sections S1-S3, Core track
```

Do not reference only `Python website`, `data module`, or a page title.

## Teacher Material Safety

Teacher answer keys, scoring notes, private datasets, assessment variants, and student information must remain outside the public build. Hidden pages, unusual filenames, CSS hiding, or client-side variables are not security controls.

## Current Catalog

See [module-catalog.json](module-catalog.json). The existing Data Detectives site is preserved under `legacy/data-detectives/` and registered as a legacy prototype. It has not been migrated into the shared hub, published through the hub, or marked ready.
