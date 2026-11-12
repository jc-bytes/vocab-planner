import { compactFilter } from './compactAssignmentControls.js';
import { defaultProgressPeriod, normalizeProgressContext, progressTerms, validProgressRange, progressPresentation, progressMonths, progressActivities } from './teacherClassProgressModel.js';
import '../css/teacher-class-progress.css';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};

export async function mountClassProgress({ root, active, roster, calendar, timeZone, repository, signal, isCurrent, initial, onStateChange, onStudent, actions, invitationsHost, studentActions }) {
    let state = normalizeProgressContext(initial || defaultProgressPeriod(calendar, active.school_year, timeZone));
    const terms = progressTerms(calendar, active.school_year);
    const section = node('section', undefined, 'class-directory class-progress');
    section.setAttribute('aria-label', 'Trimester progress');
    const filters = node('div', undefined, 'class-directory-filters');
    const period = compactFilter(filters, 'Period', [...terms.map(term => [term.period, `Trimester ${term.period}`]), ['custom', 'Custom dates']]);
    if (!terms.some(term => term.period === state.period)) state.period = 'custom';
    period.value = state.period;
    const month = compactFilter(filters, 'Month', [['', 'All months']]);
    const activity = compactFilter(filters, 'Activity', [['', 'All activities'], ...progressActivities]);
    activity.value = state.activity;
    function dateInput(label, value) {
        const wrapper = node('label', label, 'class-progress-date'), input = node('input'); input.type = 'date'; input.required = true; input.value = value;
        input.setAttribute('aria-label', label); wrapper.append(input); filters.append(wrapper); return input;
    }
    const from = dateInput('Available from', state.from), to = dateInput('Available through', state.to);
    const apply = node('button', 'Apply dates', 'btn secondary-btn'); apply.type = 'button'; filters.append(apply);
    const search = node('input', undefined, 'class-progress-search'); search.type = 'search'; search.placeholder = 'Search students'; search.setAttribute('aria-label', 'Search students'); search.value = state.search;
    const searchLabel = node('label', 'Student', 'class-progress-search-label'); searchLabel.append(search); filters.append(searchLabel);
    const options = node('details', undefined, 'class-progress-filter-menu'), optionsToggle = node('summary', 'Filters');
    const optionsBody = node('div', undefined, 'class-progress-filter-body');
    options.append(optionsToggle, optionsBody); filters.append(options);
    const sort = compactFilter(optionsBody, 'Sort', [['name', 'Name A–Z'], ['completion-asc', 'Lowest first'], ['completion-desc', 'Highest first']], 'Sort progress'); sort.value = state.sort;
    sort.parentElement.classList.add('class-progress-sort');
    const unfinishedLabel = node('label', undefined, 'class-progress-unfinished'), unfinished = node('input'); unfinished.type = 'checkbox'; unfinished.checked = state.unfinished; unfinishedLabel.append(unfinished, document.createTextNode('Unfinished only')); optionsBody.append(unfinishedLabel);
    const message = node('p', undefined, 'class-progress-caption'); message.setAttribute('role', 'status');
    const scroll = node('div', undefined, 'class-directory-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Class completion table');
    const table = node('table'), head = node('thead'), heading = node('tr'), body = node('tbody');
    table.setAttribute('aria-label', 'Required work completion');
    for (const title of ['Student', 'Required work completed', 'Teacher review', 'Actions']) { const th = node('th', title); th.scope = 'col'; heading.append(th); }
    head.append(heading); table.append(head, body); scroll.append(table);
    const footer = node('div', undefined, 'class-directory-footer'), count = node('span'); count.setAttribute('role', 'status');
    const previous = node('button', 'Previous', 'btn secondary-btn'), next = node('button', 'Next', 'btn secondary-btn'); previous.type = next.type = 'button';
    const paging = node('div'); paging.append(previous, next); footer.append(paging, count);
    const retry = node('button', 'Retry progress', 'btn secondary-btn'); retry.type = 'button'; retry.hidden = true;
    const toolbar = node('div', undefined, 'class-progress-toolbar');
    toolbar.append(filters, actions);
    section.append(toolbar, message, retry, scroll, footer, invitationsHost); root.append(section);
    const rosterRows = roster.map(student => ({ ...student, summary: null, presentation: progressPresentation(null) }));
    let rows = rosterRows, loading = false, available = false, request = 0, readController;
    const notify = () => { if (isCurrent()) onStateChange?.({ ...state }); };
    function syncDates() {
        const term = terms.find(item => item.period === state.period);
        const months = progressMonths(term);
        const selected = months.find(item => item.id === state.month);
        state.month = selected?.id || '';
        month.replaceChildren(new Option('All months', ''), ...months.map(item => new Option(item.label, item.id)));
        month.value = state.month;
        month.parentElement.hidden = !term;
        if (term) ({ from: state.from, to: state.to } = selected || term);
        from.disabled = to.disabled = state.period !== 'custom'; apply.hidden = state.period !== 'custom';
        from.parentElement.hidden = to.parentElement.hidden = state.period !== 'custom';
        from.value = state.from; to.value = state.to;
    }
    function render() {
        if (!isCurrent()) return;
        const activeFilters = Number(state.unfinished) + Number(state.sort !== 'name');
        optionsToggle.textContent = activeFilters ? `Filters (${activeFilters})` : 'Filters';
        const query = state.search.trim().toLocaleLowerCase();
        const filtered = rows.filter(row => row.name.toLocaleLowerCase().includes(query)
            && (!state.unfinished || row.presentation.percent !== 100));
        filtered.sort((a, b) => {
            const direction = state.sort === 'completion-desc' ? -1 : 1;
            if (state.sort !== 'name') {
                // Keep unknown/no-work rows after measurable results in both directions.
                if (a.presentation.percent === null && b.presentation.percent !== null) return 1;
                if (b.presentation.percent === null && a.presentation.percent !== null) return -1;
                const difference = (a.presentation.percent - b.presentation.percent) * direction;
                if (difference) return difference;
            }
            return a.name.localeCompare(b.name) || a.studentId.localeCompare(b.studentId);
        });
        state.offset = Math.min(state.offset, Math.max(0, Math.ceil(filtered.length / 25) - 1) * 25);
        body.replaceChildren();
        for (const row of filtered.slice(state.offset, state.offset + 25)) {
            const tr = node('tr'), name = node('th'), link = node('button', row.name, 'class-table-link'); name.scope = 'row'; link.type = 'button';
            function openStudent(tab) {
                if (!isCurrent()) return;
                state.scroll = window.scrollY; notify();
                onStudent?.({ classId: active.id, studentId: row.studentId, tab, progressContext: { ...state } });
            }
            if (onStudent) {
                link.addEventListener('click', () => openStudent('overview')); name.append(link);
            } else name.textContent = row.name;
            const summary = row.summary, p = row.presentation;
            const tasks = node('span', summary ? `${summary.completed} / ${summary.required}${summary.unknown ? ' known tasks' : ' tasks'}` : 'Unavailable');
            const completion = node('td', undefined, 'class-progress-completion'), label = node('span', p.label, 'class-progress-value');
            label.dataset.band = p.band;
            const bar = node('progress', undefined, 'class-completion-bar'); bar.max = 100; bar.value = p.percent ?? 0; bar.dataset.band = p.band;
            bar.setAttribute('aria-label', `${row.name}: ${p.label}${p.percent !== null ? `, ${summary.completed} of ${summary.required} required tasks complete` : ''}`);
            const numbers = node('div', undefined, 'class-progress-numbers'), value = node('span');
            if (p.percent === 100) value.append(document.createTextNode('100% · '));
            value.append(label); numbers.append(tasks, value); completion.append(numbers, bar);
            if (summary?.unknown) completion.append(node('small', `${summary.unknown} assignment${summary.unknown === 1 ? '' : 's'} unavailable`));
            const review = node('td', undefined, 'class-progress-review');
            review.append(node('span', summary ? summary.review ? `${summary.review} awaiting review` : '—' : 'Unavailable', summary?.review ? 'class-progress-review-badge' : ''));
            review.dataset.empty = String(summary?.review === 0); review.setAttribute('data-label', 'Awaiting review');
            tasks.className = 'class-progress-tasks';
            const controls = node('td', undefined, 'class-progress-actions');
            controls.append(studentActions(row, openStudent));
            tr.append(name, completion, review, controls); body.append(tr);
        }
        if (!filtered.length) {
            const tr = node('tr'), cell = node('td', loading ? 'Loading progress…' : !available ? 'Progress unavailable.' : roster.length ? 'No students match these filters.' : 'No students have joined yet.'); cell.colSpan = 4; tr.append(cell); body.append(tr);
        }
        previous.disabled = loading || state.offset === 0; next.disabled = loading || state.offset + 25 >= filtered.length;
        paging.hidden = filtered.length <= 25;
        count.textContent = filtered.length <= 25 ? `${filtered.length} student${filtered.length === 1 ? '' : 's'}` : `Students ${state.offset + 1}–${Math.min(state.offset + 25, filtered.length)} of ${filtered.length}`;
    }
    const abort = () => readController?.abort(); signal.addEventListener('abort', abort, { once: true });
    async function load() {
        readController?.abort(); readController = new AbortController();
        const token = ++request;
        available = false; rows = rosterRows; retry.hidden = true;
        if (!validProgressRange(state)) {
            message.textContent = 'Choose a valid start and end date. The end must be on or after the start.'; loading = false; render(); notify(); return;
        }
        if (signal.aborted || !isCurrent()) return;
        loading = true; section.setAttribute('aria-busy', 'true'); message.textContent = 'Loading progress…'; render(); notify();
        try {
            const result = await repository.classProgress(active.id, state.from, state.to, { signal: readController.signal, ...(state.activity ? { activity: state.activity } : {}) });
            if (token !== request || signal.aborted || !isCurrent()) return;
            if (!Array.isArray(result)) throw new Error('Invalid progress response.');
            const summaries = new Map(result.map(summary => [summary.studentId, summary]));
            rows = roster.map(student => ({ ...student, summary: summaries.get(student.studentId) || null, presentation: progressPresentation(summaries.get(student.studentId)) }));
            available = true; message.textContent = `Work available from ${state.from} through ${state.to}`;
            message.title = `Inclusive dates in ${timeZone}. Includes work finished after these dates.`;
        } catch {
            if (token !== request || signal.aborted || !isCurrent()) return;
            message.textContent = 'Progress could not be loaded. Retry to get current completion.'; retry.hidden = false;

        } finally {
            if (token === request && isCurrent()) { loading = false; section.setAttribute('aria-busy', 'false'); render(); notify(); }
        }
    }
    period.addEventListener('change', () => {
        state.period = period.value; state.month = ''; state.activity = ''; activity.value = '';
        state.offset = 0; state.scroll = 0; syncDates(); void load();
    });
    month.addEventListener('change', () => {
        state.month = month.value; state.activity = ''; activity.value = '';
        state.offset = 0; state.scroll = 0; syncDates(); void load();
    });
    activity.addEventListener('change', () => {
        state.activity = activity.value; state.offset = 0; state.scroll = 0; void load();
    });
    apply.addEventListener('click', () => {
        if (!from.reportValidity() || !to.reportValidity()) return;
        state.from = from.value; state.to = to.value; state.offset = 0; state.scroll = 0; void load();
    });
    for (const control of [search, sort, unfinished]) control.addEventListener(control === search ? 'input' : 'change', () => {
        state.search = search.value; state.sort = sort.value; state.unfinished = unfinished.checked; state.offset = 0; state.scroll = 0; render(); notify();
    });
    previous.addEventListener('click', () => { state.offset = Math.max(0, state.offset - 25); render(); notify(); });
    next.addEventListener('click', () => { state.offset += 25; render(); notify(); });
    retry.addEventListener('click', () => void load());
    syncDates(); await load();
    if (isCurrent() && state.scroll) window.scrollTo({ top: state.scroll, behavior: 'instant' });
}
