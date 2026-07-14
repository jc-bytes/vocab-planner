import { $, createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';

class StudentActivityBrowserMethods {
    renderDashboard() {
        const container = $('#vocab-list');
        this.sm.logStudentDomUpdate?.('vocab-list', { source: 'renderDashboard:clear' });
        this.renderSubjectPicker('#student-subject-picker');
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

        this.renderStudentVocabularyViewControls();

        if (!selectedTrimester && this.sm.studentVocabularyAutoSelect) {
            const automaticLocation = this.getAutomaticStudentVocabularyLocation(trimesterGroups);
            if (automaticLocation) {
                this.sm.studentVocabularyDrilldown = automaticLocation;
                this.sm.rememberStudentVocabularyLocation(automaticLocation.trimester, automaticLocation.month);
                this.sm.setRoute({ view: 'units', ...automaticLocation }, { replace: true });
                this.renderStudentAssignmentPicker(
                    container,
                    automaticLocation.trimester,
                    automaticLocation.month,
                    this.buildVocabularyMonthGroups(trimesterGroups.get(automaticLocation.trimester)).get(automaticLocation.month),
                    this.buildVocabularyMonthGroups(trimesterGroups.get(automaticLocation.trimester))
                );
                return;
            }

            this.renderStudentTrimesterPicker(container, trimesterGroups);
            return;
        }

        if (!trimesterGroups.has(selectedTrimester)) {
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

        this.sm.rememberStudentVocabularyLocation(selectedTrimester, selectedMonth);
        this.renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth), monthGroups);
    }

    getAutomaticStudentVocabularyLocation(trimesterGroups) {
        const stored = this.sm.getStoredStudentVocabularyLocation();
        const storedMonths = trimesterGroups.has(stored.trimester)
            ? this.buildVocabularyMonthGroups(trimesterGroups.get(stored.trimester))
            : null;
        if (storedMonths?.has(stored.month)) return stored;

        const currentMonth = this.normalizeMonthKey(new Date().toLocaleString('en-US', { month: 'long' }));
        const currentTrimester = this.getCurrentTrimesterKey();
        const currentTrimesterMonths = trimesterGroups.has(currentTrimester)
            ? this.buildVocabularyMonthGroups(trimesterGroups.get(currentTrimester))
            : null;

        if (currentTrimesterMonths?.has(currentMonth)) {
            return { trimester: currentTrimester, month: currentMonth };
        }

        const candidates = [];
        trimesterGroups.forEach((vocabs, trimester) => {
            this.buildVocabularyMonthGroups(vocabs).forEach((_monthVocabs, month) => {
                if (month !== 'other') candidates.push({ trimester, month });
            });
        });
        candidates.sort((a, b) => {
            const distance = Math.abs(this.getMonthOrder(a.month) - this.getMonthOrder(currentMonth))
                - Math.abs(this.getMonthOrder(b.month) - this.getMonthOrder(currentMonth));
            return distance || this.getMonthOrder(a.month) - this.getMonthOrder(b.month);
        });
        return candidates[0] || null;
    }

    isCurrentAcademicMonth(monthKey) {
        return monthKey === this.normalizeMonthKey(new Date().toLocaleString('en-US', { month: 'long' }));
    }

    appendCurrentMonthBadge(target, monthKey) {
        if (!target || !this.isCurrentAcademicMonth(monthKey)) return;
        target.appendChild(createElement('span', 'student-current-month-badge context-badge', 'Current Month'));
    }

    renderStudentLibraryBreadcrumb(container, selectedTrimester = null, selectedMonth = null) {
        const headerBreadcrumb = container?.id === 'vocab-list' ? $('#vocab-context-breadcrumb') : null;
        const target = headerBreadcrumb || container;
        if (headerBreadcrumb) {
            headerBreadcrumb.innerHTML = '';
        }

        const nav = createElement('nav', 'teacher-library-breadcrumb breadcrumb');
        nav.setAttribute('aria-label', 'Vocabulary location');
        const rootButton = this.createStudentBreadcrumbButton('Vocabulary', () => {
            this.sm.studentVocabularyDrilldown = { trimester: null, month: null };
            this.sm.navigateTo({ view: 'units', all: true });
        });
        if (!selectedTrimester) rootButton.setAttribute('aria-current', 'page');
        nav.appendChild(rootButton);

        if (selectedTrimester) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
            separator.setAttribute('aria-hidden', 'true');
            nav.appendChild(separator);
            const trimesterLabel = this.getTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createStudentBreadcrumbButton(trimesterLabel, () => {
                    this.sm.studentVocabularyDrilldown = { trimester: selectedTrimester, month: null };
                    this.sm.navigateTo({ view: 'units', trimester: selectedTrimester });
                })
                : createElement('span', 'teacher-library-breadcrumb-current breadcrumb__current', trimesterLabel);
            if (!selectedMonth) trimesterNode.setAttribute('aria-current', 'page');
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
            separator.setAttribute('aria-hidden', 'true');
            nav.appendChild(separator);
            const monthNode = createElement(
                'span',
                'teacher-library-breadcrumb-current breadcrumb__current',
                this.getMonthLabel(selectedMonth)
            );
            monthNode.setAttribute('aria-current', 'page');
            nav.appendChild(monthNode);
            this.appendCurrentMonthBadge(nav, selectedMonth);
        }

        target.appendChild(nav);
    }

    createStudentBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn breadcrumb__item', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

    getStudentVocabularyViewMode() {
        return this.sm.studentVocabularyViewMode === 'rows' ? 'rows' : 'cards';
    }

    setStudentVocabularyViewMode(mode) {
        this.sm.studentVocabularyViewMode = mode === 'rows' ? 'rows' : 'cards';
        localStorage.setItem('student_vocabulary_view_mode', this.sm.studentVocabularyViewMode);
        this.renderDashboard();
    }

    renderStudentVocabularyViewControls() {
        const container = $('#vocab-view-toggle');
        if (!container) return;

        const currentMode = this.getStudentVocabularyViewMode();
        container.innerHTML = `
            <button class="vocab-view-toggle-btn segmented-control__item ${currentMode === 'cards' ? 'is-active segmented-control__item--active' : ''}" type="button" data-vocab-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
                <i data-lucide="layout-grid"></i>
                <span>Cards</span>
            </button>
            <button class="vocab-view-toggle-btn segmented-control__item ${currentMode === 'rows' ? 'is-active segmented-control__item--active' : ''}" type="button" data-vocab-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
                <i data-lucide="list"></i>
                <span>Rows</span>
            </button>
        `;

        container.querySelectorAll('[data-vocab-view-mode]').forEach(button => {
            button.addEventListener('click', () => {
                this.setStudentVocabularyViewMode(button.dataset.vocabViewMode);
            });
        });
    }

    renderStudentTrimesterPicker(container, trimesterGroups) {
        this.renderStudentLibraryBreadcrumb(container);

        if (this.getStudentVocabularyViewMode() === 'rows') {
            const list = this.createStudentVocabRowList(['Trimester', 'Months', 'Units']);
            Array.from(trimesterGroups.entries())
                .sort(([trimesterA], [trimesterB]) => this.getTrimesterOrder(trimesterA) - this.getTrimesterOrder(trimesterB))
                .forEach(([trimesterKey, trimesterVocabs]) => {
                    const monthSummary = this.formatMonthSummary(this.buildVocabularyMonthGroups(trimesterVocabs)) || 'No months';
                    const row = this.createStudentVocabRow({
                        primary: this.getTrimesterLabel(trimesterKey),
                        cells: [monthSummary, this.formatUnitCount(trimesterVocabs.length)],
                        icon: 'chevron-right'
                    });
                    row.addEventListener('click', () => {
                        this.sm.studentVocabularyDrilldown = { trimester: trimesterKey, month: null };
                        this.sm.navigateTo({ view: 'units', trimester: trimesterKey });
                    });
                    list.appendChild(row);
                });
            container.appendChild(list);
            this.refreshIcons(container);
            return;
        }

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
        this.refreshIcons(container);
    }

    renderStudentMonthPicker(container, selectedTrimester, monthGroups) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester);

        if (this.getStudentVocabularyViewMode() === 'rows') {
            const list = this.createStudentVocabRowList(['Month', 'Units', 'Trimester']);
            Array.from(monthGroups.entries())
                .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
                .forEach(([monthKey, monthVocabs]) => {
                    const row = this.createStudentVocabRow({
                        primary: this.getMonthLabel(monthKey),
                        cells: [this.formatUnitCount(monthVocabs.length), this.getTrimesterLabel(selectedTrimester)],
                        icon: 'chevron-right'
                    });
                    this.appendCurrentMonthBadge(row.querySelector('strong'), monthKey);
                    row.addEventListener('click', () => {
                        this.sm.studentVocabularyDrilldown = {
                            trimester: selectedTrimester,
                            month: monthKey
                        };
                        this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, month: monthKey });
                    });
                    list.appendChild(row);
                });
            container.appendChild(list);
            this.refreshIcons(container);
            return;
        }

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
                this.appendCurrentMonthBadge(card.querySelector('strong'), monthKey);
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
        this.refreshIcons(container);
    }

    renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups) {
        const sortedMonths = Array.from(monthGroups.keys())
            .sort((monthA, monthB) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB));
        const currentIndex = sortedMonths.indexOf(selectedMonth);
        const previousMonth = currentIndex > 0 ? sortedMonths[currentIndex - 1] : null;
        const nextMonth = currentIndex >= 0 && currentIndex < sortedMonths.length - 1
            ? sortedMonths[currentIndex + 1]
            : null;
        const toolbar = createElement('nav', 'student-vocab-month-navigation month-navigation');
        toolbar.setAttribute('aria-label', 'Vocabulary month navigation');

        const backButton = createElement(
            'button',
            'student-vocab-month-nav-btn student-vocab-month-back month-navigation__action month-navigation__action--back',
            '← Back to Months'
        );
        backButton.type = 'button';
        backButton.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'units', trimester: selectedTrimester });
        });

        const monthStrip = createElement('div', 'student-vocab-month-nav-strip');
        const previousButton = createElement(
            'button',
            'student-vocab-month-nav-btn month-navigation__action',
            '← Previous Month'
        );
        previousButton.type = 'button';
        previousButton.disabled = !previousMonth;
        previousButton.addEventListener('click', () => {
            if (previousMonth) this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, month: previousMonth });
        });

        const currentLabel = createElement('div', 'student-vocab-month-nav-current month-navigation__current');
        currentLabel.setAttribute('aria-current', 'date');
        currentLabel.appendChild(createElement('span', null, this.getMonthLabel(selectedMonth)));

        const nextButton = createElement(
            'button',
            'student-vocab-month-nav-btn month-navigation__action',
            'Next Month →'
        );
        nextButton.type = 'button';
        nextButton.disabled = !nextMonth;
        nextButton.addEventListener('click', () => {
            if (nextMonth) this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, month: nextMonth });
        });

        toolbar.appendChild(backButton);
        if (sortedMonths.length > 1) {
            monthStrip.append(previousButton, currentLabel, nextButton);
            toolbar.appendChild(monthStrip);
        }
        container.appendChild(toolbar);
    }

    renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthVocabs, monthGroups) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester, selectedMonth);
        this.renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups);

        if (this.getStudentVocabularyViewMode() === 'rows') {
            const list = this.createStudentVocabRowList(['Name', 'Month', 'Week', 'Type']);
            monthVocabs
                .sort((a, b) => this.compareVocabularySchedule(a, b))
                .forEach(vocab => list.appendChild(this.createVocabularyRow(vocab)));

            container.appendChild(list);
            this.scheduleFirstVocabularyPreload(container);
            this.refreshIcons(container);
            return;
        }

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
        monthVocabs
            .sort((a, b) => this.compareVocabularySchedule(a, b))
            .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

        container.appendChild(grid);
        this.scheduleFirstVocabularyPreload(container);
        this.refreshIcons(container);
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
        const header = createElement('div', 'student-vocab-row student-vocab-row-header');
        headers.forEach(label => header.appendChild(createElement('span', null, label)));
        while (header.children.length < 4) {
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
        const iconName = String(vocab.purpose || '').toLowerCase() === 'summative'
            ? 'clipboard-check'
            : 'book-open';

        card.style.setProperty('--subject-color', subject.color);
        card.classList.add(this.getVocabularyPurposeClass(vocab.purpose));

        card.innerHTML = `
            <div class="student-vocab-card-head">
                <span class="student-vocab-icon" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
                <span class="student-vocab-schedule">${escapeHtml(scheduleLabel)}</span>
            </div>
            <div class="student-vocab-copy">
                <h3>${escapeHtml(title)}</h3>
                <span class="student-vocab-purpose ${escapeHtml(this.getVocabularyPurposeClass(vocab.purpose))}">${escapeHtml(purposeLabel)}</span>
                <p data-vocab-description>${escapeHtml(description)}</p>
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

    createVocabularyRow(vocab) {
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const schedule = this.getVocabSchedule(vocab);
        const title = this.formatVocabularyCardTitle(vocab);
        const purposeLabel = this.formatVocabularyPurpose(vocab.purpose);
        const monthLabel = this.getMonthLabel(schedule.month);
        const weekLabel = schedule.week ? `Week ${schedule.week}` : 'No week';
        const row = createElement('button', 'student-vocab-row student-vocab-unit-row');
        row.type = 'button';
        row.style.setProperty('--subject-color', subject.color);
        row.innerHTML = `
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(monthLabel)}</span>
            <span>${escapeHtml(weekLabel)}</span>
            <span class="student-vocab-purpose ${escapeHtml(this.getVocabularyPurposeClass(vocab.purpose))}">${escapeHtml(purposeLabel)}</span>
            <i data-lucide="arrow-right"></i>
        `;
        if (vocab.path) {
            row.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            row.addEventListener('pointerenter', preload, { once: true });
            row.addEventListener('focus', preload, { once: true });
        }
        row.addEventListener('click', () => this.loadVocabulary(vocab));
        return row;
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
