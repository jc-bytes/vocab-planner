# Vocabulary catalog delivery

Production builds copy `vocabularies/manifest.json` and exactly its referenced
JSON files. The current source catalog contains 224 entries (83 retired) and
occupies 746,335 bytes including its manifest. No archive directory is copied.
The manifest deliberately owns which current and retired materials are exposed.

The catalog loader captures a validated byte bundle before delivery. It requires
unique, nonempty matching IDs and unique catalog-relative JSON paths. It rejects
missing files, traversal/URL paths, source symlink components and a material
entry pointing back to the manifest. Source JSON is never normalized or edited.

The copier rejects unsafe output roots, symlink components, non-regular targets
and hard-linked files, preserving unrelated source inodes. The standalone build
validator checks the same output path boundary, exact byte parity, completeness
and absence of unlisted catalog files. It runs in `desktop:build:web` immediately
after asset copying, before packaging and deployment-size checks.

`test:ui:teacher-catalog` uses the real authenticated teacher application and its
library/material loaders with an isolated synthetic backend. Built mode is
`UI_TEACHER_CATALOG_DIST=1`. It verifies the complete catalog metadata plus actual
current and retired material loading, with missing-resource responses forbidden.

The existing real local authenticated UI gate supports `UI_AUTH_SMOKE_DIST=1`
through its owned Vite preview server. Both source and built gates remain in
release/CI. The built gate retains its strict browser-error checks and opens a
real enrolled student's profile; the missing catalog originally surfaced as a
404 in that verification. Student worker policy and all delivery budgets remain
unchanged.
