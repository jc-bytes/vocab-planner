import { $, escapeHtml } from './main.js';

export function installTeacherOverviewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, {
        async loadTeacherOverview() {
            if (!this.ensureAuthenticated(false)) return;
            this.renderOverviewLoadingState();
            this.loadOverviewVocabCount();

            if (this.studentProgressCache) {
                this.applyStudentProgressData(this.studentProgressCache.data);
                this.renderOverviewStats();
                this.renderOverviewRecentActivity();
                return;
            }

            this.scheduleOverviewStudentDataLoad();
        },

        renderOverviewLoadingState() {
            $('#overview-total-students').textContent = this.studentProgressCache ? this.allStudentData.length : '--';
            $('#overview-active-students').textContent = this.studentProgressCache ? $('#overview-active-students').textContent : '--';
            $('#overview-avg-coins').textContent = this.studentProgressCache ? $('#overview-avg-coins').textContent : '--';
            const recentContainer = $('#overview-recent-activity');
            if (recentContainer && !this.studentProgressCache) {
                recentContainer.innerHTML = '<div class="loading-spinner runtime-status">Loading recent activity...</div>';
            }
        },

        scheduleOverviewStudentDataLoad() {
            if (this.overviewStudentLoadScheduled || this.studentProgressPromise) return;
            this.overviewStudentLoadScheduled = true;

            const load = async () => {
                try {
                    await this.getStudentProgressData({ showError: false });
                    if (this.getSectionForView('teacher-overview-view') === 'overview' && !$('#teacher-overview-view')?.classList.contains('hidden')) {
                        this.renderOverviewStats();
                        this.renderOverviewRecentActivity();
                    }
                } catch {
                    const recentContainer = $('#overview-recent-activity');
                    if (recentContainer) {
                        recentContainer.innerHTML = '<p class="teacher-empty-state">Student activity is unavailable right now.</p>';
                    }
                } finally {
                    this.overviewStudentLoadScheduled = false;
                }
            };

            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(load, { timeout: 2500 });
            } else {
                window.setTimeout(load, 1200);
            }
        },

        renderOverviewStats() {
            const total = this.allStudentData.length;
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            const active = this.allStudentData.filter(student => {
                const time = this.getStudentUpdatedTime(student);
                return time && now - time <= sevenDays;
            }).length;
            const totalCoins = this.allStudentData.reduce((sum, student) => {
                const coins = student.coinData?.balance ?? student.coins ?? 0;
                return sum + coins;
            }, 0);
            const avgCoins = total ? Math.round(totalCoins / total) : 0;

            $('#overview-total-students').textContent = total || '--';
            $('#overview-active-students').textContent = active || '0';
            $('#overview-avg-coins').textContent = `${avgCoins}`;
        },

        async loadOverviewVocabCount() {
            const countEl = $('#overview-vocab-count');
            if (!countEl) return;
            try {
                const { cloudVocabs, remoteVocabs, localVocabs } = await this.getTeacherLibrary();
                countEl.textContent = `${cloudVocabs.length + remoteVocabs.length + localVocabs.length}`;
            } catch (error) {
                console.error('Failed to load overview vocabulary count:', error);
                countEl.textContent = '--';
            }
        },

        renderOverviewRecentActivity() {
            const container = $('#overview-recent-activity');
            if (!container) return;
            const recent = this.allStudentData
                .map(student => ({ student, time: this.getStudentUpdatedTime(student) }))
                .filter(item => item.time)
                .sort((a, b) => b.time - a.time)
                .slice(0, 20);

            if (recent.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No recent student activity yet.</p>';
                return;
            }

            container.innerHTML = recent.map(({ student, time }) => {
                const profile = student.studentProfile || {};
                const name = profile.firstName && profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`
                    : (profile.name || student.email || 'Unknown student');
                const grade = profile.grade ? `Grade ${profile.grade}` : 'No grade';
                const date = new Date(time).toLocaleString();
                return `
                    <div class="teacher-activity-item">
                        <div>
                            <strong>${escapeHtml(name)}</strong>
                            <span>${escapeHtml(grade)}</span>
                        </div>
                        <time>${date}</time>
                    </div>
                `;
            }).join('');
        },

        getStudentUpdatedTime(student) {
            const value = student?.updatedAt;
            if (!value) return 0;
            if (typeof value.toMillis === 'function') return value.toMillis();
            if (value.seconds) return value.seconds * 1000;
            if (typeof value === 'number') return value;
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? 0 : parsed;
        }
    });
}
