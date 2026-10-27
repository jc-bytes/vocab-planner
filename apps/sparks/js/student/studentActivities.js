/**
 * Student Activities Module
 * Handles vocabulary loading, activity management, and progress tracking
 */

import { renderStudentUnits } from './lazyStudentUnits.js';
import { formatVocabularyCardTitle, formatVocabularyCardDescription, formatVocabularyPurpose, getVocabularyPurposeClass, scheduleFirstVocabularyPreload } from './studentVocabularyPresentation.js';
import { StudentActivityCalendar } from './studentActivityCalendarMethods.js';
import { StudentActivityCoverage } from './studentActivityCoverageMethods.js';
import { StudentActivityHome } from './studentActivityHomeMethods.js';
import { LazyStudentActivityLauncher } from './lazyStudentActivityLauncher.js';
import { StudentActivityMenu } from './studentActivityMenuMethods.js';
import { StudentActivityModuleLoader } from './studentActivityModuleLoaderMethods.js';
import { StudentActivityProgressFlow } from './studentActivityProgressFlowMethods.js';
import { StudentActivityProgressPersistence } from './studentActivityProgressPersistenceMethods.js';
import { getStudentActivityIds } from './studentActivityRegistry.js';
import { StudentActivitySchedule } from './studentActivityScheduleMethods.js';
import { StudentActivitySession } from './studentActivitySession.js';
import { StudentActivityVocabularyData } from './studentActivityVocabularyDataMethods.js';
import { StudentActivityWordHunt } from './studentActivityWordHuntMethods.js';

