#!/usr/bin/env python3
"""Apply the approved Grade 6-9 T3 readiness policy to specs and directions."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

TITLE = "Punctuality, responsibility, and readiness"
DESCRIPTION_40 = "4/40: charged computer and login; on-time start; responsible use; deadline. School-controlled failures use the fallback without deduction."
LEVELS_40 = [
    [4, "Device and login ready; on time; responsible use; deadline met."],
    [3, "One issue corrected after one reminder; work remains checkable."],
    [2, "Device or login missing, late or unprepared, or repeated reminders; some fallback work."],
    [0, "No device or login and no fallback, no checkable work, or responsible-use rules refused."],
]

DESCRIPTION_90 = "9 of 90 points: checkpoint readiness, punctual starts, responsible file and material care, milestones, and final handoff. Documented school-controlled failures use the fallback without deduction."
LEVELS_90 = [
    [9, "Device, login, and materials are ready at every checkpoint; starts and milestones are on time; files are organized; final evidence is submitted."],
    [7, "One readiness, punctuality, or milestone issue is corrected after one reminder; final evidence remains checkable."],
    [4, "Readiness or milestone issues repeat, or one session lacks the device or login; some fallback project work is completed."],
    [0, "Readiness is not shown across checkpoints and the approved fallback or final evidence is not completed."],
]

STUDENT_40 = """## Responsibility points: 4 of 40

Bring your assigned charged computer, have your school login ready, begin on time, use files and materials responsibly, and submit or return the required work by the announced deadline. If you forget the computer or login, arrive late or unprepared, or need repeated responsibility reminders, points may be deducted only from these 4 points. Academic criteria are scored from the work itself.

A documented school network, platform, teacher-provided account, or hardware failure outside your control does not reduce these points when you follow the assigned fallback.
"""

STUDENT_90 = """## Responsibility points: 9 of 90

At every announced project checkpoint, bring your assigned charged computer, required materials, and school login; begin on time; keep files and materials organized; meet the announced milestones; and submit the final evidence by the deadline. If you forget the computer or login, arrive late or unprepared, or miss responsibility checkpoints, points may be deducted only from these 9 points. Academic project criteria are scored from the project evidence itself.

A documented school network, platform, teacher-provided account, or hardware failure outside your control does not reduce these points when you follow the assigned fallback.
"""

START = "<!-- RESPONSIBILITY-POLICY-START -->"
END = "<!-- RESPONSIBILITY-POLICY-END -->"


def update_grade6_spec() -> None:
    path = ROOT / "plans/6th Grade Technology/Materials/Lesson Packages/T3 2026/Teacher Materials/Grade 6 T3 Scoring Specification.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for rubric in data["rubrics"]:
        rubric["criteria"][-1] = {
            "name": TITLE,
            "description": DESCRIPTION_40,
            "levels": LEVELS_40,
        }
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def update_grade7_spec() -> None:
    path = ROOT / "plans/7th Grade Technology/Materials/Lesson Packages/T3 2026/Teacher Materials/grade7-assessment-spec.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for item in data:
        if item["kind"] == "exam":
            maxima = [14, 14, 14, 13, 13, 13]
            for criterion, maximum in zip(item["criteria"], maxima):
                criterion[1] = maximum
            responsibility = [TITLE, 9, [level[1] for level in LEVELS_90]]
            if item["criteria"][-1][0] == TITLE:
                item["criteria"][-1] = responsibility
            else:
                item["criteria"].append(responsibility)
        else:
            item["criteria"][-1] = [TITLE, 4, [level[1] for level in LEVELS_40]]
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def inject(path: Path, block: str) -> None:
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "A device, login, or internet failure does not change the content or lower the score by itself.",
        "A documented school network, platform, teacher-provided account, or hardware failure outside your control does not change the content or lower the score when you follow the assigned fallback. A forgotten personal device or unprepared login may lower only the responsibility points.",
    )
    text = text.replace(
        "External device or login failure never lowers the score.",
        "A documented school network, platform, teacher-provided account, or hardware failure outside your control does not lower the score when you follow the assigned fallback. A forgotten personal device or unprepared login may lower only the responsibility points.",
    )
    text = text.replace(
        "External device, hardware, or login failure never lowers the score.",
        "A documented school network, platform, teacher-provided account, or hardware failure outside your control does not lower the score when you follow the assigned fallback. A forgotten personal device or unprepared login may lower only the responsibility points.",
    )
    payload = f"{START}\n{block.strip()}\n{END}"
    if START in text and END in text:
        before = text.split(START, 1)[0].rstrip()
        after = text.split(END, 1)[1].lstrip()
        text = before + "\n\n" + payload + ("\n\n" + after if after else "\n")
    else:
        text = text.rstrip() + "\n\n" + payload + "\n"
    path.write_text(text, encoding="utf-8")


def update_directions() -> None:
    folders = [
        ROOT / "plans/6th Grade Technology/Materials/Lesson Packages/T3 2026/Assessment Directions",
        ROOT / "plans/7th Grade Technology/Materials/Lesson Packages/T3 2026/Assessment Directions",
        ROOT / "plans/8th Grade Technology/Materials/Lesson Packages/T3 2026/Daily Grades",
        ROOT / "plans/9th Grade Technology/Materials/Lesson Packages/T3 2026/Daily Grade Directions",
    ]
    for folder in folders:
        for path in sorted(folder.glob("*.md")):
            inject(path, STUDENT_40)

    exam_files = [
        ROOT / "plans/7th Grade Technology/Materials/Lesson Packages/T3 2026/Mandrake Project/01 Project Brief.md",
        ROOT / "plans/8th Grade Technology/Materials/Lesson Packages/T3 2026/Exam Project/01 Scratch and microbit Game Project Brief.md",
        ROOT / "plans/9th Grade Technology/Materials/Lesson Packages/T3 2026/STEM Exam Project/10 STEM Project Brief.md",
    ]
    for path in exam_files:
        if path.exists():
            inject(path, STUDENT_90)


def main() -> None:
    update_grade6_spec()
    update_grade7_spec()
    update_directions()
    print("Applied T3 responsibility policy to Grade 6-7 specs and Grade 6-9 student directions.")


if __name__ == "__main__":
    main()
