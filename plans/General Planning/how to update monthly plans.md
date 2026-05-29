# How to Update Monthly Plans

This note exists to prevent formatting mistakes when updating the monthly planning files.

## Golden Rule

Do not regenerate the Word monthly plans from Markdown unless the user explicitly asks for a complete re-export and accepts a format change.

The files in folders like:

- `plans/6th grade/6th Grade Technology - Updated`
- `plans/7th grade/7th Grade Technology - Updated`
- `plans/8th grade/8th Grade Technology - Updated`
- `plans/9th grade/9th Grade Technology - Updated`

are formatted school Word documents. They use the official header, logo, green week bars, two-column weekly layout, spacing, and table structure. Preserve that format.

## Correct Workflow

1. Update the core Markdown planning files first.
2. Update any app data files, such as vocabulary JSON and manifests, if needed.
3. For Word files, edit the existing `.docx` files in place.
4. Make only targeted text replacements inside the existing Word tables and paragraphs.
5. Do not rebuild the `.docx` with a generic Markdown-to-Word script.
6. Render the edited `.docx` files with `soffice`/LibreOffice and visually inspect the result.

## Word File Editing Rules

- Preserve the existing document structure.
- Preserve the logo, institutional heading, subject/teacher/grade row, green weekly bars, and two-column lesson cells.
- Preserve fonts, spacing, page size, margins, table borders, and colors unless the user asks for format changes.
- Do not replace the whole document body.
- Do not create a new Word document from scratch.
- Do not use a simplified `python-docx` builder for these files.
- Use targeted in-place edits only.

## Safe DOCX Update Strategy

Use `python-docx` only to open the existing `.docx`, search for specific old phrases, and replace them in existing paragraphs or table cells.

Good examples:

- Replace an old summative word list with a new word list.
- Replace `Match today's words with definitions: ...` with an updated vocabulary prompt.
- Replace an old assessment description with a new assessment description.

Bad examples:

- Convert Markdown to a new `.docx`.
- Recreate all tables manually.
- Rebuild the monthly plan from scratch.
- Change orientation, margins, columns, header, logo, colors, or table layout.

## Vocabulary Update Pattern

When updating vocabulary:

1. Summative vocabulary should be one 10-word list per trimester.
2. Practice vocabulary should be listed in weekly prompts with simple definitions.
3. Weeks with summative vocabulary do not need practice vocabulary.
4. Keep the Word plan concise because the existing layout has limited space.
5. If definitions make the cells too crowded, use a shorter wording or ask whether to add a separate appendix instead of forcing large tables into the Word layout.

Preferred practice vocabulary wording inside Word lesson cells:

```text
Review Week 9 practice vocabulary.
word: simple definition
word: simple definition
word: simple definition
```

Use one word-definition pair per line. Avoid compressed wording such as `word = definition; word = definition; ...` because it is harder to read in the monthly plan.

When a week has two class meetings, split the practice vocabulary between them instead of repeating the full list in both cells. For example, a 6-word week should use 3 words in the first class and 3 words in the second class. For odd-numbered lists, put the extra word in the first class.

## Markdown vs Word

Markdown planning files can hold fuller planning details, such as:

- `## Vocabulary Plan`
- weekly word-definition tables
- teacher reality notes
- complete planning notes

Word monthly plans should preserve the school-facing format and may contain a shorter version of the same information inside existing lesson cells.

Do not assume the Word files should contain every Markdown detail if doing so would break the template.

## Validation Checklist

After edits:

- Open or parse every edited `.docx`.
- Confirm the old target phrases are gone.
- Confirm the new target phrases are present.
- Render each edited `.docx` with `soffice`/LibreOffice.
- Inspect the rendered pages for:
  - missing logo or header
  - broken green week bars
  - changed layout
  - text overflow or clipping
  - cells that became too crowded
  - unexpected page count changes

## Important Lesson Learned

The Word monthly plans are not disposable exports. They are formatted deliverables.

If a future update touches these files, treat them like finished documents that need careful in-place edits, not like files to regenerate from Markdown.
