# Technology 6A Workspace

This workspace separates teaching content, reusable student modules, applications, utilities, and generated artifacts so each has one predictable home.

| Folder | Purpose |
| --- | --- |
| `apps/sparks/` | Sparks vocabulary site and desktop app, including its tests, Supabase files, and build scripts |
| `plans/` | Organized curriculum vault; see `plans/README.md` for the grade-level Planning, Materials, and Assessments contract |
| `learning-modules/` | Reusable, cataloged learning experiences used across multiple classes |
| `standalone-sites/` | Student-facing sites that are not yet part of the central learning-module catalog |
| `tools/planning/` | Scripts that generate, revise, format, or sync planning materials |
| `tools/analysis/` | One-off inspection and extraction utilities |
| `references/` | Source documents and extracted reference data |
| `artifacts/` | Generated outputs, backups, previews, and temporary working files |
| `vendor/` | Third-party source retained for reference or reuse |

## Common commands

Run Sparks commands from its application folder:

```bash
cd apps/sparks
npm run dev
npm test
npm run desktop:build:web
```

Run planning tools from anywhere; their paths resolve from the workspace rather than the current shell directory:

```bash
python3 tools/planning/sync_school_word_plans.py --help
node tools/planning/generate-obsidian-schedule.mjs --dry-run
```

The authoritative reusable-module registry is `learning-modules/module-catalog.json`. Plans should reference cataloged module IDs and versions instead of relying on an informal folder name.
