import { createSupabaseClient, isSupabaseConfigured } from './services/supabaseClient.js';

const TABLE_ALIASES = {
    appSettings: 'app_settings',
    classroomActivityAssignments: 'classroom_activity_assignments',
    classroomActivitySubmissions: 'classroom_activity_submissions',
    classroomActivities: 'classroom_activities',
    exportLogs: 'export_logs',
    studentProgress: 'student_progress',
    userRoles: 'profiles'
};

const PRIMARY_KEYS = {
    app_settings: 'key',
    classroom_activity_assignments: 'id',
    classroom_activity_submissions: 'id',
    classroom_activities: 'id',
    export_logs: 'id',
    profiles: 'user_id',
    scores: 'id',
    student_progress: 'user_id',
    subjects: 'slug',
    vocabularies: 'id'
};

const FIELD_ALIASES = {
    app_settings: {
        updatedAt: 'updated_at'
    },
    classroom_activities: {
        activityData: 'activity_data',
        activityType: 'activity_type',
        assessmentPurpose: 'assessment_purpose',
        estimatedMinutes: 'estimated_minutes',
        makeupInstructions: 'makeup_instructions',
        ownerId: 'owner_id',
        studentInstructions: 'student_instructions',
        studentOutput: 'student_output',
        subjectSlug: 'subject_slug',
        teacherInstructions: 'teacher_instructions',
        updatedAt: 'updated_at'
    },
    classroom_activity_assignments: {
        activityData: 'activity_data',
        activityType: 'activity_type',
        assignedBy: 'assigned_by',
        assessmentPurpose: 'assessment_purpose',
        availableFrom: 'available_from',
        dueDate: 'due_date',
        estimatedMinutes: 'estimated_minutes',
        makeupInstructions: 'makeup_instructions',
        sourceActivityId: 'source_activity_id',
        studentInstructions: 'student_instructions',
        studentOutput: 'student_output',
        subjectSlug: 'subject_slug',
        targetGrades: 'target_grades',
        targetSections: 'target_sections',
        teacherInstructions: 'teacher_instructions',
        updatedAt: 'updated_at',
        weekLabel: 'week_label'
    },
    classroom_activity_submissions: {
        assignmentId: 'assignment_id',
        lateOverride: 'late_override',
        lateOverrideAt: 'late_override_at',
        lateOverrideBy: 'late_override_by',
        lateOverrideReason: 'late_override_reason',
        responseData: 'response_data',
        responseDataStoragePath: 'response_data_storage_path',
        responseDataStorageSizeBytes: 'response_data_storage_size_bytes',
        responseDataStorageUpdatedAt: 'response_data_storage_updated_at',
        startedAt: 'started_at',
        studentId: 'student_id',
        studentProfile: 'student_profile',
        submittedAt: 'submitted_at',
        updatedAt: 'updated_at'
    },
    export_logs: {
        dataTypes: 'data_types',
        studentCount: 'student_count',
        teacherId: 'teacher_id'
    },
    profiles: {
        firstName: 'first_name',
        lastName: 'last_name',
        grade: 'grade_level',
        gradeLevel: 'grade_level',
        group: 'section_letter',
        sectionLetter: 'section_letter',
        mustChangePassword: 'must_change_password',
        updatedAt: 'updated_at',
        userId: 'user_id'
    },
    scores: {
        gameId: 'game_id',
        grade: 'grade_level',
        userId: 'user_id',
        updatedAt: 'updated_at'
    },
    student_progress: {
        coinData: 'coin_data',
        coinHistory: 'coin_history',
        studentProfile: 'student_profile',
        updatedAt: 'updated_at',
        userId: 'user_id'
    },
    subjects: {
        sortOrder: 'sort_order',
        updatedAt: 'updated_at'
    },
    vocabularies: {
        activitySettings: 'activity_settings',
        assignedDate: 'assigned_date',
        ownerId: 'owner_id',
        subjectSlug: 'subject_slug',
        updatedAt: 'updated_at'
    }
};

const DEFAULT_COIN_DATA = {
    balance: 0,
    giftCoins: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalGifted: 0
};

export const WORD_HUNT_IMAGE_BUCKET = 'word-hunt-images';
export const CLASSROOM_SCENE_BUCKET = 'classroom-activity-scenes';
export const CLASSROOM_SCENE_MAX_BYTES = 1024 * 1024;
export const CLASSROOM_ACTIVITY_IMAGE_BUCKET = 'classroom-activity-images';
export const CLASSROOM_ACTIVITY_IMAGE_MAX_BYTES = 1024 * 1024;
export const EXTERNAL_ARTIFACT_BUCKET = 'classroom-activity-artifacts';
export const EXTERNAL_ARTIFACT_MAX_BYTES = 5 * 1024 * 1024;
export const EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
];

const resolveTable = (collectionName) => TABLE_ALIASES[collectionName] || collectionName;

const primaryKeyFor = (tableName) => PRIMARY_KEYS[tableName] || 'id';

const toDatabaseField = (tableName, field) => {
    return FIELD_ALIASES[tableName]?.[field] || field;
};

