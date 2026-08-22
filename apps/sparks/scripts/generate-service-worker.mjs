import { generateSW } from 'workbox-build';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('dist-desktop/.vite/manifest.json', 'utf8'));
const studentEntryKey = Object.keys(manifest).find(key => manifest[key].isEntry && manifest[key].src === 'student.html');
if (!studentEntryKey) throw new Error('The Vite manifest does not contain the student entry.');

const precacheFiles = new Set(['student.html', 'vocabularies/manifest.json']);
const visitedChunks = new Set();

function collectStudentChunk(key) {
  if (!key || visitedChunks.has(key)) return;
  visitedChunks.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  if (chunk.file) precacheFiles.add(chunk.file);
  (chunk.css || []).forEach(file => precacheFiles.add(file));
  (chunk.assets || []).forEach(file => precacheFiles.add(file));
  (chunk.imports || []).forEach(collectStudentChunk);
  (chunk.dynamicImports || [])
    .filter(dynamicKey => !String(manifest[dynamicKey]?.file || '').includes('reportGenerator-'))
    .forEach(collectStudentChunk);
}

collectStudentChunk(studentEntryKey);

let precacheBytes = 0;
const additionalManifestEntries = await Promise.all(Array.from(precacheFiles).sort().map(async url => {
  const contents = await readFile(`dist-desktop/${url}`);
  precacheBytes += contents.byteLength;
  return {
    url,
    revision: createHash('sha256').update(contents).digest('hex').slice(0, 16)
  };
}));

const { count, size, warnings } = await generateSW({
  cacheId: 'vocabulary-student',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  globDirectory: 'dist-desktop',
  globPatterns: [],
  additionalManifestEntries,
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  navigateFallback: 'student.html',
  navigateFallbackAllowlist: [/\/student(?:\.html)?$/],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.origin === self.location.origin
        && url.pathname.includes('/vocabularies/')
        && url.pathname.endsWith('.json'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'vocabulary-student-vocabulary-v1',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 250,
          maxAgeSeconds: 30 * 24 * 60 * 60
        },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    {
      urlPattern: ({ request, url }) => url.origin === self.location.origin
        && ['font', 'image'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'vocabulary-student-media-v1',
        expiration: {
          maxEntries: 120,
          maxAgeSeconds: 30 * 24 * 60 * 60
        },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    {
      urlPattern: ({ request, url }) => url.origin === self.location.origin
        && ['script', 'style'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'vocabulary-student-code-v1',
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 30 * 24 * 60 * 60
        },
        cacheableResponse: { statuses: [0, 200] }
      }
    }
  ],
  skipWaiting: true,
  sourcemap: false,
  swDest: 'dist-desktop/student-sw.js'
});

for (const warning of warnings) console.warn(warning);
console.log(`Generated student service worker with ${count} precached files (${precacheBytes || size} bytes).`);
