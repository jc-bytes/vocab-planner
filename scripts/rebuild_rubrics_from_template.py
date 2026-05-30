#!/usr/bin/env python3
"""Rebuild rubric DOCX files from the official rubric template.

This script creates a safe generated copy set. It does not modify the source
rubric files.
"""

from __future__ import annotations

import argparse
import re
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "plans"
DEFAULT_TEMPLATE = DEFAULT_SOURCE / "Templates" / "Xth grade - XT - Week X - Rubric for Summative X.docx"
DEFAULT_OUTPUT = DEFAULT_SOURCE / "Generated Rubrics 2026"
GRADES = ("6th", "7th", "8th", "9th")
TRIMESTERS = {
    "IT": "1st Trimester",
    "IIT": "2nd Trimester",
    "IIIT": "3rd Trimester",
}
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}
OPENXML_NAMESPACES = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "a14": "http://schemas.microsoft.com/office/drawing/2010/main",
    "aink": "http://schemas.microsoft.com/office/drawing/2016/ink",
    "am3d": "http://schemas.microsoft.com/office/drawing/2017/model3d",
    "cx": "http://schemas.microsoft.com/office/drawing/2014/chartex",
    "cx1": "http://schemas.microsoft.com/office/drawing/2015/9/8/chartex",
    "cx2": "http://schemas.microsoft.com/office/drawing/2015/10/21/chartex",
    "cx3": "http://schemas.microsoft.com/office/drawing/2016/5/9/chartex",
    "cx4": "http://schemas.microsoft.com/office/drawing/2016/5/10/chartex",
    "cx5": "http://schemas.microsoft.com/office/drawing/2016/5/11/chartex",
    "cx6": "http://schemas.microsoft.com/office/drawing/2016/5/12/chartex",
    "cx7": "http://schemas.microsoft.com/office/drawing/2016/5/13/chartex",
    "cx8": "http://schemas.microsoft.com/office/drawing/2016/5/14/chartex",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "o": "urn:schemas-microsoft-com:office:office",
    "oel": "http://schemas.microsoft.com/office/2019/extlst",
    "pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
    "w": W_NS,
    "w10": "urn:schemas-microsoft-com:office:word",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
    "w15": "http://schemas.microsoft.com/office/word/2012/wordml",
    "w16": "http://schemas.microsoft.com/office/word/2018/wordml",
    "w16cex": "http://schemas.microsoft.com/office/word/2018/wordml/cex",
    "w16cid": "http://schemas.microsoft.com/office/word/2016/wordml/cid",
    "w16du": "http://schemas.microsoft.com/office/word/2023/wordml/word16du",
    "w16sdtdh": "http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash",
    "w16sdtfl": "http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock",
    "w16se": "http://schemas.microsoft.com/office/word/2015/wordml/symex",
    "wne": "http://schemas.microsoft.com/office/word/2006/wordml",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
    "wpc": "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas",
    "wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
    "wpi": "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
}
MC_NS = OPENXML_NAMESPACES["mc"]

for prefix, uri in OPENXML_NAMESPACES.items():
    ET.register_namespace(prefix, uri)


@dataclass
class RubricInfo:
    path: Path
    grade_ordinal: str
    grade_number: str
    trimester_code: str
    trimester_label: str
    week: int
    summative: int
    title: str
    groups_line: str


def w_tag(name: str) -> str:
    return f"{{{W_NS}}}{name}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate formatted rubric DOCX files from the template.")
    parser.add_argument("--source", default=str(DEFAULT_SOURCE), help="Plans source folder.")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE), help="Rubric template DOCX.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Generated output folder.")
    parser.add_argument("--dry-run", action="store_true", help="Report what would be generated without writing files.")
    parser.add_argument("--grades", nargs="+", default=list(GRADES), help="Grades to include, e.g. 6th 7th 8th 9th.")
    parser.add_argument(
        "--mirror-to-grade-folders",
        action="store_true",
        help="Also copy generated rubrics back into each grade's Rubrics folder after generation.",
    )
    return parser.parse_args()


