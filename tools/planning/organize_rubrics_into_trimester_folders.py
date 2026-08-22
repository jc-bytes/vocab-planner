#!/usr/bin/env python3
"""Organize Technology rubric and assessment docs into grade trimester folders.

The script is intentionally conservative:
- active grade-folder files are moved into each grade's Rubrics tree;
- generated copies are copied into the grade tree only when they add a variant;
- collisions with different content are preserved with a variant suffix;
- exact duplicate content is not duplicated.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
from dataclasses import dataclass
from pathlib import Path


TRIMESTER_BY_VERBOSE = {
    "1st Trimester": "IT",
    "2nd Trimester": "IIT",
    "3rd Trimester": "IIIT",
    "III Trimester": "IIIT",
    "II Trimester": "IIT",
    "I Trimester": "IT",
}

TRIMESTER_BY_MONTH = {
    "March": "IT",
    "April": "IT",
    "May": "IT",
    "June": "IIT",
    "July": "IIT",
    "August": "IIT",
    "September": "IIIT",
    "October": "IIIT",
    "November": "IIIT",
    "December": "IIIT",
}

CODE_RE = re.compile(r" - (I{1,3}T) - ")
GRADE_RE = re.compile(r"(\d+)(?:st|nd|rd|th) Grade Technology")


@dataclass(frozen=True)
class Operation:
    action: str
    source: Path
    destination: Path | None
    note: str = ""


def ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def grade_from_path(path: Path) -> int | None:
    match = GRADE_RE.search(path.as_posix())
    return int(match.group(1)) if match else None


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def trimester_from_name(name: str) -> str | None:
    match = CODE_RE.search(name)
    if match:
        return match.group(1)
    lower_name = name.lower()
    if "1st summative" in lower_name or "2nd summative" in lower_name:
        return "IT"
    if "3rd summative" in lower_name or "4th summative" in lower_name:
        return "IIT"
    if "5th summative" in lower_name:
        return "IIIT"
    return None


def trimester_from_path(path: Path) -> str | None:
    path_text = path.as_posix()
    for label, code in TRIMESTER_BY_VERBOSE.items():
        if re.search(rf"(^|/){re.escape(label)}(?:/|$| )", path_text):
            return code
    for month, code in TRIMESTER_BY_MONTH.items():
        if f"/{month}/" in path_text or f"/{month} " in path_text or f". {month}/" in path_text:
            return code
    return trimester_from_name(path.name)


def grade_root(plans: Path, grade: int) -> Path:
    return plans / f"{ordinal(grade)} Grade Technology"


def local_destination(plans: Path, source: Path, category: str, archive: bool = False) -> Path | None:
    grade = grade_from_path(source)
    trimester = trimester_from_path(source)
    if grade is None or trimester is None:
        return None

    base = grade_root(plans, grade) / "Assessments" / "Rubrics" / trimester

    if grade >= 7:
        if category in {"Rubrics", "Non-Rubric Summatives"}:
            base = base / "Daily"
        elif category == "Appreciation Grades":
            base = base / "Appreciation"
        elif category == "Exam Projects":
            base = base / "Exam Projects"
        elif category == "Legacy":
            base = base / "Archived Variants"
        else:
            return None
    else:
        if category == "Non-Rubric Summatives":
            base = base / "Summatives"
        elif category == "Legacy":
            base = base / "Archived Variants"
        elif category != "Rubrics":
            return None

    if archive and "Archived Variants" not in base.parts:
        base = base / "Archived Variants"

    return base / source.name


def variant_path(destination: Path, label: str) -> Path:
    suffix = label
    candidate = destination.with_name(f"{destination.stem} - {suffix}{destination.suffix}")
    counter = 2
    while candidate.exists():
        candidate = destination.with_name(f"{destination.stem} - {suffix} {counter}{destination.suffix}")
        counter += 1
    return candidate


def resolve_destination(source: Path, destination: Path, variant_label: str) -> tuple[Path | None, str]:
    if source == destination:
        return destination, "already placed"
    if not destination.exists():
        return destination, ""
    if sha256(source) == sha256(destination):
        return None, "exact duplicate already placed"

    existing_hashes = {sha256(destination)}
    for sibling in destination.parent.glob(f"{destination.stem} - *{destination.suffix}"):
        existing_hashes.add(sha256(sibling))
        if sha256(source) == sha256(sibling):
            return None, f"variant already placed as {sibling.name}"
    if sha256(source) in existing_hashes:
        return None, "content already placed"
    return variant_path(destination, variant_label), "preserved variant"


def move_or_copy(source: Path, destination: Path, action: str, variant_label: str, apply: bool) -> Operation:
    resolved, note = resolve_destination(source, destination, variant_label)
    if resolved is None:
        if action == "move" and apply:
            source.unlink()
        return Operation("dedupe" if action == "move" else "skip", source, destination, note)
    if note == "already placed":
        return Operation("skip", source, destination, note)
    if apply:
        resolved.parent.mkdir(parents=True, exist_ok=True)
        if action == "move":
            shutil.move(str(source), str(resolved))
        else:
            shutil.copy2(source, resolved)
    return Operation(action, source, resolved, note)


def source_category(source: Path, grade_dir: Path) -> str | None:
    try:
        relative = source.relative_to(grade_dir)
    except ValueError:
        return None
    if not relative.parts:
        return None
    if relative.parts[0] == "Assessments" and len(relative.parts) >= 2:
        category = relative.parts[1]
    else:
        category = relative.parts[0]
    return category if category in {"Rubrics", "Non-Rubric Summatives", "Appreciation Grades", "Exam Projects"} else None


def active_source_files(plans: Path) -> list[tuple[Path, str, bool]]:
    files: list[tuple[Path, str, bool]] = []
    for grade_dir in sorted(plans.glob("* Grade Technology")):
        grade = grade_from_path(grade_dir)
        if grade is None:
            continue
        assessment_root = grade_dir / "Assessments"
        for category in ("Rubrics", "Non-Rubric Summatives", "Appreciation Grades", "Exam Projects"):
            category_dir = assessment_root / category
            if not category_dir.exists():
                continue
            for source in sorted(category_dir.rglob("*.docx")):
                if source.name.startswith("~$"):
                    continue
                if category == "Rubrics":
                    # Already placed primary files can stay directly in trimester folders.
                    parts = source.relative_to(category_dir).parts
                    if grade <= 6 and len(parts) >= 2 and parts[0] in {"IT", "IIT", "IIIT"}:
                        continue
                    # Already placed secondary files can stay under trimester category folders.
                    if grade >= 7 and len(parts) >= 3 and parts[0] in {"IT", "IIT", "IIIT"} and parts[1] in {
                        "Daily",
                        "Appreciation",
                        "Exam Projects",
                        "Archived Variants",
                    }:
                        continue
                archive = "Archived Old Map" in source.as_posix()
                files.append((source, category, archive))
    return files


def generated_rubric_files(plans: Path) -> list[tuple[Path, str, bool]]:
    generated_root = plans / "Shared/Generated Outputs/Rubrics 2026"
    if not generated_root.exists():
        return []
    files: list[tuple[Path, str, bool]] = []
    for source in sorted(generated_root.rglob("*.docx")):
        if not source.is_file():
            continue
        if source.name.startswith("~$"):
            continue
        if "/QA/" in source.as_posix():
            continue
        files.append((source, "Rubrics", "Archived Old Map" in source.as_posix()))
    return files


def generated_assessment_files(plans: Path) -> list[tuple[Path, str, bool]]:
    generated_root = plans / "Shared" / "Generated Outputs" / "Assessment Docs 2026"
    if not generated_root.exists():
        return []
    files: list[tuple[Path, str, bool]] = []
    for source in sorted(generated_root.rglob("*.docx")):
        if not source.is_file():
            continue
        if source.name.startswith("~$"):
            continue
        if "/QA/" in source.as_posix():
            continue
        category = None
        for possible in ("Rubrics", "Appreciation Grades", "Exam Projects"):
            if f"/{possible}/" in source.as_posix():
                category = possible
                break
        if category:
            files.append((source, category, False))
    return files


def legacy_rubric_files(plans: Path) -> list[tuple[Path, str, bool]]:
    files: list[tuple[Path, str, bool]] = []
    rubric_re = re.compile(r"rubric|rubrica|rúbrica", re.IGNORECASE)
    for source in sorted(plans.rglob("*")):
        if not source.is_file() or source.name.startswith("~$"):
            continue
        text = source.as_posix()
        if not rubric_re.search(text):
            continue
        if "/Shared/Generated Outputs/Rubrics 2026/" in text or "/Shared/Generated Outputs/Assessment Docs 2026/" in text or "/QA/" in text:
            continue
        if "/Templates/" in text:
            continue
        if source.suffix.lower() == ".docx" and source_category(source, grade_root(plans, grade_from_path(source) or 0)):
            continue
        if "/Planning/Drafts/" in text:
            files.append((source, "Legacy", True))
    return files


def cleanup_empty_assessment_dirs(plans: Path, apply: bool) -> list[Operation]:
    operations: list[Operation] = []
    for grade_dir in sorted(plans.glob("* Grade Technology")):
        for folder in ("Non-Rubric Summatives", "Appreciation Grades", "Exam Projects"):
            top = grade_dir / "Assessments" / folder
            if not top.exists():
                continue
            for ds_store in top.rglob(".DS_Store"):
                operations.append(Operation("remove", ds_store, None, "finder metadata"))
                if apply:
                    ds_store.unlink()
            for directory in sorted([p for p in top.rglob("*") if p.is_dir()], key=lambda p: len(p.parts), reverse=True):
                if not any(directory.iterdir()):
                    operations.append(Operation("rmdir", directory, None, "empty old assessment folder"))
                    if apply:
                        directory.rmdir()
            if top.exists() and not any(top.iterdir()):
                operations.append(Operation("rmdir", top, None, "empty old assessment folder"))
                if apply:
                    top.rmdir()
    return operations


def organize(plans: Path, apply: bool) -> list[Operation]:
    operations: list[Operation] = []

    for source, category, archive in active_source_files(plans):
        destination = local_destination(plans, source, category, archive=archive)
        if destination is None:
            operations.append(Operation("unmapped", source, None, category))
            continue
        operations.append(move_or_copy(source, destination, "move", "Variant", apply))

    for source, category, archive in generated_rubric_files(plans):
        destination = local_destination(plans, source, category, archive=archive)
        if destination is None:
            operations.append(Operation("unmapped", source, None, "generated rubrics"))
            continue
        operations.append(move_or_copy(source, destination, "copy", "Generated Rubrics Variant", apply))

    for source, category, archive in generated_assessment_files(plans):
        destination = local_destination(plans, source, category, archive=archive)
        if destination is None:
            operations.append(Operation("unmapped", source, None, "generated assessments"))
            continue
        operations.append(move_or_copy(source, destination, "copy", "Generated Assessment Variant", apply))

    for source, category, archive in legacy_rubric_files(plans):
        destination = local_destination(plans, source, category, archive=archive)
        if destination is None:
            operations.append(Operation("unmapped", source, None, "legacy rubric"))
            continue
        operations.append(move_or_copy(source, destination, "move", "Archived Variant", apply))

    operations.extend(cleanup_empty_assessment_dirs(plans, apply))
    return operations


def print_summary(root: Path, operations: list[Operation], verbose: bool) -> None:
    counts: dict[str, int] = {}
    for operation in operations:
        counts[operation.action] = counts.get(operation.action, 0) + 1

    print("SUMMARY")
    for action in sorted(counts):
        print(f"{action}: {counts[action]}")

    interesting = [op for op in operations if op.action in {"move", "copy", "dedupe", "unmapped"}]
    print(f"interesting operations: {len(interesting)}")
    if verbose:
        print()
        for operation in interesting:
            source = operation.source.relative_to(root)
            if operation.destination is None:
                print(f"{operation.action.upper()}: {source} [{operation.note}]")
            else:
                destination = operation.destination.relative_to(root)
                suffix = f" [{operation.note}]" if operation.note else ""
                print(f"{operation.action.upper()}: {source} -> {destination}{suffix}")
    else:
        for operation in [op for op in interesting if op.action == "unmapped"][:20]:
            print(f"UNMAPPED: {operation.source.relative_to(root)} [{operation.note}]")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="perform moves/copies")
    parser.add_argument("--verbose", action="store_true", help="print operation map")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    plans = root / "plans"
    if not plans.exists():
        raise SystemExit(f"Planning folder not found: {plans}")

    operations = organize(plans, args.apply)
    print_summary(root, operations, args.verbose)
    if not args.apply:
        print()
        print("Dry run only. Re-run with --apply to move/copy files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
