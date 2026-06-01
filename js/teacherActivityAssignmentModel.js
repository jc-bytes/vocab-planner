import { $ } from './main.js';
import { serverTimestamp } from './services/teacherApi.js';
import {
    DEFAULT_SUBJECT_SLUG,
    normalizeSubjectSlug
} from './services/vocabularyApi.js';

export function normalizeTeacherActivityTargetList(value, { uppercase = false } = {}) {
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
}

export function normalizeTeacherActivityAssignment(manager, assignment = {}) {
    const source = assignment && typeof assignment === 'object' ? assignment : {};
    const activitySnapshot = manager.normalizeActivity({
        id: source.sourceActivityId || source.source_activity_id || source.id || '',
        title: source.title,
        description: source.description,
        activityType: source.activityType || source.activity_type,
        subjectSlug: source.subjectSlug || source.subject_slug,
        grades: source.grades,
        teacherInstructions: source.teacherInstructions || source.teacher_instructions,
        studentInstructions: source.studentInstructions || source.student_instructions,
        materials: source.materials,
        estimatedMinutes: source.estimatedMinutes ?? source.estimated_minutes,
        studentOutput: source.studentOutput || source.student_output,
        makeupInstructions: source.makeupInstructions || source.makeup_instructions,
        assessmentPurpose: source.assessmentPurpose || source.assessment_purpose,
        activityData: source.activityData || source.activity_data
    });

    return {
        ...activitySnapshot,
        id: String(source.id || `assignment_${Date.now()}`),
        sourceActivityId: String(source.sourceActivityId || source.source_activity_id || ''),
        targetGrades: normalizeTeacherActivityTargetList(source.targetGrades || source.target_grades),
        targetSections: normalizeTeacherActivityTargetList(source.targetSections || source.target_sections, { uppercase: true }),
        availableFrom: source.availableFrom || source.available_from || '',
        dueDate: source.dueDate || source.due_date || '',
        weekLabel: String(source.weekLabel || source.week_label || '').trim(),
        status: source.status || 'active',
        assignedBy: source.assignedBy || source.assigned_by || null,
        createdAt: source.createdAt || source.created_at,
        updatedAt: source.updatedAt || source.updated_at
    };
}

export function normalizeTeacherActivitySubmission(submission = {}) {
    const source = submission && typeof submission === 'object' ? submission : {};
    return {
        id: String(source.id || ''),
        assignmentId: String(source.assignmentId || source.assignment_id || ''),
        studentId: String(source.studentId || source.student_id || ''),
        studentProfile: source.studentProfile || source.student_profile || {},
        status: source.status || 'draft',
        responseData: source.responseData || source.response_data || {},
        responseDataStoragePath: String(source.responseDataStoragePath || source.response_data_storage_path || ''),
        responseDataStorageSizeBytes: source.responseDataStorageSizeBytes ?? source.response_data_storage_size_bytes ?? null,
        responseDataStorageUpdatedAt: source.responseDataStorageUpdatedAt || source.response_data_storage_updated_at,
        startedAt: source.startedAt || source.started_at,
        submittedAt: source.submittedAt || source.submitted_at,
        lateOverride: Boolean(source.lateOverride || source.late_override),
        lateOverrideReason: String(source.lateOverrideReason || source.late_override_reason || '').trim(),
        lateOverrideBy: source.lateOverrideBy || source.late_override_by || null,
        lateOverrideAt: source.lateOverrideAt || source.late_override_at,
        createdAt: source.createdAt || source.created_at,
        updatedAt: source.updatedAt || source.updated_at
    };
}

export function getTeacherLocalDateInputValue(date = new Date()) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
}

export function readTeacherActivityAssignmentForm(manager) {
    const targetGrades = normalizeTeacherActivityTargetList($('#assignment-target-grades')?.value || '')
        .map(grade => manager.normalizeGradeLabel(grade))
        .filter(Boolean);
    const targetSections = normalizeTeacherActivityTargetList($('#assignment-target-sections')?.value || '', { uppercase: true });
    const weekLabel = String($('#assignment-week-label')?.value || '').trim();
    const availableFrom = $('#assignment-available-from')?.value || '';
    const dueDate = $('#assignment-due-date')?.value || '';

    if (targetGrades.length === 0) {
        throw new Error('Enter at least one target grade.');
    }

    if (availableFrom && dueDate && dueDate < availableFrom) {
        throw new Error('Due date cannot be before the visible date.');
    }

    return { targetGrades, targetSections, weekLabel, availableFrom, dueDate };
}

