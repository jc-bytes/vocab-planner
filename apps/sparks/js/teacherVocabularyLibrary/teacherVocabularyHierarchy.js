import { createLibraryChoiceCard, createLibraryRowList, createLibraryRow } from '../learningLibraryView.js';
import { renderStudentMonthNavigation } from '../student/studentMonthNavigation.js';
import { createElement } from '../main.js';
import { getSubjectBySlug } from '../services/vocabularyApi.js';

export function createVocabularyChoiceCard({ title, count, meta, icon, color = '' }) {
    return createLibraryChoiceCard({ title, count, meta, icon });
}

export function createVocabularyBreadcrumbButton(label, onClick) {
    const button = createElement('button', 'teacher-library-crumb-btn breadcrumb__item', label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
}

function appendBreadcrumbPart(nav, name, value, isCurrent, onClick) {
    const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
    separator.dataset.beforeCrumb = name;
    separator.setAttribute('aria-hidden', 'true');
    nav.appendChild(separator);
    const node = isCurrent
        ? createElement('span', 'teacher-library-breadcrumb-current breadcrumb__current', value)
        : createVocabularyBreadcrumbButton(value, onClick);
    node.dataset.crumb = name;
    if (isCurrent) node.setAttribute('aria-current', 'page');
    nav.appendChild(node);
}

export function renderVocabularyBreadcrumb(host, {
    container,
    breadcrumbHost = container,
    drilldown = {},
    onNavigate
}) {
    const { subject, grade, trimester, month } = drilldown;
    breadcrumbHost.innerHTML = '';
    breadcrumbHost.hidden = !subject;
    const nav = createElement('nav', 'teacher-library-breadcrumb breadcrumb');
    nav.setAttribute('aria-label', 'Vocabulary location');
    nav.dataset.breadcrumbDepth = month ? 'month' : trimester ? 'trimester' : grade ? 'grade' : subject ? 'subject' : 'root';

    const rootButton = createVocabularyBreadcrumbButton('Vocabulary', () => onNavigate({
        subject: null, grade: null, trimester: null, month: null
    }));
    rootButton.dataset.crumb = 'root';
    if (!subject) rootButton.setAttribute('aria-current', 'page');
    nav.appendChild(rootButton);

    if (subject) {
        const subjectMeta = getSubjectBySlug(host.getSubjects(), subject);
        appendBreadcrumbPart(nav, 'subject', subjectMeta.name, !grade && !trimester && !month, () => onNavigate({
            subject, grade: null, trimester: null, month: null
        }));
    }
    if (grade) {
        appendBreadcrumbPart(nav, 'grade', host.formatGradeLabel(grade), !trimester && !month, () => onNavigate({
            subject, grade, trimester: null, month: null
        }));
    }
    if (trimester) {
        appendBreadcrumbPart(nav, 'trimester', host.getTeacherTrimesterLabel(trimester), !month, () => onNavigate({
            subject, grade, trimester, month: null
        }));
    }
    if (month) {
        appendBreadcrumbPart(nav, 'month', host.getTeacherMonthLabel(month), true, () => {});
    }

    if (month && host.getTeacherMonthLabel(month).toLowerCase() === new Date().toLocaleString('en-US', {month:'long',timeZone:'America/Panama'}).toLowerCase()) {
        nav.appendChild(createElement('span', 'student-current-month-badge context-badge', 'Current Month'));
    }
    breadcrumbHost.appendChild(nav);
}

function hierarchyList(options, headers) {
    const rows = options.getViewMode(options.drilldown) === 'rows';
    const list = rows ? createLibraryRowList(headers) : createElement('div', 'teacher-library-choice-grid');
    return { list, choice: config => rows
        ? createLibraryRow({ primary: config.title, cells: [config.meta || '', config.count], icon: config.icon })
        : createVocabularyChoiceCard(config) };
}

export function renderVocabularySubjectPicker(host, options, subjectGroups) {
    renderVocabularyBreadcrumb(host, { ...options, drilldown: {} });
    const { list: grid, choice } = hierarchyList(options, ['Subject', 'Grades', 'Units']);
    Array.from(subjectGroups.entries())
        .sort(([subjectA], [subjectB]) => {
            const metaA = getSubjectBySlug(host.getSubjects(), subjectA);
            const metaB = getSubjectBySlug(host.getSubjects(), subjectB);
            return metaA.sortOrder - metaB.sortOrder || metaA.name.localeCompare(metaB.name);
        })
        .forEach(([subjectSlug, gradeGroups]) => {
            const subject = getSubjectBySlug(host.getSubjects(), subjectSlug);
            const totalUnits = Array.from(gradeGroups.values())
                .reduce((sum, trimesterGroups) => sum + Array.from(trimesterGroups.values())
                    .reduce((inner, group) => inner + group.length, 0), 0);
            const gradeSummary = Array.from(gradeGroups.keys())
                .sort((gradeA, gradeB) => host.compareGradeLabels(gradeA, gradeB))
                .map(grade => host.formatGradeLabel(grade))
                .join(' · ');
            const card = choice({
                title: subject.name,
                count: host.formatUnitCount(totalUnits),
                meta: gradeSummary,
                icon: 'chevron-right',
                color: subject.color
            });
            card.addEventListener('click', () => options.onNavigate({
                subject: subjectSlug, grade: null, trimester: null, month: null
            }));
            grid.appendChild(card);
        });
    options.container.appendChild(grid);
}

export function renderVocabularyGradePicker(host, options, selectedSubject, gradeGroups) {
    renderVocabularyBreadcrumb(host, { ...options, drilldown: { subject: selectedSubject } });
    const { list: grid, choice } = hierarchyList(options, ['Grade', 'Trimesters', 'Units']);
    Array.from(gradeGroups.entries())
        .sort(([gradeA], [gradeB]) => host.compareGradeLabels(gradeA, gradeB))
        .forEach(([grade, trimesterGroups]) => {
            const totalUnits = Array.from(trimesterGroups.values()).reduce((sum, group) => sum + group.length, 0);
            const trimesterSummary = Array.from(trimesterGroups.entries())
                .sort(([trimesterA], [trimesterB]) => host.getTeacherTrimesterOrder(trimesterA) - host.getTeacherTrimesterOrder(trimesterB))
                .map(([trimesterKey, vocabItems]) => `${host.getTeacherTrimesterShortLabel(trimesterKey)}: ${vocabItems.length}`)
                .join(' · ');
            const card = choice({
                title: host.formatGradeLabel(grade),
                count: host.formatUnitCount(totalUnits),
                meta: trimesterSummary,
                icon: 'chevron-right'
            });
            card.addEventListener('click', () => options.onNavigate({
                subject: selectedSubject, grade, trimester: null, month: null
            }));
            grid.appendChild(card);
        });
    options.container.appendChild(grid);
}

export function renderVocabularyTrimesterPicker(host, options, selectedSubject, selectedGrade, trimesterGroups) {
    renderVocabularyBreadcrumb(host, {
        ...options,
        drilldown: { subject: selectedSubject, grade: selectedGrade }
    });
    const { list: grid, choice } = hierarchyList(options, ['Trimester', 'Months', 'Units']);
    Array.from(trimesterGroups.entries())
        .sort(([trimesterA], [trimesterB]) => host.getTeacherTrimesterOrder(trimesterA) - host.getTeacherTrimesterOrder(trimesterB))
        .forEach(([trimesterKey, vocabItems]) => {
            const monthSummary = host.formatMonthSummary(host.buildMonthGroups(vocabItems));
            const card = choice({
                title: host.getTeacherTrimesterLabel(trimesterKey),
                count: host.formatUnitCount(vocabItems.length),
                meta: monthSummary || host.formatGradeLabel(selectedGrade),
                icon: 'chevron-right'
            });
            card.addEventListener('click', () => options.onNavigate({
                subject: selectedSubject, grade: selectedGrade, trimester: trimesterKey, month: null
            }));
            grid.appendChild(card);
        });
    options.container.appendChild(grid);
}

export function renderVocabularyMonthPicker(host, options, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
    renderVocabularyBreadcrumb(host, {
        ...options,
        drilldown: { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester }
    });
    const { list: grid, choice } = hierarchyList(options, ['Month', 'Grade', 'Units']);
    Array.from(monthGroups.entries())
        .sort(([monthA], [monthB]) => host.getTeacherMonthOrder(monthA) - host.getTeacherMonthOrder(monthB))
        .forEach(([monthKey, vocabItems]) => {
            const card = choice({
                title: host.getTeacherMonthLabel(monthKey),
                count: host.formatUnitCount(vocabItems.length),
                meta: host.formatGradeLabel(selectedGrade),
                icon: 'chevron-right'
            });
            card.addEventListener('click', () => options.onNavigate({
                subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: monthKey
            }));
            grid.appendChild(card);
        });
    options.container.appendChild(grid);
}

export function renderTeacherVocabularyHierarchy(host, options) {
    const { container, items, drilldown, resetDrilldown, renderAssignments } = options;
    const subjectGroups = host.buildLibraryGroups(items);
    const selectedSubject = drilldown.subject;
    const selectedGrade = drilldown.grade;
    const selectedTrimester = drilldown.trimester;
    const selectedMonth = drilldown.month;

    if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
        resetDrilldown();
        renderVocabularySubjectPicker(host, options, subjectGroups);
        return;
    }

    const gradeGroups = subjectGroups.get(selectedSubject);
    if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
        Object.assign(drilldown, { grade: null, trimester: null, month: null });
        renderVocabularyGradePicker(host, options, selectedSubject, gradeGroups);
        return;
    }

    const trimesterGroups = gradeGroups.get(selectedGrade);
    if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
        Object.assign(drilldown, { trimester: null, month: null });
        renderVocabularyTrimesterPicker(host, options, selectedSubject, selectedGrade, trimesterGroups);
        return;
    }

    const monthGroups = host.buildMonthGroups(trimesterGroups.get(selectedTrimester));
    if (!selectedMonth || !monthGroups.has(selectedMonth)) {
        drilldown.month = null;
        renderVocabularyMonthPicker(host, options, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
        return;
    }

    renderVocabularyBreadcrumb(host, { ...options, drilldown });
    renderStudentMonthNavigation(container, {
        sortedMonths: [...monthGroups.keys()].sort((a, b) => host.getTeacherMonthOrder(a) - host.getTeacherMonthOrder(b)),
        selectedMonth, monthLabel: month => host.getTeacherMonthLabel(month),
        ariaLabel: 'Vocabulary month navigation',
        navigate: month => options.onNavigate({ ...drilldown, month })
    });
    renderAssignments(container, monthGroups.get(selectedMonth));
}
