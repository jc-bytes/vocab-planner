import { $, closeModal, createElement, notifications } from '../main.js';
import { supabaseService } from '../supabaseService.js';
import { teacherPageRegistry } from '../teacherPageRegistry.js';

const STUDENTS_PAGE = teacherPageRegistry.get('students');

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
    ['#detail-activity-list', '#coin-adjust-status', '#reset-password-status', '#temporary-password-output']
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
    const resetPasswordButton = $('#reset-student-password-btn');
    if (resetPasswordButton) resetPasswordButton.disabled = false;
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

    closeModal('#student-detail-modal', { restoreFocus: false });
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
    if (addStudentButton) addStudentButton.disabled = false;
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
        this.switchView(STUDENTS_PAGE.viewId);

        const loadingEl = $('#progress-loading');
        const listEl = $('#student-progress-list');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';

        try {
            await this.loadStudentRosterFilters();
            if (generation !== (this.studentProgressSessionGeneration || 0)) return;
            this.populateFilters();
            await this.fetchStudentProgressPage();
            if (generation !== (this.studentProgressSessionGeneration || 0)) return;
        } catch {
            // The loader renders a retryable error without replacing good data.
        } finally {
            if (generation === (this.studentProgressSessionGeneration || 0) && loadingEl) {
                loadingEl.classList.add('hidden');
            }
        }
    },

async fetchAllStudentProgress(options = {}) {
        try {
            return await this.getStudentProgressData(options);
        } catch (error) {
            this.setStudentProgressLoadState(this.allStudentData.length ? 'stale' : 'error');
            throw error;
        }
    },

applyStudentProgressData(data) {
        this.allStudentData = Array.isArray(data) ? data : [];
        this.filteredStudentData = [...this.allStudentData];
    },

async getStudentProgressData({ forceRefresh = false, showError = true } = {}) {
        const generation = this.studentProgressSessionGeneration || 0;
        if (this.authDisabled) {
            this.applyStudentProgressData([]);
            this.studentProgressCache = {
                data: [],
                loadedAt: Date.now()
            };
            return [];
        }

        if (!forceRefresh && this.studentProgressCache) {
            this.applyStudentProgressData(this.studentProgressCache.data);
            return this.studentProgressCache.data;
        }

        if (!forceRefresh && this.studentProgressPromise) {
            try {
                const data = await this.studentProgressPromise;
                if (generation !== (this.studentProgressSessionGeneration || 0)) {
                    return [];
                }
                this.applyStudentProgressData(data);
                return data;
            } catch (error) {
                if (generation !== (this.studentProgressSessionGeneration || 0)) {
                    return [];
                }
                if (showError) {
                    notifications.error('Failed to load student data.');
                }
                throw error;
            }
        }

        const request = supabaseService.getStudentsWithProgress()
            .then(data => {
                if (generation !== (this.studentProgressSessionGeneration || 0)) return [];
                this.studentProgressCache = {
                    data,
                    loadedAt: Date.now()
                };
                this.applyStudentProgressData(data);
                return data;
            })
            .catch(error => {
                if (generation !== (this.studentProgressSessionGeneration || 0)) return [];
                console.error('Error fetching student progress:', error);
                if (showError) {
                    notifications.error('Failed to load student data.');
                }
                throw error;
            })
            .finally(() => {
                if (this.studentProgressPromise === request) this.studentProgressPromise = null;
            });
        this.studentProgressPromise = request;

        return request;
    },

async getStudentRosterData({ forceRefresh = false } = {}) {
        if (this.authDisabled) {
            this.applyStudentProgressData([]);
            return [];
        }

        if (forceRefresh) this.studentIdentityRosterCache = null;
        if (!this.studentIdentityRosterCache) {
            const generation = this.studentIdentityRosterGeneration || 0;
            let request = this.studentIdentityRosterPromise;
            if (!request) {
                request = supabaseService.listStudentIdentityRoster()
                    .then(students => {
                        if (generation !== (this.studentIdentityRosterGeneration || 0)) return [];
                        this.studentIdentityRosterCache = students;
                        return students;
                    })
                    .finally(() => {
                        if (this.studentIdentityRosterPromise === request) this.studentIdentityRosterPromise = null;
                    });
                this.studentIdentityRosterPromise = request;
            }
            await request;
            if (generation !== (this.studentIdentityRosterGeneration || 0)) return [];
        }

        this.applyStudentProgressData(this.studentIdentityRosterCache || []);
        return this.studentIdentityRosterCache || [];
    },

clearStudentProgressSessionState() {
        this.studentProgressSessionGeneration = (this.studentProgressSessionGeneration || 0) + 1;
        this.studentIdentityRosterGeneration = (this.studentIdentityRosterGeneration || 0) + 1;
        this.studentProgressDetailGeneration = (this.studentProgressDetailGeneration || 0) + 1;
        this.studentProgressPageGeneration = (this.studentProgressPageGeneration || 0) + 1;
        this.studentRosterFiltersGeneration = (this.studentRosterFiltersGeneration || 0) + 1;
        this.studentPasswordResetGeneration = (this.studentPasswordResetGeneration || 0) + 1;
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.studentIdentityRosterCache = null;
        this.studentIdentityRosterPromise = null;
        this.studentProgressPageCache = null;
        this.studentProgressLastPage = null;
        this.studentProgressPage = null;
        this.studentProgressLoadState = 'idle';
        this.studentRosterFilters = null;
        globalThis.clearTimeout(this.studentProgressFilterTimer);
        this.studentProgressFilterTimer = null;
        this.studentProgressDetailPromises?.clear();
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.selectedStudents.clear();
        this.activeStudentId = null;
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
        if (!forceRefresh && student.progressDetailLoaded) return student;

        this.studentProgressDetailPromises ||= new Map();
        if (!forceRefresh && this.studentProgressDetailPromises.has(student.id)) {
            return this.studentProgressDetailPromises.get(student.id);
        }

        const generation = this.studentProgressDetailGeneration || 0;
        const request = supabaseService.getStudentProgressForTeacher(student.id)
            .then(detail => {
                if (generation !== (this.studentProgressDetailGeneration || 0)) return null;
                return this.mergeStudentProgressDetail(detail) || student;
            })
            .finally(() => {
                if (this.studentProgressDetailPromises.get(student.id) === request) {
                    this.studentProgressDetailPromises.delete(student.id);
                }
            });
        this.studentProgressDetailPromises.set(student.id, request);
        return request;
    },

    async ensureStudentProgressDetails(studentIds = []) {
        const generation = this.studentProgressDetailGeneration || 0;
        const requestedIds = new Set(studentIds.filter(Boolean));
        const pendingIds = this.allStudentData
            .filter(student => requestedIds.has(student.id) && !student.progressDetailLoaded)
            .map(student => student.id);
        if (pendingIds.length === 0) return;

        for (let index = 0; index < pendingIds.length; index += 100) {
            const details = await supabaseService.getStudentsProgressForTeacher(
                pendingIds.slice(index, index + 100)
            );
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
