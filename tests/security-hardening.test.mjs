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

test('quiz imports are rendered as text instead of executable HTML', async () => {
    const [questions, documentRender] = await Promise.all([
        read('js/quizMakerQuestionCardRenderer.js'),
        read('js/quizMakerRenderMethods.js')
    ]);

    assert.match(questions, /import \{ createElement, escapeHtml \}/);
    for (const value of ['q.prompt', 'pair.term', 'pair.def', 'word', 'clue.clue']) {
        assert.match(questions, new RegExp(`text\\(${value.replace('.', '\\.')}`));
    }
    for (const value of [
        'this.meta.schoolName',
        'this.meta.title',
        'this.meta.instructions',
        'r.title',
        'r.desc'
    ]) {
        assert.match(documentRender, new RegExp(`escapeHtml\\(${value.replaceAll('.', '\\.')}`));
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
    const [config, migration, ticketMigration, profileMethods] = await Promise.all([
        read('supabase/config.toml'),
        read('supabase/migrations/20260816023423_harden_student_identity_and_provisioning.sql'),
        read('supabase/migrations/20260816031016_ticketed_auth_user_provisioning.sql'),
        read('js/supabaseAuthProfileMethods.js')
    ]);

    assert.match(config, /\[auth\][\s\S]*?enable_signup = false/);
    assert.match(config, /minimum_password_length = 10/);
    assert.match(ticketMigration, /issue_auth_user_provisioning_ticket/);
    assert.match(ticketMigration, /provisioning_token/);
    assert.match(ticketMigration, /to service_role/);
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
    assert.match(workflow, /validate:[\s\S]*?deploy:[\s\S]*?needs: validate/);
    assert.match(workflow, /deploy:[\s\S]*?pages: write[\s\S]*?id-token: write/);
    assert.doesNotMatch(workflow, /uses: [^\s]+@v\d/);
});

test('HTML games are sandboxed away from account storage', async () => {
    const [loader, registry] = await Promise.all([
        read('js/student/studentGameHtmlLoaderMethods.js'),
        import('../js/student/studentGameRegistry.js')
    ]);
    assert.match(loader, /setAttribute\('sandbox', 'allow-scripts/);
    assert.doesNotMatch(loader, /allow-same-origin/);
    assert.match(loader, /event\.source !== iframe\.contentWindow/);
    assert.match(loader, /data\.channel !== storageChannel/);

    for (const game of registry.STUDENT_GAME_REGISTRY.filter(game => game.launch.mode === 'html')) {
        const html = await read(game.launch.path);
        assert.match(html, /sandbox-storage\.js/, `${game.id} must load the sandbox storage bridge first`);
    }
});

test('password reset reports recoverable partial success after the password changes', async () => {
    const source = await read('supabase/functions/reset-student-password/index.ts');
    const partialSuccess = source.slice(source.indexOf('if (profileUpdateError)'));
    assert.match(partialSuccess, /temporaryPassword/);
    assert.match(partialSuccess, /passwordChanged: true/);
    assert.match(partialSuccess, /profileFlagUpdated: false/);
    assert.doesNotMatch(partialSuccess.split('return jsonResponse')[1]?.split(');')[0] || '', /, 500/);
});

test('offline cache cleanup is scoped to this application', async () => {
    const source = await read('student-sw.js');
    assert.match(source, /key\.startsWith\(CACHE_PREFIX\)/);
    assert.doesNotMatch(source, /keys\.filter\(key => key !== CACHE_NAME\)/);
});
