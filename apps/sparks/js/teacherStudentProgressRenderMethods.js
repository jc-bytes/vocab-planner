import { $, $$, createElement, escapeHtml, notifications, openModal } from './main.js';
import { supabaseService } from './supabaseService.js';

class TeacherStudentProgressRenderMethods {
    renderProgressTable() {
        const tbody = $('#student-progress-list');
        const cardList = $('#student-progress-cards');
        if (tbody) tbody.innerHTML = '';
        if (cardList) cardList.innerHTML = '';
        if (!tbody && !cardList) return;

        if (this.filteredStudentData.length === 0) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td class="data-table__cell data-table__empty" colspan="8">No students match the current filters.</td>
                    </tr>
                `;
            }
            if (cardList) {
                cardList.innerHTML = '<p class="teacher-empty-state">No students match the current filters.</p>';
            }
            this.updateBulkToolbar();
            this.updateSelectAllCheckbox();
            return;
        }

        this.filteredStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            const details = this.getStudentProgressDetails(student, profile);
            const tr = createElement('tr');
            tr.dataset.studentId = student.id;

            // Add selected class if student is selected
            if (this.selectedStudents.has(student.id)) {
                tr.classList.add('selected');
            }

            tr.innerHTML = `
                <td class="data-table__cell">
                    <input type="checkbox" class="student-checkbox student-select-control" data-id="${escapeHtml(student.id)}" aria-label="Select ${details.name}" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
                </td>
                <td class="data-table__cell">${details.name}</td>
                <td class="data-table__cell data-table__secondary student-progress-table-email">${details.email}</td>
                <td class="data-table__cell">${details.grade}</td>
                <td class="data-table__cell">${details.group}</td>
                <td class="data-table__cell data-table__metric">${details.coins}</td>
                <td class="data-table__cell data-table__secondary">${details.lastActive}</td>
                <td class="data-table__cell data-table__action">
                    <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Details</button>
                    <button class="btn secondary-btn add-coins-btn" data-id="${escapeHtml(student.id)}">Add Coins</button>
                </td>
            `;
            tbody?.appendChild(tr);

            if (cardList) {
                const card = createElement('article', 'student-progress-mobile-card');
                card.dataset.studentCardId = student.id;
                if (this.selectedStudents.has(student.id)) {
                    card.classList.add('selected');
                }
                card.innerHTML = `
                    <div class="student-card-header">
                        <label class="student-card-select">
                            <input type="checkbox" class="student-checkbox student-select-control" data-id="${escapeHtml(student.id)}" aria-label="Select ${details.name}" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
                        </label>
                        <div>
                            <div class="student-card-name">${details.name}</div>
                            <div class="student-card-email">${details.email}</div>
                        </div>
                    </div>
                    <div class="student-card-meta">
                        <span>Grade<strong>${details.grade}</strong></span>
                        <span>Section<strong>${details.group}</strong></span>
                        <span>Coins<strong>${details.coins}</strong></span>
                        <span>Last Active<strong>${details.lastActive}</strong></span>
                    </div>
                    <div class="student-card-actions">
                        <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Details</button>
                        <button class="btn secondary-btn add-coins-btn" data-id="${escapeHtml(student.id)}">Add Coins</button>
                    </div>
                `;
                cardList.appendChild(card);
            }
        });

        this.bindStudentProgressControls();
        this.updateSelectAllCheckbox();
        this.updateBulkToolbar();
    }

    getStudentProgressDetails(student, profile = {}) {
        const rawName = profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : (profile.name || 'Unknown');
        const updatedTime = this.getStudentUpdatedTime(student);
        const date = updatedTime ? new Date(updatedTime) : null;

        return {
            name: escapeHtml(rawName),
            email: escapeHtml(student.email || profile.email || '-'),
            grade: escapeHtml(profile.grade || '-'),
            group: escapeHtml(profile.group || '-'),
            coins: escapeHtml(student.coins || 0),
            lastActive: date ? escapeHtml(date.toLocaleDateString()) : '-'
        };
    }

    bindStudentProgressControls() {
        $$('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) this.showStudentDetails(student);
            });
        });
        $$('.add-coins-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) {
                    this.showStudentDetails(student);
                    window.requestAnimationFrame(() => $('#coin-adjust-input')?.focus());
                }
            });
        });
        $$('.student-select-control').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.setStudentSelected(e.currentTarget.dataset.id, e.currentTarget.checked);
            });
        });
    }

    setStudentSelected(studentId, selected) {
        if (!studentId) return;
        if (selected) {
            this.selectedStudents.add(studentId);
        } else {
            this.selectedStudents.delete(studentId);
        }
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    updateStudentSelectionVisuals() {
        $$('.student-select-control').forEach(control => {
            control.checked = this.selectedStudents.has(control.dataset.id);
        });
        $$('tr[data-student-id]').forEach(row => {
            row.classList.toggle('selected', this.selectedStudents.has(row.dataset.studentId));
        });
        $$('.student-progress-mobile-card').forEach(card => {
            card.classList.toggle('selected', this.selectedStudents.has(card.dataset.studentCardId));
        });
    }

    async showStudentDetails(student) {
        this.activeStudentId = student.id;
        const needsDetail = !student.progressDetailLoaded;
        this.renderStudentDetails(student, { loading: needsDetail });

        if (!needsDetail) return;
        try {
            const detailedStudent = await this.ensureStudentProgressDetail(student);
            if (this.activeStudentId === student.id) {
                this.renderStudentDetails(detailedStudent);
            }
        } catch (error) {
            console.error('Failed to load student details:', error);
            if (this.activeStudentId === student.id) {
                const list = $('#detail-activity-list');
                if (list) {
                    list.innerHTML = '<p class="modal-secondary" style="color: var(--danger-color);">Activity details are unavailable right now. Please try again.</p>';
                }
            }
        }
    }

    renderStudentDetails(student, { loading = false } = {}) {
        const modal = $('#student-detail-modal');
        const profile = student.studentProfile || {};
        this.activeStudentId = student.id;
        this.updateCoinStatus('');

        $('#detail-student-name').textContent = profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : (profile.name || 'Unknown');
        $('#detail-student-grade').textContent = profile.grade || '-';
        $('#detail-student-group').textContent = profile.group || '-';
        $('#detail-student-coins').textContent = student.coins || 0;
        const lastActiveTime = this.getStudentUpdatedTime(student);
        const lastActiveDate = lastActiveTime ? new Date(lastActiveTime).toLocaleString() : '-';
        $('#detail-last-active').textContent = lastActiveDate;

        const passwordFlag = $('#detail-password-flag');
        if (passwordFlag) {
            passwordFlag.textContent = student.mustChangePassword ? 'Required' : 'No';
        }
        const resetStatus = $('#reset-password-status');
        const tempOutput = $('#temporary-password-output');
        if (resetStatus) resetStatus.textContent = '';
        if (tempOutput) {
            tempOutput.textContent = '';
            tempOutput.style.display = 'none';
        }

        const list = $('#detail-activity-list');
        list.innerHTML = '';

        const units = student.units || {};
        let totalScores = 0;
        let scoreCount = 0;
        let totalActivities = 0;
        if (loading) {
            list.innerHTML = '<div class="loading-spinner runtime-status">Loading activity details...</div>';
        } else if (Object.keys(units).length === 0) {
            list.innerHTML = '<p class="modal-secondary" style="color: var(--text-muted);">No activity data recorded.</p>';
        } else {
            for (const [unitName, unitData] of Object.entries(units)) {
                const card = createElement('div', 'student-detail-activity-row');

                let scoresHtml = '';
                if (unitData.scores) {
                    for (const [activity, data] of Object.entries(unitData.scores)) {
                        totalActivities++;
                        if (data.score !== undefined) {
                            totalScores += data.score;
                            scoreCount++;
                        }
                        const attempt = data.latestAttempt || data.bestAttempt || {};
                        const activeSeconds = Number(attempt.activeSeconds);
                        const timeLimitSeconds = Number(attempt.timeLimitSeconds);
                        const hasTiming = Number.isFinite(activeSeconds) && Number.isFinite(timeLimitSeconds)
                            && timeLimitSeconds > 0;
                        const timingLabel = hasTiming
                            ? `${this.formatActivityDuration(activeSeconds)} / ${this.formatActivityDuration(timeLimitSeconds)}`
                            : '';
                        const lateStatus = attempt.isLate
                            ? '<span class="activity-late-badge is-late">Late</span>'
                            : attempt.wasLate && attempt.lateOverride
                                ? '<span class="activity-late-badge is-excused">Late excused</span>'
                                : '';
                        const overrideAction = attempt.wasLate && attempt.attemptId
                            ? `<button class="btn text-btn activity-late-override-btn" type="button"
                                    data-attempt-id="${escapeHtml(attempt.attemptId)}"
                                    data-excused="${attempt.lateOverride ? 'true' : 'false'}">
                                    ${attempt.lateOverride ? 'Remove excuse' : 'Excuse late'}
                               </button>`
                            : '';
                        const reason = attempt.lateOverrideReason
                            ? `<small class="activity-late-reason">${escapeHtml(attempt.lateOverrideReason)}</small>`
                            : '';
                        scoresHtml += `
                            <div class="modal-activity-meta teacher-activity-result-row">
                                <span class="modal-activity-name">${escapeHtml(activity)}</span>
                                <span class="teacher-activity-result-timing">${timingLabel}${lateStatus}${reason}</span>
                                <span class="modal-inline-metric" style="color: var(--primary-color);">${data.score}%</span>
                                ${overrideAction}
                            </div>
                        `;
                    }
                }

                card.innerHTML = `
                    <h4 class="modal-section-title" style="margin-bottom: 0.5rem;">${unitName}</h4>
                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                        ${scoresHtml || '<span class="modal-secondary" style="color: var(--text-muted);">No scores yet</span>'}
                    </div>
                `;
                list.appendChild(card);
            }
        }
        const avgScore = loading ? '-' : (scoreCount ? Math.round(totalScores / scoreCount) : '-');
        $('#detail-avg-score').textContent = avgScore === '-' ? '-' : `${avgScore}%`;
        $('#detail-total-activities').textContent = loading ? '-' : (totalActivities || '-');

        $$('.activity-late-override-btn').forEach(button => {
            button.addEventListener('click', () => this.handleActivityLateOverride(student, button));
        });

        openModal(modal, { initialFocus: '#close-detail-modal' });
    }

    formatActivityDuration(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }

    async handleActivityLateOverride(student, button) {
        const attemptId = String(button?.dataset?.attemptId || '');
        const currentlyExcused = button?.dataset?.excused === 'true';
        if (!attemptId) return;

        let reason = '';
        if (currentlyExcused) {
            if (!confirm('Remove this late-work excuse?')) return;
        } else {
            const response = prompt('Why should this late activity be excused?');
            if (response === null) return;
            reason = response.trim();
            if (!reason) {
                notifications.warning('Enter a reason, such as an internet or device problem.');
                return;
            }
        }

        button.disabled = true;
        try {
            const updatedAttempt = await supabaseService.setStudentActivityLateOverride(attemptId, {
                excused: !currentlyExcused,
                reason
            });
            for (const unit of Object.values(student.units || {})) {
                for (const score of Object.values(unit.scores || {})) {
                    if (score.latestAttempt?.attemptId === attemptId) score.latestAttempt = updatedAttempt;
                    if (score.bestAttempt?.attemptId === attemptId) score.bestAttempt = updatedAttempt;
                }
            }
            notifications.success(currentlyExcused ? 'Late excuse removed.' : 'Late activity excused.');
            this.renderStudentDetails(student);
        } catch (error) {
            console.error('Could not update late-work status:', error);
            notifications.error(error.message || 'Could not update late-work status.');
            button.disabled = false;
        }
    }

    async updateStudentRole(role) {
        console.warn('Role changes are disabled. Teacher access is controlled by teacher_allowlist.', role);
        notifications.warning('Teacher access is controlled by teacher_allowlist.');
    }

    async handlePasswordReset() {
        if (!this.activeStudentId) return;
        const student = this.allStudentData.find(s => s.id === this.activeStudentId);
        const name = student?.studentProfile?.name || student?.email || 'this student';
        const confirmed = confirm(`Reset the password for ${name}?`);
        if (!confirmed) return;

        const status = $('#reset-password-status');
        const tempOutput = $('#temporary-password-output');
        const button = $('#reset-student-password-btn');

        try {
            if (button) button.disabled = true;
            if (status) {
                status.style.color = 'var(--text-muted)';
                status.textContent = 'Resetting password...';
            }
            if (tempOutput) tempOutput.style.display = 'none';

            const result = await supabaseService.resetStudentPassword(this.activeStudentId);
            if (status) {
                status.style.color = result.warning ? '#b45309' : 'var(--success-color)';
                status.textContent = result.warning || 'Temporary password created.';
            }
            if (tempOutput) {
                tempOutput.textContent = result.temporaryPassword || '';
                tempOutput.style.display = 'block';
            }

            if (student) student.mustChangePassword = result.profileFlagUpdated !== false;
            const passwordFlag = $('#detail-password-flag');
            if (passwordFlag) {
                passwordFlag.textContent = result.profileFlagUpdated === false
                    ? 'Reset again later'
                    : 'Required';
            }
        } catch (error) {
            console.error('Password reset failed:', error);
            if (status) {
                status.style.color = 'var(--danger-color)';
                status.textContent = error.message || 'Could not reset password.';
            }
        } finally {
            if (button) button.disabled = false;
        }
    }
}

export function installTeacherStudentProgressRenderMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherStudentProgressRenderMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherStudentProgressRenderMethods.prototype, name)
        );
    }
}
