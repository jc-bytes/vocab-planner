import { $, createElement, notifications } from './main.js';
import { setInlineStatus } from './ui/inlineStatus.js';
import {
    canonicalStudentPair,
    teacherGroupRestrictionsRepository
} from './services/teacherGroupRestrictionsRepository.js';
import {
    getStudentClassKey,
    getStudentDisplayName,
    randomizeStudentsWithRestrictions
} from './teacherGroupsLogic.js';

function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

class TeacherGroupsFeature {
    constructor({
        ensureAuthenticated,
        showView,
        loadRoster,
        getSession,
        refreshIcons,
        repository = teacherGroupRestrictionsRepository,
        feedback = notifications,
        storage = globalThis.localStorage,
        clipboard = globalThis.navigator?.clipboard,
        createRestrictionId = () => globalThis.crypto?.randomUUID?.() || `restriction-${Date.now()}`,
        query = $
    }) {
        this.ensureAuthenticated = ensureAuthenticated;
        this.showView = showView;
        this.loadRoster = loadRoster;
        this.getSession = getSession;
        this.refreshIcons = refreshIcons;
        this.repository = repository;
        this.feedback = feedback;
        this.storage = storage;
        this.clipboard = clipboard;
        this.createRestrictionId = createRestrictionId;
        this.query = query;

        this.selectedClass = '';
        this.roster = [];
        this.absentStudents = new Set();
        this.randomGroups = [];
        this.pairRestrictions = [];
        this.usesLocalRestrictionFallback = false;
        this.listenersBound = false;
        this.listenerDisposers = [];
        this.lifecycleGeneration = 0;
        this.showGeneration = 0;
        this.destroyed = false;
    }

    async show() {
        if (this.destroyed) return;
        if (!this.ensureAuthenticated(false)) return;
        const lifecycleGeneration = this.lifecycleGeneration;
        const showGeneration = ++this.showGeneration;
        this.bindListeners();
        this.showView();
        this.setGroupGeneratorStatus('Loading your class roster…');

        try {
            const [roster] = await Promise.all([
                this.loadRoster(),
                this.loadGroupPairRestrictions({ lifecycleGeneration, showGeneration })
            ]);
            if (!this.isCurrent({ lifecycleGeneration, showGeneration })) return;
            this.roster = Array.isArray(roster) ? roster : [];
            this.populateGroupClassSelect();
            this.renderGroupStudentList();
            this.setGroupGeneratorStatus('');
        } catch (error) {
            if (!this.isCurrent({ lifecycleGeneration, showGeneration })) return;
            console.error('Could not load group generator roster:', error);
            this.setGroupGeneratorStatus('The class roster could not be loaded. Please try again.', 'error');
        }
    }

    isCurrent({ lifecycleGeneration, showGeneration = this.showGeneration }) {
        return !this.destroyed
            && lifecycleGeneration === this.lifecycleGeneration
            && showGeneration === this.showGeneration;
    }

    bindListeners() {
        if (this.listenersBound) return;
        this.listenersBound = true;

        this.addListener('#group-class-select', 'change', event => {
            this.handleGroupClassChange(event.currentTarget.value);
        });
        this.addListener('#group-student-list', 'change', event => {
            const checkbox = event.target.closest('input[data-student-id]');
            if (checkbox) this.toggleGroupStudentAbsent(checkbox.dataset.studentId, checkbox.checked);
        });
        this.addListener('#clear-group-absences-btn', 'click', () => this.clearGroupAbsences());
        this.addListener('#save-group-restriction-btn', 'click', () => this.saveGroupPairRestriction());
        this.addListener('#group-restriction-list', 'click', event => {
            const button = event.target.closest('button[data-restriction-id]');
            if (button) this.removeGroupPairRestriction(button.dataset.restrictionId);
        });
        this.addListener('#randomize-groups-btn', 'click', () => this.generateRandomGroups());
        this.addListener('#copy-groups-btn', 'click', () => this.copyRandomGroups());
    }

    addListener(selector, type, handler) {
        const element = this.query(selector);
        if (!element) return;
        element.addEventListener(type, handler);
        this.listenerDisposers.push(() => element.removeEventListener(type, handler));
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.lifecycleGeneration += 1;
        this.showGeneration += 1;
        this.listenerDisposers.splice(0).forEach(dispose => dispose());
        this.listenersBound = false;
        this.selectedClass = '';
        this.roster = [];
        this.absentStudents.clear();
        this.randomGroups = [];
        this.pairRestrictions = [];
        this.usesLocalRestrictionFallback = false;
        this.resetView();
    }

