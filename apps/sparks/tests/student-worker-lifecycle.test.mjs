import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { collectStudentPrecacheFiles } from '../scripts/student-precache.mjs';

const source = await readFile(new URL('../js/student/studentWorkerLifecycle.js', import.meta.url), 'utf8');
const scope = 'https://school.test/sparks/';
const graph = version => `vocabulary-student-graph-${version}-precache-v2-${scope}`;
const legacy = `vocabulary-student-precache-v2-${scope}`;
function harness({ locks = true } = {}) {
    const stores = new Map();
    let now = 10000;
    let clients = [];
    let beforeDelete;
    let lockTail = Promise.resolve();
    const lockManager = { request(_name, callback) { const task = lockTail.then(callback); lockTail = task.catch(() => {}); return task; } };
    const caches = {
        async keys() { return [...stores.keys()]; },
        async delete(name) { await beforeDelete?.(name); return stores.delete(name); },
        async open(name) {
            if (!stores.has(name)) stores.set(name, new Map());
            const values = stores.get(name);
            return {
                async put(request, response) { values.set(typeof request === 'string' ? request : request.url, response.clone()); },
                async keys() { return [...values.keys()].map(url => new Request(url)); },
                async delete(request) { return values.delete(typeof request === 'string' ? request : request.url); },
                async match(request, options = {}) {
                    const url = request.url || String(request);
                    const key = options.ignoreSearch ? [...values.keys()].find(key => key.split('?')[0] === url.split('?')[0]) : url;
                    return values.get(key)?.clone();
                }
            };
        },
        async match(request, options) {
            if (!stores.has(options.cacheName)) return undefined;
            return (await this.open(options.cacheName)).match(request, options);
        }
    };
    function worker(version) {
        const listeners = new Map();
        const self = {
            registration: { scope },
            navigator: locks ? { locks: lockManager } : {},
            clients: { matchAll: async () => clients },
            addEventListener(name, listener) { listeners.set(name, listener); }
        };
        runInNewContext(source, { self, caches, URL, Response, Date: { now: () => now }, console, fetch: async request => new Response(`network:${request.url}`) });
        self.installStudentWorkerLifecycle({ cachePrefix: `vocabulary-student-graph-${version}`, navigationGraceMs: 100, cleanupIntervalMs: 0 });
        async function dispatch(name, properties = {}) {
            const tasks = [];
            let response;
            listeners.get(name)({ ...properties, stopImmediatePropagation() {}, respondWith(task) { response = task; }, waitUntil: task => tasks.push(task) });
            await Promise.all(tasks);
            return response;
        }
        return { api: self.studentWorkerLifecycle, activate: async () => { await (await caches.open(graph(version))).put(scope + 'student.html?__WB_REVISION__=' + version, new Response('HTML-' + version)); await dispatch('activate'); },
            navigate: (id, clientId = '') => dispatch('fetch', { request: { mode: 'navigate', url: scope + 'student.html' }, resultingClientId: id, clientId }) };
    }
    return { caches, worker, beforeDelete: callback => { beforeDelete = callback; }, clients: value => { clients = value; }, advance: value => { now += value; },
        async records() {
            const metadata = await caches.open(`vocabulary-student-versions-${scope}`);
            return Promise.all((await metadata.keys()).filter(key => key.url.includes('/clients/')).map(async key => (await metadata.match(key)).json()));
        }
    };
}

test('offline graph follows dynamic code and styles without teacher code or lazy media', () => {
    const manifest = {
        student: { file: 'assets/student.js', imports: ['shared'], dynamicImports: ['game'] },
        shared: { file: 'assets/shared.js' },
        game: { file: 'assets/game.js', css: ['assets/game.css'], assets: ['huge-game.webp'], dynamicImports: ['student'] },
        teacher: { file: 'assets/teacher.js' }
    };
    assert.deepEqual([...collectStudentPrecacheFiles(manifest, 'student')].sort(), ['assets/game.css', 'assets/game.js', 'assets/shared.js', 'assets/student.js', 'student.html']);
    assert.throws(() => collectStudentPrecacheFiles({ student: { file: 'student.js', dynamicImports: ['missing'] } }, 'student'), /missing/);
});

