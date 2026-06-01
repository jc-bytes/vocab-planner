import {
    DEFAULT_SUBJECT_SLUG,
    normalizeSubjectSlug
} from './services/vocabularyApi.js';
import {
    ACTIVITY_TEMPLATE_OPTIONS,
    ACTIVITY_TYPE_CONFIGS,
    DEFAULT_ACTIVITY_TEMPLATE_ID,
    DEFAULT_ACTIVITY_TYPE,
    createDefaultActivityData,
    getDefaultActivityInstructions,
    getActivityTemplate,
    getActivityTypeLabel,
    getDefaultTemplateIdForType,
    getStableActivityTemplateSignature,
    normalizeActivityData
} from './classroomActivityRegistry.js';

export function getTeacherActivityTemplate(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    return getActivityTemplate(templateId);
}

export function getTeacherActivityTemplateType(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    return getTeacherActivityTemplate(templateId).type || DEFAULT_ACTIVITY_TYPE;
}

export function getTeacherActivityTemplateLabel(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    return getTeacherActivityTemplate(templateId).label;
}

export function getTeacherActivityTypeLabel(activityType = DEFAULT_ACTIVITY_TYPE) {
    return getActivityTypeLabel(activityType);
}

export function createTeacherDefaultActivity(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
    const template = getTeacherActivityTemplate(templateId);
    const defaults = getDefaultActivityInstructions(template.id);
    const activityType = template.type || DEFAULT_ACTIVITY_TYPE;
    const activityData = createDefaultActivityData(template);

    return {
        id: `activity_${Date.now()}`,
        title: template.label,
        description: template.description,
        activityType,
        subjectSlug: DEFAULT_SUBJECT_SLUG,
        grades: [],
        teacherInstructions: defaults.teacherInstructions,
        studentInstructions: defaults.studentInstructions,
        materials: defaults.materials,
        estimatedMinutes: 45,
        studentOutput: defaults.studentOutput,
        makeupInstructions: defaults.makeupInstructions,
        assessmentPurpose: 'formative',
        activityData
    };
}

export function normalizeTeacherActivityGrades(manager, activity = {}) {
    const explicitGrades = Array.isArray(activity.grades)
        ? activity.grades
        : [activity.grades, activity.grade, activity.gradeLevel];
    return explicitGrades
        .flatMap(grade => {
            if (grade === null || grade === undefined) return [];
            return String(grade).split(',');
        })
        .map(grade => manager.normalizeGradeLabel(grade))
        .filter(Boolean);
}

