import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const guardedStyles = [
    'css/buttons.css',
    'css/forms.css',
    'css/cards.css',
    'css/dialogs.css',
    'css/navigation.css',
    'css/feedback.css',
    'css/containers.css',
    'css/typography.css',
    'css/landing.css'
];

const identityTokens = [
    'brand',
    'brand-hover',
    'info',
    'accent',
    'success',
    'warning',
    'danger',
    'status-success-glow',
    'status-pending',
    'status-danger-glow'
];

const appFallbackSources = [
    'teacher.html',
    'js/teacherAuth.js',
    'js/teacherDataViewer.js',
    'js/studentAuthUiMethods.js'
];

const [themeCss, studentCss, teacherCss, ...guardedSources] = await Promise.all([
    read('css/theme.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    ...guardedStyles.map(read)
]);

function themeBlock(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = themeCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(match, `Missing ${selector} theme block`);
    return match[1];
}

function configuredChannels() {
    const channels = new Set();
    for (const block of [themeBlock(':root'), themeBlock('.student-site')]) {
        for (const token of identityTokens) {
            const match = block.match(new RegExp(`--color-${token}\\s*:\\s*(#[0-9a-f]{6})`, 'i'));
            if (!match) continue;
            const value = match[1].slice(1);
            channels.add([
                Number.parseInt(value.slice(0, 2), 16),
                Number.parseInt(value.slice(2, 4), 16),
                Number.parseInt(value.slice(4, 6), 16)
            ].join(','));
        }
    }
    return channels;
}

function directColorChannels(source) {
    const matches = [];
    for (const match of source.matchAll(/#([0-9a-f]{6})\b/gi)) {
        const value = match[1];
        matches.push({
            literal: match[0],
            channels: [
                Number.parseInt(value.slice(0, 2), 16),
                Number.parseInt(value.slice(2, 4), 16),
                Number.parseInt(value.slice(4, 6), 16)
            ].join(',')
        });
    }
    for (const match of source.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi)) {
        matches.push({ literal: match[0], channels: `${match[1]},${match[2]},${match[3]}` });
    }
    return matches;
}

test('the theme owns the shared status-color roles', () => {
    const sharedTheme = themeBlock(':root');
    for (const token of ['status-success-glow', 'status-pending', 'status-danger-glow']) {
        assert.match(sharedTheme, new RegExp(`--color-${token}\\s*:`), `Shared theme is missing --color-${token}`);
    }
});

test('migrated shared styles consume configured identity colors through semantic tokens', () => {
    const configured = configuredChannels();
    for (const [index, source] of guardedSources.entries()) {
        const duplicates = directColorChannels(source)
            .filter(color => configured.has(color.channels))
            .map(color => color.literal);
        assert.deepEqual(
            duplicates,
            [],
            `${guardedStyles[index]} duplicates configured identity channels: ${duplicates.join(', ')}`
        );
    }
});

test('app shell identity effects and activity summary meters use semantic tokens', () => {
    for (const [name, css] of [['landing.css', guardedSources.at(-1)], ['student.css', studentCss], ['teacher.css', teacherCss]]) {
        assert.match(css, /color-mix\(in srgb, var\(--color-info\) 85%, transparent\)/, `${name} must theme the identity glow`);
    }

    assert.doesNotMatch(landingCss(), /rgba\((?:99, 102, 241|14, 165, 233|249, 115, 22),/);
    assert.match(
        studentCss,
        /activity-menu-summary-meter div\s*\{[^}]*background:\s*var\(--color-brand\)/s,
        'student.css meter must use --color-brand'
    );
    assert.doesNotMatch(teacherCss, /activity-menu-summary-meter/);
});

test('migrated styles and known app UI producers do not recreate the default brand value', async () => {
    const cssFiles = await Promise.all([
        ...guardedStyles.map(read),
        read('css/student.css'),
        read('css/teacher.css'),
        read('css/student-features.css'),
        read('css/teacherQuiz.css'),
        ...appFallbackSources.map(read)
    ]);
    for (const css of cssFiles) assert.doesNotMatch(css, /#6366f1\b/i);
});

function landingCss() {
    return guardedSources[guardedStyles.indexOf('css/landing.css')];
}
