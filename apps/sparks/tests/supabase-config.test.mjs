import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    PRODUCTION_SUPABASE_URL,
    PRODUCTION_SUPABASE_PROJECT_REF,
    isSupabaseConfigured,
    isPrivilegedSupabaseKey,
    isValidSupabaseConfig
} from '../config/supabase-config.js';
import { createSupabaseClient } from '../js/services/supabaseClient.js';
import { validateSupabaseBuildConfig } from '../vite.config.mjs';

const validConfig = {
    url: 'https://example-project.supabase.co',
    publishableKey: 'sb_publishable_example'
};

function legacyJwt(role) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

test('Supabase configuration validation rejects missing and placeholder values', () => {
    assert.equal(isValidSupabaseConfig({}), false);
    assert.equal(isValidSupabaseConfig({ url: validConfig.url }), false);
    assert.equal(isValidSupabaseConfig({
        url: 'https://YOUR_PROJECT_REF.supabase.co',
        publishableKey: validConfig.publishableKey
    }), false);
    assert.equal(isValidSupabaseConfig({
        url: validConfig.url,
        publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
    }), false);
    assert.equal(isValidSupabaseConfig(validConfig), true);
    assert.equal(isValidSupabaseConfig({
        ...validConfig,
        publishableKey: 'legacy-anon-key'
    }), true);
});

test('browser configuration rejects current and legacy privileged key formats', () => {
    const legacyServiceRole = legacyJwt('service_role');
    assert.equal(isPrivilegedSupabaseKey('sb_secret_example'), true);
    assert.equal(isPrivilegedSupabaseKey('SUPABASE_SERVICE_ROLE_KEY'), true);
    assert.equal(isPrivilegedSupabaseKey(legacyServiceRole), true);
    assert.equal(isPrivilegedSupabaseKey(legacyJwt('anon')), false);
    assert.equal(isPrivilegedSupabaseKey(validConfig.publishableKey), false);
    assert.equal(isValidSupabaseConfig({ ...validConfig, publishableKey: 'sb_secret_example' }), false);
    assert.equal(isValidSupabaseConfig({ ...validConfig, publishableKey: legacyServiceRole }), false);
    assert.equal(isValidSupabaseConfig({ ...validConfig, publishableKey: legacyJwt('anon') }), true);
});

test('runtime Supabase validation honors an explicit browser override', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { SUPABASE_CONFIG: validConfig };
    try {
        assert.equal(isSupabaseConfigured(), true);
        globalThis.window.SUPABASE_CONFIG = {
            url: 'https://YOUR_PROJECT_REF.supabase.co',
            publishableKey: 'your_key_here'
        };
        assert.equal(isSupabaseConfigured(), false);
        globalThis.window.SUPABASE_CONFIG = {
            url: validConfig.url,
            publishableKey: 'sb_secret_browser_override'
        };
        assert.equal(isSupabaseConfigured(), false);
    } finally {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
});

test('student and teacher pages keep independent persisted auth sessions', async () => {
    const previousWindow = globalThis.window;
    const clients = [];
    globalThis.window = {
        SUPABASE_CONFIG: validConfig,
        location: { pathname: '/student.html' }
    };

    try {
        const studentClient = createSupabaseClient();
        clients.push(studentClient);
        globalThis.window.location.pathname = '/teacher.html';
        const teacherClient = createSupabaseClient();
        clients.push(teacherClient);

        assert.notEqual(studentClient.auth.storageKey, teacherClient.auth.storageKey);
        assert.match(studentClient.auth.storageKey, /student/);
        assert.match(teacherClient.auth.storageKey, /teacher/);
    } finally {
        await Promise.all(clients.map(client => client.auth.dispose()));
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
});

test('build validation shares runtime validity and protects production from development use', () => {
    assert.throws(() => validateSupabaseBuildConfig({
        command: 'build',
        mode: 'production',
        env: {}
    }), /Missing Supabase build config/);
    assert.doesNotThrow(() => validateSupabaseBuildConfig({
        command: 'build',
        mode: 'production',
        env: {
            VITE_SUPABASE_URL: validConfig.url,
            VITE_SUPABASE_PUBLISHABLE_KEY: validConfig.publishableKey
        }
    }));
    assert.throws(() => validateSupabaseBuildConfig({
        command: 'serve',
        mode: 'development',
        env: {
            VITE_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
            VITE_SUPABASE_PUBLISHABLE_KEY: validConfig.publishableKey
        }
    }), /Refusing to use the production Supabase project/);
    assert.throws(() => validateSupabaseBuildConfig({
        command: 'serve',
        mode: 'development',
        env: {
            VITE_SUPABASE_URL: validConfig.url,
            VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_build_key',
            ALLOW_MISSING_SUPABASE_CONFIG: '1'
        }
    }), /Refusing to expose a Supabase secret or service_role key/);
});

test('the example environment does not pre-authorize production in development', async () => {
    const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
    assert.doesNotMatch(example, /^ALLOW_PRODUCTION_SUPABASE_IN_DEV=1$/m);
    assert.match(example, /^# ALLOW_PRODUCTION_SUPABASE_IN_DEV=1$/m);
});

test('production project defaults have one guarded authority across runtime and planner tooling', async () => {
    const planner = await readFile(new URL('../planner', import.meta.url), 'utf8');

    assert.equal(PRODUCTION_SUPABASE_URL, `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`);
    assert.doesNotMatch(planner, new RegExp(PRODUCTION_SUPABASE_PROJECT_REF));
    assert.doesNotMatch(planner, new RegExp(PRODUCTION_SUPABASE_URL.replaceAll('.', '\\.')));
    assert.match(planner, /PRODUCTION_SUPABASE_PROJECT_REF/);
    assert.match(planner, /\.\/config\/supabase-config\.js/);
    assert.match(planner, /remote_url="\$\{REMOTE_SUPABASE_URL:-https:\/\/\$\{remote_project_ref\}\.supabase\.co\}"/);
});
