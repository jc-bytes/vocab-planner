import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [landingCss, cardsCss] = await Promise.all([
    readFile(new URL('../css/landing.css', import.meta.url), 'utf8'),
    readFile(new URL('../css/cards.css', import.meta.url), 'utf8')
]);

test('landing mode links keep their card surfaces in the shared card stylesheet', () => {
    assert.match(
        cardsCss,
        /\.card\s*\{[^}]*background:\s*var\(--color-surface\)[^}]*border:\s*1px solid var\(--color-border\)/s
    );
    assert.doesNotMatch(landingCss, /\.card\s*\{[^}]*background:/s);
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
