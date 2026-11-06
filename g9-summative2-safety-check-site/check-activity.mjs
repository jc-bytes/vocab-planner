import { readFile } from 'node:fs/promises';
import { lesson } from './lesson.js';
import { checkActivity } from './activity-check.js';

const printable = await readFile(new URL('./printable-fallback.html', import.meta.url), 'utf8').catch(()=>'');
const checks = checkActivity(lesson, printable);
console.log(`Activity check: ${lesson.title || 'Untitled activity'}\n`);
for (const check of checks) {
  const mark = check.status === 'pass' ? 'OK' : check.status === 'review' ? 'REVIEW' : 'FIX';
  console.log(`${mark}  ${check.name}: ${check.detail}`);
}
if (checks.some(check=>check.status==='fail')) process.exitCode = 1;