def collect_rubrics(source_root: Path, grades: set[str]) -> list[Path]:
    files: list[Path] = []
    for grade in grades:
        rubrics_dir = source_root / f"{grade} Grade Technology" / "Rubrics"
        if not rubrics_dir.exists():
            continue
        files.extend(path for path in rubrics_dir.glob("*.docx") if not path.name.startswith("~$"))
    return sorted(files)


def docx_document_root(path: Path) -> ET.Element:
    with zipfile.ZipFile(path) as docx:
        return ET.fromstring(docx.read("word/document.xml"))


def cell_text(cell: ET.Element) -> str:
    return "".join(t.text or "" for t in cell.findall(".//w:t", NS)).strip()


def table_cell_texts(root: ET.Element) -> list[list[str]]:
    table = root.find(".//w:tbl", NS)
    if table is None:
        return []
    rows: list[list[str]] = []
    for row in table.findall("./w:tr", NS):
        rows.append([cell_text(cell) for cell in row.findall("./w:tc", NS)])
    return rows


def parse_rubric_info(path: Path) -> tuple[RubricInfo | None, str | None]:
    match = re.match(
        r"(?P<grade>\d+)(?:st|nd|rd|th) grade - (?P<trimester>I{1,3}T) - Week (?P<week>\d+) - Rubric for Summative (?P<summative>\d+)\.docx$",
        path.name,
        re.IGNORECASE,
    )
    if not match:
        return None, "filename does not match expected rubric pattern"

    trimester_code = match.group("trimester").upper()
    trimester_label = TRIMESTERS.get(trimester_code)
    if trimester_label is None:
        return None, f"unknown trimester code: {trimester_code}"

    grade_number = match.group("grade")
    grade_ordinal = f"{grade_number}th"
    root = docx_document_root(path)
    rows = table_cell_texts(root)
    if not rows or not rows[0]:
        return None, "could not read rubric table/header"

    header = rows[0][0]
    title = "Untitled Rubric"
    if "40pts" in header:
        title = header.split("40pts", 1)[1].strip() or title

    groups_match = re.search(r"Group:\s*\d+°\s*([A-Z](?:\s+[A-Z])*)", header)
    if groups_match:
        group_letters = groups_match.group(1).split()
        groups_line = f"{grade_ordinal} " + " & ".join(group_letters)
    else:
        groups_line = f"{grade_ordinal} A & B"

    return RubricInfo(
        path=path,
        grade_ordinal=grade_ordinal,
        grade_number=grade_number,
        trimester_code=trimester_code,
        trimester_label=trimester_label,
        week=int(match.group("week")),
        summative=int(match.group("summative")),
        title=title,
        groups_line=groups_line,
    ), None


def clone(element: ET.Element) -> ET.Element:
    return ET.fromstring(ET.tostring(element, encoding="utf-8"))


def serialize_openxml(element: ET.Element) -> bytes:
    xml = ET.tostring(element, encoding="utf-8", xml_declaration=True)
    ignorable = element.get(f"{{{MC_NS}}}Ignorable", "")
    missing_declarations: list[tuple[str, str]] = []
    for prefix in ignorable.split():
        if f"xmlns:{prefix}=".encode("utf-8") not in xml and prefix in OPENXML_NAMESPACES:
            missing_declarations.append((prefix, OPENXML_NAMESPACES[prefix]))

    if not missing_declarations:
        return xml

    tag_start = xml.find(b"<", xml.find(b"?>") + 2)
    tag_end = xml.find(b">", tag_start)
    declarations = "".join(f' xmlns:{prefix}="{uri}"' for prefix, uri in missing_declarations)
    return xml[:tag_end] + declarations.encode("utf-8") + xml[tag_end:]


def clear_paragraph_text(paragraph: ET.Element) -> None:
    for text_node in paragraph.findall(".//w:t", NS):
        text_node.text = ""
    for drawing in paragraph.findall(".//w:drawing", NS):
        parent = paragraph.find(".//w:r", NS)
        if parent is not None:
            parent.remove(drawing)


