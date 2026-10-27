import { getTeacherStartupRoute } from './teacherStartupRoute.js';

const shell = document.getElementById('teacher-tab-shell');
const app = shell?.closest('.app-container');
const loading = document.getElementById('teacher-loading-view');
const hintKey = 'teacher_session_reserved';
const sectionsKey = 'teacher_sidebar_sections';

function highlightRoute() {
    const route = getTeacherStartupRoute(location.hash);
    shell.querySelectorAll('.teacher-tab').forEach(tab => {
        const active = tab.dataset.section === route.section;
        tab.classList.toggle('active', active);
        tab.classList.toggle('primary-nav__item--active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active) tab.hidden = false;
    });
    for (const id of ['teacher-mobile-section-label', 'teacher-top-bar-section']) {
        const label = document.getElementById(id);
        if (label) label.textContent = route.label;
    }
    return route;
}

function releaseShell() {
    delete shell.dataset.sessionReserved;
    shell.inert = false;
    shell.removeAttribute('aria-hidden');
    app?.classList.remove('teacher-session-restoring');
    loading?.removeAttribute('aria-busy');
}

if (shell) {
    document.addEventListener('teacher-shell-view', ({ detail }) => {
        const login = detail.viewId === 'teacher-login-view';
        const pending = detail.viewId === 'teacher-loading-view';
        if (pending && shell.dataset.sessionReserved === 'true') {
            shell.classList.remove('hidden');
            highlightRoute();
            loading?.removeAttribute('aria-busy');
            return;
        }
        releaseShell();
        try {
            if (login) {
                localStorage.setItem(hintKey, 'false');
                localStorage.removeItem(sectionsKey);
            } else if (!pending && detail.authenticated) {
                localStorage.setItem(hintKey, 'true');
                localStorage.setItem(sectionsKey, JSON.stringify([...shell.querySelectorAll('.teacher-tab')]
                    .filter(tab => !tab.hidden && !tab.classList.contains('hidden')).map(tab => tab.dataset.section)));
            }
        } catch { /* Browser storage is optional. */ }
    });
    try {
        const hint = localStorage.getItem(hintKey);
        const returning = hint === 'true' || (hint === null && localStorage.getItem('was_logged_in') === 'true');
        if (localStorage.getItem('teacher_sidebar_collapsed') === 'true') app?.classList.add('teacher-sidebar-collapsed');
        if (returning && loading?.classList.contains('active') && !loading.classList.contains('hidden')) {
            let sections;
            try { sections = JSON.parse(localStorage.getItem(sectionsKey)); } catch { /* Use the static menu. */ }
            if (Array.isArray(sections) && sections.includes('classes') && !sections.includes('students')) sections.push('students');
            if (Array.isArray(sections)) shell.querySelectorAll('.teacher-tab').forEach(tab => { tab.hidden = !sections.includes(tab.dataset.section); });
            const route = highlightRoute();
            shell.classList.remove('hidden');
            shell.dataset.sessionReserved = 'true';
            shell.inert = true;
            shell.setAttribute('aria-hidden', 'true');
            app?.classList.add('teacher-session-restoring');
            const status = document.getElementById('teacher-cloud-status');
            if (status) {
                status.dataset.state = 'pending'; status.title = 'Loading saved session';
                status.setAttribute('aria-label', 'Loading saved session');
            }
            loading.setAttribute('aria-busy', 'true');
            const placeholder = loading.firstElementChild;
            void import('./teacherRouteLoading.js').then(({ createTeacherRouteLoading }) => {
                if (shell.dataset.sessionReserved === 'true' && loading.classList.contains('active') && loading.firstElementChild === placeholder) {
                    loading.replaceChildren(createTeacherRouteLoading(route));
                }
            }).catch(error => console.warn('Teacher loading layout unavailable:', error));
        }
    } catch { /* Session checks still run when browser storage is unavailable. */ }
    const activeView = document.querySelector('.teacher-main > .view.active:not(.hidden)');
    if (activeView && activeView.id !== 'teacher-loading-view') {
        document.dispatchEvent(new CustomEvent('teacher-shell-view', { detail: { viewId: activeView.id, authenticated: window.teacherApp?.isAuthenticated } }));
    }
}
