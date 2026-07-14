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
const { StudentActivityBrowser } = await import('../js/student/studentActivityBrowserMethods.js');
const { StudentActivityCalendar } = await import('../js/student/studentActivityCalendarMethods.js');
const { StudentActivityCoverage } = await import('../js/student/studentActivityCoverageMethods.js');
const { StudentActivityHome } = await import('../js/student/studentActivityHomeMethods.js');
const { StudentActivityLauncher } = await import('../js/student/studentActivityLauncherMethods.js');
const { StudentActivityMenu } = await import('../js/student/studentActivityMenuMethods.js');
const { StudentActivityModuleLoader } = await import('../js/student/studentActivityModuleLoaderMethods.js');
const { StudentActivityProgressPersistence } = await import('../js/student/studentActivityProgressPersistenceMethods.js');
const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
const { StudentActivitySchedule } = await import('../js/student/studentActivityScheduleMethods.js');
const { StudentActivityVocabularyData } = await import('../js/student/studentActivityVocabularyDataMethods.js');
const { StudentActivityWordHunt } = await import('../js/student/studentActivityWordHuntMethods.js');

test('StudentActivities owns explicit runtime components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.equal(activities.sm, manager);
    assert.ok(activities.menu instanceof StudentActivityMenu);
    assert.ok(activities.moduleLoader instanceof StudentActivityModuleLoader);
    assert.ok(activities.launcher instanceof StudentActivityLauncher);
    assert.ok(activities.progressPersistence instanceof StudentActivityProgressPersistence);
    assert.equal(activities.menu.activities, activities);
    assert.equal(activities.launcher.activities, activities);
});

test('StudentActivities owns explicit browser and home components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.browser instanceof StudentActivityBrowser);
    assert.ok(activities.home instanceof StudentActivityHome);
    assert.equal(activities.browser.activities, activities);
    assert.equal(activities.home.activities, activities);
    assert.equal(activities.browser.sm, manager);
    assert.equal(activities.home.sm, manager);
});

test('StudentActivities owns explicit calendar and schedule components', () => {
    const manager = {};
    const activities = new StudentActivities(manager);

    assert.ok(activities.calendar instanceof StudentActivityCalendar);
    assert.ok(activities.schedule instanceof StudentActivitySchedule);
    assert.equal(activities.calendar.activities, activities);
    assert.equal(activities.schedule.activities, activities);
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
    assert.equal(activities.coverage.activities, activities);
    assert.equal(activities.progressFlow.activities, activities);
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

test('StudentManager declares the stable activity compatibility interface directly', () => {
    for (const method of [
        'loadManifest',
        'renderDashboard',
        'loadVocabulary',
        'showActivityMenu',
        'loadCloudVocabularies',
        'startActivity'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }
});

test('StudentManager activity compatibility methods preserve arguments and results', async () => {
    const manager = Object.create(StudentManager.prototype);
    const calls = [];
    manager.activities = {
        loadManifest: () => 'manifest',
        renderDashboard: () => 'dashboard',
        loadVocabulary: (...args) => calls.push(['loadVocabulary', ...args]),
        showActivityMenu: (...args) => calls.push(['showActivityMenu', ...args]),
        loadCloudVocabularies: () => 'cloud-vocabularies',
        startActivity: (...args) => calls.push(['startActivity', ...args])
    };

    assert.equal(manager.loadManifest(), 'manifest');
    assert.equal(manager.renderDashboard(), 'dashboard');
    assert.equal(manager.loadCloudVocabularies(), 'cloud-vocabularies');
    const vocab = { id: 'unit-1' };
    manager.loadVocabulary(vocab, { fromRoute: true });
    manager.showActivityMenu({ fromRoute: true });
    manager.startActivity('matching', { initialWordIndex: 2 });

    assert.deepEqual(calls, [
        ['loadVocabulary', vocab, { fromRoute: true }],
        ['showActivityMenu', { fromRoute: true }],
        ['startActivity', 'matching', { initialWordIndex: 2 }]
    ]);
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

    assert.deepEqual(flow.required, ['matching', 'flashcards']);
    assert.deepEqual(flow.additional, ['quiz']);
    assert.equal(flow.hidden.includes('matching'), false);
    assert.equal(flow.hidden.includes('quiz'), false);
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
