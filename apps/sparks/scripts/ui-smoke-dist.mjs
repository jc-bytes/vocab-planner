import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import process from 'node:process';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_SMOKE_DIST_HOST || '127.0.0.1';
const requestedPort = Number(process.env.UI_SMOKE_DIST_PORT || 4174);
const outDir = process.env.UI_SMOKE_DIST_DIR || 'dist-desktop';

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: options.env || process.env,
            stdio: options.stdio || 'inherit'
        });
        child.on('error', reject);
        child.on('exit', code => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });
        server.listen(port, host);
    });
}

async function findPort(startPort) {
    for (let port = startPort; port < startPort + 50; port += 1) {
        if (await isPortAvailable(port)) return port;
    }
    throw new Error(`Could not find an available preview port from ${startPort}.`);
}

async function ensureDist() {
    if (process.env.UI_SMOKE_DIST_REUSE === '1' && existsSync(outDir)) return;
    await runCommand('npm', ['run', 'desktop:build:web']);
}

async function main() {
    await ensureDist();
    const port = await findPort(requestedPort);
    const baseUrl = `http://${host}:${port}`;
    const preview = await ensureViteServer({
        baseUrl, probePath: '/teacher.html', host, port,
        args: ['vite', 'preview', '--outDir', outDir, '--host', host, '--port', String(port), '--strictPort']
    });

    try {
        await runCommand('npm', ['run', 'test:ui:smoke'], {
            env: {
                ...process.env,
                UI_SMOKE_BASE_URL: baseUrl,
                UI_SMOKE_SOURCE_FIXTURES: '0'
            }
        });
    } finally {
        preview.kill();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
