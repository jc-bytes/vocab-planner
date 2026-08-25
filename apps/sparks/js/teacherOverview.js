import { $, escapeHtml } from './main.js';
import { supabaseService } from './supabaseService.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const OVERVIEW_PAGE = teacherPageRegistry.get('overview');

export function installTeacherOverviewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, {
        async loadTeacherOverview() {
            if (!this.ensureAuthenticated(false)) return;
            this.renderOverviewLoadingState();
            this.loadOverviewVocabCount();

            if (this.overviewAnalytics) {
                this.renderOverviewStats();
                this.renderOverviewRecentActivity();
                return;
            }

            this.scheduleOverviewStudentDataLoad();
        },

        renderOverviewLoadingState() {
            $('#overview-total-students').textContent = this.overviewAnalytics ? this.overviewAnalytics.totalStudents : '--';
            $('#overview-active-students').textContent = this.overviewAnalytics ? this.overviewAnalytics.activeStudents : '--';
            $('#overview-avg-coins').textContent = this.overviewAnalytics ? this.overviewAnalytics.averageCoins : '--';
            const recentContainer = $('#overview-recent-activity');
            if (recentContainer && !this.overviewAnalytics) {
                recentContainer.innerHTML = '<div class="loading-spinner runtime-status">Loading recent activity...</div>';
            }
        },

        scheduleOverviewStudentDataLoad() {
            if (this.overviewStudentLoadScheduled) return;
            this.overviewStudentLoadScheduled = true;

            const load = async () => {
                try {
                    this.overviewAnalytics = await supabaseService.getTeacherDashboardAnalytics();
                    if (this.getSectionForView(OVERVIEW_PAGE.viewId) === OVERVIEW_PAGE.id && !$(`#${OVERVIEW_PAGE.viewId}`)?.classList.contains('hidden')) {
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

            void load();
        },

        renderOverviewStats() {
            const analytics = this.overviewAnalytics || {};
            $('#overview-total-students').textContent = `${analytics.totalStudents ?? '--'}`;
            $('#overview-active-students').textContent = `${analytics.activeStudents ?? '--'}`;
            $('#overview-avg-coins').textContent = `${analytics.averageCoins ?? '--'}`;
        },

        async loadOverviewVocabCount() {
            const countEl = $('#overview-vocab-count');
            if (!countEl) return;
            const isCurrent = this.createTeacherVocabularyOperationGuard();
            try {
                const { cloudVocabs, remoteVocabs, localVocabs, stale } = await this.getTeacherLibrary();
                if (!isCurrent() || stale) return;
                countEl.textContent = `${cloudVocabs.length + remoteVocabs.length + localVocabs.length}`;
            } catch (error) {
                if (!isCurrent()) return;
                console.error('Failed to load overview vocabulary count:', error);
                countEl.textContent = '--';
            }
        },

        renderOverviewRecentActivity() {
            const container = $('#overview-recent-activity');
            if (!container) return;
            const activityLabels = {
                matching: 'Matching', flashcards: 'Flashcards', quiz: 'Quiz', hangman: 'Hangman',
                fillInBlank: 'Fill in Blank', wordSearch: 'Word Search', crossword: 'Crossword',
                scramble: 'Word Scramble', wordle: 'Vocabulary Wordle', illustration: 'Word Hunt'
            };
            const recent = (this.overviewAnalytics?.recentActivities || []).slice(0, 20);

            if (recent.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No recent student activity yet.</p>';
                return;
            }

            container.innerHTML = recent.map(activity => {
                const name = activity.student || 'Unknown student';
                const label = activityLabels[activity.activityType] || activity.activityType || 'Activity';
                const date = activity.occurredAt ? new Date(activity.occurredAt).toLocaleString() : '';
                return `
                    <div class="teacher-activity-item">
                        <div>
                            <strong>${escapeHtml(name)}</strong>
                            <span>${escapeHtml(label)}</span>
                        </div>
                        <time>${escapeHtml(date)}</time>
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
