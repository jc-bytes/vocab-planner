import { requestWithTimeout } from '../services/requestReliability.js';
import { $, closeModal, createElement } from '../main.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { supabaseService } from '../supabaseService.js';
import { teacherPageRegistry } from '../teacherPageRegistry.js';

const STUDENTS_PAGE = teacherPageRegistry.get('students');
const TEACHER_PROGRESS_QUERY_ROOT = ['teacher', 'student-progress'];

export function getTeacherProgressAccountId(owner) {
    if (owner.authDisabled) return 'local-development';
    return owner.currentUser?.uid || owner.currentUser?.id || '';
}

export function getTeacherProgressQueryKey(owner, ...parts) {
    return [
        ...TEACHER_PROGRESS_QUERY_ROOT,
        'session',
        owner.studentProgressSessionGeneration || 0,
        ...parts
    ];
}

export function getTeacherProgressQueryService(owner) {
    return owner.serverStateQuery || serverStateQuery;
}

function runTeacherProgressQuery(owner, options, forceRefresh) {
    const service = getTeacherProgressQueryService(owner);
    return forceRefresh ? service.refresh(options) : service.ensure(options);
}

// QueryCore owns sharing/caching. This read also honors the caller and private
// feature lifetime, and settles even when initialization/transport ignores abort.
async function readIdentityRoster(owner, querySignal, callerSignal, timeoutMs) {
    const controller = new AbortController();
    const signals = [querySignal, callerSignal, owner.rosterReadController?.signal].filter(Boolean);
    const abort = () => controller.abort();
    for (const signal of signals) {
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    }
    try {
        return await requestWithTimeout(signal => supabaseService.listStudentIdentityRoster({ signal }), {
            signal: controller.signal, timeoutMs, label: 'Loading student identities'
        });
    } catch (error) {
        if (error.code === 'REQUEST_ABORTED') error.name = 'AbortError';
        throw error;
    } finally {
        for (const signal of signals) signal.removeEventListener('abort', abort);
    }
}

function resetStudentProgressView() {
    ['#student-progress-list', '#student-progress-cards', '#student-progress-pagination', '#student-progress-status', '#student-roster-import-status']
        .forEach(selector => {
            const element = $(selector);
            if (!element) return;
            element.innerHTML = '';
            element.textContent = '';
        });
    ['#progress-loading', '#student-progress-pagination', '#student-progress-status']
        .forEach(selector => $(selector)?.classList.add('hidden'));

    const grade = $('#filter-grade');
    if (grade) {
        grade.innerHTML = '<option value="">All Grades</option>';
        grade.value = '';
    }
    const section = $('#filter-group');
    if (section) {
        section.innerHTML = '<option value="">All Sections</option>';
        section.value = '';
    }
    const search = $('#filter-search');
    if (search) search.value = '';

    const detailDefaults = {
        '#detail-student-name': 'Student Name',
        '#detail-student-grade': '-',
        '#detail-student-group': '-',
        '#detail-student-coins': '0',
        '#detail-last-active': '-',
        '#detail-avg-score': '-',
        '#detail-total-activities': '-',
        '#detail-password-flag': 'No'
    };
    Object.entries(detailDefaults).forEach(([selector, value]) => {
        const element = $(selector);
        if (element) element.textContent = value;
    });
    ['#student-profile-assigned-work', '#student-insight-summary', '#detail-activity-list', '#coin-adjust-status', '#reset-password-status', '#temporary-password-output']
        .forEach(selector => {
            const element = $(selector);
            if (!element) return;
            element.innerHTML = '';
            element.textContent = '';
        });
    const coinInput = $('#coin-adjust-input');
    if (coinInput) coinInput.value = '10';
    const temporaryPassword = $('#temporary-password-output');
    if (temporaryPassword) temporaryPassword.style.display = 'none';
    $('#student-profile-content')?.classList.add('hidden');
    $('#student-profile-loading')?.classList.remove('hidden');
    const profileError = $('#student-profile-error');
    if (profileError) {
        profileError.textContent = '';
        profileError.classList.add('hidden');
    }
    const resetPasswordButton = $('#reset-student-password-btn');
    if (resetPasswordButton) resetPasswordButton.disabled = true;
    ['#select-all-students', '#select-visible-students-mobile'].forEach(selector => {
        const checkbox = $(selector);
        if (!checkbox) return;
        checkbox.checked = false;
        checkbox.indeterminate = false;
    });
    $('#bulk-action-toolbar')?.classList.add('hidden');
    const selectedCount = $('#bulk-selected-count');
    if (selectedCount) selectedCount.textContent = '0 students selected';
    const bulkCoinInput = $('#bulk-coin-input');
    if (bulkCoinInput) bulkCoinInput.value = '10';

    const addStudentForm = $('#add-student-form');
    addStudentForm?.reset();
    ['add-student-password', 'add-student-confirm-password'].forEach(inputId => {
        const input = $(`#${inputId}`);
        if (input) input.type = 'password';
        const toggle = $(`.password-toggle[aria-controls="${inputId}"]`);
        if (!toggle) return;
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', 'Show password');
        toggle.title = 'Show password';
    });
    const addStudentStatus = $('#add-student-status');
    if (addStudentStatus) {
        addStudentStatus.innerHTML = '';
        addStudentStatus.textContent = '';
    }
    const addStudentButton = $('#create-student-account-btn');
    if (addStudentButton) addStudentButton.disabled = true;
    closeModal('#add-student-modal', { restoreFocus: false });
    const csvInput = $('#student-csv-input');
    if (csvInput) csvInput.value = '';
    const csvButton = $('#import-student-csv-btn');
    if (csvButton) csvButton.disabled = false;
}

