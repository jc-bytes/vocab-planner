import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import postcss from 'postcss';

const viteConfig = await readFile(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const serviceWorkerGenerator = await readFile(new URL('../scripts/generate-service-worker.mjs', import.meta.url), 'utf8');
const desktopAssetCopier = await readFile(new URL('../scripts/copy-desktop-assets.mjs', import.meta.url), 'utf8');
const teacherEntry = await readFile(new URL('../js/teacher.js', import.meta.url), 'utf8');
const teacherLazyFeatures = await readFile(new URL('../js/teacherLazyFeatures.js', import.meta.url), 'utf8');
const teacherQuizEntry = await readFile(new URL('../js/teacherQuiz.js', import.meta.url), 'utf8');
const teacherQuizFeature = await readFile(new URL('../js/teacherQuizFeature.js', import.meta.url), 'utf8');
const teacherQuizCore = await readFile(new URL('../js/teacherQuizCoreMethods.js', import.meta.url), 'utf8');
const teacherQuizBrowser = await readFile(new URL('../js/teacherQuizBrowserMethods.js', import.meta.url), 'utf8');
const teacherGlobalListeners = await readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8');
const teacherAuth = await readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8');
const studentAuth = await readFile(new URL('../js/student/studentAuth.js', import.meta.url), 'utf8');
const studentAuthUi = await readFile(new URL('../js/studentAuthUiMethods.js', import.meta.url), 'utf8');
const teacherVocabularyEditorListeners = await readFile(new URL('../js/teacherVocabularyEditorListeners.js', import.meta.url), 'utf8');
const teacherCss = await readFile(new URL('../css/teacher.css', import.meta.url), 'utf8');
const teacherQuizCss = await readFile(new URL('../css/teacherQuiz.css', import.meta.url), 'utf8');
const studentCss = await readFile(new URL('../css/student.css', import.meta.url), 'utf8');
const studentFeatureCss = await readFile(new URL('../css/student-features.css', import.meta.url), 'utf8');
const studentRuntimeViewCss = await readFile(new URL('../css/student-runtime-views.css', import.meta.url), 'utf8');
const studentDesignSystemCss = await readFile(new URL('../css/student-design-system.css', import.meta.url), 'utf8');
const teacherHtml = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');
const icons = await readFile(new URL('../js/icons.js', import.meta.url), 'utf8');
const typographyCss = await readFile(new URL('../css/typography.css', import.meta.url), 'utf8');
const landingCss = await readFile(new URL('../css/landing.css', import.meta.url), 'utf8');
const mainModule = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const { collectStudentPrecacheFiles, collectStudentShellFiles } = await import('../scripts/student-precache.mjs');

test('obsolete client save stubs do not return as a second persistence system', async () => {
    assert.doesNotMatch(mainModule, /export const store\s*=/);
    await assert.rejects(access(new URL('../js/saveSystem.js', import.meta.url)));
});

test('deferred student view styles retain narrow ownership and the existing runtime cascade', async () => {
    const featureEntry = await readFile(new URL('../js/student/studentFeatureStyles.js', import.meta.url), 'utf8');
    const arcadeShellCss = await readFile(new URL('../css/student-arcade.css', import.meta.url), 'utf8');
    const ownedSelector = /^(?:#(?:arcade-view|game-stage|game-selection)\b|\.(?:game-|arcade-|flashcard))/;
    let rules = 0;
    postcss.parse(studentRuntimeViewCss).walkRules(rule => {
        assert.ok(rule.selectors.every(selector => ownedSelector.test(selector)), rule.selector);
        rules++;
    });
    assert.ok(rules > 50);
    assert.ok(featureEntry.indexOf('student-runtime-views.css') < featureEntry.indexOf('student-features.css'));
    assert.doesNotMatch(studentCss, /\.flashcard-mastery-wrapper\s*\{|\.game-card\s*\{/);
    assert.match(studentCss, /\.student-app-header\s*\{/);
    assert.match(studentCss, /student-loading/);
    assert.match(arcadeShellCss, /\.app-container:has\(#student-tab-shell/);
    assert.doesNotMatch(studentRuntimeViewCss, /\.app-container|\.student-app-header|student-loading/);
});

test('unreachable platform-auth message code does not return as a duplicate UI system', () => {
    for (const source of [teacherAuth, studentAuth, studentAuthUi]) {
        assert.doesNotMatch(source, /showElectronAuthMessage|electron-auth-message|copy-url-btn/);
    }
    assert.doesNotMatch(studentAuthUi, /register-|handleStudentRegister|joinGrade/);
    assert.doesNotMatch(studentAuth, /handleRedirectResult|prefillRegistration/);
    assert.doesNotMatch(teacherAuth, /TeacherSignup|EmailSignIn|email-signin|email-link/);
    assert.doesNotMatch(teacherGlobalListeners, /teacher-signup|show-teacher-signup|show-teacher-login/);
});

test('student continuation art keeps only the optimized delivery asset', async () => {
    await access(new URL('../images/ui/student-continue-data-wave.webp', import.meta.url));
    await assert.rejects(access(new URL('../images/ui/student-continue-data-wave.png', import.meta.url)));
});

test('student offline code includes lazy chunks while initial shell delivery stays static', () => {
    assert.match(viteConfig, /manifest:\s*true/);
    assert.match(serviceWorkerGenerator, /manifest\.json/);
    assert.match(serviceWorkerGenerator, /src === 'student\.html'/);
    assert.match(serviceWorkerGenerator, /globPatterns:\s*\[\]/);
    assert.doesNotMatch(serviceWorkerGenerator, /assets\/\*\*\/\*\.\{js,css\}/);

    const manifest = {
        'student.html': {
            file: 'assets/student.js',
            css: ['assets/student.css'],
            imports: ['shared.js'],
            dynamicImports: ['activity.js']
        },
        'shared.js': { file: 'assets/shared.js' },
        'activity.js': { file: 'assets/activity.js' }
    };
    assert.deepEqual(
        Array.from(collectStudentShellFiles(manifest, 'student.html')).sort(),
        [
            'assets/shared.js',
            'assets/student.css',
            'assets/student.js',
            'student.html'
        ]
    );
    assert.ok(collectStudentPrecacheFiles(manifest, 'student.html').has('assets/activity.js'));
});

test('large upstream game artifacts remain excluded from deployment assets', () => {
    assert.match(desktopAssetCopier, /extension === '\.zip'/);
    assert.match(desktopAssetCopier, /name === 'closure\.jar'/);
    assert.match(desktopAssetCopier, /name === 'shader_minifier\.exe'/);
    assert.match(desktopAssetCopier, /package-lock\.json/);
    assert.match(desktopAssetCopier, /htmlGameEntries/);
});

test('large teacher feature DOM is inert until its lazy module opens', () => {
    for (const templateId of [
        'teacher-quizzes-view-template',
        'teacher-data-management-view-template',
        'teacher-sparks-modal-template'
    ]) {
        assert.match(teacherHtml, new RegExp(`<template id="${templateId}">`));
        assert.match(teacherLazyFeatures, new RegExp(templateId));
    }
    assert.match(teacherLazyFeatures, /template\.content\.cloneNode\(true\)/);
    assert.match(teacherLazyFeatures, /mountTeacherFeatureTemplates\(featureName\)/);
});

test('teacher feature bundles are loaded only when their views are opened', () => {
    assert.match(teacherEntry, /installTeacherLazyFeatureMethods/);
    for (const eagerModule of [
        'teacherSparks.js',
        'teacherDataManagement.js',
        'teacherGroups.js',
        'teacherQuiz.js'
    ]) {
        assert.doesNotMatch(teacherEntry, new RegExp(`from ['\"]\\./${eagerModule}`));
        assert.match(teacherLazyFeatures, new RegExp(`import\\(['\"]\\./${eagerModule}`));
    }
    assert.doesNotMatch(teacherLazyFeatures, /manager\.constructor/);
    assert.doesNotMatch(
        teacherLazyFeatures,
        /feature\.methods|captureFeatureMethods|createFeatureContext|initializedFeatures|feature\.initialize/
    );
    assert.match(teacherLazyFeatures, /publicMethods:\s*\{ showGroupsView: 'show' \}/);
    assert.match(teacherLazyFeatures, /createTeacherGroupsFeature/);
    assert.match(teacherLazyFeatures, /publicMethods:\s*\{ showDataManagementView: 'show' \}/);
    assert.match(teacherLazyFeatures, /createTeacherDataManagementFeature/);
});

test('quiz maker styles load with the lazy quiz feature', () => {
    assert.match(teacherQuizEntry, /import ['"]\.\.\/css\/teacherQuiz\.css['"]/);
    assert.match(teacherQuizCss, /\/\* Quiz Maker Styles \*\//);
    assert.match(teacherQuizCss, /\.quiz-vocab-row/);
    assert.doesNotMatch(teacherCss, /^\.quiz-vocab-row/m);
    assert.match(teacherQuizCss, /\.quiz-maker-container/);
    assert.match(teacherQuizCss, /\.document-page/);
    assert.doesNotMatch(teacherCss, /\/\* Quiz Maker Styles \*\//);
    assert.doesNotMatch(teacherQuizCss, /Tablet and small Chromebook responsive pass/);
});

test('retired quiz preview cannot return beside the current Quiz Maker', async () => {
    await assert.rejects(access(new URL('../js/teacherQuizLegacyMethods.js', import.meta.url)));
    await assert.rejects(access(new URL('../js/quizMakerPrintMethods.js', import.meta.url)));
    await assert.rejects(access(new URL('../js/quizMakerRasterExportMethods.js', import.meta.url)));

    assert.match(teacherQuizEntry, /export \{ createTeacherQuizFeature \}/);
    assert.match(teacherQuizFeature, /installTeacherQuizCoreMethods\(TeacherQuizFeatureContext\)/);
    assert.match(teacherQuizFeature, /installTeacherQuizBrowserMethods\(TeacherQuizFeatureContext\)/);
    assert.match(teacherQuizFeature, /Object\.freeze\(\{[\s\S]*show\(options = \{\}\)[\s\S]*open\(options = \{\}\)[\s\S]*destroy\(\)/);
    assert.match(teacherQuizFeature, /import\(['"]\.\/quizMaker\.js/);
    assert.match(teacherLazyFeatures, /publicMethods:\s*\{[\s\S]*showQuizzesView: 'show',[\s\S]*openQuizMaker: 'open'/);
    assert.match(teacherLazyFeatures, /createTeacherQuizFeature\(\{/);
    assert.doesNotMatch(teacherQuizEntry, /Legacy/);
    assert.match(teacherLazyFeatures, /\['showQuizzesView', 'quizzes'\]/);
    assert.match(teacherLazyFeatures, /\['openQuizMaker', 'quizzes'\]/);

    for (const source of [
        teacherEntry,
        teacherLazyFeatures,
        teacherQuizCore,
        teacherQuizBrowser,
        teacherGlobalListeners,
        teacherVocabularyEditorListeners,
        teacherHtml,
        teacherCss,
        teacherQuizCss,
        studentCss,
        studentFeatureCss,
        studentDesignSystemCss,
        typographyCss,
        landingCss
    ]) {
        assert.doesNotMatch(source, /quiz-modal|quiz-preview|quiz-print-area|handleGenerateQuiz|currentQuiz/);
    }

    assert.match(teacherHtml, /id="teacher-quizzes-view-template"/);
    assert.match(teacherHtml, /id="quiz-maker-view"/);
    assert.match(teacherQuizCss, /\.quiz-maker-container/);
    assert.match(teacherQuizCss, /\.document-page \.doc-q-card/);
    assert.doesNotMatch(teacherQuizCss, /\.question-card/);
});

test('the local Lucide registry covers icons present in the teacher shell', () => {
    const sidebarStart = teacherHtml.indexOf('id="teacher-tab-shell"');
    const sidebar = teacherHtml.slice(sidebarStart, teacherHtml.indexOf('</nav>', sidebarStart));
    const sidebarIcons = [...sidebar.matchAll(/data-lucide="([^"]+)"/g)].map(([, name]) => name.replace(/(^|-)([a-z0-9])/g, (_, dash, letter) => letter.toUpperCase()));
    assert.ok(sidebarIcons.length > 0);
    for (const iconName of [...sidebarIcons, 'ShieldPlus', 'ShieldUser', 'UsersRound']) {
        assert.match(icons, new RegExp(`\\b${iconName}\\b`));
    }
});

test('font CSS stays independent from the icon registry and page-owned styles', () => {
    assert.doesNotMatch(icons, /inter-latin\.css/);
    assert.match(typographyCss, /@font-face[\s\S]*font-family:\s*['"]Inter['"]/);
    assert.doesNotMatch(landingCss, /@font-face[\s\S]*font-family:\s*['"]Inter['"]/);
});
