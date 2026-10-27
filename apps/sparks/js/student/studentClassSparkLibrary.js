import { formatClassSparkHeading } from './studentClassSparkModel.js';
import { renderStudentMonthNavigation } from './studentMonthNavigation.js';
import { refreshIcons } from '../main.js';

const trimesterLabels = { IT: 'Trimester 1', IIT: 'Trimester 2', IIIT: 'Trimester 3', other: 'Other dates' };
export const sparkMonthLabel = month => month === 'other' ? 'Other dates' : month[0].toUpperCase() + month.slice(1);
function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
}
export function sparkBreadcrumb(route, navigate) {
    const nav = node('nav', '', 'teacher-library-breadcrumb breadcrumb student-spark-breadcrumb');
    nav.setAttribute('aria-label', 'Sparks location');
    const crumb = (label, target, active) => {
        if (nav.childNodes.length) {
            const separator = node('span', '/', 'teacher-library-breadcrumb-separator breadcrumb__separator'); separator.setAttribute('aria-hidden', 'true'); nav.append(separator);
        }
        const el = node(active ? 'span' : 'button', label, active ? 'teacher-library-breadcrumb-current breadcrumb__current' : 'teacher-library-crumb-btn breadcrumb__item');
        if (active) el.setAttribute('aria-current', 'page');
        else { el.type = 'button'; el.addEventListener('click', () => navigate({ view: 'sparks', ...target })); }
        nav.append(el);
    };
    crumb('Sparks', { all: true }, !route.trimester && !route.sparkId);
    if (route.trimester) crumb(trimesterLabels[route.trimester] || 'Other dates', { trimester: route.trimester }, !route.month && !route.sparkId);
    if (route.month) crumb(sparkMonthLabel(route.month), { trimester: route.trimester, month: route.month }, !route.sparkId);
    if (route.sparkId) crumb('Read and answer', {}, true);
    return nav;
}
export function renderSparkViewToggle(mode, onChange, hidden = false, container = document.getElementById('spark-view-toggle')) {
    if (!container) return;
    container.hidden = hidden;
    container.replaceChildren();
    if (hidden) return;
    for (const [value, label, icon] of [['cards', 'Cards', 'layout-grid'], ['rows', 'Rows', 'list']]) {
        const button = node('button', '', 'vocab-view-toggle-btn segmented-control__item');
        button.type = 'button';
        button.setAttribute('aria-label', `Show ${value}`);
        button.setAttribute('aria-pressed', String(mode === value));
        if (mode === value) button.classList.add('is-active', 'segmented-control__item--active');
        const glyph = node('i'); glyph.dataset.lucide = icon; glyph.setAttribute('aria-hidden', 'true');
        button.append(glyph, node('span', label));
        button.addEventListener('click', () => { if (value !== mode) onChange(value); });
        container.append(button);
    }
    refreshIcons(container);
}

function choice(title, count, meta, onClick, rows = false) {
    const button = node('button', '', rows ? 'student-vocab-row student-spark-library-choice student-spark-row' : 'teacher-library-choice-card student-spark-library-choice'); button.type = 'button';
    const text = node('span', '', 'teacher-library-choice-text');
    if (!rows) {
        text.append(node('strong', title), node('span', count, 'teacher-library-choice-count'));
        if (meta) text.append(node('small', meta));
    }
    const arrow = node('span', '›'); arrow.setAttribute('aria-hidden', 'true');
    if (rows) button.append(node('strong', title), node('span', count), node('span', meta), arrow);
    else button.append(text, arrow);
    button.addEventListener('click', onClick); return button;
}

function sparkCard(item, data, status, date, onClick) {
    const heading = formatClassSparkHeading(item.title);
    const card = node('button', '', 'card option-card student-vocab-card student-spark-card student-spark-library-choice');
    card.type = 'button';
    const head = node('div', '', 'student-vocab-card-head');
    const icon = node('span', '', 'student-vocab-icon'); icon.setAttribute('aria-hidden', 'true');
    const glyph = node('i'); glyph.dataset.lucide = 'sparkles'; icon.append(glyph);
    const meta = node('span', '', 'student-vocab-card-meta');
    const week = heading.context.match(/Week \d+/)?.[0];
    meta.append(node('span', week ? `${sparkMonthLabel(item.month)} · ${week}` : date, 'student-vocab-schedule'));
    head.append(icon, meta);
    const copy = node('div', '', 'student-vocab-copy');
    copy.append(node('h3', heading.title), node('span', 'Spark', 'student-vocab-purpose'));
    const excerpt = data?.detail.content.sparkText;
    if (excerpt) copy.append(node('p', excerpt));
    const footer = node('span', '', 'student-vocab-required-progress');
    const statusLine = node('span', '', 'student-vocab-required-progress-copy');
    statusLine.append(node('span', data?.detail.content.checkMode === 'reading_only' ? 'Response' : 'Answer'), node('strong', status));
    footer.append(statusLine);
    if (item.closed) footer.append(node('small', 'Closed · Review available'));
    card.classList.toggle('has-saved-answer', Boolean(data?.saved));
    card.append(head, copy, footer);
    card.addEventListener('click', onClick);
    return card;
}

