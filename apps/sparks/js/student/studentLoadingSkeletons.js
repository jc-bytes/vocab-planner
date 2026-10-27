function escapeAttribute(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function getStudentPageSkeleton(kind = 'activity', label = 'Loading', options = {}) {
    const id = kind === 'dashboard' ? 'student-dashboard-loading-template' : `student-loading-${kind}-template`;
    const template = globalThis.document?.getElementById(id) || globalThis.document?.getElementById('student-loading-activity-template');
    return (template?.innerHTML || '<div class="student-page-skeleton" role="status" aria-label="Loading"><span class="student-loading-line student-loading-list-row"></span></div>').replace('aria-label="Loading"', `aria-label="${escapeAttribute(label)}"`)
        .replace('data-loading-layout=""', `data-loading-layout="${escapeAttribute(options.activityType || '')}"`);
}

export function getStudentRouteLoadingSkeleton(hash = '') {
    const path = hash.replace(/^#\/?/, '').split('?')[0];
    const type = path.split('/activity/')[1]?.split('/')[0];
    const kind = type ? 'activity' : path.startsWith('unit/') ? 'unit' : path === 'units' ? (hash.includes('month=') ? 'units' : 'months') : path === 'sparks' ? (hash.includes('spark=') ? 'sparks' : hash.includes('month=') ? 'units' : 'months') : path === 'arcade' ? 'arcade' : 'dashboard';
    let layout = kind;
    try { if (path === 'units' && localStorage.getItem('student_vocabulary_view_mode') === 'rows') layout = hash.includes('month=') ? 'rows' : 'month-rows'; } catch {}
    return getStudentPageSkeleton(layout, 'Loading student screen', { activityType: type });
}

export function setStudentPageLoading(view, loading) {
    if (!view) return;
    view.classList.toggle('student-page-loading', Boolean(loading));
    view.setAttribute('aria-busy', loading ? 'true' : 'false');
}
