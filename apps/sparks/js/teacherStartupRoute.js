export function getTeacherStartupRoute(hash = '') {
    const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
    const parts = path.split('/');
    const page = parts[0] === 'teacher' ? parts[1] || 'overview' : 'overview';
    const params = new URLSearchParams(query);
    const library = ['vocabulary', 'sparks', 'quizzes', 'word-hunt'].includes(page);
    let section = library ? 'vocabulary' : ['students', 'groups'].includes(page) ? 'students'
        : ['settings', 'data-settings'].includes(page) ? 'settings'
        : ['administration', 'platform', 'classes', 'assignments', 'review'].includes(page) ? page : 'overview';
    if (['settings', 'data-settings', 'data'].includes(page) && params.get('tab') === 'export') section = 'assignments';
    if (page === 'classes' && params.get('tab') === 'students') section = 'students';
    if (['settings','data-settings'].includes(page) && params.get('tab') === 'calendar') section = 'administration';
    if (section === 'review') section = 'assignments';
    return {
        section,
        page,
        ...(['classes', 'students'].includes(page) ? { classId: params.get('class') || null, tab: page === 'students' || params.get('tab') === 'students' ? 'students' : 'work' } : {}),
        ...(['assignments','review'].includes(page) ? { assignmentId: params.get('assignment') || null } : {}),
        editor: parts[2] === 'editor',
        profile: page === 'students' && Boolean(parts[2]),
        depth: params.get('month') ? 'month' : params.get('trimester') ? 'trimester' : params.get('grade') ? 'grade' : params.get('subject') ? 'subject' : 'root',
        label: ({ administration: 'School settings', platform: 'Platform', classes: 'Classwork', students: 'Students', vocabulary: 'Library', assignments: 'Assignments', review: 'Review', settings: 'Settings', overview: 'Home' })[section]
    };
}
