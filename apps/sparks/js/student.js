// Import modular components
import { StudentAuth } from './student/studentAuth.js';
import { StudentProgress } from './student/studentProgress.js';
import { StudentActivities } from './student/studentActivities.js';
import { StudentRouting } from './studentRoutingMethods.js';
import { StudentShell } from './studentShellMethods.js';
import { StudentListeners } from './studentListenerMethods.js';
import { StudentSubjects } from './studentSubjectMethods.js';
import { renderStudentActivityCards } from './student/studentActivityRegistry.js';

const DEV_AUTH_DISABLED = false;

export class StudentManager {
    constructor() {
        this.studentProfile = {
            firstName: '',
            lastName: '',
            name: '',
            grade: '',
            studentId: '',
            email: ''
        };
        this.progressData = {};
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

        this.authInitialized = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.mustChangePassword = false;

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

    get currentVocab() {
        return this.activities.session.currentVocab;
    }

    set currentVocab(vocab) {
        this.activities.session.currentVocab = vocab;
    }

    get activityInstance() {
        return this.activities.session.activityInstance;
    }

    set activityInstance(instance) {
        this.activities.session.activityInstance = instance;
    }

    get currentActivityType() {
        return this.activities.session.currentActivityType;
    }

    set currentActivityType(activityType) {
        this.activities.session.currentActivityType = activityType;
    }

    get unitScores() {
        return this.activities.session.unitScores;
    }

    set unitScores(scores) {
        this.activities.session.unitScores = scores;
    }

    get unitImages() {
        return this.activities.session.unitImages;
    }

    set unitImages(images) {
        this.activities.session.unitImages = images;
    }

    get unitWordHunt() {
        return this.activities.session.unitWordHunt;
    }

    set unitWordHunt(wordHunt) {
        this.activities.session.unitWordHunt = wordHunt;
    }

    get unitStates() {
        return this.activities.session.unitStates;
    }

    set unitStates(states) {
        this.activities.session.unitStates = states;
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

    parseRoute(hash) {
        return this.routing.parseRoute(hash);
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

    isKnownActivityType(activityType) {
        return this.routing.isKnownActivityType(activityType);
    }

    resetSessionRouting() {
        this.routing.resetSession();
    }

    setStudentWideShellMediaQuery(mediaQuery) {
        this.shell.setWideShellMediaQuery(mediaQuery);
    }

    setStudentSidebarCollapsed(collapsed, options) {
        return this.shell.setStudentSidebarCollapsed(collapsed, options);
    }

    restoreStudentSidebarState() {
        return this.shell.restoreStudentSidebarState();
    }

    switchView(viewId) {
        return this.shell.switchView(viewId);
    }

    scheduleStudentScrollSave() {
        return this.shell.scheduleStudentScrollSave();
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

    startStudentDashboardMutationObserver() {
        return this.shell.startStudentDashboardMutationObserver();
    }

    saveStudentSectionScroll(viewId, options) {
        return this.shell.saveStudentSectionScroll(viewId, options);
    }

    syncStudentShellState(section) {
        return this.shell.syncStudentShellState(section);
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

    addListener(selector, event, handler) {
        return this.listeners.addListener(selector, event, handler);
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

    loadSubjectSettings(options = {}) {
        return this.subjectSelection.loadSubjectSettings(options);
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

    getStoredStudentVocabularyLocation() {
        return this.subjectSelection.getStoredStudentVocabularyLocation();
    }

    rememberStudentVocabularyLocation(trimester, month) {
        return this.subjectSelection.rememberStudentVocabularyLocation(trimester, month);
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

    handleStudentLogin(event) {
        return this.auth.handleStudentLogin(event);
    }

    handleForcedPasswordChange(event) {
        return this.auth.handleForcedPasswordChange(event);
    }

    setAuthStatus(text) {
        return this.auth.setAuthStatus(text);
    }

    renderDashboard() {
        return this.activities.renderDashboard();
    }

    updateLevelDisplay() {
        return this.progress.updateLevelDisplay();
    }

    scheduleCloudSync() {
        return this.progress.scheduleCloudSync();
    }

    updateCoinDisplay() {
        return this.progress.updateCoinDisplay();
    }

    async init() {
        // Attach listeners first so buttons work immediately
        this.listeners.initListeners();
        window.addEventListener('online', () => this.setAuthStatus('Synced'));
        window.addEventListener('offline', () => this.setAuthStatus('Offline'));
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

if (import.meta.env?.PROD === true && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./student-sw.js').catch(error => {
            console.warn('Offline support could not be enabled:', error);
        });
    }, { once: true });
}
