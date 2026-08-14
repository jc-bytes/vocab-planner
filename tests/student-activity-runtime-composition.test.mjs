import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};
globalThis.sessionStorage = {
    getItem() {
        return null;
    },
    setItem() {}
};
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() {
        return {};
    },
    querySelector() {
        return null;
    },
    querySelectorAll() {
        return [];
    }
};
globalThis.window = {
    addEventListener() {},
    removeEventListener() {}
};

const { StudentActivities } = await import('../js/student/studentActivities.js');
const { StudentManager } = await import('../js/student.js');
const { StudentActivityAvailability } = await import('../js/student/studentActivityAvailability.js');
const { StudentActivityBrowser } = await import('../js/student/studentActivityBrowserMethods.js');
const { StudentActivityBrowserCards } = await import('../js/student/studentActivityBrowserCards.js');
const { StudentActivityBrowserNavigation } = await import('../js/student/studentActivityBrowserNavigation.js');
const { StudentActivityCalendar } = await import('../js/student/studentActivityCalendarMethods.js');
const { StudentActivityCoverage } = await import('../js/student/studentActivityCoverageMethods.js');
const { StudentActivityGateDisplay } = await import('../js/student/studentActivityGateDisplay.js');
const { StudentActivityHome } = await import('../js/student/studentActivityHomeMethods.js');
const { StudentActivityHomeSpark } = await import('../js/student/studentActivityHomeSpark.js');
const { StudentActivityLauncher } = await import('../js/student/studentActivityLauncherMethods.js');
const { StudentActivityMenu } = await import('../js/student/studentActivityMenuMethods.js');
const { StudentActivityModuleLoader } = await import('../js/student/studentActivityModuleLoaderMethods.js');
const { StudentActivityProgressPersistence } = await import('../js/student/studentActivityProgressPersistenceMethods.js');
const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
const { StudentActivitySchedule } = await import('../js/student/studentActivityScheduleMethods.js');
const { StudentActivitySession } = await import('../js/student/studentActivitySession.js');
const { StudentActivityVocabularyData } = await import('../js/student/studentActivityVocabularyDataMethods.js');
const { StudentActivityWordHunt } = await import('../js/student/studentActivityWordHuntMethods.js');
const {
    calculateClassReleaseDate,
    normalizeClassSchedules,
    normalizeSchoolCalendar
} = await import('../js/services/vocabularyApi.js');

test('StudentActivities owns explicit runtime components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.equal(activities.sm, manager);
    assert.equal(activities.manifest, null);
    assert.deepEqual(activities.cloudVocabs, []);
    assert.deepEqual(activities.availableVocabs, []);
    assert.equal(activities.studentVocabularyViewMode, 'cards');
    assert.ok(activities.activityRouteTypes.length > 0);
    assert.ok(activities.session instanceof StudentActivitySession);
    assert.equal(activities.session.activities, activities);
    assert.ok(activities.menu instanceof StudentActivityMenu);
    assert.ok(activities.moduleLoader instanceof StudentActivityModuleLoader);
    assert.ok(activities.launcher instanceof StudentActivityLauncher);
    assert.ok(activities.progressPersistence instanceof StudentActivityProgressPersistence);
    assert.equal(activities.menu.activities, activities);
    assert.equal(activities.launcher.activities, activities);
    for (const state of [
        'manifest',
        'cloudVocabs',
        'availableVocabs',
        'studentVocabularyViewMode',
        'activityRouteTypes'
    ]) {
        assert.equal(state in manager, false, `${state} must not be stored on StudentManager`);
    }
});

