import '../css/school-admin-loading.css';

function node(tag, className) {
    const element = document.createElement(tag);
    element.className = className;
    return element;
}

export function createSchoolAdminLoading({ platform = false, section = '', toolbar } = {}) {
    const skeleton = node('div', 'school-admin-loading');
    skeleton.setAttribute('role', 'status');
    skeleton.setAttribute('aria-label', platform ? 'Loading platform administration' : 'Loading school settings');
    const line = className => node('span', `school-admin-loading-line ${className}`);
    const navigationRow = node('div', 'school-admin-navigation-row');
    const tabs = node('div', 'school-admin-navigation school-admin-loading-tabs');
    tabs.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < (platform ? 3 : 4); index++) tabs.append(line('school-admin-loading-tab'));
    navigationRow.append(tabs);
    navigationRow.append(toolbar || line('school-admin-loading-action'));
    const body = node('div', 'school-admin-loading-body');
    body.setAttribute('aria-hidden', 'true');
    const heading = node('div', 'school-admin-loading-heading');
    heading.append(line('school-admin-loading-title'));
    if (!platform && (!section || section === 'members')) {
        const filters = node('div', 'school-admin-loading-filters');
        for (let index = 0; index < 3; index++) filters.append(line('school-admin-loading-control'));
        body.append(heading, filters);
    } else {
        heading.append(line('school-admin-loading-action'));
        body.append(heading);
    }
    const table = node('div', 'school-admin-loading-table');
    table.classList.toggle('school-admin-loading-table--members', !platform && (!section || section === 'members'));
    const columns = table.classList.contains('school-admin-loading-table--members') ? 6 : 4;
    for (let row = 0; row < (platform ? 7 : 11); row++) {
        const cells = node('div', `school-admin-loading-row${row === 0 ? ' school-admin-loading-row--header' : ''}`);
        for (let column = 0; column < columns; column++) cells.append(line(column === 0 ? 'school-admin-loading-name' : 'school-admin-loading-cell'));
        table.append(cells);
    }
    const pagination = node('div', 'school-admin-loading-pagination');
    pagination.append(line('school-admin-loading-control'), line('school-admin-loading-count'));
    body.append(table, pagination); skeleton.append(navigationRow, body);
    return skeleton;
}
