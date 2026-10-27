import { renderLibraryViewToggle } from '../learningLibraryView.js';
import { $, createElement, refreshIcons } from '../main.js';
import { renderStudentMonthNavigation } from './studentMonthNavigation.js';

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
        try {
            localStorage.setItem('student_vocabulary_view_mode', this.activities.studentVocabularyViewMode);
        } catch {
            // The selected layout still works for this page when storage is full or denied.
        }
        this.activities.renderDashboard();
    }

    renderStudentVocabularyViewControls() {
        const container = $('#vocab-view-toggle');
        if (!container) return;

        renderLibraryViewToggle(container, this.getStudentVocabularyViewMode(), mode => this.setStudentVocabularyViewMode(mode));
        refreshIcons(container);
    }

    renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups) {
        const sortedMonths = Array.from(monthGroups.keys())
            .sort((monthA, monthB) => (
                this.activities.schedule.getMonthOrder(monthA) - this.activities.schedule.getMonthOrder(monthB)
            ));
        renderStudentMonthNavigation(container, {
            sortedMonths,
            selectedMonth,
            monthLabel: month => this.activities.schedule.getMonthLabel(month),
            ariaLabel: 'Vocabulary month navigation',
            navigate: month => this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, ...(month ? { month } : {}) })
        });
    }

}
