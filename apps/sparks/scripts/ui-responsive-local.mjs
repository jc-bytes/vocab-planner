import { spawn } from 'node:child_process';
import process from 'node:process';

import {
    AUDIT_PASSWORD,
    AUDIT_STUDENT_EMAIL,
    AUDIT_TEACHER_EMAIL,
    seedLocalAuditData
} from './lib/local-supabase-audit.mjs';

function runNodeScript(script, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script], {
            cwd: process.cwd(),
            env,
            stdio: 'inherit'
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${script} exited with code ${code}`));
        });
    });
}

const seeded = await seedLocalAuditData({ resetSubmissions: false });

await runNodeScript('scripts/ui-responsive-audit.mjs', {
    ...process.env,
    UI_AUDIT_TEACHER_EMAIL: AUDIT_TEACHER_EMAIL,
    UI_AUDIT_STUDENT_EMAIL: AUDIT_STUDENT_EMAIL,
    UI_AUDIT_PASSWORD: AUDIT_PASSWORD,
    UI_AUDIT_SUPABASE_URL: seeded.browserConfig.url,
    UI_AUDIT_SUPABASE_KEY: seeded.browserConfig.publishableKey
});
