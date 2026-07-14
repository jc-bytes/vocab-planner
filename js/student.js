// Import modular components
import { StudentAuth } from './student/studentAuth.js';
import { StudentProgress } from './student/studentProgress.js';
import { StudentActivities } from './student/studentActivities.js';
import { StudentRouting } from './studentRoutingMethods.js';
import { StudentShell } from './studentShellMethods.js';
import { StudentListeners } from './studentListenerMethods.js';
import { StudentSubjects } from './studentSubjectMethods.js';
import { getStudentActivityIds, renderStudentActivityCards } from './student/studentActivityRegistry.js';
import { STUDENT_GAME_REGISTRY } from './student/studentGameRegistry.js';

const DEV_AUTH_DISABLED = false;

export class StudentManager {
    constructor() {
        this.currentVocab = null;
        this.manifest = null;
        this.studentProfile = {
            firstName: '',
            lastName: '',
            name: '',
            grade: '',
            studentId: '',
            email: ''
        };
        this.progressData = {};
        this.activityInstance = null;
        this.currentUser = null;
        this.coins = 0; // Legacy support - will be replaced by coinData
        this.coinData = {
            balance: 0,
            giftCoins: 0,
            totalEarned: 0,
            totalSpent: 0,
            totalGifted: 0
        };
        this.coinHistory = [];
        this.currentRole = 'student';

        // Game variables
        this.currentGame = null;
        this.gameTimeRemaining = 0;
        this.gameTimerInterval = null;
        this.isHandlingGameMinute = false;

        // Registry-derived arcade metadata retained for existing UI consumers.
        this.gamesList = STUDENT_GAME_REGISTRY;
        this.currentGameIndex = 0;
        this.authInitialized = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.mustChangePassword = false;
        this.cloudVocabs = [];
        this.availableVocabs = [];
        this.studentVocabularyViewMode = localStorage.getItem('student_vocabulary_view_mode') || 'cards';
        this.unitImages = {};
        this.activityRouteTypes = getStudentActivityIds();

        // Initialize modular components
        this.auth = new StudentAuth(this);
        this.progress = new StudentProgress(this);
        this.subjectSelection = new StudentSubjects(this);
        this.activities = new StudentActivities(this);
        this.routing = new StudentRouting(this);
        this.shell = new StudentShell(this);
        this.listeners = new StudentListeners(this);
        renderStudentActivityCards(document.querySelector('#activity-menu-view .activities-grid'));
        this.init();
    }

    slugifyRouteId(value) {
        return this.routing.slugifyRouteId(value);
    }

    getVocabRouteId(vocab) {
        return this.routing.getVocabRouteId(vocab);
    }

    getCurrentVocabRouteId() {
        return this.routing.getCurrentVocabRouteId();
    }

    getGames() {
        return this.routing.getGames();
    }

    safeDecodeRoutePart(value) {
        return this.routing.safeDecodeRoutePart(value);
    }

    parseRoute(hash) {
        return this.routing.parseRoute(hash);
    }

    buildRoute(route) {
        return this.routing.buildRoute(route);
    }

    setRoute(route, options) {
        return this.routing.setRoute(route, options);
    }

    navigateTo(route, options) {
        return this.routing.navigateTo(route, options);
    }

    restoreRouteOrDefault(defaultRoute) {
        return this.routing.restoreRouteOrDefault(defaultRoute);
    }

    handleRouteChange() {
        return this.routing.handleRouteChange();
    }

    findVocabByRouteId(unitId) {
        return this.routing.findVocabByRouteId(unitId);
    }

    isKnownActivityType(activityType) {
        return this.routing.isKnownActivityType(activityType);
    }

    showUnitsView(route) {
        return this.routing.showUnitsView(route);
    }

    showArcadeView() {
        return this.routing.showArcadeView();
    }

    applyRoute(route) {
        return this.routing.applyRoute(route);
    }

    resetRouteState() {
        this.routing.reset();
    }

