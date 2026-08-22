import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const landingCss = await readFile(new URL('../css/landing.css', import.meta.url), 'utf8');

test('landing mode links keep their card surfaces in the split stylesheet', () => {
    assert.match(
        landingCss,
        /\.card\s*\{[^}]*background:\s*var\(--card-bg\)[^}]*border:\s*1px solid var\(--border-color\)/s
    );
});

test('tablet landing layout does not shrink its grid tracks to content width', () => {
    assert.doesNotMatch(
        landingCss,
        /\.landing-container\s*\{[^}]*justify-content:\s*flex-start/s
    );
    assert.match(
        landingCss,
        /@media \(max-width:\s*768px\)[\s\S]*?\.landing-options\s*\{[^}]*max-width:\s*34rem/s
    );
});
