import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const database = process.env.SPARKS_SCHOOL_TEST_DATABASE;
const container = process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled = Boolean(database && container && /rehearsal|test|validation/.test(database));

test('dashboard handles a school-sized workload and preserves class and school authority', { skip: !enabled }, () => {
    try {
        const output = execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', database], {
            input: readFileSync(new URL('../supabase/tests/teacher_dashboard_acceptance.sql', import.meta.url)),
            encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
        });
        assert.match(output, /dashboard workload and isolation passed/);
        console.log(output.trim().split('\n').filter(line => line.includes('dashboard workload')).join('\n'));
    } catch (error) {
        throw new Error(String(error.stderr || error.message));
    }
});
