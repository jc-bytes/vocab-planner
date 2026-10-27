import '../css/class-workspace-loading.css';

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Refresh and in-app navigation share the same class loading layout.
export function createClassWorkspaceLoading({ classId = null, tab = 'students', includeNavigation = false, section: requestedSection } = {}) {
    const section = ['assignments','review','results'].includes(requestedSection) ? requestedSection : classId ? (['work', 'settings'].includes(tab) ? tab : 'students') : 'classes';
    const label = { classes: 'Loading classes…', students: 'Loading students…', work: 'Loading work…', settings: 'Loading class settings…', assignments: 'Loading assignments…', review: 'Loading review…', results: 'Loading assignment results…' }[section];
    const block = element('section', 'class-workspace-loading');
    block.dataset.loadingSection = section;
    block.setAttribute('aria-label', label); block.setAttribute('aria-busy', 'true');
    if (includeNavigation && classId) {
        const navigation = element('div', 'class-loading-navigation'); navigation.setAttribute('aria-hidden', 'true');
        for (const [value, title] of [['students', 'Students'], ['work', 'Work'], ['settings', 'Class settings']]) {
            navigation.append(element('span', value === section ? 'is-selected' : '', title));
        }
        block.append(navigation);
    }
    const message = element('p', 'class-loading-label', label); message.setAttribute('role', 'status');
    const skeleton = element('div', 'class-loading-skeleton'); skeleton.setAttribute('aria-hidden', 'true');
    skeleton.append(element('div', 'class-loading-toolbar'));
    for (let i = 0; i < (section === 'settings' ? 3 : 10); i++) skeleton.append(element('div', 'class-loading-row'));
    if (['classes', 'students', 'work', 'settings'].includes(section)) {
        block.setAttribute('role', 'status');
        block.append(skeleton);
    } else block.append(message, skeleton);
    return block;
}
