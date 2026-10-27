import test from 'node:test';
import assert from 'node:assert/strict';
import { sparksRepository } from '../js/services/sparksRepository.js';
import { supabaseService } from '../js/supabaseService.js';
import { schoolContext } from '../js/services/schoolContext.js';

async function fixture(run, { cap = 123, count = true, beforePage = () => {}, afterInit = () => {} } = {}) {
    const originalInit = supabaseService.init, originalClient = supabaseService.getClient;
    const calls = [], controller = new AbortController();
    let initCalls = 0;
    const rows = Array.from({ length: 1201 }, (_, index) => ({
        id: String(index).padStart(5, '0'), school_id: 'school-a', title: 'Same title'
    }));
    const client = { rpc() { return { abortSignal: async () => ({ data: { schools: [
        { id: 'school-a', roles: ['teacher'] }, { id: 'school-b', roles: ['teacher'] }
    ] }, error: null }) }; }, from(table) {
        const call = { table, filters: [], orders: [], start: 0, end: 999 }; calls.push(call);
        const query = {
            select(columns, options) { call.columns = columns; call.count = options?.count; return query; },
            eq(key, value) { call.filters.push([key, value]); return query; },
            order(key, options) { call.orders.push([key, options?.ascending !== false]); return query; },
            range(start, end) { call.start = start; call.end = end; return query; },
            abortSignal(signal) { call.signal = signal; return query; },
            then(resolve, reject) { return Promise.resolve().then(() => {
                const error = beforePage(call, controller);
                return { data: rows.slice(call.start, Math.min(call.end + 1, call.start + cap)), error,
                    count: count && call.count === 'exact' ? rows.length : null };
            }).then(resolve, reject); }
        };
        return query;
    } };
    supabaseService.init = async () => supabaseService;
    supabaseService.getClient = () => client;
    try {
        await schoolContext.load('pagination-teacher');
        supabaseService.init = async () => { initCalls++; afterInit(controller); return supabaseService; };
        await run({ calls, controller, rows, get initCalls() { return initCalls; } });
    } finally {
        schoolContext.clear();
        supabaseService.init = originalInit;
        supabaseService.getClient = originalClient;
    }
}

test('teacher Sparks returns over 1000 rows despite a lower server cap and keeps original school', async () => {
    await fixture(async f => {
        const result = await sparksRepository.list({ signal: f.controller.signal });
        assert.equal(result.length, 1201);
        assert.equal(new Set(result.map(row => row.id)).size, 1201);
        assert.equal(f.initCalls, 1);
        assert.equal(f.calls.filter(call => call.count === 'exact').length, 1);
        for (const call of f.calls) {
            assert.equal(call.table, 'weekly_sparks');
            assert.deepEqual(call.filters, [['school_id', 'school-a']]);
            assert.deepEqual(call.orders, [['id', true]]);
            assert.ok(call.signal instanceof AbortSignal);
            assert.equal(call.signal.aborted, false);
        }
    }, { afterInit: () => { schoolContext.select('school-b'); } });
});

test('teacher Sparks continues until empty when count is unavailable', async () => {
    await fixture(async f => {
        assert.equal((await sparksRepository.list()).length, 1201);
        assert.equal(f.calls.at(-1).start, 1201);
    }, { count: false });
});

test('later-page server errors reject instead of returning partial Sparks', async () => {
    const failure = new Error('Second page unavailable');
    await fixture(async f => {
        await assert.rejects(sparksRepository.list(), error => error === failure);
        assert.equal(f.calls.length, 2);
    }, { beforePage: call => call.start > 0 ? failure : null });
});

test('pre-aborted Sparks reads do not initialize or query', async () => {
    await fixture(async f => {
        f.controller.abort();
        await assert.rejects(sparksRepository.list({ signal: f.controller.signal }), { name: 'AbortError' });
        assert.equal(f.initCalls, 0);
        assert.equal(f.calls.length, 0);
    });
});

test('cancellation during initialization prevents a Sparks query', async () => {
    await fixture(async f => {
        await assert.rejects(sparksRepository.list({ signal: f.controller.signal }), { name: 'AbortError' });
        assert.equal(f.calls.length, 0);
    }, { afterInit: controller => controller.abort() });
});

test('cancellation during a later page rejects instead of returning partial Sparks', async () => {
    await fixture(async f => {
        await assert.rejects(sparksRepository.list({ signal: f.controller.signal }), { name: 'AbortError' });
        assert.equal(f.calls.length, 2);
    }, { beforePage: (call, controller) => { if (call.start > 0) controller.abort(); } });
});
