const CACHE_PREFIX = 'vocabulary-student-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const SHELL_URL = new URL('./student.html', self.registration.scope).toString();

async function putSuccessfulResponse(cache, request, response) {
    if (response?.ok && response.type !== 'opaque') {
        await cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => fetch(SHELL_URL).then(response => putSuccessfulResponse(cache, SHELL_URL, response)))
            .catch(() => null)
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.includes('/config/')) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                return await putSuccessfulResponse(cache, request, await fetch(request));
            } catch {
                return (await cache.match(request, { ignoreSearch: true }))
                    || (await cache.match(SHELL_URL))
                    || Response.error();
            }
        })());
        return;
    }

    const isBuiltAsset = url.pathname.includes('/assets/');
    const isVocabulary = url.pathname.includes('/vocabularies/') && url.pathname.endsWith('.json');
    const isStaticAsset = ['style', 'script', 'font', 'image'].includes(request.destination);
    if (!isBuiltAsset && !isVocabulary && !isStaticAsset) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (isBuiltAsset) {
            const cached = await cache.match(request);
            if (cached) return cached;
        }

        try {
            return await putSuccessfulResponse(cache, request, await fetch(request));
        } catch {
            return (await cache.match(request)) || Response.error();
        }
    })());
});