const toDatabaseValue = (field, value) => {
    if (field === 'grade_level') {
        return parseGrade(value);
    }
    if (field === 'section_letter') {
        return normalizeSection(value);
    }
    return value;
};

const cleanUndefined = (object) => {
    return Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined)
    );
};

const parseGrade = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : null;
};

const normalizeSection = (value) => {
    if (!value) return null;
    const section = String(value).trim().toUpperCase();
    return /^[A-Z]$/.test(section) ? section : null;
};

const normalizeTextArray = (value, { uppercase = false } = {}) => {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const items = source
        .flatMap(item => {
            if (item === null || item === undefined) return [];
            return String(item).split(',');
        })
        .map(item => {
            const text = item.trim();
            return uppercase ? text.toUpperCase() : text;
        })
        .filter(Boolean);
    return Array.from(new Set(items));
};

const toTimestamp = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && value.seconds !== undefined) return value;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => date
    };
};

const timestampToIso = (value) => {
    if (!value) return new Date().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value.seconds !== undefined) return new Date(value.seconds * 1000).toISOString();
    return new Date().toISOString();
};

const normalizeProfile = (profile = {}) => {
    const firstName = String(profile.firstName || profile.first_name || '').trim();
    const lastName = String(profile.lastName || profile.last_name || '').trim();
    const grade = profile.grade ?? profile.gradeLevel ?? profile.grade_level ?? '';
    const group = profile.group ?? profile.sectionLetter ?? profile.section_letter ?? '';
    return {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email: String(profile.email || '').trim().toLowerCase(),
        grade: grade === null || grade === undefined ? '' : String(grade),
        group: group ? String(group).trim().toUpperCase() : ''
    };
};

