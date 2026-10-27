// Shared, device-local browsing controls. These never write material data.
export const vocabularyStatuses = [
    ['current', 'Current materials'], ['all', 'All materials'], ['saved', 'Saved materials'],
    ['draft', 'Drafts'], ['repository', 'Repository materials'], ['retired', 'Retired / archived']
];
export function vocabularyStatus({ vocab, type }) {
    if (/^retired\s*[-:]/i.test(vocab.name || '') || ['archived', 'retired'].includes(vocab.status)) return 'retired';
    if (type === 'local' || vocab.status === 'draft') return 'draft';
    return type === 'remote' ? 'repository' : 'saved';
}
export function filterLibraryItems(items, state, { getGrades, getTrimester, getStatus = vocabularyStatus, getTitle = item => item.vocab.name || '' }) {
    const query = (state.query || '').trim().toLocaleLowerCase();
    return items.filter(item => {
        const status = getStatus(item);
        return (!query || getTitle(item).toLocaleLowerCase().includes(query))
            && (!state.grade || getGrades(item).map(String).includes(String(state.grade)))
            && (!state.trimester || String(getTrimester(item)) === String(state.trimester))
            && (!state.status || state.status === 'all' || (state.status === 'current' ? status !== 'retired' : status === state.status));
    });
}
let nextFilterPanel = 0;
export function renderLibraryControls(host, { state, onChange, statuses = vocabularyStatuses }) {
    if (!host || host.libraryControlState === state) return;
    host.libraryControlState = state;
    host.replaceChildren();
    host.classList.add('teacher-library-filters');
    const defaultStatus = statuses[0][0];
    const field = (target, label, control) => {
        const wrapper = document.createElement('label');
        const text = document.createElement('span'); text.textContent = label;
        wrapper.append(text, control); target.append(wrapper); return wrapper;
    };
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = 'Search materials'; search.value = state.query || '';
    const searchLabel = field(host, 'Search materials', search);
    searchLabel.className = 'teacher-library-search';
    searchLabel.firstElementChild.className = 'teacher-library-accessible-title';
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'btn secondary-btn teacher-library-filter-toggle';
    const panel = document.createElement('div'); panel.className = 'teacher-library-filter-panel'; panel.popover = 'auto';
    panel.id = `teacher-library-filter-panel-${++nextFilterPanel}`;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Filter materials');
    trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', panel.id);
    trigger.popoverTargetElement = panel; trigger.popoverTargetAction = 'toggle';
    panel.addEventListener('toggle', event => trigger.setAttribute('aria-expanded', String(event.newState === 'open')));
    panel.addEventListener('beforetoggle', event => {
        if (event.newState !== 'open') return;
        requestAnimationFrame(() => {
            if (!panel.matches(':popover-open')) return;
            const anchor = trigger.getBoundingClientRect();
            const size = panel.getBoundingClientRect();
            panel.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - size.width - 12))}px`;
            panel.style.top = `${Math.max(12, Math.min(anchor.bottom + 8, innerHeight - size.height - 12))}px`;
            panel.querySelector('select')?.focus({preventScroll:true});
        });
    });
    const heading = document.createElement('h3'); heading.textContent = 'Filter materials'; panel.append(heading);
    const fields = document.createElement('div'); fields.className = 'teacher-library-filter-fields'; panel.append(fields);
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn text-btn teacher-library-clear'; clear.textContent = 'Clear'; clear.setAttribute('aria-label', 'Clear filters');
    const sync = () => {
        const count = Number(Boolean(state.grade)) + Number(Boolean(state.trimester)) + Number(Boolean(state.status && state.status !== defaultStatus));
        trigger.textContent = count ? `Filters (${count})` : 'Filters';
        clear.hidden = !count && !String(state.query || '').trim();
    };
    const changed = () => { sync(); onChange(); };
    search.addEventListener('input', () => { state.query = search.value; changed(); });
    const select = (label, key, options) => {
        const control = document.createElement('select');
        for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option); }
        control.value = state[key] || '';
        field(fields, label, control);
        control.addEventListener('change', () => { state[key] = control.value; changed(); });
    };
    select('Grade', 'grade', [['', 'All grades'], ...['6', '7', '8', '9'].map(g => [g, `Grade ${g}`])]);
    select('Trimester', 'trimester', [['', 'All trimesters'], ['IT', 'Trimester 1'], ['IIT', 'Trimester 2'], ['IIIT', 'Trimester 3'], ['other', 'Other']]);
    select('Status', 'status', statuses);
    const done = document.createElement('button'); done.type = 'button'; done.className = 'btn secondary-btn'; done.textContent = 'Done';
    done.addEventListener('click', () => { panel.hidePopover(); trigger.focus(); }); panel.append(done);
    clear.addEventListener('click', () => {
        Object.assign(state, { query: '', grade: '', trimester: '', status: defaultStatus });
        search.value = '';
        const selects = panel.querySelectorAll('select'); selects[0].value = ''; selects[1].value = ''; selects[2].value = defaultStatus;
        changed(); search.focus();
    });
    host.append(trigger, clear, panel); sync();
}
export function renderLibraryEmpty(host, message, retry) {
    host.replaceChildren();
    host.removeAttribute('aria-busy');
    const box = document.createElement('div'); box.className = 'teacher-library-empty'; box.setAttribute('role', 'status');
    const text = document.createElement('p'); text.textContent = message; box.append(text);
    if (retry) { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn secondary-btn'; button.textContent = 'Retry'; button.addEventListener('click', retry); box.append(button); }
    host.append(box);
}
export function showLibraryLoading(host, message) {
    host.setAttribute('aria-busy', 'true');
    host.replaceChildren();
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = message; host.append(status);
    const skeleton = document.createElement('div'); skeleton.className = 'teacher-library-skeleton'; skeleton.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) skeleton.append(document.createElement('div'));
    host.append(skeleton);
}
