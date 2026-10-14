export const studentFlowIds = { user: '11111111-1111-4111-8111-111111111111', school: '22222222-2222-4222-8222-222222222222',
    class: '33333333-3333-4333-8333-333333333333', assignment: '44444444-4444-4444-8444-444444444444', vocabulary: '55555555-5555-4555-8555-555555555555' };

// Only the network boundary is synthetic. The real HTML, auth, manager and activity modules run unchanged.
export async function installStudentAssignedFlowFixture(page, { startEnrolled = true } = {}) {
    const ids = studentFlowIds, calls = [], errors = [];
    const user = { id: ids.user, aud: 'authenticated', role: 'authenticated', email: 'student@fixture.invalid', app_metadata: {}, user_metadata: {} };
    const words = ['Source', 'Hoax', 'Evidence', 'Verify', 'Claim', 'Author', 'Fact', 'Opinion', 'Reliable', 'Bias'].map(word => ({ word, definition: `Meaning of ${word.toLowerCase()}`, emoji: '📘' }));
    const detail = { id: ids.assignment, kind: 'vocabulary', school_id: ids.school, materialId: ids.vocabulary,
        title: 'G9 T3 W05 - Hoaxes and Fakes', className: 'Technology 9A',
        content: { words, activitySettings: { requiredActivities: ['flashcards', 'matching', 'fill-in-blank'] } } };
    const assignment = { id: ids.assignment, class_id: ids.class, kind: 'vocabulary', title: detail.title, release_at: '2026-10-01T12:00:00Z', due_at: null, close_at: null };
    const progress = { user_id: ids.user, coins: 0, coinData: { balance: 0, giftCoins: 0, totalEarned: 0, totalSpent: 0, totalGifted: 0 }, coinHistory: [],
        studentProfile: { firstName: 'Fixture', lastName: 'Student', grade: '9', group: 'A' },
        units: { [`assignment:${ids.assignment}`]: { scores: { flashcards: { score: 100, isComplete: true, verified: true } }, states: {}, images: {}, wordHunt: {} } } };
    await page.addInitScript(({ user, ids }) => {
        window.SUPABASE_CONFIG = { url: 'https://fixture.supabase.co', publishableKey: 'sb_publishable_fixture' };
        const encode = value => btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
        const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ids.user, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
        localStorage.setItem('sparks-fixture-supabase-co-student-auth-token', JSON.stringify({ access_token, refresh_token: 'fixture', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
    }, { user, ids });
    page.on('pageerror', error => errors.push(error.message));
    let releaseRead, holdRead = false, enrolled = startEnrolled;
    await page.route('https://fixture.supabase.co/**', async route => {
        const request = route.request(), url = new URL(request.url()), name = url.pathname.split('/').at(-1), args = request.postDataJSON?.() || {};
        calls.push({ path: url.pathname, name, args, method: request.method() });
        let data = null;
        if (url.pathname.startsWith('/auth/v1/')) data = name === 'user' ? user : { user };
        else if (name === 'profiles') data = { user_id: ids.user, role: 'student', first_name: 'Fixture', last_name: 'Student', email: user.email, must_change_password: false };
        else if (name === 'class_assignments') data = Number(url.searchParams.get('offset')) > 0 ? [] : [assignment];
        else if (name === 'my_school_access_v1') data = { platformAdmin: false, schools: [{ id: ids.school, name: 'Fixture school', active: true, roles: ['student'], grade: '9', section: 'A' }] };
        else if (name === 'my_teaching_classes_v1') data = enrolled ? [{ id: ids.class, schoolId: ids.school, name: '9A', subjectName: 'Technology', schoolYear: 2026 }] : [];
        else if (name === 'my_class_invitations_v1') data = enrolled ? [] : [{ id: '77777777-7777-4777-8777-777777777777', schoolId: ids.school,
            subjectName: 'Technology', className: '9A', teacherName: 'Fixture teacher', schoolYear: 2026 }];
        else if (name === 'accept_class_invitation_v1') { enrolled = true; data = { classId: ids.class }; }
        else if (name === 'read_class_assignment_v1') { if (holdRead) await new Promise(resolve => { releaseRead = resolve; }); data = detail; }
        else if (name === 'get_own_student_progress_v2' || name === 'get_own_student_progress_summary_v2') data = progress;
        else if (name === 'get_own_arcade_time_v1') data = { seconds: 0, balance: 0 };
        else if (name === 'start_student_activity_attempt') data = { attemptId: '66666666-6666-4666-8666-666666666666', minimumSeconds: 0 };
        else if (/invitations/.test(name)) data = [];
        else if (name === 'get_school_settings_v1') data = { schoolCalendar: { schoolYear: 2026 } };
        else if (name === 'vocabularies' || name === 'subjects' || name === 'teacher_subjects' || name === 'weekly_sparks' || name === 'class_assignment_responses') data = [];
        else if (/get_|load_|list_/.test(name)) data = null;
        else if (/submit_|claim_|report_|spend_|start_/.test(name)) data = {};
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
            'access-control-expose-headers': 'content-range', 'content-type': 'application/json', 'content-range': data?.length ? `0-${data.length - 1}/${data.length}` : '0-0/0' };
        await route.fulfill({ status: 200, headers, body: JSON.stringify(data) });
    });
    return { ids, calls, errors, detail, holdReads() { holdRead = true; }, releaseRead() { holdRead = false; releaseRead?.(); }, hasPendingRead: () => Boolean(releaseRead) };
}