test('StudentActivities owns isolated active activity-session state', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});

    first.session.currentVocab = { id: 'unit-1' };
    first.session.activityInstance = { destroy() {} };
    first.session.currentActivityType = 'flashcards';
    first.session.unitScores.flashcards = { score: 10 };
    first.session.unitImages.word = 'image-ref';
    first.session.unitWordHunt.word = { completed: true };
    first.session.unitStates.flashcards = { index: 2 };

    assert.equal(second.session.currentVocab, null);
    assert.equal(second.session.activityInstance, null);
    assert.equal(second.session.currentActivityType, null);
    assert.deepEqual(second.session.unitScores, {});
    assert.deepEqual(second.session.unitImages, {});
    assert.deepEqual(second.session.unitWordHunt, {});
    assert.deepEqual(second.session.unitStates, {});
});

test('StudentManager session accessors preserve existing cross-component callers', () => {
    const manager = Object.create(StudentManager.prototype);
    manager.activities = new StudentActivities(manager);
    const vocab = { id: 'unit-1' };
    const instance = { destroy() {} };
    const scores = { flashcards: { score: 10 } };
    const images = { word: 'image-ref' };
    const wordHunt = { word: { completed: true } };
    const states = { flashcards: { index: 2 } };

    manager.currentVocab = vocab;
    manager.activityInstance = instance;
    manager.currentActivityType = 'flashcards';
    manager.unitScores = scores;
    manager.unitImages = images;
    manager.unitWordHunt = wordHunt;
    manager.unitStates = states;

    assert.equal(manager.currentVocab, vocab);
    assert.equal(manager.activityInstance, instance);
    assert.equal(manager.currentActivityType, 'flashcards');
    assert.equal(manager.unitScores, scores);
    assert.equal(manager.unitImages, images);
    assert.equal(manager.unitWordHunt, wordHunt);
    assert.equal(manager.unitStates, states);
    assert.equal(manager.activities.session.currentVocab, vocab);
    for (const state of [
        'currentVocab',
        'activityInstance',
        'currentActivityType',
        'unitScores',
        'unitImages',
        'unitWordHunt',
        'unitStates'
    ]) {
        assert.equal(Object.prototype.hasOwnProperty.call(manager, state), false);
        const descriptor = Object.getOwnPropertyDescriptor(StudentManager.prototype, state);
        assert.equal(typeof descriptor?.get, 'function');
        assert.equal(typeof descriptor?.set, 'function');
    }
});

test('StudentActivities catalog and browser state is isolated per instance', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});

    first.manifest = { vocabularies: [{ id: 'unit-1' }] };
    first.cloudVocabs.push({ id: 'cloud-1' });
    first.availableVocabs.push({ id: 'available-1' });
    first.studentVocabularyViewMode = 'rows';
    first.activityRouteTypes.push('custom-test-activity');

    assert.equal(second.manifest, null);
    assert.deepEqual(second.cloudVocabs, []);
    assert.deepEqual(second.availableVocabs, []);
    assert.equal(second.studentVocabularyViewMode, 'cards');
    assert.equal(second.activityRouteTypes.includes('custom-test-activity'), false);
});

test('vocabulary view preference persists through the activity owner', () => {
    const activities = new StudentActivities({});
    const writes = [];
    let renderCount = 0;
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = (...args) => writes.push(args);
    activities.browser.renderDashboard = () => {
        renderCount += 1;
    };

    try {
        activities.setStudentVocabularyViewMode('rows');
        assert.equal(activities.studentVocabularyViewMode, 'rows');
        assert.deepEqual(writes, [['student_vocabulary_view_mode', 'rows']]);
        assert.equal(renderCount, 1);
    } finally {
        localStorage.setItem = originalSetItem;
    }
});

test('StudentActivities owns explicit browser and home components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.browser instanceof StudentActivityBrowser);
    assert.ok(activities.home instanceof StudentActivityHome);
    assert.ok(activities.browser.cards instanceof StudentActivityBrowserCards);
    assert.ok(activities.browser.navigation instanceof StudentActivityBrowserNavigation);
    assert.ok(activities.home.spark instanceof StudentActivityHomeSpark);
    assert.equal(activities.browser.activities, activities);
    assert.equal(activities.home.activities, activities);
    assert.equal(activities.browser.cards.browser, activities.browser);
    assert.equal(activities.browser.navigation.browser, activities.browser);
    assert.equal(activities.home.spark.home, activities.home);
    assert.equal(activities.home.currentSparkSessionCache, activities.home.spark.currentSparkSessionCache);
    assert.equal(activities.browser.sm, manager);
    assert.equal(activities.home.sm, manager);
});

