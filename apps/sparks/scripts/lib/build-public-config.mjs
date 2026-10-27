import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

// Invoked in an isolated process with Vite debug logging disabled. Only the
// digest leaves this process; neither private env files nor public values do.
const [root, mode = 'production'] = process.argv.slice(2);
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
process.env.npm_package_version ||= packageJson.version || '0.1.0';
const nodeEnvWasSet = Boolean(process.env.NODE_ENV);
process.env.NODE_ENV ||= 'production';
const env = loadEnv(mode, root, '');
const publicEnv = Object.fromEntries(Object.entries(env)
    .filter(([name]) => name.startsWith('VITE_')).sort(([a], [b]) => a.localeCompare(b)));
const effectiveNodeEnv = !nodeEnvWasSet && process.env.VITE_USER_NODE_ENV === 'development'
    ? 'development' : process.env.NODE_ENV;
const configuration = {
    mode,
    publicEnv,
    appVersion: env.npm_package_version || '0.1.0',
    nodeEnv: effectiveNodeEnv,
    allowMissingSupabaseConfig: env.ALLOW_MISSING_SUPABASE_CONFIG === '1',
    allowProductionInDev: env.ALLOW_PRODUCTION_SUPABASE_IN_DEV === '1',
    maximumDistBytes: process.env.MAX_DIST_BYTES || String(30 * 1024 * 1024)
};
process.stdout.write(createHash('sha256').update(JSON.stringify(configuration)).digest('hex'));
