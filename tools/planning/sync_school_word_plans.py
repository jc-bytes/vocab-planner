#!/usr/bin/env python3
"""Sync school-facing Word planning files to an official folder.

The script is intentionally conservative:
- dry-run by default
- copies only .docx files that are missing or different
- never deletes files from the official folder
- skips temporary Word lock files
"""

from __future__ import annotations

import argparse
import filecmp
import shutil
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "plans"
DEFAULT_GRADES = ("5th", "6th", "7th", "8th", "9th")
DEFAULT_KINDS = ("monthly",)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy updated monthly planning .docx files into the official school folder."
    )
    parser.add_argument(
        "--source",
        default=str(DEFAULT_SOURCE),
        help="Source planning folder. Defaults to this repo's plans folder.",
    )
    parser.add_argument(
        "--dest",
        required=True,
        help="Official school folder that should receive the Word files.",
    )
    parser.add_argument(
        "--layout",
        default="mirrored",
        choices=("mirrored", "school"),
        help=(
            "Destination folder layout. Use mirrored when destination has the same structure as source. "
            "Use school for the TECHNOLOGY 2026 Google Drive structure."
        ),
    )
    parser.add_argument(
        "--grades",
        nargs="+",
        default=list(DEFAULT_GRADES),
        help="Grade folder prefixes to sync, such as 5th 6th 7th 8th 9th. Defaults to 5th-9th.",
    )
    parser.add_argument(
        "--kinds",
        nargs="+",
        default=list(DEFAULT_KINDS),
        choices=("monthly", "annual", "rubrics", "study-guides", "summatives", "all"),
        help=(
            "Which Word document groups to sync. Defaults to monthly. "
            "Use --kinds all to include annual plans, rubrics, study guides, and summatives."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually copy files. Without this flag, the script only prints a dry run.",
    )
    parser.add_argument(
        "--backup-dir",
        help="Optional folder where overwritten destination files are backed up first.",
    )
    return parser.parse_args()


def is_selected_kind(path: Path, kinds: set[str]) -> bool:
    if "all" in kinds:
        return True
    normalized_parts = {part.lower() for part in path.parts}
    if "monthly" in kinds and {"planning", "monthly"}.issubset(normalized_parts):
        return True
    if "annual" in kinds and {"planning", "annual"}.issubset(normalized_parts):
        return True
    if "rubrics" in kinds and "rubrics" in normalized_parts:
        return True
    if "study-guides" in kinds and {"materials", "study and review"}.issubset(normalized_parts):
        return True
    if "summatives" in kinds and "non-rubric summatives" in normalized_parts:
        return True
    return False


def is_word_plan(path: Path, grades: set[str], kinds: set[str]) -> bool:
    if path.name.startswith("~$"):
        return False
    if path.suffix.lower() != ".docx":
        return False
    parts = path.parts
    matches_grade = any(part.startswith(tuple(f"{grade} Grade Technology" for grade in grades)) for part in parts)
    return matches_grade and is_selected_kind(path, kinds)


def collect_docx_files(source: Path, grades: set[str], kinds: set[str]) -> list[Path]:
    return sorted(path for path in source.rglob("*.docx") if is_word_plan(path, grades, kinds))


def grade_number_from_path(path: Path) -> str | None:
    for part in path.parts:
        match = None
        if "Grade Technology" in part:
            import re

            match = re.match(r"(\d+)(?:st|nd|rd|th) Grade Technology", part)
        if match:
            return match.group(1)
    return None


def trimester_from_path(path: Path) -> str | None:
    for part in path.parts:
        if part in {"1st Trimester", "2nd Trimester", "3rd Trimester"}:
            return part
    return None


def source_kind(path: Path) -> str | None:
    normalized_parts = {part.lower() for part in path.parts}
    if {"planning", "monthly"}.issubset(normalized_parts):
        return "monthly"
    if {"planning", "annual"}.issubset(normalized_parts):
        return "annual"
    if "rubrics" in normalized_parts:
        return "rubrics"
    if {"materials", "study and review"}.issubset(normalized_parts):
        return "study-guides"
    if "non-rubric summatives" in normalized_parts:
        return "summatives"
    return None


def unique_existing_match(dest_grade_root: Path, source: Path) -> Path | None:
    matches = [path for path in dest_grade_root.rglob(source.name) if path.is_file()]
    if len(matches) == 1:
        return matches[0]
    return None


def school_layout_dest(source_root: Path, dest_root: Path, source: Path) -> tuple[Path | None, str | None]:
    grade = grade_number_from_path(source)
    if grade is None:
        return None, "could not determine grade"

    grade_root = dest_root / f"TECHNOLOGY {grade}°"
    kind = source_kind(source)

    if kind == "monthly":
        trimester = trimester_from_path(source)
        if trimester is None:
            return None, "could not determine trimester"
        if grade == "5":
            return grade_root / "test" / "5th Grade Monthly Planning" / trimester / source.name, None
        return grade_root / "MONTHLY PLAN " / trimester / source.name, None

    if kind == "annual":
        existing = unique_existing_match(grade_root / "ANNUAL PLAN ", source)
        if existing:
            return existing, None
        return grade_root / "ANNUAL PLAN " / source.name, None

    # Rubrics, study guides, and summatives do not use a stable one-to-one
    # folder layout in the school Drive. Only update them when an exact filename
    # already exists exactly once under the grade folder.
    existing = unique_existing_match(grade_root, source)
    if existing:
        return existing, None
    return None, "no unique existing destination match in school layout"


def destination_for(source_root: Path, dest_root: Path, source: Path, layout: str) -> tuple[Path | None, str | None]:
    if layout == "mirrored":
        return dest_root / source.relative_to(source_root), None
    return school_layout_dest(source_root, dest_root, source)


def files_are_same(source: Path, dest: Path) -> bool:
    if not dest.exists():
        return False
    return filecmp.cmp(source, dest, shallow=False)


def backup_existing(dest: Path, backup_root: Path, relative_path: Path) -> None:
    if not dest.exists():
        return
    backup_path = backup_root / relative_path
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(dest, backup_path)


def main() -> int:
    args = parse_args()
    source_root = Path(args.source).expanduser().resolve()
    dest_root = Path(args.dest).expanduser().resolve()
    grades = set(args.grades)
    kinds = set(args.kinds)

    if not source_root.exists():
        raise SystemExit(f"Source folder does not exist: {source_root}")

    backup_root = None
    if args.backup_dir:
        backup_root = Path(args.backup_dir).expanduser().resolve()
    elif args.apply:
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_root = ROOT / "artifacts" / "backups" / f"school-word-sync-{stamp}"

    files = collect_docx_files(source_root, grades, kinds)
    actions: list[tuple[str, Path, Path]] = []
    skipped: list[tuple[Path, str]] = []

    for source in files:
        dest, reason = destination_for(source_root, dest_root, source, args.layout)
        if dest is None:
            skipped.append((source, reason or "not mapped"))
            continue
        if files_are_same(source, dest):
            continue
        action = "update" if dest.exists() else "create"
        actions.append((action, source, dest))

    print(f"Source: {source_root}")
    print(f"Destination: {dest_root}")
    print(f"Layout: {args.layout}")
    print(f"Grades: {', '.join(sorted(grades))}")
    print(f"Kinds: {', '.join(sorted(kinds))}")
    print(f"Word files scanned: {len(files)}")
    print(f"Files skipped: {len(skipped)}")
    print(f"Files to copy: {len(actions)}")

    if not actions:
        print("Nothing to sync.")
        return 0

    print()
    for action, source, dest in actions:
        print(f"{action.upper()}: {source.relative_to(source_root)}")
        print(f"  -> {dest}")

    if skipped:
        print()
        print("Skipped files:")
        for source, reason in skipped:
            print(f"SKIP: {source.relative_to(source_root)}")
            print(f"  reason: {reason}")

    if not args.apply:
        print()
        print("Dry run only. Re-run with --apply to copy these files.")
        return 0

    assert backup_root is not None
    copied = 0
    for _action, source, dest in actions:
        relative = source.relative_to(source_root)
        backup_existing(dest, backup_root, relative)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        copied += 1

    print()
    print(f"Copied {copied} file(s).")
    print(f"Backups saved to: {backup_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
