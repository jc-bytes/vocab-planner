#!/usr/bin/env python3
"""Align Grades 7-9 T3 Markdown plans with reusable pilot modules."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLANS = ROOT / "plans"

MODULES = {
    "spreadsheet": "MOD-SPREADSHEET-ANALYSIS-01 v0.1.0",
    "scratch": "MOD-SCRATCH-DECOMPOSITION-01 v0.1.0",
    "sources": "MOD-SOURCE-CREDIBILITY-01 v0.1.0",
    "sensors": "MOD-SENSOR-SYSTEMS-01 v0.1.0",
    "apps": "MOD-APP-DESIGN-01 v0.1.0",
    "python": "MOD-PYTHON-FUNDAMENTALS-01 v0.1.0",
    "representation": "MOD-DIGITAL-REPRESENTATION-01 v0.1.0",
    "cyber": "MOD-CYBERSECURITY-RISK-01 v0.1.0",
}

ASSIGNMENTS = {
    (7, "September"): {
        "Spreadsheet introduction": f"Open {MODULES['spreadsheet']}, START-01 and FORMULA-LEARN-01, Core track.",
        "Basic formulas": f"Complete {MODULES['spreadsheet']}, FORMULA-PRACTICE-01 and CHART-LEARN-01, Core track.",
        "Charts and data interpretation": f"Review the saved work from {MODULES['spreadsheet']}, FORMULA-PRACTICE-01 and CHART-LEARN-01, before opening the formal task.",
    },
    (7, "October"): {
        "Scratch decomposition plan": f"Open {MODULES['scratch']}, DECOMPOSE-LEARN-01 and DECOMPOSE-PRACTICE-01, Core track.",
        "Scratch loops and subroutines": f"Review {MODULES['scratch']}, DECOMPOSE-PRACTICE-01 and the assigned examples from LOOPS-LEARN-01 before opening the formal starter project.",
        "Source evaluation practice": f"Open {MODULES['sources']}, CREDIBILITY-LEARN-01 and CREDIBILITY-PRACTICE-01, Core track.",
        "Credible sources": f"Review the saved attempt from {MODULES['sources']}, CREDIBILITY-PRACTICE-01, before opening the three formal sources.",
    },
    (7, "November"): {
        "Mandrake system preparation": f"Open {MODULES['sensors']}, SYSTEM-LEARN-01, SYSTEM-PRACTICE-01, and THRESHOLD-LEARN-01, Core track.",
        "Mandrake sensor-system design plan": f"Review the saved system practice from {MODULES['sensors']} before opening the formal planning template.",
        "Build and test the sensor logic": f"Use {MODULES['sensors']}, THRESHOLD-PRACTICE-01 and TESTING-LEARN-01, before recording project trials.",
        "Debugging and reliability": f"Complete the assigned activities in {MODULES['sensors']}, TESTING-PRACTICE-01, then apply the same test structure to the project.",
    },
    (8, "September"): {
        "Decomposition and app purpose": f"Open {MODULES['apps']}, START-01 and USER-LEARN-01, Core track.",
        "Events and screen flow": f"Use {MODULES['apps']}, USER-PRACTICE-01 and EVENTS-LEARN-01, Core track.",
        "App screen plan and event map": f"Review the saved work from {MODULES['apps']}, USER-PRACTICE-01 and EVENTS-LEARN-01, before opening the formal template.",
        "User needs and feedback": f"Complete {MODULES['apps']}, TESTING-LEARN-01 and assigned TESTING-PRACTICE-01 activities, Core track.",
    },
    (8, "October"): {
        "Python arithmetic preparation": f"Open {MODULES['python']}, ARITHMETIC-LEARN-01 and ARITHMETIC-PRACTICE-01, Core track.",
        "Python arithmetic program": f"Review the saved arithmetic practice from {MODULES['python']} before opening the formal starter file.",
        "Debugging preparation": f"Open {MODULES['python']}, DEBUG-LEARN-01 and DEBUG-PRACTICE-01, Core track.",
        "Python debugging check": f"Review the saved debugging practice from {MODULES['python']} before opening the formal five-error program.",
    },
    (8, "November"): {
        "Binary preparation": f"Open {MODULES['representation']}, BINARY-LEARN-01 and BINARY-PRACTICE-01, Core track.",
        "Representation and binary check": f"Review the saved binary practice from {MODULES['representation']} before opening the formal check.",
        "Exam project launch": f"Review {MODULES['scratch']}, DECOMPOSE-LEARN-01, and {MODULES['sensors']}, SYSTEM-LEARN-01, before mapping the game input and output.",
        "Debugging and user testing": f"Use {MODULES['scratch']}, DEBUG-PRACTICE-01, and {MODULES['sensors']}, TESTING-LEARN-01, to structure peer testing.",
    },
    (9, "September"): {
        "STEM and digital media launch": f"Open {MODULES['representation']}, START-01 and IMAGE-LEARN-01, Core track.",
        "Sound representation": f"Complete the assigned activities in {MODULES['representation']}, IMAGE-PRACTICE-01, SOUND-LEARN-01, and SOUND-PRACTICE-01, Core track.",
        "Sonic playground": f"Review saved image and sound practice from {MODULES['representation']} before opening the formal representation check.",
    },
    (9, "October"): {
        "Cybersecurity scenario preparation": f"Open {MODULES['cyber']}, THREAT-LEARN-01 and THREAT-PRACTICE-01, Core track.",
        "Cybersecurity scenario quiz": f"Review the saved threat practice from {MODULES['cyber']} before opening the formal scenarios.",
        "Risk-map preparation": f"Use {MODULES['cyber']}, RISK-LEARN-01, assigned RISK-PRACTICE-01 activities, and PROTECTION-LEARN-01, Core track.",
        "Cybersecurity risk map": f"Review the saved risk practice from {MODULES['cyber']} before opening the formal six-risk template.",
    },
}

RESOURCE_SECTIONS = {
    (7, "September"): [(MODULES["spreadsheet"], "START-01 through ANALYSIS-RECORD-01", "modules/spreadsheet-analysis/")],
    (7, "October"): [(MODULES["scratch"], "DECOMPOSE-LEARN-01 through LOOPS-PRACTICE-01", "modules/scratch-decomposition/"), (MODULES["sources"], "CREDIBILITY-LEARN-01 through CREDIBILITY-PRACTICE-01", "modules/source-credibility/")],
    (7, "November"): [(MODULES["sensors"], "SYSTEM-LEARN-01 through TESTING-PRACTICE-01", "modules/sensor-systems/")],
    (8, "September"): [(MODULES["apps"], "START-01 through TESTING-PRACTICE-01", "modules/app-design/")],
    (8, "October"): [(MODULES["python"], "ARITHMETIC-LEARN-01 through DEBUG-PRACTICE-01", "modules/python-fundamentals/")],
    (8, "November"): [(MODULES["representation"], "BINARY-LEARN-01 through BINARY-PRACTICE-01", "modules/digital-representation/"), (MODULES["scratch"], "DECOMPOSE-LEARN-01 and DEBUG-PRACTICE-01", "modules/scratch-decomposition/"), (MODULES["sensors"], "SYSTEM-LEARN-01 and TESTING-LEARN-01", "modules/sensor-systems/")],
    (9, "September"): [(MODULES["representation"], "START-01 and IMAGE-LEARN-01 through SOUND-PRACTICE-01", "modules/digital-representation/")],
    (9, "October"): [(MODULES["cyber"], "THREAT-LEARN-01 through PROTECTION-LEARN-01", "modules/cybersecurity-risk/")],
}


def rows(text: str) -> tuple[str, list[list[str]]]:
    prefix, table = text.split("## Monthly Plan", 1)
    parsed = []
    for line in table.splitlines():
        if line.startswith("| Week ") and not line.startswith("| Week | Class"):
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) == 7:
                parsed.append(cells)
    return prefix, parsed


def update_rows(text: str, mapping: dict[str, str]) -> str:
    lines = []
    for line in text.splitlines():
        if line.startswith("| Week ") and not line.startswith("| Week | Class"):
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) == 7 and cells[2] in mapping and mapping[cells[2]] not in cells[4]:
                cells[4] = f"{mapping[cells[2]]} {cells[4]}"
                line = "| " + " | ".join(cells) + " |"
        lines.append(line)
    return "\n".join(lines) + ("\n" if text.endswith("\n") else "")


def add_resource_section(text: str, items: list[tuple[str, str, str]]) -> str:
    text = re.sub(r"(?ms)\n## Reusable module assignments\n.*?(?=\n## )", "", text)
    lines = ["## Reusable module assignments", ""]
    for module, sections, local in items:
        lines.append(f"- {module}, {sections}, Core track. Verified local source: `learning-modules/technology-learning-hub/{local}`.")
    lines.append("- Status: pilot. Monitor completion time, unclear prompts, and device problems during the first class use.")
    lines.append("- Fallback: use the module's printable fallback and collect the same written practice or application record.")
    block = "\n".join(lines) + "\n\n"
    marker = "## Competences"
    if marker not in text:
        raise ValueError("Missing Competences heading")
    return text.replace(marker, block + marker, 1)


def main() -> None:
    changed = 0
    for grade in (7, 8, 9):
        root = PLANS / f"{grade}th Grade Technology/Planning/Drafts/3rd Trimester"
        for path in sorted(root.glob("*.md")):
            month = path.stem.rsplit(" - ", 1)[-1]
            text = path.read_text(encoding="utf-8")
            updated = text.replace(
                "Digital evidence is a saved file or a screenshot made on the computer.",
                "Digital evidence is the saved working file, share link, exported report, or typed test record assigned by the teacher.",
            )
            updated = updated.replace("screenshots or demo evidence", "saved project file and test-log evidence")
            updated = updated.replace("computer screenshots", "saved computer files")
            updated = updated.replace("screenshots/notes", "saved files and notes")
            updated = updated.replace("screenshots, links, and materials", "saved files, links, and materials")
            key = (grade, month)
            if key in ASSIGNMENTS:
                updated = update_rows(updated, ASSIGNMENTS[key])
                updated = add_resource_section(updated, RESOURCE_SECTIONS[key])
            if grade == 7:
                updated = updated.replace(
                    "8B completes the four Technology projects. Every other section continues the project assigned by Arts, Mathematics, or Science during Technology time.",
                    "7A continues the Science project and 7B continues the Mathematics project during Technology time.",
                )
            if grade == 8:
                updated = updated.replace(
                    "8B completes the four Technology projects while 8A continues its Science project.",
                    "8B completes the Native Panamanian Language Platform, Obstacle-Detecting Walking Stick, Biomimetic Dexterous Hand, and Wind Turbine Generator projects while 8A continues its Science project.",
                )
                updated = updated.replace(
                    "8B completes the four Technology projects. Every other section continues the project assigned by Arts, Mathematics, or Science during Technology time.",
                    "8B completes the Native Panamanian Language Platform, Obstacle-Detecting Walking Stick, Biomimetic Dexterous Hand, and Wind Turbine Generator projects. 8A continues its Science project during Technology time.",
                )
            if grade == 9:
                updated = updated.replace(
                    "8B completes the four Technology projects. Every other section continues the project assigned by Arts, Mathematics, or Science during Technology time.",
                    "9A continues the Arts project and 9B continues the Science project during Technology time.",
                )
            if updated != text:
                path.write_text(updated, encoding="utf-8")
                changed += 1
    print(f"updated {changed} secondary T3 monthly Markdown files")


if __name__ == "__main__":
    main()