test('StudentActivities owns explicit calendar and schedule components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.calendar instanceof StudentActivityCalendar);
    assert.ok(activities.schedule instanceof StudentActivitySchedule);
    assert.ok(activities.schedule.availability instanceof StudentActivityAvailability);
    assert.equal(activities.calendar.activities, activities);
    assert.equal(activities.schedule.activities, activities);
    assert.equal(activities.schedule.availability.schedule, activities.schedule);
    assert.equal(activities.calendar.sm, manager);
});

test('StudentActivities owns an explicit vocabulary data component', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.vocabularyData instanceof StudentActivityVocabularyData);
    assert.equal(activities.vocabularyData.activities, activities);
    assert.equal(activities.vocabularyData.sm, manager);
});

test('StudentActivities owns explicit progress-flow and coverage components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.coverage instanceof StudentActivityCoverage);
    assert.ok(activities.progressFlow instanceof StudentActivityProgressFlow);
    assert.ok(activities.progressFlow.gateDisplay instanceof StudentActivityGateDisplay);
    assert.equal(activities.coverage.activities, activities);
    assert.equal(activities.progressFlow.activities, activities);
    assert.equal(activities.progressFlow.gateDisplay.progressFlow, activities.progressFlow);
    assert.equal(activities.coverage.sm, manager);
    assert.equal(activities.progressFlow.sm, manager);
});

test('StudentActivities owns an explicit Word Hunt component', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.wordHunt instanceof StudentActivityWordHunt);
    assert.equal(activities.wordHunt.activities, activities);
    assert.equal(activities.wordHunt.sm, manager);
});

test('StudentActivities declares its stable runtime interface directly', () => {
    for (const method of [
        'showActivityMenu',
        'loadActivityClass',
        'startActivity',
        'setActivityHeaderTitle',
        'getActivityCoinRewards',
        'handleAutoSave',
        'buildActivityProgressPayload',
        'syncActivityProgressToCloud',
        'resetActivityState',
        'sanitizeActivityState',
        'handleStateSave'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentActivities.prototype, method),
            true,
            `${method} must be declared by StudentActivities`
        );
    }
});

test('StudentManager retains the cross-component dashboard bridge', () => {
    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentManager.prototype, 'renderDashboard'),
        true,
        'renderDashboard must be declared by StudentManager'
    );
});

test('StudentManager dashboard bridge delegates to the activity owner', () => {
    const manager = Object.create(StudentManager.prototype);
    manager.activities = {
        renderDashboard: () => 'dashboard'
    };

    assert.equal(manager.renderDashboard(), 'dashboard');
});

test('StudentManager omits owner-only legacy forwarding methods', () => {
    for (const method of [
        'slugifyRouteId',
        'buildRoute',
        'applyRoute',
        'showUnitsView',
        'showArcadeView',
        'restoreStudentSectionScroll',
        'getStudentSectionScrollKey',
        'getStudentRouteScrollKey',
        'persistStudentScroll',
        'readStudentScroll',
        'initListeners',
        'destroyStudentListeners',
        'getJoinGradeFromUrl',
        'prefillRegistrationFromJoinLink',
        'validateRegistrationForm',
        'loadManifest',
        'loadVocabulary',
        'showActivityMenu',
        'loadCloudVocabularies',
        'startActivity',
        'formatTime',
        'updateArcadeUI',
        'saveHighScore',
        'loadLeaderboard',
        'loadHTMLGame',
        'startGame',
        'stopCurrentGame',
        'migrateCoinData',
        'loadLocalProgress',
        'saveLocalProgress',
        'loadCloudProgress',
        'saveProgressToCloud',
        'addCoins',
        'deductCoins',
        'showNotificationPanel'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            false,
            `${method} should stay on its owning component`
        );
    }
});

