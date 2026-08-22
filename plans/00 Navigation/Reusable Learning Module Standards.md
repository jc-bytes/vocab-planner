# Reusable Learning Module Standards

## Purpose

A reusable learning module is a web-based pathway for a coherent topic that multiple classes or grades can use. It breaks learning into short sections with explanation, examples, guided practice, independent practice, checkpoints, application, review, and evidence.

Modules live in the central Technology Learning Hub. Grade planning folders reference them; they do not contain duplicate website copies.

## Relationship to Planning

```text
Curriculum plan -> selects module outcomes and sections
Learning module -> delivers reusable student learning
Lesson package -> defines the class-specific use, timing, discussion, submission, and fallback
```

A module may replace several student-facing artifacts. It does not replace the class-specific teacher guide, assigned section range, timing, submission instructions, formal scoring tool, or technology-failure plan.

## Required Module Identity

Every module must declare:

- Stable module ID: `MOD-{DOMAIN}-{TOPIC}-{NN}`
- Title and URL slug
- Semantic version
- Status
- Recommended grades and tracks
- Prerequisites and vocabulary
- Learning objectives
- Expected evidence
- Estimated total and section time
- Stable section IDs
- Source location and published URL
- Owner and last-reviewed date
- Accessibility and technology requirements
- Offline/failure path

## Statuses

- **Prototype:** Initial concept or build.
- **Draft:** Content or functionality is incomplete.
- **Pilot:** May be used with monitoring and a complete fallback.
- **Ready:** Fully verified and approved for planning use.
- **Needs Revision:** Known problems prevent normal use.
- **Deprecated:** Do not assign; retained for transition or history.
- **Legacy Prototype:** Existing site awaiting migration and full audit.

Only **Ready** modules count as prepared resources. A **Pilot** module requires an explicit fallback.

## Planning Reference

Use all of the following:

```text
Module: MOD-PY-DATA-01
Version: 1.2.0
Sections: S1-S3
Track: Core
Evidence: Downloaded Python data-practice report
```

Do not write only `Python website`, `data module`, or a whole-site URL.

## Standard Learning Path

1. **Start:** Objective, prerequisites, vocabulary, time, tools, and evidence.
2. **Learn:** Short explanations divided into manageable concepts.
3. **Inspect:** Worked example, demonstration, annotated code, or model.
4. **Guided Practice:** Supported task with prompts and feedback.
5. **Independent Practice:** Similar task with reduced support.
6. **Checkpoint:** Short formative check.
7. **Apply:** Authentic mini-task or transfer activity.
8. **Review:** Summary, vocabulary, common mistakes, and additional practice.
9. **Evidence:** Download, code file, screenshot, report, or explicit response record.
10. **Next:** Following module, extension, or remediation.

Sections should normally require approximately 10-25 minutes. Each section should have one main purpose and show its expected time and completion evidence.

## Reuse Across Grades

Use tracks instead of copying entire modules:

- **Foundation:** Recognition, tracing, matching, guided construction, or one-step scenarios.
- **Core:** Independent creation, debugging, analysis, or explanation.
- **Extension:** Transfer, optimization, nested reasoning, open data, or additional constraints.

The catalog must state which grades may use each track.

## Progress and Evidence

- State whether progress is saved only in the current browser/device.
- Namespace saved progress by module ID, version, section, and learner/group scope where available.
- Provide a visible reset control with confirmation.
- Do not claim cross-device progress unless it is implemented and tested.
- Evidence must contain actual student work or responses, not only time-on-page or a completion click.
- Reopen and verify every downloaded evidence file.

## Assessment Separation

Modules may include formative practice and feedback. Formal grades still require exact directions, checklist, scoring tool, practice, review, and make-up evidence.

Keep assessment answers, teacher scoring notes, private datasets, and unpublished variants outside the public build. Hidden routes and unusual filenames are not security.

## Accessibility and Reliability

Verify keyboard access, visible focus, semantic headings and labels, color contrast, readable responsive layouts, text alternatives, captions where needed, helpful validation errors, and reduced-motion support.

Test navigation, deep links, reload, progress, reset, feedback, downloads, printing, empty/partial/complete states, narrow and wide layouts, browser errors, and failure paths.

## Ready Module Checklist

- Catalog and manifest metadata are complete.
- All section IDs and routes are stable.
- Prerequisites and time estimates are accurate.
- Explanations, examples, practice, checkpoints, and evidence align.
- Formative feedback is meaningful.
- Required downloads open and contain correct evidence.
- Progress and reset behave as documented.
- Keyboard, responsive, accessibility, and browser tests pass.
- Public output contains no teacher-only information.
- Offline or lesson-package fallback exists.
- Pilot findings were resolved.
- Version, owner, and review date were updated.

