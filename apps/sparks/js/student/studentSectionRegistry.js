function defineSection(section) {
    return Object.freeze({
        ...section,
        viewIds: Object.freeze([...section.viewIds]),
        routePrefixes: Object.freeze([...section.routePrefixes])
    });
}

export const STUDENT_SECTIONS = Object.freeze([
    defineSection({
        id: 'classes', tabId: 'student-tab-classes', rootRoute: 'classes',
        viewIds: ['student-classes-view'], routePrefixes: ['classes']
    }),
    defineSection({
        id: 'today',
        tabId: 'student-tab-today',
        rootRoute: 'menu',
        viewIds: ['main-menu-view'],
        routePrefixes: ['menu']
    }),
    defineSection({
        id: 'vocabulary',
        tabId: 'student-tab-vocabulary',
        rootRoute: 'units',
        viewIds: ['vocab-selection-view', 'activity-menu-view', 'activity-view'],
        routePrefixes: ['units', 'unit/']
    }),
    defineSection({
        id: 'sparks',
        tabId: 'student-tab-sparks',
        rootRoute: 'sparks',
        viewIds: ['student-sparks-view'],
        routePrefixes: ['sparks']
    }),
    defineSection({
        id: 'arcade',
        tabId: 'student-tab-arcade',
        rootRoute: 'arcade',
        viewIds: ['arcade-view'],
        routePrefixes: ['arcade']
    })
]);

const sectionByViewId = new Map(
    STUDENT_SECTIONS.flatMap(section => section.viewIds.map(viewId => [viewId, section.id]))
);

export function getStudentSectionForView(viewId = '') {
    return sectionByViewId.get(String(viewId)) || '';
}

export function getStudentSectionForRoutePath(routePath = '') {
    const normalizedPath = String(routePath).replace(/^#\/?/, '').split('?')[0];
    const section = STUDENT_SECTIONS.find(candidate => (
        candidate.routePrefixes.some(prefix => (
            normalizedPath === prefix || (prefix.endsWith('/') && normalizedPath.startsWith(prefix))
        ))
    ));
    return section?.id || 'today';
}