export function normalizeTeacherActivity(manager, activity = {}) {
    const sourceData = activity && typeof activity === 'object' ? activity : {};
    const activityData = sourceData.activityData || sourceData.activity_data || {};
    const sourceActivityType = sourceData.activityType || sourceData.activity_type || '';
    const fallbackTemplateId = getDefaultTemplateIdForType(sourceActivityType || DEFAULT_ACTIVITY_TYPE);
    const rawTemplateId = activityData.templateId
        || activityData.template_id
        || sourceData.templateId
        || sourceData.template_id
        || fallbackTemplateId;
    let template = getTeacherActivityTemplate(rawTemplateId);
    let activityType = sourceActivityType || template.type || DEFAULT_ACTIVITY_TYPE;

    if (!ACTIVITY_TYPE_CONFIGS[activityType]) {
        activityType = template.type || DEFAULT_ACTIVITY_TYPE;
    }

    if (template.type !== activityType) {
        template = ACTIVITY_TEMPLATE_OPTIONS.find(option => option.type === activityType)
            || getTeacherActivityTemplate(DEFAULT_ACTIVITY_TEMPLATE_ID);
        activityType = template.type || DEFAULT_ACTIVITY_TYPE;
    }

    const defaults = getDefaultActivityInstructions(template.id);
    const estimatedMinutes = sourceData.estimatedMinutes ?? sourceData.estimated_minutes;
    const normalizedActivityData = normalizeActivityData(activityType, activityData, template.id);

    return {
        id: String(sourceData.id || `activity_${Date.now()}`),
        title: String(sourceData.title || template.label || 'Untitled Activity').trim() || 'Untitled Activity',
        description: String(sourceData.description || template.description || '').trim(),
        activityType,
        subjectSlug: normalizeSubjectSlug(sourceData.subjectSlug || sourceData.subject_slug || sourceData.subject),
        grades: normalizeTeacherActivityGrades(manager, sourceData),
        teacherInstructions: String(sourceData.teacherInstructions ?? sourceData.teacher_instructions ?? defaults.teacherInstructions ?? ''),
        studentInstructions: String(sourceData.studentInstructions ?? sourceData.student_instructions ?? defaults.studentInstructions ?? ''),
        materials: String(sourceData.materials ?? defaults.materials ?? ''),
        estimatedMinutes: estimatedMinutes === null || estimatedMinutes === undefined || estimatedMinutes === ''
            ? ''
            : Number.parseInt(String(estimatedMinutes), 10) || '',
        studentOutput: String(sourceData.studentOutput ?? sourceData.student_output ?? defaults.studentOutput ?? ''),
        makeupInstructions: String(sourceData.makeupInstructions ?? sourceData.makeup_instructions ?? defaults.makeupInstructions ?? ''),
        assessmentPurpose: sourceData.assessmentPurpose || sourceData.assessment_purpose || 'formative',
        month: String(sourceData.month || '').trim(),
        week: sourceData.week ?? '',
        activityData: normalizedActivityData,
        source: sourceData.source || sourceData.__source || '',
        ownerId: sourceData.ownerId || sourceData.owner_id || null,
        createdAt: sourceData.createdAt || sourceData.created_at,
        updatedAt: sourceData.updatedAt || sourceData.updated_at
    };
}

export function getTeacherActivityDuplicateSignature(manager, activity = {}) {
    const normalized = manager.normalizeActivity(activity);
    const activityData = normalized.activityData || {};
    return JSON.stringify({
        title: normalized.title,
        description: normalized.description,
        activityType: normalized.activityType,
        subjectSlug: normalized.subjectSlug,
        grades: normalized.grades,
        teacherInstructions: normalized.teacherInstructions,
        studentInstructions: normalized.studentInstructions,
        materials: normalized.materials,
        estimatedMinutes: normalized.estimatedMinutes,
        studentOutput: normalized.studentOutput,
        makeupInstructions: normalized.makeupInstructions,
        assessmentPurpose: normalized.assessmentPurpose,
        templateId: activityData.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID,
        ...getStableActivityTemplateSignature(normalized)
    });
}

export function getTeacherActivityTimestamp(activity = {}) {
    const value = activity.updatedAt || activity.updated_at || activity.createdAt || activity.created_at;
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value.seconds !== undefined) return Number(value.seconds) * 1000;
    return 0;
}

export function collapseDuplicateTeacherActivityItems(manager, items = []) {
    const bySignature = new Map();

    items.forEach(item => {
        const signature = manager.getActivityDuplicateSignature(item.activity);
        const current = bySignature.get(signature);
        if (!current) {
            bySignature.set(signature, item);
            return;
        }

        const itemIsCloud = item.type === 'cloud';
        const currentIsCloud = current.type === 'cloud';
        const itemTime = getTeacherActivityTimestamp(item.activity);
        const currentTime = getTeacherActivityTimestamp(current.activity);

        if ((itemIsCloud && !currentIsCloud) || (itemIsCloud === currentIsCloud && itemTime >= currentTime)) {
            bySignature.set(signature, item);
        }
    });

    return Array.from(bySignature.values());
}

export function formatTeacherActivityCount(count) {
    return `${count} ${count === 1 ? 'activity' : 'activities'}`;
}

export function getTeacherActivityGroupGrades(manager, activity = {}) {
    const grades = manager.normalizeActivityGrades(activity);
    return grades.length ? grades : ['needs-grade'];
}

