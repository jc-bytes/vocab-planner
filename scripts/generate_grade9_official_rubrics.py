#!/usr/bin/env python3
"""Generate 9th grade daily rubric DOCX files from the official 2026 map."""

from __future__ import annotations

import argparse
import hashlib
import shutil
from dataclasses import dataclass
from pathlib import Path

from generate_secondary_assessment_docs import (
    GENERATED_RUBRICS_ROOT,
    PLANS_ROOT,
    RubricDoc,
    create_rubric_doc,
    trimester_label,
)


GRADE_ROOT = PLANS_ROOT / "9th Grade Technology"
SOURCE_MAP = (
    GRADE_ROOT
    / "Draft Planning"
    / "Related Drafts"
    / "TECHNOLOGY 9\u00b0"
    / "Final Assessment Map - 9th Grade Technology 2026.md"
)


@dataclass(frozen=True)
class OutputPair:
    spec: RubricDoc
    primary: Path
    mirror: Path


RUBRICS: tuple[RubricDoc, ...] = (
    RubricDoc(
        "9th",
        "IT",
        1,
        1,
        "Physical Computing Vocabulary Table",
        "Vocabulary table with definition, illustration, and example sentence for input, process, output, system, device, circuit, sketch, upload, debug, and test.",
        (
            (
                "Required words",
                "Includes all 10 required words.",
                "One word is missing or unclear.",
                "Several words are missing or unclear.",
                "Most required words are missing.",
            ),
            (
                "Definitions",
                "Definitions are accurate and student-friendly.",
                "Most definitions are accurate; one or two need clarity.",
                "Several definitions are incomplete or inaccurate.",
                "Definitions are mostly missing or incorrect.",
            ),
            (
                "Illustrations",
                "Each word has a clear supporting illustration or diagram.",
                "Most illustrations support the words.",
                "Several illustrations are missing or weakly connected.",
                "Illustrations are mostly missing or unrelated.",
            ),
            (
                "Example sentences",
                "Each word has a correct technology example sentence.",
                "Most sentences use the words correctly.",
                "Several sentences are incomplete, vague, or incorrect.",
                "Example sentences are mostly missing or incorrect.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IT",
        4,
        2,
        "Button-Input Practical Check",
        "Labeled photo/screenshot and 3-sentence explanation using input, output, state, and condition.",
        (
            (
                "Working button system",
                "LED responds correctly to button input.",
                "System mostly works with one minor issue.",
                "System works partly or needs support.",
                "Button-controlled LED is not working.",
            ),
            (
                "Labeled evidence",
                "Photo/screenshot labels input, board/process, LED/output, and key wiring/code.",
                "Evidence is mostly clear; one label needs work.",
                "Several labels are missing or difficult to check.",
                "Labeled evidence is missing or not usable.",
            ),
            (
                "Vocabulary explanation",
                "Three sentences use input, output, state, and condition correctly.",
                "Most required words are used correctly.",
                "Several terms are missing or used incorrectly.",
                "Explanation is missing or does not use the vocabulary.",
            ),
            (
                "Testing evidence",
                "Code/observation plus two test cases show state change.",
                "Basic testing evidence is present.",
                "Testing evidence is limited or unclear.",
                "Testing evidence is missing.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IT",
        8,
        4,
        "State Logic Chart",
        "Four states with input trigger, output response, and one explanation sentence per row.",
        (
            (
                "Four states",
                "Chart includes 4 clear states such as ready, active, warning, and error.",
                "Chart includes 4 states, but one is repeated, vague, or weakly named.",
                "Chart has fewer than 4 usable states or several unclear states.",
                "State list is mostly missing or not usable.",
            ),
            (
                "Input triggers",
                "Each state has a clear input trigger that explains when the state happens.",
                "Most states have clear triggers, with one missing or unclear trigger.",
                "Several triggers are missing, vague, or not connected to the states.",
                "Input triggers are mostly missing or incorrect.",
            ),
            (
                "Output responses",
                "Each state has a clear output response such as color, sound, movement, or behavior.",
                "Most states have clear output responses, with one unclear or incomplete response.",
                "Several output responses are missing, vague, or not connected.",
                "Output responses are mostly missing or incorrect.",
            ),
            (
                "Explanation sentences",
                "Each row includes one useful sentence explaining the state logic.",
                "Most rows include useful explanations, with one weak or incomplete sentence.",
                "Several explanations are vague, incomplete, or hard to connect to the chart.",
                "Explanation sentences are mostly missing.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IT",
        9,
        5,
        "Robotics Design Plan",
        "Project goal, 2 inputs/controls, 2 outputs, state chart, component list, and 3 testing steps.",
        (
            (
                "Project goal",
                "Plan states a realistic robotics project goal that can be built in class time.",
                "Plan has a goal, but it is partly vague or may need scope adjustment.",
                "Goal is present but hard to build, too broad, or weakly connected to robotics.",
                "Project goal is missing or not realistic.",
            ),
            (
                "Inputs and outputs",
                "Plan includes 2 inputs or controls and 2 outputs that fit the project goal.",
                "Plan includes most required inputs/outputs, with one missing or weakly connected.",
                "Inputs/outputs are incomplete, unclear, or only partly connected to the goal.",
                "Inputs and outputs are mostly missing or incorrect.",
            ),
            (
                "State chart and components",
                "Plan includes a useful state chart and a complete component list.",
                "Plan includes both parts, but one needs more detail or clarity.",
                "State chart or component list is incomplete, confusing, or hard to use.",
                "State chart and component list are mostly missing.",
            ),
            (
                "Testing steps",
                "Plan includes 3 clear testing steps that can check whether the robot works.",
                "Plan includes testing steps, with one vague or weakly connected step.",
                "Testing steps are incomplete, unclear, or not connected to the project.",
                "Testing steps are mostly missing.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIT",
        1,
        1,
        "Python and Data Vocabulary Table",
        "Vocabulary table with definition, illustration, and example sentence for Python, list, item, index, string, loop, condition, data, value, and output.",
        (
            (
                "Required words",
                "Includes all 10 required words.",
                "One word is missing or unclear.",
                "Several words are missing or unclear.",
                "Most required words are missing.",
            ),
            (
                "Definitions",
                "Definitions are accurate and student-friendly.",
                "Most definitions are accurate; one or two need clarity.",
                "Several definitions are incomplete or inaccurate.",
                "Definitions are mostly missing or incorrect.",
            ),
            (
                "Illustrations",
                "Each word has a clear supporting visual or code example.",
                "Most visuals support the words.",
                "Several visuals are missing or weakly connected.",
                "Illustrations are mostly missing or unrelated.",
            ),
            (
                "Example sentences",
                "Each word has a correct Python or data example sentence.",
                "Most sentences use the words correctly.",
                "Several sentences are incomplete, vague, or incorrect.",
                "Example sentences are mostly missing or incorrect.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIT",
        5,
        3,
        "Data Collection",
        "One bounded question, 5 survey/measurement items, collection method, privacy rule, and organized dataset table.",
        (
            (
                "Bounded data question",
                "Clear, measurable question with a specific class or school topic.",
                "Measurable question, but limit, audience, or source needs detail.",
                "Question is too broad or partly hard to collect safely.",
                "Question is missing, unsafe, or not measurable.",
            ),
            (
                "Survey or measurement items",
                "5 focused survey or measurement items, each with a clear unit or category.",
                "Most items fit; one item, unit, or category is unclear.",
                "Too few items, or several do not match the data question.",
                "Items are mostly missing or do not collect useful data.",
            ),
            (
                "Collected data table",
                "Required dataset is collected/entered in a table with clear headings, units, and categories.",
                "Dataset is mostly complete; one entry, heading, unit, or category issue.",
                "Dataset is incomplete or hard to check because the table is unclear.",
                "No usable collected or entered data table is submitted.",
            ),
            (
                "Method and privacy boundaries",
                "Collection method and privacy rule are clear, responsible, and followed.",
                "Method/privacy are mostly clear; one detail is missing or not followed.",
                "Method or privacy boundary is vague or hard to verify.",
                "Method or privacy boundary is missing or unsafe.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIT",
        7,
        4,
        "Chart and Interpretation Check",
        "One chart plus 4 interpretation sentences: pattern, comparison, outlier/limitation, and conclusion.",
        (
            (
                "Chart creation",
                "Creates one chart from the dataset with accurate data selection, labels, and title.",
                "Chart is mostly accurate, with one unclear label, title, or data-selection issue.",
                "Chart is present but has several accuracy, label, or readability issues.",
                "Chart is missing or does not represent the dataset correctly.",
            ),
            (
                "Pattern and comparison",
                "Writes one pattern sentence and one comparison sentence supported by the chart.",
                "Both sentences are present, but one is vague or weakly supported.",
                "One sentence is missing or several details do not match the chart.",
                "Pattern and comparison evidence is mostly missing.",
            ),
            (
                "Outlier or limitation",
                "Identifies one outlier or limitation accurately and connects it to the data.",
                "Outlier/limitation is present, but explanation needs one clearer detail.",
                "Outlier/limitation is vague, inaccurate, or weakly connected to the data.",
                "Outlier or limitation is missing.",
            ),
            (
                "Conclusion",
                "Writes one careful conclusion that matches the chart evidence.",
                "Conclusion is present but too general or only partly evidence-based.",
                "Conclusion is unclear, exaggerated, or weakly connected to the chart.",
                "Conclusion is missing or not based on evidence.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIT",
        8,
        5,
        "Data Report Draft",
        "One-page draft with title, question, chart, 3 evidence statements, 1 limitation, and 1 recommendation.",
        (
            (
                "Report structure",
                "One-page draft includes title, question, chart, limitation, and recommendation.",
                "Draft includes most required sections, with one missing or unclear section.",
                "Draft has several missing or poorly organized required sections.",
                "Draft is missing or cannot be checked as a report.",
            ),
            (
                "Evidence statements",
                "Includes 3 evidence statements that clearly connect to the chart or data.",
                "Includes evidence statements, with one vague or weakly connected statement.",
                "Evidence statements are incomplete, unclear, or not supported by the chart.",
                "Evidence statements are mostly missing.",
            ),
            (
                "Limitation and recommendation",
                "Limitation and recommendation are realistic and match the data evidence.",
                "Both are present, but one needs a clearer connection to the data.",
                "One part is missing or the ideas are too general to support the report.",
                "Limitation and recommendation are mostly missing.",
            ),
            (
                "Readable design",
                "Report is organized, readable, and uses layout choices that help the data story.",
                "Report is understandable, with minor layout or readability issues.",
                "Report is hard to follow because of organization or design problems.",
                "Report is disorganized or not readable enough to grade.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIIT",
        1,
        1,
        "STEM and Media Vocabulary Table",
        "Vocabulary table with definition, illustration, and example sentence for STEM, pixel, resolution, color depth, sample, sensor, file size, quality, compression, and RGB.",
        (
            (
                "Required words",
                "Includes all 10 required words.",
                "One word is missing or unclear.",
                "Several words are missing or unclear.",
                "Most required words are missing.",
            ),
            (
                "Definitions",
                "Definitions are accurate and student-friendly.",
                "Most definitions are accurate; one or two need clarity.",
                "Several definitions are incomplete or inaccurate.",
                "Definitions are mostly missing or incorrect.",
            ),
            (
                "Illustrations",
                "Each word has a clear supporting illustration or media example.",
                "Most illustrations support the words.",
                "Several illustrations are missing or weakly connected.",
                "Illustrations are mostly missing or unrelated.",
            ),
            (
                "Example sentences",
                "Each word has a correct STEM or media example sentence.",
                "Most sentences use the words correctly.",
                "Several sentences are incomplete, vague, or incorrect.",
                "Example sentences are mostly missing or incorrect.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIIT",
        7,
        4,
        "Risk Map",
        "Six risks with probability, impact, protection strategy, and one priority recommendation paragraph.",
        (
            (
                "Six risks",
                "Risk map includes 6 relevant technology or cybersecurity risks.",
                "Risk map includes most risks, with one missing, repeated, or unclear risk.",
                "Risk map has too few risks or several risks are not relevant.",
                "Risks are mostly missing or not relevant.",
            ),
            (
                "Probability and impact",
                "Each risk has a clear probability and impact rating.",
                "Most ratings are clear, with one missing or inconsistent rating.",
                "Several ratings are missing, inconsistent, or hard to interpret.",
                "Probability and impact ratings are mostly missing.",
            ),
            (
                "Protection strategies",
                "Each risk has a practical protection strategy.",
                "Most strategies are practical, with one vague or incomplete strategy.",
                "Several strategies are vague, missing, or weakly connected to the risks.",
                "Protection strategies are mostly missing.",
            ),
            (
                "Priority recommendation",
                "Includes one evidence-based priority recommendation paragraph.",
                "Recommendation is present but too general or needs clearer evidence.",
                "Recommendation is vague, incomplete, or weakly connected to the map.",
                "Priority recommendation is missing.",
            ),
        ),
    ),
    RubricDoc(
        "9th",
        "IIIT",
        8,
        5,
        "STEM Project Proposal",
        "Problem, users, goal, tools/platforms, sketch or Tinkercad concept, materials, 3 test criteria, and expected evidence.",
        (
            (
                "Problem, users, and goal",
                "Proposal clearly states the problem, users, and project goal.",
                "Proposal includes most parts, with one incomplete or unclear detail.",
                "Several parts are vague, missing, or weakly connected to a real need.",
                "Problem, users, and goal are mostly missing.",
            ),
            (
                "Tools and design concept",
                "Identifies tools/platforms and includes a useful sketch or Tinkercad concept.",
                "Includes tools and concept, but one part needs more detail.",
                "Tools or concept are incomplete, unclear, or hard to use for building.",
                "Tools and design concept are mostly missing.",
            ),
            (
                "Materials and test criteria",
                "Includes materials and 3 clear test criteria for the prototype.",
                "Includes most materials/tests, with one incomplete or vague part.",
                "Materials or tests are incomplete, unrealistic, or weakly connected to the goal.",
                "Materials and test criteria are mostly missing.",
            ),
            (
                "Expected evidence",
                "Explains what evidence will prove the prototype works or improves the problem.",
                "Expected evidence is present but too general or needs one clearer detail.",
                "Expected evidence is vague, incomplete, or weakly connected to the goal.",
                "Expected evidence is missing.",
            ),
        ),
    ),
)


STALE_PRIMARY_FILES = (
    GRADE_ROOT / "Rubrics" / "IT" / "9th grade - IT - Week 2 - Rubric for Summative 1.docx",
)
STALE_MIRROR_FILES = (
    GENERATED_RUBRICS_ROOT
    / "9th Grade Technology"
    / "1st Trimester"
    / "9th grade - IT - Week 2 - Rubric for Summative 1.docx",
)
ARCHIVE_ROOTS = (
    GRADE_ROOT / "Rubrics" / "Archived Old Map",
    GENERATED_RUBRICS_ROOT / "9th Grade Technology" / "Archived Old Map",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate official 9th grade daily rubric DOCX files.")
    parser.add_argument("--dry-run", action="store_true", help="Show planned outputs without writing files.")
    parser.add_argument("--skip-archive", action="store_true", help="Leave known stale old-map files in place.")
    return parser.parse_args()


def file_name(spec: RubricDoc) -> str:
    return f"{spec.grade} grade - {spec.trimester} - Week {spec.week} - Rubric for Summative {spec.summative}.docx"


def output_pairs() -> list[OutputPair]:
    pairs: list[OutputPair] = []
    for spec in RUBRICS:
        name = file_name(spec)
        pairs.append(
            OutputPair(
                spec=spec,
                primary=GRADE_ROOT / "Rubrics" / spec.trimester / name,
                mirror=GENERATED_RUBRICS_ROOT / "9th Grade Technology" / trimester_label(spec.trimester) / name,
            )
        )
    return pairs


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def archive_file(path: Path, archive_root: Path) -> Path | None:
    if not path.exists():
        return None
    destination = archive_root / path.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    counter = 2
    while destination.exists():
        destination = archive_root / f"{path.stem} ({counter}){path.suffix}"
        counter += 1
    shutil.move(str(path), str(destination))
    return destination


def write_report(pairs: list[OutputPair], archived: list[tuple[Path, Path]], dry_run: bool) -> Path:
    report_path = GENERATED_RUBRICS_ROOT / "9th Grade Technology" / "official-plan-alignment-report.md"
    existing_archives = [
        path
        for archive_root in ARCHIVE_ROOTS
        if archive_root.exists()
        for path in sorted(archive_root.rglob("*.docx"))
    ]
    lines = [
        "# 9th Grade Official Rubric Alignment Report",
        "",
        f"Mode: {'dry run' if dry_run else 'generated files'}",
        f"Source map: `{SOURCE_MAP}`",
        f"Template: `{PLANS_ROOT / 'Templates' / 'Xth grade - XT - Week X - Rubric for Summative X.docx'}`",
        "",
        "## Generated Rubrics",
        "",
    ]
    for pair in pairs:
        status = "planned" if dry_run else "created"
        hash_note = ""
        if not dry_run and pair.primary.exists() and pair.mirror.exists():
            hash_note = " hash-match" if sha256(pair.primary) == sha256(pair.mirror) else " hash-mismatch"
        lines.append(
            f"- {status}: `{pair.primary.relative_to(PLANS_ROOT)}` -> "
            f"`{pair.mirror.relative_to(GENERATED_RUBRICS_ROOT)}` ({pair.spec.title}; {hash_note.strip() or 'pending'})"
        )

    lines.extend(["", "## Archived Stale Old-Map Files", ""])
    if archived:
        for source, destination in archived:
            lines.append(f"- `{source}` -> `{destination}`")
    elif existing_archives:
        for path in existing_archives:
            lines.append(f"- existing archive: `{path}`")
    else:
        lines.append("- None.")

    if not dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report_path


def main() -> int:
    args = parse_args()
    pairs = output_pairs()

    if args.dry_run:
        for pair in pairs:
            print(f"would create: {pair.primary}")
            print(f"would mirror: {pair.mirror}")
        if not args.skip_archive:
            for path in (*STALE_PRIMARY_FILES, *STALE_MIRROR_FILES):
                if path.exists():
                    print(f"would archive stale: {path}")
        write_report(pairs, [], dry_run=True)
        return 0

    archived: list[tuple[Path, Path]] = []
    if not args.skip_archive:
        for path in STALE_PRIMARY_FILES:
            destination = archive_file(path, GRADE_ROOT / "Rubrics" / "Archived Old Map" / "IT")
            if destination is not None:
                archived.append((path, destination))
        for path in STALE_MIRROR_FILES:
            destination = archive_file(
                path,
                GENERATED_RUBRICS_ROOT / "9th Grade Technology" / "Archived Old Map" / "1st Trimester",
            )
            if destination is not None:
                archived.append((path, destination))

    for pair in pairs:
        create_rubric_doc(pair.spec, pair.primary)
        pair.mirror.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pair.primary, pair.mirror)

    report_path = write_report(pairs, archived, dry_run=False)
    print(f"Rubrics generated: {len(pairs)}")
    print(f"Archived stale files: {len(archived)}")
    print(f"Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
