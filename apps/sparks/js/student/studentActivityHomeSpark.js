import { imageDB } from '../db.js';
import {
    getActiveStudentStorageOwner,
    isActiveStudentStorageOwner
} from './persistence/studentStorage.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { getPanamaDateValue } from '../services/dateUtils.js';
import { sparkResponsesRepository } from '../services/sparkResponsesRepository.js';
import { sparksRepository } from '../services/sparksRepository.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { schoolContext } from '../services/schoolContext.js';
import { normalizeSchoolCalendar } from '../services/vocabularyApi.js';
import {
    evaluateSparkAnswers,
    getSparkQuestionsForGrade,
    SPARK_CHECK_MODES
} from '../sparkCheckModel.js';
import {
    isAllGradeSpark,
    normalizeSparkRecord
} from '../sparkModel.js';

export class StudentActivityHomeSpark {
    constructor(home) {
        this.home = home;
        this.activities = home.activities;
        this.sm = home.sm;
        this.queryService = home.queryService || serverStateQuery;
        this.currentSpark = null;
        this.sparkResponseSyncSequence = new Map();
    }

    normalizeSpark(spark = {}) {
        return normalizeSparkRecord(spark);
    }

    getStudentGradeLevel() {
        return String(this.sm.studentProfile?.grade || '').match(/\d+/)?.[0] || '';
    }

    getCurrentSparkDateRange(dateValue = getPanamaDateValue()) {
        const date = new Date(`${dateValue}T12:00:00`);
        const trimester = this.activities.getCurrentTrimesterKey(date);
        const calendar = normalizeSchoolCalendar(this.activities.schoolCalendar, date);
        const range = calendar.trimesters?.[trimester] || {};
        return {
            trimester,
            onOrAfter: String(range.startDate || ''),
            onOrBefore: dateValue
        };
    }

    captureCurrentSparkScope(isCurrent = () => true) {
        const user = this.sm.currentUser;
        const ownerId = user?.uid || user?.id;
        const authMode = this.sm.authDisabled;
        const cloud = this.sm.progress?.cloud;
        const session = cloud?.cloudGeneration;
        const school = schoolContext.getGeneration();
        const selection = this.activities.vocabularyData?.classSelection;
        const generation = selection?.generation;
        const classId = selection?.selectedId;
        const subject = this.sm.selectedSubjectSlug;
        const grade = this.getStudentGradeLevel();
        return () => isCurrent() && user === this.sm.currentUser
            && ownerId === (this.sm.currentUser?.uid || this.sm.currentUser?.id)
            && authMode === this.sm.authDisabled && cloud === this.sm.progress?.cloud
            && session === cloud?.cloudGeneration && school === schoolContext.getGeneration()
            && selection === this.activities.vocabularyData?.classSelection
            && generation === selection?.generation && classId === selection?.selectedId
            && subject === this.sm.selectedSubjectSlug && grade === this.getStudentGradeLevel();
    }

    async fetchCurrentSpark({ isCurrent = () => true } = {}) {
        const current = this.captureCurrentSparkScope(isCurrent);
        const { sparkLibraryMethods } = await import('./studentSparkLibraryMethods.js');
        if (!current()) return;
        return sparkLibraryMethods.fetchCurrentSpark.call(this, { isCurrent: current });
    }

    async fetchAvailableSparks(...args) {
        const owner = this.sm.currentUser;
        const { sparkLibraryMethods } = await import('./studentSparkLibraryMethods.js');
        if (owner !== this.sm.currentUser) return;
        return sparkLibraryMethods.fetchAvailableSparks.apply(this, args);
    }

    getSparkLibraryStorageKey() {
        const studentId = String(this.sm.currentUser?.id || this.sm.currentUser?.email || 'student');
        const subjectSlug = String(this.sm.selectedSubjectSlug || 'technology');
        return `student_spark_library_v1:${studentId}:${subjectSlug}`;
    }

