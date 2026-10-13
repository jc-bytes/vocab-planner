import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClassroomRepository } from '../js/services/classroomRepository.js';

function fixture({ cap = 1000, count = true, beforePage = () => {} } = {}) {
    const calls = [], tables = {}, controller = new AbortController();
    let scope = 'school-a', clientCalls = 0;
    const client = { auth: { getUser: async () => ({ data: { user: { id: 'teacher' } }, error: null }) }, from(table) {
        const call = { table, filters: [], orders: [] }; calls.push(call);
        const query = {
            select(columns, options) { call.columns = columns; call.count = options?.count; return query; },
            eq(key, value) { call.filters.push([key, value]); return query; },
            order(key, options) { call.orders.push([key, options?.ascending !== false]); return query; },
            range(start, end) { call.start = start; call.end = end; return query; },
            abortSignal(signal) { call.signal = signal; return query; },
            then(resolve, reject) { return Promise.resolve().then(() => {
                beforePage(call, { controller, setScope: value => { scope = value; } });
                let rows = (tables[table] || []).filter(row => call.filters.every(([key, value]) => row[key] === value));
                rows = rows.toSorted((a, b) => { for (const [key, asc] of call.orders) { const comparison = String(a[key]).localeCompare(String(b[key])); if (comparison) return asc ? comparison : -comparison; } return 0; });
                return { data: rows.slice(call.start, Math.min(call.end + 1, call.start + cap)), error: null,
                    count: count && call.count === 'exact' ? rows.length : null };
            }).then(resolve, reject); }
        }; return query;
    } };
    const repository = createClassroomRepository(async () => { clientCalls++; return client; }, () => scope);
    return { repository, calls, tables, controller, get clientCalls() { return clientCalls; } };
}
const rows = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(5, '0'), school_id: 'school-a', class_id: 'class-a', name: 'Same', title: 'Same', release_at: '2026-01-01', ...extra }));

test('assignments beyond 1000 survive a lower server cap, tie ordering and captured school scope', async () => {
    const f = fixture({ cap: 123, beforePage: (_call, { setScope }) => setScope('school-b') });
    f.tables.class_assignments = [...rows(1201), ...rows(2, { school_id: 'school-b' })];
    const result = await f.repository.listAssignments(undefined, { signal: f.controller.signal });
    assert.equal(result.length, 1201); assert.equal(new Set(result.map(row => row.id)).size, 1201);
    assert.equal(result[0].id, '01200'); assert.equal(result.at(-1).id, '00000');
    assert.equal(f.clientCalls, 1);
    for (const call of f.calls) {
        assert.deepEqual(call.filters, [['school_id', 'school-a']]);
        assert.deepEqual(call.orders, [['release_at', false], ['id', false]]);
        assert.equal(call.signal, f.controller.signal);
    }
    assert.equal(f.calls.filter(call => call.count === 'exact').length, 1);
});

test('class-filtered assignments and empty collections preserve array interface', async () => {
    const f = fixture(); f.tables.class_assignments = [...rows(1001), ...rows(3, { class_id: 'other' })];
    assert.equal((await f.repository.listAssignments('class-a')).length, 1001);
    assert.ok(f.calls.every(call => call.filters[0][0] === 'class_id'));
    assert.deepEqual(await f.repository.listSubjects(), []);
});

test('responses paginate by student_id rather than a nonexistent id and tolerate absent count', async () => {
    const f = fixture({ cap: 100, count: false });
    f.tables.class_assignment_responses = rows(1001).map(({ id }) => ({ student_id: id, assignment_id: 'assignment', submitted_at: '2026-01-01' }));
    const result = await f.repository.listResponses('assignment');
    assert.equal(result.length, 1001); assert.equal(result.at(-1).student_id, '01000');
    assert.ok(f.calls.every(call => JSON.stringify(call.orders) === JSON.stringify([['submitted_at', true], ['student_id', true]])));
});

test('materials and subjects return complete scoped collections with stable ties', async () => {
    const f = fixture(); for (const table of ['teacher_subjects', 'vocabularies', 'weekly_sparks']) f.tables[table] = rows(1001);
    assert.equal((await f.repository.listSubjects()).length, 1001);
    const materials = await f.repository.listOwnMaterials({ signal: f.controller.signal });
    assert.equal(materials.length, 2002); assert.equal(materials[0].kind, 'vocabulary'); assert.equal(materials[1001].kind, 'spark');
    assert.ok(f.calls.every(call => call.orders.at(-1)[0] === 'id'));
});

test('pre-aborted reads do not initialize the client', async () => {
    for (const method of ['listSubjects', 'listOwnMaterials', 'listAssignments', 'listResponses']) {
        const f = fixture(); f.controller.abort();
        const args = method === 'listAssignments' || method === 'listResponses' ? ['x', { signal: f.controller.signal }] : [{ signal: f.controller.signal }];
        await assert.rejects(f.repository[method](...args), { name: 'AbortError' }); assert.equal(f.clientCalls, 0);
    }
});

test('later-page cancellation rejects instead of returning partial results', async () => {
    const f = fixture({ beforePage: (call, { controller }) => { if (call.start > 0) controller.abort(); } });
    f.tables.class_assignments = rows(1200);
    await assert.rejects(f.repository.listAssignments(undefined, { signal: f.controller.signal }), { name: 'AbortError' });
    assert.equal(f.calls.length, 2);
});

test('later-page failures reject instead of returning partial results', async () => {
    const failure = new Error('Page failed');
    const f = fixture({ beforePage: call => { if (call.start > 0) throw failure; } }); f.tables.class_assignments = rows(1200);
    await assert.rejects(f.repository.listAssignments(), error => error === failure);
});

test('assignment repository is loaded only inside the optional student assignment branch', async () => {
    const source = await readFile(new URL('../js/student/studentActivityVocabularyDataMethods.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /^import .*classroomRepository.*from/m);
    assert.match(source, /if \(vocabMeta.assignmentId\) \{\s*try \{\s*const \{ classroomRepository, assignmentVocabulary \} = await import\('\.\.\/services\/classroomRepository.js'\);\s*if \(!isCurrentLoad\(\)\) return;\s*const detail = await classroomRepository.readAssignment/);
});
