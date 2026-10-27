import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { GATED_TESTS, reachableScripts } from '../scripts/lib/testInventory.mjs';

const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const workflow = await readFile(new URL('../../../.github/workflows/static.yml', import.meta.url), 'utf8');
const promotion = await readFile(new URL('../../../.github/workflows/promote-sparks-release.yml', import.meta.url), 'utf8');
const [validation, deployment] = workflow.split('\n  deploy:\n');

test('actual CI reaches every registered database gate and the new ownership rehearsals', () => {
    const actual = new Set();
    for (const [, name] of validation.matchAll(/\bnpm run ([\w:-]+)/g)) {
        for (const child of reachableScripts(scripts, name)) actual.add(child);
    }
    if (/\bnpm test\b/.test(validation)) for (const child of reachableScripts(scripts, 'test')) actual.add(child);
    for (const name of [...Object.values(GATED_TESTS), 'test:arcade-purchase:database', 'test:student-mutation-ownership:database', 'test:school-setting-ownership:database', 'test:school-progress-snapshot:database', 'test:selected-profile-export:database', 'test:student-queue-order:database', 'test:school-progress-batch:database', 'test:school-progress-permissions:database', 'test:school-progress-groups:database', 'test:policy-request-identity:database', 'test:progress-lint-compatibility:database']) {
        assert.ok(actual.has(name), `${name} needs an actual CI step, not only a package release entry`);
    }
});

test('built fault and ownership checks run after the actual CI build and in the local release command', () => {
    const required = [
        ['PRIVATE_CLASSROOM_UI_DIST', 'test:private-classrooms'],
        ['UI_STUDENT_NAVIGATION_DIST', 'test:ui:student-navigation-recovery'],
        ['UI_AUTH_SMOKE_DIST', 'test:ui:auth-smoke'],
        ['UI_TEACHER_CATALOG_DIST', 'test:ui:teacher-catalog'],
        ['UI_TEACHER_PROGRESS_FEATURE_DIST', 'test:ui:teacher-progress-feature'],
        ['UI_TEACHER_QUIZ_REPLACEMENT_DIST', 'test:ui:teacher-quiz-replacement'],
        ['UI_TEACHER_VOCABULARY_BROWSER_DIST', 'test:ui:teacher-vocabulary-browser'],
        ['UI_TEACHER_VOCABULARY_SAVES_DIST', 'test:ui:teacher-vocabulary-saves'],
        ['UI_TEACHER_LOCAL_COPIES_DIST', 'test:ui:teacher-local-copies'],
        ['UI_TEACHER_MATERIAL_ACTIONS_DIST', 'test:ui:teacher-material-actions'],
        ['UI_TEACHER_PREVIEW_LAYOUT_DIST', 'test:ui:teacher-preview-layout'],
        ['SECTION_RECOVERY_DIST', 'test:ui:section-recovery'],
        ['UI_STUDENT_UNITS_DIST', 'test:ui:student-units-lazy'],
        ['UI_STUDENT_UNIT_WORKSPACE_DIST', 'test:ui:student-unit-workspace'],
        ['UI_STUDENT_HOME_SPARK_SCOPE_DIST', 'test:ui:student-home-spark-scope'],
        ['UI_STUDENT_HOME_PRESENTATION_DIST', 'test:ui:student-home-presentation'],
        ['UI_STUDENT_LIBRARY_STYLES_DIST', 'test:ui:student-library-styles'],
        ['UI_STUDENT_RUNTIME_DIST', 'test:ui:student-active-runtime'],
        ['UI_STUDENT_WORD_HUNT_EVIDENCE_DIST', 'test:ui:word-hunt-evidence'],
        ['UI_ARCADE_ELIGIBILITY_DIST', 'test:ui:arcade-eligibility'],
        ['UI_ARCADE_LAYOUT_DIST', 'test:ui:arcade-layout'],
        ['UI_PASSWORD_ISOLATION_DIST', 'test:ui:password-isolation'],
        ['UI_ARCADE_PURCHASE_DIST', 'test:ui:arcade-purchase-recovery'],
        ['UI_ACTIVITY_RECOVERY_DIST', 'test:ui:activity-startup-recovery'],
        ['STUDENT_WORKER_LIFECYCLE_REUSE', 'test:ui:worker-lifecycle'],
        ['STUDENT_SPARK_DIST', 'test:ui:student-sparks'],
        ['AUTH_LAYOUT_DIST', 'test:ui:auth-layout']
    ];
    const build = validation.indexOf('run: npm run desktop:build:web');
    assert.ok(build >= 0);
    for (const [variable, name] of required) {
        const command = `${variable}=1 npm run ${name}`;
        assert.ok(validation.indexOf(`run: ${command}`) > build, `${name} must exercise the final build`);
        const step = validation.split('\n      - name: ').find(step => step.includes(`run: ${command}`));
        assert.doesNotMatch(step, /^\s*if:/m, `${name} cannot be skipped by a pilot flag`);
        assert.ok(scripts['test:release'].indexOf(command) > scripts['test:release'].indexOf('npm run desktop:build:web'));
    }
});