export const teacherProgressDataMethods = {
async showProgressView() {
        if (!this.ensureAuthenticated(false)) return;
        const generation = this.studentProgressSessionGeneration || 0;
        const navigation = this.captureTeacherNavigation?.();
        const current = () => generation === (this.studentProgressSessionGeneration || 0)
            && (!navigation || this.isTeacherNavigationCurrent(navigation));
        this.switchView('teacher-progress-view');

        const loadingEl = $('#progress-loading');
        const listEl = $('#student-progress-list');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';

        try {
            await this.loadStudentRosterFilters();
            if (!current()) return;
            this.populateFilters();
            await this.fetchStudentProgressPage();
            if (!current()) return;
        } catch {
            // The loader renders a retryable error without replacing good data.
        } finally {
            if (current() && loadingEl) {
                loadingEl.classList.add('hidden');
            }
        }
    },

applyStudentProgressData(data) {
        this.allStudentData = Array.isArray(data) ? data : [];
        this.filteredStudentData = [...this.allStudentData];
    },

async getStudentRosterData({ forceRefresh = false, signal, isCurrent = () => true, timeoutMs = 30000 } = {}) {
        if (this.authDisabled) {
            if (signal?.aborted || !isCurrent()) throw new DOMException('Teacher session changed.', 'AbortError');
            this.applyStudentProgressData([]);
            return [];
        }
        const generation = this.studentIdentityRosterGeneration || 0;
        const students = await requestWithTimeout(readSignal => runTeacherProgressQuery(this, {
            accountId: getTeacherProgressAccountId(this),
            key: getTeacherProgressQueryKey(this, 'identity-roster'),
            queryFn: ({ signal: querySignal }) => readIdentityRoster(this, querySignal, readSignal, timeoutMs)
        }, forceRefresh), { signal, timeoutMs, label: 'Loading student roster' });
        if (signal?.aborted || !isCurrent()) throw new DOMException('Teacher session changed.', 'AbortError');
        if (generation !== (this.studentIdentityRosterGeneration || 0)) return [];
        this.applyStudentProgressData(students || []);
        return students || [];
    },

    invalidateStudentProgressQueries() {
        return getTeacherProgressQueryService(this).invalidate({
            accountId: getTeacherProgressAccountId(this),
            key: getTeacherProgressQueryKey(this)
        });
    },

    clearStudentProgressSessionState() {
        this.rosterReadController?.abort();
        this.studentInsightYear = undefined;
        this.studentInsightRequest = (this.studentInsightRequest || 0) + 1;
        this.studentDashboardCharts?.dispose();
        this.studentDashboardCharts = null;
        this.studentProfileRequest = (this.studentProfileRequest || 0) + 1;
        this.studentProgressSessionGeneration = (this.studentProgressSessionGeneration || 0) + 1;
        this.studentIdentityRosterGeneration = (this.studentIdentityRosterGeneration || 0) + 1;
        this.studentProgressDetailGeneration = (this.studentProgressDetailGeneration || 0) + 1;
        this.studentProgressPageGeneration = (this.studentProgressPageGeneration || 0) + 1;
        this.studentRosterFiltersGeneration = (this.studentRosterFiltersGeneration || 0) + 1;
        this.studentPasswordResetGeneration = (this.studentPasswordResetGeneration || 0) + 1;
        this.studentProgressLastPage = null;
        this.studentRosterProgressById = new Map();
        this.studentProgressPage = null;
        this.studentProgressLoadState = 'idle';
        this.studentRosterFilters = null;
        globalThis.clearTimeout(this.studentProgressFilterTimer);
        this.studentProgressFilterTimer = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.selectedStudents.clear();
        this.activeStudentId = null;
        this.activeStudentProfile = null;
        this.activeStudentProfileModel = null;
        this.activeStudentProfileTab = 'overview';
        resetStudentProgressView();
    },

mergeStudentProgressDetail(detail) {
        if (!detail?.id) return null;
        const student = this.allStudentData.find(item => item.id === detail.id);
        if (!student) return detail;

        const summaryProfile = student.studentProfile || {};
        Object.assign(student, detail, {
            email: student.email || detail.email,
            mustChangePassword: student.mustChangePassword,
            studentProfile: {
                ...(detail.studentProfile || {}),
                ...summaryProfile
            },
            progressDetailLoaded: true
        });
        return student;
    },

async ensureStudentProgressDetail(student, { forceRefresh = false } = {}) {
        if (!student?.id) throw new Error('Student progress cannot be loaded without an ID.');

        const generation = this.studentProgressDetailGeneration || 0;
        const detail = await runTeacherProgressQuery(this, {
            accountId: getTeacherProgressAccountId(this),
            key: getTeacherProgressQueryKey(this, 'detail', student.id),
            queryFn: ({ signal }) => supabaseService.getStudentProgressForTeacher(student.id, { signal })
        }, forceRefresh);
        if (generation !== (this.studentProgressDetailGeneration || 0)) return null;
        return this.mergeStudentProgressDetail(detail) || student;
    },

    async ensureStudentProgressDetails(studentIds = []) {
        const generation = this.studentProgressDetailGeneration || 0;
        const requestedIds = new Set(studentIds.filter(Boolean));
        const pendingIds = this.allStudentData
            .filter(student => requestedIds.has(student.id) && !student.progressDetailLoaded)
            .map(student => student.id);
        if (pendingIds.length === 0) return;

        for (let index = 0; index < pendingIds.length; index += 100) {
            const ids = pendingIds.slice(index, index + 100);
            const details = await getTeacherProgressQueryService(this).ensure({
                accountId: getTeacherProgressAccountId(this),
                key: getTeacherProgressQueryKey(this, 'detail-batch', ids),
                queryFn: ({ signal }) => supabaseService.getStudentsProgressForTeacher(ids, { signal })
            });
            if (generation !== (this.studentProgressDetailGeneration || 0)) return;
            details.forEach(detail => this.mergeStudentProgressDetail(detail));
        }
    },

populateFilters() {
        const grades = new Set((this.studentRosterFilters?.grades || []).map(String));

        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            if (profile.grade) grades.add(profile.grade);
        });

        const gradeSelect = $('#filter-grade');

        if (gradeSelect) {
            const selectedGrade = gradeSelect.value;
            gradeSelect.innerHTML = '<option value="">All Grades</option>';
            Array.from(grades).sort().forEach(g => {
                const opt = createElement('option');
                opt.value = g;
                opt.textContent = g;
                gradeSelect.appendChild(opt);
            });
            if (grades.has(selectedGrade)) gradeSelect.value = selectedGrade;
        }

        this.populateSectionFilterOptions();
    },

