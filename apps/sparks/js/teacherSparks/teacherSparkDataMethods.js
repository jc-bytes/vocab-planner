import { getPanamaDateValue } from '../services/dateUtils.js';
import { DEFAULT_SUBJECT_SLUG } from '../services/vocabularyApi.js';
import { SPARK_CHECK_MODES } from '../sparkCheckModel.js';
import { normalizeSparkRecord, SPARK_GRADE_LEVELS } from '../sparkModel.js';
import { compareSparkSchedule } from './sparkSchedule.js';

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
        return `spark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    },

    invalidateWeeklySparkCache() {
        this.weeklySparkLoadGeneration += 1;
        this.weeklySparkCache = null;
        this.weeklySparkPromise = null;
    },

    async fetchWeeklySparks() {
        if (this.isAuthenticationDisabled()) return [];
        if (!this.ensureAuthenticated(false)) return [];

        return (await this.repository.list())
            .map(spark => this.normalizeSpark(spark))
            .sort(compareSparkSchedule);
    },

    async getWeeklySparks({ forceRefresh = false, generation = null } = {}) {
        if (!forceRefresh && this.weeklySparkCache) return this.weeklySparkCache;
        if (!forceRefresh && this.weeklySparkPromise) return this.weeklySparkPromise;

        const requestGeneration = generation ?? ++this.weeklySparkLoadGeneration;
        const request = this.fetchWeeklySparks()
            .then(sparks => {
                if (requestGeneration === this.weeklySparkLoadGeneration) {
                    this.weeklySparkCache = sparks;
                }
                return sparks;
            })
            .finally(() => {
                if (this.weeklySparkPromise === request) this.weeklySparkPromise = null;
            });
        this.weeklySparkPromise = request;

        return request;
    },

async showSparksView() {
        if (!this.ensureAuthenticated(false)) return;
        this.showView();
        await this.loadWeeklySparks();
    },

    async loadWeeklySparks({ forceRefresh = false } = {}) {
        const list = this.query('#spark-library-list');
        if (!list) return;

        let generation = this.weeklySparkLoadGeneration;
        if (forceRefresh || (!this.weeklySparkCache && !this.weeklySparkPromise)) {
            generation = ++this.weeklySparkLoadGeneration;
        }
        if (!this.weeklySparkItems.length) {
            list.innerHTML = '<div class="loading-spinner">Loading Sparks...</div>';
        } else {
            list.setAttribute('aria-busy', 'true');
        }

        try {
            const sparks = await this.getWeeklySparks({ forceRefresh, generation });
            if (generation !== this.weeklySparkLoadGeneration) return;
            this.weeklySparkItems = sparks;
            this.renderSparkLibrary();
        } catch (error) {
            if (generation !== this.weeklySparkLoadGeneration) return;
            console.error('Failed to load Sparks:', error);
            list.innerHTML = '<p class="teacher-empty-state">Could not load Sparks.</p>';
            this.feedback.warning('Could not load Sparks.');
        } finally {
            if (generation === this.weeklySparkLoadGeneration) {
                list.removeAttribute('aria-busy');
                this.refreshIcons();
            }
        }
    },
};