export function createTeacherActivityAssignmentId(manager, activity = {}) {
    const title = manager.slugifyVocabPart(activity.title || 'activity');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `assignment_${manager.slugifyVocabPart(activity.subjectSlug) || DEFAULT_SUBJECT_SLUG}_${title}_${Date.now()}_${suffix}`;
}

export function formatTeacherActivityAssignmentCount(count) {
    return `${count} ${count === 1 ? 'assignment' : 'assignments'}`;
}

export function getTeacherActivityAssignmentGroupGrades(manager, assignment = {}) {
    const targetGrades = normalizeTeacherActivityTargetList(assignment.targetGrades || assignment.target_grades)
        .map(grade => manager.normalizeGradeLabel(grade))
        .filter(Boolean);
    if (targetGrades.length) return targetGrades;
    return manager.getActivityGroupGrades(assignment);
}

export function buildTeacherActivityAssignmentGroups(manager, assignments = manager.activityAssignmentItems) {
    const subjectGroups = new Map();

    assignments.forEach(assignment => {
        const normalized = manager.normalizeActivityAssignment(assignment);
        const subjectSlug = normalizeSubjectSlug(normalized.subjectSlug || DEFAULT_SUBJECT_SLUG);

        if (!subjectGroups.has(subjectSlug)) {
            subjectGroups.set(subjectSlug, new Map());
        }

        const gradeGroups = subjectGroups.get(subjectSlug);
        manager.getActivityAssignmentGroupGrades(normalized).forEach(grade => {
            if (!gradeGroups.has(grade)) {
                gradeGroups.set(grade, []);
            }
            gradeGroups.get(grade).push(normalized);
        });
    });

    return subjectGroups;
}

export function formatTeacherAssignmentReviewSummary(manager, assignments = []) {
    const normalized = assignments.map(assignment => manager.normalizeActivityAssignment(assignment));
    const scheduledCount = normalized.filter(assignment => manager.isAssignmentScheduled(assignment)).length;
    const weekLabels = Array.from(new Set(normalized.map(assignment => assignment.weekLabel).filter(Boolean)));

    if (weekLabels.length) {
        const visibleLabels = weekLabels.slice(0, 3).join(' · ');
        return weekLabels.length > 3 ? `${visibleLabels} · +${weekLabels.length - 3} more` : visibleLabels;
    }

    return scheduledCount ? `${scheduledCount} scheduled` : 'Ready to review';
}

export function getTeacherActivityAssignmentSortValue(assignment = {}) {
    const value = assignment.updatedAt || assignment.createdAt || assignment.dueDate;
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value.seconds !== undefined) return Number(value.seconds) * 1000;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatTeacherAssignmentTarget(manager, assignment = {}) {
    const grades = normalizeTeacherActivityTargetList(assignment.targetGrades || assignment.target_grades)
        .map(grade => manager.formatGradeLabel(grade))
        .join(', ');
    const sections = normalizeTeacherActivityTargetList(assignment.targetSections || assignment.target_sections, { uppercase: true });
    const sectionLabel = sections.length ? `Sections ${sections.join(', ')}` : 'All sections';
    return `${grades || 'No grades'} · ${sectionLabel}`;
}

