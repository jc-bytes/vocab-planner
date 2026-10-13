import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [themeCss, landingCss, studentCss, teacherCss, indexHtml, studentHtml, teacherHtml] = await Promise.all([
    read('css/theme.css'),
    read('css/landing.css'),
    read('css/student.css'),
    read('css/teacher.css'),
    read('index.html'),
    read('student.html'),
    read('teacher.html')
]);

const requiredSemanticTokens = [
    'brand',
    'brand-hover',
    'on-brand',
    'on-accent',
    'info',
    'link',
    'background',
    'surface',
    'surface-raised',
    'text',
    'text-muted',
    'border',
    'success',
    'warning',
    'danger',
    'focus',
    'interactive',
    'on-interactive',
    'interactive-hover',
    'interactive-disabled'
];

const requiredStructuralRoles = [
    'color-control-background',
    'color-control-background-muted',
    'color-control-background-strong',
    'color-surface-subtle',
    'color-overlay',
    'color-placeholder',
    'color-border-interactive',
    'color-border-interactive-hover',
    'color-text-soft',
    'color-danger-surface',
    'color-on-danger-surface',
    'color-accent-strong',
    'shadow-surface',
    'shadow-surface-hover',
    'shadow-dialog'
];

function getBlock(source, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(match, `Missing ${selector} theme block`);
    return match[1];
}

function count(source, pattern) {
    return [...source.matchAll(pattern)].length;
}

test('the shared and student themes provide the complete semantic color contract', () => {
    const sharedTheme = getBlock(themeCss, ':root');
    const studentTheme = getBlock(themeCss, '.student-site');

    for (const token of requiredSemanticTokens) {
        const declaration = new RegExp(`--color-${token}\\s*:`);
        assert.match(sharedTheme, declaration, `Shared theme is missing --color-${token}`);
        assert.match(studentTheme, declaration, `Student theme is missing --color-${token}`);
    }

    for (const role of requiredStructuralRoles) {
        const declaration = new RegExp(`--${role}\\s*:`);
        assert.match(sharedTheme, declaration, `Shared theme is missing --${role}`);
        assert.match(studentTheme, declaration, `Student theme is missing --${role}`);
    }
});

test('shared UI families consume structural theme roles instead of dark-theme literals', async () => {
    const sharedFamilies = await Promise.all([
        'css/forms.css',
        'css/cards.css',
        'css/dialogs.css',
        'css/navigation.css',
        'css/containers.css',
        'css/buttons.css'
    ].map(read));
    const darkStructuralLiteral = /(?:rgba?\(\s*(?:0|15|203|239|255)\s*,|#(?:d7e3f8|fb923c|fecaca)\b)/i;

    for (const source of sharedFamilies) {
        assert.doesNotMatch(source, darkStructuralLiteral);
    }

    const combined = sharedFamilies.join('\n');
    for (const role of requiredStructuralRoles) {
        assert.match(combined, new RegExp(`var\\(--${role}\\)`), `Shared UI does not consume --${role}`);
    }
});

test('every application entry loads the theme once before page-owned styles', () => {
    for (const [name, html, entryStylesheet] of [
        ['landing', indexHtml, 'css/landing.css'],
        ['student', studentHtml, 'css/student.css'],
        ['teacher', teacherHtml, 'css/teacher.css']
    ]) {
        assert.equal(count(html, /data-theme-tokens/g), 1, `${name} must load one theme authority`);
        assert.ok(
            html.indexOf('css/theme.css') < html.indexOf(entryStylesheet),
            `${name} must load theme.css before ${entryStylesheet}`
        );
    }
});

test('entry styles no longer own the migrated palette aliases', () => {
    const migratedAliases = {
        'primary-color': 'color-brand',
        'accent-color': 'color-accent',
        'bg-color': 'color-background',
        'text-main': 'color-text',
        'text-muted': 'color-text-muted',
        'border-color': 'color-border',
        'danger-color': 'color-danger',
        'success-color': 'color-success'
    };
    const movedNames = [...Object.keys(migratedAliases), 'secondary-color', 'card-bg'];

    for (const [name, css] of [
        ['landing.css', landingCss],
        ['student.css', studentCss],
        ['teacher.css', teacherCss]
    ]) {
        for (const token of movedNames) {
            assert.doesNotMatch(css, new RegExp(`--${token}\\s*:`), `${name} must not redefine --${token}`);
        }
        assert.doesNotMatch(css, /@import[^;]*theme\.css/, `${name} must not import the theme indirectly`);
    }

    for (const [alias, semanticToken] of Object.entries(migratedAliases)) {
        assert.match(
            themeCss,
            new RegExp(`--${alias}\\s*:\\s*var\\(--${semanticToken}\\)`),
            `--${alias} must remain a compatibility alias for --${semanticToken}`
        );
    }

    assert.doesNotMatch(themeCss, /--primary-hover\s*:/, 'unused compatibility aliases must not become permanent theme API');
});