export function formatTeacherActivityGroupGradeLabel(manager, grade) {
    return grade === 'needs-grade' ? 'Needs Grade' : manager.formatGradeLabel(grade);
}

export function compareTeacherActivityGroupGrades(manager, gradeA, gradeB) {
    if (gradeA === 'needs-grade' && gradeB !== 'needs-grade') return 1;
    if (gradeB === 'needs-grade' && gradeA !== 'needs-grade') return -1;
    return manager.compareGradeLabels(gradeA, gradeB);
}

export function buildTeacherActivityLibraryGroups(manager, items = manager.activityLibraryItems) {
    const subjectGroups = new Map();

    items.forEach(({ activity, type }) => {
        const normalized = manager.normalizeActivity(activity);
        const subjectSlug = normalizeSubjectSlug(normalized.subjectSlug || DEFAULT_SUBJECT_SLUG);

        if (!subjectGroups.has(subjectSlug)) {
            subjectGroups.set(subjectSlug, new Map());
        }

        const gradeGroups = subjectGroups.get(subjectSlug);
        manager.getActivityGroupGrades(normalized).forEach(grade => {
            if (!gradeGroups.has(grade)) {
                gradeGroups.set(grade, []);
            }
            gradeGroups.get(grade).push({ activity: normalized, type });
        });
    });

    return subjectGroups;
}

