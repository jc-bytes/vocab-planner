import { execFile, spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

import { createDefaultCardSortTemplate } from '../../js/activityCardSort.js';
import { createDefaultSpreadsheetTemplate } from '../../js/activitySpreadsheetTable.js';
import { normalizeImageHotspotTemplate } from '../../js/activityImageHotspot.js';

export const AUDIT_PASSWORD = 'AuditPass123!';
export const AUDIT_TEACHER_EMAIL = 'audit.teacher@aid.edu.pa';
export const AUDIT_STUDENT_EMAIL = 'audit.student@aid.edu.pa';
export const AUDIT_ASSIGNMENT_IDS = [
    'audit-card-sort',
    'audit-spreadsheet-table',
    'audit-image-hotspot'
];

const AUDIT_IMAGE_BUCKET = 'classroom-activity-images';
const AUDIT_IMAGE_PATH = 'audit/release-hardening.webp';
const AUDIT_IMAGE_WEBP = Buffer.from(
    'UklGRjoAAABXRUJQVlA4IC4AAACQAQCdASoCAAIAAgA0JQBOgB6No3QA/sIQ9ivQIgL+1T1RXCZ2rY+z4THomAAA',
    'base64'
);

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
        await runCommand('supabase', ['start'], { stdio: 'ignore' });
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

async function findUserByEmail(admin, email) {
    const target = String(email).toLowerCase();
    let page = 1;
    while (page < 20) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const user = (data?.users || []).find(item => String(item.email || '').toLowerCase() === target);
        if (user) return user;
        if (!data?.users?.length || data.users.length < 1000) return null;
        page += 1;
    }
    throw new Error(`Could not find user ${email}; local Auth user list exceeded audit search limit.`);
}