    setStudentWideShellMediaQuery(mediaQuery) {
        this.shell.setWideShellMediaQuery(mediaQuery);
    }

    switchView(viewId) {
        return this.shell.switchView(viewId);
    }

    scheduleStudentScrollSave() {
        return this.shell.scheduleStudentScrollSave();
    }

    shouldDebugStudentScroll() {
        return this.shell.shouldDebugStudentScroll();
    }

    debugStudentScrollLifecycle(eventName, details) {
        return this.shell.debugStudentScrollLifecycle(eventName, details);
    }

    shouldDebugStudentDom() {
        return this.shell.shouldDebugStudentDom();
    }

    logStudentDomUpdate(containerId, details) {
        return this.shell.logStudentDomUpdate(containerId, details);
    }

    getStudentMutationTargetLabel(target) {
        return this.shell.getStudentMutationTargetLabel(target);
    }

    startStudentDashboardMutationObserver() {
        return this.shell.startStudentDashboardMutationObserver();
    }

    saveStudentSectionScroll(viewId, options) {
        return this.shell.saveStudentSectionScroll(viewId, options);
    }

    restoreStudentSectionScroll(viewId) {
        return this.shell.restoreStudentSectionScroll(viewId);
    }

    getStudentSectionScrollKey(section) {
        return this.shell.getStudentSectionScrollKey(section);
    }

    getStudentRouteScrollKey() {
        return this.shell.getStudentRouteScrollKey();
    }

    hasSavedStudentRouteScroll() {
        return this.shell.hasSavedStudentRouteScroll();
    }

    persistStudentScroll(key, top) {
        return this.shell.persistStudentScroll(key, top);
    }

    readStudentScroll(key) {
        return this.shell.readStudentScroll(key);
    }

    getStudentSectionForView(viewId) {
        return this.shell.getStudentSectionForView(viewId);
    }

    isStudentWideShell() {
        return this.shell.isStudentWideShell();
    }

    syncStudentShellState(section) {
        return this.shell.syncStudentShellState(section);
    }

    updateStudentNav(viewId) {
        return this.shell.updateStudentNav(viewId);
    }

    setStudentMobileMenu(open) {
        return this.shell.setStudentMobileMenu(open);
    }

    closeStudentMobileMenu(options) {
        return this.shell.closeStudentMobileMenu(options);
    }

    cleanupActivity() {
        return this.shell.cleanupActivity();
    }

    showToast(message, duration) {
        return this.shell.showToast(message, duration);
    }

    initListeners() {
        return this.listeners.initListeners();
    }

    addListener(selector, event, handler) {
        return this.listeners.addListener(selector, event, handler);
    }

    setStudentExportButtonState(button, isLoading, loadingLabel) {
        return this.listeners.setStudentExportButtonState(button, isLoading, loadingLabel);
    }

    destroyStudentListeners() {
        return this.listeners.destroy();
    }

    get subjects() {
        return this.subjectSelection.subjects;
    }

    set subjects(subjects) {
        this.subjectSelection.subjects = subjects;
    }

    get selectedSubjectSlug() {
        return this.subjectSelection.selectedSubjectSlug;
    }

    set selectedSubjectSlug(subjectSlug) {
        this.subjectSelection.selectedSubjectSlug = subjectSlug;
    }

    get studentVocabularyDrilldown() {
        return this.subjectSelection.vocabularyDrilldown;
    }

    set studentVocabularyDrilldown(drilldown) {
        this.subjectSelection.vocabularyDrilldown = drilldown;
    }

    get studentVocabularyAutoSelect() {
        return this.subjectSelection.vocabularyAutoSelect;
    }

    set studentVocabularyAutoSelect(autoSelect) {
        this.subjectSelection.vocabularyAutoSelect = autoSelect;
    }

    loadSubjectSettings() {
        return this.subjectSelection.loadSubjectSettings();
    }