    loadSparkLibraryProgress() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.getSparkLibraryStorageKey()) || '{}');
            return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
        } catch {
            return {};
        }
    }

    persistSparkLibraryProgress(progress = {}) {
        localStorage.setItem(this.getSparkLibraryStorageKey(), JSON.stringify(progress));
    }

    mergeSparkLibraryProgress(localProgress = {}, cloudResponses = []) {
        const merged = { ...localProgress };
        cloudResponses.forEach(response => {
            if (!response?.sparkId) return;
            const local = merged[response.sparkId];
            if (local?.syncStatus === 'pending') return;
            const localTime = Date.parse(local?.updatedAt || '') || 0;
            const cloudTime = Date.parse(response.updatedAt || '') || 0;
            if (!local || cloudTime >= localTime) merged[response.sparkId] = response;
        });
        return merged;
    }

    retryPendingSparkResponses(progress = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return;
        Object.values(progress).forEach(state => {
            if (!state?.sparkId || state.syncStatus !== 'pending'
                || this.sparkResponseSyncSequence.has(state.sparkId)) return;
            this.sparkResponseSyncSequence.set(state.sparkId, 1);
            void this.syncSparkLibraryState(state, 1);
        });
    }

    async hydrateSparkLibraryProgress(sparkIds = [], { isCurrent = () => true } = {}) {
        const current = this.captureCurrentSparkScope(isCurrent);
        const { sparkLibraryMethods } = await import('./studentSparkLibraryMethods.js');
        if (!current()) return;
        return sparkLibraryMethods.hydrateSparkLibraryProgress.call(this, sparkIds, { isCurrent: current });
    }

    saveSparkLibraryState(state = {}) {
        if (!state.sparkId) return;
        const progress = this.loadSparkLibraryProgress();
        const sequence = (this.sparkResponseSyncSequence.get(state.sparkId) || 0) + 1;
        this.sparkResponseSyncSequence.set(state.sparkId, sequence);
        progress[state.sparkId] = {
            version: Number(state.version) || 2,
            sparkId: String(state.sparkId),
            answers: state.answers && typeof state.answers === 'object' ? { ...state.answers } : {},
            completedAt: String(state.completedAt || ''),
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending'
        };
        this.persistSparkLibraryProgress(progress);
        this.activities.updateArcadeGateDisplay();
        if (!this.sm.authDisabled && this.sm.currentUser) {
            void this.syncSparkLibraryState(progress[state.sparkId], sequence);
        }
    }

    async syncSparkLibraryState(...args) {
        const owner = this.sm.currentUser;
        const { sparkLibraryMethods } = await import('./studentSparkLibraryMethods.js');
        if (owner !== this.sm.currentUser) return;
        return sparkLibraryMethods.syncSparkLibraryState.apply(this, args);
    }

    getCurrentSparkGateWork() {
        const spark = this.currentSpark;
        if (!spark?.id || spark.checkMode !== SPARK_CHECK_MODES.REQUIRED) return null;
        const state = this.loadSparkLibraryProgress()[spark.id] || null;
        const questions = getSparkQuestionsForGrade(spark, this.getStudentGradeLevel());
        if (questions.length === 0) return null;
        const answers = Number(state?.version) === 1 && state?.response && questions[0]
            ? { [questions[0].id]: state.response }
            : (state?.answers || {});
        const evaluation = evaluateSparkAnswers(questions, answers);
        if (evaluation.isComplete) return null;
        return {
            spark,
            routeId: spark.id,
            remaining: Math.max(1, evaluation.total - evaluation.correct),
            total: evaluation.total
        };
    }

    async refreshCurrentSparkGate({ updateDisplay = true, isCurrent = () => true } = {}) {
        const current = this.captureCurrentSparkScope(isCurrent);
        const assertCurrent = () => {
            if (!current()) throw new DOMException('Spark scope changed', 'AbortError');
        };
        await this.fetchCurrentSpark({ isCurrent: current });
        assertCurrent();
        if (this.currentSpark?.id) {
            await this.hydrateSparkLibraryProgress([this.currentSpark.id], { isCurrent: current });
            assertCurrent();
        }
        const work = this.getCurrentSparkGateWork();
        if (updateDisplay) this.activities.updateArcadeGateDisplay();
        return work;
    }

    async renderSparkLibrary(...args) {
        const owner = this.sm.currentUser;
        const { sparkLibraryMethods } = await import('./studentSparkLibraryMethods.js');
        if (owner !== this.sm.currentUser) return;
        return sparkLibraryMethods.renderSparkLibrary.apply(this, args);
    }

    async loadAndRenderCurrentSpark(host, { isCurrent = () => true } = {}) {
        if (!host) return;
        const scope = this.captureCurrentSparkScope(isCurrent);
        const render = this.home.renderGeneration;
        const route = globalThis.location?.hash;
        const navigation = this.sm.routing?.arcadeReadController?.signal;
        const dashboard = host.closest?.('#student-home-dashboard');
        const current = () => scope() && render === this.home.renderGeneration
            && route === globalThis.location?.hash && !navigation?.aborted
            && navigation === this.sm.routing?.arcadeReadController?.signal
            && host.isConnected && dashboard === host.closest?.('#student-home-dashboard');
        let renderer;
        try { renderer = await this.home.preparePresentation({ isCurrent: current }); }
        catch (error) { if (!current()) return; throw error; }
        if (!current()) return;
        return renderer.renderCurrentHomeSpark.call(this, host, { isCurrent: current });
    }

    getStudentSparkQuestion(spark) {
        return getSparkQuestionsForGrade(spark, this.getStudentGradeLevel())[0]?.prompt || '';
    }

}
