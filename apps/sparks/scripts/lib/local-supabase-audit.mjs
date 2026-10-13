import { execFile, execFileSync, spawn } from 'node:child_process';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createClassroomRepository } from '../../js/services/classroomRepository.js';

// Trusted local fixture operator; never a hosted database connection.
export function runLocalAuditSql(query) {
    if(process.env.SPARKS_TEST_SUPABASE_WORKDIR && !process.env.SPARKS_TEST_DB_CONTAINER)throw new Error('A rehearsal workdir requires SPARKS_TEST_DB_CONTAINER; refusing the default database');
    const container=process.env.SPARKS_TEST_DB_CONTAINER || 'supabase_db_ifofhiypzffruzhiukst';
    if(!/^supabase_db_[a-zA-Z0-9_-]+$/.test(container))throw new Error('Expected a local Supabase database container');
    return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']});
}

export const AUDIT_PASSWORD = 'AuditPass123!';
export const AUDIT_TEACHER_EMAIL = 'audit.teacher@aid.edu.pa';
export const AUDIT_STUDENT_EMAIL = 'audit.student@aid.edu.pa';
export const AUDIT_SPARK_IDS = [
    'audit-current-spark',
    'audit-future-spark'
];
export const AUDIT_VOCABULARY_ID = 'audit-private-vocabulary';

function execFileText(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            maxBuffer: options.maxBuffer || 1024 * 1024
        }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            stdio: options.stdio || 'inherit'
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

function parseStatusJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(`Could not parse Supabase status JSON. Run "supabase status --output json" to inspect local services. ${error.message}`);
    }
}

function assertLocalUrl(label, value) {
    if (!value) throw new Error(`Supabase status is missing ${label}.`);
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
        throw new Error(`${label} must be local for audit seeding. Refusing ${value}`);
    }
}

export function getBrowserSupabaseConfig(status) {
    const publishableKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
    if (!publishableKey) throw new Error('Supabase status is missing PUBLISHABLE_KEY/ANON_KEY.');
    return {
        url: status.API_URL,
        publishableKey
    };
}

export async function readLocalSupabaseStatus({ startIfStopped = true } = {}) {
    if (process.env.SPARKS_TEST_SUPABASE_WORKDIR && !process.env.SPARKS_TEST_DB_CONTAINER) {
        throw new Error('A rehearsal workdir requires SPARKS_TEST_DB_CONTAINER before creating any fixtures.');
    }
    let output = '';
    try {
        output = await execFileText('supabase', ['status', '--output', 'json', ...(process.env.SPARKS_TEST_SUPABASE_WORKDIR ? ['--workdir', process.env.SPARKS_TEST_SUPABASE_WORKDIR] : [])]);
    } catch (error) {
        if (!startIfStopped) {
            throw new Error(`Local Supabase is not reachable. Start it with "supabase start". ${error.stderr || error.message}`);
        }
        await runCommand('supabase', ['start', ...(process.env.SPARKS_TEST_SUPABASE_WORKDIR ? ['--workdir', process.env.SPARKS_TEST_SUPABASE_WORKDIR] : [])], { stdio: process.env.CI ? 'inherit' : 'ignore' });
        output = await execFileText('supabase', ['status', '--output', 'json', ...(process.env.SPARKS_TEST_SUPABASE_WORKDIR ? ['--workdir', process.env.SPARKS_TEST_SUPABASE_WORKDIR] : [])]);
    }

    const status = parseStatusJson(output);
    assertLocalUrl('API_URL', status.API_URL);
    assertLocalUrl('DB_URL', status.DB_URL);
    if (!status.SERVICE_ROLE_KEY) throw new Error('Supabase status is missing SERVICE_ROLE_KEY.');
    getBrowserSupabaseConfig(status);
    return status;
}

export function createLocalAdminClient(status) {
    return createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false
        }
    });
}

