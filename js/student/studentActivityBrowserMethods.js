import { $, createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';

class StudentActivityBrowserMethods {
    renderDashboard() {
        const container = $('#vocab-list');
        this.renderSubjectPicker('#vocab-subject-picker');
        container.innerHTML = '';
        container.className = 'vocab-groups';
        this.sm.availableVocabs = [];

        const { vocabs, message } = this.getVisibleVocabularyList();

        if (vocabs.length === 0) {
            container.innerHTML = `<p>${message}</p>`;
            return;
        }

        this.renderVocabularyBrowser(container, vocabs);
        this.scheduleFirstVocabularyPreload(container);
    }

    renderVocabularyBrowser(container = $('#vocab-list'), vocabs = null) {
        if (!container) return;

        container.classList.remove('vocab-grid', 'vocab-groups');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const visibleVocabs = Array.isArray(vocabs) ? vocabs : this.getVisibleVocabularyList().vocabs;
        const drilldown = this.sm.studentVocabularyDrilldown || { trimester: null, month: null };
        const trimesterGroups = this.buildVocabularyTrimesterGroups(visibleVocabs);
        const selectedTrimester = drilldown.trimester;
        const selectedMonth = drilldown.month;

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
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
        const grouped = vocabs.reduce((groups, vocab) => {
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
    }

    createVocabularyCard(vocab) {
        const card = createElement('div', 'card option-card');
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const sourceLabel = vocab.__source === 'cloud'
            ? 'Cloud'
            : vocab.__source === 'local'
                ? 'Local'
                : 'Repo';

        card.innerHTML = `
            <div class="icon">${vocab.__source === 'cloud' ? '☁️' : '📚'}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3>${escapeHtml(vocab.name)}</h3>
            <p>${escapeHtml(vocab.description || '')}</p>
            ${vocab.grades ? `<small>Grade: ${escapeHtml(vocab.grades.join(', '))}</small>` : ''}
            <small style="color:var(--text-muted); display:block; margin-top:0.5rem;">${sourceLabel}</small>
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