export async function renderClassSparkLibrary(root, { items, route, navigate, repository, signal, current, viewMode = 'cards', decorateCard = card => card, getStatus, getDateLabel, emptyMessage = 'No released Sparks are available here yet.' }) {
    let incomplete = false;
    const rows = viewMode === 'rows';
    const makeChoice = (...args) => choice(...args, rows);
    const nav = sparkBreadcrumb(route, navigate);
    const grid = node('div', '', rows ? 'student-vocab-row-list student-spark-row-list' : 'teacher-library-choice-grid student-spark-library-grid');
    if (!rows && route.month) {
        grid.className = 'vocab-grid trimester-vocab-grid student-spark-library-grid';
    }
    if (rows && items.length) {
        const header = node('div', '', 'student-vocab-row student-vocab-row-header student-spark-row');
        for (const label of [route.month ? 'Spark' : route.trimester ? 'Month' : 'Trimester', route.month ? 'Status' : 'Sparks', route.month ? 'Released' : 'Location', '']) header.append(node('span', label));
        header.setAttribute('aria-hidden', 'true');
        grid.append(header);
    }
    root.replaceChildren(nav, grid);
    if (!route.trimester) {
        for (const trimester of ['IT','IIT','IIIT','other']) {
            const group = items.filter(item => item.trimester === trimester);
            if (group.length) grid.append(makeChoice(trimesterLabels[trimester], `${group.length} ${group.length === 1 ? 'Spark' : 'Sparks'}`, 'Browse by month', () => navigate({ view:'sparks', trimester })));
        }
    } else if (!route.month) {
        const groups = new Map();
        for (const item of items.filter(item => item.trimester === route.trimester).sort((a,b) => a.date.localeCompare(b.date))) {
            if (!groups.has(item.month)) groups.set(item.month, []);
            groups.get(item.month).push(item);
        }
        for (const [month, group] of groups) grid.append(makeChoice(sparkMonthLabel(month), `${group.length} ${group.length === 1 ? 'Spark' : 'Sparks'}`, trimesterLabels[route.trimester], () => navigate({view:'sparks', trimester:route.trimester, month})));
    } else {
        const group = items.filter(item => item.trimester === route.trimester && item.month === route.month);
        const months = [...new Set(items.filter(item => item.trimester === route.trimester).sort((a,b) => a.date.localeCompare(b.date)).map(item => item.month))];
        renderStudentMonthNavigation(root, {
            sortedMonths: months,
            selectedMonth: route.month,
            monthLabel: sparkMonthLabel,
            ariaLabel: 'Spark month navigation',
            showMonthStrip: true,
            navigate: month => navigate({ view: 'sparks', trimester: route.trimester, ...(month ? { month } : {}) })
        });
        root.append(grid);
        const results = await Promise.allSettled(group.map(async item => {
            const [detail, responses] = await Promise.all([repository.readAssignment(item.id, {signal}), repository.listResponses(item.id, {signal})]);
            return { detail, saved:responses[0] };
        }));
        if (!current()) return;
        incomplete = results.find(result => result.status === 'rejected')?.reason || false;
        for (const [index, item] of group.entries()) {
            const result = results[index];
            const data = result.status === 'fulfilled' ? result.value : null;
            const status = getStatus ? getStatus(item) : !data ? 'Status unavailable' : data.detail.content.checkMode === 'reading_only' ? 'Reading only' : data.saved ? 'Answer saved' : 'Not answered';
            const date = getDateLabel ? getDateLabel(item) : new Intl.DateTimeFormat('en', {month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${item.date}T12:00:00Z`));
            const open = () => navigate({view:'sparks',trimester:item.trimester,month:item.month,sparkId:item.id});
            const card = rows
                ? makeChoice(formatClassSparkHeading(item.title).title, status, `${date}${item.closed ? ' · Closed · Review available' : ''}`, open)
                : sparkCard(item, data, status, date, open);
            grid.append(decorateCard(card, item));
        }
    }
    if (!grid.querySelector('button')) grid.append(node('p', emptyMessage, 'teacher-empty-state'));
    refreshIcons(grid);
    return incomplete;
}