export function formatTeacherActivityTemplateSummary(manager, activityItems = []) {
    const counts = new Map();
    activityItems.forEach(({ activity }) => {
        const label = manager.getActivityTemplateLabel(activity?.activityData?.templateId);
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
        .sort(([labelA], [labelB]) => labelA.localeCompare(labelB))
        .map(([label, count]) => `${label}: ${count}`)
        .join(' · ');
}

export function formatTeacherActivityTypeSummary(manager, activityItems = []) {
    const counts = new Map();
    activityItems.forEach(({ activity }) => {
        const normalized = manager.normalizeActivity(activity);
        const label = manager.getActivityTypeLabel(normalized.activityType);
        counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
        .sort(([labelA], [labelB]) => labelA.localeCompare(labelB))
        .map(([label, count]) => `${label}: ${count}`)
        .join(' · ');
}

export function formatTeacherActivityMonthSummary(manager, monthGroups) {
    return Array.from(monthGroups.entries())
        .sort(([monthA], [monthB]) => manager.getTeacherMonthOrder(monthA) - manager.getTeacherMonthOrder(monthB))
        .map(([monthKey, weekGroups]) => {
            const count = Array.from(weekGroups.values()).reduce((sum, group) => sum + group.length, 0);
            return `${manager.getTeacherMonthShortLabel(monthKey)}: ${count}`;
        })
        .join(' · ');
}

export function formatTeacherActivityWeekSummary(manager, weekGroups) {
    return Array.from(weekGroups.entries())
        .sort(([weekA], [weekB]) => manager.getActivityWeekOrder(weekA) - manager.getActivityWeekOrder(weekB))
        .map(([weekKey, activityItems]) => `${manager.formatActivityWeekShortLabel(weekKey)}: ${activityItems.length}`)
        .join(' · ');
}

export function getTeacherActivitySortName(activity) {
    return String(activity?.title || activity?.id || '').toLocaleLowerCase();
}

export function getTeacherActivityPlacementSource(activity = {}) {
    return [
        activity.month,
        activity.week,
        activity.title,
        activity.description,
        activity.teacherInstructions,
        activity.id
    ].filter(Boolean).join(' ');
}

export function getTeacherActivityMonthKey(manager, activity = {}) {
    const explicitMonth = manager.normalizeTeacherMonth(activity?.month);
    if (explicitMonth !== 'other') return explicitMonth;

    const source = getTeacherActivityPlacementSource(activity);
    const monthMatch = source.match(/(?:^|[^a-z])(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?=[^a-z]|$)/i);
    return manager.normalizeTeacherMonth(monthMatch?.[1]);
}

export function inferTeacherActivityWeek(activity = {}) {
    const explicitWeek = Number.parseInt(String(activity?.week || ''), 10);
    if (Number.isInteger(explicitWeek) && explicitWeek > 0) return explicitWeek;

    const source = getTeacherActivityPlacementSource(activity);
    const weekMatch = source.match(/(?:^|[^a-z])weeks?\s*([0-9]{1,2})(?:\s*[-–]\s*[0-9]{1,2})?(?=[^0-9]|$)/i)
        || source.match(/(?:^|[^a-z])w\s*([0-9]{1,2})(?=[^0-9]|$)/i);
    const week = Number.parseInt(String(weekMatch?.[1] || ''), 10);
    return Number.isInteger(week) && week > 0 ? week : null;
}

export function normalizeTeacherActivityWeekKey(weekKey) {
    const value = String(weekKey || '').trim().toLowerCase();
    if (!value) return null;
    if (value === 'other' || value === 'unscheduled') return 'other';
    const match = value.match(/[0-9]{1,2}/);
    return match ? `week-${Number(match[0])}` : 'other';
}

export function getTeacherActivityWeekKey(activity = {}) {
    const week = inferTeacherActivityWeek(activity);
    return week ? `week-${week}` : 'other';
}

export function getTeacherActivityWeekOrder(weekKey) {
    const match = String(weekKey || '').match(/[0-9]+/);
    return match ? Number(match[0]) : 99;
}

export function formatTeacherActivityWeekLabel(weekKey) {
    const week = getTeacherActivityWeekOrder(weekKey);
    return week === 99 ? 'Unscheduled' : `Week ${week}`;
}

export function formatTeacherActivityWeekShortLabel(weekKey) {
    const week = getTeacherActivityWeekOrder(weekKey);
    return week === 99 ? 'Unscheduled' : `W${week}`;
}

export function inferTeacherActivitySlotMinutes(activity = {}) {
    const source = getTeacherActivityPlacementSource(activity);
    const match = source.match(/(?:^|[^0-9])([0-9]{2,3})\s*(?:m|min|minute)(?=[^a-z]|$)/i);
    const minutes = Number.parseInt(String(match?.[1] || ''), 10);
    return Number.isInteger(minutes) && minutes > 0 ? minutes : 999;
}

export function buildTeacherActivityMonthWeekGroups(manager, activityItems = []) {
    const monthGroups = new Map();

    activityItems.forEach(({ activity, type }) => {
        const normalized = manager.normalizeActivity(activity);
        const monthKey = manager.getActivityMonthKey(normalized);
        const weekKey = manager.getActivityWeekKey(normalized);

        if (!monthGroups.has(monthKey)) {
            monthGroups.set(monthKey, new Map());
        }

        const weekGroups = monthGroups.get(monthKey);
        if (!weekGroups.has(weekKey)) {
            weekGroups.set(weekKey, []);
        }

        weekGroups.get(weekKey).push({ activity: normalized, type });
    });

    return monthGroups;
}

export function getTeacherActivityPlacementSortValue(manager, activity = {}) {
    const monthOrder = String(manager.getTeacherMonthOrder(manager.getActivityMonthKey(activity))).padStart(2, '0');
    const weekOrder = String(manager.getActivityWeekOrder(manager.getActivityWeekKey(activity))).padStart(2, '0');
    const minutes = String(manager.inferActivitySlotMinutes(activity)).padStart(3, '0');
    return `${monthOrder}-${weekOrder}-${minutes}-${getTeacherActivitySortName(activity)}`;
}

export function compareTeacherActivityPlacement(manager, activityA = {}, activityB = {}) {
    const placementA = manager.getActivityPlacementSortValue(activityA);
    const placementB = manager.getActivityPlacementSortValue(activityB);

    if (placementA !== placementB) {
        return placementA.localeCompare(placementB);
    }

    return getTeacherActivitySortName(activityA).localeCompare(getTeacherActivitySortName(activityB));
}

export function formatTeacherActivityUpdatedLabel(manager, activity = {}) {
    const timestamp = manager.getActivityTimestamp(activity);
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}
