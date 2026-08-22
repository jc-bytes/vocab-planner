#!/usr/bin/env python3
"""Cross-grade structural QA for active Grade 6-9 T3 assessment packages."""

from pathlib import Path
import hashlib
import re
import sys
import zipfile

from docx import Document

ROOT = Path(__file__).resolve().parents[2]
errors = []


def fail(message):
    errors.append(message)


def rubric_tables(path):
    doc = Document(path)
    found = []
    for table in doc.tables:
        for index, row in enumerate(table.rows):
            if row.cells and row.cells[0].text.strip().lower() in {"criterion", "criteria"}:
                found.append((table, index))
                break
    return found


def active_docx(grade):
    base = ROOT / f"plans/{grade}th Grade Technology/Assessments/Rubrics/IIIT"
    if grade == 6:
        selected = []
        for n in range(1, 6):
            matches = [
                p for p in base.glob(f"*Summative {n}*.docx")
                if "practice" not in p.name.lower() and "legacy - do not use" not in p.parts
            ]
            if len(matches) != 1:
                fail(f"Grade 6 Summative {n}: expected one active rubric, found {len(matches)}")
            selected.extend(matches)
        return selected
    selected = sorted(
        p for p in (base / "Daily").glob("*.docx")
        if "2026-" in p.name and "teacher key" not in p.name.lower() and "legacy - do not use" not in p.parts
    )
    selected += sorted(
        p for p in (base / "Appreciation").glob("*.docx")
        if "2026-" in p.name and "legacy - do not use" not in p.parts
    )
    selected += sorted(
        p for p in (base / "Exam Projects").glob("*.docx")
        if "2026-" in p.name and "legacy - do not use" not in p.parts
    )
    return selected