test('StudentActivities declares its presentation interface directly', () => {
    for (const method of [
        'renderDashboard',
        'renderVocabularyBrowser',
        'renderStudentTrimesterPicker',
        'renderStudentMonthPicker',
        'renderStudentAssignmentPicker',
        'createVocabularyCard',
        'formatVocabularyCardTitle',
        'scheduleFirstVocabularyPreload',
        'getUnitProgressSummary',
        'renderStudentHome',
        'createContinueLearningHero',
        'fetchCurrentSpark',
        'createStudentSparkCard',
        'createHomeUnitCard'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentActivities.prototype, method),
            true,
            `${method} must be declared by StudentActivities`
        );
    }
});

test('StudentActivities declares its scheduling interface directly', () => {
    for (const method of [
        'scheduleIdleTask',
        'getCurrentTrimesterKey',
        'loadSchoolCalendar',
        'getVocabSchedule',
        'getVocabTrimesterKey',
        'buildVocabularyTrimesterGroups',
        'buildVocabularyMonthGroups',
        'compareVocabularySchedule',
        'filterStudentAvailableVocabulary',
        'isStudentVocabularyAvailable',
        'getTrimesterWeekStartDate',
        'getMonthWeekStartDate',
        'parseLocalDateOnly'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentActivities.prototype, method),
            true,
            `${method} must be declared by StudentActivities`
        );
    }
    assert.ok(Object.getOwnPropertyDescriptor(StudentActivities.prototype, 'schoolCalendar')?.get);
});

test('StudentActivities declares its vocabulary data interface directly', () => {
    for (const method of [
        'loadManifest',
        'getAllVocabularySources',
        'dedupeVocabularySources',
        'getVisibleVocabularyList',
        'getGradeMatchedVocabularySources',
        'renderSubjectPicker',
        'loadCloudVocabularies',
        'loadVocabularyOverride',
        'mergeVocabularyData',
        'loadVocabulary'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentActivities.prototype, method),
            true,
            `${method} must be declared by StudentActivities`
        );
    }
});

test('StudentActivities declares its progress-flow and coverage interfaces directly', () => {
    for (const method of [
        'initWordCoverage',
        'getUnpracticedWords',
        'markWordsPracticed',
        'getWordCoverageStats',
        'getPrioritizedWords',
        'getUnitProgressKey',
        'ensureUnitProgress',
        'getActivityFlowConfig',
        'getUnitRequiredCompletion',
        'getPendingRequiredWork',
        'getRequiredCompletion',
        'isActivityUnlocked',
        'updateActivityGateDisplay',
        'scheduleActivityPreload'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentActivities.prototype, method),
            true,
            `${method} must be declared by StudentActivities`
        );
    }
});

test('StudentActivities declares its Word Hunt interface directly', () => {
    for (const method of [
        'uploadWordHuntImage',
        'loadWordHuntImage',
        'getLocalWordHuntEntries',
        'mergeWordHuntEntry',
        'mergeWordHuntEntryMaps',
        'getReportWordHuntEntries',
        'setWordHuntExportButtonState',
        'downloadWordHuntSubmission',
        'migrateLegacyWordHuntImages',
        'handleIllustrationSave'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentActivities.prototype, method),
            true,
            `${method} must be declared by StudentActivities`
        );
    }
});