    resetView() {
        const classSelect = this.query('#group-class-select');
        if (classSelect) {
            classSelect.innerHTML = '<option value="">Select a class</option>';
            classSelect.value = '';
        }
        const groupSize = this.query('#group-size-select');
        if (groupSize) groupSize.value = '2';
        const summary = this.query('#group-roster-summary');
        if (summary) summary.textContent = '0 students';
        const studentList = this.query('#group-student-list');
        if (studentList) {
            studentList.innerHTML = '<p class="teacher-empty-state">Select a class to see its students.</p>';
        }
        ['#group-restriction-student-a', '#group-restriction-student-b'].forEach(selector => {
            const select = this.query(selector);
            if (!select) return;
            select.innerHTML = '<option value="">Choose a student</option>';
            select.value = '';
        });
        const restrictionCount = this.query('#group-restriction-count');
        if (restrictionCount) restrictionCount.textContent = '0 saved';
        const restrictionList = this.query('#group-restriction-list');
        if (restrictionList) {
            restrictionList.innerHTML = '<p class="teacher-empty-state">Select a class to manage its pairing restrictions.</p>';
        }
        const randomizeButton = this.query('#randomize-groups-btn');
        if (randomizeButton) randomizeButton.disabled = true;
        const saveButton = this.query('#save-group-restriction-btn');
        if (saveButton) saveButton.disabled = false;
        this.query('#copy-groups-btn')?.classList.add('hidden');
        const results = this.query('#group-results');
        if (results) {
            results.innerHTML = `
                <div class="group-results-empty">
                    <i data-lucide="users-round"></i>
                    <h4>Ready when you are</h4>
                    <p>Your randomized groups will appear here.</p>
                </div>
            `;
            this.refreshIcons(results);
        }
        this.setGroupRestrictionStatus('');
        this.setGroupGeneratorStatus('');
    }

