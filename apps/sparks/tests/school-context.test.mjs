import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchoolContext } from '../js/services/schoolContext.js';
import { createSchoolRepository } from '../js/services/schoolRepository.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const school = (id, roles = ['teacher']) => ({ id, name: id, active: true, roles });
const storage = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };

test('changing account aborts and discards old access even if transport finishes late', async () => {
    const calls = [];
    const context = createSchoolContext({ repository: { getAccess: ({ signal }) => { const request = deferred(); calls.push({ ...request, signal }); return request.promise; } } });
    const first = context.load('a'), second = context.load('b');
    assert.equal(calls[0].signal.aborted, true);
    calls[1].resolve({ schools: [school('b-school')] }); await second;
    calls[0].resolve({ platformAdmin: true, schools: [school('a-school')] }); await first;
    assert.equal(context.getSchoolId(), 'b-school'); assert.equal(context.getAccess().platformAdmin, false);
});
test('school choice is per account, validated on refresh, and removed after revoked access', async () => {
    const local = storage(); let schools = [school('one'), school('two')];
    const context = createSchoolContext({ storage: local, repository: { getAccess: async () => ({ schools }) } });
    await context.load('a'); context.select('two');
    assert.equal(local.getItem('sparks:school:a'), 'two');
    assert.throws(() => context.select('forged'));
    context.clear(); await context.load('a'); assert.equal(context.getSchoolId(), 'two');
    schools = [school('one')]; await context.load('a'); assert.equal(context.getSchoolId(), 'one');
    schools = []; await context.load('a'); assert.equal(context.getSchoolId(), null); assert.equal(local.getItem('sparks:school:a'), undefined);
});
test('refresh removes old capabilities while loading and fails closed on error', async () => {
    let fail = false;
    const context = createSchoolContext({ repository: { getAccess: async () => { if (fail) throw new Error('offline'); return { schools: [school('one', ['school_admin'])] }; } } });
    await context.load('a'); assert.equal(context.hasRole('school_admin'), true);
    fail = true; const pending = context.load('a');
    assert.equal(context.getSchoolId(), null); assert.equal(context.hasRole('school_admin'), false);
    await assert.rejects(pending, /offline/); assert.equal(context.getAccess().schools.length, 0);
});
test('sign out prevents an in-flight load restoring the old account', async () => {
    const request = deferred(); const context = createSchoolContext({ repository: { getAccess: () => request.promise } });
    const pending = context.load('a'); context.clear(); request.resolve({ platformAdmin: true, schools: [school('one')] }); await pending;
    assert.equal(context.getAccountId(), null); assert.equal(context.getSchoolId(), null);
});
test('school selection notifies subscribers and suspended school has no teaching capability', async () => {
    const context = createSchoolContext({ repository: { getAccess: async () => ({ platformAdmin: true, schools: [school('one'), { ...school('two'), active: false }] }) } });
    await context.load('a'); let count = 0; const unsubscribe = context.subscribe(() => count++);
    const generation = context.getGeneration(); context.select('two');
    assert.equal(count, 1); assert.ok(context.getGeneration() > generation); assert.equal(context.hasRole('teacher'), false);
    unsubscribe(); context.select('one'); assert.equal(count, 1);
});
test('repository binds target school and caller-selected roles explicitly; propagates server denial', async () => {
    const calls = []; const repository = createSchoolRepository(async () => ({ rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: null, error: new Error('denied') }); } }));
    await assert.rejects(repository.setMember('school-a', 'user-b', ['teacher'], false), /denied/);
    assert.deepEqual(calls[0], { name: 'set_school_member_v1', args: { p_school_id: 'school-a', p_user_id: 'user-b', p_roles: ['teacher'], p_active: false } });
});
test('repository forwards cancellation and never dispatches an already cancelled operation', async () => {
    const controller = new AbortController(); let signal, calls = 0;
    const repository = createSchoolRepository(async () => ({ rpc() { calls++; return { abortSignal(value) { signal = value; return Promise.resolve({ data: { schools: [] }, error: null }); } }; } }));
    await repository.getAccess({ signal: controller.signal }); assert.ok(signal instanceof AbortSignal); assert.equal(signal.aborted, false);
    controller.abort(); await assert.rejects(repository.getAccess({ signal: controller.signal }), { name: 'AbortError' }); assert.equal(calls, 1);
});

test('academic years retain explicit school scope and numeric year across create and archive', async () => {
    const calls = [];
    const repository = createSchoolRepository(async () => ({ rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: [], error: null }); } }));
    await repository.listYears('school-a');
    await repository.setYear('school-a', '2027', ' Next school year ', true);
    assert.deepEqual(calls, [
        { name: 'list_school_years_v1', args: { p_school_id: 'school-a' } },
        { name: 'set_school_year_v1', args: { p_school_id: 'school-a', p_year: 2027, p_label: 'Next school year', p_archived: true } }
    ]);
});


test('new school creation requests first administrator by email with a stable retry key', async () => {
    const calls = [];
    const repository = createSchoolRepository(async () => ({ rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: { id: 'pending', active: false }, error: null }); } }));
    await repository.createSchool({ name: ' New school ', timezone: 'America/Panama', adminEmail: ' Admin@Example.org ', requestId: 'retry-key' });
    assert.deepEqual(calls, [{ name: 'create_school_with_admin_invitation_v1', args: { p_name: 'New school', p_timezone: 'America/Panama', p_admin_email: 'admin@example.org', p_request_id: 'retry-key' } }]);
});

test('member search and pagination are dispatched to the scoped server RPC', async () => {
 const calls=[]; const page={members:[],total:56,limit:25,offset:25};
 const repository=createSchoolRepository(async()=>({rpc(name,args){calls.push({name,args});return Promise.resolve({data:page,error:null});}}));
 assert.equal(await repository.listMembersPage('school-a',{search:'Jane',limit:25,offset:25}),page);
 assert.deepEqual(calls,[{name:'list_school_members_page_v1',args:{p_school_id:'school-a',p_search:'Jane',p_limit:25,p_offset:25}}]);
});


test('a failed access read preserves the school preference without retaining capabilities', async () => {
    const local = storage();
    let fail = false;
    const context = createSchoolContext({ storage: local, repository: { getAccess: async () => {
        if (fail) throw new TypeError('Failed to fetch');
        return { schools: [school('one'), school('two')] };
    } } });
    await context.load('a'); context.select('two'); fail = true;
    await assert.rejects(context.load('a'), /Failed to fetch/);
    assert.equal(context.getSchoolId(), null);
    assert.equal(context.hasRole('teacher'), false);
    assert.equal(local.getItem('sparks:school:a'), 'two');
    fail = false; await context.load('a');
    assert.equal(context.getSchoolId(), 'two');
});

test('cancelled access reads cannot restore capabilities even when the transport ignores abort', async () => {
    const request = deferred();
    const context = createSchoolContext({ repository: { getAccess: () => request.promise } });
    const controller = new AbortController();
    const pending = context.load('a', { signal: controller.signal });
    controller.abort();
    request.resolve({ schools: [school('one')] });
    await pending;
    assert.equal(context.getSchoolId(), null);
    assert.equal(context.hasRole('teacher'), false);
});