for grade in range(6, 10):
    docs = active_docx(grade)
    expected = 5 if grade == 6 else 8
    if len(docs) != expected:
        fail(f"Grade {grade}: expected {expected} active rubric DOCX files, found {len(docs)}")
    for path in docs:
        results = rubric_tables(path)
        if not results:
            fail(f"No rubric table: {path}")
            continue
        rows = sum(len(table.rows) - header_index - 1 for table, header_index in results)
        expected_rows = 7 if "Exam Projects" in path.parts else 5
        if rows != expected_rows:
            fail(f"{path}: expected {expected_rows} criteria, found {rows}")
        rubric_rows = []
        for table, header_index in results:
            rubric_rows.extend(table.rows[header_index + 1:])
        if rubric_rows:
            last_title = rubric_rows[-1].cells[0].text.splitlines()[0].strip().lower()
            if not ("readiness" in last_title and "responsib" in last_title):
                fail(f"{path}: missing final readiness criterion")
            maxima = []
            for row in rubric_rows:
                match = re.match(r"\s*(\d+)", row.cells[1].text)
                if not match:
                    fail(f"{path}: cannot read maximum points for {row.cells[0].text[:40]}")
                    continue
                maxima.append(int(match.group(1)))
            expected_total = 90 if "Exam Projects" in path.parts else 40
            expected_readiness = 9 if expected_total == 90 else 4
            if maxima and sum(maxima) != expected_total:
                fail(f"{path}: criterion maxima total {sum(maxima)}, expected {expected_total}")
            if maxima and maxima[-1] != expected_readiness:
                fail(f"{path}: readiness maximum is {maxima[-1]}, expected {expected_readiness}")

    classroom = ROOT / f"plans/{grade}th Grade Technology/Assessments/Rubrics/Google Classroom"
    books = sorted(classroom.glob("*.xlsx"))
    if len(books) != expected:
        fail(f"Grade {grade}: expected {expected} Classroom rubrics, found {len(books)}")
    mirror = ROOT / f"plans/Shared/Generated Outputs/Rubrics 2026/{grade}th Grade Technology/3rd Trimester/Google Classroom"
    for book in books:
        with zipfile.ZipFile(book) as archive:
            xml = "".join(
                archive.read(name).decode("utf-8", "ignore")
                for name in archive.namelist()
                if name.startswith("xl/worksheets/") and name.endswith(".xml")
            )
            if "<f" in xml:
                fail(f"Formula found in {book}")
        mirrored = mirror / book.name
        if not mirrored.exists():
            fail(f"Missing mirrored workbook: {mirrored}")
        elif hashlib.sha256(book.read_bytes()).digest() != hashlib.sha256(mirrored.read_bytes()).digest():
            fail(f"Workbook mirror mismatch: {book.name}")

    package = ROOT / f"plans/{grade}th Grade Technology/Materials/Lesson Packages/T3 2026"
    folder_names = {6: "Assessment Directions", 7: "Assessment Directions", 8: "Daily Grades", 9: "Daily Grade Directions"}
    direction_folder = package / folder_names[grade]
    pattern = "Summative *.md" if grade == 6 else "Daily Grade *.md"
    regular_directions = sorted(direction_folder.glob(pattern))
    expected_regular = 5
    if len(regular_directions) != expected_regular:
        fail(f"Grade {grade}: expected {expected_regular} regular formal directions, found {len(regular_directions)}")
    if grade == 6:
        directions = regular_directions
    else:
        appreciation_folder = direction_folder if grade == 7 else package / "Appreciation Grades"
        appreciation_directions = sorted(appreciation_folder.glob("Appreciation Grade *.md"))
        if len(appreciation_directions) != 2:
            fail(f"Grade {grade}: expected 2 STEAM appreciation directions, found {len(appreciation_directions)}")
        directions = regular_directions + appreciation_directions
    for path in directions:
        text = path.read_text(encoding="utf-8")
        for required in ("checklist", "submit", "fallback"):
            present = required in text.lower()
            if required == "submit":
                present = (
                    present or "return" in text.lower() or "turn in" in text.lower()
                    or "submission" in text.lower() or "hand in" in text.lower()
                    or "deliver" in text.lower()
                )
            if required == "fallback":
                present = (
                    present or "failure" in text.lower() or "offline" in text.lower()
                    or "device" in text.lower() or "computer is unavailable" in text.lower()
                    or "paper" in text.lower() or "make-up" in text.lower()
                )
            if not present:
                fail(f"{path}: missing {required} wording")
        bad_patterns = [
            r"take (a )?photo",
            r"use (your|a) phone",
            r"submit (a )?screenshot",
            r"see rubric for details",
        ]
        for pattern in bad_patterns:
            if re.search(pattern, text, re.I):
                fail(f"{path}: prohibited or hidden-requirement phrase matches {pattern}")
        lower = text.lower()
        readiness_requirements = {
            "4 of 40 readiness limit": "4 of 40" in lower,
            "charged computer": "charged computer" in lower,
            "login readiness": "login" in lower,
            "student-caused deduction limited to readiness": (
                "only from these 4 points" in lower
                or "may lower only these 4 points" in lower
                or "may lower only the 4 readiness points" in lower
                or "may lower only these 4 readiness points" in lower
                or "may lower only the responsibility points" in lower
            ),
            "documented school failure boundary": (
                "documented school" in lower and "fallback" in lower
                and ("does not reduce" in lower or "does not lower" in lower)
            ),
        }
        for label, present in readiness_requirements.items():
            if not present:
                fail(f"{path}: missing readiness-policy element {label!r}")

    exam_briefs = {
        7: package / "Mandrake Project/01 Project Brief.md",
        8: package / "Exam Project/01 Scratch and microbit Game Project Brief.md",
        9: package / "STEM Exam Project/10 STEM Project Brief.md",
    }
    if grade in exam_briefs:
        path = exam_briefs[grade]
        if not path.exists():
            fail(f"Missing exam responsibility directions: {path}")
        else:
            text = path.read_text(encoding="utf-8").lower()
            for required in ("responsibility points: 9 of 90", "assigned charged computer", "school login", "outside your control", "only from these 9 points"):
                if required not in text:
                    fail(f"{path}: missing exam readiness-policy wording {required!r}")

if errors:
    print("FAIL")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("PASS: Grade 6-9 active T3 assessment structure, 10% readiness scoring, workbook mirrors, formulas, and direction checks")
