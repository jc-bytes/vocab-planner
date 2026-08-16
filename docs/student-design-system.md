# Student design system

This document is the source of truth for typography and spacing in the student-facing application shell and its primary pages. The implementation lives in `css/student-design-system.css`.

## Scope

The system owns authentication, navigation, Today, Vocabulary, Sparks, Activity Menu, shared cards, forms, and ordinary student modals. Activity internals, canvas games, export previews, and embedded third-party experiences remain isolated until they receive their own migrations.

## Fonts

- Use Inter for interface text at weights 400, 500, 600, and 700.
- Use the system monospace stack only for code, variables, or technical output.
- Do not reference an unbundled font.
- Do not introduce component-specific font families for visual decoration.

## Typography roles

| Role | Size | Weight | Line height | Use |
| --- | ---: | ---: | ---: | --- |
| Display | 32–48px fluid | 700 | 1.1 | Today headline and continue-learning hero |
| Page title | 24px | 700 | 1.2 | One title per primary view |
| Section title | 20px | 700 | 1.2 | Major groups inside a view |
| Card title | 18px | 600 | 1.25 | Cards and list-item titles |
| Body/control | 16px | 400/600 | 1.5/1.2 | Reading text and primary controls |
| Secondary | 14px | 400 | 1.45 | Supporting descriptions |
| Caption | 12px | 600 | 1.35 | Short metadata and labels |

Text must not be smaller than 12px. Uppercase and wide tracking are reserved for short eyebrow labels. Buttons use 16px by default and may use 14px in compact mobile or secondary contexts.

## Spacing

The spacing scale uses a 4px base: 4, 8, 12, 16, 24, 32, 48, and 64px. Choose the smallest token that preserves a clear relationship between elements.

- 4–8px: icon/text and micro-layout gaps.
- 12px: closely related content.
- 16px: controls and compact component padding.
- 24px: standard card padding and grouped content.
- 32px: section separation.
- 48–64px: major page separation and large desktop breathing room.

Interactive controls must retain a minimum 44px target.

## Today recommendation priority

The Today hero answers what the student should do next; the This Week panel remains the schedule view.

1. Show the oldest overdue required unit with `CATCH UP` and `Continue required work`.
2. Otherwise show the most recently worked unfinished unit with `IN PROGRESS` and `Continue`.
3. Otherwise show the first current-week unit with `THIS WEEK` and `Start unit`.
4. When no incomplete unit remains, show the all-caught-up state.

## Contribution rules

- Use semantic student variables instead of literal font sizes or spacing values.
- Add a new token only when an existing role cannot represent the design intent.
- Do not add `!important` to the owned design-system layer.
- Keep activity and game exceptions in their feature-specific stylesheets.
- Run `npm run test:student-design` before committing student UI changes.