async function ensureAuditUser(admin, { email, password, firstName, lastName }) {
    let user = await findUserByEmail(admin, email);
    const attributes = {
        email,
        password,
        email_confirm: true,
        user_metadata: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`
        }
    };

    if (!user) {
        const { data, error } = await admin.auth.admin.createUser(attributes);
        if (error) {
            const message = String(error.message || '').toLowerCase();
            if (!message.includes('already') && !message.includes('registered')) throw error;
            user = await findUserByEmail(admin, email);
        } else {
            user = data?.user;
        }
    } else {
        const { data, error } = await admin.auth.admin.updateUserById(user.id, attributes);
        if (error) throw error;
        user = data?.user || user;
    }

    if (!user?.id) throw new Error(`Could not create or update local audit user ${email}.`);
    return user;
}

function auditStudentProfile() {
    return {
        firstName: 'Audit',
        lastName: 'Student',
        name: 'Audit Student',
        email: AUDIT_STUDENT_EMAIL,
        grade: '6',
        group: 'A'
    };
}

async function seedAuditUsers(admin) {
    await admin
        .from('teacher_allowlist')
        .upsert({ email: AUDIT_TEACHER_EMAIL, active: true }, { onConflict: 'email' })
        .throwOnError();

    const teacher = await ensureAuditUser(admin, {
        email: AUDIT_TEACHER_EMAIL,
        password: AUDIT_PASSWORD,
        firstName: 'Audit',
        lastName: 'Teacher'
    });
    const student = await ensureAuditUser(admin, {
        email: AUDIT_STUDENT_EMAIL,
        password: AUDIT_PASSWORD,
        firstName: 'Audit',
        lastName: 'Student'
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
                grade_level: null,
                section_letter: null,
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
        .from('student_progress')
        .upsert({
            user_id: student.id,
            student_profile: auditStudentProfile(),
            units: {},
            coins: 0,
            coin_data: {
                balance: 0,
                giftCoins: 0,
                totalEarned: 0,
                totalSpent: 0,
                totalGifted: 0
            },
            coin_history: []
        }, { onConflict: 'user_id' })
        .throwOnError();

    return { teacher, student };
}

async function seedAuditImage(admin) {
    const { error } = await admin
        .storage
        .from(AUDIT_IMAGE_BUCKET)
        .upload(AUDIT_IMAGE_PATH, AUDIT_IMAGE_WEBP, {
            cacheControl: '3600',
            contentType: 'image/webp',
            upsert: true
        });
    if (error) throw error;
    return {
        storagePath: AUDIT_IMAGE_PATH,
        width: 1,
        height: 1,
        altText: 'Release audit image',
        sizeBytes: AUDIT_IMAGE_WEBP.length,
        uploadedAt: new Date().toISOString()
    };
}

function buildAuditAssignments({ teacherId, image }) {
    const cardSortTemplate = {
        ...createDefaultCardSortTemplate('category-sort'),
        prompt: 'Sort the audit cards.',
        helperText: 'Release audit seed data.',
        categories: [
            { id: 'hardware', title: 'Hardware', helperText: 'Physical technology.' },
            { id: 'software', title: 'Software', helperText: 'Programs and apps.' }
        ],
        cards: [
            { id: 'keyboard', text: 'Keyboard', helperText: '', expectedCategoryId: 'hardware', expectedOrder: 1 },
            { id: 'browser', text: 'Web browser', helperText: '', expectedCategoryId: 'software', expectedOrder: 1 }
        ]
    };
    const spreadsheetTemplate = {
        ...createDefaultSpreadsheetTemplate('data-table'),
        columns: [
            { id: 'item', title: 'Item', type: 'text', width: 150 },
            { id: 'value', title: 'Value', type: 'number', width: 110 }
        ],
        seedData: [['', '']],
        minRows: 1,
        maxRows: 4,
        allowAddRows: true,
        chart: { enabled: true, type: 'bar', labelColumnId: 'item', valueColumnId: 'value' },
        reflectionPrompts: [
            { id: 'pattern', prompt: 'What does the audit data show?', required: true }
        ]
    };
    const imageHotspotTemplate = normalizeImageHotspotTemplate({
        templateId: 'label-image-parts',
        image,
        labels: [
            { id: 'audit_marker', text: 'Audit marker', hint: '', required: true, color: '#2563eb' }
        ],
        minPins: 1,
        maxPins: 1,
        allowExtraPins: false,
        requireNotes: false,
        reflectionPrompts: [
            { id: 'evidence', prompt: 'What did you label?', required: true }
        ]
    });

    const base = {
        source_activity_id: null,
        description: 'Local release audit assignment.',
        subject_slug: 'technology',
        grades: ['6'],
        teacher_instructions: 'Local release audit only.',
        student_instructions: 'Complete the local release audit check.',
        materials: 'Audit seed data',
        estimated_minutes: 5,
        student_output: 'Submitted audit response.',
        makeup_instructions: '',
        assessment_purpose: 'formative',
        target_grades: ['6'],
        target_sections: ['A'],
        available_from: new Date().toISOString().slice(0, 10),
        due_date: null,
        week_label: 'Local release audit',
        status: 'active',
        assigned_by: teacherId
    };

    return [
        {
            ...base,
            id: 'audit-card-sort',
            title: 'Audit Card Sort',
            activity_type: 'card-sort',
            activity_data: {
                templateId: 'category-sort',
                cardSortTemplate
            }
        },
        {
            ...base,
            id: 'audit-spreadsheet-table',
            title: 'Audit Spreadsheet Table',
            activity_type: 'spreadsheet-table',
            activity_data: {
                templateId: 'data-table',
                spreadsheetTemplate
            }
        },
        {
            ...base,
            id: 'audit-image-hotspot',
            title: 'Audit Image Hotspot',
            activity_type: 'image-hotspot',
            activity_data: {
                templateId: 'label-image-parts',
                imageHotspotTemplate
            }
        }
    ];
}

export async function resetAuditSubmissions(admin) {
    await admin
        .from('classroom_activity_submissions')
        .delete()
        .in('assignment_id', AUDIT_ASSIGNMENT_IDS)
        .throwOnError();
}

export async function seedLocalAuditData({ resetSubmissions = false } = {}) {
    const status = await readLocalSupabaseStatus();
    const admin = createLocalAdminClient(status);
    const users = await seedAuditUsers(admin);
    const image = await seedAuditImage(admin);

    await admin
        .from('classroom_activity_assignments')
        .upsert(buildAuditAssignments({ teacherId: users.teacher.id, image }), { onConflict: 'id' })
        .throwOnError();

    if (resetSubmissions) await resetAuditSubmissions(admin);

    return {
        status,
        admin,
        browserConfig: getBrowserSupabaseConfig(status),
        users,
        assignmentIds: [...AUDIT_ASSIGNMENT_IDS]
    };
}
