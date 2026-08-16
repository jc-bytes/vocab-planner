import { $, createElement } from '../main.js';
import { StudentActivityBrowserCards } from './studentActivityBrowserCards.js';
import { StudentActivityBrowserNavigation } from './studentActivityBrowserNavigation.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

export class StudentActivityBrowser {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.cards = new StudentActivityBrowserCards(this);
        this.navigation = new StudentActivityBrowserNavigation(this);
    }

    renderSubjectPicker(...args) {
        return this.activities.renderSubjectPicker(...args);
    }

    getVisibleVocabularyList(...args) {
        return this.activities.getVisibleVocabularyList(...args);
    }

    filterStudentAvailableVocabulary(...args) {
        return this.activities.filterStudentAvailableVocabulary(...args);
    }

    buildVocabularyTrimesterGroups(...args) {
        return this.activities.buildVocabularyTrimesterGroups(...args);
    }

    buildVocabularyMonthGroups(...args) {
        return this.activities.buildVocabularyMonthGroups(...args);
    }

    getCurrentTrimesterKey(...args) {
        return this.activities.getCurrentTrimesterKey(...args);
    }

    normalizeMonthKey(...args) {
        return this.activities.normalizeMonthKey(...args);
    }

    getMonthLabel(...args) {
        return this.activities.getMonthLabel(...args);
    }

    getMonthOrder(...args) {
        return this.activities.getMonthOrder(...args);
    }

    getTrimesterLabel(...args) {
        return this.activities.getTrimesterLabel(...args);
    }

    getTrimesterOrder(...args) {
        return this.activities.getTrimesterOrder(...args);
    }

    formatMonthSummary(...args) {
        return this.activities.formatMonthSummary(...args);
    }

    formatUnitCount(...args) {
        return this.activities.formatUnitCount(...args);
    }

    compareVocabularySchedule(...args) {
        return this.activities.compareVocabularySchedule(...args);
    }

    getVocabTrimesterKey(...args) {
        return this.activities.getVocabTrimesterKey(...args);
    }

    getVocabSchedule(...args) {
        return this.activities.getVocabSchedule(...args);
    }

    loadVocabulary(...args) {
        return this.activities.loadVocabulary(...args);
    }

    scheduleIdleTask(...args) {
        return this.activities.scheduleIdleTask(...args);
    }

    renderDashboard() {
        const container = $('#vocab-list');
        const view = $('#vocab-selection-view');
        if (!container) return;
        setStudentPageLoading(view, true);
        this.sm.logStudentDomUpdate?.('vocab-list', { source: 'renderDashboard:clear' });
        this.renderSubjectPicker('#student-subject-picker');
        this.renderSubjectPicker('#vocab-subject-picker');
        container.innerHTML = getStudentPageSkeleton('units', 'Loading vocabulary units');
        container.className = 'vocab-groups';
        this.activities.availableVocabs = [];

        const { vocabs, message } = this.getVisibleVocabularyList({ availableOnly: true });

        if (vocabs.length === 0) {
            container.innerHTML = `<p>${message}</p>`;
            setStudentPageLoading(view, false);
            return;
        }

        this.renderVocabularyBrowser(container, vocabs);
        this.scheduleFirstVocabularyPreload(container);
        setStudentPageLoading(view, false);
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
        return this.navigation.getAutomaticStudentVocabularyLocation(trimesterGroups);
    }

    isCurrentAcademicMonth(monthKey) {
        return this.navigation.isCurrentAcademicMonth(monthKey);
    }

    appendCurrentMonthBadge(target, monthKey) {
        return this.navigation.appendCurrentMonthBadge(target, monthKey);
    }

    renderStudentLibraryBreadcrumb(container, selectedTrimester = null, selectedMonth = null) {
        return this.navigation.renderStudentLibraryBreadcrumb(container, selectedTrimester, selectedMonth);
    }

    createStudentBreadcrumbButton(label, onClick) {
        return this.navigation.createStudentBreadcrumbButton(label, onClick);
    }

    getStudentVocabularyViewMode() {
        return this.navigation.getStudentVocabularyViewMode();
    }

    setStudentVocabularyViewMode(mode) {
        return this.navigation.setStudentVocabularyViewMode(mode);
    }

    renderStudentVocabularyViewControls() {
        return this.navigation.renderStudentVocabularyViewControls();
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
        return this.navigation.renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups);
    }

    renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthVocabs, monthGroups) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester, selectedMonth);
        this.renderStudentMonthNavigation(container, selectedTrimester, selectedMonth, monthGroups);

        if (this.getStudentVocabularyViewMode() === 'rows') {
            const list = this.createStudentVocabRowList(['Name', 'Month', 'Week', 'Type', 'Progress']);
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

    createStudentLibraryChoiceCard(options) {
        return this.cards.createStudentLibraryChoiceCard(options);
    }

    createStudentVocabRowList(headers = []) {
        return this.cards.createStudentVocabRowList(headers);
    }

    createStudentVocabRow(options) {
        return this.cards.createStudentVocabRow(options);
    }

    refreshIcons(root = document) {
        return this.cards.refreshIcons(root);
    }

    renderVocabularyGroups(container, vocabs) {
        return this.cards.renderVocabularyGroups(container, vocabs);
    }

    createVocabularyCard(vocab) {
        return this.cards.createVocabularyCard(vocab);
    }

    createVocabularyRow(vocab) {
        return this.cards.createVocabularyRow(vocab);
    }

    formatVocabularyCardTitle(vocab) {
        return this.cards.formatVocabularyCardTitle(vocab);
    }

    formatVocabularyPurpose(purpose) {
        return this.cards.formatVocabularyPurpose(purpose);
    }

    getVocabularyPurposeClass(purpose) {
        return this.cards.getVocabularyPurposeClass(purpose);
    }

    formatVocabularyScheduleLabel(vocab) {
        return this.cards.formatVocabularyScheduleLabel(vocab);
    }

    formatVocabularyCardDescription(vocab, title) {
        return this.cards.formatVocabularyCardDescription(vocab, title);
    }

    scheduleFirstVocabularyPreload(container) {
        return this.cards.scheduleFirstVocabularyPreload(container);
    }

}
