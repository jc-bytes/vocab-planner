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

class TeacherGroupsMethods {
    async showGroupsView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-groups-view');
        this.setGroupGeneratorStatus('Loading your class roster…');

        try {
            await Promise.all([
                this.getStudentRosterData(),
                this.loadGroupPairRestrictions()
            ]);
            this.populateGroupClassSelect();
            this.renderGroupStudentList();
            this.setGroupGeneratorStatus('');
        } catch (error) {
            console.error('Could not load group generator roster:', error);
            this.setGroupGeneratorStatus('The class roster could not be loaded. Please try again.', 'error');
        }
    }

    populateGroupClassSelect() {
        const select = $('#group-class-select');
        if (!select) return;

        const previous = select.value || this.selectedGroupClass || '';
        const classKeys = [...new Set(this.allStudentData.map(getStudentClassKey).filter(Boolean))]
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
        this.selectedGroupClass = nextClass;
        this.loadTodayGroupAbsences();
    }

    getSelectedGroupStudents() {
        return this.allStudentData
            .filter(student => getStudentClassKey(student) === this.selectedGroupClass)
            .sort((a, b) => getStudentDisplayName(a).localeCompare(getStudentDisplayName(b)));
    }

    groupAbsenceStorageKey() {
        return `teacher_group_absences:${localDateKey()}:${this.selectedGroupClass || 'none'}`;
    }

    loadTodayGroupAbsences() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.groupAbsenceStorageKey()) || '[]');
            this.groupAbsentStudents = new Set(Array.isArray(saved) ? saved : []);
        } catch {
            this.groupAbsentStudents = new Set();
        }
    }

    saveTodayGroupAbsences() {
        try {
            localStorage.setItem(this.groupAbsenceStorageKey(), JSON.stringify([...this.groupAbsentStudents]));
        } catch {
            // Grouping still works if private browsing blocks local storage.
        }
    }

    handleGroupClassChange(classKey) {
        this.selectedGroupClass = classKey;
        this.loadTodayGroupAbsences();
        this.currentRandomGroups = [];
        this.renderGroupStudentList();
        this.renderGroupRestrictionSettings();
        this.renderRandomGroups();
    }

    toggleGroupStudentAbsent(studentId, absent) {
        if (absent) this.groupAbsentStudents.add(studentId);
        else this.groupAbsentStudents.delete(studentId);
        this.saveTodayGroupAbsences();
        this.renderGroupStudentList();
        this.currentRandomGroups = [];
        this.renderRandomGroups();
    }

    clearGroupAbsences() {
        this.groupAbsentStudents.clear();
        this.saveTodayGroupAbsences();
        this.renderGroupStudentList();
        this.currentRandomGroups = [];
        this.renderRandomGroups();
    }

    renderGroupStudentList() {
        const list = $('#group-student-list');
        const summary = $('#group-roster-summary');
        const randomizeButton = $('#randomize-groups-btn');
        if (!list) return;

        const students = this.getSelectedGroupStudents();
        const presentCount = students.filter(student => !this.groupAbsentStudents.has(student.id)).length;
        const absentCount = students.length - presentCount;

        if (summary) {
            summary.textContent = this.selectedGroupClass
                ? `${presentCount} present · ${absentCount} absent`
                : `${this.allStudentData.length} students`;
        }
        if (randomizeButton) randomizeButton.disabled = presentCount < 2;

        list.innerHTML = '';
        if (!this.selectedGroupClass) {
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
            const absent = this.groupAbsentStudents.has(student.id);
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
        return `teacher_group_pair_restrictions:${this.currentUser?.id || 'development-teacher'}`;
    }

    async loadGroupPairRestrictions() {
        if (this.authDisabled || this.groupRestrictionsLocalFallback) {
            try {
                const saved = JSON.parse(localStorage.getItem(this.groupRestrictionsStorageKey()) || '[]');
                this.groupPairRestrictions = Array.isArray(saved) ? saved : [];
            } catch {
                this.groupPairRestrictions = [];
            }
            return this.groupPairRestrictions;
        }

        try {
            this.groupPairRestrictions = await teacherGroupRestrictionsRepository.list();
        } catch (error) {
            console.error('Could not load teacher group restrictions:', error);
            this.groupRestrictionsLocalFallback = true;
            try {
                const saved = JSON.parse(localStorage.getItem(this.groupRestrictionsStorageKey()) || '[]');
                this.groupPairRestrictions = Array.isArray(saved) ? saved : [];
            } catch {
                this.groupPairRestrictions = [];
            }
            this.setGroupRestrictionStatus(
                'Restrictions are private and saved on this device.',
                'muted'
            );
        }
        return this.groupPairRestrictions;
    }

    saveDevelopmentGroupRestrictions() {
        try {
            localStorage.setItem(
                this.groupRestrictionsStorageKey(),
                JSON.stringify(this.groupPairRestrictions)
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
        return this.groupPairRestrictions.filter(restriction => (
            classStudentIds.has(restriction.studentAId)
            && classStudentIds.has(restriction.studentBId)
        ));
    }

    renderGroupRestrictionSettings() {
        const studentASelect = $('#group-restriction-student-a');
        const studentBSelect = $('#group-restriction-student-b');
        const list = $('#group-restriction-list');
        const count = $('#group-restriction-count');
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

        if (!this.selectedGroupClass) {
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
        const status = $('#group-restriction-status');
        if (!status) return;
        setInlineStatus(status, message, state);
    }

    async saveGroupPairRestriction() {
        const studentAId = $('#group-restriction-student-a')?.value || '';
        const studentBId = $('#group-restriction-student-b')?.value || '';
        if (!studentAId || !studentBId) {
            this.setGroupRestrictionStatus('Choose both students.', 'error');
            return;
        }
        if (studentAId === studentBId) {
            this.setGroupRestrictionStatus('Choose two different students.', 'error');
            return;
        }

        const pair = canonicalStudentPair(studentAId, studentBId);
        const alreadySaved = this.groupPairRestrictions.some(restriction => (
            restriction.studentAId === pair.studentAId
            && restriction.studentBId === pair.studentBId
        ));
        if (alreadySaved) {
            this.setGroupRestrictionStatus('That pairing restriction is already saved.', 'error');
            return;
        }

        const saveButton = $('#save-group-restriction-btn');
        try {
            if (saveButton) saveButton.disabled = true;
            let restriction;
            if (this.authDisabled || this.groupRestrictionsLocalFallback) {
                restriction = {
                    id: globalThis.crypto?.randomUUID?.() || `restriction-${Date.now()}`,
                    ...pair,
                    teacherId: this.currentUser?.id || 'development-teacher',
                    createdAt: new Date().toISOString()
                };
                this.groupPairRestrictions.push(restriction);
                this.saveDevelopmentGroupRestrictions();
            } else {
                restriction = await teacherGroupRestrictionsRepository.create(studentAId, studentBId);
                this.groupPairRestrictions.push(restriction);
            }

            $('#group-restriction-student-a').value = '';
            $('#group-restriction-student-b').value = '';
            this.currentRandomGroups = [];
            this.renderRandomGroups();
            this.renderGroupRestrictionSettings();
            this.setGroupRestrictionStatus('Private pairing restriction saved.', 'success');
        } catch (error) {
            console.error('Could not save teacher group restriction:', error);
            const message = error?.code === '23505'
                ? 'That pairing restriction is already saved.'
                : 'The pairing restriction could not be saved.';
            this.setGroupRestrictionStatus(message, 'error');
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    async removeGroupPairRestriction(restrictionId) {
        const restriction = this.groupPairRestrictions.find(item => item.id === restrictionId);
        if (!restriction) return;

        try {
            if (!this.authDisabled && !this.groupRestrictionsLocalFallback) {
                await teacherGroupRestrictionsRepository.remove(restrictionId);
            }
            this.groupPairRestrictions = this.groupPairRestrictions.filter(item => item.id !== restrictionId);
            if (this.authDisabled || this.groupRestrictionsLocalFallback) {
                this.saveDevelopmentGroupRestrictions();
            }
            this.currentRandomGroups = [];
            this.renderRandomGroups();
            this.renderGroupRestrictionSettings();
            this.setGroupRestrictionStatus('Pairing restriction removed.', 'success');
        } catch (error) {
            console.error('Could not remove teacher group restriction:', error);
            this.setGroupRestrictionStatus('The pairing restriction could not be removed.', 'error');
        }
    }

    generateRandomGroups() {
        const presentStudents = this.getSelectedGroupStudents()
            .filter(student => !this.groupAbsentStudents.has(student.id));
        const groupSize = Number.parseInt($('#group-size-select')?.value || '2', 10);
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
            this.currentRandomGroups = [];
            this.renderRandomGroups();
            this.setGroupGeneratorStatus(
                'No valid arrangement is possible with these pairing restrictions. Change the group size or remove a restriction.',
                'error'
            );
            return;
        }
        this.currentRandomGroups = generatedGroups;
        this.renderRandomGroups();

        const groupWord = this.currentRandomGroups.length === 1 ? 'group' : 'groups';
        this.setGroupGeneratorStatus(
            `Created ${this.currentRandomGroups.length} ${groupWord} for ${presentStudents.length} present students.`,
            'success'
        );
    }

    renderRandomGroups() {
        const results = $('#group-results');
        const copyButton = $('#copy-groups-btn');
        if (!results) return;

        const groups = this.currentRandomGroups || [];
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
        const status = $('#group-generator-status');
        if (!status) return;
        setInlineStatus(status, message, state);
    }

    async copyRandomGroups() {
        const groups = this.currentRandomGroups || [];
        if (!groups.length) return;

        const text = groups.map((group, index) => (
            `Group ${index + 1}: ${group.map(getStudentDisplayName).join(', ')}`
        )).join('\n');

        try {
            await navigator.clipboard.writeText(text);
            notifications.success('Groups copied to the clipboard.');
        } catch {
            notifications.error('Could not copy the groups.');
        }
    }
}

export function installTeacherGroupsMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherGroupsMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherGroupsMethods.prototype, name)
        );
    }
}
