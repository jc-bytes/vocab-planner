import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Audit every dependency. Only the approved, pinned development finding can pass.
export function evaluateAudit(report, lock, { exception, lockDigest, now = new Date() }) {
    assert.equal(report.auditReportVersion, 2, 'Unsupported npm audit report');
    assert.ok(!report.error && report.vulnerabilities && report.metadata?.vulnerabilities, 'Incomplete npm audit report');
    const entries = report.vulnerabilities;
    for (const severity of ['high', 'critical']) {
        assert.equal(report.metadata.vulnerabilities[severity], Object.values(entries).filter(finding => finding.severity === severity).length, 'Inconsistent npm audit report');
    }
    const blocking = Object.entries(entries).filter(([, finding]) => ['high', 'critical'].includes(finding.severity));
    if (!blocking.length) return [];
    assert.ok(now.getTime() < Date.parse(exception.expiresAt), 'Temporary audit exception expired');
    assert.equal(lockDigest, exception.lockSha256, 'Dependency lock changed; exception requires review');
    const allowed = (name, visited = new Set()) => {
        assert.ok(!visited.has(name), 'Unresolved audit dependency cycle');
        const finding = entries[name];
        assert.ok(finding && finding.name === name && finding.severity !== 'critical', `Unapproved finding: ${name}`);
        // Match the existing high-severity gate; moderate findings remain reported.
        if (['info', 'low', 'moderate'].includes(finding.severity)) return;
        assert.equal(finding.severity, 'high', `Unknown severity: ${name}`);
        assert.ok(finding.nodes?.length && finding.via?.length, `Incomplete finding: ${name}`);
        for (const node of finding.nodes) {
            assert.equal(lock.packages[node]?.dev, true, `Exception cannot cover a production dependency: ${node}`);
        }
        const next = new Set([...visited, name]);
        for (const cause of finding.via) {
            if (typeof cause === 'string') allowed(cause, next);
            else {
                assert.equal(name, exception.package, `Unapproved advisory on ${name}`);
                assert.equal(cause.url, exception.advisory, `Unapproved advisory: ${cause.url}`);
                assert.equal(cause.name, exception.package, 'Unexpected advisory package');
                assert.equal(cause.severity, 'high', 'Advisory severity changed');
                for (const node of finding.nodes) assert.equal(lock.packages[node].version, exception.version, 'Exception package version changed');
            }
        }
    };
    for (const [name] of blocking) allowed(name);
    return blocking.map(([name]) => name);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const exception = JSON.parse(readFileSync(new URL('./security-audit-exception.json', import.meta.url), 'utf8'));
        const rawLock = readFileSync(new URL('../package-lock.json', import.meta.url));
        const result = spawnSync('npm', ['audit', '--audit-level=high', '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
        assert.ok(!result.error && !result.signal && [0, 1].includes(result.status), 'npm audit did not complete');
        const report = JSON.parse(result.stdout);
        const waived = evaluateAudit(report, JSON.parse(rawLock), { exception, lockDigest: createHash('sha256').update(rawLock).digest('hex') });
        assert.ok(result.status === 0 || waived.length, 'npm audit failed without an eligible finding');
        console.log(JSON.stringify(report, null, 2));
        console.log(waived.length ? `Temporary development-only exception for ${exception.advisory}; expires ${exception.expiresAt}. Affected findings: ${waived.join(', ')}.` : 'No high or critical dependency findings.');
    } catch (error) {
        console.error(`Release dependency audit blocked: ${error.message}`);
        process.exitCode = 1;
    }
}
