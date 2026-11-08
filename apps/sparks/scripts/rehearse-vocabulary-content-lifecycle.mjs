import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

// Clone local definitions with their real owners/ACL. Never copy source rows or
// connect to hosted services. Additive migrations and fixtures run only in clone.
const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const database = `student_insight_rehearsal_${randomBytes(8).toString('hex')}`;
const run = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (db, input, user = 'supabase_admin') => run(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -d "$2"', 'rehearsal', user, db], input).trim();
let created = false;
try {
    sql('postgres', `create database ${database} owner postgres;`);
    created = true;
    const dump = run(['exec', source.container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql(database, 'drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(database, dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const migrationOwner = sql(database, "select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='is_teacher' limit 1");
    if (!['postgres', 'supabase_admin'].includes(migrationOwner)) throw new Error('Unexpected local application migration owner.');
    const migrations = [
        ['20260917131020_school_platform_foundation.sql', "select to_regclass('public.schools') is not null"],
        ['20260917131024_school_classroom_ownership.sql', "select exists(select 1 from information_schema.columns where table_schema='public' and table_name='teaching_classes' and column_name='school_id')"],
        ['20261006022529_student_insight_teacher_reads.sql', "select to_regprocedure('public.teacher_student_attempts_v1(uuid,uuid,uuid,text,integer,integer)') is not null"],
        ['20261006025409_student_feedback_teacher_review.sql', "select to_regclass('private.student_assignment_feedback') is not null"],
        ['20261104043424_class_trimester_progress.sql', "select to_regprocedure('public.teacher_class_progress_v1(uuid,uuid,date,date)') is not null"],
        ['20261104045454_vocabulary_grading_and_gradebook.sql', "select to_regprocedure('public.teacher_class_gradebook_v1(uuid,uuid,date,date)') is not null"],
        ['20261108010410_vocabulary_content_lifecycle.sql', "select to_regprocedure('public.preview_vocabulary_change_v1(uuid,text,jsonb)') is not null"]
    ];
    for (const [name, present] of migrations) {
        if (sql(database, present) === 't') continue;
        if (name.includes('vocabulary_content_lifecycle')) {
            // Populate real student progress and immutable grade history BEFORE migration.
            execFileSync(process.execPath, ['--test', 'tests/vocabulary-grading-database.test.mjs'], {
                stdio: 'inherit', env: { ...process.env, SPARKS_SCHOOL_TEST_DATABASE: database, SPARKS_SCHOOL_TEST_CONTAINER: source.container }
            });
        }
        sql(database, readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'), migrationOwner);
        console.log(`Applied ${name} in isolated rehearsal.`);
    }
    sql(database, readFileSync(new URL('../supabase/migrations/20261015191054_optimize_teacher_dashboard_analytics.sql', import.meta.url), 'utf8'), migrationOwner);
    sql(database, 'create extension if not exists plpgsql_check schema extensions;');
    for (const signature of [
        'private.vocabulary_publication_errors_v1(jsonb)',
        'private.save_vocabulary_revision_v1(uuid,text,jsonb,integer,uuid)',
        'private.preview_vocabulary_change_v1(uuid,text,jsonb)',
        'private.apply_vocabulary_change_v1(uuid,text,jsonb,text,uuid)',
        'private.publish_class_material_v2(uuid[],text,text,timestamptz,uuid,integer,timestamptz,timestamptz)',
        'private.vocabulary_publication_state_v1(uuid,text)',
        'private.audit_vocabulary_publications_v1(uuid)'
    ]) {
        const diagnostics = JSON.parse(sql(database, `select coalesce(jsonb_agg(to_jsonb(issue)), '[]'::jsonb) from extensions.plpgsql_check_function_tb('${signature}') issue where issue.level in ('error','warning');`));
        if (diagnostics.length) throw new Error(`Grading function lint failed for ${signature}: ${JSON.stringify(diagnostics)}`);
    }
    console.log('Grading functions passed PostgreSQL static checks.');
    console.log('Rehearsal database:', database);
    console.log('Testing disposable schema with original owners/ACL and explicit fixtures.');
    execFileSync(process.execPath, ['--test', '--test-concurrency=1', 'tests/vocabulary-content-lifecycle-database.test.mjs'], {
        stdio: 'inherit', env: { ...process.env, SPARKS_SCHOOL_TEST_DATABASE: database, SPARKS_SCHOOL_TEST_CONTAINER: source.container }
    });
    if (process.env.SPARKS_VERIFY_APPLIED_SCHEMA === '1') {
        execFileSync(process.execPath, ['scripts/rehearse-student-insight-database.mjs'], {
            stdio: 'inherit', env: { ...process.env, SPARKS_LOCAL_DB_CONTAINER: source.container, SPARKS_LOCAL_SOURCE_DATABASE: database, SPARKS_VERIFY_APPLIED_SCHEMA: '0' }
        });
    }
} catch (error) {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr).slice(-2000));
    process.exitCode = 1;
} finally {
    if (created && !process.env.SPARKS_KEEP_REHEARSAL) {
        try {
            sql('postgres', `drop database ${database} with (force);`);
            console.log('Removed isolated rehearsal database.');
        } catch (error) {
            console.error(`Database cleanup required: ${database}`, error.message);
            process.exitCode = 1;
        }
    }
}