test('StudentActivities delegates runtime work to the owning component', async () => {
    const activities = new StudentActivities({});
    const calls = [];
    activities.menu.showActivityMenu = options => calls.push(['showActivityMenu', options]);
    activities.launcher.startActivity = async (type, options) => calls.push(['startActivity', type, options]);
    activities.progressPersistence.handleStateSave = state => calls.push(['handleStateSave', state]);

    activities.showActivityMenu({ fromRoute: true });
    await activities.startActivity('matching', { initialWordIndex: 2 });
    activities.handleStateSave({ round: 3 });

    assert.deepEqual(calls, [
        ['showActivityMenu', { fromRoute: true }],
        ['startActivity', 'matching', { initialWordIndex: 2 }],
        ['handleStateSave', { round: 3 }]
    ]);
});

test('StudentActivities delegates presentation work to the owning component', async () => {
    const activities = new StudentActivities({});
    const calls = [];
    activities.browser.renderDashboard = () => calls.push(['renderDashboard']);
    activities.browser.formatVocabularyCardTitle = vocab => {
        calls.push(['formatVocabularyCardTitle', vocab]);
        return 'Formatted unit';
    };
    activities.home.renderStudentHome = async () => calls.push(['renderStudentHome']);

    activities.renderDashboard();
    const title = activities.formatVocabularyCardTitle({ name: 'Raw unit' });
    await activities.renderStudentHome();

    assert.equal(title, 'Formatted unit');
    assert.deepEqual(calls, [
        ['renderDashboard'],
        ['formatVocabularyCardTitle', { name: 'Raw unit' }],
        ['renderStudentHome']
    ]);
});

test('StudentActivities delegates scheduling work to the owning component', async () => {
    const activities = new StudentActivities({});
    const calls = [];
    activities.calendar.loadSchoolCalendar = async () => calls.push(['loadSchoolCalendar']);
    activities.schedule.getVocabSchedule = (vocab, date) => {
        calls.push(['getVocabSchedule', vocab, date]);
        return { month: 'july', week: 2 };
    };

    await activities.loadSchoolCalendar();
    const date = new Date(2026, 6, 14);
    const schedule = activities.getVocabSchedule({ name: 'Data' }, date);

    assert.deepEqual(schedule, { month: 'july', week: 2 });
    assert.deepEqual(calls, [
        ['loadSchoolCalendar'],
        ['getVocabSchedule', { name: 'Data' }, date]
    ]);
});

test('StudentActivities delegates vocabulary data work to the owning component', async () => {
    const activities = new StudentActivities({});
    const calls = [];
    activities.vocabularyData.loadManifest = async () => calls.push(['loadManifest']);
    activities.vocabularyData.loadVocabulary = async (vocab, options) => {
        calls.push(['loadVocabulary', vocab, options]);
    };

    await activities.loadManifest();
    await activities.loadVocabulary({ id: 'unit-1' }, { fromRoute: true });

    assert.deepEqual(calls, [
        ['loadManifest'],
        ['loadVocabulary', { id: 'unit-1' }, { fromRoute: true }]
    ]);
});

test('StudentActivities delegates progress-flow and coverage work to their owners', () => {
    const activities = new StudentActivities({ currentVocab: null });
    const calls = [];
    activities.coverage.getPrioritizedWords = (...args) => {
        calls.push(['getPrioritizedWords', ...args]);
        return ['prioritized'];
    };
    activities.progressFlow.getActivityFlowConfig = vocab => {
        calls.push(['getActivityFlowConfig', vocab]);
        return { required: ['flashcards'], additional: [], hidden: [] };
    };

    const words = activities.getPrioritizedWords('matching', 4, [{ word: 'data' }]);
    const flow = activities.getActivityFlowConfig({ id: 'unit-1' });

    assert.deepEqual(words, ['prioritized']);
    assert.deepEqual(flow.required, ['flashcards']);
    assert.deepEqual(calls, [
        ['getPrioritizedWords', 'matching', 4, [{ word: 'data' }]],
        ['getActivityFlowConfig', { id: 'unit-1' }]
    ]);
});

