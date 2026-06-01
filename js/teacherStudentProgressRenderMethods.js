import { $, $$, createElement, escapeHtml, notifications, openModal } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';

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
                        <td colspan="8" style="padding: 1rem; color: var(--text-muted);">No students match the current filters.</td>
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
                <td style="padding: 1rem;">
                    <input type="checkbox" class="student-checkbox student-select-control" data-id="${escapeHtml(student.id)}" aria-label="Select ${details.name}" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
                </td>
                <td style="padding: 1rem;">${details.name}</td>
                <td style="padding: 1rem; color: var(--text-muted);">${details.email}</td>
                <td style="padding: 1rem;">${details.grade}</td>
                <td style="padding: 1rem;">${details.group}</td>
                <td style="padding: 1rem;">${details.coins}</td>
                <td style="padding: 1rem;">${details.lastActive}</td>
                <td style="padding: 1rem;">
                    <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Details</button>
                    <button class="btn secondary-btn add-coins-btn" data-id="${escapeHtml(student.id)}" style="margin-left:0.5rem;">Add Coins</button>
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
                        <span>Group<strong>${details.group}</strong></span>
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
        const updatedAt = student.updatedAt;
        const date = updatedAt?.toDate
            ? updatedAt.toDate()
            : updatedAt?.seconds
                ? new Date(updatedAt.seconds * 1000)
                : null;

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
        const lastActiveDate = student.updatedAt
            ? new Date((student.updatedAt.seconds || 0) * 1000).toLocaleString()
            : '-';
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
        if (Object.keys(units).length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">No activity data recorded.</p>';
        } else {
            for (const [unitName, unitData] of Object.entries(units)) {
                const card = createElement('div', 'card');
                card.style.padding = '1rem';

                let scoresHtml = '';
                if (unitData.scores) {
                    for (const [activity, data] of Object.entries(unitData.scores)) {
                        totalActivities++;
                        if (data.score !== undefined) {
                            totalScores += data.score;
                            scoreCount++;
                        }
                        scoresHtml += `
                            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.9rem;">
                                <span style="text-transform: capitalize;">${activity}</span>
                                <span style="font-weight: bold; color: var(--primary-color);">${data.score}%</span>
                            </div>
                        `;
                    }
                }

                card.innerHTML = `
                    <h4 style="margin-bottom: 0.5rem;">${unitName}</h4>
                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                        ${scoresHtml || '<span style="color: var(--text-muted); font-size: 0.9rem;">No scores yet</span>'}
                    </div>
                `;
                list.appendChild(card);
            }
        }
        const avgScore = scoreCount ? Math.round(totalScores / scoreCount) : '-';
        $('#detail-avg-score').textContent = avgScore === '-' ? '-' : `${avgScore}%`;
        $('#detail-total-activities').textContent = totalActivities || '-';

        openModal(modal, { initialFocus: '#close-detail-modal' });
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
                status.style.color = 'var(--success-color)';
                status.textContent = 'Temporary password created.';
            }
            if (tempOutput) {
                tempOutput.textContent = result.temporaryPassword || '';
                tempOutput.style.display = 'block';
            }

            if (student) student.mustChangePassword = true;
            const passwordFlag = $('#detail-password-flag');
            if (passwordFlag) passwordFlag.textContent = 'Required';
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