def set_paragraph_text(paragraph: ET.Element, text: str) -> None:
    text_nodes = paragraph.findall(".//w:t", NS)
    if text_nodes:
        text_nodes[0].text = text
        for extra in text_nodes[1:]:
            extra.text = ""
        return

    run = paragraph.find("w:r", NS)
    if run is None:
        run = ET.SubElement(paragraph, w_tag("r"))
    text_node = ET.SubElement(run, w_tag("t"))
    text_node.text = text


def set_cell_paragraphs(cell: ET.Element, values: list[str]) -> None:
    paragraphs = cell.findall("./w:p", NS)
    if not paragraphs:
        paragraphs = [ET.SubElement(cell, w_tag("p"))]
    template_paragraph = clone(paragraphs[-1])

    while len(paragraphs) < len(values):
        new_paragraph = clone(template_paragraph)
        clear_paragraph_text(new_paragraph)
        cell.append(new_paragraph)
        paragraphs.append(new_paragraph)

    for index, paragraph in enumerate(paragraphs):
        if index < len(values):
            set_paragraph_text(paragraph, values[index])
        else:
            cell.remove(paragraph)


def build_header_lines(info: RubricInfo) -> list[str]:
    return [
        "Academia Internacional David",
        "Robotics and Technology",
        info.trimester_label,
        f"Summative #{info.summative}",
        info.groups_line,
        f"Name: ________________________________   Date: __________________   Group: {info.grade_number}° {' '.join(info.groups_line.split()[1::2]) if '&' in info.groups_line else 'A B'}",
        "Teacher: Porfirio Rios                  Score: _____ / 40pts",
        info.title,
    ]


def normalize_table_fonts(table: ET.Element) -> None:
    for row_index, row in enumerate(table.findall("./w:tr", NS)):
        for cell_index, cell in enumerate(row.findall("./w:tc", NS)):
            for run in cell.findall(".//w:r", NS):
                run_properties = run.find("w:rPr", NS)
                if run_properties is None:
                    run_properties = ET.Element(w_tag("rPr"))
                    run.insert(0, run_properties)

                run_fonts = run_properties.find("w:rFonts", NS)
                if run_fonts is None:
                    run_fonts = ET.SubElement(run_properties, w_tag("rFonts"))
                for key in ("ascii", "hAnsi", "cs"):
                    run_fonts.set(w_tag(key), "Arial")

                size = run_properties.find("w:sz", NS)
                if size is None:
                    size = ET.SubElement(run_properties, w_tag("sz"))
                size.set(w_tag("val"), "24")

                size_cs = run_properties.find("w:szCs", NS)
                if size_cs is None:
                    size_cs = ET.SubElement(run_properties, w_tag("szCs"))
                size_cs.set(w_tag("val"), "24")

                if row_index in {0, 1, 6} or cell_index == 0:
                    if run_properties.find("w:b", NS) is None:
                        ET.SubElement(run_properties, w_tag("b"))


def copy_table_geometry(template_table: ET.Element, output_table: ET.Element) -> None:
    template_pr = template_table.find("w:tblPr", NS)
    output_pr = output_table.find("w:tblPr", NS)
    if template_pr is not None and output_pr is not None:
        template_width = template_pr.find("w:tblW", NS)
        output_width = output_pr.find("w:tblW", NS)
        if template_width is not None:
            if output_width is None:
                output_width = ET.SubElement(output_pr, w_tag("tblW"))
            output_width.attrib.clear()
            output_width.attrib.update(template_width.attrib)


