import { DEFAULT_COIN_DATA } from '../studentProgressDefaults.js';

export const WORD_HUNT_IMAGE_BUCKET = 'word-hunt-images';

export function cleanUndefined(object) {
    return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export function parseGrade(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

export function normalizeSection(value) {
    if (!value) return null;
    const section = String(value).trim().toUpperCase();
    return /^[A-Z]$/.test(section) ? section : null;
}

export function normalizeTextArray(value, { uppercase = false } = {}) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const items = source
        .flatMap(item => item === null || item === undefined ? [] : String(item).split(','))
        .map(item => {
            const text = item.trim();
            return uppercase ? text.toUpperCase() : text;
        })
        .filter(Boolean);
    return Array.from(new Set(items));
}

export function toClientTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'object' && value.seconds !== undefined) return value;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => date
    };
}

export function timestampToIso(value) {
    if (!value) return new Date().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value.seconds !== undefined) return new Date(value.seconds * 1000).toISOString();
    return new Date().toISOString();
}

export function normalizeProfile(profile = {}) {
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
}

export function normalizeUser(user) {
    if (!user) return null;
    return {
        ...user,
        uid: user.id,
        displayName: user.user_metadata?.full_name ||
            [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') ||
            user.email,
        photoURL: user.user_metadata?.avatar_url || ''
    };
}

export function mapProfileRow(row) {
    if (!row) return null;
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
        createdAt: toClientTimestamp(row.created_at),
        updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function profilePayload(profile = {}, userId = null) {
    const normalized = normalizeProfile(profile);
    return cleanUndefined({
        user_id: userId || profile.userId || profile.user_id,
        role: profile.role || 'student',
        first_name: normalized.firstName,
        last_name: normalized.lastName,
        email: normalized.email || profile.email,
        grade_level: parseGrade(normalized.grade),
        section_letter: normalizeSection(normalized.group),
        must_change_password: profile.mustChangePassword ?? profile.must_change_password,
        updated_at: profile.updatedAt ? timestampToIso(profile.updatedAt) : undefined
    });
}

export function mapStudentProgressRow(row) {
    if (!row) return null;
    const studentProfile = normalizeProfile(row.student_profile || {});
    return {
        id: row.user_id,
        userId: row.user_id,
        studentProfile,
        units: row.units || {},
        version: Number(row.version) || 0,
        coins: row.coins ?? row.coin_data?.balance ?? 0,
        coinData: row.coin_data || { ...DEFAULT_COIN_DATA },
        coinHistory: Object.hasOwn(row, 'coin_history') ? (row.coin_history || []) : undefined,
        totalXp: Number(row.total_xp) || 0,
        email: studentProfile.email || '',
        role: 'student',
        createdAt: toClientTimestamp(row.created_at),
        updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function mapScoreRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name || '',
        grade: row.grade_level === null || row.grade_level === undefined ? '' : String(row.grade_level),
        gameId: row.game_id,
        score: Number(row.score) || 0,
        metadata: row.metadata || {},
        timestamp: toClientTimestamp(row.timestamp),
        updatedAt: toClientTimestamp(row.updated_at)
    };
}

export function slugifyStoragePart(value, fallback = 'item') {
    const slug = String(value || '').trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

export function getCurrentSchoolYear(date = new Date()) {
    return String(date.getFullYear());
}
