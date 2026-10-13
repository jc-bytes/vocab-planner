import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readLocalSupabaseStatus, createLocalAdminClient } from './lib/local-supabase-audit.mjs';

// Read-only. Never infer ownership or enrollment from grade/section.
const args = process.argv.slice(2);
const value = flag => { const index = args.indexOf(flag); return index < 0 ? null : args[index + 1]; };
const output = resolve(value('--out') || '/tmp/sparks-private-workspace-preflight.json');
const ownerEmail = value('--owner-email')?.trim().toLowerCase();
const status = await readLocalSupabaseStatus({ startIfStopped: false });
const admin = createLocalAdminClient(status);
const { data: teachers, error } = await admin.from('profiles').select('user_id,email').eq('role','teacher');
if (error) throw error;
const target = ownerEmail ? teachers.find(t => t.email.toLowerCase() === ownerEmail) : null;
if (ownerEmail && !target) throw new Error('The proposed owner is not a verified teacher in this database.');
const knownTeachers = new Set(teachers.map(t => t.user_id));
const inventory = [];
for (const table of ['vocabularies','weekly_sparks','classroom_activities']) {
    // Pagination matters: the default PostgREST limit is not an inventory limit.
    for (let offset = 0; ; offset += 500) {
        const { data, error } = await admin.from(table).select('*').order('id').range(offset,offset+499);
        if (error) throw error;
        for (const row of data) inventory.push({ table, id: row.id, title: row.name || row.title || '',
            existingOwner: row.owner_id, proposedOwner: row.owner_id || target?.user_id || null,
            ownerStatus: row.owner_id ? (knownTeachers.has(row.owner_id) ? 'preserve' : 'review-invalid-owner') : (target ? 'needs-owner-approval' : 'needs-owner-mapping'),
            teacherSubjectId: row.teacher_subject_id,
            fingerprint: createHash('sha256').update(JSON.stringify(row)).digest('hex') });
        if (data.length < 500) break;
    }
}
const report = { generatedAt: new Date().toISOString(), source: 'local-development', sourceUrl: status.API_URL,
    mode: 'read-only', proposedOwnerEmail: ownerEmail || null,
    totals: { materials: inventory.length, unowned: inventory.filter(i => !i.existingOwner).length,
        invalidOwners: inventory.filter(i => i.ownerStatus === 'review-invalid-owner').length },
    requiredBeforeMigration: ['Verify the same inventory against the hosted database.',
        'Approve owners for unowned records; preserve all other verified owners.',
        'Supply the class rosters; grade and section do not establish enrollment.',
        'Map historical unit progress and files to explicit class assignments and retain the original records.',
        'Back up the hosted database and rehearse that approved mapping before cutover.'], materials: inventory };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report,null,2)+'\n', { mode: 0o600 });
console.log(JSON.stringify({ output, source: report.source, ...report.totals, mutated: false }));
