#!/usr/bin/env python3
"""Synchronize generated Trimester 3 class notes with monthly Markdown tables."""

from __future__ import annotations

import re
import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PLANS = ROOT / "plans"


def monthly_rows(text: str) -> list[list[str]]:
    section = text.split("## Monthly Plan", 1)[1]
    rows: list[list[str]] = []
    for line in section.splitlines():
        if not line.startswith("| Week ") or line.startswith("| Week | Class"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) == 7:
            rows.append(cells)
    return rows


def replace_section(text: str, heading: str, body: str) -> str:
    pattern = rf"(?ms)(^## {re.escape(heading)}\n\n).*?(?=\n## )"
    updated, count = re.subn(pattern, rf"\g<1>{body}\n", text, count=1)
    if count != 1:
        raise ValueError(f"Could not replace {heading}")
    return updated


def sync_note(path: Path, topic: str, objective: str, pre: str, while_: str, post: str) -> bool:
    text = path.read_text(encoding="utf-8")
    updated, count = re.subn(
        r'(?m)^topic: ".*"$',
        f'topic: "{topic.replace(chr(34), chr(39))}"',
        text,
        count=1,
    )
    if count != 1:
        raise ValueError(f"Missing topic frontmatter in {path}")
    updated, count = re.subn(
        r"(?m)^\| Topic \| .* \|$", f"| Topic | {topic} |", updated, count=1
    )
    if count != 1:
        raise ValueError(f"Missing snapshot topic in {path}")
    updated = replace_section(updated, "Class Objective", objective)
    updated = replace_section(updated, "Pre-Activities", f"- {pre}")
    updated = replace_section(updated, "While Activities", f"- {while_}")
    updated = replace_section(updated, "Post-Activities", f"- {post}")
    if updated == text:
        return False
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--grade", type=int, choices=(6, 7, 8, 9))
    args = parser.parse_args()
    changed = 0
    checked = 0
    pattern = "* Grade Technology/Planning/Drafts/3rd Trimester/*° Technology - *.md"
    for monthly in sorted(PLANS.glob(pattern)):
        match = re.search(r"/(\d+)th Grade Technology/.*?/\d+° Technology - (\w+)\.md$", str(monthly))
        if not match:
            continue
        grade, month = match.groups()
        if args.grade and int(grade) != args.grade:
            continue
        # Existing folders carry the numeric month, so resolve them by their month suffix.
        matches = sorted((PLANS / f"{grade}th Grade Technology/Materials/Class Notes").glob(f"T3 2026-* {month}"))
        if len(matches) != 1:
            raise ValueError(f"Expected one class-note folder for Grade {grade} {month}")
        note_dir = matches[0]
        for week, duration, topic, objective, pre, while_, post in monthly_rows(monthly.read_text(encoding="utf-8")):
            year_month = note_dir.name.split()[1]
            note = note_dir / f"{grade}th Grade Technology - T3 - {year_month} - {month} - {week} - {duration}.md"
            if not note.exists():
                raise FileNotFoundError(note)
            checked += 1
            changed += sync_note(note, topic, objective, pre, while_, post)
    print(f"checked {checked} class notes; updated {changed}")


if __name__ == "__main__":
    main()
