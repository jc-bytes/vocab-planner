import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudit } from '../scripts/audit-release-dependencies.mjs';

const advisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
function fixture() {
    const report = { auditReportVersion: 2, metadata: { vulnerabilities: { high: 2, critical: 0 } }, vulnerabilities: {
        picomatch: { name: 'picomatch', severity: 'high', nodes: ['node_modules/picomatch'], via: [{ name: 'picomatch', severity: 'high', url: advisory }] },
        vite: { name: 'vite', severity: 'high', nodes: ['node_modules/vite'], via: ['picomatch'] }
    } };
    const lock = { packages: { 'node_modules/picomatch': { dev: true, version: '4.0.5' }, 'node_modules/vite': { dev: true, version: '6.4.5' } } };
    const context = { exception: { advisory, package: 'picomatch', version: '4.0.5', expiresAt: '2026-11-25T00:00:00Z', lockSha256: 'pinned' }, lockDigest: 'pinned', now: new Date('2026-11-18T12:00:00Z') };
    return { report, lock, context };
}
function check(mutate) { const f = fixture(); mutate?.(f); return evaluateAudit(f.report, f.lock, f.context); }

test('approved finding and derived development findings pass until expiry', () => assert.deepEqual(check(), ['picomatch', 'vite']));
for (const [name, mutate] of [
    ['expiry', f => { f.context.now = new Date('2026-11-25T00:00:00Z'); }],
    ['changed lock', f => { f.context.lockDigest = 'changed'; }],
    ['production dependency', f => { f.lock.packages['node_modules/vite'].dev = false; }],
    ['another advisory', f => { f.report.vulnerabilities.picomatch.via.push({ name: 'picomatch', severity: 'high', url: 'https://github.com/advisories/another' }); }],
    ['critical finding', f => { f.report.vulnerabilities.picomatch.severity = 'critical'; f.report.metadata.vulnerabilities.high--; f.report.metadata.vulnerabilities.critical++; }],
    ['changed version', f => { f.lock.packages['node_modules/picomatch'].version = '4.0.7'; }],
    ['missing dependency cause', f => { f.report.vulnerabilities.vite.via = ['unknown']; }],
    ['empty causes', f => { f.report.vulnerabilities.vite.via = []; }],
    ['dependency cycle', f => { f.report.vulnerabilities.picomatch.via = ['vite']; }],
    ['registry error', f => { f.report.error = { message: 'offline' }; }]
]) test(`audit blocks ${name}`, () => assert.throws(() => check(mutate)));
test('clean audit passes after exception expires', () => assert.deepEqual(check(f => { f.report.vulnerabilities = {}; f.report.metadata.vulnerabilities.high = 0; f.context.now = new Date('2026-11-26T00:00:00Z'); }), []));

test('moderate advisory branches remain reported without expanding the high-severity exception', () => assert.deepEqual(check(f => {
    f.report.vulnerabilities.vite.via.push('moderate-tool');
    f.report.vulnerabilities['moderate-tool'] = { name: 'moderate-tool', severity: 'moderate', nodes: ['node_modules/moderate-tool'], via: [{ name: 'moderate-tool', severity: 'moderate', url: 'https://github.com/advisories/moderate' }] };
}), ['picomatch', 'vite']));
test('an unrelated high finding blocks release', () => assert.throws(() => check(f => {
    f.report.vulnerabilities.other = { name: 'other', severity: 'high', nodes: ['node_modules/other'], via: [{ name: 'other', severity: 'high', url: 'https://github.com/advisories/other' }] };
    f.lock.packages['node_modules/other'] = { dev: true, version: '1.0.0' };
    f.report.metadata.vulnerabilities.high++;
})));

test('inconsistent audit counts block release', () => assert.throws(() => check(f => { f.report.vulnerabilities = {}; })));
