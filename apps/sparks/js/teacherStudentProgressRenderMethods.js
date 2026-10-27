import { $, $$, createElement, escapeHtml, notifications } from './main.js';
import { supabaseService } from './supabaseService.js';
import { buildStudentProfileModel } from './teacherStudentProfileModel.js';

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
                        <td class="data-table__cell data-table__empty" colspan="9">No students match the current filters.</td>
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
                <td class="data-table__cell">${details.name}<span class="student-roster-secondary">${details.email}</span></td>
                <td class="data-table__cell">${details.grade}${details.group}</td>
                <td class="data-table__cell student-roster-learning">${details.completion}</td>
                <td class="data-table__cell"><span class="student-roster-attention ${details.attentionClass}">${details.attention}</span></td>
                <td class="data-table__cell data-table__metric">${details.accuracy}</td>
                <td class="data-table__cell data-table__metric">${details.coins}</td>
                <td class="data-table__cell data-table__secondary">${details.lastActive}</td>
                <td class="data-table__cell data-table__action">
                    <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Profile</button>
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
                        <span>Class<strong>${details.grade}${details.group}</strong></span>
                        <span>Required vocabulary<strong>${details.completion}</strong></span>
                        <span>Needs attention<strong class="${details.attentionClass}">${details.attention}</strong></span>
                        <span>Recent accuracy<strong>${details.accuracy}</strong></span>
                        <span>Coins<strong>${details.coins}</strong></span>
                        <span>Last learning activity<strong>${details.lastActive}</strong></span>
                    </div>
                    <div class="student-card-actions">
                        <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Profile</button>
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
        const result = this.studentRosterProgressById?.get(student.id);
        const progress = result?.progress;
        const ready = result?.state === 'ready' && progress;
        const unavailable = result?.state === 'error';
        const placeholder = unavailable ? 'Unavailable' : 'Loading…';
        const updatedTime = ready ? progress.lastActive : null;
        const date = updatedTime ? new Date(updatedTime) : null;

        return {
            name: escapeHtml(rawName),
            email: escapeHtml(student.email || profile.email || '-'),
            grade: escapeHtml(profile.grade || '-'),
            group: escapeHtml(profile.group || '-'),
            coins: escapeHtml(student.coins || 0),
            completion: ready ? (progress.required === null ? 'Unavailable' : progress.required
                ? `${progress.completed} / ${progress.required} activities` : 'No required work') : placeholder,
            attention: ready ? (progress.pending === null ? 'Unavailable' : progress.overdue
                ? `${progress.overdue} overdue · ${progress.pending} unfinished` : progress.pending ? `${progress.pending} unfinished` : 'Up to date') : placeholder,
            attentionClass: ready && progress.pending > 0 ? 'student-roster-needs-help' : '',
            accuracy: ready ? (progress.accuracy === null ? 'No results' : `${progress.accuracy}%`) : placeholder,
            lastActive: ready ? (date ? escapeHtml(date.toLocaleDateString()) : 'No activity') : placeholder
        };
    }

    bindStudentProgressControls() {
        $$('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) this.showStudentDetails(student);
            }, { signal: this.progressListenersController?.signal });
        });
        $$('.add-coins-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) {
                    this.showStudentDetails(student, { tab: 'account' });
                }
            }, { signal: this.progressListenersController?.signal });
        });
        $$('.student-select-control').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.setStudentSelected(e.currentTarget.dataset.id, e.currentTarget.checked);
            }, { signal: this.progressListenersController?.signal });
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

    showStudentDetails(student, { tab = 'overview' } = {}) {
        if (!student?.id) return;
        this.activeStudentId = student.id;
        this.activeStudentProfile = student;
        const route = { view: 'student-profile', studentId: student.id, tab };
        this.setRoute(route);
        void this.applyRoute(route);
    }

    async showStudentProfileById(studentId, { tab = 'overview' } = {}) {
        if (!this.ensureAuthenticated(false) || !studentId) return false;
        const classId = this.getSelectedTeacherClassId?.();
        const navigation = this.captureTeacherNavigation?.();
        const generation = this.studentProgressSessionGeneration || 0;
        const request = (this.studentProfileRequest || 0) + 1;
        this.studentProfileRequest = request;
        this.studentInsightRequest = (this.studentInsightRequest || 0) + 1;
        this.studentDashboardCharts?.dispose();
        this.studentDashboardCharts = null;
        $('#student-profile-assigned-work')?.replaceChildren();
        const insightSummary = $('#student-insight-summary');
        if (insightSummary) insightSummary.textContent = 'Loading assigned-work insight...';
        this.activeStudentId = studentId;
        this.switchView('teacher-student-profile-view', { updateRoute: false });
        $('#student-profile-loading')?.classList.remove('hidden');
        $('#student-profile-content')?.classList.add('hidden');
        $('#student-profile-error')?.classList.add('hidden');

        try {
            if (classId) {
                const repository = this.classroomRepository || (await import('./services/classroomRepository.js')).classroomRepository;
                const roster = await repository.getRoster(classId);
                if (navigation && !this.isTeacherNavigationCurrent(navigation)) return false;
                if (!roster.some(student => student.studentId === studentId)) throw new Error('Student is not enrolled in this class.');
                this.studentProfileClassRoster = roster.map(student => ({ ...student, id: student.studentId }));
            }
            const rosterStudent = this.allStudentData.find(student => student.id === studentId);
            const seed = rosterStudent || { id: studentId, userId: studentId, studentProfile: {} };
            const [progressStudent, identity] = await Promise.all([
                this.ensureStudentProgressDetail(seed),
                supabaseService.getProfile(studentId)
            ]);
            if (request !== this.studentProfileRequest || generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId || (navigation && !this.isTeacherNavigationCurrent(navigation))) return false;
            if (!identity && !rosterStudent && !progressStudent?.progressDetailLoaded) {
                throw new Error('Student progress was not found.');
            }
            const student = {
                ...(progressStudent || seed),
                email: identity?.email || progressStudent?.email || '',
                mustChangePassword: identity?.mustChangePassword,
                studentProfile: {
                    ...(progressStudent?.studentProfile || {}),
                    ...(identity ? {
                        firstName: identity.firstName,
                        lastName: identity.lastName,
                        name: identity.name,
                        email: identity.email,
                        grade: identity.grade,
                        group: identity.group
                    } : {})
                },
                progressDetailLoaded: true
            };
            this.activeStudentProfile = student;
            this.renderStudentProfile(student, { tab });
            const { loadStudentInsight } = await import('./teacherStudentInsightView.js');
            if (request !== this.studentProfileRequest || generation !== (this.studentProgressSessionGeneration || 0) || this.activeStudentId !== studentId || (navigation && !this.isTeacherNavigationCurrent(navigation))) return false;
            await loadStudentInsight(this, studentId);
            return true;
        } catch (error) {
            if (request !== this.studentProfileRequest || generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId || (navigation && !this.isTeacherNavigationCurrent(navigation))) return false;
            console.error('Failed to load student profile:', error);
            $('#student-profile-loading')?.classList.add('hidden');
            const errorElement = $('#student-profile-error');
            if (errorElement) {
                errorElement.textContent = 'This student profile is unavailable. Return to Students and try again.';
                errorElement.classList.remove('hidden');
            }
            return false;
        }
    }

    renderStudentDetails(student, options = {}) {
        return this.renderStudentProfile(student, options);
    }

    renderStudentProfile(student, { tab = this.activeStudentProfileTab || 'overview' } = {}) {
        const model = buildStudentProfileModel(student);
        this.activeStudentId = model.id;
        this.activeStudentProfile = student;
        this.activeStudentProfileModel = model;
        this.updateCoinStatus('');

        $('#detail-student-name').textContent = model.name;
        $('#student-profile-email').textContent = model.email;
        $('#student-profile-class').textContent = [
            model.grade ? `Grade ${model.grade}` : '',
            model.section ? `Section ${model.section}` : ''
        ].filter(Boolean).join(' · ') || 'Student profile';
        $('#detail-student-coins').textContent = model.coins.toLocaleString();
        $('#detail-last-active').textContent = model.lastActive
            ? new Date(model.lastActive).toLocaleString()
            : 'No activity';
        $('#detail-avg-score').textContent = model.summary.averageBestScore === null
            ? '-'
            : `${model.summary.averageBestScore}%`;
        $('#detail-avg-accuracy').textContent = model.summary.averageAccuracy === null
            ? '-'
            : `${model.summary.averageAccuracy}%`;
        $('#detail-total-activities').textContent = `${model.summary.completed} / ${model.summary.recorded}`;
        $('#detail-total-xp').textContent = model.totalXp.toLocaleString();
        $('#detail-password-flag').textContent = model.mustChangePassword === null
            ? 'Unknown'
            : model.mustChangePassword ? 'Yes' : 'No';

        this.renderStudentProfileAttention(model);
        this.renderStudentProfileUnits(model);
        this.renderStudentProfileActivities(student, model);
        this.renderStudentProfileCoinHistory(model);
        this.updateStudentProfileNavigation(model.id);
        this.setStudentProfileTab(tab, { updateRoute: false });

        $('#student-profile-loading')?.classList.add('hidden');
        $('#student-profile-error')?.classList.add('hidden');
        $('#student-profile-content')?.classList.remove('hidden');
        this.refreshIcons($('#teacher-student-profile-view'));
        $('#detail-student-name')?.focus({ preventScroll: true });
    }

    renderStudentProfileAttention(model) {
        const container = $('#student-profile-attention');
        if (!container) return;
        if (model.attention.length === 0) {
            container.innerHTML = '<p class="student-profile-clear"><i data-lucide="circle-check"></i>No immediate concerns in the recorded activity.</p>';
            return;
        }
        container.innerHTML = `<ul>${model.attention.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    renderStudentProfileUnits(model) {
        const container = $('#student-profile-units');
        if (!container) return;
        if (model.units.length === 0) {
            container.innerHTML = '<p class="teacher-empty-state">No vocabulary progress has been recorded.</p>';
            return;
        }
        container.innerHTML = model.units.map(unit => `
            <article class="student-profile-unit">
                <div>
                    <strong>${escapeHtml(unit.name)}</strong>
                    <span>${unit.completed} of ${unit.total} completed</span>
                </div>
                <div class="student-profile-progress" aria-label="${unit.percent}% complete">
                    <span style="width: ${unit.percent}%"></span>
                </div>
                <b>${unit.percent}%</b>
            </article>
        `).join('');
    }

    renderStudentProfileActivities(student, model) {
        const container = $('#detail-activity-list');
        if (!container) return;
        if (model.activities.length === 0) {
            container.innerHTML = '<p class="teacher-empty-state">No activity data recorded.</p>';
            return;
        }
        container.innerHTML = `
            <div class="table-scroll-wrapper student-profile-activity-table-wrap">
                <table class="data-table student-profile-activity-table">
                    <thead><tr>
                        <th class="data-table__header-cell">Vocabulary</th>
                        <th class="data-table__header-cell">Activity</th>
                        <th class="data-table__header-cell">Status</th>
                        <th class="data-table__header-cell">Latest</th>
                        <th class="data-table__header-cell">Best</th>
                        <th class="data-table__header-cell">Accuracy</th>
                        <th class="data-table__header-cell">Finished runs</th>
                        <th class="data-table__header-cell">Time</th>
                        <th class="data-table__header-cell">Last played</th>
                        <th class="data-table__header-cell">Late work</th>
                    </tr></thead>
                    <tbody>${model.activities.map(activity => {
                        const timing = Number.isFinite(activity.activeSeconds) && Number.isFinite(activity.timeLimitSeconds)
                            ? `${this.formatActivityDuration(activity.activeSeconds)} / ${this.formatActivityDuration(activity.timeLimitSeconds)}`
                            : '-';
                        const lateLabel = activity.isLate ? 'Late' : activity.excused ? 'Excused' : '-';
                        const lateAction = activity.wasLate && activity.attemptId
                            ? `<button class="btn text-btn activity-late-override-btn" type="button"
                                data-attempt-id="${escapeHtml(activity.attemptId)}" data-excused="${activity.excused}">
                                ${activity.excused ? 'Remove excuse' : 'Excuse late'}
                               </button>`
                            : '';
                        return `<tr>
                            <td class="data-table__cell" data-label="Vocabulary">${escapeHtml(activity.unitName)}</td>
                            <td class="data-table__cell" data-label="Activity">${escapeHtml(activity.activityName)}</td>
                            <td class="data-table__cell" data-label="Status"><span class="student-profile-status" data-status="${activity.status.toLowerCase().replace(' ', '-')}">${activity.status}</span></td>
                            <td class="data-table__cell" data-label="Latest score">${activity.latestScore === null ? '-' : `${Math.round(activity.latestScore)}%`}</td>
                            <td class="data-table__cell data-table__metric" data-label="Best score">${activity.bestScore === null ? '-' : `${Math.round(activity.bestScore)}%`}</td>
                            <td class="data-table__cell" data-label="Accuracy">${activity.accuracy === null ? '-' : `${Math.round(activity.accuracy)}%`}</td>
                            <td class="data-table__cell" data-label="Finished runs">${activity.plays}</td>
                            <td class="data-table__cell" data-label="Time">${timing}</td>
                            <td class="data-table__cell" data-label="Last played">${activity.lastPlayed ? new Date(activity.lastPlayed).toLocaleDateString() : '-'}</td>
                            <td class="data-table__cell student-profile-late-cell" data-label="Late work">
                                <span>${lateLabel}</span>${activity.lateReason ? `<small>${escapeHtml(activity.lateReason)}</small>` : ''}${lateAction}
                            </td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>`;
        $$('.activity-late-override-btn').forEach(button => {
            button.addEventListener('click', () => this.handleActivityLateOverride(student, button), { signal: this.progressListenersController?.signal });
        });
    }

    renderStudentProfileCoinHistory(model) {
        const container = $('#student-profile-coin-history');
        if (!container) return;
        if (model.coinHistory.length === 0) {
            container.innerHTML = '<p class="teacher-empty-state">No coin transactions recorded.</p>';
            return;
        }
        container.innerHTML = `<table class="data-table student-profile-coin-table">
            <thead><tr><th class="data-table__header-cell">Date</th><th class="data-table__header-cell">Description</th><th class="data-table__header-cell">Source</th><th class="data-table__header-cell">Amount</th></tr></thead>
            <tbody>${model.coinHistory.map(entry => `<tr>
                <td class="data-table__cell" data-label="Date">${entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-'}</td>
                <td class="data-table__cell" data-label="Description">${escapeHtml(entry.description || entry.type || 'Coin transaction')}</td>
                <td class="data-table__cell" data-label="Source">${escapeHtml(entry.source || '-')}</td>
                <td class="data-table__cell data-table__metric" data-label="Amount">${entry.amount > 0 ? '+' : ''}${entry.amount}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    }

    setStudentProfileTab(tab, { updateRoute = true } = {}) {
        const scoped = Boolean(this.getSelectedTeacherClassId?.());
        const requestedTab = scoped && tab === 'activity' ? 'assigned' : tab;
        const activityTab = document.querySelector('[data-student-profile-tab="activity"]');
        if (activityTab) activityTab.hidden = scoped;
        const activeTab = ['overview', 'assigned', 'activity', 'account'].includes(requestedTab) ? requestedTab : 'overview';
        this.activeStudentProfileTab = activeTab;
        $$('[data-student-profile-tab]').forEach(button => {
            const active = button.dataset.studentProfileTab === activeTab;
            button.classList.toggle('active', active);
            button.classList.toggle('secondary-tab--active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.tabIndex = active ? 0 : -1;
        });
        ['overview', 'assigned', 'activity', 'account'].forEach(name => {
            $(`#student-profile-${name}-panel`)?.classList.toggle('hidden', name !== activeTab);
        });
        if (updateRoute && this.activeStudentId) {
            this.setRoute({ view: 'student-profile', studentId: this.activeStudentId, tab: activeTab, classId: this.getSelectedTeacherClassId?.() });
        }
    }

    updateStudentProfileNavigation(studentId) {
        const roster = this.getSelectedTeacherClassId?.() ? this.studentProfileClassRoster || []
            : this.filteredStudentData.length ? this.filteredStudentData : this.allStudentData;
        const index = roster.findIndex(student => student.id === studentId);
        const previous = $('#student-profile-previous-btn');
        const next = $('#student-profile-next-btn');
        if (previous) {
            previous.disabled = index <= 0;
            previous.dataset.studentId = index > 0 ? roster[index - 1].id : '';
        }
        if (next) {
            next.disabled = index < 0 || index >= roster.length - 1;
            next.dataset.studentId = index >= 0 && index < roster.length - 1 ? roster[index + 1].id : '';
        }
    }

    moveStudentProfile(direction) {
        const button = direction < 0 ? $('#student-profile-previous-btn') : $('#student-profile-next-btn');
        if (!button?.dataset.studentId) return;
        const route = {
            view: 'student-profile',
            studentId: button.dataset.studentId,
            tab: this.activeStudentProfileTab || 'overview'
        };
        this.setRoute(route);
        void this.applyRoute(route);
    }

    formatActivityDuration(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
        return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }

    async handleActivityLateOverride(student, button) {
        const generation = this.studentProgressSessionGeneration || 0;
        const studentId = student?.id;
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
            if (generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId) return;
            await this.invalidateStudentProgressQueries();
            if (generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId) return;
            for (const unit of Object.values(student.units || {})) {
                for (const score of Object.values(unit.scores || {})) {
                    if (score.latestAttempt?.attemptId === attemptId) score.latestAttempt = updatedAttempt;
                    if (score.bestAttempt?.attemptId === attemptId) score.bestAttempt = updatedAttempt;
                }
            }
            notifications.success(currentlyExcused ? 'Late excuse removed.' : 'Late activity excused.');
            this.renderStudentProfile(student);
            const { loadStudentInsight } = await import('./teacherStudentInsightView.js');
            if (generation === (this.studentProgressSessionGeneration || 0) && this.activeStudentId === studentId) {
                await loadStudentInsight(this, studentId);
            }
        } catch (error) {
            if (generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId) return;
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
        const studentId = this.activeStudentId;
        const generation = this.studentProgressSessionGeneration || 0;
        const student = this.allStudentData.find(s => s.id === studentId)
            || (this.activeStudentProfile?.id === studentId ? this.activeStudentProfile : null);
        const name = student?.studentProfile?.name || student?.email || 'this student';
        const confirmed = confirm(`Reset the password for ${name}?`);
        if (!confirmed) return;
        const resetGeneration = (this.studentPasswordResetGeneration || 0) + 1;
        this.studentPasswordResetGeneration = resetGeneration;

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

            const result = await supabaseService.resetStudentPassword(studentId);
            if (generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId
                || resetGeneration !== this.studentPasswordResetGeneration) return;
            await this.invalidateStudentProgressQueries();
            if (generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId
                || resetGeneration !== this.studentPasswordResetGeneration) return;
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
            if (generation !== (this.studentProgressSessionGeneration || 0)
                || this.activeStudentId !== studentId
                || resetGeneration !== this.studentPasswordResetGeneration) return;
            console.error('Password reset failed:', error);
            if (status) {
                status.style.color = 'var(--danger-color)';
                status.textContent = error.message || 'Could not reset password.';
            }
        } finally {
            if (generation === (this.studentProgressSessionGeneration || 0)
                && resetGeneration === this.studentPasswordResetGeneration
                && button) {
                button.disabled = false;
            }
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
