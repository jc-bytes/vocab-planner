// Classic worker script, loaded only by the generated service worker.
// Each document leases the code graph of the HTML it received, across upgrades.
self.installStudentWorkerLifecycle = function ({ cachePrefix, navigationGraceMs = 30000, cleanupIntervalMs = 60000 }) {
    const scope = self.registration.scope;
    const scopeURL = new URL(scope);
    const currentCache = `${cachePrefix}-precache-v2-${scope}`;
    const metadataName = `vocabulary-student-versions-${scope}`;
    const metadataRoot = new URL('__sparks_worker__/', scope).href;
    const urlFor = key => metadataRoot + key;
    const isStudent = url => {
        const parsed = new URL(url);
        return parsed.origin === scopeURL.origin && parsed.pathname.startsWith(scopeURL.pathname)
            && /\/student(?:\.html)?$/.test(parsed.pathname);
    };
    const read = async key => {
        const response = await (await caches.open(metadataName)).match(urlFor(key));
        return response ? response.json() : null;
    };
    const write = async (key, value) => (await caches.open(metadataName)).put(urlFor(key), new Response(JSON.stringify(value)));
    const entries = async (metadata, kind) => (await metadata.keys()).filter(request => request.url.startsWith(urlFor(`${kind}/`)));
    const locks = self.navigator?.locks;
    const withMetadata = callback => locks ? locks.request(metadataName, callback) : callback();
    let cleaning;
    let lastCleanupAt = 0;

    async function cleanupUnlocked({ force = false } = {}) {
        // Legacy browsers without cross-worker locks retain code conservatively.
        // Current evergreen browsers serialize navigation responses and eviction.
        if (!locks || !force && Date.now() - lastCleanupAt < cleanupIntervalMs) return;
        lastCleanupAt = Date.now();
        const metadata = await caches.open(metadataName);
        // Snapshot activated graphs first, then read the latest current marker.
        // Installing/waiting graph caches are never cleanup candidates.
        const graphs = await entries(metadata, 'graphs');
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const liveIds = new Set(clients.map(client => client.id));
        const latest = await read('current');
        const keep = new Set(latest ? [latest] : []);
        for (const request of await entries(metadata, 'clients')) {
            const record = await (await metadata.match(request)).json();
            if (liveIds.has(record.id) || Date.now() - record.createdAt < navigationGraceMs) {
                for (const name of record.caches) keep.add(name);
            } else {
                await metadata.delete(request);
            }
        }
        for (const request of graphs) {
            const record = await (await metadata.match(request))?.json();
            if (!record || keep.has(record.cache) || record.cache === await read('current')) continue;
            await caches.delete(record.cache);
            await metadata.delete(request);
        }
    }

    function cleanup(options) {
        if (!cleaning) cleaning = withMetadata(() => cleanupUnlocked(options)).finally(() => { cleaning = null; });
        return cleaning;
    }

    self.addEventListener('activate', event => event.waitUntil(withMetadata(async () => {
        const metadata = await caches.open(metadataName);
        const existing = [];
        for (const request of await entries(metadata, 'graphs')) {
            existing.push((await (await metadata.match(request)).json()).cache);
        }
        // Adopt the previously shipped Workbox shell once. Its uncached optional
        // files cannot be recovered after a deployment removes them.
        const legacy = `vocabulary-student-precache-v2-${scope}`;
        if ((await caches.keys()).includes(legacy)) {
            existing.push(legacy);
            await write(`graphs/${encodeURIComponent(legacy)}`, { cache: legacy });
        }
        const previous = await read('current');
        if (previous) existing.push(previous);
        const initial = [...new Set([...existing, currentCache])];
        for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
            if (!isStudent(client.url) || await read(`clients/${encodeURIComponent(client.id)}`)) continue;
            // Unknown legacy clients are pinned once; never repin them to every
            // later release while a classroom tab stays open.
            await write(`clients/${encodeURIComponent(client.id)}`, { id: client.id, caches: initial, createdAt: Date.now() });
        }
        await write('current', currentCache);
        await write(`graphs/${encodeURIComponent(currentCache)}`, { cache: currentCache });
        await cleanupUnlocked({ force: true });
    })));

    async function handleNavigation(event) {
        return withMetadata(async () => {
            const latest = await read('current');
            for (const name of [...new Set([currentCache, latest].filter(Boolean))]) {
                const response = await caches.match(new URL('student.html', scope), { cacheName: name, ignoreSearch: true });
                if (!response) continue;
                if (event.resultingClientId) {
                    // Bind the document receiving this HTML, never its initiator.
                    await write(`clients/${encodeURIComponent(event.resultingClientId)}`, {
                        id: event.resultingClientId, caches: [name], createdAt: Date.now()
                    });
                }
                return response;
            }
            return fetch(event.request);
        });
    }

    self.addEventListener('fetch', event => {
        const navigation = event.request.mode === 'navigate' && isStudent(event.request.url);
        if (navigation) {
            // importScripts runs before Workbox registers its fetch router. Own
            // this navigation once so HTML selection and its lease are atomic.
            event.stopImmediatePropagation();
            const response = handleNavigation(event);
            event.respondWith(response);
            event.waitUntil(response.then(() => cleanup({ force: true }))
                .catch(error => console.warn('Student code cache cleanup postponed:', error)));
            return;
        }
        event.waitUntil(cleanup().catch(error => console.warn('Student code cache cleanup postponed:', error)));
    });

    self.studentWorkerLifecycle = {
        cleanup,
        async findRetainedCode(request) {
            const metadata = await caches.open(metadataName);
            for (const key of await entries(metadata, 'graphs')) {
                const record = await (await metadata.match(key))?.json();
                if (!record) continue;
                // CacheStorage.match does not recreate a cache concurrently deleted
                // by cleanup. Ignore only Workbox's revision query, never the hash.
                const hit = await caches.match(request, { cacheName: record.cache, ignoreSearch: true });
                if (hit) return hit;
            }
            return undefined;
        }
    };
};