def rebuild_document_xml(template_xml: bytes, source_xml: bytes, info: RubricInfo) -> bytes:
    template_root = ET.fromstring(template_xml)
    source_root = ET.fromstring(source_xml)
    template_table = template_root.find(".//w:tbl", NS)
    source_table = source_root.find(".//w:tbl", NS)
    if template_table is None or source_table is None:
        raise ValueError("missing table in template or source")

    output_table = clone(source_table)
    output_rows = output_table.findall("./w:tr", NS)
    if output_rows:
        header_cell = output_rows[0].find("./w:tc", NS)
        template_header_cell = template_table.find("./w:tr/w:tc", NS)
        if header_cell is not None and template_header_cell is not None:
            header_cell[:] = [clone(child) for child in template_header_cell]
            set_cell_paragraphs(header_cell, build_header_lines(info))

    copy_table_geometry(template_table, output_table)
    normalize_table_fonts(output_table)

    body = template_root.find("w:body", NS)
    if body is None:
        raise ValueError("template document body not found")
    for index, child in enumerate(list(body)):
        if child.tag == w_tag("tbl"):
            body.remove(child)
            body.insert(index, output_table)
            break
    return serialize_openxml(template_root)


def destination_for(output_root: Path, info: RubricInfo) -> Path:
    return output_root / f"{info.grade_ordinal} Grade Technology" / info.trimester_label / info.path.name