    getActiveSubjects() {
        return this.subjectSelection.getActiveSubjects();
    }

    getSelectedSubject() {
        return this.subjectSelection.getSelectedSubject();
    }

    selectSubject(subjectSlug) {
        return this.subjectSelection.selectSubject(subjectSlug);
    }

    ensureSelectedSubject(vocabs) {
        return this.subjectSelection.ensureSelectedSubject(vocabs);
    }

    resetStudentVocabularyDrilldown() {
        return this.subjectSelection.resetStudentVocabularyDrilldown();
    }

    setStudentVocabularyDrilldownToCurrentTrimester() {
        return this.subjectSelection.setStudentVocabularyDrilldownToCurrentTrimester();
    }

    getStoredStudentVocabularyLocation() {
        return this.subjectSelection.getStoredStudentVocabularyLocation();
    }

    rememberStudentVocabularyLocation(trimester, month) {
        return this.subjectSelection.rememberStudentVocabularyLocation(trimester, month);
    }

    get joinGrade() {
        return this.auth.ui.joinGrade;
    }

    set joinGrade(grade) {
        this.auth.ui.joinGrade = grade;
    }

    getJoinGradeFromUrl() {
        return this.auth.getJoinGradeFromUrl();
    }

    prefillRegistrationFromJoinLink() {
        return this.auth.prefillRegistrationFromJoinLink();
    }

    normalizeStudentProfile(profile) {
        return this.auth.normalizeStudentProfile(profile);
    }

    mergeStudentProfile(primary, fallback) {
        return this.auth.mergeStudentProfile(primary, fallback);
    }

    hasCompleteStudentProfile(profile) {
        return this.auth.hasCompleteStudentProfile(profile);
    }

    showAuthPanel(panel) {
        return this.auth.showAuthPanel(panel);
    }

    validateRegistrationForm() {
        return this.auth.validateRegistrationForm();
    }

    handleStudentLogin(event) {
        return this.auth.handleStudentLogin(event);
    }

    handleStudentRegister(event) {
        return this.auth.handleStudentRegister(event);
    }

    showForcedPasswordChange() {
        return this.auth.showForcedPasswordChange();
    }

    handleForcedPasswordChange(event) {
        return this.auth.handleForcedPasswordChange(event);
    }

    showElectronAuthMessage(loginBtn) {
        return this.auth.showElectronAuthMessage(loginBtn);
    }

    updateHeader() {
        return this.auth.updateHeader();
    }

    checkProfile(force) {
        return this.auth.checkProfile(force);
    }

    initBackendAuth() {
        return this.auth.initBackendAuth();
    }

    fetchAndSetRole(user) {
        return this.auth.fetchAndSetRole(user);
    }

    handleBackendSignIn(user) {
        return this.auth.handleBackendSignIn(user);
    }

    handleBackendSignOut() {
        return this.auth.handleBackendSignOut();
    }

    updateGuestStatus(isGuest) {
        return this.auth.updateGuestStatus(isGuest);
    }

    setAuthStatus(text) {
        return this.auth.setAuthStatus(text);
    }

    showLoginError(message) {
        return this.auth.showLoginError(message);
    }

    loadManifest() {
        return this.activities.loadManifest();
    }

    renderDashboard() {
        return this.activities.renderDashboard();
    }

    loadVocabulary(vocabMeta, options = {}) {
        return this.activities.loadVocabulary(vocabMeta, options);
    }

    showActivityMenu(options = {}) {
        return this.activities.showActivityMenu(options);
    }

    loadCloudVocabularies() {
        return this.activities.loadCloudVocabularies();
    }

    startActivity(type, options = {}) {
        return this.activities.startActivity(type, options);
    }

    async formatTime(seconds) {
        return (await this.getGames()).formatTime(seconds);
    }

    async updateArcadeUI() {
        return (await this.getGames()).updateArcadeUI();
    }

    async updateGameSelectionUI() {
        return (await this.getGames()).updateGameSelectionUI();
    }

