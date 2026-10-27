import { createElement } from './main.js';

// The student browser and teacher library use these same DOM primitives.
export function createLibraryChoiceCard({ title, count, meta, icon }) {
    const card = createElement('button', 'teacher-library-choice-card');
    card.type = 'button';
    const text = createElement('span', 'teacher-library-choice-text');
    text.appendChild(createElement('strong', null, title));
    text.appendChild(createElement('span', 'teacher-library-choice-count', count));
    if (meta) text.appendChild(createElement('small', null, meta));
    card.appendChild(text);
    if (icon) { const glyph = createElement('i'); glyph.setAttribute('data-lucide', icon); card.appendChild(glyph); }
    return card;
}
export function createLibraryRowList(headers = []) {
    const list = createElement('div', 'student-vocab-row-list');
    if (headers.length >= 5) list.classList.add('student-vocab-row-list-six-columns');
    const header = createElement('div', 'student-vocab-row student-vocab-row-header');
    headers.forEach(label => header.appendChild(createElement('span', null, label)));
    while (header.children.length < Math.max(4, headers.length)) header.appendChild(createElement('span', null, ''));
    header.appendChild(createElement('span', null, '')); list.appendChild(header); return list;
}
export function createLibraryRow({ primary, cells = [], icon = 'chevron-right' }) {
    const row = createElement('button', 'student-vocab-row'); row.type = 'button';
    row.appendChild(createElement('strong', null, primary));
    cells.forEach(cell => row.appendChild(typeof cell === 'string' ? createElement('span', null, cell) : cell));
    while (row.children.length < 4) row.appendChild(createElement('span', null, ''));
    const glyph = createElement('i'); glyph.setAttribute('data-lucide', icon); row.appendChild(glyph); return row;
}
export function renderLibraryViewToggle(container, mode, onChange, dataAttribute = 'data-vocab-view-mode') {
    if (!container) return;
    container.classList.add('vocab-view-toggle', 'segmented-control');
    container.replaceChildren();
    for (const [value, label, icon] of [['cards', 'Cards', 'layout-grid'], ['rows', 'Rows', 'list']]) {
        const button = createElement('button', `vocab-view-toggle-btn segmented-control__item${value === mode ? ' is-active segmented-control__item--active' : ''}`);
        button.type = 'button'; button.setAttribute(dataAttribute, value);
        button.setAttribute('aria-pressed', String(value === mode)); button.setAttribute('aria-label', `Show ${value}`);
        button.innerHTML = `<i data-lucide="${icon}"></i><span>${label}</span>`;
        button.addEventListener('click', () => onChange(value)); container.appendChild(button);
    }
}