def replace_docx_part(docx_path: Path, part_name: str, data: bytes) -> None:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp_file:
        tmp_path = Path(tmp_file.name)

    try:
        with zipfile.ZipFile(docx_path, "r") as input_zip, zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as output_zip:
            for item in input_zip.infolist():
                item_data = data if item.filename == part_name else input_zip.read(item.filename)
                output_zip.writestr(item, item_data)
        shutil.move(tmp_path, docx_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def sanitize_styles_xml(styles_xml: bytes) -> bytes:
    root = ET.fromstring(styles_xml)
    for style in list(root.findall("w:style", NS)):
        # Word for Mac repairs nameless custom styles and reports them as
        # "Styles 1". These table styles are unused in the rubric document.
        if style.find("w:name", NS) is None:
            root.remove(style)
    return serialize_openxml(root)


def write_generated_docx(template_path: Path, info: RubricInfo, destination: Path) -> None:
    with zipfile.ZipFile(template_path, "r") as template_zip, zipfile.ZipFile(info.path, "r") as source_zip:
        document_xml = rebuild_document_xml(
            template_zip.read("word/document.xml"),
            source_zip.read("word/document.xml"),
            info,
        )
        template_content_types = template_zip.read("[Content_Types].xml")
        template_styles = sanitize_styles_xml(template_zip.read("word/styles.xml"))

        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp_file:
            tmp_path = Path(tmp_file.name)

        try:
            with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as output_zip:
                for item in template_zip.infolist():
                    data = template_zip.read(item.filename)
                    if item.filename == "word/document.xml":
                        data = document_xml
                    output_zip.writestr(item, data)
            Document(str(tmp_path)).save(str(destination))
            # python-docx rewrites embedded-font content types as per-font
            # overrides. Word for Mac reports that package shape as a style
            # repair, so keep the template's single odttf default.
            replace_docx_part(destination, "[Content_Types].xml", template_content_types)
            replace_docx_part(destination, "word/styles.xml", template_styles)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()


def load_planning_text(source_root: Path) -> str:
    candidates = [
        source_root / "General Planning" / "summative-activities-by-level.md",
        source_root / "6th Grade Technology" / "Draft Planning" / "Related Drafts" / "final-assessment-map.md",
        source_root / "8th Grade Technology" / "Draft Planning" / "Monthly Planning" / "final-assessment-map-2026.md",
    ]
    text_parts = []
    for path in candidates:
        if path.exists():
            text_parts.append(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n\n".join(text_parts).lower()


def verification_notes(info: RubricInfo, planning_text: str) -> list[str]:
    notes: list[str] = []
    title_key = re.sub(r"[^a-z0-9]+", " ", info.title.lower()).strip()
    title_words = [word for word in title_key.split() if len(word) > 3]
    if title_words and not all(word in planning_text for word in title_words[:3]):
        notes.append("title not clearly found in available planning drafts")

    if info.grade_number not in planning_text:
        notes.append("grade number not found in planning drafts")

    if not re.search(rf"week\s+{info.week}\b|week\s*{info.week},|week\s*{info.week}\s*\|", planning_text):
        notes.append("week not clearly found in available planning drafts")

    return notes


def report_lines(
    *,
    source_root: Path,
    template_path: Path,
    output_root: Path,
    dry_run: bool,
    mirror_to_grade_folders: bool,
    generated: list[tuple[RubricInfo, Path, list[str]]],
    skipped: list[tuple[Path, str]],
) -> list[str]:
    lines = [
        "# Generated Rubrics 2026 Report",
        "",
        f"Mode: {'dry run' if dry_run else 'generated files'}",
        f"Source: `{source_root}`",
        f"Template: `{template_path}`",
        f"Output: `{output_root}`",
        f"Mirrored to grade Rubrics folders: {'yes' if mirror_to_grade_folders else 'no'}",
        "",
        f"Rubrics found: {len(generated) + len(skipped)}",
        f"Rubrics generated: {len(generated) if not dry_run else 0}",
        f"Rubrics ready to generate: {len(generated)}",
        f"Rubrics skipped: {len(skipped)}",
        "",
        "## Generated / Ready",
        "",
    ]
    for info, destination, notes in generated:
        note_text = "; ".join(notes) if notes else "OK"
        lines.append(f"- `{info.path.relative_to(source_root)}` -> `{destination.relative_to(output_root)}` ({note_text})")

    if skipped:
        lines.extend(["", "## Skipped", ""])
        for path, reason in skipped:
            lines.append(f"- `{path}`: {reason}")

    mismatches = [(info, notes) for info, _destination, notes in generated if notes]
    lines.extend(["", "## Verification Notes", ""])
    if mismatches:
        for info, notes in mismatches:
            lines.append(f"- `{info.path.name}`: {'; '.join(notes)}")
    else:
        lines.append("- No essential verification warnings from available planning drafts.")

    return lines


def cleanup_word_lock_files(root: Path) -> None:
    if not root.exists():
        return
    for path in root.rglob("~$*.docx"):
        path.unlink()


def main() -> int:
    args = parse_args()
    source_root = Path(args.source).expanduser().resolve()
    template_path = Path(args.template).expanduser().resolve()
    output_root = Path(args.output).expanduser().resolve()
    grades = set(args.grades)

    if not source_root.exists():
        raise SystemExit(f"Source folder does not exist: {source_root}")
    if not template_path.exists():
        raise SystemExit(f"Template file does not exist: {template_path}")

    planning_text = load_planning_text(source_root)
    generated: list[tuple[RubricInfo, Path, list[str]]] = []
    skipped: list[tuple[Path, str]] = []

    if not args.dry_run:
        cleanup_word_lock_files(output_root)

    for rubric_path in collect_rubrics(source_root, grades):
        info, reason = parse_rubric_info(rubric_path)
        if info is None:
            skipped.append((rubric_path, reason or "could not parse rubric"))
            continue
        destination = destination_for(output_root, info)
        notes = verification_notes(info, planning_text)
        generated.append((info, destination, notes))
        if not args.dry_run:
            write_generated_docx(template_path, info, destination)
            if args.mirror_to_grade_folders:
                shutil.copy2(destination, info.path)

    lines = report_lines(
        source_root=source_root,
        template_path=template_path,
        output_root=output_root,
        dry_run=args.dry_run,
        mirror_to_grade_folders=args.mirror_to_grade_folders,
        generated=generated,
        skipped=skipped,
    )

    if args.dry_run:
        print("\n".join(lines))
    else:
        output_root.mkdir(parents=True, exist_ok=True)
        report_path = output_root / "generation-report.md"
        report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"Rubrics found: {len(generated) + len(skipped)}")
        print(f"Rubrics generated: {len(generated)}")
        print(f"Rubrics skipped: {len(skipped)}")
        print(f"Report: {report_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
