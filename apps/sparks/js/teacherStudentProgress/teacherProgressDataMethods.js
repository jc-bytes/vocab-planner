import { $, createElement, notifications } from '../main.js';
import { supabaseService } from '../supabaseService.js';

export const teacherProgressDataMethods = {
async showProgressView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-progress-view');

        const loadingEl = $('#progress-loading');
        const listEl = $('#student-progress-list');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';

        try {
            await this.loadStudentRosterFilters();
            this.populateFilters();
            await this.fetchStudentProgressPage();
        } catch {
            // The loader renders a retryable error without replacing good data.
        } finally {
            if (loadingEl) loadingEl.classList.add('hidden');
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
                this.applyStudentProgressData(data);
                return data;
            } catch (error) {
                if (showError) {
                    notifications.error('Failed to load student data.');
                }
                throw error;
            }
        }

        const generation = this.studentProgressSessionGeneration || 0;
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
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.studentIdentityRosterCache = null;
        this.studentIdentityRosterPromise = null;
        this.studentProgressDetailPromises?.clear();
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.selectedStudents.clear();
        this.activeStudentId = null;
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
