#!/usr/bin/env python3
"""Synchronize Grade 7 IIT generated class notes with the revised monthly plans."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GRADE_ROOT = ROOT / "plans" / "7th Grade Technology"
DRAFT_ROOT = GRADE_ROOT / "Planning" / "Drafts" / "2nd Trimester"
NOTES_ROOT = GRADE_ROOT / "Materials" / "Class Notes"

SOURCES = {
    "July": (
        DRAFT_ROOT / "7° Technology - July.md",
        NOTES_ROOT / "T2 2026-07 July",
    ),
    "August": (
        DRAFT_ROOT / "7° Technology - August.md",
        NOTES_ROOT / "T2 2026-08 August",
    ),
}


def monthly_rows(text: str) -> dict[tuple[int, int], dict[str, str]]:
    rows: dict[tuple[int, int], dict[str, str]] = {}
    block = text.split("## Monthly Plan", 1)[1]
    for line in block.splitlines():
        if not re.match(r"^\| Week \d+ \|", line):
            continue
        values = [part.strip().replace("<br>", " ") for part in line.strip().strip("|").split("|")]
        week = int(re.search(r"\d+", values[0]).group())
        duration = int(re.search(r"\d+", values[1]).group())
        rows[(week, duration)] = {
            "topic": values[2],
            "objective": values[3],
            "pre": values[4],
            "while": values[5],
            "post": values[6],
        }
    return rows


def replace_section(text: str, heading: str, value: str) -> str:
    pattern = rf"(## {re.escape(heading)}\n\n)(.*?)(?=\n\n## |\Z)"
    return re.sub(pattern, lambda match: match.group(1) + value, text, count=1, flags=re.S)


def update_note(path: Path, data: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    quoted = data["topic"].replace('"', "'")
    text = re.sub(r'^topic: ".*"$', f'topic: "{quoted}"', text, count=1, flags=re.M)
    text = re.sub(
        r"(\| Topic \| ).*( \|)",
        lambda match: f"{match.group(1)}{data['topic']}{match.group(2)}",
        text,
        count=1,
    )
    text = replace_section(text, "Class Objective", data["objective"])
    text = replace_section(text, "Pre-Activities", f"- {data['pre']}")
    text = replace_section(text, "While Activities", f"- {data['while']}")
    text = replace_section(text, "Post-Activities", f"- {data['post']}")
    path.write_text(text, encoding="utf-8")
    print(f"updated {path}")


def main() -> None:
    for _month, (draft, notes_dir) in SOURCES.items():
        rows = monthly_rows(draft.read_text(encoding="utf-8"))
        for path in sorted(notes_dir.glob("*.md")):
            match = re.search(r"Week (\d+) - (45|90) minutes", path.name)
            if not match:
                continue
            key = (int(match.group(1)), int(match.group(2)))
            if key in rows:
                update_note(path, rows[key])


if __name__ == "__main__":
    main()
