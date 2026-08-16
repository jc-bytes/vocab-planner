import { generateSW } from 'workbox-build';

const { count, size, warnings } = await generateSW({
  cacheId: 'vocabulary-student',
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  globDirectory: 'dist-desktop',
  globIgnores: ['student-sw.js'],
  globPatterns: [
    'student.html',
    'assets/**/*.{css,js,woff,woff2}'
  ],
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
    }
  ],
  skipWaiting: true,
  sourcemap: false,
  swDest: 'dist-desktop/student-sw.js'
});

for (const warning of warnings) console.warn(warning);
console.log(`Generated student service worker with ${count} precached files (${size} bytes).`);