export function formatTeacherDateOnly(value) {
    if (!value) return '';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTeacherActivityDueDate(value) {
    if (!value) return 'No due date';
    return `Due ${formatTeacherDateOnly(value)}`;
}

export function formatTeacherAvailableDate(value) {
    if (!value) return 'Visible now';
    const dateLabel = formatTeacherDateOnly(value);
    if (!dateLabel) return 'Visible now';
    return `Visible ${dateLabel}`;
}

export function formatTeacherActivityAssignmentWindow(assignment = {}) {
    const parts = [];
    if (assignment.weekLabel) parts.push(assignment.weekLabel);
    parts.push(formatTeacherAvailableDate(assignment.availableFrom || assignment.available_from));
    parts.push(formatTeacherActivityDueDate(assignment.dueDate || assignment.due_date));
    return parts.filter(Boolean).join(' · ');
}

export function teacherActivityTimestampToMillis(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value.seconds !== undefined) return Number(value.seconds) * 1000;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function teacherActivityDueDateEndMillis(value) {
    if (!value) return 0;
    const parsed = Date.parse(`${String(value).slice(0, 10)}T23:59:59`);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function isTeacherActivityAssignmentScheduled(assignment = {}) {
    const release = assignment.availableFrom || assignment.available_from;
    if (!release) return false;
    const start = Date.parse(`${String(release).slice(0, 10)}T00:00:00`);
    return Number.isFinite(start) && start > Date.now();
}

export function getTeacherActivityLateState(assignment = {}, submission = null) {
    const dueMillis = teacherActivityDueDateEndMillis(assignment.dueDate || assignment.due_date);
    if (!dueMillis) {
        return { isLate: false, isExcused: false, label: 'On time', className: '' };
    }

    const submittedMillis = teacherActivityTimestampToMillis(submission?.submittedAt || submission?.submitted_at);
    const isSubmittedLate = submittedMillis > 0 && submittedMillis > dueMillis;
    const isOpenLate = !submittedMillis && Date.now() > dueMillis;
    const isLate = isSubmittedLate || isOpenLate;
    const isExcused = Boolean(submission?.lateOverride || submission?.late_override);

    if (isExcused) {
        return {
            isLate,
            isExcused: true,
            label: 'Excused',
            className: 'is-excused',
            reason: submission?.lateOverrideReason || submission?.late_override_reason || ''
        };
    }

    return {
        isLate,
        isExcused: false,
        label: isLate ? 'Late' : 'On time',
        className: isLate ? 'is-late' : ''
    };
}

export function teacherActivityAssignmentMatchesStudent(manager, assignment = {}, student = {}) {
    const profile = student.studentProfile || {};
    const grade = String(profile.grade || student.grade || '').trim();
    const section = String(profile.group || profile.sectionLetter || student.group || '').trim().toUpperCase();
    const targetGrades = normalizeTeacherActivityTargetList(assignment.targetGrades || assignment.target_grades);
    const targetSections = normalizeTeacherActivityTargetList(assignment.targetSections || assignment.target_sections, { uppercase: true });

    if (!grade || !targetGrades.includes(grade)) return false;
    return targetSections.length === 0 || targetSections.includes(section);
}

export function getTeacherStudentRosterName(student = {}) {
    const profile = student.studentProfile || {};
    const name = profile.firstName && profile.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : profile.name || student.name || student.email || 'Student';
    return String(name).trim();
}

export function getTeacherStudentRosterMeta(manager, student = {}) {
    const profile = student.studentProfile || {};
    const grade = profile.grade ? manager.formatGradeLabel(profile.grade) : 'No grade';
    const section = profile.group || profile.sectionLetter ? `Section ${profile.group || profile.sectionLetter}` : 'No section';
    return `${grade} · ${section}`;
}

export function buildTeacherActivityAssignmentUpdatePayload(assignment = {}, sourceActivity = {}) {
    return {
        id: assignment.id,
        sourceActivityId: sourceActivity.id || assignment.sourceActivityId,
        title: sourceActivity.title,
        description: sourceActivity.description,
        activityType: sourceActivity.activityType,
        subjectSlug: sourceActivity.subjectSlug,
        grades: sourceActivity.grades,
        teacherInstructions: sourceActivity.teacherInstructions,
        studentInstructions: sourceActivity.studentInstructions,
        materials: sourceActivity.materials,
        estimatedMinutes: sourceActivity.estimatedMinutes,
        studentOutput: sourceActivity.studentOutput,
        makeupInstructions: sourceActivity.makeupInstructions,
        assessmentPurpose: sourceActivity.assessmentPurpose,
        activityData: sourceActivity.activityData,
        targetGrades: assignment.targetGrades,
        targetSections: assignment.targetSections,
        availableFrom: assignment.availableFrom || null,
        dueDate: assignment.dueDate || null,
        weekLabel: assignment.weekLabel || '',
        status: assignment.status || 'active',
        assignedBy: assignment.assignedBy || null,
        updatedAt: serverTimestamp()
    };
}

export function formatStartedTeacherSubmissionWarning(submissions = []) {
    const counts = submissions.reduce((acc, submission) => {
        const status = submission?.status || 'draft';
        acc.total += 1;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { total: 0, draft: 0, submitted: 0 });
    const pieces = [];
    if (counts.draft) pieces.push(`${counts.draft} draft${counts.draft === 1 ? '' : 's'}`);
    if (counts.submitted) pieces.push(`${counts.submitted} submitted`);
    const startedText = pieces.length ? pieces.join(' and ') : `${counts.total} started`;
    return `Update this published assignment? ${startedText} student response${counts.total === 1 ? '' : 's'} will be preserved. New prompts will appear blank, removed prompts will disappear, and started map canvases will stay as student copies.`;
}
