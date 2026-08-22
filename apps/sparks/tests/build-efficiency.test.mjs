import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const viteConfig = await readFile(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const serviceWorkerGenerator = await readFile(new URL('../scripts/generate-service-worker.mjs', import.meta.url), 'utf8');
const desktopAssetCopier = await readFile(new URL('../scripts/copy-desktop-assets.mjs', import.meta.url), 'utf8');
const teacherEntry = await readFile(new URL('../js/teacher.js', import.meta.url), 'utf8');
const teacherLazyFeatures = await readFile(new URL('../js/teacherLazyFeatures.js', import.meta.url), 'utf8');
const teacherQuizEntry = await readFile(new URL('../js/teacherQuiz.js', import.meta.url), 'utf8');
const teacherCss = await readFile(new URL('../css/teacher.css', import.meta.url), 'utf8');
const teacherQuizCss = await readFile(new URL('../css/teacherQuiz.css', import.meta.url), 'utf8');
const teacherHtml = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');
const icons = await readFile(new URL('../js/icons.js', import.meta.url), 'utf8');
const typographyCss = await readFile(new URL('../css/typography.css', import.meta.url), 'utf8');
const landingCss = await readFile(new URL('../css/landing.css', import.meta.url), 'utf8');
const { collectStudentPrecacheFiles } = await import('../scripts/student-precache.mjs');

test('student offline shell is generated from the student entry graph only', () => {
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
        Array.from(collectStudentPrecacheFiles(manifest, 'student.html')).sort(),
        [
            'assets/shared.js',
            'assets/student.css',
            'assets/student.js',
            'student.html',
            'vocabularies/manifest.json'
        ]
    );
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
    assert.match(teacherLazyFeatures, /feature\.methods\[methodName\]/);
});

test('quiz maker styles load with the lazy quiz feature', () => {
    assert.match(teacherQuizEntry, /import ['"]\.\.\/css\/teacherQuiz\.css['"]/);
    assert.match(teacherQuizCss, /\/\* Quiz Maker Styles \*\//);
    assert.match(teacherQuizCss, /\.quiz-maker-container/);
    assert.match(teacherQuizCss, /\.document-page/);
    assert.doesNotMatch(teacherCss, /\/\* Quiz Maker Styles \*\//);
    assert.doesNotMatch(teacherQuizCss, /Tablet and small Chromebook responsive pass/);
});

test('the local Lucide registry covers icons present in the teacher shell', () => {
    for (const iconName of ['ShieldPlus', 'ShieldUser', 'UsersRound']) {
        assert.match(icons, new RegExp(`\\b${iconName}\\b`));
    }
});

test('font CSS is bundled with each page stylesheet instead of blocking as an icon dependency', () => {
    assert.doesNotMatch(icons, /inter-latin\.css/);
    assert.match(typographyCss, /@font-face[\s\S]*font-family:\s*['"]Inter['"]/);
    assert.match(landingCss, /@font-face[\s\S]*font-family:\s*['"]Inter['"]/);
});
