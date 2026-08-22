#!/usr/bin/env python3
"""Extract aligned T3 DOCX rubric content for Classroom workbook generation."""

import argparse
import json
import re
from pathlib import Path
from docx import Document

ROOT = Path(__file__).resolve().parents[2]
items = []

parser = argparse.ArgumentParser()
parser.add_argument("--grade", type=int, choices=(6, 7, 8, 9))
parser.add_argument("--output", type=Path)
args = parser.parse_args()

for grade in ((args.grade,) if args.grade else (6, 7, 8, 9)):
    if grade == 6:
        spec_path = ROOT / "plans/6th Grade Technology/Materials/Lesson Packages/T3 2026/Teacher Materials/Grade 6 T3 Scoring Specification.json"
        grade6 = json.loads(spec_path.read_text(encoding="utf-8"))
        for rubric in grade6["rubrics"]:
            items.append({
                "grade": 6,
                "source": str(ROOT / "plans/6th Grade Technology/Assessments/Rubrics/IIIT" / rubric["docx"]),
                "basename": rubric["xlsx"],
                "criteria": [
                    {
                        "title": criterion["name"],
                        "description": criterion["description"],
                        "points": [level[0] for level in criterion["levels"]],
                        "levels": ["Complete evidence", "Minor gap", "Partial evidence", "Not demonstrated"],
                        "levelDescriptions": [level[1] for level in criterion["levels"]],
                    }
                    for criterion in rubric["criteria"]
                ],
            })
        continue
    base = ROOT / f"plans/{grade}th Grade Technology/Assessments/Rubrics/IIIT"
    paths = []
    for folder in ("Daily", "Appreciation"):
        paths += sorted((base / folder).glob("* - Rubric for * - *.docx"))
    paths += sorted((base / "Exam Projects").glob("*.docx"))
    for path in paths:
        doc = Document(path)
        rubric_tables = [
            table for table in doc.tables
            if table.rows and table.rows[0].cells
            and table.rows[0].cells[0].text.strip().lower() in {"criterion", "criteria"}
        ]
        if not rubric_tables:
            raise ValueError(f"No rubric table found in {path}")
        rows = []
        for table in rubric_tables:
            rows.extend(table.rows[1:])
        expected = 7 if "Exam Projects" in path.parts else 5
        if len(rows) != expected:
            raise ValueError(f"Expected {expected} criteria in {path}; found {len(rows)}")
        criteria = []
        for row in rows:
            values = [cell.text.strip() for cell in row.cells[:5]]
            points = []
            descriptions = []
            for cell_text in values[1:5]:
                match = re.match(r"\s*(\d+)\s*(?:points?|pts?)?\s*[—\-:]?\s*(.*)", cell_text, re.S | re.I)
                if not match:
                    raise ValueError(f"Could not parse score band in {path}: {cell_text!r}")
                points.append(int(match.group(1)))
                descriptions.append(match.group(2).strip())
            criterion_lines = values[0].splitlines()
            criterion_title = re.sub(r"\s*\(\d+\s*pts?\)\s*$", "", criterion_lines[0], flags=re.I)
            criterion_description = " ".join(line.strip() for line in criterion_lines[1:] if line.strip()) or descriptions[0]
            criteria.append({
                "title": criterion_title,
                "description": criterion_description,
                "points": points,
                "levels": ["Complete evidence", "Minor gap", "Partial evidence", "Not demonstrated"],
                "levelDescriptions": descriptions,
            })
        items.append({
            "grade": grade,
            "source": str(path),
            "basename": path.stem + " - Google Classroom Rubric.xlsx",
            "criteria": criteria,
        })

out = args.output or (ROOT / "artifacts/generated/secondary_t3_rubric_specs.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {len(items)} specs to {out}")
