import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverTestFiles, selectPortableTests } from './lib/testInventory.mjs';

const directory = new URL('../tests/', import.meta.url);
const files = selectPortableTests(await discoverTestFiles(fileURLToPath(directory)));
console.log(`Running ${files.length} portable test files; database and authenticated acceptance tests have explicit release gates.`);
const child = spawn(process.execPath, ['--test', ...files.map(name => fileURLToPath(new URL(name, directory)))], { stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
