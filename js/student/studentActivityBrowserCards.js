import { createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';

export class StudentActivityBrowserCards {
    constructor(browser) {
        this.browser = browser;
        this.activities = browser.activities;
        this.sm = browser.sm;
    }

    createStudentLibraryChoiceCard({ title, count, meta, icon }) {
        const card = createElement('button', 'teacher-library-choice-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        text.appendChild(createElement('strong', null, title));
        text.appendChild(createElement('span', 'teacher-library-choice-count', count));
        if (meta) text.appendChild(createElement('small', null, meta));
        card.appendChild(text);

        if (icon) {
            const iconEl = createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            card.appendChild(iconEl);
        }

        return card;
    }

    createStudentVocabRowList(headers = []) {
        const list = createElement('div', 'student-vocab-row-list');
        if (headers.length >= 5) list.classList.add('student-vocab-row-list-six-columns');
        const header = createElement('div', 'student-vocab-row student-vocab-row-header');
        headers.forEach(label => header.appendChild(createElement('span', null, label)));
        while (header.children.length < Math.max(4, headers.length)) {
            header.appendChild(createElement('span', null, ''));
        }
        header.appendChild(createElement('span', null, ''));
        list.appendChild(header);
        return list;
    }

    createStudentVocabRow({ primary, cells = [], icon = 'chevron-right' }) {
        const row = createElement('button', 'student-vocab-row');
        row.type = 'button';
        row.appendChild(createElement('strong', null, primary));
        cells.forEach(cell => row.appendChild(createElement('span', null, cell)));
        while (row.children.length < 4) {
            row.appendChild(createElement('span', null, ''));
        }
        const iconEl = createElement('i');
        iconEl.setAttribute('data-lucide', icon);
        row.appendChild(iconEl);
        return row;
    }

    refreshIcons(root = document) {
        if (window.lucide) {
            window.lucide.createIcons({ root });
        }
    }

    renderVocabularyGroups(container, vocabs) {
        const visibleVocabs = this.browser.filterStudentAvailableVocabulary(vocabs);
        const grouped = visibleVocabs.reduce((groups, vocab) => {
            const key = this.browser.getVocabTrimesterKey(vocab);
            if (!groups[key]) groups[key] = [];
            groups[key].push(vocab);
            return groups;
        }, {});

        ['IT', 'IIT', 'IIIT', 'other'].forEach(trimester => {
            const trimesterVocabs = grouped[trimester];
            if (!trimesterVocabs || trimesterVocabs.length === 0) return;

            const group = createElement('section', 'vocab-trimester-group');
            const heading = createElement('div', 'vocab-trimester-heading');
            heading.innerHTML = `
                <h3>${this.browser.getTrimesterLabel(trimester)}</h3>
                <span>${trimesterVocabs.length} ${trimesterVocabs.length === 1 ? 'unit' : 'units'}</span>
            `;

            const monthGroups = this.browser.buildVocabularyMonthGroups(trimesterVocabs);
            const monthList = createElement('div', 'student-vocab-month-list');
            Array.from(monthGroups.entries())
                .sort(([monthA], [monthB]) => this.browser.getMonthOrder(monthA) - this.browser.getMonthOrder(monthB))
                .forEach(([monthKey, monthVocabs]) => {
                    const monthSection = createElement('section', 'student-vocab-month-group');
                    const monthHeading = createElement('div', 'student-vocab-month-heading');
                    monthHeading.innerHTML = `
                        <h4>${this.browser.getMonthLabel(monthKey)}</h4>
                        <span>${monthVocabs.length} ${monthVocabs.length === 1 ? 'unit' : 'units'}</span>
                    `;

                    const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
                    monthVocabs
                        .sort((a, b) => this.browser.compareVocabularySchedule(a, b))
                        .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

                    monthSection.appendChild(monthHeading);
                    monthSection.appendChild(grid);
                    monthList.appendChild(monthSection);
                });

            group.appendChild(heading);
            group.appendChild(monthList);
            container.appendChild(group);
        });
        this.refreshIcons(container);
    }

    createVocabularyCard(vocab) {
        const card = createElement('button', 'card option-card student-vocab-card');
        card.type = 'button';
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const title = this.formatVocabularyCardTitle(vocab);
        const purposeLabel = this.formatVocabularyPurpose(vocab.purpose);
        const scheduleLabel = this.formatVocabularyScheduleLabel(vocab);
        const description = this.formatVocabularyCardDescription(vocab, title);
        const progress = this.getVocabularyRequiredProgress(vocab);
        const iconName = String(vocab.purpose || '').toLowerCase() === 'summative'
            ? 'clipboard-check'
            : 'book-open';

        card.style.setProperty('--subject-color', subject.color);
        card.classList.add(this.getVocabularyPurposeClass(vocab.purpose));
        card.classList.toggle('has-progress', progress.percent > 0);
        card.classList.toggle('is-required-complete', progress.isComplete);
        card.setAttribute('aria-label', `${title}. ${purposeLabel}. ${progress.ariaLabel}. Open unit.`);

        card.innerHTML = `
            <div class="student-vocab-card-head">
                <span class="student-vocab-icon" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
                <span class="student-vocab-card-meta">
                    <span class="student-vocab-schedule">${escapeHtml(scheduleLabel)}</span>
                    <strong class="student-vocab-progress-percent">${progress.percent}%</strong>
                </span>
            </div>
            <div class="student-vocab-copy">
                <h3>${escapeHtml(title)}</h3>
                <span class="student-vocab-purpose ${escapeHtml(this.getVocabularyPurposeClass(vocab.purpose))}">${escapeHtml(purposeLabel)}</span>
                <p data-vocab-description>${escapeHtml(description)}</p>
            </div>
            <span class="student-vocab-required-progress" aria-label="${escapeHtml(progress.ariaLabel)}">
                <span class="student-vocab-required-progress-copy">
                    <span>Required activities</span>
                    <strong>${progress.completed} of ${progress.total}</strong>
                </span>
                <span class="student-vocab-required-progress-track" aria-hidden="true">
                    <span style="width: ${progress.percent}%"></span>
                </span>
            </span>
        `;
        if (vocab.path) {
            card.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            card.addEventListener('pointerenter', preload, { once: true });
            card.addEventListener('focus', preload, { once: true });
        }
        card.addEventListener('click', () => this.browser.loadVocabulary(vocab));
        return card;
    }

    createVocabularyRow(vocab) {
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const schedule = this.browser.getVocabSchedule(vocab);
        const title = this.formatVocabularyCardTitle(vocab);
        const purposeLabel = this.formatVocabularyPurpose(vocab.purpose);
        const monthLabel = this.browser.getMonthLabel(schedule.month);
        const weekLabel = schedule.week ? `Week ${schedule.week}` : 'No week';
        const progress = this.getVocabularyRequiredProgress(vocab);
        const progressState = progress.isComplete
            ? 'is-complete'
            : (progress.percent > 0 ? 'is-in-progress' : 'is-not-started');
        const progressLabel = progress.isComplete
            ? 'Complete'
            : (progress.percent > 0 ? 'In progress' : 'Not started');
        const row = createElement('button', 'student-vocab-row student-vocab-unit-row');
        row.type = 'button';
        row.style.setProperty('--subject-color', subject.color);
        row.classList.add(progressState);
        row.setAttribute('aria-label', `${title}. ${purposeLabel}. ${progress.ariaLabel}.`);
        row.innerHTML = `
            <strong>${escapeHtml(title)}</strong>
            <span class="student-vocab-row-month">${escapeHtml(monthLabel)}</span>
            <span class="student-vocab-row-week">${escapeHtml(weekLabel)}</span>
            <span class="student-vocab-purpose student-vocab-row-type ${escapeHtml(this.getVocabularyPurposeClass(vocab.purpose))}">${escapeHtml(purposeLabel)}</span>
            <span class="student-vocab-row-progress ${progressState}" aria-label="${escapeHtml(progress.ariaLabel)}">
                <strong>${progress.percent}%</strong>
                <small>${progressLabel}</small>
            </span>
            <i data-lucide="arrow-right"></i>
        `;
        if (vocab.path) {
            row.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            row.addEventListener('pointerenter', preload, { once: true });
            row.addEventListener('focus', preload, { once: true });
        }
        row.addEventListener('click', () => this.browser.loadVocabulary(vocab));
        return row;
    }

    getVocabularyRequiredProgress(vocab) {
        const completion = this.activities.getUnitRequiredCompletion(vocab);
        const completed = Math.max(0, Number(completion?.completed) || 0);
        const total = Math.max(0, Number(completion?.total) || 0);
        const percent = total > 0
            ? Math.min(100, Math.round((completed / total) * 100))
            : 0;
        const isComplete = total > 0 && completed >= total;
        const actionLabel = isComplete ? 'Review unit' : percent > 0 ? 'Continue unit' : 'Start unit';

        return {
            completed,
            total,
            percent,
            isComplete,
            actionLabel,
            ariaLabel: `${percent}% complete: ${completed} of ${total} required activities`
        };
    }

    formatVocabularyCardTitle(vocab) {
        let title = String(vocab?.name || 'Vocabulary Unit').trim();
        title = title.replace(/^Grade\s+\d+\s+(?:I{1,3}T|T\d)\s+/i, '');
        title = title.replace(/^(Practice|Summative)\s*:\s*/i, '');
        title = title.replace(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+Week\s+\d{1,2}\s*[-:]\s*/i, '');
        return title || 'Vocabulary Unit';
    }

    formatVocabularyPurpose(purpose) {
        const normalized = String(purpose || '').trim().toLowerCase();
        if (normalized === 'summative') return 'Summative';
        if (normalized === 'practice') return 'Practice';
        return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Unit';
    }

    getVocabularyPurposeClass(purpose) {
        const normalized = String(purpose || 'unit')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `is-${normalized || 'unit'}`;
    }

    formatVocabularyScheduleLabel(vocab) {
        const schedule = this.browser.getVocabSchedule(vocab);
        return schedule.label || this.browser.getTrimesterLabel(this.browser.getVocabTrimesterKey(vocab));
    }

    formatVocabularyCardDescription(vocab, title) {
        const raw = String(vocab?.description || '').trim();
        if (!raw) {
            return `Practice the key terms for ${title.toLowerCase()}.`;
        }

        if (/^practice words for grade \d+ second-trimester python and data work\.?$/i.test(raw)) {
            return `Practice the terms you need for ${title.toLowerCase()} activities.`;
        }

        if (/^ten core second-trimester words for the grade \d+ python and data vocabulary table\.?$/i.test(raw)) {
            return 'Review the core Python and data terms for the second-trimester vocabulary check.';
        }

        return raw;
    }

    scheduleFirstVocabularyPreload(container) {
        const firstRepoCard = container.querySelector('[data-vocab-path]');
        const path = firstRepoCard?.dataset?.vocabPath;
        if (!path) return;

        this.browser.scheduleIdleTask(() => {
            preloadVocabularyFile(path);
        }, 1200);
    }
}