export class StudentActivities {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
        this.manifest = null;
        this.studentVocabularyViewMode = 'cards';
        try {
            if (localStorage.getItem('student_vocabulary_view_mode') === 'rows') {
                this.studentVocabularyViewMode = 'rows';
            }
        } catch {
            // Display preferences are optional when browser storage is unavailable.
        }
        this.activityRouteTypes = getStudentActivityIds();
        this.session = new StudentActivitySession(this);
        this.calendar = new StudentActivityCalendar(this);
        this.schedule = new StudentActivitySchedule(this);
        this.coverage = new StudentActivityCoverage(this);
        this.progressFlow = new StudentActivityProgressFlow(this);
        this.vocabularyData = new StudentActivityVocabularyData(this);
        this.browser = null;
        this.home = new StudentActivityHome(this);
        this.menu = new StudentActivityMenu(this);
        this.moduleLoader = new StudentActivityModuleLoader(this);
        this.launcher = new LazyStudentActivityLauncher(this);
        this.progressPersistence = new StudentActivityProgressPersistence(this);
        this.wordHunt = new StudentActivityWordHunt(this);
    }

    get schoolCalendar() {
        return this.calendar.schoolCalendar;
    }

    scheduleIdleTask(callback, timeout = 1500) {
        return this.calendar.scheduleIdleTask(callback, timeout);
    }

    getCurrentTrimesterKey(date = new Date()) {
        return this.calendar.getCurrentTrimesterKey(date);
    }

    loadSchoolCalendar(options = {}) {
        return this.calendar.loadSchoolCalendar(options);
    }

    getVocabSchedule(vocab, date = new Date()) {
        return this.schedule.getVocabSchedule(vocab, date);
    }

    getVocabTrimesterKey(vocab) {
        return this.schedule.getVocabTrimesterKey(vocab);
    }

    getTrimesterLabel(trimester) {
        return this.schedule.getTrimesterLabel(trimester);
    }

    getTrimesterOrder(trimester) {
        return this.schedule.getTrimesterOrder(trimester);
    }

    formatUnitCount(count) {
        return this.schedule.formatUnitCount(count);
    }

    formatMonthSummary(monthGroups) {
        return this.schedule.formatMonthSummary(monthGroups);
    }

    buildVocabularyTrimesterGroups(vocabs = []) {
        return this.schedule.buildVocabularyTrimesterGroups(vocabs);
    }

    buildVocabularyMonthGroups(vocabs = []) {
        return this.schedule.buildVocabularyMonthGroups(vocabs);
    }

    normalizeMonthKey(month) {
        return this.schedule.normalizeMonthKey(month);
    }

    getMonthLabel(monthKey) {
        return this.schedule.getMonthLabel(monthKey);
    }

    getMonthOrder(monthKey) {
        return this.schedule.getMonthOrder(monthKey);
    }

    compareVocabularySchedule(a, b) {
        return this.schedule.compareVocabularySchedule(a, b);
    }

    filterStudentAvailableVocabulary(vocabs = [], date = new Date()) {
        return this.schedule.filterStudentAvailableVocabulary(vocabs, date);
    }

    isStudentVocabularyAvailable(vocab, date = new Date()) {
        return this.schedule.isStudentVocabularyAvailable(vocab, date);
    }

    getTrimesterWeekStartDate(trimester, week, date = new Date()) {
        return this.schedule.getTrimesterWeekStartDate(trimester, week, date);
    }

    getMonthWeekStartDate(month, week, trimester, date = new Date()) {
        return this.schedule.getMonthWeekStartDate(month, week, trimester, date);
    }

    parseLocalDateOnly(value) {
        return this.schedule.parseLocalDateOnly(value);
    }

    loadManifest() {
        return this.vocabularyData.loadManifest();
    }

    getAllVocabularySources() {
        return this.vocabularyData.getAllVocabularySources();
    }

    dedupeVocabularySources(vocabs = []) {
        return this.vocabularyData.dedupeVocabularySources(vocabs);
    }

    getVisibleVocabularyList(options = {}) {
        return this.vocabularyData.getVisibleVocabularyList(options);
    }

    getGradeMatchedVocabularySources() {
        return this.vocabularyData.getGradeMatchedVocabularySources();
    }

    renderSubjectPicker(targetId) {
        return this.vocabularyData.renderSubjectPicker(targetId);
    }

    loadVocabularyOverride(vocabMeta) {
        return this.vocabularyData.loadVocabularyOverride(vocabMeta);
    }

    mergeVocabularyData(options = {}) {
        return this.vocabularyData.mergeVocabularyData(options);
    }

    loadVocabulary(vocabMeta, options = {}) {
        return this.vocabularyData.loadVocabulary(vocabMeta, options);
    }

    startVerifiedActivityAttempt(activityType, options = {}) {
        return this.progressPersistence.startVerifiedActivityAttempt(activityType, options);
    }

    prepareActiveRuntime(options = {}) {
        return this.progressPersistence.prepareActiveRuntime(options);
    }

    markWordsPracticed(activityType, words) {
        return this.coverage.markWordsPracticed(activityType, words);
    }

    getWordCoverageStats() {
        return this.coverage.getWordCoverageStats();
    }

    getPrioritizedWords(activityType, limit = 10, sourceWords = null) {
        return this.coverage.getPrioritizedWords(activityType, limit, sourceWords);
    }

    updateOverallCoverageDisplay(coverageStats) {
        return this.coverage.updateOverallCoverageDisplay(coverageStats);
    }

    getUnitGrade(vocab = this.sm.currentVocab) {
        return this.progressFlow.getUnitGrade(vocab);
    }

    getUnitProgressKey(vocab = this.sm.currentVocab) {
        return this.progressFlow.getUnitProgressKey(vocab);
    }

    getCurrentUnitProgress() {
        return this.progressFlow.getCurrentUnitProgress();
    }

    restoreWordsFromState(initialState, fallbackWords, filter = null) {
        return this.progressFlow.restoreWordsFromState(initialState, fallbackWords, filter);
    }

    getDefaultRequiredActivities(vocab = this.sm.currentVocab) {
        return this.progressFlow.getDefaultRequiredActivities(vocab);
    }

    getActivityPlayableCount(activityType, vocab = this.sm.currentVocab) {
        return this.progressFlow.getActivityPlayableCount(activityType, vocab);
    }

    isActivityWordPlayable(activityType, word) {
        return this.progressFlow.isActivityWordPlayable(activityType, word);
    }

    getRequiredActivityMinimum(vocab = this.sm.currentVocab) {
        return this.progressFlow.getRequiredActivityMinimum(vocab);
    }

    isActivitySuitableForRequired(activityType, vocab = this.sm.currentVocab) {
        return this.progressFlow.isActivitySuitableForRequired(activityType, vocab);
    }

    replaceUnsuitableRequiredActivities(requiredActivities, vocab = this.sm.currentVocab, validIds) {
        return this.progressFlow.replaceUnsuitableRequiredActivities(requiredActivities, vocab, validIds);
    }

    getActivityFlowConfig(vocab = this.sm.currentVocab) {
        return this.progressFlow.getActivityFlowConfig(vocab);
    }

    isActivityComplete(activityType) {
        return this.progressFlow.isActivityComplete(activityType);
    }

    isActivityScoreComplete(scoreData) {
        return this.progressFlow.isActivityScoreComplete(scoreData);
    }

    getUnitRequiredCompletion(vocab) {
        return this.progressFlow.getUnitRequiredCompletion(vocab);
    }

    getPendingRequiredWork(date = new Date()) {
        return this.progressFlow.getPendingRequiredWork(date);
    }

    getRequiredCompletion(flow = this.getActivityFlowConfig()) {
        return this.progressFlow.getRequiredCompletion(flow);
    }

    isActivityUnlocked(activityType) {
        return this.progressFlow.isActivityUnlocked(activityType);
    }

    updateActivityGateDisplay(cards, flow = this.getActivityFlowConfig()) {
        return this.progressFlow.updateActivityGateDisplay(cards, flow);
    }

    updateArcadeGateDisplay(status = this.getPendingRequiredWork()) {
        return this.progressFlow.updateArcadeGateDisplay(status);
    }

    scheduleActivityPreload(flow = this.getActivityFlowConfig()) {
        return this.progressFlow.scheduleActivityPreload(flow);
    }

    uploadWordHuntImage(word, blob, imageInfo = {}) {
        return this.wordHunt.uploadWordHuntImage(word, blob, imageInfo);
    }

    loadWordHuntImage(path) {
        return this.wordHunt.loadWordHuntImage(path);
    }

    getLocalWordHuntEntries(vocab = this.sm.currentVocab) {
        return this.wordHunt.getLocalWordHuntEntries(vocab);
    }

    mergeWordHuntEntry(base = {}, next = {}) {
        return this.wordHunt.mergeWordHuntEntry(base, next);
    }

    mergeWordHuntEntryMaps(...maps) {
        return this.wordHunt.mergeWordHuntEntryMaps(...maps);
    }

    getReportWordHuntEntries() {
        return this.wordHunt.getReportWordHuntEntries();
    }

    setWordHuntExportButtonState(isExporting = false) {
        return this.wordHunt.setWordHuntExportButtonState(isExporting);
    }

    downloadWordHuntSubmission() {
        return this.wordHunt.downloadWordHuntSubmission();
    }

    handleIllustrationSave(vocabName, word, payload) {
        return this.wordHunt.handleIllustrationSave(vocabName, word, payload);
    }

    renderDashboard(options) {
        return renderStudentUnits(this, options);
    }

    getStudentVocabularyViewMode() {
        return this.studentVocabularyViewMode === 'rows' ? 'rows' : 'cards';
    }

    formatVocabularyCardTitle(vocab) {
        return formatVocabularyCardTitle(vocab);
    }

    formatVocabularyPurpose(purpose) {
        return formatVocabularyPurpose(purpose);
    }

    getVocabularyPurposeClass(purpose) {
        return getVocabularyPurposeClass(purpose);
    }

    formatVocabularyScheduleLabel(vocab) {
        return this.schedule.getVocabSchedule(vocab).label || this.schedule.getTrimesterLabel(this.schedule.getVocabTrimesterKey(vocab));
    }

    formatVocabularyCardDescription(vocab, title) {
        return formatVocabularyCardDescription(vocab, title);
    }

    scheduleFirstVocabularyPreload(container) {
        return scheduleFirstVocabularyPreload(container, this.calendar);
    }

    renderStudentHome(options) {
        return this.home.renderStudentHome(options);
    }

    renderSparkLibrary() {
        return this.home.renderSparkLibrary();
    }

    normalizeSpark(spark = {}) {
        return this.home.normalizeSpark(spark);
    }

    getStudentGradeLevel() {
        return this.home.getStudentGradeLevel();
    }

    fetchCurrentSpark() {
        return this.home.fetchCurrentSpark();
    }

    getCurrentSparkGateWork() {
        return this.home.getCurrentSparkGateWork();
    }

    refreshCurrentSparkGate(options = {}) {
        return this.home.refreshCurrentSparkGate(options);
    }

    loadAndRenderCurrentSpark(host) {
        return this.home.loadAndRenderCurrentSpark(host);
    }

    showActivityMenu(options = {}) {
        return this.menu.showActivityMenu(options);
    }

    downloadCompletedActivityReport(activityType) {
        return this.menu.downloadCompletedActivityReport(activityType);
    }

    loadActivityClass(type) {
        return this.moduleLoader.loadActivityClass(type);
    }

    startActivity(type, options = {}) {
        return this.launcher.startActivity(type, options);
    }

    setActivityHeaderTitle(type) {
        return this.launcher.setActivityHeaderTitle(type);
    }

    getActivityCoinRewards(activityType, settings = {}) {
        return this.progressPersistence.getActivityCoinRewards(activityType, settings);
    }

    handleAutoSave(scoreData) {
        return this.progressPersistence.handleAutoSave(scoreData);
    }

    buildActivityProgressPayload(activityType, scoreData = {}, settings = {}) {
        return this.progressPersistence.buildActivityProgressPayload(activityType, scoreData, settings);
    }

    syncActivityProgressToCloud(activityType, scoreData = {}, settings = {}) {
        return this.progressPersistence.syncActivityProgressToCloud(activityType, scoreData, settings);
    }

    flushPendingActivityProgress() {
        return this.progressPersistence.flushPendingActivityProgress();
    }

    resetActivityState(activityType) {
        return this.progressPersistence.resetActivityState(activityType);
    }

    sanitizeActivityState(stateData) {
        return this.progressPersistence.sanitizeActivityState(stateData);
    }

    handleStateSave(stateData) {
        return this.progressPersistence.handleStateSave(stateData);
    }
}

// Keep section recovery available if connectivity drops after startup.
void import('../ui/sectionRecovery.js').catch(() => {});
