export const teacherFeatureIds = { teacher: '11111111-1111-4111-8111-111111111111', student: '22222222-2222-4222-8222-222222222222',
    school: '33333333-3333-4333-8333-333333333333', class: '44444444-4444-4444-8444-444444444444', subject: '55555555-5555-4555-8555-555555555555' };
const ids = teacherFeatureIds;

export async function installTeacherFeatureFixture(page) {
    const errors = [], calls = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: ids.teacher, aud: 'authenticated', role: 'authenticated', email: 'teacher@fixture.invalid', app_metadata: {}, user_metadata: {} };
    await page.addInitScript(({ ids, user }) => {
        window.SUPABASE_CONFIG = { url: 'https://teacher-feature-fixture.supabase.co', publishableKey: 'sb_publishable_fixture' };
        const encode = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
        const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ids.teacher, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
        localStorage.setItem('sparks-teacher-feature-fixture-supabase-co-teacher-auth-token', JSON.stringify({ access_token,
            refresh_token: 'fixture', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user }));
    }, { ids, user });
    const roster = [{ id: ids.student, email: 'student@fixture.invalid', studentProfile: { firstName: 'Fixture', lastName: 'Student', grade: '6', group: 'A' }, units: {} }];
    await page.route('https://teacher-feature-fixture.supabase.co/**', async route => {
        const url = new URL(route.request().url()), name = url.pathname.split('/').at(-1);
        calls.push(name); let data = [];
        if (url.pathname.startsWith('/auth/v1/')) data = name === 'user' ? user : { user };
        else if (name === 'my_school_access_v1') data = { platformAdmin: false, schools: [{ id: ids.school, name: 'Fixture school', active: true, roles: ['teacher', 'school_admin'] }] };
        else if (name === 'profiles') data = { user_id: url.searchParams.get('user_id')?.includes(ids.student) ? ids.student : ids.teacher,
            role: 'teacher', first_name: 'Fixture', last_name: 'Student', email: 'student@fixture.invalid' };
        else if (name === 'teacher_subjects') data = Number(url.searchParams.get('offset')) > 0 ? [] : [{ id: ids.subject, name: 'Technology', color: '#2563eb', sort_order: 10, active: true }];
        else if (name === 'get_school_settings_v1') data = {};
        else if (name === 'list_teaching_classes_v1') data = [{ id: ids.class, name: '6A', school_year: 2026, canTeach: true, subject: { id: ids.subject, name: 'Technology' } }];
        else if (name === 'class_roster_v1') data = [{ studentId: ids.student, name: 'Fixture Student', email: 'student@fixture.invalid', grade: '6', section: 'A' }];
        else if (name === 'list_student_identity_roster_school_v1') data = roster;
        else if (name === 'list_student_progress_summaries_school_v1') data = { items: roster, total: 1, limit: 100, offset: 0 };
        else if (name === 'list_student_roster_filters_school_v1') data = { grades: ['6'], classes: [{ grade: '6', section: 'A' }] };
        else if (name === 'get_student_progress_school_v3') data = roster[0];
        else if (name === 'teacher_student_insight_v1') data = { assignments: [] };
        await route.fulfill({ status: 200, json: data, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': '0-0/1' } });
    });
    return { errors, calls };
}
