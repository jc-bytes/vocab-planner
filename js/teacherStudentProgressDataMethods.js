import { $, closeModal, createElement, notifications, openModal } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';

const STUDENT_EMAIL_DOMAIN = '@aid.edu.pa';

class TeacherStudentProgressDataMethods {
    async showProgressView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-progress-view');

        const loadingEl = $('#progress-loading');
        const listEl = $('#student-progress-list');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';

        await this.fetchAllStudentProgress();
        this.populateFilters();
        this.applyFilters();
        this.initExportListeners();
        this.populateExportGradeSelect();
        this.initDataViewer();

        if (loadingEl) loadingEl.classList.add('hidden');
    }

    async fetchAllStudentProgress(options = {}) {
        try {
            return await this.getStudentProgressData(options);
        } catch {
            this.applyStudentProgressData([]);
            return [];
        }
    }

    applyStudentProgressData(data) {
        this.allStudentData = Array.isArray(data) ? data : [];
        this.filteredStudentData = [...this.allStudentData];
    }

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

        this.studentProgressPromise = supabaseService.getStudentsWithProgress()
            .then(data => {
                this.studentProgressCache = {
                    data,
                    loadedAt: Date.now()
                };
                this.applyStudentProgressData(data);
                return data;
            })
            .catch(error => {
                console.error('Error fetching student progress:', error);
                if (showError) {
                    notifications.error('Failed to load student data.');
                }
                throw error;
            })
            .finally(() => {
                this.studentProgressPromise = null;
            });

        return this.studentProgressPromise;
    }

    populateFilters() {
        const grades = new Set();

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
    }

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
    }

    getAvailableSectionsForGrade(grade = '') {
        return this.allStudentData.reduce((sections, student) => {
            const profile = student.studentProfile || {};
            if ((!grade || profile.grade === grade) && profile.group) {
                sections.add(profile.group);
            }
            return sections;
        }, new Set());
    }

    applyFilters() {
        const grade = $('#filter-grade')?.value || '';
        const group = this.populateSectionFilterOptions(grade, $('#filter-group')?.value || '');
        const search = ($('#filter-search')?.value || '').toLowerCase();

        this.filteredStudentData = this.allStudentData.filter(student => {
            const profile = student.studentProfile || {};
            const name = (profile.firstName + ' ' + profile.lastName).toLowerCase();

            const matchGrade = !grade || profile.grade === grade;
            const matchGroup = !group || profile.group === group;
            const matchSearch = !search || name.includes(search);

            return matchGrade && matchGroup && matchSearch;
        });

        this.renderProgressTable();
    }

    showAddStudentModal() {
        if (this.authDisabled) {
            notifications.warning('Student accounts can only be created when Supabase auth is enabled.');
            return;
        }

        const form = $('#add-student-form');
        form?.reset();
        this.updateAddStudentStatus('');
        openModal('#add-student-modal', { initialFocus: '#add-student-first-name' });
    }

    updateAddStudentStatus(message, state = 'muted') {
        const status = $('#add-student-status');
        if (!status) return;

        const colors = {
            error: 'var(--danger-color)',
            muted: 'var(--text-muted)',
            success: 'var(--accent-color)'
        };

        status.style.color = colors[state] || colors.muted;
        status.textContent = message;
    }

    validateAddStudentForm() {
        const firstName = $('#add-student-first-name')?.value.trim() || '';
        const lastName = $('#add-student-last-name')?.value.trim() || '';
        const email = $('#add-student-email')?.value.trim().toLowerCase() || '';
        const grade = $('#add-student-grade')?.value || '';
        const section = ($('#add-student-section')?.value || '').trim().toUpperCase();
        const password = $('#add-student-password')?.value || '';
        const confirmPassword = $('#add-student-confirm-password')?.value || '';

        if (!firstName || !lastName || !email || !grade || !section || !password) {
            throw new Error('Complete every student field.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Enter a valid school email address.');
        }

        if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) {
            throw new Error(`Use the ${STUDENT_EMAIL_DOMAIN} school email domain.`);
        }

        if (!/^[6-9]$/.test(grade)) {
            throw new Error('Choose grade 6, 7, 8, or 9.');
        }

        if (!/^[A-Z]$/.test(section)) {
            throw new Error('Section must be one letter.');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        return {
            profile: {
                firstName,
                lastName,
                email,
                grade,
                group: section
            },
            password
        };
    }

    async handleAddStudentSubmit(event) {
        event.preventDefault();

        let payload;
        try {
            payload = this.validateAddStudentForm();
        } catch (error) {
            this.updateAddStudentStatus(error.message, 'error');
            return;
        }

        const submitButton = $('#create-student-account-btn');
        try {
            if (submitButton) submitButton.disabled = true;
            this.updateAddStudentStatus('Creating student account...', 'muted');

            await supabaseService.createStudentAccount(payload.profile, payload.password);

            this.studentProgressCache = null;
            await this.fetchAllStudentProgress({ forceRefresh: true });
            this.populateFilters();
            this.applyFilters();
            closeModal('#add-student-modal');
            notifications.success(`Added ${payload.profile.firstName} ${payload.profile.lastName}.`);
        } catch (error) {
            console.error('Failed to create student account:', error);
            this.updateAddStudentStatus(error.message || 'Could not create student account.', 'error');
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    showStudentCsvPicker() {
        if (this.authDisabled) {
            notifications.warning('CSV import can only create accounts when Supabase auth is enabled.');
            return;
        }

        if (!this.ensureAuthenticated(false)) return;
        this.updateStudentImportStatus('');
        $('#student-csv-input')?.click();
    }

    updateStudentImportStatus(message, state = 'muted') {
        const status = $('#student-roster-import-status');
        if (!status) return;

        const colors = {
            error: 'var(--danger-color)',
            muted: 'var(--text-muted)',
            success: 'var(--accent-color)'
        };

        status.style.color = colors[state] || colors.muted;
        status.textContent = message;
    }

    async handleStudentCsvImportFiles(fileList) {
        const files = Array.from(fileList || []).filter(file => /\.csv$/i.test(file.name));
        if (files.length === 0) return;

        let records = [];
        try {
            this.updateStudentImportStatus(`Reading ${files.length} CSV file${files.length === 1 ? '' : 's'}...`);
            const recordGroups = await Promise.all(files.map(file => this.parseStudentCsvFile(file)));
            records = recordGroups.flat();
        } catch (error) {
            console.error('Failed to read student CSV files:', error);
            this.updateStudentImportStatus(error.message || 'Could not read the selected CSV files.', 'error');
            return;
        }

        if (records.length === 0) {
            this.updateStudentImportStatus('No student rows were found in the selected CSV files.', 'error');
            return;
        }

        const confirmed = confirm(
            `Create ${records.length} student account${records.length === 1 ? '' : 's'} from ${files.length} CSV file${files.length === 1 ? '' : 's'}?`
        );
        if (!confirmed) {
            this.updateStudentImportStatus('');
            return;
        }

        const importButton = $('#import-student-csv-btn');
        let created = 0;
        const failed = [];

        try {
            if (importButton) importButton.disabled = true;

            for (let index = 0; index < records.length; index += 1) {
                const record = records[index];
                this.updateStudentImportStatus(
                    `Creating ${index + 1} of ${records.length}: ${record.profile.firstName} ${record.profile.lastName} (${record.profile.grade}${record.profile.group})...`
                );

                try {
                    await supabaseService.createStudentAccount(record.profile, record.password);
                    created += 1;
                } catch (error) {
                    failed.push({
                        record,
                        message: error.message || 'Could not create account.'
                    });
                }
            }

            if (created > 0) {
                this.studentProgressCache = null;
                await this.fetchAllStudentProgress({ forceRefresh: true });
                this.populateFilters();
                this.applyFilters();
            }

            const summary = `${created} created${failed.length ? `, ${failed.length} skipped or failed` : ''}.`;
            if (failed.length) {
                const sample = failed
                    .slice(0, 3)
                    .map(item => `${item.record.profile.email}: ${item.message}`)
                    .join(' | ');
                this.updateStudentImportStatus(`${summary} ${sample}`, 'error');
                notifications.warning(summary);
            } else {
                this.updateStudentImportStatus(summary, 'success');
                notifications.success(summary);
            }
        } finally {
            if (importButton) importButton.disabled = false;
        }
    }

    async parseStudentCsvFile(file) {
        const placement = this.getGradeSectionFromStudentCsvName(file.name);
        if (!placement) {
            throw new Error(`${file.name} must be named like 6A.csv, 7B.csv, etc.`);
        }

        const text = await file.text();
        return this.parseStudentCsvText(text, file.name, placement);
    }

    getGradeSectionFromStudentCsvName(fileName) {
        const match = String(fileName || '').trim().match(/^([6-9])([a-z])(?:\b|\.|_|-)/i);
        if (!match) return null;
        return {
            grade: match[1],
            section: match[2].toUpperCase()
        };
    }

    parseStudentCsvText(text, fileName, placement) {
        const rows = this.parseCsvRows(text);
        if (rows.length < 2) return [];

        const headers = rows[0].map(header => this.normalizeStudentCsvHeader(header));
        return rows.slice(1).map((cells, index) => {
            const row = new Map();
            headers.forEach((header, cellIndex) => {
                row.set(header, String(cells[cellIndex] || '').trim());
            });

            return this.normalizeStudentCsvRecord(row, fileName, index + 2, placement);
        });
    }

    parseCsvRows(text) {
        const rows = [];
        let row = [];
        let cell = '';
        let inQuotes = false;
        const source = String(text || '').replace(/^\uFEFF/, '');

        for (let index = 0; index < source.length; index += 1) {
            const char = source[index];
            const nextChar = source[index + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    cell += '"';
                    index += 1;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') index += 1;
                row.push(cell);
                if (row.some(value => String(value || '').trim())) rows.push(row);
                row = [];
                cell = '';
                continue;
            }

            cell += char;
        }

        row.push(cell);
        if (row.some(value => String(value || '').trim())) rows.push(row);
        return rows;
    }

    normalizeStudentCsvHeader(header) {
        return String(header || '')
            .replace(/^\uFEFF/, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    getStudentCsvValue(row, keys) {
        for (const key of keys) {
            const normalizedKey = this.normalizeStudentCsvHeader(key);
            const value = row.get(normalizedKey);
            if (value) return value;
        }
        return '';
    }

    normalizeStudentCsvRecord(row, fileName, rowNumber, placement) {
        const firstName = this.getStudentCsvValue(row, ['primer nombre', 'first name', 'firstname', 'nombre']);
        const lastName = this.getStudentCsvValue(row, ['primer apellido', 'last name', 'lastname', 'apellido']);
        const email = this.getStudentCsvValue(row, ['correo', 'email', 'e-mail', 'correo electronico']).toLowerCase();
        const password = this.getStudentCsvValue(row, ['contrasena', 'contraseña', 'password', 'pass']);

        if (!firstName || !lastName || !email || !password) {
            throw new Error(`${fileName}, row ${rowNumber}: first name, last name, email, and password are required.`);
        }

        return {
            sourceFile: fileName,
            rowNumber,
            profile: {
                firstName,
                lastName,
                email,
                grade: placement.grade,
                group: placement.section
            },
            password
        };
    }
}

export function installTeacherStudentProgressDataMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherStudentProgressDataMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherStudentProgressDataMethods.prototype, name)
        );
    }
}