test('legacy clients pin once, resulting navigation IDs bind current HTML, and old workers respect the latest graph', async () => {
    const h = harness(); await h.caches.open(legacy);
    h.clients([{ id: 'old', url: scope + 'student.html#/sparks' }]);
    const b = h.worker('B'); await h.caches.open(graph('B')); await b.activate();
    await b.navigate('new', 'old');
    const records = await h.records();
    assert.deepEqual(records.find(row => row.id === 'old').caches, [legacy, graph('B')]);
    assert.deepEqual(records.find(row => row.id === 'new').caches, [graph('B')]);
    h.clients([{ id: 'old', url: scope + 'student.html' }, { id: 'new', url: scope + 'student.html' }]);
    const c = h.worker('C'); await h.caches.open(graph('C')); await c.activate();
    assert.deepEqual((await h.records()).find(row => row.id === 'old').caches, [legacy, graph('B')]);
    await h.caches.open(graph('installing-D'));
    h.clients([]); h.advance(101); await b.api.cleanup({ force: true });
    assert.deepEqual((await h.caches.keys()).filter(name => name.includes('precache')), [graph('C'), graph('installing-D')]);
});

test('pending navigation protects its old graph until the new client appears or the grace expires', async () => {
    const h = harness(); const a = h.worker('A'); await h.caches.open(graph('A')); await a.activate();
    await a.navigate('pending');
    const b = h.worker('B'); await h.caches.open(graph('B')); await b.activate();
    assert.ok((await h.caches.keys()).includes(graph('A')));
    h.clients([{ id: 'pending', url: scope + 'student.html' }]); h.advance(101);
    await b.api.cleanup({ force: true }); assert.ok((await h.caches.keys()).includes(graph('A')));
    h.clients([]); await b.api.cleanup({ force: true }); assert.ok(!(await h.caches.keys()).includes(graph('A')));
});

test('retained code matches the original hashed path with Workbox revisions, never another hash', async () => {
    const h = harness(); h.clients([{ id: 'old', url: scope + 'student.html' }]);
    const a = h.worker('A'); const cache = await h.caches.open(graph('A'));
    await cache.put(scope + 'assets/classroom-A.js?__WB_REVISION__=abc', new Response('original code'));
    await a.activate(); const b = h.worker('B'); await h.caches.open(graph('B')); await b.activate();
    assert.equal(await (await b.api.findRetainedCode(new Request(scope + 'assets/classroom-A.js?offline-proof'))).text(), 'original code');
    assert.equal(await b.api.findRetainedCode(new Request(scope + 'assets/classroom-X.js')), undefined);
    const runtime = await h.caches.open('vocabulary-student-code-v1');
    await runtime.put(scope + 'assets/legacy-visited.js', new Response('visited legacy code'));
    assert.equal(await b.api.findRetainedCode(new Request(scope + 'assets/legacy-visited.js')), undefined, 'Workbox owns runtime cache reads and writes');
});


test('GC-first navigation serves the latest cached HTML instead of leasing an already deleted graph', async () => {
    const h = harness(); const a = h.worker('A'); await a.activate();
    const b = h.worker('B'); await b.activate(); h.advance(101);
    let deleting, release;
    const paused = new Promise(resolve => { deleting = resolve; });
    const resumed = new Promise(resolve => { release = resolve; });
    h.beforeDelete(async name => { if (name === graph('A')) { deleting(); await resumed; } });
    // A was pruned by B's activation, so seed a tracked graph to exercise the barrier.
    await h.caches.open(graph('A'));
    const metadata = await h.caches.open(`vocabulary-student-versions-${scope}`);
    await metadata.put(scope + '__sparks_worker__/graphs/' + encodeURIComponent(graph('A')), new Response(JSON.stringify({ cache: graph('A') })));
    const cleaning = b.api.cleanup({ force: true }); await paused;
    const navigating = a.navigate('pending-new', 'initiator');
    release(); await cleaning;
    assert.equal(await (await navigating).text(), 'HTML-B');
    assert.deepEqual((await h.records()).find(row => row.id === 'pending-new').caches, [graph('B')]);
});

test('lease-first navigation retains the HTML graph through later eviction and no-lock browsers retain conservatively', async () => {
    const h = harness(); const a = h.worker('A'); await a.activate();
    assert.equal(await (await a.navigate('pending')).text(), 'HTML-A');
    const b = h.worker('B'); await b.activate();
    assert.ok((await h.caches.keys()).includes(graph('A')));
    const old = harness({ locks: false }); await old.worker('A').activate(); await old.worker('B').activate();
    old.advance(1000); await old.worker('B').api.cleanup({ force: true });
    assert.ok((await old.caches.keys()).includes(graph('A')), 'Without cross-worker locks, deleting retained code is unsafe');
});
