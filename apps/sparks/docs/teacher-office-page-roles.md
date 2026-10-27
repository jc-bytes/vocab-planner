# Teacher office page roles

Date: 27 October 2026. These roles govern the UX audit and future changes. A role definition is not evidence that every part of the page already works.

## Shared rules

- Students and Classwork are separate sidebar destinations. Switching pages keeps the selected class. Changing the class updates the open page.
- Give each task one owning page. Shortcuts open that workflow with its class, material, assignment, or student already selected.
- Preserve a teacher's search, filters, and page when returning while navigating in the open app. Keep each class's state separate and clear it on account or school change.
- Use real saved records. Missing data and failed requests must not look like zero progress or completed work.
- Explain whether an action changes one assignment, one class, the whole school, or the platform before saving.
- Keep primary actions visible; put less common filters and administrative actions behind a clear disclosure or menu. Support keyboard use, narrow screens, useful empty states, and retryable errors.

## Sidebar pages

| Page | Teacher's question | Owns | Useful starting view | Completion check |
| --- | --- | --- | --- | --- |
| Home | Where do I start? | Choosing a class and returning to its work. | Searchable active class directory. | Open the intended class without rebuilding its setup. No invented attention counts. |
| Classwork | What can this class do now, and what comes next? | Published assignments, availability, saved student preview, and entry to assignment results. | Current work; Upcoming ordered nearest first; History for closed/withdrawn work. | Locate an activity, inspect the published copy, and open its results; return without losing place. |
| Students | Who is in this class, and how is each student doing? | Class roster, invitations, grouping, and entry to each student's learning record. | Searchable roster with a direct progress action. | Open the right student's record and return to the same roster. Enrollment actions clearly state their effect. |
| Library | What material can I prepare or reuse? | Vocabulary and Spark material, search, organization, authoring, preview, reuse, and assignment shortcuts. | Reusable materials organized by teaching context. | Preview or edit the intended material; assign it to the selected class. Explain that published copies do not change with later Library edits. |
| Review | Which student work needs my attention? | Review queue, assignment results, feedback, and scoped exports. | Needs review. | Open the work, save feedback, see the saved result, and return to the queue. Assignment management remains reachable through Classwork. |
| Settings | Which learning rules apply across this school? | Existing school-wide subject and reward configuration. This is currently an administrator page, not personal preferences. | Clearly labelled school-wide learning settings. | Know the affected school and save the intended setting with visible confirmation. Personal preferences should be added only when real controls exist. |
| School settings | Who has school access, and how is the school organized? | School membership, invitations, student account administration, academic years/calendar, and audit history. | School administration with a clear selected school and section. | Complete one bounded administrative task, with role restrictions and clear scope. |
| Platform | Which schools and platform administrators may use the system? | School onboarding/status and platform administrator access. | School registry and platform administrator directory. | Identify the exact school/account affected and understand the effect before changing access. |

School settings owns the calendar. Settings links to its existing Academic years editor, and old Settings calendar URLs open that editor. Do not replace school configuration with empty personal-preference controls.

## Supporting pages and workflows

| Page or workflow | Its job and boundary |
| --- | --- |
| Vocabulary browser | Find reusable word sets. Student result checking belongs in Review or the student record. |
| Spark browser | Find reusable readings and checks. Assignment release dates belong in Classwork. |
| Vocabulary/Spark editor | Edit a reusable material and its activity rules. Clearly identify save state; keep publication separate. |
| Quiz tools/editor | Prepare a quiz or export. Do not imply an exported quiz is an online assignment unless publication supports it. |
| Student preview | Let the teacher inspect or try student content without creating student submissions or changing learning results. Classwork preview must use its published copy. |
| Assignment publisher | Choose saved material, target classes, and availability. Explain the saved-copy behavior and timezone. Retry must not duplicate publication. |
| Assignment details | Inspect one assignment's dates, status, and published content; withdraw it through the existing confirmation. |
| Assignment student work | Inspect actual results/responses, give feedback, and export the selected scope. Return to its originating list. |
| Student overview | Summarize the selected student's work in the selected class and make the next useful check clear. |
| Student assigned work | Inspect that student's assignments, responses, and feedback in class context. |
| Student activity | Inspect recorded activity evidence and its limits. Missing records do not become zero scores. |
| Student account | Handle permitted account/reward actions with their scope clear. Keep this separate from learning evidence. |
| Groups | Build groups from the selected class's current enrollment using existing pairing restrictions. Return to Students. |
| School membership/invitations | Manage school access and roles. Class enrollment is a different action. |
| School student accounts | Provision and administer permitted accounts; keep school and class scope explicit. |
| Academic years/calendar | Define school years and trimester dates used by availability and reporting. |
| School audit history | Inspect recorded administrative changes without implying that incomplete history proves no change occurred. |
| Platform school onboarding | Create a school and invite its first administrator through the existing supported flow. |
| Sign-in/session restoration | Restore only verified authorized navigation. Pending, expired, offline, and signed-out states must be distinguishable. |

## Audit order and evidence

Audit and repair one page before starting the next: Classwork, Students, Home, Library, Review, Settings, School settings, Platform. Include supporting workflows in their owning page's audit. Record concrete findings, repairs, checks, and any remaining limitation in `teacher-office-ux-audit-2026-10-27.md`.

Check purpose, information, common actions, continuity, loading/empty/error/save states, desktop/mobile layout, keyboard access, and scope. Use browser workflows and real application rendering with isolated fictional fixtures for repeatable verification. Keep live-school acceptance separate from fixture results.
