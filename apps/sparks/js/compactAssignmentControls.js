export const assignmentSortOptions = [['release-desc', 'Newest available'], ['release-asc', 'Oldest available'], ['title-asc', 'Title A–Z'], ['title-desc', 'Title Z–A'], ['due-asc', 'Due soonest']];
export const assignmentStatusOptions = [['all', 'All statuses'], ...['Available', 'Scheduled', 'Closed', 'Withdrawn'].map(value => [value, value])];
export const assignmentTypeOptions = [['all', 'All types'], ['vocabulary', 'Vocabulary'], ['spark', 'Spark']];
export function compactFilter(parent, label, options, ariaLabel = label) {
    const wrapper = document.createElement('label'); wrapper.className = 'compact-table-filter';
    const caption = document.createElement('span'); caption.textContent = label;
    const control = document.createElement('select'); control.setAttribute('aria-label', ariaLabel);
    for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option); }
    wrapper.append(caption, control); parent.append(wrapper); return control;
}
export function sortAssignments(rows, order) {
    const date = value => { const time = new Date(value).getTime(); return value && Number.isFinite(time) ? time : null; };
    return [...rows].sort((a, b) => {
        const byTitle = String(a.title || '').localeCompare(String(b.title || ''), undefined, {numeric:true});
        if (order.startsWith('title-')) return order === 'title-desc' ? -byTitle : byTitle;
        const key = order.startsWith('due-') ? 'due_at' : 'release_at';
        const left = date(a[key]), right = date(b[key]);
        if (left === null || right === null) return left === right ? byTitle : left === null ? 1 : -1;
        return (order.endsWith('-desc') ? right - left : left - right) || byTitle;
    });
}

export function assignmentDate(value) {
    return value && Number.isFinite(new Date(value).getTime())
        ? new Date(value).toLocaleString(undefined, {dateStyle:'medium',timeStyle:'short'}) : '—';
}

export function assignmentWhen(assignment, status) {
    const shortDate = value => value && Number.isFinite(new Date(value).getTime())
        ? new Date(value).toLocaleDateString(undefined, {month:'short',day:'numeric'}) : '';
    if (status === 'Scheduled') return `Scheduled · ${shortDate(assignment.release_at)}`;
    const due = shortDate(assignment.due_at);
    return due ? `Due ${due}` : status;
}