    async saveHighScore(gameId, score, metadata = null) {
        return (await this.getGames()).saveHighScore(gameId, score, metadata);
    }

    async updateLeaderboardGame() {
        return (await this.getGames()).updateLeaderboardGame();
    }

    async loadLeaderboard(gameId) {
        return (await this.getGames()).loadLeaderboard(gameId);
    }

    async loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage) {
        return (await this.getGames()).loadHTMLGame(
            gameId,
            htmlFile,
            scoreMessageType,
            gameOverCallback,
            canvas,
            gameStage
        );
    }

    async startGame(type) {
        return (await this.getGames()).startGame(type);
    }

    async stopCurrentGame() {
        return (await this.getGames()).stopCurrentGame();
    }

    async pauseGame() {
        return (await this.getGames()).pauseGame();
    }

    async addGameTime(seconds = 60) {
        return (await this.getGames()).addGameTime(seconds);
    }

    async updateGameTimer() {
        return (await this.getGames()).updateGameTimer();
    }

    migrateCoinData(data) {
        return this.progress.migrateCoinData(data);
    }

    loadLocalProgress() {
        return this.progress.loadLocalProgress();
    }

    saveLocalProgress(skipCloud = false) {
        return this.progress.saveLocalProgress(skipCloud);
    }

    getExperience() {
        return this.progress.getExperience();
    }

    updateLevelDisplay() {
        return this.progress.updateLevelDisplay();
    }

    loadCloudProgress() {
        return this.progress.loadCloudProgress();
    }

    scheduleCloudSync() {
        return this.progress.scheduleCloudSync();
    }

    addCoinHistory(type, amount, source, description = '') {
        return this.progress.addCoinHistory(type, amount, source, description);
    }

    saveProgressToCloud() {
        return this.progress.saveProgressToCloud();
    }

    restoreImagesFromProgress() {
        return this.progress.restoreImagesFromProgress();
    }

    dataURLToBlob(dataUrl) {
        return this.progress.dataURLToBlob(dataUrl);
    }

    addCoins(amount, source = 'activity', description = '') {
        return this.progress.addCoins(amount, source, description);
    }

    deductCoins(amount) {
        return this.progress.deductCoins(amount);
    }

    acceptGiftCoins() {
        return this.progress.acceptGiftCoins();
    }

    updateCoinDisplay() {
        return this.progress.updateCoinDisplay();
    }

    showNotificationBadge() {
        return this.progress.showNotificationBadge();
    }

    hideNotificationBadge() {
        return this.progress.hideNotificationBadge();
    }

    showNotificationPanel() {
        return this.progress.showNotificationPanel();
    }

    async init() {
        // Attach listeners first so buttons work immediately
        this.initListeners();
        window.addEventListener('online', () => this.setAuthStatus('Synced'));
        window.addEventListener('offline', () => this.setAuthStatus('Offline'));
        this.prefillRegistrationFromJoinLink();

        // Default view/state
        this.switchView('loading-view');

        if (this.authDisabled) {
            this.currentUser = null;
            this.currentRole = 'student';
            this.auth.setAuthStatus('Local development');
            this.auth.updateGuestStatus(true);

            await this.activities.loadManifest();
            await this.loadSubjectSettings();
            await this.activities.loadSchoolCalendar();
            this.progress.loadLocalProgress();
            this.auth.updateHeader();
            this.activities.renderDashboard();
            await this.restoreRouteOrDefault();
            return;
        }

        // Load manifest and local data
        await this.activities.loadManifest();
        await this.loadSubjectSettings();
        this.progress.loadLocalProgress();

        await this.auth.initBackendAuth();
    }

}

// Initialize immediately if DOM is already ready, otherwise wait
const startStudentApp = () => {
    if (!window.studentApp) {
        window.studentApp = new StudentManager();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStudentApp, { once: true });
} else {
    startStudentApp();
}
