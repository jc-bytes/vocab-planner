import { $, createElement } from '../main.js';

export class StudentActivityBrowserNavigation {
    constructor(browser) {
        this.browser = browser;
        this.activities = browser.activities;
        this.sm = browser.sm;
    }

    getAutomaticStudentVocabularyLocation(trimesterGroups) {
        const stored = this.sm.getStoredStudentVocabularyLocation();
        const storedMonths = trimesterGroups.has(stored.trimester)
            ? this.activities.schedule.buildVocabularyMonthGroups(trimesterGroups.get(stored.trimester))
            : null;
        if (storedMonths?.has(stored.month)) return stored;

        const currentMonth = this.activities.schedule.normalizeMonthKey(
            new Date().toLocaleString('en-US', { month: 'long' })
        );
        const currentTrimester = this.activities.calendar.getCurrentTrimesterKey();
        const currentTrimesterMonths = trimesterGroups.has(currentTrimester)
            ? this.activities.schedule.buildVocabularyMonthGroups(trimesterGroups.get(currentTrimester))
            : null;

        if (currentTrimesterMonths?.has(currentMonth)) {
            return { trimester: currentTrimester, month: currentMonth };
        }

        const candidates = [];
        trimesterGroups.forEach((vocabs, trimester) => {
            this.activities.schedule.buildVocabularyMonthGroups(vocabs).forEach((_monthVocabs, month) => {
                if (month !== 'other') candidates.push({ trimester, month });
            });
        });
        candidates.sort((a, b) => {
            const distance = Math.abs(this.activities.schedule.getMonthOrder(a.month) - this.activities.schedule.getMonthOrder(currentMonth))
                - Math.abs(this.activities.schedule.getMonthOrder(b.month) - this.activities.schedule.getMonthOrder(currentMonth));
            return distance
                || this.activities.schedule.getMonthOrder(a.month) - this.activities.schedule.getMonthOrder(b.month);
        });
        return candidates[0] || null;
    }

    isCurrentAcademicMonth(monthKey) {
        return monthKey === this.activities.schedule.normalizeMonthKey(
            new Date().toLocaleString('en-US', { month: 'long' })
        );
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
            const trimesterLabel = this.activities.schedule.getTrimesterLabel(selectedTrimester);
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
                this.activities.schedule.getMonthLabel(selectedMonth)
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
        return this.activities.studentVocabularyViewMode === 'rows' ? 'rows' : 'cards';
    }

    setStudentVocabularyViewMode(mode) {
        this.activities.studentVocabularyViewMode = mode === 'rows' ? 'rows' : 'cards';
        localStorage.setItem('student_vocabulary_view_mode', this.activities.studentVocabularyViewMode);
        this.browser.renderDashboard();
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
        window.lucide?.createIcons({ root: container });
    }

    renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups) {
        const sortedMonths = Array.from(monthGroups.keys())
            .sort((monthA, monthB) => (
                this.activities.schedule.getMonthOrder(monthA) - this.activities.schedule.getMonthOrder(monthB)
            ));
        const currentIndex = sortedMonths.indexOf(selectedMonth);
        const previousMonth = currentIndex > 0 ? sortedMonths[currentIndex - 1] : null;
        const nextMonth = currentIndex >= 0 && currentIndex < sortedMonths.length - 1
            ? sortedMonths[currentIndex + 1]
            : null;
        const toolbar = createElement('nav', 'student-vocab-month-navigation month-navigation');
        toolbar.setAttribute('aria-label', 'Vocabulary month navigation');

        const backButton = createElement(
            'button',
            'student-vocab-month-nav-btn student-vocab-month-back month-navigation__action month-navigation__action--back'
        );
        backButton.innerHTML = '<i data-lucide="arrow-left" aria-hidden="true"></i><span>Back to Months</span>';
        backButton.type = 'button';
        backButton.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'units', trimester: selectedTrimester });
        });

        const monthStrip = createElement('div', 'student-vocab-month-nav-strip');
        const previousButton = createElement(
            'button',
            'student-vocab-month-nav-btn month-navigation__action'
        );
        previousButton.innerHTML = '<i data-lucide="chevron-left" aria-hidden="true"></i><span>Previous Month</span>';
        previousButton.type = 'button';
        previousButton.disabled = !previousMonth;
        previousButton.addEventListener('click', () => {
            if (previousMonth) this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, month: previousMonth });
        });

        const currentLabel = createElement('div', 'student-vocab-month-nav-current month-navigation__current');
        currentLabel.setAttribute('aria-current', 'date');
        currentLabel.appendChild(createElement(
            'span',
            null,
            this.activities.schedule.getMonthLabel(selectedMonth)
        ));

        const nextButton = createElement(
            'button',
            'student-vocab-month-nav-btn month-navigation__action'
        );
        nextButton.innerHTML = '<span>Next Month</span><i data-lucide="chevron-right" aria-hidden="true"></i>';
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
        window.lucide?.createIcons({ root: toolbar });
    }

}