test('hosted readiness executes only in publishing jobs before either Pages deployment', () => {
    const command = 'node apps/sparks/scripts/verify-owned-rpc-readiness.mjs';
    assert.ok(deployment, 'the static deployment job must exist');
    assert.doesNotMatch(validation, /verify-owned-rpc-readiness/);
    assert.match(deployment, /if:.*!inputs\.validation_only/);
    assert.equal(reachableScripts(scripts, 'test:release').has('verify:owned-rpc-readiness'), false);
    for (const job of [deployment, promotion]) {
        assert.ok(job.includes(command));
        assert.ok(job.indexOf(command) < job.indexOf('uses: actions/deploy-pages@'));
        assert.match(job, /SUPABASE_URL: \$\{\{ secrets\.SUPABASE_URL \}\}/);
        assert.match(job, /SUPABASE_PUBLISHABLE_KEY: \$\{\{ secrets\.SUPABASE_PUBLISHABLE_KEY \}\}/);
        assert.match(job, /contents: read/);
        assert.match(job, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
        assert.match(job, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
        assert.match(job, /node-version: 22/);
        assert.doesNotMatch(job, /SUPABASE_(?:SERVICE_ROLE|SECRET|ACCESS_TOKEN)/);
    }
    assert.match(promotion, /\.conclusion == "success" and \.path == "\.github\/workflows\/static.yml"/);
    assert.match(promotion, /cmp "\$source_sha.json" "\$GITHUB_SHA.json"/);
});

test('release audits include development dependencies used to build and verify published code', () => {
    for (const source of [validation, scripts['test:release']]) {
        assert.match(source, /npm audit --audit-level=high/);
        assert.doesNotMatch(source, /npm audit[^\n&]*--omit(?:=|\s+)dev/);
    }
});

test('actual CI requires Firefox and WebKit even when an older caller passes the deprecated pilot input', () => {
    const crossBrowser = validation.split('\n      - name: ').find(step => step.includes('run: npm run test:ui:cross-browser'));
    assert.ok(crossBrowser, 'the cross-browser release gate must remain in actual CI');
    assert.doesNotMatch(crossBrowser, /^\s*if:/m);
    assert.doesNotMatch(validation, /if:[^\n]*pilot_publish/);
    assert.ok(reachableScripts(scripts, 'test:release').has('test:ui:cross-browser'));
});


test('actual production build validates copied catalog byte parity before packaging', async () => {
    assert.equal(scripts['desktop:build:web'], 'node scripts/build-web.mjs');
    const { WEB_BUILD_STEPS } = await import('../scripts/build-web.mjs');
    const copy = WEB_BUILD_STEPS.indexOf('copy-desktop-assets.mjs');
    assert.ok(copy >= 0);
    assert.ok(WEB_BUILD_STEPS.indexOf('validate-built-vocabulary-catalog.mjs') > copy);
    assert.ok(WEB_BUILD_STEPS.indexOf('validate-built-vocabulary-catalog.mjs') < WEB_BUILD_STEPS.indexOf('validate-game-build.mjs'));
});


test('local release and actual CI reject database warning regressions', () => {
    for (const command of [
        'supabase db lint --local --fail-on warning',
        'supabase db advisors --local --level warn --fail-on warn --type all'
    ]) {
        assert.ok(scripts['test:release'].includes(command), `Release must retain ${command}`);
        assert.ok(validation.includes(`run: ${command}`), `Actual CI must retain ${command}`);
    }
});


test('compiled CI checks inherit the same hosted public configuration as the build stamp', () => {
    const local = validation.indexOf('- name: Configure local worker lifecycle builds');
    const release = validation.indexOf('- name: Align compiled checks with hosted build configuration');
    const build = validation.indexOf('- name: Build site');
    assert.ok(local >= 0 && local < release && release < build);
    const step = validation.slice(release, build);
    for (const [variable, secret] of [['VITE_SUPABASE_URL', 'SUPABASE_URL'], ['VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY']]) {
        assert.ok(step.includes(variable + ': $' + '{{ secrets.' + secret + ' }}'));
        assert.ok(step.includes(`printf '${variable}=%s\\n' "$${variable}" >> "$GITHUB_ENV"`));
    }
});
