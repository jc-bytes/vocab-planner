import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Papa from 'papaparse';

import { serializeCSV } from '../js/teacherDataExportDownloads.js';

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('student-controlled leaderboard, activity, and export values are HTML-escaped', async () => {
    const [leaderboard, activity, overview, viewer, preview] = await Promise.all([
        read('js/student/studentGameLeaderboardMethods.js'),
        read('js/teacherDataDashboardRecentActivityMethods.js'),
        read('js/teacherOverview.js'),
        read('js/teacherDataViewer.js'),
        read('js/teacherDataExportPreviewRenderer.js')
    ]);

    assert.match(leaderboard, /const displayName = escapeHtml\(/);
    assert.doesNotMatch(leaderboard, />\$\{data\.name\}</);
    for (const field of ['student', 'unit', 'activity', 'score', 'dateStr']) {
        assert.match(activity, new RegExp(`escapeHtml\\(activity\\.${field}\\)`));
    }
    assert.match(overview, /escapeHtml\(name\)/);
    assert.match(overview, /escapeHtml\(grade\)/);
    for (const source of [viewer, preview]) {
        assert.match(source, /escapeHtml\(name\)/);
        assert.match(source, /escapeHtml\(item\.gameId \|\| '-'\)/);
    }
});

test('CSV export handles quotes and newlines and neutralizes spreadsheet formulae', () => {
    const csv = serializeCSV({
        scores: [{
            name: '=HYPERLINK("https://evil.example")',
            gameId: 'Quiz "Final"\nRound',
            score: 100,
            grade: '6'
        }]
    });
    const table = csv.split('\r\n').slice(1).join('\r\n');
    const result = Papa.parse(table, { skipEmptyLines: true });

    assert.deepEqual(result.errors, []);
    assert.equal(result.data[1][0], '\'=HYPERLINK("https://evil.example")');
    assert.equal(result.data[1][1], 'Quiz "Final"\nRound');
});

test('public account creation and student authorization-field edits stay disabled', async () => {
    const [config, migration, profileMethods] = await Promise.all([
        read('supabase/config.toml'),
        read('supabase/migrations/20260816023423_harden_student_identity_and_provisioning.sql'),
        read('js/supabaseAuthProfileMethods.js')
    ]);

    assert.match(config, /\[auth\][\s\S]*?enable_signup = false/);
    assert.match(config, /minimum_password_length = 10/);
    assert.match(migration, /provisioned_by_teacher/);
    for (const column of ['role', 'email', 'grade_level', 'section_letter']) {
        assert.match(migration, new RegExp(`new\\.${column} is distinct from old\\.${column}`));
    }
    assert.match(migration, /revoke insert, delete on public\.profiles from authenticated/);
    assert.doesNotMatch(profileMethods, /\.upsert\(/);
});

test('entry pages enforce CSP and contain no public registration form or inline script', async () => {
    const pages = await Promise.all(['index.html', 'student.html', 'teacher.html'].map(read));
    for (const page of pages) {
        assert.match(page, /http-equiv="Content-Security-Policy"/);
        assert.match(page, /script-src 'self'/);
        assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)[^>]*>/i);
    }
    assert.doesNotMatch(pages[1], /id="student-register-panel"/);
    assert.doesNotMatch(pages[2], /id="teacher-signup-panel"/);
});

test('CI runs the complete tests and fails on meaningful database findings', async () => {
    const workflow = await read('.github/workflows/static.yml');
    assert.match(workflow, /run: npm test/);
    assert.match(workflow, /run: npm run test:acceptance:supabase/);
    assert.match(workflow, /supabase db lint --local --fail-on error/);
    assert.match(workflow, /supabase db advisors --local --level warn --fail-on error/);
    assert.doesNotMatch(workflow, /--fail-on none/);
});
