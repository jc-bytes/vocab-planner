import { $, createElement, escapeHtml } from '../main.js';
import { getVocabSubjectSlug } from '../services/vocabularyApi.js';

export function renderDemoSubjectPicker(targetId) {
        const container = $(targetId);
        if (!container) return;

        const gradeVocabs = this.getGradeMatchedVocabularySources();
        this.sm.ensureSelectedSubject(gradeVocabs);
        const counts = gradeVocabs.reduce((map, vocab) => {
            const subjectSlug = getVocabSubjectSlug(vocab);
            map.set(subjectSlug, (map.get(subjectSlug) || 0) + 1);
            return map;
        }, new Map());

        const subjects = this.sm.getActiveSubjects().filter(subject => counts.has(subject.slug));
        if (subjects.length === 0) {
            container.innerHTML = '';
            return;
        }

        const selectedSubject = subjects.find(subject => subject.slug === this.sm.selectedSubjectSlug) || subjects[0];
        renderStudentSubjectPicker(container, subjects, selectedSubject, slug => this.sm.selectSubject(slug));
}

export function renderStudentSubjectPicker(container, subjects, selectedSubject, onSelect) {
        const pickerId = container.id.replace(/[^a-z0-9_-]/gi, '');
        const triggerId = `${pickerId}-class-select`;
        const labelId = `${pickerId}-class-label`;
        const valueId = `${pickerId}-class-value`;
        const listboxId = `${pickerId}-class-options`;

        container.innerHTML = '';
        container.style.setProperty('--subject-color', selectedSubject.color);

        const picker = createElement('div', 'student-class-picker');
        picker.innerHTML = `
            <span id="${escapeHtml(labelId)}" class="student-class-picker-label">Class</span>
            <span class="subject-color-dot" style="background:${escapeHtml(selectedSubject.color)};"></span>
            <button id="${escapeHtml(triggerId)}" class="student-subject-select student-subject-trigger" type="button"
                aria-labelledby="${escapeHtml(labelId)} ${escapeHtml(valueId)}" aria-haspopup="listbox"
                aria-expanded="false" aria-controls="${escapeHtml(listboxId)}">
                <span id="${escapeHtml(valueId)}" class="student-subject-value">${escapeHtml(selectedSubject.name)}</span>
                <span class="student-subject-chevron" aria-hidden="true"></span>
            </button>
            <div id="${escapeHtml(listboxId)}" class="student-subject-options" role="listbox"
                aria-labelledby="${escapeHtml(labelId)}" hidden>
                ${subjects.map(subject => {
                    const isSelected = subject.slug === selectedSubject.slug;
                    return `
                        <button class="student-subject-option" type="button" role="option"
                            data-subject-slug="${escapeHtml(subject.slug)}" aria-selected="${isSelected}">
                            <span class="subject-color-dot" style="background:${escapeHtml(subject.color)};"></span>
                            <span>${escapeHtml(subject.name)}</span>
                            <span class="student-subject-option-check" aria-hidden="true">✓</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        const trigger = picker.querySelector('.student-subject-trigger');
        const listbox = picker.querySelector('.student-subject-options');
        const options = [...picker.querySelectorAll('.student-subject-option')];
        const selectedOption = options.find(option => option.getAttribute('aria-selected') === 'true') || options[0];
        const closeOnOutsidePointer = event => {
            if (!picker.contains(event.target)) setOpen(false);
        };
        const setOpen = open => {
            trigger?.setAttribute('aria-expanded', String(open));
            if (listbox) listbox.hidden = !open;
            picker.classList.toggle('is-open', open);
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            if (open) document.addEventListener('pointerdown', closeOnOutsidePointer);
        };
        const focusOption = index => options[(index + options.length) % options.length]?.focus();

        trigger?.addEventListener('click', () => setOpen(trigger.getAttribute('aria-expanded') !== 'true'));
        trigger?.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            setOpen(true);
            const selectedIndex = Math.max(0, options.indexOf(selectedOption));
            focusOption(event.key === 'ArrowUp' || event.key === 'End' ? options.length - 1 : selectedIndex);
        });
        listbox?.addEventListener('keydown', event => {
            const currentIndex = options.indexOf(document.activeElement);
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                trigger?.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                focusOption(currentIndex + (event.key === 'ArrowDown' ? 1 : -1));
            } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                focusOption(event.key === 'Home' ? 0 : options.length - 1);
            }
        });
        options.forEach(option => option.addEventListener('click', () => {
            const subjectSlug = option.dataset.subjectSlug;
            setOpen(false);
            if (subjectSlug === selectedSubject.slug) {
                trigger?.focus();
                return;
            }
            onSelect(subjectSlug);
        }));
        container.appendChild(picker);
    }
