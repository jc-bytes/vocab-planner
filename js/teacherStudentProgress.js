import { $, $$, createElement, escapeHtml, notifications, openModal } from './main.js';
import {
    teacherApi as supabaseService,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    writeBatch
} from './services/teacherApi.js';

class TeacherStudentProgressMethods {
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
        const groups = new Set();

        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            if (profile.grade) grades.add(profile.grade);
            if (profile.group) groups.add(profile.group);
        });

        const gradeSelect = $('#filter-grade');
        const groupSelect = $('#filter-group');

        if (gradeSelect) {
            gradeSelect.innerHTML = '<option value="">All Grades</option>';
            Array.from(grades).sort().forEach(g => {
                const opt = createElement('option');
                opt.value = g;
                opt.textContent = g;
                gradeSelect.appendChild(opt);
            });
        }

        if (groupSelect) {
            groupSelect.innerHTML = '<option value="">All Groups</option>';
            Array.from(groups).sort().forEach(g => {
                const opt = createElement('option');
                opt.value = g;
                opt.textContent = g;
                groupSelect.appendChild(opt);
            });
        }
    }

    applyFilters() {
        const grade = $('#filter-grade').value;
        const group = $('#filter-group').value;
        const search = $('#filter-search').value.toLowerCase();

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
    updateCoinStatus(message, state = 'muted') {
        const el = $('#coin-adjust-status');
        if (!el) return;
        const colors = {
            success: 'var(--accent-color)',
            muted: 'var(--text-muted)',
            error: 'var(--danger-color)'
        };
        el.style.color = colors[state] || colors.muted;
        el.textContent = message;
    }

    async handleCoinAdjust() {
        if (!this.activeStudentId) return;
        const input = $('#coin-adjust-input');
        const amount = parseInt(input.value, 10) || 0;
        if (amount <= 0) {
            this.updateCoinStatus('Enter a positive number.', 'error');
            return;
        }
        this.updateCoinStatus('Saving...', 'muted');
        try {
            await this.adjustStudentCoins(this.activeStudentId, amount);
            this.updateCoinStatus(`Added ${amount} coins.`, 'success');
            $('#coin-adjust-input').value = '10';
        } catch (err) {
            console.error('Failed to adjust coins', err);
            this.updateCoinStatus('Failed to update coins.', 'error');
        }
    }

    async adjustStudentCoins(studentId, amount, message = '') {
        const student = this.allStudentData.find(s => s.id === studentId);
        if (!student) throw new Error('Student not found');

        const db = supabaseService.getDatabase();
        const ref = doc(db, 'studentProgress', studentId);
        
        // Get current coin data
        const snapshot = await getDoc(ref);
        let coinData = {
            balance: 0,
            giftCoins: 0,
            totalEarned: 0,
            totalSpent: 0,
            totalGifted: 0
        };
        
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.coinData) {
                coinData = data.coinData;
            } else {
                // Migrate old format
                const oldCoins = data.coins || 0;
                coinData = {
                    balance: oldCoins,
                    giftCoins: 0,
                    totalEarned: oldCoins,
                    totalSpent: 0,
                    totalGifted: 0
                };
            }
        }

        // Add to giftCoins instead of balance
        coinData.giftCoins = (coinData.giftCoins || 0) + amount;
        
        // Update coin history
        const coinHistory = snapshot.data()?.coinHistory || [];
        coinHistory.push({
            type: 'gift',
            amount: amount,
            timestamp: new Date().toISOString(),
            source: 'teacher',
            description: message || 'Gift from teacher'
        });

        await setDoc(ref, {
            coinData: coinData,
            coinHistory: coinHistory.slice(-100), // Keep last 100
            coins: coinData.balance, // Legacy support
            updatedAt: serverTimestamp()
        }, { merge: true });

        // Update local student data (for display)
        student.coins = coinData.balance; // Show current balance, not including pending gifts
        const filteredItem = this.filteredStudentData.find(s => s.id === studentId);
        if (filteredItem) filteredItem.coins = coinData.balance;

        $('#detail-student-coins').textContent = coinData.balance;
        this.renderProgressTable();
    }

    handleSelectAll(checked) {
        if (checked) {
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.add(student.id);
            });
        } else {
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.delete(student.id);
            });
        }
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    clearSelection() {
        this.selectedStudents.clear();
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    updateBulkToolbar() {
        const toolbar = $('#bulk-action-toolbar');
        const count = $('#bulk-selected-count');

        if (this.selectedStudents.size > 0) {
            toolbar?.classList.remove('hidden');
            if (count) {
                count.textContent = `${this.selectedStudents.size} student${this.selectedStudents.size > 1 ? 's' : ''} selected`;
            }
        } else {
            toolbar?.classList.add('hidden');
        }
    }

    updateSelectAllCheckbox() {
        const visibleStudentIds = this.filteredStudentData.map(s => s.id);
        const allVisibleSelected = visibleStudentIds.length > 0 &&
            visibleStudentIds.every(id => this.selectedStudents.has(id));
        const someVisibleSelected = visibleStudentIds.some(id => this.selectedStudents.has(id));

        ['#select-all-students', '#select-visible-students-mobile'].forEach(selector => {
            const checkbox = $(selector);
            if (!checkbox) return;
            checkbox.checked = allVisibleSelected;
            checkbox.indeterminate = !allVisibleSelected && someVisibleSelected;
        });
    }

    async handleBulkCoinAdjust() {
        if (this.selectedStudents.size === 0) {
            alert('Please select at least one student.');
            return;
        }

        const input = $('#bulk-coin-input');
        const amount = parseInt(input?.value, 10) || 0;

        if (amount <= 0) {
            alert('Please enter a positive number of coins.');
            return;
        }

        const confirmed = confirm(
            `Add ${amount} coins to ${this.selectedStudents.size} selected student${this.selectedStudents.size > 1 ? 's' : ''}?`
        );

        if (!confirmed) return;

        try {
            const db = supabaseService.getDatabase();
            const batch = writeBatch(db);

            // First, fetch all student data
            const studentSnapshots = await Promise.all(
                Array.from(this.selectedStudents).map(studentId => 
                    getDoc(doc(db, 'studentProgress', studentId))
                )
            );

            // Update each selected student
            let index = 0;
            for (const studentId of this.selectedStudents) {
                const student = this.allStudentData.find(s => s.id === studentId);
                if (!student) {
                    index++;
                    continue;
                }

                const snapshot = studentSnapshots[index];
                const ref = doc(db, 'studentProgress', studentId);
                
                let coinData = {
                    balance: 0,
                    giftCoins: 0,
                    totalEarned: 0,
                    totalSpent: 0,
                    totalGifted: 0
                };
                
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.coinData) {
                        coinData = { ...data.coinData }; // Clone to avoid mutation
                    } else {
                        // Migrate old format
                        const oldCoins = data.coins || 0;
                        coinData = {
                            balance: oldCoins,
                            giftCoins: 0,
                            totalEarned: oldCoins,
                            totalSpent: 0,
                            totalGifted: 0
                        };
                    }
                }

                // Add to giftCoins
                coinData.giftCoins = (coinData.giftCoins || 0) + amount;
                
                // Update coin history
                const coinHistory = [...(snapshot.data()?.coinHistory || [])];
                coinHistory.push({
                    type: 'gift',
                    amount: amount,
                    timestamp: new Date().toISOString(),
                    source: 'teacher',
                    description: 'Bulk gift from teacher'
                });

                batch.set(ref, {
                    coinData: coinData,
                    coinHistory: coinHistory.slice(-100),
                    coins: coinData.balance, // Legacy support
                    updatedAt: serverTimestamp()
                }, { merge: true });

                // Update local data
                student.coins = coinData.balance;
                const filteredItem = this.filteredStudentData.find(s => s.id === studentId);
                if (filteredItem) filteredItem.coins = coinData.balance;
                
                index++;
            }

            await batch.commit();

            alert(`Successfully gifted ${amount} coins to ${this.selectedStudents.size} student${this.selectedStudents.size > 1 ? 's' : ''}! They will receive a notification when they log in.`);

            // Clear selection and refresh UI
            this.clearSelection();
            this.renderProgressTable();
        } catch (error) {
            console.error('Bulk coin adjustment failed:', error);
            alert('Failed to update coins. Please try again.');
        }
    }
}

export function installTeacherStudentProgressMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherStudentProgressMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherStudentProgressMethods.prototype, name)
        );
    }
}