const normalizeUser = (user) => {
    if (!user) return null;
    return {
        ...user,
        uid: user.id,
        displayName: user.user_metadata?.full_name ||
            [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') ||
            user.email,
        photoURL: user.user_metadata?.avatar_url || ''
    };
};

export const slugifyStoragePart = (value, fallback = 'item') => {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
};

export const getCurrentSchoolYear = (date = new Date()) => {
    return String(date.getFullYear());
};

const toClientRow = (tableName, row) => {
    if (!row) return null;

    if (tableName === 'profiles') {
        const grade = row.grade_level === null || row.grade_level === undefined ? '' : String(row.grade_level);
        const group = row.section_letter || '';
        return {
            id: row.user_id,
            userId: row.user_id,
            role: row.role || 'student',
            email: row.email || '',
            firstName: row.first_name || '',
            lastName: row.last_name || '',
            name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            grade,
            group,
            gradeLevel: row.grade_level,
            sectionLetter: group,
            mustChangePassword: Boolean(row.must_change_password),
            must_change_password: Boolean(row.must_change_password),
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'student_progress') {
        const studentProfile = normalizeProfile(row.student_profile || {});
        return {
            id: row.user_id,
            userId: row.user_id,
            studentProfile,
            units: row.units || {},
            coins: row.coins ?? row.coin_data?.balance ?? 0,
            coinData: row.coin_data || { ...DEFAULT_COIN_DATA },
            coinHistory: row.coin_history || [],
            email: studentProfile.email || '',
            role: 'student',
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'vocabularies') {
        return {
            id: row.id,
            name: row.name || '',
            description: row.description || '',
            grades: row.grades || [],
            subjectSlug: row.subject_slug || 'technology',
            assignedDate: row.assigned_date || '',
            trimester: row.trimester || '',
            month: row.month || '',
            week: row.week || '',
            activitySettings: row.activity_settings || {},
            words: row.words || [],
            ownerId: row.owner_id || null,
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'classroom_activities') {
        return {
            id: row.id,
            title: row.title || '',
            description: row.description || '',
            activityType: row.activity_type || 'map-diagram',
            subjectSlug: row.subject_slug || 'technology',
            grades: row.grades || [],
            teacherInstructions: row.teacher_instructions || '',
            studentInstructions: row.student_instructions || '',
            materials: row.materials || '',
            estimatedMinutes: row.estimated_minutes ?? '',
            studentOutput: row.student_output || '',
            makeupInstructions: row.makeup_instructions || '',
            assessmentPurpose: row.assessment_purpose || 'formative',
            activityData: row.activity_data || {},
            ownerId: row.owner_id || null,
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'classroom_activity_assignments') {
        return {
            id: row.id,
            sourceActivityId: row.source_activity_id || '',
            title: row.title || '',
            description: row.description || '',
            activityType: row.activity_type || 'map-diagram',
            subjectSlug: row.subject_slug || 'technology',
            grades: row.grades || [],
            teacherInstructions: row.teacher_instructions || '',
            studentInstructions: row.student_instructions || '',
            materials: row.materials || '',
            estimatedMinutes: row.estimated_minutes ?? '',
            studentOutput: row.student_output || '',
            makeupInstructions: row.makeup_instructions || '',
            assessmentPurpose: row.assessment_purpose || 'formative',
            activityData: row.activity_data || {},
            targetGrades: row.target_grades || [],
            targetSections: row.target_sections || [],
            availableFrom: row.available_from || '',
            dueDate: row.due_date || '',
            weekLabel: row.week_label || '',
            status: row.status || 'active',
            assignedBy: row.assigned_by || null,
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'classroom_activity_submissions') {
        return {
            id: row.id,
            assignmentId: row.assignment_id || '',
            studentId: row.student_id || '',
            studentProfile: normalizeProfile(row.student_profile || {}),
            status: row.status || 'draft',
            responseData: row.response_data || {},
            responseDataStoragePath: row.response_data_storage_path || '',
            responseDataStorageSizeBytes: row.response_data_storage_size_bytes ?? null,
            responseDataStorageUpdatedAt: toTimestamp(row.response_data_storage_updated_at),
            startedAt: toTimestamp(row.started_at),
            submittedAt: toTimestamp(row.submitted_at),
            lateOverride: Boolean(row.late_override),
            lateOverrideReason: row.late_override_reason || '',
            lateOverrideBy: row.late_override_by || null,
            lateOverrideAt: toTimestamp(row.late_override_at),
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'subjects') {
        return {
            id: row.slug,
            slug: row.slug,
            name: row.name || '',
            color: row.color || '#2563eb',
            sortOrder: Number(row.sort_order) || 0,
            active: row.active !== false,
            createdAt: toTimestamp(row.created_at),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'scores') {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name || '',
            grade: row.grade_level === null || row.grade_level === undefined ? '' : String(row.grade_level),
            gameId: row.game_id,
            score: Number(row.score) || 0,
            metadata: row.metadata || {},
            timestamp: toTimestamp(row.timestamp),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'app_settings') {
        return {
            id: row.key,
            key: row.key,
            ...(row.value || {}),
            updatedAt: toTimestamp(row.updated_at)
        };
    }

    if (tableName === 'export_logs') {
        return {
            id: row.id,
            teacherId: row.teacher_id,
            dataTypes: row.data_types || [],
            studentCount: row.student_count || 0,
            format: row.format || 'json',
            filename: row.filename || '',
            metadata: row.metadata || {},
            timestamp: toTimestamp(row.timestamp)
        };
    }

    return row;
};

const fromClientPayload = (tableName, payload = {}, id = null) => {
    if (tableName === 'profiles') {
        const profile = normalizeProfile(payload);
        return cleanUndefined({
            user_id: id || payload.userId || payload.user_id,
            role: payload.role || 'student',
            first_name: profile.firstName,
            last_name: profile.lastName,
            email: profile.email || payload.email,
            grade_level: parseGrade(profile.grade),
            section_letter: normalizeSection(profile.group),
            must_change_password: payload.mustChangePassword ?? payload.must_change_password,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'student_progress') {
        return cleanUndefined({
            user_id: id || payload.userId || payload.user_id,
            student_profile: payload.studentProfile ? normalizeProfile(payload.studentProfile) : undefined,
            units: payload.units,
            coins: payload.coins,
            coin_data: payload.coinData,
            coin_history: payload.coinHistory,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'vocabularies') {
        return cleanUndefined({
            id: id || payload.id,
            name: payload.name,
            description: payload.description,
            grades: Array.isArray(payload.grades)
                ? payload.grades.map(String)
                : payload.grade
                    ? [String(payload.grade)]
                    : undefined,
            subject_slug: payload.subjectSlug || payload.subject_slug || payload.subject || 'technology',
            assigned_date: (payload.assignedDate ?? payload.assigned_date) === ''
                ? null
                : payload.assignedDate ?? payload.assigned_date,
            trimester: payload.trimester ?? undefined,
            month: payload.month ?? undefined,
            week: payload.week === '' || payload.week === null || payload.week === undefined
                ? null
                : Number.parseInt(String(payload.week), 10),
            activity_settings: payload.activitySettings,
            words: payload.words,
            owner_id: payload.ownerId,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'classroom_activities') {
        const estimatedMinutes = payload.estimatedMinutes ?? payload.estimated_minutes;
        const parsedEstimatedMinutes = Number.parseInt(String(estimatedMinutes), 10);
        return cleanUndefined({
            id: id || payload.id,
            title: payload.title,
            description: payload.description,
            activity_type: payload.activityType || payload.activity_type || 'map-diagram',
            subject_slug: payload.subjectSlug || payload.subject_slug || payload.subject || 'technology',
            grades: Array.isArray(payload.grades)
                ? payload.grades.map(String)
                : payload.grade
                    ? [String(payload.grade)]
                    : undefined,
            teacher_instructions: payload.teacherInstructions ?? payload.teacher_instructions,
            student_instructions: payload.studentInstructions ?? payload.student_instructions,
            materials: payload.materials,
            estimated_minutes: estimatedMinutes === '' || estimatedMinutes === null || estimatedMinutes === undefined
                ? null
                : Number.isInteger(parsedEstimatedMinutes)
                    ? parsedEstimatedMinutes
                    : null,
            student_output: payload.studentOutput ?? payload.student_output,
            makeup_instructions: payload.makeupInstructions ?? payload.makeup_instructions,
            assessment_purpose: payload.assessmentPurpose || payload.assessment_purpose || 'formative',
            activity_data: payload.activityData || payload.activity_data || {},
            owner_id: payload.ownerId || payload.owner_id || null,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'classroom_activity_assignments') {
        const estimatedMinutes = payload.estimatedMinutes ?? payload.estimated_minutes;
        const parsedEstimatedMinutes = Number.parseInt(String(estimatedMinutes), 10);
        const targetGrades = payload.targetGrades ?? payload.target_grades;
        const targetSections = payload.targetSections ?? payload.target_sections;

        return cleanUndefined({
            id: id || payload.id,
            source_activity_id: payload.sourceActivityId || payload.source_activity_id || null,
            title: payload.title,
            description: payload.description,
            activity_type: payload.activityType || payload.activity_type || 'map-diagram',
            subject_slug: payload.subjectSlug || payload.subject_slug || payload.subject || 'technology',
            grades: normalizeTextArray(payload.grades ?? payload.grade),
            teacher_instructions: payload.teacherInstructions ?? payload.teacher_instructions,
            student_instructions: payload.studentInstructions ?? payload.student_instructions,
            materials: payload.materials,
            estimated_minutes: estimatedMinutes === '' || estimatedMinutes === null || estimatedMinutes === undefined
                ? null
                : Number.isInteger(parsedEstimatedMinutes)
                    ? parsedEstimatedMinutes
                    : null,
            student_output: payload.studentOutput ?? payload.student_output,
            makeup_instructions: payload.makeupInstructions ?? payload.makeup_instructions,
            assessment_purpose: payload.assessmentPurpose || payload.assessment_purpose || 'formative',
            activity_data: payload.activityData || payload.activity_data || {},
            target_grades: normalizeTextArray(targetGrades),
            target_sections: normalizeTextArray(targetSections, { uppercase: true }),
            available_from: payload.availableFrom || payload.available_from || null,
            due_date: payload.dueDate || payload.due_date || null,
            week_label: payload.weekLabel || payload.week_label || '',
            status: payload.status || 'active',
            assigned_by: payload.assignedBy || payload.assigned_by || null,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'classroom_activity_submissions') {
        return cleanUndefined({
            id: id || payload.id,
            assignment_id: payload.assignmentId || payload.assignment_id,
            student_id: payload.studentId || payload.student_id,
            student_profile: payload.studentProfile ? normalizeProfile(payload.studentProfile) : payload.student_profile,
            status: payload.status || 'draft',
            response_data: payload.responseData || payload.response_data || {},
            response_data_storage_path: payload.responseDataStoragePath ?? payload.response_data_storage_path,
            response_data_storage_size_bytes: payload.responseDataStorageSizeBytes ?? payload.response_data_storage_size_bytes,
            response_data_storage_updated_at: payload.responseDataStorageUpdatedAt || payload.response_data_storage_updated_at
                ? timestampToIso(payload.responseDataStorageUpdatedAt || payload.response_data_storage_updated_at)
                : undefined,
            started_at: payload.startedAt ? timestampToIso(payload.startedAt) : undefined,
            submitted_at: payload.submittedAt === null || payload.submitted_at === null
                ? null
                : payload.submittedAt || payload.submitted_at
                    ? timestampToIso(payload.submittedAt || payload.submitted_at)
                    : undefined,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'subjects') {
        return cleanUndefined({
            slug: id || payload.slug || payload.id,
            name: payload.name,
            color: payload.color,
            sort_order: payload.sortOrder ?? payload.sort_order,
            active: payload.active,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'scores') {
        return cleanUndefined({
            id: id || payload.id,
            user_id: payload.userId || payload.user_id,
            name: payload.name,
            grade_level: parseGrade(payload.grade ?? payload.gradeLevel ?? payload.grade_level),
            game_id: payload.gameId || payload.game_id,
            score: payload.score,
            metadata: payload.metadata,
            timestamp: payload.timestamp ? timestampToIso(payload.timestamp) : undefined,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'app_settings') {
        const {
            id: _id,
            key: _key,
            updatedAt: _updatedAt,
            createdAt: _createdAt,
            ...value
        } = payload;
        return cleanUndefined({
            key: id || payload.key || payload.id,
            value,
            updated_at: payload.updatedAt ? timestampToIso(payload.updatedAt) : undefined
        });
    }

    if (tableName === 'export_logs') {
        return cleanUndefined({
            teacher_id: payload.teacherId || payload.teacher_id || null,
            data_types: payload.dataTypes || payload.data_types || [],
            student_count: payload.studentCount || payload.student_count || 0,
            format: payload.format || 'json',
            filename: payload.filename || '',
            metadata: payload.metadata || {},
            timestamp: payload.timestamp ? timestampToIso(payload.timestamp) : new Date().toISOString()
        });
    }

    return { ...(id ? { id } : {}), ...payload };
};

const snapshotFromRow = (tableName, row) => {
    const clientRow = toClientRow(tableName, row);
    return {
        id: clientRow?.id || row?.[primaryKeyFor(tableName)],
        exists: () => Boolean(row),
        data: () => clientRow || {}
    };
};

const applyConstraints = (builder, tableName, constraints = []) => {
    let currentBuilder = builder;

    constraints.forEach((constraint) => {
        if (constraint.kind === 'where') {
            const field = toDatabaseField(tableName, constraint.field);
            if (constraint.operator === '==') {
                currentBuilder = currentBuilder.eq(field, toDatabaseValue(field, constraint.value));
            }
        }

        if (constraint.kind === 'orderBy') {
            const field = toDatabaseField(tableName, constraint.field);
            currentBuilder = currentBuilder.order(field, {
                ascending: constraint.direction !== 'desc'
            });
        }

        if (constraint.kind === 'limit') {
            currentBuilder = currentBuilder.limit(constraint.count);
        }
    });

    return currentBuilder;
};

export const supabaseService = {
    client: null,
    currentUser: null,
    currentSession: null,

    async init() {
        if (this.client) return this;

        if (!isSupabaseConfigured()) {
            throw new Error('Supabase is not configured. Update config/supabase-config.js with your project URL and publishable key.');
        }

        this.client = createSupabaseClient();

        const { data } = await this.client.auth.getSession();
        this.currentSession = data.session || null;
        this.currentUser = normalizeUser(this.currentSession?.user || null);
        return this;
    },

    getDatabase() {
        if (!this.client) {
            throw new Error('Supabase client has not been initialized.');
        }
        return { kind: 'supabase' };
    },

    getClient() {
        if (!this.client) {
            throw new Error('Supabase client has not been initialized.');
        }
        return this.client;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    getCurrentSession() {
        return this.currentSession;
    },

    async signInWithPassword(email, password) {
        await this.init();
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.currentSession = data.session || null;
        this.currentUser = normalizeUser(data.user);
        return { ...data, user: this.currentUser };
    },

    async signUpStudent(profile, password) {
        await this.init();
        const normalized = normalizeProfile(profile);
        const { data, error } = await this.client.auth.signUp({
            email: normalized.email,
            password,
            options: {
                data: {
                    first_name: normalized.firstName,
                    last_name: normalized.lastName,
                    full_name: normalized.name
                }
            }
        });

        if (error) throw error;

        if (!data.session) {
            const { data: loginData, error: loginError } = await this.client.auth.signInWithPassword({
                email: normalized.email,
                password
            });

            if (loginError) {
                const message = loginError.message || '';
                if (message.toLowerCase().includes('email not confirmed')) {
                    throw new Error('This email was registered while confirmation was still required. Confirm or delete that user in Supabase Auth, then try again.');
                }
                throw new Error(`Account created, but no session was returned. Try logging in instead. ${message}`);
            }

            this.currentSession = loginData.session || null;
            this.currentUser = normalizeUser(loginData.user);
        } else {
            this.currentSession = data.session || null;
            this.currentUser = normalizeUser(data.user);
        }

        await this.upsertStudentProfile(this.currentUser.uid, normalized);
        await this.ensureStudentProgress(this.currentUser.uid, normalized);
        return { ...data, user: this.currentUser };
    },

    async signUpTeacher(email, password) {
        await this.init();
        const { data, error } = await this.client.auth.signUp({ email, password });
        if (error) throw error;

        if (!data.session) {
            const { data: loginData, error: loginError } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (loginError) {
                const message = loginError.message || '';
                if (message.toLowerCase().includes('email not confirmed')) {
                    throw new Error('This teacher email was registered while confirmation was still required. Confirm or delete that user in Supabase Auth, then try again.');
                }
                throw new Error(`Teacher account created, but no session was returned. Try logging in instead. ${message}`);
            }

            this.currentSession = loginData.session || null;
            this.currentUser = normalizeUser(loginData.user);
        } else {
            this.currentSession = data.session || null;
            this.currentUser = normalizeUser(data.user);
        }

        const profile = await this.getProfile(this.currentUser.uid);
        if (profile?.role !== 'teacher') {
            await this.signOut();
            throw new Error('This email is not in teacher_allowlist. Add it there before using teacher tools.');
        }
        return { ...data, user: this.currentUser };
    },

    async upsertStudentProfile(userId, profile) {
        await this.init();
        const normalized = normalizeProfile(profile);
        const payload = fromClientPayload('profiles', {
            ...normalized,
            role: 'student'
        }, userId);

        const { error } = await this.client
            .from('profiles')
            .upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;
    },

    async updateStudentProfile(profile) {
        await this.init();
        if (!this.currentUser) throw new Error('You must be signed in to update your profile.');
        await this.upsertStudentProfile(this.currentUser.uid, {
            ...profile,
            email: this.currentUser.email || profile.email
        });
    },

    async ensureStudentProgress(userId, profile = {}) {
        await this.init();
        const payload = fromClientPayload('student_progress', {
            studentProfile: normalizeProfile(profile),
            coinData: { ...DEFAULT_COIN_DATA },
            coinHistory: [],
            coins: 0,
            units: {}
        }, userId);

        const { error } = await this.client
            .from('student_progress')
            .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: false });
        if (error) throw error;
    },

    async getProfile(userId = null) {
        await this.init();
        const id = userId || this.currentUser?.uid;
        if (!id) return null;

        const { data, error } = await this.client
            .from('profiles')
            .select('*')
            .eq('user_id', id)
            .maybeSingle();
        if (error) throw error;
        return toClientRow('profiles', data);
    },

    async getStudentsWithProgress() {
        await this.init();
        const [{ data: profiles, error: profilesError }, { data: progressRows, error: progressError }] =
            await Promise.all([
                this.client
                    .from('profiles')
                    .select('*')
                    .eq('role', 'student')
                    .order('grade_level', { ascending: true })
                    .order('section_letter', { ascending: true })
                    .order('last_name', { ascending: true }),
                this.client
                    .from('student_progress')
                    .select('*')
            ]);

        if (profilesError) throw profilesError;
        if (progressError) throw progressError;

        const progressByUserId = new Map(
            (progressRows || []).map((row) => [row.user_id, toClientRow('student_progress', row)])
        );

        return (profiles || []).map((profileRow) => {
            const profile = toClientRow('profiles', profileRow);
            const progress = progressByUserId.get(profile.userId) || {
                id: profile.userId,
                userId: profile.userId,
                studentProfile: {},
                units: {},
                coins: 0,
                coinData: { ...DEFAULT_COIN_DATA },
                coinHistory: [],
                updatedAt: profile.updatedAt
            };

            const studentProfile = {
                firstName: profile.firstName,
                lastName: profile.lastName,
                name: profile.name,
                email: profile.email,
                grade: profile.grade,
                group: profile.group
            };

            return {
                ...progress,
                id: profile.userId,
                email: profile.email,
                role: profile.role,
                mustChangePassword: profile.mustChangePassword,
                studentProfile: {
                    ...studentProfile,
                    ...(progress.studentProfile || {})
                },
                updatedAt: progress.updatedAt || profile.updatedAt
            };
        });
    },

    async updatePasswordAndClearFlag(password) {
        await this.init();
        if (!this.currentUser) throw new Error('You must be signed in to change your password.');

        const { error: passwordError } = await this.client.auth.updateUser({ password });
        if (passwordError) throw passwordError;

        const { error: profileError } = await this.client
            .from('profiles')
            .update({ must_change_password: false })
            .eq('user_id', this.currentUser.uid);
        if (profileError) throw profileError;
    },

    async resetStudentPassword(userId) {
        await this.init();
        const { data, error } = await this.client.functions.invoke('reset-student-password', {
            body: { userId }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    },

    buildWordHuntImagePath({
        userId = this.currentUser?.uid,
        schoolYear = getCurrentSchoolYear(),
        trimesterKey = 'other',
        grade = 'unknown',
        unitId = 'unit',
        subjectSlug = 'technology',
        word = 'word'
    } = {}) {
        if (!userId) {
            throw new Error('A signed-in student is required to save Word Hunt images.');
        }

        return [
            userId,
            slugifyStoragePart(schoolYear, 'year'),
            slugifyStoragePart(trimesterKey, 'trimester'),
            `subject-${slugifyStoragePart(subjectSlug, 'technology')}`,
            `grade-${slugifyStoragePart(grade, 'unknown')}`,
            slugifyStoragePart(unitId, 'unit'),
            `${slugifyStoragePart(word, 'word')}.webp`
        ].join('/');
    },

    buildClassroomScenePath({
        studentId = this.currentUser?.uid,
        assignmentId = 'assignment',
        submissionId = 'submission'
    } = {}) {
        if (!studentId) {
            throw new Error('A signed-in student is required to save classroom activity scenes.');
        }

        return [
            studentId,
            'classroom-activities',
            slugifyStoragePart(assignmentId, 'assignment'),
            `${slugifyStoragePart(submissionId, 'submission')}.json`
        ].join('/');
    },

    buildClassroomActivityImagePath({
        teacherId = this.currentUser?.uid,
        activityId = 'activity',
        fileName = 'image'
    } = {}) {
        if (!teacherId) {
            throw new Error('A signed-in teacher is required to save classroom activity images.');
        }

        const baseName = String(fileName || 'image')
            .replace(/\.[^.]+$/, '')
            .trim() || 'image';

        return [
            teacherId,
            'classroom-activity-images',
            slugifyStoragePart(activityId, 'activity'),
            `${Date.now()}-${slugifyStoragePart(baseName, 'image')}.webp`
        ].join('/');
    },

    buildExternalArtifactPath({
        studentId = this.currentUser?.uid,
        assignmentId = 'assignment',
        submissionId = 'submission',
        fileName = 'artifact'
    } = {}) {
        if (!studentId) {
            throw new Error('A signed-in student is required to upload classroom evidence.');
        }

        const name = String(fileName || 'artifact').trim() || 'artifact';
        const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
        const baseName = name.replace(/\.[^.]+$/, '') || 'artifact';
        const safeExtension = ['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(extension) ? extension : 'bin';

        return [
            studentId,
            slugifyStoragePart(assignmentId, 'assignment'),
            slugifyStoragePart(submissionId, 'submission'),
            `${Date.now()}-${slugifyStoragePart(baseName, 'artifact')}.${safeExtension}`
        ].join('/');
    },

    serializeClassroomScene(scene) {
        const text = JSON.stringify(scene || null);
        const blob = new Blob([text], { type: 'application/json' });
        if (blob.size > CLASSROOM_SCENE_MAX_BYTES) {
            throw new Error('Classroom activity scenes must be under 1 MB.');
        }
        return { blob, sizeBytes: blob.size };
    },

    async uploadClassroomScene({ path, scene }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload classroom activity scenes.');
        }
        if (!path) {
            throw new Error('A Storage path is required for classroom activity scene upload.');
        }

        const { blob, sizeBytes } = this.serializeClassroomScene(scene);
        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_SCENE_BUCKET)
            .upload(path, blob, {
                cacheControl: '3600',
                contentType: 'application/json',
                upsert: true
            });

        if (error) throw error;
        return {
            path: data?.path || path,
            sizeBytes,
            updatedAt: new Date().toISOString()
        };
    },

    async downloadClassroomScene(path) {
        await this.init();
        if (!path) return null;

        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_SCENE_BUCKET)
            .download(path);

        if (error) {
            const message = String(error.message || '').toLowerCase();
            if (error.statusCode === 404 || message.includes('not found')) {
                return null;
            }
            throw error;
        }

        const text = await data.text();
        return text ? JSON.parse(text) : null;
    },

    async deleteClassroomScene(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(CLASSROOM_SCENE_BUCKET)
            .remove([path]);

        if (error) throw error;
    },

    async uploadClassroomActivityImage({ path, blob }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload classroom activity images.');
        }
        if (!path) {
            throw new Error('A Storage path is required for classroom activity image upload.');
        }
        if (!blob || blob.size > CLASSROOM_ACTIVITY_IMAGE_MAX_BYTES) {
            throw new Error('Classroom activity images must be WebP files under 1 MB.');
        }

        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_ACTIVITY_IMAGE_BUCKET)
            .upload(path, blob, {
                cacheControl: '3600',
                contentType: 'image/webp',
                upsert: true
            });

        if (error) throw error;
        return {
            path: data?.path || path,
            sizeBytes: blob.size,
            updatedAt: new Date().toISOString()
        };
    },

    async getClassroomActivityImageUrl(path, expiresIn = 60 * 60) {
        await this.init();
        if (!path) return '';

        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_ACTIVITY_IMAGE_BUCKET)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;
        return data?.signedUrl || data?.signedURL || '';
    },

    async deleteClassroomActivityImage(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(CLASSROOM_ACTIVITY_IMAGE_BUCKET)
            .remove([path]);

        if (error) throw error;
    },

    async uploadExternalArtifact({ path, file }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload classroom evidence.');
        }
        if (!path) {
            throw new Error('A Storage path is required for classroom evidence upload.');
        }
        if (!file || file.size > EXTERNAL_ARTIFACT_MAX_BYTES) {
            throw new Error('Evidence files must be 5 MB or smaller.');
        }
        const mimeType = String(file.type || '').toLowerCase();
        if (!EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new Error('Evidence must be a PNG, JPG, WebP, or PDF file.');
        }

        const { data, error } = await this.client
            .storage
            .from(EXTERNAL_ARTIFACT_BUCKET)
            .upload(path, file, {
                cacheControl: '3600',
                contentType: mimeType,
                upsert: true
            });

        if (error) throw error;
        return {
            storagePath: data?.path || path,
            fileName: file.name || 'Uploaded artifact',
            mimeType,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString()
        };
    },

    async getExternalArtifactUrl(path, expiresIn = 60 * 60) {
        await this.init();
        if (!path) return '';

        const { data, error } = await this.client
            .storage
            .from(EXTERNAL_ARTIFACT_BUCKET)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;
        return data?.signedUrl || data?.signedURL || '';
    },

    async deleteExternalArtifact(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(EXTERNAL_ARTIFACT_BUCKET)
            .remove([path]);

        if (error) throw error;
    },

    async uploadWordHuntImage({ path, blob }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload a Word Hunt image.');
        }
        if (!path) {
            throw new Error('A Storage path is required for Word Hunt image upload.');
        }
        if (!blob || blob.size > 65536) {
            throw new Error('Word Hunt images must be WebP thumbnails under 64 KB.');
        }

        const { data, error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .upload(path, blob, {
                cacheControl: '3600',
                contentType: 'image/webp',
                upsert: true
            });

        if (error) throw error;
        return data?.path || path;
    },

    async downloadWordHuntImage(path) {
        await this.init();
        if (!path) return null;

        const { data, error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .download(path);

        if (error) {
            const message = String(error.message || '').toLowerCase();
            if (error.statusCode === 404 || message.includes('not found')) {
                return null;
            }
            throw error;
        }

        return data;
    },

    async deleteWordHuntImage(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .remove([path]);

        if (error) throw error;
    },

    subscribeToStudentProgress(userId, callback) {
        if (!this.client || !userId || typeof callback !== 'function') return () => {};

        const channel = this.client
            .channel(`student-progress-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'student_progress',
                    filter: `user_id=eq.${userId}`
                },
                payload => {
                    if (!payload?.new) return;
                    callback(toClientRow('student_progress', payload.new));
                }
            )
            .subscribe(status => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn(`Student progress realtime status: ${status}`);
                }
            });

        return () => {
            this.client.removeChannel(channel);
        };
    },

    async signOut() {
        await this.init();
        await this.client.auth.signOut({ scope: 'local' });
        this.currentSession = null;
        this.currentUser = null;
    },

    onAuthStateChanged(callback) {
        if (!this.client) {
            throw new Error('Supabase client has not been initialized.');
        }

        const { data } = this.client.auth.onAuthStateChange((event, session) => {
            this.currentSession = session || null;
            this.currentUser = normalizeUser(session?.user || null);
            setTimeout(() => callback(this.currentUser, event, this.currentSession), 0);
        });

        return () => data.subscription.unsubscribe();
    },

    isEmailSignInLink() {
        return false;
    },

    async completeEmailSignIn() {
        throw new Error('Email link sign-in is not enabled for this build.');
    },

    async sendEmailSignInLink() {
        throw new Error('Email link sign-in is not enabled for this build.');
    },

    async handleRedirectResult() {
        return null;
    }
};

export const collection = (_db, collectionName) => ({
    kind: 'collection',
    collectionName,
    tableName: resolveTable(collectionName)
});

const normalizeRef = (refOrDb, collectionName, id) => {
    if (typeof refOrDb === 'string') {
        return { collectionName: refOrDb, id: collectionName };
    }

    if (refOrDb?.kind === 'collection') {
        return { collectionName: refOrDb.collectionName, id: collectionName };
    }

    return { collectionName, id };
};

export const doc = (refOrDb, collectionName, id) => {
    const normalized = normalizeRef(refOrDb, collectionName, id);
    return {
        kind: 'doc',
        ...normalized,
        tableName: resolveTable(normalized.collectionName)
    };
};

export const getDoc = async (ref) => {
    await supabaseService.init();
    const tableName = ref.tableName || resolveTable(ref.collectionName);
    const primaryKey = primaryKeyFor(tableName);
    const { data, error } = await supabaseService.getClient()
        .from(tableName)
        .select('*')
        .eq(primaryKey, ref.id)
        .maybeSingle();

    if (error) throw error;
    return snapshotFromRow(tableName, data);
};

export const setDoc = async (ref, payload, _options = {}) => {
    await supabaseService.init();
    const tableName = ref.tableName || resolveTable(ref.collectionName);
    const primaryKey = primaryKeyFor(tableName);
    const dbPayload = fromClientPayload(tableName, payload, ref.id);

    if (_options?.merge) {
        const { [primaryKey]: _primaryKeyValue, ...updatePayload } = dbPayload;
        const { data, error } = await supabaseService.getClient()
            .from(tableName)
            .update(updatePayload)
            .eq(primaryKey, ref.id)
            .select(primaryKey)
            .maybeSingle();

        if (error) throw error;
        if (data) return;
    }

    const { error } = await supabaseService.getClient()
        .from(tableName)
        .upsert(dbPayload, { onConflict: primaryKey });

    if (error) throw error;
};

export const addDoc = async (collectionRef, payload) => {
    await supabaseService.init();
    const tableName = collectionRef.tableName || resolveTable(collectionRef.collectionName);

    if (tableName === 'export_logs') {
        const { data, error } = await supabaseService.getClient()
            .from(tableName)
            .insert(fromClientPayload(tableName, payload))
            .select('*')
            .single();
        if (error) throw error;
        return doc(collectionRef, data.id);
    }

    const id = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ref = doc(collectionRef, id);
    await setDoc(ref, payload);
    return ref;
};

export const deleteDoc = async (ref) => {
    await supabaseService.init();
    const tableName = ref.tableName || resolveTable(ref.collectionName);
    const primaryKey = primaryKeyFor(tableName);
    const { error } = await supabaseService.getClient()
        .from(tableName)
        .delete()
        .eq(primaryKey, ref.id);

    if (error) throw error;
};

export const serverTimestamp = () => new Date().toISOString();

export const where = (field, operator, value) => ({
    kind: 'where',
    field,
    operator,
    value
});

export const orderBy = (field, direction = 'asc') => ({
    kind: 'orderBy',
    field,
    direction
});

export const limit = (count) => ({
    kind: 'limit',
    count
});

export const query = (collectionRef, ...constraints) => ({
    kind: 'query',
    collectionName: collectionRef.collectionName,
    tableName: collectionRef.tableName || resolveTable(collectionRef.collectionName),
    constraints
});

export const getDocs = async (refOrQuery) => {
    await supabaseService.init();
    const tableName = refOrQuery.tableName || resolveTable(refOrQuery.collectionName);
    let builder = supabaseService.getClient().from(tableName).select('*');
    builder = applyConstraints(builder, tableName, refOrQuery.constraints || []);

    const { data, error } = await builder;
    if (error) throw error;

    const docs = (data || []).map((row) => snapshotFromRow(tableName, row));
    return {
        docs,
        empty: docs.length === 0,
        forEach(callback) {
            docs.forEach(callback);
        }
    };
};

export const writeBatch = () => {
    const operations = [];

    return {
        set(ref, payload, options) {
            operations.push(() => setDoc(ref, payload, options));
        },
        delete(ref) {
            operations.push(() => deleteDoc(ref));
        },
        async commit() {
            for (const operation of operations) {
                await operation();
            }
        }
    };
};
