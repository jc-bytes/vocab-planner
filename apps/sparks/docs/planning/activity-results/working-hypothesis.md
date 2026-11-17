# Sparks learning results: planning context

Author: pjrios  
Initial discussion: 2026-11-14  
Consolidated: 2026-11-15  
Status: Historical hypothesis, superseded by the [authoritative concepts brief](concepts_brief.md). This is not implementation approval.

## Original direction

Give automatically scored learning activities one understandable results experience. Show performance, passing status, stars, personal best, and a shared leaderboard while keeping review and full retries available. Teachers need adjustable passing targets, including individual overrides, without giving identical performance different competitive scores.

The [local audit](audit.md) found that existing scores often describe eventual completion rather than first-answer performance. The planning discussion therefore defined credit separately for question games, repeated-word games, spelling puzzles, search puzzles, and automatic reading questions. Written responses remain teacher-reviewed work.

## Decision authority after consolidation

All approved rules now live in [concepts_brief.md](concepts_brief.md), organized by topic instead of repeated chronological confirmations. The user approved decisions one at a time. Those approvals authorize this planning record, not app implementation, database changes, deployment, or changes to school grades or existing XP/coin schedules.

The brief covers:

- Exact weighted percentage, 950 accuracy plus 50 speed points, floor-once rounding, and five-star milestones.
- Whole-number completion targets from 1% to 100%, the 80% default, individual/class precedence, and the separate shared 80% speed gate.
- Full retries, frozen original scores, required corrections, two-failure help flags, and clearing on passing.
- Per-activity credit, five scheduled appearances per word by default in Matching and Speed Match with shared teacher adjustment, and normalized letter-position partial credit in Crossword and Fill in Blank.
- Reading scores from multiple-choice only, whole-check finalization, and preserved writing on full automatic retries.
- Scored-time exclusions, pause-and-hide, shared targets, and saved attempt settings.
- Visual-only combos across vocabulary and reading multiple choice, milestones, longest streak, and resume behavior.
- Same-school grade/activity/content/task boards, best full attempt even below personal target, ties and display order, top five ranks plus own entry, version changes, and validated offline admission.

Recommendations and remaining gaps are explicitly labeled in the brief. They are not additional approvals.

## Superseded proposals

| Earlier idea | Approved replacement |
| --- | --- |
| Illustrative completion bonuses or a 90/10 allocation | Maximum 950 accuracy and 50 speed points. |
| Gate speed points by each student's passing target | Shared eligibility at 80% weighted credit, independent of passing target. |
| Give zero for any misspelling | Letter-position partial credit for Crossword and Fill in Blank, with approved normalization and the longer-length denominator. |
| Score only a word's first appearance in repeated-word games | First pairing/selection per scheduled appearance, averaged per word and then equally across words. |
| Three scheduled appearances per word | Five by default, with teacher adjustment shared by a comparable board. |
| End Speed Match after three lost lives | Finish the scheduled set. |
| Latest or cumulative leaderboard totals | One best eligible full-attempt entry per student per board version. |
| Extra combo points | Visual celebrations with no scoring effect. |

## Review and evidence limits

The user chose a single-agent review without subagents. The earlier failed review delegation does not establish a completed independent Goldfish review. No independent Goldfish review is claimed by this consolidation.

The original focused local check reported 63 passing existing tests. The later expanded run, including reading checks, reported 70. These are historical checks of the inspected working copy, not acceptance tests of the new feature. The audit retains commands, limits, and source anchors. This consolidation adds no runtime or hosted verification.

## Historical handoff to detailed design

The product decisions for the five identified gap areas are now approved in the brief. Reading checks use separate reading, multiple-choice, and writing sections; only active multiple-choice time contributes to speed points, with questions hidden and the timer paused when switching away. Answers remain editable until whole-check submission.

Proceed to detailed design of the attempt, scoring, timing, settings, and finalization contracts using the authoritative brief. Remaining engineering work includes saved-task preparation, timing events, answer validation, persistence, access controls, historical eligibility, compatibility, and verification. These are not implementation or deployment approvals. If detailed design reveals another product tradeoff, return to one decision at a time.

## Final design handoff

The [technical design](activity-results.md) was finalized on 2026-11-15 after all drafting sections were approved. It contains the architecture, alternatives, complete implementation file manifest and verification gates. Use it together with the authoritative brief for future implementation. The earlier design handoff above is historical. No application implementation, migration execution, deployment or independent Goldfish review is established by this finalization.
