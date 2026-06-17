export const TABLE_ALIASES = {
    appSettings: 'app_settings',
    exportLogs: 'export_logs',
    studentProgress: 'student_progress',
    weeklySparks: 'weekly_sparks',
    userRoles: 'profiles'
};

export const PRIMARY_KEYS = {
    app_settings: 'key',
    export_logs: 'id',
    profiles: 'user_id',
    scores: 'id',
    student_progress: 'user_id',
    subjects: 'slug',
    vocabularies: 'id',
    weekly_sparks: 'id'
};

export const FIELD_ALIASES = {
    app_settings: {
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
    },
    weekly_sparks: {
        gradeQuestions: 'grade_questions',
        ownerId: 'owner_id',
        scheduledDate: 'scheduled_date',
        sourceTitle: 'source_title',
        sourceUrl: 'source_url',
        sparkText: 'spark_text',
        sparkType: 'spark_type',
        subjectSlug: 'subject_slug',
        targetGrades: 'target_grades',
        updatedAt: 'updated_at',
        whyItMatters: 'why_it_matters'
    }
};

export const DEFAULT_COIN_DATA = {
    balance: 0,
    giftCoins: 0,
    totalEarned: 0,
    totalSpent: 0,
    totalGifted: 0
};

export const WORD_HUNT_IMAGE_BUCKET = 'word-hunt-images';

export const resolveTable = (collectionName) => TABLE_ALIASES[collectionName] || collectionName;

export const primaryKeyFor = (tableName) => PRIMARY_KEYS[tableName] || 'id';

export const toDatabaseField = (tableName, field) => {
    return FIELD_ALIASES[tableName]?.[field] || field;
};

export const toDatabaseValue = (field, value) => {
    if (field === 'grade_level') {
        return parseGrade(value);
    }
    if (field === 'section_letter') {
        return normalizeSection(value);
    }
    return value;
};

export const cleanUndefined = (object) => {
    return Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined)
    );
};

export const parseGrade = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : null;
};

export const normalizeSection = (value) => {
    if (!value) return null;
    const section = String(value).trim().toUpperCase();
    return /^[A-Z]$/.test(section) ? section : null;
};

export const normalizeTextArray = (value, { uppercase = false } = {}) => {
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

export const toTimestamp = (value) => {
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

export const timestampToIso = (value) => {
    if (!value) return new Date().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value.seconds !== undefined) return new Date(value.seconds * 1000).toISOString();
    return new Date().toISOString();
};

export const normalizeProfile = (profile = {}) => {
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

export const normalizeUser = (user) => {
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

export const toClientRow = (tableName, row) => {
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

    if (tableName === 'weekly_sparks') {
        return {
            id: row.id,
            sparkType: row.spark_type || 'cool_fact',
            title: row.title || '',
            sparkText: row.spark_text || '',
            whyItMatters: row.why_it_matters || '',
            question: row.question || '',
            gradeQuestions: row.grade_questions && typeof row.grade_questions === 'object' ? row.grade_questions : {},
            targetGrades: normalizeTextArray(row.target_grades || ['6', '7', '8', '9']),
            sourceTitle: row.source_title || '',
            sourceUrl: row.source_url || '',
            subjectSlug: row.subject_slug || 'technology',
            scheduledDate: row.scheduled_date || '',
            status: row.status || 'draft',
            ownerId: row.owner_id || null,
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

export const fromClientPayload = (tableName, payload = {}, id = null) => {
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

    if (tableName === 'weekly_sparks') {
        return cleanUndefined({
            id: id || payload.id,
            spark_type: payload.sparkType || payload.spark_type || 'cool_fact',
            title: payload.title,
            spark_text: payload.sparkText ?? payload.spark_text,
            why_it_matters: payload.whyItMatters ?? payload.why_it_matters,
            question: payload.question,
            grade_questions: payload.gradeQuestions ?? payload.grade_questions ?? {},
            target_grades: normalizeTextArray(payload.targetGrades ?? payload.target_grades ?? ['6', '7', '8', '9']),
            source_title: payload.sourceTitle ?? payload.source_title ?? '',
            source_url: payload.sourceUrl ?? payload.source_url ?? '',
            subject_slug: payload.subjectSlug || payload.subject_slug || 'technology',
            scheduled_date: (payload.scheduledDate ?? payload.scheduled_date) || null,
            status: payload.status || 'draft',
            owner_id: payload.ownerId || payload.owner_id || null,
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

export const snapshotFromRow = (tableName, row) => {
    const clientRow = toClientRow(tableName, row);
    return {
        id: clientRow?.id || row?.[primaryKeyFor(tableName)],
        exists: () => Boolean(row),
        data: () => clientRow || {}
    };
};

export const applyConstraints = (builder, tableName, constraints = []) => {
    let currentBuilder = builder;

    constraints.forEach((constraint) => {
        if (constraint.kind === 'where') {
            const field = toDatabaseField(tableName, constraint.field);
            const value = toDatabaseValue(field, constraint.value);
            if (constraint.operator === '==') {
                currentBuilder = currentBuilder.eq(field, value);
            } else if (constraint.operator === '<=') {
                currentBuilder = currentBuilder.lte(field, value);
            } else if (constraint.operator === '<') {
                currentBuilder = currentBuilder.lt(field, value);
            } else if (constraint.operator === '>=') {
                currentBuilder = currentBuilder.gte(field, value);
            } else if (constraint.operator === '>') {
                currentBuilder = currentBuilder.gt(field, value);
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