    populateGroupClassSelect() {
        const select = this.query('#group-class-select');
        if (!select) return;

        const previous = select.value || this.selectedClass || '';
        const classKeys = [...new Set(this.roster.map(getStudentClassKey).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        select.innerHTML = '<option value="">Select a class</option>';
        classKeys.forEach(classKey => {
            const option = createElement('option');
            option.value = classKey;
            option.textContent = classKey;
            select.appendChild(option);
        });

        const nextClass = classKeys.includes(previous) ? previous : (classKeys[0] || '');
        select.value = nextClass;
        this.selectedClass = nextClass;
        this.loadTodayGroupAbsences();
    }

    getSelectedGroupStudents() {
        return this.roster
            .filter(student => getStudentClassKey(student) === this.selectedClass)
            .sort((a, b) => getStudentDisplayName(a).localeCompare(getStudentDisplayName(b)));
    }

    groupAbsenceStorageKey() {
        return `teacher_group_absences:${this.getSessionOwnerId()}:${localDateKey()}:${this.selectedClass || 'none'}`;
    }

    loadTodayGroupAbsences() {
        try {
            const saved = JSON.parse(this.storage.getItem(this.groupAbsenceStorageKey()) || '[]');
            this.absentStudents = new Set(Array.isArray(saved) ? saved : []);
        } catch {
            this.absentStudents = new Set();
        }
    }

    saveTodayGroupAbsences() {
        try {
            this.storage.setItem(this.groupAbsenceStorageKey(), JSON.stringify([...this.absentStudents]));
        } catch {
            // Grouping still works if private browsing blocks local storage.
        }
    }

    handleGroupClassChange(classKey) {
        this.selectedClass = classKey;
        this.loadTodayGroupAbsences();
        this.randomGroups = [];
        this.renderGroupStudentList();
        this.renderGroupRestrictionSettings();
        this.renderRandomGroups();
    }

    toggleGroupStudentAbsent(studentId, absent) {
        if (absent) this.absentStudents.add(studentId);
        else this.absentStudents.delete(studentId);
        this.saveTodayGroupAbsences();
        this.renderGroupStudentList();
        this.randomGroups = [];
        this.renderRandomGroups();
    }

    clearGroupAbsences() {
        this.absentStudents.clear();
        this.saveTodayGroupAbsences();
        this.renderGroupStudentList();
        this.randomGroups = [];
        this.renderRandomGroups();
    }

    renderGroupStudentList() {
        const list = this.query('#group-student-list');
        const summary = this.query('#group-roster-summary');
        const randomizeButton = this.query('#randomize-groups-btn');
        if (!list) return;

        const students = this.getSelectedGroupStudents();
        const presentCount = students.filter(student => !this.absentStudents.has(student.id)).length;
        const absentCount = students.length - presentCount;

        if (summary) {
            summary.textContent = this.selectedClass
                ? `${presentCount} present · ${absentCount} absent`
                : `${this.roster.length} students`;
        }
        if (randomizeButton) randomizeButton.disabled = presentCount < 2;

        list.innerHTML = '';
        if (!this.selectedClass) {
            list.innerHTML = '<p class="teacher-empty-state">Select a class to see its students.</p>';
            this.renderGroupRestrictionSettings();
            return;
        }
        if (!students.length) {
            list.innerHTML = '<p class="teacher-empty-state">No students were found in this class.</p>';
            this.renderGroupRestrictionSettings();
            return;
        }

        students.forEach(student => {
            const absent = this.absentStudents.has(student.id);
            const label = createElement('label', `group-student-toggle${absent ? ' is-absent' : ''}`);
            const checkbox = createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = absent;
            checkbox.dataset.studentId = student.id;
            checkbox.setAttribute('aria-label', `Mark ${getStudentDisplayName(student)} absent`);

            const indicator = createElement('span', 'group-student-check');
            indicator.setAttribute('aria-hidden', 'true');
            const name = createElement('span', 'group-student-name', getStudentDisplayName(student));
            const status = createElement('span', 'group-student-status', absent ? 'Absent' : 'Present');
            label.append(checkbox, indicator, name, status);
            list.appendChild(label);
        });
        this.renderGroupRestrictionSettings();
    }

    groupRestrictionsStorageKey() {
        return `teacher_group_pair_restrictions:${this.getSessionOwnerId()}`;
    }

    getSessionOwnerId() {
        const { currentUser } = this.getSession();
        return currentUser?.uid || currentUser?.id || 'development-teacher';
    }

    async loadGroupPairRestrictions({
        lifecycleGeneration = this.lifecycleGeneration,
        showGeneration = this.showGeneration
    } = {}) {
        const { authDisabled } = this.getSession();
        if (authDisabled || this.usesLocalRestrictionFallback) {
            try {
                const saved = JSON.parse(this.storage.getItem(this.groupRestrictionsStorageKey()) || '[]');
                this.pairRestrictions = Array.isArray(saved) ? saved : [];
            } catch {
                this.pairRestrictions = [];
            }
            return this.pairRestrictions;
        }

        try {
            const restrictions = await this.repository.list();
            if (!this.isCurrent({ lifecycleGeneration, showGeneration })) return [];
            this.pairRestrictions = restrictions;
        } catch (error) {
            if (!this.isCurrent({ lifecycleGeneration, showGeneration })) return [];
            console.error('Could not load teacher group restrictions:', error);
            this.usesLocalRestrictionFallback = true;
            try {
                const saved = JSON.parse(this.storage.getItem(this.groupRestrictionsStorageKey()) || '[]');
                this.pairRestrictions = Array.isArray(saved) ? saved : [];
            } catch {
                this.pairRestrictions = [];
            }
            this.setGroupRestrictionStatus(
                'Restrictions are private and saved on this device.',
                'muted'
            );
        }
        return this.pairRestrictions;
    }

    saveDevelopmentGroupRestrictions() {
        try {
            this.storage.setItem(
                this.groupRestrictionsStorageKey(),
                JSON.stringify(this.pairRestrictions)
            );
        } catch {
            // Development-only fallback; production restrictions use Supabase.
        }
    }

    getCurrentClassRestrictionStudents() {
        return new Set(this.getSelectedGroupStudents().map(student => student.id));
    }

    getCurrentClassRestrictions() {
        const classStudentIds = this.getCurrentClassRestrictionStudents();
        return this.pairRestrictions.filter(restriction => (
            classStudentIds.has(restriction.studentAId)
            && classStudentIds.has(restriction.studentBId)
        ));
    }

    renderGroupRestrictionSettings() {
        const studentASelect = this.query('#group-restriction-student-a');
        const studentBSelect = this.query('#group-restriction-student-b');
        const list = this.query('#group-restriction-list');
        const count = this.query('#group-restriction-count');
        if (!studentASelect || !studentBSelect || !list) return;

        const students = this.getSelectedGroupStudents();
        const selectedA = studentASelect.value;
        const selectedB = studentBSelect.value;
        [studentASelect, studentBSelect].forEach(select => {
            select.innerHTML = '<option value="">Choose a student</option>';
            students.forEach(student => {
                const option = createElement('option');
                option.value = student.id;
                option.textContent = getStudentDisplayName(student);
                select.appendChild(option);
            });
        });
        if (students.some(student => student.id === selectedA)) studentASelect.value = selectedA;
        if (students.some(student => student.id === selectedB)) studentBSelect.value = selectedB;

        const restrictions = this.getCurrentClassRestrictions();
        if (count) count.textContent = `${restrictions.length} saved`;
        list.innerHTML = '';

        if (!this.selectedClass) {
            list.innerHTML = '<p class="teacher-empty-state">Select a class to manage its pairing restrictions.</p>';
            return;
        }
        if (!restrictions.length) {
            list.innerHTML = '<p class="teacher-empty-state">No pairing restrictions saved for this class.</p>';
            return;
        }

        const studentById = new Map(students.map(student => [student.id, student]));
        restrictions.forEach(restriction => {
            const row = createElement('div', 'group-restriction-row');
            const names = createElement('span', 'group-restriction-names');
            names.textContent = `${getStudentDisplayName(studentById.get(restriction.studentAId))} + ${getStudentDisplayName(studentById.get(restriction.studentBId))}`;
            const badge = createElement('span', 'group-restriction-badge', 'Never together');
            const removeButton = createElement('button', 'btn text-btn group-restriction-remove');
            removeButton.type = 'button';
            removeButton.dataset.restrictionId = restriction.id;
            removeButton.setAttribute('aria-label', `Remove restriction for ${names.textContent}`);
            removeButton.innerHTML = '<i data-lucide="trash-2"></i><span>Remove</span>';
            row.append(names, badge, removeButton);
            list.appendChild(row);
        });
        this.refreshIcons(list);
    }

    setGroupRestrictionStatus(message, state = 'muted') {
        const status = this.query('#group-restriction-status');
        if (!status) return;
        setInlineStatus(status, message, state);
    }

    async saveGroupPairRestriction() {
        const lifecycleGeneration = this.lifecycleGeneration;
        const studentAId = this.query('#group-restriction-student-a')?.value || '';
        const studentBId = this.query('#group-restriction-student-b')?.value || '';
        if (!studentAId || !studentBId) {
            this.setGroupRestrictionStatus('Choose both students.', 'error');
            return;
        }
        if (studentAId === studentBId) {
            this.setGroupRestrictionStatus('Choose two different students.', 'error');
            return;
        }

        const pair = canonicalStudentPair(studentAId, studentBId);
        const alreadySaved = this.pairRestrictions.some(restriction => (
            restriction.studentAId === pair.studentAId
            && restriction.studentBId === pair.studentBId
        ));
        if (alreadySaved) {
            this.setGroupRestrictionStatus('That pairing restriction is already saved.', 'error');
            return;
        }

        const saveButton = this.query('#save-group-restriction-btn');
        try {
            if (saveButton) saveButton.disabled = true;
            let restriction;
            const { authDisabled, currentUser } = this.getSession();
            if (authDisabled || this.usesLocalRestrictionFallback) {
                restriction = {
                    id: this.createRestrictionId(),
                    ...pair,
                    teacherId: currentUser?.uid || currentUser?.id || 'development-teacher',
                    createdAt: new Date().toISOString()
                };
                this.pairRestrictions.push(restriction);
                this.saveDevelopmentGroupRestrictions();
            } else {
                restriction = await this.repository.create(studentAId, studentBId);
                if (lifecycleGeneration !== this.lifecycleGeneration) return;
                this.pairRestrictions.push(restriction);
            }

            if (lifecycleGeneration !== this.lifecycleGeneration) return;

            this.query('#group-restriction-student-a').value = '';
            this.query('#group-restriction-student-b').value = '';
            this.randomGroups = [];
            this.renderRandomGroups();
            this.renderGroupRestrictionSettings();
            this.setGroupRestrictionStatus('Private pairing restriction saved.', 'success');
        } catch (error) {
            if (lifecycleGeneration !== this.lifecycleGeneration) return;
            console.error('Could not save teacher group restriction:', error);
            const message = error?.code === '23505'
                ? 'That pairing restriction is already saved.'
                : 'The pairing restriction could not be saved.';
            this.setGroupRestrictionStatus(message, 'error');
        } finally {
            if (lifecycleGeneration === this.lifecycleGeneration && saveButton) {
                saveButton.disabled = false;
            }
        }
    }

    async removeGroupPairRestriction(restrictionId) {
        const lifecycleGeneration = this.lifecycleGeneration;
        const restriction = this.pairRestrictions.find(item => item.id === restrictionId);
        if (!restriction) return;

        try {
            const { authDisabled } = this.getSession();
            if (!authDisabled && !this.usesLocalRestrictionFallback) {
                await this.repository.remove(restrictionId);
                if (lifecycleGeneration !== this.lifecycleGeneration) return;
            }
            this.pairRestrictions = this.pairRestrictions.filter(item => item.id !== restrictionId);
            if (authDisabled || this.usesLocalRestrictionFallback) {
                this.saveDevelopmentGroupRestrictions();
            }
            this.randomGroups = [];
            this.renderRandomGroups();
            this.renderGroupRestrictionSettings();
            this.setGroupRestrictionStatus('Pairing restriction removed.', 'success');
        } catch (error) {
            if (lifecycleGeneration !== this.lifecycleGeneration) return;
            console.error('Could not remove teacher group restriction:', error);
            this.setGroupRestrictionStatus('The pairing restriction could not be removed.', 'error');
        }
    }

    generateRandomGroups() {
        const presentStudents = this.getSelectedGroupStudents()
            .filter(student => !this.absentStudents.has(student.id));
        const groupSize = Number.parseInt(this.query('#group-size-select')?.value || '2', 10);
        const presentIds = new Set(presentStudents.map(student => student.id));
        const activeRestrictions = this.getCurrentClassRestrictions().filter(restriction => (
            presentIds.has(restriction.studentAId)
            && presentIds.has(restriction.studentBId)
        ));
        const generatedGroups = randomizeStudentsWithRestrictions(
            presentStudents,
            groupSize,
            activeRestrictions
        );
        if (generatedGroups === null) {
            this.randomGroups = [];
            this.renderRandomGroups();
            this.setGroupGeneratorStatus(
                'No valid arrangement is possible with these pairing restrictions. Change the group size or remove a restriction.',
                'error'
            );
            return;
        }
        this.randomGroups = generatedGroups;
        this.renderRandomGroups();

        const groupWord = this.randomGroups.length === 1 ? 'group' : 'groups';
        this.setGroupGeneratorStatus(
            `Created ${this.randomGroups.length} ${groupWord} for ${presentStudents.length} present students.`,
            'success'
        );
    }

    renderRandomGroups() {
        const results = this.query('#group-results');
        const copyButton = this.query('#copy-groups-btn');
        if (!results) return;

        const groups = this.randomGroups;
        copyButton?.classList.toggle('hidden', groups.length === 0);
        results.innerHTML = '';

        if (!groups.length) {
            results.innerHTML = `
                <div class="group-results-empty">
                    <i data-lucide="users-round"></i>
                    <h4>Ready when you are</h4>
                    <p>Your randomized groups will appear here.</p>
                </div>
            `;
            this.refreshIcons(results);
            return;
        }

        groups.forEach((group, index) => {
            const card = createElement('article', 'random-group-card');
            const heading = createElement('div', 'random-group-heading');
            heading.innerHTML = `<span>Group ${index + 1}</span><small>${group.length} students</small>`;
            const names = createElement('ol', 'random-group-names');
            group.forEach(student => {
                names.appendChild(createElement('li', '', getStudentDisplayName(student)));
            });
            card.append(heading, names);
            results.appendChild(card);
        });
    }

    setGroupGeneratorStatus(message, state = 'muted') {
        const status = this.query('#group-generator-status');
        if (!status) return;
        setInlineStatus(status, message, state);
    }

    async copyRandomGroups() {
        const lifecycleGeneration = this.lifecycleGeneration;
        const groups = this.randomGroups;
        if (!groups.length) return;

        const text = groups.map((group, index) => (
            `Group ${index + 1}: ${group.map(getStudentDisplayName).join(', ')}`
        )).join('\n');

        try {
            await this.clipboard.writeText(text);
            if (lifecycleGeneration !== this.lifecycleGeneration) return;
            this.feedback.success('Groups copied to the clipboard.');
        } catch {
            if (lifecycleGeneration !== this.lifecycleGeneration) return;
            this.feedback.error('Could not copy the groups.');
        }
    }
}

export function createTeacherGroupsFeature(dependencies) {
    const feature = new TeacherGroupsFeature(dependencies);
    return Object.freeze({
        show: feature.show.bind(feature),
        destroy: feature.destroy.bind(feature)
    });
}
