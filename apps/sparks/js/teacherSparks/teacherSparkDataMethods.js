import { schoolSessionKey } from '../services/schoolScope.js';
import { getPanamaDateValue } from '../services/dateUtils.js';
import { DEFAULT_SUBJECT_SLUG } from '../services/vocabularyApi.js';
import { SPARK_CHECK_MODES } from '../sparkCheckModel.js';
import { normalizeSparkRecord, SPARK_GRADE_LEVELS } from '../sparkModel.js';
import { compareSparkSchedule } from './sparkSchedule.js';
import { createUniqueId } from '../randomUtils.js';

const WEEKLY_SPARK_STALE_TIME_MS = 60 * 1000;
const WEEKLY_SPARK_QUERY_KEY = ['teacher', 'weekly-sparks'];

function getWeeklySparkAccountId(owner) {
    if (owner.isAuthenticationDisabled()) return 'local-development';
    const user = owner.getCurrentUser?.();
    return user?.uid || user?.id || '';
}

export const teacherSparkDataMethods = {
normalizeSpark(spark = {}) {
        return normalizeSparkRecord(spark, { defaultSubjectSlug: DEFAULT_SUBJECT_SLUG });
    },

createDefaultSpark() {
        return this.normalizeSpark({
            sparkType: 'cool_fact',
            checkMode: SPARK_CHECK_MODES.OPTIONAL,
            questions: [],
            status: 'draft',
            scheduledDate: getPanamaDateValue(),
            targetGrades: SPARK_GRADE_LEVELS
        });
    },

createSparkId() {
        return createUniqueId('spark_');
    },

    async invalidateWeeklySparks() {
        this.weeklySparkLoadGeneration += 1;
        await this.queryService.invalidate({
            accountId: getWeeklySparkAccountId(this),
            key: WEEKLY_SPARK_QUERY_KEY,
            exact: true
        });
    },

    async fetchWeeklySparks({ signal } = {}) {
        if (this.isAuthenticationDisabled()) return [];
        if (!this.ensureAuthenticated(false)) return [];

        return (await this.repository.list({ signal }))
            .map(spark => this.normalizeSpark(spark))
            .sort(compareSparkSchedule);
    },

    getWeeklySparks({ forceRefresh = false } = {}) {
        const query = {
            accountId: getWeeklySparkAccountId(this),
            key: WEEKLY_SPARK_QUERY_KEY,
            staleTime: WEEKLY_SPARK_STALE_TIME_MS,
            queryFn: ({ signal }) => this.fetchWeeklySparks({ signal })
        };
        return forceRefresh
            ? this.queryService.refresh(query)
            : this.queryService.ensure(query);
    },

async showSparksView() {
        this.weeklySparkEditorGeneration += 1;
        if (!this.ensureAuthenticated(false)) return;
        this.showView();
        await this.loadWeeklySparks();
    },

    async loadWeeklySparks({ forceRefresh = false } = {}) {
        const list = this.query('#spark-library-list');
        if (!list) return;

        const generation = ++this.weeklySparkLoadGeneration;
        const scope = schoolSessionKey(getWeeklySparkAccountId(this));
        const current = () => generation === this.weeklySparkLoadGeneration && scope === schoolSessionKey(getWeeklySparkAccountId(this));
        const keepContent = this.weeklySparkLoadedScope === scope;
        if (!keepContent) {
            list.innerHTML = '<div class="loading-spinner">Loading Sparks...</div>';
        } else {
            list.setAttribute('aria-busy', 'true');
        }

        try {
            const sparks = await this.getWeeklySparks({ forceRefresh });
            if (!current()) return;
            this.weeklySparkLoadedScope = scope;
            this.weeklySparkItems = sparks;
            this.renderSparkLibrary();
        } catch (error) {
            if (!current()) return;
            const { showSectionLoadError } = await import('../ui/sectionRecovery.js');
            showSectionLoadError(list, { label: 'the Spark library', error, current, keepContent,
                retry: () => this.loadWeeklySparks({ forceRefresh: true }) });
        } finally {
            if (current()) {
                list.removeAttribute('aria-busy');
                this.refreshIcons();
            }
        }
    },
};
