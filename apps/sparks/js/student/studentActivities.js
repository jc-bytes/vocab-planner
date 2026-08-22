/**
 * Student Activities Module
 * Handles vocabulary loading, activity management, and progress tracking
 */

import { StudentActivityBrowser } from './studentActivityBrowserMethods.js';
import { StudentActivityCalendar } from './studentActivityCalendarMethods.js';
import { StudentActivityCoverage } from './studentActivityCoverageMethods.js';
import { StudentActivityHome } from './studentActivityHomeMethods.js';
import { StudentActivityLauncher } from './studentActivityLauncherMethods.js';
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
        this.cloudVocabs = [];
        this.availableVocabs = [];
        this.studentVocabularyViewMode = localStorage.getItem('student_vocabulary_view_mode') || 'cards';
        this.activityRouteTypes = getStudentActivityIds();
        this.session = new StudentActivitySession(this);
        this.calendar = new StudentActivityCalendar(this);
        this.schedule = new StudentActivitySchedule(this);
        this.coverage = new StudentActivityCoverage(this);
        this.progressFlow = new StudentActivityProgressFlow(this);
        this.vocabularyData = new StudentActivityVocabularyData(this);
        this.browser = new StudentActivityBrowser(this);
        this.home = new StudentActivityHome(this);
        this.menu = new StudentActivityMenu(this);
        this.moduleLoader = new StudentActivityModuleLoader(this);
        this.launcher = new StudentActivityLauncher(this);
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

    getMonthFromTrimesterWeek(trimester, week) {
        return this.schedule.getMonthFromTrimesterWeek(trimester, week);
    }

    getFallbackMonthForTrimester(trimester) {
        return this.schedule.getFallbackMonthForTrimester(trimester);
    }

    getTrimesterKey(trimester) {
        return this.schedule.getTrimesterKey(trimester);
    }

    getVocabTrimesterKey(vocab) {
        return this.schedule.getVocabTrimesterKey(vocab);
    }

    getTrimesterLabel(trimester) {
        return this.schedule.getTrimesterLabel(trimester);
    }

    getTrimesterShortLabel(trimester) {
        return this.schedule.getTrimesterShortLabel(trimester);
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

    getCurrentScheduleWindow(date = new Date()) {
        return this.schedule.getCurrentScheduleWindow(date);
    }

    getDateOnlyStart(date) {
        return this.schedule.getDateOnlyStart(date);
    }

    getMonthKeyFromIndex(monthIndex) {
        return this.schedule.getMonthKeyFromIndex(monthIndex);
    }

    getSchoolWeekMajorityMonth(date) {
        return this.schedule.getSchoolWeekMajorityMonth(date);
    }

    getVocabCalendarMonthKey(vocab, date = new Date()) {
        return this.schedule.getVocabCalendarMonthKey(vocab, date);
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

    getVocabularyWeekStartDate(vocab, month, week, date = new Date()) {
        return this.schedule.getVocabularyWeekStartDate(vocab, month, week, date);
    }

    usesTrimesterWeekDate(vocab) {
        return this.schedule.usesTrimesterWeekDate(vocab);
    }

    getMonthWeekStartDate(month, week, trimester, date = new Date()) {
        return this.schedule.getMonthWeekStartDate(month, week, trimester, date);
    }

    alignDateToLabelMonth(date, month) {
        return this.schedule.alignDateToLabelMonth(date, month);
    }

    advanceToWeekday(date) {
        return this.schedule.advanceToWeekday(date);
    }

    isWeekday(date) {
        return this.schedule.isWeekday(date);
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

    loadCloudVocabularies() {
        return this.vocabularyData.loadCloudVocabularies();
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

    initWordCoverage() {
        return this.coverage.initWordCoverage();
    }

    getUnpracticedWords(activityType, allWords) {
        return this.coverage.getUnpracticedWords(activityType, allWords);
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

    ensureUnitProgress(vocab = this.sm.currentVocab) {
        return this.progressFlow.ensureUnitProgress(vocab);
    }

    getCurrentUnitProgress() {
        return this.progressFlow.getCurrentUnitProgress();
    }

    restoreWordsFromState(initialState, fallbackWords, filter = null) {
        return this.progressFlow.restoreWordsFromState(initialState, fallbackWords, filter);
    }

    getWordHuntWords(settings = {}) {
        return this.progressFlow.getWordHuntWords(settings);
    }

    getDefaultRequiredActivities(vocab = this.sm.currentVocab) {
        return this.progressFlow.getDefaultRequiredActivities(vocab);
    }

    getPracticeRequiredRotationIndex(vocab = this.sm.currentVocab) {
        return this.progressFlow.getPracticeRequiredRotationIndex(vocab);
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

    getUnitScores(vocab) {
        return this.progressFlow.getUnitScores(vocab);
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

    getNextActivityPreloadType(flow = this.getActivityFlowConfig()) {
        return this.progressFlow.getNextActivityPreloadType(flow);
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

    migrateLegacyWordHuntImages() {
        return this.wordHunt.migrateLegacyWordHuntImages();
    }

    handleIllustrationSave(vocabName, word, payload) {
        return this.wordHunt.handleIllustrationSave(vocabName, word, payload);
    }

    renderDashboard() {
        return this.browser.renderDashboard();
    }

    renderVocabularyBrowser(container, vocabs = null) {
        return this.browser.renderVocabularyBrowser(container, vocabs);
    }

    getAutomaticStudentVocabularyLocation(trimesterGroups) {
        return this.browser.getAutomaticStudentVocabularyLocation(trimesterGroups);
    }

    isCurrentAcademicMonth(monthKey) {
        return this.browser.isCurrentAcademicMonth(monthKey);
    }

    appendCurrentMonthBadge(target, monthKey) {
        return this.browser.appendCurrentMonthBadge(target, monthKey);
    }

    renderStudentLibraryBreadcrumb(container, selectedTrimester = null, selectedMonth = null) {
        return this.browser.renderStudentLibraryBreadcrumb(container, selectedTrimester, selectedMonth);
    }

    createStudentBreadcrumbButton(label, onClick) {
        return this.browser.createStudentBreadcrumbButton(label, onClick);
    }

    getStudentVocabularyViewMode() {
        return this.browser.getStudentVocabularyViewMode();
    }

    setStudentVocabularyViewMode(mode) {
        return this.browser.setStudentVocabularyViewMode(mode);
    }

    renderStudentVocabularyViewControls() {
        return this.browser.renderStudentVocabularyViewControls();
    }

    renderStudentTrimesterPicker(container, trimesterGroups) {
        return this.browser.renderStudentTrimesterPicker(container, trimesterGroups);
    }

    renderStudentMonthPicker(container, selectedTrimester, monthGroups) {
        return this.browser.renderStudentMonthPicker(container, selectedTrimester, monthGroups);
    }

    renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups) {
        return this.browser.renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups);
    }

    renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthVocabs, monthGroups) {
        return this.browser.renderStudentAssignmentPicker(
            container,
            selectedTrimester,
            selectedMonth,
            monthVocabs,
            monthGroups
        );
    }

    createStudentLibraryChoiceCard(options) {
        return this.browser.createStudentLibraryChoiceCard(options);
    }

    createStudentVocabRowList(headers = []) {
        return this.browser.createStudentVocabRowList(headers);
    }

    createStudentVocabRow(options) {
        return this.browser.createStudentVocabRow(options);
    }

    refreshIcons(root = document) {
        return this.browser.refreshIcons(root);
    }

    renderVocabularyGroups(container, vocabs) {
        return this.browser.renderVocabularyGroups(container, vocabs);
    }

    createVocabularyCard(vocab) {
        return this.browser.createVocabularyCard(vocab);
    }

    createVocabularyRow(vocab) {
        return this.browser.createVocabularyRow(vocab);
    }

    formatVocabularyCardTitle(vocab) {
        return this.browser.formatVocabularyCardTitle(vocab);
    }

    formatVocabularyPurpose(purpose) {
        return this.browser.formatVocabularyPurpose(purpose);
    }

    getVocabularyPurposeClass(purpose) {
        return this.browser.getVocabularyPurposeClass(purpose);
    }

    formatVocabularyScheduleLabel(vocab) {
        return this.browser.formatVocabularyScheduleLabel(vocab);
    }

    formatVocabularyCardDescription(vocab, title) {
        return this.browser.formatVocabularyCardDescription(vocab, title);
    }

    scheduleFirstVocabularyPreload(container) {
        return this.browser.scheduleFirstVocabularyPreload(container);
    }

    getUnitProgressSummary(vocab) {
        return this.home.getUnitProgressSummary(vocab);
    }

    renderStudentHome() {
        return this.home.renderStudentHome();
    }

    renderSparkLibrary() {
        return this.home.renderSparkLibrary();
    }

    createContinueLearningHero(item, emptyText = '', context = {}) {
        return this.home.createContinueLearningHero(item, emptyText, context);
    }

    getContinueLearningPercent(progress = {}) {
        return this.home.getContinueLearningPercent(progress);
    }

    isVocabScheduleInCurrentWeek(schedule = {}, date = new Date()) {
        return this.home.isVocabScheduleInCurrentWeek(schedule, date);
    }

    getHomeCurrentWeekBounds(date = new Date()) {
        return this.home.getHomeCurrentWeekBounds(date);
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

    getStudentSparkQuestion(spark) {
        return this.home.getStudentSparkQuestion(spark);
    }

    createStudentSparkCard(spark) {
        return this.home.createStudentSparkCard(spark);
    }

    removeSparkHomePanel(host) {
        return this.home.removeSparkHomePanel(host);
    }

    createSparkHomePanel(title, subtitle, active = false) {
        return this.home.createSparkHomePanel(title, subtitle, active);
    }

    bindHomePanelTabs(container) {
        return this.home.bindHomePanelTabs(container);
    }

    createHomePanel(key, title, subtitle, items, emptyText, active = false) {
        return this.home.createHomePanel(key, title, subtitle, items, emptyText, active);
    }

    createHomeWorkCard(item) {
        return this.home.createHomeWorkCard(item);
    }

    createHomeUnitCard(item) {
        return this.home.createHomeUnitCard(item);
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
