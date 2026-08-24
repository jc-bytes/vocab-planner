import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    PRODUCTION_SUPABASE_URL,
    isSupabaseConfigured,
    isValidSupabaseConfig
} from '../config/supabase-config.js';
import { validateSupabaseBuildConfig } from '../vite.config.mjs';

const validConfig = {
    url: 'https://example-project.supabase.co',
    publishableKey: 'sb_publishable_example'
};

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
    } finally {
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
});

test('the example environment does not pre-authorize production in development', async () => {
    const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
    assert.doesNotMatch(example, /^ALLOW_PRODUCTION_SUPABASE_IN_DEV=1$/m);
    assert.match(example, /^# ALLOW_PRODUCTION_SUPABASE_IN_DEV=1$/m);
});