async function upsertAuthUser(admin, { email, password, metadata = {} }) {
    const { data: existing, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;

    const current = existing.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
    if (current) {
        const { data, error } = await admin.auth.admin.updateUserById(current.id, {
            password,
            email_confirm: true,
            app_metadata: { provisioned_by_teacher: true },
            user_metadata: metadata
        });
        if (error) throw error;
        return data.user;
    }

    const provisioningToken = crypto.randomUUID();
    await admin.rpc('issue_auth_user_provisioning_ticket', {
        p_email: email,
        p_token: provisioningToken
    }).throwOnError();
    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { ...metadata, provisioning_token: provisioningToken }
    });
    if (error) throw error;
    await admin.auth.admin.updateUserById(data.user.id, { user_metadata: metadata });
    return data.user;
}

function getPanamaDateValue(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

async function seedAuditUsers(admin) {
    await admin
        .from('teacher_allowlist')
        .upsert({ email: AUDIT_TEACHER_EMAIL, active: true }, { onConflict: 'email' })
        .throwOnError();

    const teacher = await upsertAuthUser(admin, {
        email: AUDIT_TEACHER_EMAIL,
        password: AUDIT_PASSWORD,
        metadata: { first_name: 'Audit', last_name: 'Teacher' }
    });
    const student = await upsertAuthUser(admin, {
        email: AUDIT_STUDENT_EMAIL,
        password: AUDIT_PASSWORD,
        metadata: { first_name: 'Audit', last_name: 'Student' }
    });

    await admin
        .from('profiles')
        .upsert([
            {
                user_id: teacher.id,
                role: 'teacher',
                first_name: 'Audit',
                last_name: 'Teacher',
                email: AUDIT_TEACHER_EMAIL,
                must_change_password: false
            },
            {
                user_id: student.id,
                role: 'student',
                first_name: 'Audit',
                last_name: 'Student',
                email: AUDIT_STUDENT_EMAIL,
                grade_level: 6,
                section_letter: 'A',
                must_change_password: false
            }
        ], { onConflict: 'user_id' })
        .throwOnError();

    await admin
        .rpc('provision_student_progress_v2', {
            p_student_id: student.id,
            p_student_profile: {
                firstName: 'Audit',
                lastName: 'Student',
                name: 'Audit Student',
                email: AUDIT_STUDENT_EMAIL,
                grade: '6',
                group: 'A'
            }
        })
        .throwOnError();

    return { teacher, student };
}

function buildAuditSparks({ teacherId }) {
    return [
        {
            id: 'audit-current-spark',
            spark_type: 'cool_fact',
            title: 'Current Audit Spark',
            spark_text: 'This Spark is visible to the audit student.',
            why_it_matters: 'Students practice connecting vocabulary to real technology ideas.',
            question: 'What technology word helped you explain an idea this week?',
            source_title: 'Local audit seed',
            source_url: '',
            subject_slug: 'technology',
            target_grades: ['6'],
            scheduled_date: process.env.UI_AUDIT_DATE || getPanamaDateValue(),
            status: 'scheduled',
            owner_id: teacherId
        },
        {
            id: 'audit-future-spark',
            spark_type: 'trivia',
            title: 'Future Audit Spark',
            spark_text: 'This Spark should stay hidden until its scheduled date arrives.',
            why_it_matters: 'Future scheduled Sparks should not appear early for students.',
            question: 'Why is scheduling useful for class routines?',
            source_title: 'Local audit seed',
            source_url: '',
            subject_slug: 'technology',
            target_grades: ['6'],
            scheduled_date: '2099-01-01',
            status: 'scheduled',
            owner_id: teacherId
        }
    ];
}

export async function seedLocalAuditData() {
    const status = await readLocalSupabaseStatus();
    const admin = createLocalAdminClient(status);
    const users = await seedAuditUsers(admin);

    const schoolId = '6b47ab0a-2026-4000-8000-000000000010';
    runLocalAuditSql(`insert into public.schools(id,name,timezone,active) values('${schoolId}','Local audit school','America/Panama',true) on conflict(id) do update set active=true,onboarding_pending=false;
      insert into public.school_memberships(school_id,user_id,active,grade,section) values('${schoolId}','${users.teacher.id}',true,null,null),('${schoolId}','${users.student.id}',true,'6','A') on conflict(school_id,user_id) do update set active=true,removed_at=null,grade=excluded.grade,section=excluded.section;
      insert into public.school_member_roles(school_id,user_id,role) values('${schoolId}','${users.teacher.id}','school_admin'),('${schoolId}','${users.teacher.id}','teacher'),('${schoolId}','${users.student.id}','student') on conflict do nothing;`);
    const client = createClient(status.API_URL, getBrowserSupabaseConfig(status).publishableKey,
        { auth: { persistSession: false, autoRefreshToken: false } });
    await client.auth.signInWithPassword({ email: AUDIT_TEACHER_EMAIL, password: AUDIT_PASSWORD }).then(({ error }) => { if (error) throw error; });
    const repo = createClassroomRepository(() => client, () => schoolId);
    await client.rpc('set_school_year_v1',{p_school_id:schoolId,p_year:2026,p_label:'2026',p_archived:false}).throwOnError();
    let subject = (await repo.listSubjects()).find(row => row.name === 'Audit Technology');
    subject ||= await repo.createSubject('Audit Technology');
    await admin.from('vocabularies').upsert({
        id: AUDIT_VOCABULARY_ID, school_id:schoolId, teacher_subject_id:subject.id,
        name: 'Cross-browser Audit Vocabulary',
        description: 'Stable local vocabulary used by authenticated browser smoke tests.',
        grades: ['6'],
        subject_slug: 'technology',
        assigned_date: '2026-08-01',
        trimester: '2',
        month: 'August',
        week: 1,
        activity_settings: {
            requiredActivities: ['flashcards'],
            additionalActivities: []
        },
        words: [
            { word: 'browser', definition: 'Software used to open and interact with websites.' },
            { word: 'storage', definition: 'A place where a device keeps information.' },
            { word: 'network', definition: 'Connected devices that exchange information.' },
            { word: 'sandbox', definition: 'An isolated environment for running code safely.' }
        ],
        owner_id: users.teacher.id,
        updated_at: new Date().toISOString()
    }, { onConflict: 'id' }).throwOnError();

    const auditSparks = buildAuditSparks({ teacherId: users.teacher.id });
    await admin
        .from('weekly_sparks')
        .upsert(auditSparks.map(spark=>({...spark,school_id:schoolId,teacher_subject_id:subject.id})), { onConflict: 'id' })
        .throwOnError();

    let classroom = (await repo.listClasses()).find(row => row.name === 'Audit 6A' && row.subject_id === subject.id);
    classroom ||= await repo.createClass({ name: 'Audit 6A', subjectId: subject.id, schoolYear: 2026 });
    if (classroom.archived) await repo.setClassArchived(classroom.id, false);
    await admin.from('class_memberships').upsert({ class_id: classroom.id, student_id: users.student.id,
        active: true, removed_at: null }, { onConflict: 'class_id,student_id' }).throwOnError();
    const assignments = [];
    for (const [index, [kind, materialId]] of [['vocabulary', AUDIT_VOCABULARY_ID], ['spark', AUDIT_SPARK_IDS[0]], ['spark', AUDIT_SPARK_IDS[1]]].entries()) {
        const published = await repo.publishMaterial({ classIds: [classroom.id], kind, materialId,
            releaseAt: index === 2 ? '2099-01-01T00:00:00Z' : '2026-01-01T00:00:00Z',
            publicationKey: `6b47ab0a-2026-4000-8000-00000000000${index + 1}` });
        assignments.push(...published);
    }
    await client.auth.signOut();
    return { status, admin, users, schoolId, subject, classroom, assignments, vocabularyAssignmentId: assignments[0].id,
        browserConfig: getBrowserSupabaseConfig(status) };
}
