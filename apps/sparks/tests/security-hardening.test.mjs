import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Papa from 'papaparse';

import { serializeCSV } from '../js/teacherDataExportDownloads.js';

const read = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readWorkspace = relativePath => readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');

test('student-controlled leaderboard, activity, and export values are HTML-escaped', async () => {
    const [leaderboard, activity, overview, viewer, preview] = await Promise.all([
        read('js/student/studentGameLeaderboardMethods.js'),
        read('js/teacherDataDashboardRecentActivityMethods.js'),
        read('js/teacherClassWorkspace.js'),
        read('js/teacherDataViewer.js'),
        read('js/teacherDataExportPreviewRenderer.js')
    ]);

    assert.match(leaderboard, /const displayName = escapeHtml\(/);
    assert.doesNotMatch(leaderboard, />\$\{data\.name\}</);
    for (const field of ['student', 'unit', 'activity', 'score', 'dateStr']) {
        assert.match(activity, new RegExp(`escapeHtml\\(activity\\.${field}\\)`));
    }
    assert.match(overview, /node\.textContent = text/);
    assert.match(overview, /element\('h3', c\.name\)/);
    assert.doesNotMatch(overview, /innerHTML/);
    for (const source of [viewer, preview]) {
        assert.match(source, /escapeHtml\(name\)/);
        assert.match(source, /escapeHtml\(item\.gameId \|\| '-'\)/);
    }
});

test('notifications render messages as text and Spark links require safe protocols', async () => {
    const [notifications, sparks] = await Promise.all([
        read('js/notifications.js'),
        read('js/student/studentHomePresentation.js')
    ]);
    assert.match(notifications, /messageText\.textContent = String\(message/);
    assert.doesNotMatch(notifications, /toast\.innerHTML[\s\S]*\$\{message\}/);
    assert.match(sparks, /\['https:', 'http:'\]\.includes\(url\.protocol\)/);
    assert.match(sparks, /getSafeExternalUrl\(spark\.sourceUrl\)/);
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
    const workflow = await readWorkspace('.github/workflows/static.yml');
    assert.match(workflow, /run: npm test/);
    assert.match(workflow, /run: npm run test:acceptance:supabase/);
    assert.match(workflow, /supabase db lint --local --fail-on warning/);
    assert.match(workflow, /supabase db advisors --local --level warn --fail-on warn --type all/);
    assert.doesNotMatch(workflow, /--fail-on none/);
    assert.match(workflow, /validate:[\s\S]*?deploy:[\s\S]*?needs: validate/);
    assert.match(workflow, /deploy:[\s\S]*?pages: write[\s\S]*?id-token: write/);
    assert.doesNotMatch(workflow, /uses: [^\s]+@v\d/);
});

test('CI exercises authentication, IndexedDB, activities, and sandboxing in Firefox and WebKit', async () => {
    const [workflow, smoke] = await Promise.all([
        readWorkspace('.github/workflows/static.yml'),
        read('scripts/ui-cross-browser-smoke.mjs')
    ]);
    assert.match(workflow, /playwright install --with-deps chromium firefox webkit/);
    assert.match(workflow, /npm run test:ui:cross-browser/);
    assert.match(smoke, /import \{ firefox, webkit \} from 'playwright'/);
    assert.match(smoke, /AUDIT_TEACHER_EMAIL/);
    assert.match(smoke, /AUDIT_STUDENT_EMAIL/);
    assert.match(smoke, /AUDIT_VOCABULARY_ID/);
    assert.match(smoke, /activity\/flashcards/);
    assert.match(smoke, /indexedDB\.open/);
    assert.match(smoke, /parentCannotReadDocument/);
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

test('retired administrator account endpoints direct users to school invitations and account recovery', async () => {
    for (const endpoint of ['create-student-account', 'reset-student-password']) {
        const source = await read(`supabase/functions/${endpoint}/index.ts`);
        assert.match(source, /status: 410/);
        assert.match(source, /SCHOOL_ACCOUNT_RECOVERY_REQUIRED/);
        assert.doesNotMatch(source, /createClient|auth\.admin|updateUserById|createUser|temporaryPassword|passwordChanged|Deno\.env|fetch\s*\(/);
    }
    const reset = await read('supabase/functions/reset-student-password/index.ts');
    assert.match(reset, /school administrators cannot reset a shared account password/);
});

test('offline cache cleanup is scoped to this application', async () => {
    const source = await read('student-sw.js');
    assert.match(source, /key\.startsWith\(CACHE_PREFIX\)/);
    assert.doesNotMatch(source, /keys\.filter\(key => key !== CACHE_NAME\)/);
});
