import { $, escapeHtml } from './main.js';
import { supabaseService } from './supabaseService.js';
import { serverStateQuery } from './services/serverStateQuery.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';
import { getActivityLabel } from './activityMetadata.js';

const OVERVIEW_PAGE = teacherPageRegistry.get('overview');
const OVERVIEW_QUERY_KEY = ['teacher', 'dashboard-analytics'];
const OVERVIEW_STALE_TIME_MS = 60_000;

function getTeacherAccountId(owner) {
    if (owner.authDisabled) return 'local-development';
    return owner.currentUser?.uid || owner.currentUser?.id || '';
}

export function installTeacherOverviewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, {
        async loadTeacherOverview() {
            if (!this.ensureAuthenticated(false)) return;
            this.renderOverviewLoadingState();
            this.loadOverviewVocabCount();

            this.scheduleOverviewStudentDataLoad();
        },

        renderOverviewLoadingState() {
            $('#overview-total-students').textContent = this.overviewAnalytics ? this.overviewAnalytics.totalStudents : '--';
            $('#overview-recent-activity-count').textContent = this.overviewAnalytics
                ? `${this.overviewAnalytics.recentActivities?.length || 0}`
                : '--';
            const recentContainer = $('#overview-recent-activity');
            if (recentContainer && !this.overviewAnalytics) {
                recentContainer.innerHTML = '<div class="loading-spinner runtime-status">Loading recent activity...</div>';
            }
        },

        scheduleOverviewStudentDataLoad() {
            const accountId = getTeacherAccountId(this);
            const generation = this.teacherSettingsSessionGeneration || 0;

            const load = async () => {
                try {
                    const analytics = await serverStateQuery.ensure({
                        accountId,
                        key: OVERVIEW_QUERY_KEY,
                        staleTime: OVERVIEW_STALE_TIME_MS,
                        queryFn: () => supabaseService.getTeacherDashboardAnalytics()
                    });
                    if (generation !== (this.teacherSettingsSessionGeneration || 0)
                        || accountId !== getTeacherAccountId(this)) return;
                    this.overviewAnalytics = analytics;
                    if (this.getSectionForView(OVERVIEW_PAGE.viewId) === OVERVIEW_PAGE.id && !$(`#${OVERVIEW_PAGE.viewId}`)?.classList.contains('hidden')) {
                        this.renderOverviewStats();
                        this.renderOverviewRecentActivity();
                    }
                } catch {
                    const recentContainer = $('#overview-recent-activity');
                    if (recentContainer) {
                        recentContainer.innerHTML = '<p class="teacher-empty-state">Student activity is unavailable right now.</p>';
                    }
                }
            };

            void load();
        },

        renderOverviewStats() {
            const analytics = this.overviewAnalytics || {};
            $('#overview-total-students').textContent = `${analytics.totalStudents ?? '--'}`;
            $('#overview-recent-activity-count').textContent = `${analytics.recentActivities?.length || 0}`;
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
            const recent = (this.overviewAnalytics?.recentActivities || []).slice(0, 20);

            if (recent.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No recent student activity yet.</p>';
                return;
            }

            container.innerHTML = recent.map(activity => {
                const name = activity.student || 'Unknown student';
                const label = getActivityLabel(activity.activityType);
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
