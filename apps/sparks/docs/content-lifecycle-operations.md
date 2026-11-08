# Vocabulary content operations

The school database is the classroom content authority. Bundled JSON remains demo/import content. Normal app deployments do not import, overwrite or delete school vocabulary. Teacher and authenticated student library routes do not fall back to bundled files when database reads fail.

## Teacher workflow

Save edits to the library first. The save status explicitly says published assignments are unchanged. If another teacher or tab has saved a newer revision, the save fails with a conflict and keeps a local draft. Reopen the saved version and reconcile the draft; do not overwrite it blindly. Save as New creates a distinct library record.

Open **Published assignments** from the vocabulary editor, or **Manage vocabulary publications** from an assignment's Details. Select the exact assignments, choose an operation and preview it. Apply uses the reviewed request and retries with the same request key.

- Update required and optional activities changes only those two lists. Words must match. Existing activity completions, rewards, settings and published grades stay saved. Added requirements become outstanding.
- Create replacement assignments publishes the current saved words/settings, withdraws selected original assignments and leaves their work in history. Replacement assignments start fresh. It retains the selected assignments' availability dates.
- Move selected assignments changes their placement metadata. It does not change release, due or close dates, or other classes.
- Withdraw selected assignments stops new work while retaining history.
- Archive library vocabulary hides it from the library and future publication. Only explicitly selected assignments are withdrawn. The library Archive action selects none, so existing class work stays available.

Every new publication requires Flashcards first and another distinct playable activity. Three or more required activities remain valid. Drafts can be incomplete but cannot be published. Publication validates the saved library revision, and the database validates the policy independently of the browser.

## Preservation and rollout

The migration is additive. Existing assignment IDs and version IDs are retained. It freezes placement to exactly the metadata previously read by students. Historical attempts and grade publications are not assigned a guessed content version. New attempts and grade publications record their version explicitly.

The migration runs in a repeatable-read transaction and checks counts and deterministic row hashes for student, progress, grading, rewards, feedback, profile and membership tables before and after. Added version-provenance columns are excluded from the old-row comparison. A mismatch aborts the transaction.

Before production application, export the application tables to restricted storage outside Git and rehearse against populated disposable fixtures. A paged export is a recovery aid, not a consistent whole-database restore point. The transaction's preservation checks are the proof that this migration did not change existing student data. Never restore a backup over work submitted after that backup.

Run `npm run test:vocabulary-content:database` with the local Supabase Docker socket configured. This creates a schema-only disposable clone, populates real progress and immutable grade fixtures before migration, applies the migration and checks SQL lint, policy parity, permission denial, conflicts, rollback, retries and preservation. It removes the clone on completion. It never connects to hosted services.

Run `npm run test:ui:content-lifecycle` for the publication preview and retry browser test. The standard release also covers save recovery, local drafts, account changes and existing student queues.

Run `supabase/tests/audit_vocabulary_publications.sql` through the trusted database operator connection before/after promotion. Investigate nonzero policy exceptions or missing placement. Do not automatically rewrite historical work. The authenticated `audit_vocabulary_publications_v1` endpoint limits reports to assignments the current teacher can teach.

Promotion probes all new RPC signatures and refuses an older hosted schema. Publish the exact validated artifact and verify public bytes. Keep UI/device acceptance separate from SQL and fixture checks.

## Recovery

Do not down-migrate by dropping versions, provenance or receipts. If a release fails, preserve the database additions and deploy a compatible corrected client. A prior client cannot silently bypass versioned saves, because direct table writes are revoked; it must refresh before editing. Student reads and existing student mutation signatures remain compatible during this transition.

Changing requirements does not rewrite published grades. Re-publish grades deliberately using the existing gradebook workflow when appropriate. Replacement/withdrawal can cause an old student tab to receive an access error. Existing persistence keeps unacknowledged work for retry; this release does not clear browser storage or reassign queued work to a new assignment.

No recurring production job is installed by this change. Configure scheduling and its operator separately if desired.
