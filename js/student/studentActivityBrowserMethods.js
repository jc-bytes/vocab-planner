import { $, createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';

class StudentActivityBrowserMethods {
    renderDashboard() {
        const container = $('#vocab-list');
        this.sm.logStudentDomUpdate?.('vocab-list', { source: 'renderDashboard:clear' });
        this.renderSubjectPicker('#vocab-subject-picker');
        container.innerHTML = '';
        container.className = 'vocab-groups';
        this.sm.availableVocabs = [];

        const { vocabs, message } = this.getVisibleVocabularyList({ availableOnly: true });

        if (vocabs.length === 0) {
            container.innerHTML = `<p>${message}</p>`;
            return;
        }

        this.renderVocabularyBrowser(container, vocabs);
        this.scheduleFirstVocabularyPreload(container);
    }

    renderVocabularyBrowser(container = $('#vocab-list'), vocabs = null) {
        if (!container) return;
        this.sm.logStudentDomUpdate?.(container.id || 'vocab-list', { source: 'renderVocabularyBrowser:clear' });

        container.classList.remove('vocab-grid', 'vocab-groups');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const visibleVocabs = Array.isArray(vocabs)
            ? this.filterStudentAvailableVocabulary(vocabs)
            : this.getVisibleVocabularyList({ availableOnly: true }).vocabs;
        const drilldown = this.sm.studentVocabularyDrilldown || { trimester: null, month: null };
        const trimesterGroups = this.buildVocabularyTrimesterGroups(visibleVocabs);
        const selectedTrimester = drilldown.trimester;
        const selectedMonth = drilldown.month;

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            const currentTrimester = this.getCurrentTrimesterKey();
            if (trimesterGroups.has(currentTrimester)) {
                this.sm.studentVocabularyDrilldown = { trimester: currentTrimester, month: null };
                this.renderStudentMonthPicker(container, currentTrimester, this.buildVocabularyMonthGroups(trimesterGroups.get(currentTrimester)));
                return;
            }

            this.sm.studentVocabularyDrilldown = { trimester: null, month: null };
            this.renderStudentTrimesterPicker(container, trimesterGroups);
            return;
        }

        const monthGroups = this.buildVocabularyMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.sm.studentVocabularyDrilldown.month = null;
            this.renderStudentMonthPicker(container, selectedTrimester, monthGroups);
            return;
        }

        this.renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    renderStudentLibraryBreadcrumb(container, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');
        const rootButton = this.createStudentBreadcrumbButton('Vocabulary', () => {
            this.sm.studentVocabularyDrilldown = { trimester: null, month: null };
            this.sm.navigateTo({ view: 'units', all: true });
        });
        nav.appendChild(rootButton);

        if (selectedTrimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createStudentBreadcrumbButton(trimesterLabel, () => {
                    this.sm.studentVocabularyDrilldown = { trimester: selectedTrimester, month: null };
                    this.sm.navigateTo({ view: 'units', trimester: selectedTrimester });
                })
                : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', this.getMonthLabel(selectedMonth)));
        }

        container.appendChild(nav);
    }

    createStudentBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

    renderStudentTrimesterPicker(container, trimesterGroups) {
        this.renderStudentLibraryBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => this.getTrimesterOrder(trimesterA) - this.getTrimesterOrder(trimesterB))
            .forEach(([trimesterKey, trimesterVocabs]) => {
                const card = this.createStudentLibraryChoiceCard({
                    title: this.getTrimesterLabel(trimesterKey),
                    count: this.formatUnitCount(trimesterVocabs.length),
                    meta: this.formatMonthSummary(this.buildVocabularyMonthGroups(trimesterVocabs)),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.sm.studentVocabularyDrilldown = { trimester: trimesterKey, month: null };
                    this.sm.navigateTo({ view: 'units', trimester: trimesterKey });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
        this.refreshIcons();
    }

    renderStudentMonthPicker(container, selectedTrimester, monthGroups) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .forEach(([monthKey, monthVocabs]) => {
                const card = this.createStudentLibraryChoiceCard({
                    title: this.getMonthLabel(monthKey),
                    count: this.formatUnitCount(monthVocabs.length),
                    meta: this.getTrimesterLabel(selectedTrimester),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.sm.studentVocabularyDrilldown = {
                        trimester: selectedTrimester,
                        month: monthKey
                    };
                    this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, month: monthKey });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
        this.refreshIcons();
    }

    renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthVocabs) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
        monthVocabs
            .sort((a, b) => this.compareVocabularySchedule(a, b))
            .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

        container.appendChild(grid);
        this.scheduleFirstVocabularyPreload(container);
        this.refreshIcons();
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

    refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    renderVocabularyGroups(container, vocabs) {
        const visibleVocabs = this.filterStudentAvailableVocabulary(vocabs);
        const grouped = visibleVocabs.reduce((groups, vocab) => {
            const key = this.getVocabTrimesterKey(vocab);
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
                <h3>${this.getTrimesterLabel(trimester)}</h3>
                <span>${trimesterVocabs.length} ${trimesterVocabs.length === 1 ? 'unit' : 'units'}</span>
            `;

            const monthGroups = this.buildVocabularyMonthGroups(trimesterVocabs);
            const monthList = createElement('div', 'student-vocab-month-list');
            Array.from(monthGroups.entries())
                .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
                .forEach(([monthKey, monthVocabs]) => {
                    const monthSection = createElement('section', 'student-vocab-month-group');
                    const monthHeading = createElement('div', 'student-vocab-month-heading');
                    monthHeading.innerHTML = `
                        <h4>${this.getMonthLabel(monthKey)}</h4>
                        <span>${monthVocabs.length} ${monthVocabs.length === 1 ? 'unit' : 'units'}</span>
                    `;

                    const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
                    monthVocabs
                        .sort((a, b) => this.compareVocabularySchedule(a, b))
                        .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

                    monthSection.appendChild(monthHeading);
                    monthSection.appendChild(grid);
                    monthList.appendChild(monthSection);
                });

            group.appendChild(heading);
            group.appendChild(monthList);
            container.appendChild(group);
        });
        this.refreshIcons();
    }

    createVocabularyCard(vocab) {
        const card = createElement('button', 'card option-card student-vocab-card');
        card.type = 'button';
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const title = this.formatVocabularyCardTitle(vocab);
        const purposeLabel = this.formatVocabularyPurpose(vocab.purpose);
        const scheduleLabel = this.formatVocabularyScheduleLabel(vocab);
        const description = this.formatVocabularyCardDescription(vocab, title);
        const iconName = String(vocab.purpose || '').toLowerCase() === 'summative'
            ? 'clipboard-check'
            : 'book-open';

        card.style.setProperty('--subject-color', subject.color);

        card.innerHTML = `
            <div class="student-vocab-topline">
                <span class="student-vocab-purpose ${escapeHtml(this.getVocabularyPurposeClass(vocab.purpose))}">${escapeHtml(purposeLabel)}</span>
                <span class="student-vocab-schedule">${escapeHtml(scheduleLabel)}</span>
            </div>
            <div class="student-vocab-card-main">
                <span class="student-vocab-icon" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
                <div class="student-vocab-copy">
                    <h3>${escapeHtml(title)}</h3>
                    <p data-vocab-description>${escapeHtml(description)}</p>
                </div>
            </div>
            <span class="student-vocab-action">
                Start unit
                <i data-lucide="arrow-right"></i>
            </span>
        `;
        if (vocab.path) {
            card.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            card.addEventListener('pointerenter', preload, { once: true });
            card.addEventListener('focus', preload, { once: true });
        }
        card.addEventListener('click', () => this.loadVocabulary(vocab));
        return card;
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
        const schedule = this.getVocabSchedule(vocab);
        return schedule.label || this.getTrimesterLabel(this.getVocabTrimesterKey(vocab));
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

        this.scheduleIdleTask(() => {
            preloadVocabularyFile(path);
        }, 1200);
    }
}

export function installStudentActivityBrowserMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityBrowserMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityBrowserMethods.prototype, name)
        );
    }
}
