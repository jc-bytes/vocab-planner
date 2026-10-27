import '../css/class-workspace-loading.css';

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

// Refresh and in-app navigation share the same class loading layout.
export function createClassWorkspaceLoading({ classId = null, tab = 'work', includeNavigation = false, section: requestedSection } = {}) {
    const section = ['assignments','review','results'].includes(requestedSection) ? requestedSection : classId ? (tab === 'students' ? 'students' : 'work') : 'classes';
    const label = { classes: 'Loading classes…', students: 'Loading students…', work: 'Loading work…', assignments: 'Loading assignments…', review: 'Loading review…', results: 'Loading assignment results…' }[section];
    const block = element('section', 'class-workspace-loading');
    block.dataset.loadingSection = section;
    block.setAttribute('aria-label', label); block.setAttribute('aria-busy', 'true');
    const message = element('p', 'class-loading-label', label); message.setAttribute('role', 'status');
    const skeleton = element('div', 'class-loading-skeleton'); skeleton.setAttribute('aria-hidden', 'true');
    skeleton.append(element('div', 'class-loading-toolbar'));
    for (let i = 0; i < 10; i++) skeleton.append(element('div', 'class-loading-row'));
    if (['classes', 'students', 'work'].includes(section)) {
        block.setAttribute('role', 'status');
        block.append(skeleton);
    } else block.append(message, skeleton);
    return block;
}
