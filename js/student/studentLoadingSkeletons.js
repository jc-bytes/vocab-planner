function escapeAttribute(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

const line = (className = '') => `<span class="student-loading-line ${className}"></span>`;
const surface = (className, content) => `<div class="student-loading-surface ${className}">${content}</div>`;

export function getStudentPageSkeleton(kind = 'activity', label = 'Loading') {
    const safeKind = ['units', 'sparks', 'unit', 'activity', 'arcade', 'list'].includes(kind)
        ? kind
        : 'activity';
    const header = `
        <div class="student-loading-page-header">
            ${line('student-loading-page-title')}
            ${line('student-loading-page-control')}
        </div>
    `;

    let body = '';
    if (safeKind === 'units') {
        const cards = Array.from({ length: 4 }, () => surface('student-loading-unit-card', `
            ${line('student-loading-chip')}
            ${line('student-loading-card-title')}
            ${line('student-loading-card-copy')}
            ${line('student-loading-card-action')}
        `)).join('');
        body = `<div class="student-loading-card-grid">${cards}</div>`;
    } else if (safeKind === 'sparks') {
        body = surface('student-loading-reading-card', `
            <div class="student-loading-reading-copy">
                ${line('student-loading-chip')}
                ${line('student-loading-reading-title')}
                ${line('student-loading-reading-line')}
                ${line('student-loading-reading-line student-loading-reading-line--short')}
            </div>
            <div class="student-loading-response-panel">
                ${line('student-loading-card-title')}
                ${line('student-loading-response-box')}
                ${line('student-loading-card-action')}
            </div>
        `);
    } else if (safeKind === 'unit') {
        const cards = Array.from({ length: 6 }, () => surface('student-loading-activity-card', `
            ${line('student-loading-activity-icon')}
            ${line('student-loading-card-title')}
            ${line('student-loading-card-copy')}
        `)).join('');
        body = `<div class="student-loading-activity-grid">${cards}</div>`;
    } else if (safeKind === 'arcade') {
        body = surface('student-loading-arcade-card', `
            ${line('student-loading-chip')}
            ${line('student-loading-arcade-art')}
            ${line('student-loading-reading-title')}
            ${line('student-loading-card-copy')}
            ${line('student-loading-card-action')}
        `);
    } else if (safeKind === 'list') {
        body = `<div class="student-loading-list">${Array.from({ length: 4 }, () => line('student-loading-list-row')).join('')}</div>`;
    } else {
        body = surface('student-loading-activity-stage', `
            ${line('student-loading-activity-prompt')}
            ${line('student-loading-activity-focus')}
            <div class="student-loading-activity-actions">
                ${line('student-loading-card-action')}
                ${line('student-loading-card-action')}
            </div>
        `);
    }

    return `
        <div class="student-page-skeleton student-page-skeleton--${safeKind}" role="status" aria-label="${escapeAttribute(label)}">
            ${safeKind === 'list' ? '' : header}
            ${body}
        </div>
    `;
}

export function setStudentPageLoading(view, loading) {
    if (!view) return;
    view.classList.toggle('student-page-loading', Boolean(loading));
    view.setAttribute('aria-busy', loading ? 'true' : 'false');
}
