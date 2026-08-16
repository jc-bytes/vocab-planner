import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const viteConfig = await readFile(new URL('../vite.config.mjs', import.meta.url), 'utf8');
const serviceWorkerGenerator = await readFile(new URL('../scripts/generate-service-worker.mjs', import.meta.url), 'utf8');
const teacherEntry = await readFile(new URL('../js/teacher.js', import.meta.url), 'utf8');
const teacherLazyFeatures = await readFile(new URL('../js/teacherLazyFeatures.js', import.meta.url), 'utf8');
const icons = await readFile(new URL('../js/icons.js', import.meta.url), 'utf8');

test('student offline shell is generated from the student entry graph only', () => {
    assert.match(viteConfig, /manifest:\s*true/);
    assert.match(serviceWorkerGenerator, /manifest\.json/);
    assert.match(serviceWorkerGenerator, /src === 'student\.html'/);
    assert.match(serviceWorkerGenerator, /reportGenerator-/);
    assert.match(serviceWorkerGenerator, /globPatterns:\s*\[\]/);
    assert.doesNotMatch(serviceWorkerGenerator, /assets\/\*\*\/\*\.\{js,css\}/);
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
});

test('the local Lucide registry covers icons present in the teacher shell', () => {
    for (const iconName of ['ShieldPlus', 'ShieldUser', 'UsersRound']) {
        assert.match(icons, new RegExp(`\\b${iconName}\\b`));
    }
});
