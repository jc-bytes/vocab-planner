import { generateSW } from 'workbox-build';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectStudentPrecacheFiles } from './student-precache.mjs';

export async function generateStudentServiceWorker({ outputDirectory = 'dist-desktop', lifecycleOptions = {} } = {}) {
  const manifest = JSON.parse(await readFile(join(outputDirectory, '.vite/manifest.json'), 'utf8'));
  const studentEntryKey = Object.keys(manifest).find(key => manifest[key].isEntry && manifest[key].src === 'student.html');
  if (!studentEntryKey) throw new Error('The Vite manifest does not contain the student entry.');
  const precacheFiles = collectStudentPrecacheFiles(manifest, studentEntryKey);
  let precacheBytes = 0;
  const additionalManifestEntries = await Promise.all([...precacheFiles].sort().map(async url => {
    const contents = await readFile(join(outputDirectory, url));
    precacheBytes += contents.byteLength;
    return { url, revision: createHash('sha256').update(contents).digest('hex').slice(0, 16) };
  }));
  const version = createHash('sha256').update(JSON.stringify(additionalManifestEntries)).digest('hex').slice(0, 16);
  const cachePrefix = `vocabulary-student-graph-${version}`;
  const lifecycleFile = `student-sw-lifecycle-${version}.js`;
  const lifecycleSource = await readFile(new URL('../js/student/studentWorkerLifecycle.js', import.meta.url), 'utf8');
  await writeFile(join(outputDirectory, lifecycleFile), `${lifecycleSource}\nself.installStudentWorkerLifecycle(${JSON.stringify({ ...lifecycleOptions, cachePrefix })});\n`);
  const result = await generateSW({
    cacheId: cachePrefix,
    cleanupOutdatedCaches: false,
    clientsClaim: true,
    globDirectory: outputDirectory,
    globPatterns: [],
    additionalManifestEntries,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    importScripts: [lifecycleFile],
    navigateFallback: 'student.html',
    navigateFallbackAllowlist: [/\/student(?:\.html)?$/],
    runtimeCaching: [
      {
        urlPattern: ({ request, url }) => url.origin === self.location.origin
          && url.pathname.startsWith(new URL(self.registration.scope).pathname + 'assets/')
          && /\.(?:js|css)$/.test(url.pathname) && ['script', 'style'].includes(request.destination),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'vocabulary-student-code-v1',
          expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] },
          // Run after expiration: retained document code has its own lifetime.
          plugins: [{
            cachedResponseWillBeUsed: async ({ request, cachedResponse }) =>
              await self.studentWorkerLifecycle.findRetainedCode(request) || cachedResponse
          }]
        }
      },
      {
        urlPattern: ({ request, url }) => url.origin === self.location.origin
          && ['font', 'image'].includes(request.destination),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'vocabulary-student-media-v1',
          expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] }
        }
      },
      {
        urlPattern: ({ request, url }) => url.origin === self.location.origin
          && ['script', 'style'].includes(request.destination),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'vocabulary-student-code-v1',
          expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [0, 200] }
        }
      }
    ],
    skipWaiting: true,
    sourcemap: false,
    swDest: join(outputDirectory, 'student-sw.js')
  });
  for (const warning of result.warnings) console.warn(warning);
  console.log(`Generated student service worker with ${result.count} precached files (${precacheBytes} bytes).`);
  return { ...result, version, cachePrefix, precacheBytes, precacheFiles };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateStudentServiceWorker();
}
