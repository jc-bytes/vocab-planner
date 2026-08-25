const SHARED_DATA_VIEW_PAGES = new Set(['data', 'settings']);

function requireText(value, field, pageId) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new TypeError(`Teacher page ${pageId || '(unknown)'} requires ${field}.`);
    }
    return value.trim();
}

export function defineTeacherPages(definitions) {
    if (!Array.isArray(definitions) || definitions.length === 0) {
        throw new TypeError('Teacher pages require at least one descriptor.');
    }

    const ids = new Set();
    const viewOwners = new Map();
    const pages = definitions.map(definition => {
        if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
            throw new TypeError('Teacher page descriptors must be objects.');
        }
        const id = requireText(definition?.id, 'id', definition?.id);
        const viewId = requireText(definition?.viewId, 'viewId', id);
        const unsupportedField = Object.keys(definition).find(key => !['id', 'viewId'].includes(key));
        if (unsupportedField) {
            throw new TypeError(`Teacher page ${id} has unsupported field ${unsupportedField}.`);
        }
        if (ids.has(id)) throw new TypeError(`Duplicate teacher page id: ${id}.`);

        const existingOwner = viewOwners.get(viewId);
        if (existingOwner
            && (!SHARED_DATA_VIEW_PAGES.has(existingOwner) || !SHARED_DATA_VIEW_PAGES.has(id))) {
            throw new TypeError(`Duplicate teacher page view: ${viewId}.`);
        }

        ids.add(id);
        viewOwners.set(viewId, existingOwner || id);
        return Object.freeze({ id, viewId });
    });
    const byId = new Map(pages.map(page => [page.id, page]));

    return Object.freeze({
        pages: Object.freeze(pages),
        get(pageId) {
            return byId.get(pageId) || null;
        }
    });
}

export const teacherPageRegistry = defineTeacherPages([
    { id: 'overview', viewId: 'teacher-overview-view' },
    { id: 'vocabulary', viewId: 'teacher-dashboard-view' },
    { id: 'sparks', viewId: 'teacher-sparks-view' },
    { id: 'students', viewId: 'teacher-progress-view' },
    { id: 'groups', viewId: 'teacher-groups-view' },
    { id: 'data', viewId: 'teacher-data-management-view' },
    { id: 'settings', viewId: 'teacher-data-management-view' }
]);