test('StudentActivities delegates Word Hunt work to its owner', async () => {
    const activities = new StudentActivities({ currentVocab: null });
    const calls = [];
    activities.wordHunt.loadWordHuntImage = async path => {
        calls.push(['loadWordHuntImage', path]);
        return new Blob(['image']);
    };
    activities.wordHunt.handleIllustrationSave = (...args) => {
        calls.push(['handleIllustrationSave', ...args]);
    };

    const image = await activities.loadWordHuntImage('student/unit/data.webp');
    activities.handleIllustrationSave('Data Unit', 'algorithm', { entry: { hasImage: true } });

    assert.ok(image instanceof Blob);
    assert.deepEqual(calls, [
        ['loadWordHuntImage', 'student/unit/data.webp'],
        ['handleIllustrationSave', 'Data Unit', 'algorithm', { entry: { hasImage: true } }]
    ]);
});

test('Word Hunt entry merging keeps meaningful existing values', () => {
    const activities = new StudentActivities({});
    const merged = activities.mergeWordHuntEntryMaps(
        { algorithm: { definition: 'A sequence of steps', hasImage: true } },
        { algorithm: { definition: '', hasImage: false, example: 'Sorting data' } },
        { network: { definition: 'Connected devices' } }
    );

    assert.deepEqual(merged, {
        algorithm: {
            definition: 'A sequence of steps',
            hasImage: true,
            example: 'Sorting data'
        },
        network: { definition: 'Connected devices' }
    });
});

test('explicit activity flow settings remain partitioned and ordered', () => {
    const activities = new StudentActivities({ currentVocab: null });
    const flow = activities.getActivityFlowConfig({
        words: [{ word: 'data' }],
        activitySettings: {
            requiredActivities: ['matching', 'flashcards', 'matching'],
            additionalActivities: ['quiz', 'matching', 'quiz']
        }
    });

    assert.deepEqual(flow.required, ['flashcards', 'matching']);
    assert.deepEqual(flow.additional, ['quiz']);
    assert.equal(flow.hidden.includes('matching'), false);
    assert.equal(flow.hidden.includes('quiz'), false);
});

test('required activities unlock sequentially while completed steps remain replayable', () => {
    const manager = {
        currentVocab: {
            words: [{ word: 'data' }],
            activitySettings: {
                requiredActivities: ['matching', 'quiz', 'flashcards'],
                additionalActivities: ['word-search']
            }
        },
        unitScores: {},
        progressData: { units: {} }
    };
    const activities = new StudentActivities(manager);

    assert.deepEqual(activities.getActivityFlowConfig().required, ['flashcards', 'matching', 'quiz']);
    assert.equal(activities.isActivityUnlocked('flashcards'), true);
    assert.equal(activities.isActivityUnlocked('matching'), false);
    assert.equal(activities.isActivityUnlocked('quiz'), false);
    assert.equal(activities.isActivityUnlocked('word-search'), false);

    manager.unitScores.flashcards = { score: 100, isComplete: true };
    assert.equal(activities.isActivityUnlocked('flashcards'), true);
    assert.equal(activities.isActivityUnlocked('matching'), true);
    assert.equal(activities.isActivityUnlocked('quiz'), false);

    manager.unitScores.matching = { score: 100, isComplete: true };
    assert.equal(activities.isActivityUnlocked('quiz'), true);
    assert.equal(activities.isActivityUnlocked('word-search'), false);

    manager.unitScores.quiz = { score: 100, isComplete: true };
    assert.equal(activities.isActivityUnlocked('word-search'), true);
});

