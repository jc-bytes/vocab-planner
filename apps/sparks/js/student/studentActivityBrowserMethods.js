import { $, createElement } from '../main.js';
import { StudentActivityBrowserCards } from './studentActivityBrowserCards.js';
import { StudentActivityBrowserNavigation } from './studentActivityBrowserNavigation.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

export class StudentActivityBrowser {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.calendar = activities.calendar;
        this.schedule = activities.schedule;
        this.vocabularyData = activities.vocabularyData;
        this.cards = new StudentActivityBrowserCards(this);
        this.navigation = new StudentActivityBrowserNavigation(this);
    }

    async renderDashboard({ forceRefresh = false } = {}) {
        const route = globalThis.location?.hash;
        const owner = this.sm.currentUser?.uid || this.sm.currentUser?.id;
        const selection = this.vocabularyData.classSelection;
        const run = this.renderGeneration = (this.renderGeneration || 0) + 1;
        const selectedId = selection?.selectedId;
        const current = () => run === this.renderGeneration && route === globalThis.location?.hash
            && owner === (this.sm.currentUser?.uid || this.sm.currentUser?.id)
            && (!selectedId || selectedId === selection?.selectedId);
        const container = $('#vocab-list');
        const view = $('#vocab-selection-view');
        if (!container) return;
        if (!selection?.hasSnapshot && !this.sm.authDisabled) {
            setStudentPageLoading(view, true);
            container.classList.remove('vocab-grid', 'vocab-groups');
            container.classList.add('teacher-library-browser');
            container.innerHTML = getStudentPageSkeleton(this.getStudentVocabularyViewMode() === 'rows' ? (this.sm.studentVocabularyDrilldown?.month ? 'rows' : 'month-rows') : this.sm.studentVocabularyDrilldown?.month ? 'units' : 'months', 'Loading vocabulary units');
        }
        if (!this.sm.authDisabled) {
            try { if (await this.vocabularyData.loadClassSelection({ forceRefresh }) === false) return; }
            catch (error) {
                const { showSectionLoadError } = await import('../ui/sectionRecovery.js');
                showSectionLoadError(container, { label: 'class units', error, current,
                    keepContent: Boolean(selection?.hasSnapshot && selection.owner === owner),
                    retry: () => this.renderDashboard({ forceRefresh: true }) });
                if (current()) setStudentPageLoading(view, false);
                return;
            }
        }
        if (route !== globalThis.location?.hash || owner !== (this.sm.currentUser?.uid || this.sm.currentUser?.id)) {
            setStudentPageLoading(view, false);
            return;
        }
        this.sm.logStudentDomUpdate?.('vocab-list', { source: 'renderDashboard:clear' });
        this.vocabularyData.renderSubjectPicker('#student-subject-picker');
        this.vocabularyData.renderSubjectPicker('#vocab-subject-picker');
        this.activities.availableVocabs = [];

        const { vocabs, message } = this.vocabularyData.getVisibleVocabularyList({ availableOnly: true, currentTrimesterOnly: true });

        if (vocabs.length === 0) {
            container.innerHTML = `<p>${message}</p>`;
            this.vocabularyData.classSelection?.renderInvitations(container);
            setStudentPageLoading(view, false);
            return;
        }

        this.renderVocabularyBrowser(container, vocabs);
        this.vocabularyData.classSelection?.renderInvitations(container);
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
            ? this.schedule.filterStudentAvailableVocabulary(vocabs)
            : this.vocabularyData.getVisibleVocabularyList({ availableOnly: true, currentTrimesterOnly: true }).vocabs;
        const drilldown = this.sm.studentVocabularyDrilldown || { trimester: null, month: null };
        const trimesterGroups = this.schedule.buildVocabularyTrimesterGroups(visibleVocabs);
        const selectedTrimester = this.calendar.getCurrentTrimesterKey();
        const selectedMonth = drilldown.trimester === selectedTrimester ? drilldown.month : null;
        if (drilldown.trimester !== selectedTrimester) {
            this.sm.studentVocabularyDrilldown = { trimester: selectedTrimester, month: null };
            this.sm.setRoute({ view: 'units', trimester: selectedTrimester }, { replace: true });
        }

        this.renderStudentVocabularyViewControls();

        if (!selectedMonth && this.sm.studentVocabularyAutoSelect) {
            const automaticLocation = this.getAutomaticStudentVocabularyLocation(trimesterGroups);
            if (automaticLocation) {
                this.sm.studentVocabularyDrilldown = automaticLocation;
                this.sm.rememberStudentVocabularyLocation(automaticLocation.trimester, automaticLocation.month);
                this.sm.setRoute({ view: 'units', ...automaticLocation }, { replace: true });
                this.renderStudentAssignmentPicker(
                    container,
                    automaticLocation.trimester,
                    automaticLocation.month,
                    this.schedule.buildVocabularyMonthGroups(trimesterGroups.get(automaticLocation.trimester)).get(automaticLocation.month),
                    this.schedule.buildVocabularyMonthGroups(trimesterGroups.get(automaticLocation.trimester))
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

        const monthGroups = this.schedule.buildVocabularyMonthGroups(trimesterGroups.get(selectedTrimester));

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
                .sort(([trimesterA], [trimesterB]) => this.schedule.getTrimesterOrder(trimesterA) - this.schedule.getTrimesterOrder(trimesterB))
                .forEach(([trimesterKey, trimesterVocabs]) => {
                    const monthSummary = this.schedule.formatMonthSummary(this.schedule.buildVocabularyMonthGroups(trimesterVocabs)) || 'No months';
                    const row = this.createStudentVocabRow({
                        primary: this.schedule.getTrimesterLabel(trimesterKey),
                        cells: [monthSummary, this.schedule.formatUnitCount(trimesterVocabs.length)],
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
            .sort(([trimesterA], [trimesterB]) => this.schedule.getTrimesterOrder(trimesterA) - this.schedule.getTrimesterOrder(trimesterB))
            .forEach(([trimesterKey, trimesterVocabs]) => {
                const card = this.createStudentLibraryChoiceCard({
                    title: this.schedule.getTrimesterLabel(trimesterKey),
                    count: this.schedule.formatUnitCount(trimesterVocabs.length),
                    meta: this.schedule.formatMonthSummary(this.schedule.buildVocabularyMonthGroups(trimesterVocabs)),
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
                .sort(([monthA], [monthB]) => this.schedule.getMonthOrder(monthA) - this.schedule.getMonthOrder(monthB))
                .forEach(([monthKey, monthVocabs]) => {
                    const row = this.createStudentVocabRow({
                        primary: this.schedule.getMonthLabel(monthKey),
                        cells: [this.schedule.formatUnitCount(monthVocabs.length), this.schedule.getTrimesterLabel(selectedTrimester)],
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
            .sort(([monthA], [monthB]) => this.schedule.getMonthOrder(monthA) - this.schedule.getMonthOrder(monthB))
            .forEach(([monthKey, monthVocabs]) => {
                const card = this.createStudentLibraryChoiceCard({
                    title: this.schedule.getMonthLabel(monthKey),
                    count: this.schedule.formatUnitCount(monthVocabs.length),
                    meta: this.schedule.getTrimesterLabel(selectedTrimester),
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
        container.appendChild(createElement('h2', 'student-unit-list-heading', this.schedule.getMonthLabel(selectedMonth) + ' units'));

        if (this.getStudentVocabularyViewMode() === 'rows') {
            const list = this.createStudentVocabRowList(['Name', 'Month', 'Week', 'Type', 'Progress']);
            monthVocabs
                .sort((a, b) => this.schedule.compareVocabularySchedule(a, b))
                .forEach(vocab => list.appendChild(this.createVocabularyRow(vocab)));

            container.appendChild(list);
            this.scheduleFirstVocabularyPreload(container);
            this.refreshIcons(container);
            return;
        }

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
        monthVocabs
            .sort((a, b) => this.schedule.compareVocabularySchedule(a, b))
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