populateSectionFilterOptions(grade = $('#filter-grade')?.value || '', selectedGroup = $('#filter-group')?.value || '') {
        const groupSelect = $('#filter-group');
        if (groupSelect) {
            const sections = this.getAvailableSectionsForGrade(grade);
            groupSelect.innerHTML = '<option value="">All Sections</option>';
            Array.from(sections).sort().forEach(g => {
                const opt = createElement('option');
                opt.value = g;
                opt.textContent = g;
                groupSelect.appendChild(opt);
            });
            groupSelect.value = sections.has(selectedGroup) ? selectedGroup : '';
        }

        return groupSelect?.value || '';
    },

getAvailableSectionsForGrade(grade = '') {
        const configured = (this.studentRosterFilters?.classes || []).reduce((sections, item) => {
            if ((!grade || item.grade === String(grade)) && item.section) sections.add(item.section);
            return sections;
        }, new Set());
        if (configured.size) return configured;
        return this.allStudentData.reduce((sections, student) => {
            const profile = student.studentProfile || {};
            if ((!grade || profile.grade === grade) && profile.group) {
                sections.add(profile.group);
            }
            return sections;
        }, new Set());
    },

async applyFilters() {
        const grade = $('#filter-grade')?.value || '';
        this.populateSectionFilterOptions(grade, $('#filter-group')?.value || '');
        try {
            await this.fetchStudentProgressPage({ resetPage: true });
        } catch {
            // The stale/error state and retry action are rendered by the loader.
        }
    }
};