test('pending required work includes available current-trimester units and selects the oldest next step', () => {
    const currentDate = new Date(2026, 7, 14, 12);
    const oldUnit = {
        id: 'old-unit',
        name: 'Old Unit',
        trimester: 'IIT',
        assignedDate: '2026-08-03',
        words: [{ word: 'data' }],
        activitySettings: { requiredActivities: ['flashcards', 'matching'] }
    };
    const currentUnit = {
        id: 'current-unit',
        name: 'Current Unit',
        trimester: 'IIT',
        assignedDate: '2026-08-10',
        words: [{ word: 'chart' }],
        activitySettings: { requiredActivities: ['flashcards', 'quiz'] }
    };
    const futureUnit = {
        id: 'future-unit',
        name: 'Future Unit',
        trimester: 'IIT',
        assignedDate: '2026-08-24',
        words: [{ word: 'sensor' }],
        activitySettings: { requiredActivities: ['flashcards', 'quiz'] }
    };
    const manager = {
        studentProfile: { grade: '9' },
        currentVocab: null,
        unitScores: {},
        progressData: {
            units: {
                'technology:old-unit': {
                    scores: { flashcards: { score: 100, isComplete: true } }
                }
            }
        },
        getVocabRouteId: vocab => vocab.id
    };
    const activities = new StudentActivities(manager);
    activities.getGradeMatchedVocabularySources = () => [currentUnit, futureUnit, oldUnit];
    activities.getCurrentTrimesterKey = () => 'IIT';
    activities.getVocabTrimesterKey = vocab => vocab.trimester;
    activities.filterStudentAvailableVocabulary = vocabs => vocabs.filter(vocab => vocab !== futureUnit);
    activities.getVocabSchedule = vocab => ({ dueDate: new Date(`${vocab.assignedDate}T12:00:00`) });

    const pending = activities.getPendingRequiredWork(currentDate);

    assert.equal(pending.isBlocked, true);
    assert.equal(pending.unitCount, 2);
    assert.equal(pending.remainingActivities, 3);
    assert.equal(pending.next.vocab.id, 'old-unit');
    assert.equal(pending.next.completion.nextActivityType, 'matching');
    assert.deepEqual(pending.units.map(item => item.vocab.id), ['old-unit', 'current-unit']);
});

test('legacy completed flashcards are not regressed by the new mastery-state initialization', () => {
    const manager = {
        authDisabled: true,
        currentUser: null,
        currentVocab: {
            id: 'unit-1',
            name: 'Unit One',
            words: [{ word: 'data' }],
            activitySettings: {}
        },
        currentActivityType: 'flashcards',
        unitScores: {
            flashcards: {
                score: 100,
                isComplete: true,
                details: 'Studied: 1/1 cards'
            }
        },
        progress: {
            addCoins() {},
            saveLocalProgress() {}
        }
    };
    const activities = new StudentActivities(manager);
    activities.scheduleActivityPreload = () => {};
    activities.updateArcadeGateDisplay = () => {};

    activities.progressPersistence.handleAutoSave({
        score: 0,
        isComplete: false,
        details: 'Mastered: 0/1 cards'
    });

    assert.equal(manager.unitScores.flashcards.score, 100);
    assert.equal(manager.unitScores.flashcards.isComplete, true);
    assert.equal(manager.unitScores.flashcards.details, 'Studied: 1/1 cards');
});

test('vocabulary data merging preserves source precedence and identifiers', () => {
    const activities = new StudentActivities({});
    const merged = activities.mergeVocabularyData({
        meta: {
            id: 'meta-id',
            path: 'vocab/meta.json',
            name: 'Meta name',
            words: [{ word: 'meta' }],
            activitySettings: { matching: 4 }
        },
        fileData: {
            id: 'file-id',
            name: 'File name',
            words: [{ word: 'file' }],
            activitySettings: { quiz: 6 }
        },
        override: {
            id: 'cloud-id',
            name: 'Cloud name',
            words: [{ word: 'cloud' }],
            activitySettings: { matching: 8 },
            __source: 'cloud'
        }
    });

    assert.equal(merged.id, 'cloud-id');
    assert.equal(merged.path, 'vocab/meta.json');
    assert.equal(merged.name, 'Cloud name');
    assert.deepEqual(merged.words, [{ word: 'cloud' }]);
    assert.deepEqual(merged.activitySettings, { quiz: 6, matching: 8 });
    assert.equal(merged.__source, 'cloud');
});

