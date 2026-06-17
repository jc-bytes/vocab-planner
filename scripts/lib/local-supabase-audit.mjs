import { execFile, spawn } from 'node:child_process';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

export const AUDIT_PASSWORD = 'AuditPass123!';
export const AUDIT_TEACHER_EMAIL = 'audit.teacher@aid.edu.pa';
export const AUDIT_STUDENT_EMAIL = 'audit.student@aid.edu.pa';
export const AUDIT_SPARK_IDS = [
    'audit-current-spark',
    'audit-future-spark'
];

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
    let output = '';
    try {
        output = await execFileText('supabase', ['status', '--output', 'json']);
    } catch (error) {
        if (!startIfStopped) {
            throw new Error(`Local Supabase is not reachable. Start it with "supabase start". ${error.stderr || error.message}`);
        }
        await runCommand('supabase', ['start'], { stdio: process.env.CI ? 'inherit' : 'ignore' });
        output = await execFileText('supabase', ['status', '--output', 'json']);
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
            user_metadata: metadata
        });
        if (error) throw error;
        return data.user;
    }

    const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata
    });
    if (error) throw error;
    return data.user;
}

function auditVisibleFromDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
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
        .rpc('provision_student_progress_for_account', {
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
            scheduled_date: auditVisibleFromDate(),
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
    await runCommand('supabase', ['migration', 'up', '--local'], { stdio: 'ignore' });
    const admin = createLocalAdminClient(status);
    const users = await seedAuditUsers(admin);

    const auditSparks = buildAuditSparks({ teacherId: users.teacher.id });
    await admin
        .from('weekly_sparks')
        .delete()
        .eq('subject_slug', 'technology')
        .in('id', AUDIT_SPARK_IDS)
        .throwOnError();

    await admin
        .from('weekly_sparks')
        .upsert(auditSparks, { onConflict: 'id' })
        .throwOnError();

    return {
        status,
        admin,
        users,
        browserConfig: getBrowserSupabaseConfig(status)
    };
}
