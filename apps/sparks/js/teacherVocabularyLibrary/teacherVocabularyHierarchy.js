import { createElement } from '../main.js';
import { getSubjectBySlug } from '../services/vocabularyApi.js';

export function createVocabularyChoiceCard({ title, count, meta, icon, color = '' }) {
    const card = createElement('button', 'teacher-library-choice-card');
    card.type = 'button';

    const text = createElement('span', 'teacher-library-choice-text');
    const titleEl = createElement('strong', 'card-title', title);
    const countEl = createElement('span', 'teacher-library-choice-count card-secondary', count);
    if (color) {
        const dot = createElement('span', 'subject-color-dot');
        dot.style.background = color;
        text.appendChild(dot);
    }
    text.append(titleEl, countEl);
    if (meta) text.appendChild(createElement('small', 'card-caption', meta));
    card.appendChild(text);

    if (icon) {
        const iconEl = createElement('i');
        iconEl.setAttribute('data-lucide', icon);
        card.appendChild(iconEl);
    }
    return card;
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
    const nav = createElement('div', 'teacher-library-breadcrumb breadcrumb');
    nav.dataset.breadcrumbDepth = month ? 'month' : trimester ? 'trimester' : grade ? 'grade' : subject ? 'subject' : 'root';

    const rootButton = createVocabularyBreadcrumbButton('Subjects', () => onNavigate({
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

    breadcrumbHost.appendChild(nav);
}

export function renderVocabularySubjectPicker(host, options, subjectGroups) {
    renderVocabularyBreadcrumb(host, { ...options, drilldown: {} });
    const grid = createElement('div', 'teacher-library-choice-grid');
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
            const card = createVocabularyChoiceCard({
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
    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(gradeGroups.entries())
        .sort(([gradeA], [gradeB]) => host.compareGradeLabels(gradeA, gradeB))
        .forEach(([grade, trimesterGroups]) => {
            const totalUnits = Array.from(trimesterGroups.values()).reduce((sum, group) => sum + group.length, 0);
            const trimesterSummary = Array.from(trimesterGroups.entries())
                .sort(([trimesterA], [trimesterB]) => host.getTeacherTrimesterOrder(trimesterA) - host.getTeacherTrimesterOrder(trimesterB))
                .map(([trimesterKey, vocabItems]) => `${host.getTeacherTrimesterShortLabel(trimesterKey)}: ${vocabItems.length}`)
                .join(' · ');
            const card = createVocabularyChoiceCard({
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
    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(trimesterGroups.entries())
        .sort(([trimesterA], [trimesterB]) => host.getTeacherTrimesterOrder(trimesterA) - host.getTeacherTrimesterOrder(trimesterB))
        .forEach(([trimesterKey, vocabItems]) => {
            const monthSummary = host.formatMonthSummary(host.buildMonthGroups(vocabItems));
            const card = createVocabularyChoiceCard({
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
    const grid = createElement('div', 'teacher-library-choice-grid');
    Array.from(monthGroups.entries())
        .sort(([monthA], [monthB]) => host.getTeacherMonthOrder(monthA) - host.getTeacherMonthOrder(monthB))
        .forEach(([monthKey, vocabItems]) => {
            const card = createVocabularyChoiceCard({
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
    const { container, items, drilldown, getViewMode, resetDrilldown, filterItems, renderRows, renderAssignments } = options;
    const subjectGroups = host.buildLibraryGroups(items);
    const selectedSubject = drilldown.subject;
    const selectedGrade = drilldown.grade;
    const selectedTrimester = drilldown.trimester;
    const selectedMonth = drilldown.month;

    if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
        resetDrilldown();
        if (getViewMode({}) === 'rows') {
            renderVocabularyBreadcrumb(host, { ...options, drilldown: {} });
            renderRows(container, items);
        } else {
            renderVocabularySubjectPicker(host, options, subjectGroups);
        }
        return;
    }

    const gradeGroups = subjectGroups.get(selectedSubject);
    if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
        Object.assign(drilldown, { grade: null, trimester: null, month: null });
        if (getViewMode({ subject: selectedSubject }) === 'rows') {
            renderVocabularyBreadcrumb(host, { ...options, drilldown: { subject: selectedSubject } });
            renderRows(container, filterItems({ subject: selectedSubject }));
        } else {
            renderVocabularyGradePicker(host, options, selectedSubject, gradeGroups);
        }
        return;
    }

    const trimesterGroups = gradeGroups.get(selectedGrade);
    if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
        Object.assign(drilldown, { trimester: null, month: null });
        if (getViewMode({ subject: selectedSubject, grade: selectedGrade }) === 'rows') {
            renderVocabularyBreadcrumb(host, { ...options, drilldown: { subject: selectedSubject, grade: selectedGrade } });
            renderRows(container, filterItems({ subject: selectedSubject, grade: selectedGrade }));
        } else {
            renderVocabularyTrimesterPicker(host, options, selectedSubject, selectedGrade, trimesterGroups);
        }
        return;
    }

    const monthGroups = host.buildMonthGroups(trimesterGroups.get(selectedTrimester));
    if (!selectedMonth || !monthGroups.has(selectedMonth)) {
        drilldown.month = null;
        if (getViewMode({ subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester }) === 'rows') {
            renderVocabularyBreadcrumb(host, {
                ...options,
                drilldown: { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester }
            });
            renderRows(container, trimesterGroups.get(selectedTrimester));
        } else {
            renderVocabularyMonthPicker(host, options, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
        }
        return;
    }

    renderVocabularyBreadcrumb(host, { ...options, drilldown });
    renderAssignments(container, monthGroups.get(selectedMonth));
}
