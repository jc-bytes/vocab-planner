import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const GATED_TESTS = Object.freeze({
    'local-supabase-acceptance.test.mjs': 'test:acceptance:supabase',
    'private-classrooms-acceptance.test.mjs': 'test:private-classrooms',
    'school-platform-database-acceptance.test.mjs': 'test:school-platform:rest',
    'teacher-student-insight-database.test.mjs': 'test:student-insight:database',
    'teacher-student-feedback-database.test.mjs': 'test:student-insight:database'
});

export async function discoverTestFiles(directory, prefix = '') {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) files.push(...await discoverTestFiles(join(directory, entry.name), name));
        else if (entry.isFile() && name.endsWith('.test.mjs')) files.push(name);
    }
    return files.sort();
}

export function selectPortableTests(files) {
    const unique = [...new Set(files)].sort();
    for (const name of Object.keys(GATED_TESTS)) {
        if (!unique.includes(name)) throw new Error(`Registered gated test is missing: ${name}`);
    }
    for (const name of unique) {
        if (/(?:database|acceptance)\.test\.mjs$/.test(name) && !Object.hasOwn(GATED_TESTS, name)) {
            throw new Error(`Classify the database or acceptance test before running it: ${name}`);
        }
    }
    return unique.filter(name => !Object.hasOwn(GATED_TESTS, name));
}

export function reachableScripts(scripts, root) {
    const reached = new Set();
    function visit(name) {
        if (reached.has(name)) return;
        if (!Object.hasOwn(scripts, name)) throw new Error(`Missing npm script: ${name}`);
        reached.add(name);
        for (const match of scripts[name].matchAll(/\bnpm run ([\w:-]+)/g)) visit(match[1]);
        if (/\bnpm test\b/.test(scripts[name])) visit('test');
    }
    visit(root);
    return reached;
}
