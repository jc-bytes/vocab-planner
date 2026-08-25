import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const { setInlineStatus } = await import('../js/ui/inlineStatus.js');
const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

function createStatusElement() {
    const attributes = new Map();
    return {
        textContent: '',
        dataset: {},
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name) ?? null;
        }
    };
}

test('inline statuses safely normalize state and announcement semantics', () => {
    const status = createStatusElement();

    setInlineStatus(status, '<strong>Saved</strong>', 'success');
    assert.equal(status.textContent, '<strong>Saved</strong>');
    assert.equal(status.dataset.state, 'success');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.getAttribute('aria-atomic'), 'true');

    setInlineStatus(status, null, 'unknown');
    assert.equal(status.textContent, '');
    assert.equal(status.dataset.state, 'muted');
});

test('the first migrated teacher features use one state setter without inline color maps', async () => {
    const [groups, provisioning, csvImport, coinMethods, sparkEditor, teacherHtml, teacherCss, feedbackCss] = await Promise.all([
        read('js/teacherGroups.js'),
        read('js/teacherStudentProgress/teacherStudentProvisioningMethods.js'),
        read('js/teacherStudentProgress/teacherStudentCsvImportMethods.js'),
        read('js/teacherStudentProgressCoinMethods.js'),
        read('js/teacherSparks/teacherSparkEditorMethods.js'),
        read('teacher.html'),
        read('css/teacher.css'),
        read('css/feedback.css')
    ]);

    for (const source of [groups, provisioning, csvImport, coinMethods, sparkEditor]) {
        assert.match(source, /import \{ setInlineStatus \} from/);
        assert.doesNotMatch(source, /status\.style\.color|const colors\s*=\s*\{/);
    }
    assert.equal((groups.match(/setInlineStatus\(status, message, state\)/g) || []).length, 2);
    assert.match(provisioning, /setInlineStatus\(status, message, state\)/);
    assert.match(csvImport, /setInlineStatus\(status, message, state\)/);
    assert.match(coinMethods, /setInlineStatus\(el, message, state\)/);
    assert.match(sparkEditor, /setInlineStatus\(el, text, state\)/);

    for (const id of [
        'student-roster-import-status',
        'group-restriction-status',
        'group-generator-status',
        'add-student-status',
        'coin-adjust-status',
        'spark-modal-status'
    ]) {
        assert.match(
            teacherHtml,
            new RegExp(`id="${id}"[^>]*class="[^"]*inline-status[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"`)
        );
    }
    assert.doesNotMatch(teacherCss, /#group-restriction-status\[data-state|\.group-generator-status\[data-state/);
    for (const [state, token] of [
        ['muted', '--color-text-muted'],
        ['info', '--color-info'],
        ['success', '--color-success'],
        ['error', '--color-danger']
    ]) {
        assert.match(
            feedbackCss,
            new RegExp(`\\.inline-status\\[data-state="${state}"\\]\\s*\\{[^}]*color:\\s*var\\(${token}\\)`)
        );
    }
    assert.match(
        feedbackCss,
        /\.inline-status--accent-success\[data-state="success"\]\s*\{[^}]*color:\s*var\(--color-accent\)/s
    );
});
