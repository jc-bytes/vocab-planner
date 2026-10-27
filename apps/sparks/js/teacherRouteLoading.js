import { createClassWorkspaceLoading } from './classWorkspaceLoading.js';
import { createSchoolAdminLoading } from './schoolAdminLoading.js';
import '../css/school-admin.css';
import '../css/teacher-route-loading.css';

function node(tag, className) {
    const element = document.createElement(tag); element.className = className; return element;
}
function line(className = '') { return node('span', `school-admin-loading-line ${className}`); }
function card() {
    const tile = node('div', 'teacher-loading-card');
    tile.append(line('teacher-loading-icon'), line('teacher-loading-card-title'), line(), line('teacher-loading-card-copy'));
    return tile;
}
function table() {
    const list = node('div', 'school-admin-loading-table');
    for (let index = 0; index < 7; index++) {
        const row = node('div', 'school-admin-loading-row');
        for (let column = 0; column < 4; column++) row.append(line(column === 0 ? 'school-admin-loading-name' : 'school-admin-loading-cell'));
        list.append(row);
    }
    return list;
}
export function createTeacherRouteLoading(route) {
    const root = node('div', 'teacher-route-loading'); root.dataset.loadingPage = route.page;
    root.setAttribute('role', 'status'); root.setAttribute('aria-label', `Loading ${route.label}`);
    if (['assignments', 'review'].includes(route.page)) {
        const layout = createClassWorkspaceLoading({ section: route.assignmentId ? 'results' : route.page });
        root.setAttribute('aria-label', layout.getAttribute('aria-label')); root.append(layout); return root;
    }
    if (route.page === 'classes') {
        const layout = createClassWorkspaceLoading({ classId: route.classId, tab: route.tab, includeNavigation: Boolean(route.classId) });
        root.setAttribute('aria-label', layout.getAttribute('aria-label'));
        root.append(layout); return root;
    }
    if (['administration', 'platform'].includes(route.page)) {
        root.classList.add('school-admin', `school-admin--${route.page === 'platform' ? 'platform' : 'school'}`);
        const layout = createSchoolAdminLoading({ platform: route.page === 'platform' });
        layout.removeAttribute('role'); layout.removeAttribute('aria-label'); root.append(layout); return root;
    }
    let rows = false;
    try { rows = route.page === 'vocabulary' && JSON.parse(localStorage.getItem('teacher_vocabulary_view_modes') || '{}')[route.depth] === 'rows'; } catch { /* Cards are the default. */ }
    const body = node('div', 'teacher-route-loading-body'); body.setAttribute('aria-hidden', 'true');
    const heading = node('div', 'school-admin-loading-heading'); heading.append(line('school-admin-loading-title'), line('school-admin-loading-action'));
    body.append(heading);
    if (route.section === 'vocabulary' || route.profile || route.section === 'settings') {
        const tabs = node('div', 'school-admin-loading-tabs');
        for (let index = 0; index < 3; index++) tabs.append(line('school-admin-loading-tab'));
        body.append(tabs);
    }
    if (route.editor || route.section === 'settings') {
        const fields = node('div', 'teacher-loading-fields');
        for (let index = 0; index < 6; index++) {
            const field = node('div', 'teacher-loading-field'); field.append(line('teacher-loading-card-copy'), line('school-admin-loading-control')); fields.append(field);
        }
        body.append(fields);
    } else if (['overview', 'classes', 'vocabulary'].includes(route.section) && !route.profile && !rows) {
        const cards = node('div', 'teacher-loading-card-grid');
        for (let index = 0; index < 4; index++) cards.append(card());
        body.append(cards);
        if (route.section === 'overview') body.append(table());
    } else body.append(table());
    root.append(body); return root;
}
