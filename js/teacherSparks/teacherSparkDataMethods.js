import { $, notifications } from '../main.js';
import { sparksRepository } from '../services/sparksRepository.js';
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
        this.weeklySparkCache = null;
        this.weeklySparkPromise = null;
    },

async fetchWeeklySparks() {
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        return (await sparksRepository.list())
            .map(spark => this.normalizeSpark(spark))
            .sort(compareSparkSchedule);
    },

async getWeeklySparks({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.weeklySparkCache) return this.weeklySparkCache;
        if (!forceRefresh && this.weeklySparkPromise) return this.weeklySparkPromise;

        this.weeklySparkPromise = this.fetchWeeklySparks()
            .then(sparks => {
                this.weeklySparkCache = sparks;
                return sparks;
            })
            .finally(() => {
                this.weeklySparkPromise = null;
            });

        return this.weeklySparkPromise;
    },

async showSparksView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-sparks-view');
        await this.loadWeeklySparks();
    },

async loadWeeklySparks({ forceRefresh = false } = {}) {
        const list = $('#spark-library-list');
        if (!list) return;

        this.weeklySparkRefreshing = true;
        if (!this.weeklySparkItems.length) {
            list.innerHTML = '<div class="loading-spinner">Loading Sparks...</div>';
        } else {
            list.setAttribute('aria-busy', 'true');
        }

        try {
            const sparks = await this.getWeeklySparks({ forceRefresh });
            this.weeklySparkItems = sparks;
            this.renderSparkLibrary();
        } catch (error) {
            console.error('Failed to load Sparks:', error);
            list.innerHTML = '<p class="teacher-empty-state">Could not load Sparks.</p>';
            notifications.warning('Could not load Sparks.');
        } finally {
            this.weeklySparkRefreshing = false;
            list.removeAttribute('aria-busy');
            this.refreshIcons();
        }
    },
};