test('activity module caches are isolated per StudentActivities instance', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});

    first.moduleLoader.activityModulePromises.set('matching', Promise.resolve({}));

    assert.equal(second.moduleLoader.activityModulePromises.size, 0);
    assert.equal('activityModulePromises' in first, false);
});

test('Spark session caches are isolated and owned by the home component', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});

    first.home.currentSparkSessionCache.set('technology:6:2026-07-14', { id: 'spark-1' });

    assert.equal(second.home.currentSparkSessionCache.size, 0);
    assert.equal('currentSparkSessionCache' in first.sm, false);
});

test('school calendar snapshots are isolated and owned by the calendar component', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});
    const calendar = { schoolYear: 2026, trimesters: {} };

    first.calendar.schoolCalendar = calendar;

    assert.equal(first.schoolCalendar, calendar);
    assert.equal(second.schoolCalendar, null);
    assert.equal('schoolCalendar' in first.sm, false);
});

test('class schedules normalize aliases, remove duplicates, and keep one row per class', () => {
    const schedules = normalizeClassSchedules([
        { grade: 'Grade 6', section: 'a', weekdays: ['monday', 'Tue', 2] },
        { gradeLevel: 7, group: 'B', weekdays: ['wed', 'friday'] },
        { grade: '6', section: 'A', weekdays: [1, 2] },
        { grade: '8', section: '', weekdays: [4] }
    ]);

    assert.deepEqual(schedules, [
        { grade: '6', section: 'A', weekdays: [1, 2] },
        { grade: '7', section: 'B', weekdays: [3, 5] }
    ]);
});

test('class meeting days delay release to the next lesson and never hide it afterward', () => {
    const calendar = normalizeSchoolCalendar({
        schoolYear: '2026',
        classSchedules: [
            { grade: '6', section: 'A', weekdays: [1, 2] },
            { grade: '6', section: 'B', weekdays: [4] }
        ]
    });

    assert.equal(
        calculateClassReleaseDate('2026-08-12', calendar, { grade: '6', group: 'A' }),
        '2026-08-17'
    );
    assert.equal(
        calculateClassReleaseDate('2026-08-12', calendar, { gradeLevel: 6, sectionLetter: 'b' }),
        '2026-08-13'
    );
    assert.equal(
        calculateClassReleaseDate('2026-08-12', calendar, { grade: '7', group: 'A' }),
        '2026-08-12'
    );

    const manager = { studentProfile: { grade: '6', group: 'A' } };
    const activities = new StudentActivities(manager);
    activities.calendar.schoolCalendar = calendar;
    const vocab = { assignedDate: '2026-08-12', trimester: 'IIT', month: 'august', week: 10 };

    assert.equal(activities.getVocabSchedule(vocab).dueDate.getDate(), 17);
    assert.equal(activities.isStudentVocabularyAvailable(vocab, new Date(2026, 7, 16, 12)), false);
    assert.equal(activities.isStudentVocabularyAvailable(vocab, new Date(2026, 7, 17, 12)), true);
    assert.equal(activities.isStudentVocabularyAvailable(vocab, new Date(2026, 7, 19, 12)), true);
});

test('coverage and preload state are isolated inside their components', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});

    first.coverage.wordCoverage.matching = { data: { count: 1 } };
    first.progressFlow.activityPreloadKeys.add('unit-1:matching');

    assert.deepEqual(second.coverage.wordCoverage, {});
    assert.equal(second.progressFlow.activityPreloadKeys.size, 0);
    assert.equal('wordCoverage' in first, false);
    assert.equal('activityPreloadKeys' in first, false);
});

test('Word Hunt export state is isolated inside its component', () => {
    const first = new StudentActivities({});
    const second = new StudentActivities({});

    first.wordHunt.wordHuntExportInProgress = true;

    assert.equal(second.wordHunt.wordHuntExportInProgress, false);
    assert.equal('wordHuntExportInProgress' in first, false);
});
