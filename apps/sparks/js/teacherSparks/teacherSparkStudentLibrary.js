import { getAutomaticClassSparkLocation } from '../student/studentClassSparkModel.js';
import { formatShortDate } from './sparkSchedule.js';
import { createElement } from '../main.js';
import { schoolContext } from '../services/schoolContext.js';
import { calculateVocabularyPlacement } from '../services/schoolCalendar.js';
import { filterLibraryItems, renderLibraryControls } from '../teacherLibraryControls.js';
import { bindFloatingActionMenu } from '../ui/floatingActionMenu.js';
import { renderClassSparkLibrary, renderSparkViewToggle, sparkBreadcrumb } from '../student/studentClassSparkLibrary.js';

export async function renderTeacherSparkBrowser(owner, list) {
    void import('../../css/teacher-student-library.css');
    const request = owner.sparkBrowserGeneration = (owner.sparkBrowserGeneration || 0) + 1;
    const lifecycle = owner.weeklySparkLifecycleGeneration;
    const current = () => request === owner.sparkBrowserGeneration && lifecycle === owner.weeklySparkLifecycleGeneration && list.isConnected;
    list.classList.add('teacher-student-library');
    const state = owner.sparkSearchState ||= { status: 'all', query: '', grade: '', trimester: '' };
    const workspace = list.closest('#teacher-spark-library-panel') || list;
    if (!list.querySelector('.teacher-spark-browser-body')) {
        const body = createElement('div', 'teacher-spark-browser-body');
        if (workspace !== list) list.replaceChildren(body);
        else {
            const crumb = createElement('div', 'teacher-library-location teacher-spark-breadcrumb');
            const toolbar = createElement('div', 'teacher-library-control-row');
            toolbar.append(createElement('div', 'teacher-spark-search'), createElement('div', 'vocab-view-toggle segmented-control'));
            list.replaceChildren(crumb, toolbar, createElement('p', 'teacher-library-result-count'), body);
        }
    }
    renderLibraryControls(workspace.querySelector('#teacher-spark-filters, .teacher-spark-search, .teacher-library-filters'), {
        state, statuses: [['all', 'All materials'], ['scheduled', 'Saved materials'], ['draft', 'Drafts'], ['archived', 'Archived']],
        onChange: () => { void renderTeacherSparkBrowser(owner, list); }
    });
    const root = list.querySelector('.teacher-spark-browser-body');
    const toggle = workspace.querySelector('.segmented-control');
    renderSparkViewToggle(owner.sparkBrowserMode || 'cards', mode => {
        owner.sparkBrowserMode = mode; void renderTeacherSparkBrowser(owner, list);
    }, false, toggle);
    const calendar = owner.getSchoolCalendar?.();
    const source = owner.weeklySparkItems.map(spark => {
        const placement = calculateVocabularyPlacement(spark.scheduledDate, calendar);
        return { id: spark.id, title: spark.title, date: spark.scheduledDate || '2000-01-01',
            trimester: placement?.trimester || 'other', month: placement?.month || 'other', spark };
    });
    const items = filterLibraryItems(source, state, {
        getTitle: item => item.title || '', getStatus: item => item.spark.status,
        getGrades: item => item.spark.targetGrades || ['6', '7', '8', '9'], getTrimester: item => item.trimester
    }).sort((a, b) => a.title.localeCompare(b.title));
    if (!owner.sparkBrowserRoute && items.length) owner.sparkBrowserRoute = getAutomaticClassSparkLocation(items, calendar) || { all: true };
    const location = owner.sparkBrowserRoute || {};
    const count = items.filter(item => (!location.trimester || item.trimester === location.trimester) && (!location.month || item.month === location.month)).length;
    workspace.querySelector('.teacher-library-result-count').textContent = `${count} ${count === 1 ? 'material' : 'materials'}`;
    const navigate = route => {
        if (route.sparkId) {
            const spark = owner.findSparkById(route.sparkId);
            void import('../teacherStudentPreview.js').then(({ previewTeacherSpark }) => {
                if (current()) previewTeacherSpark(spark, { isCurrent: current });
            });
        } else { owner.sparkBrowserRoute = route; void renderTeacherSparkBrowser(owner, list); }
    };
    const crumb = workspace.querySelector('#teacher-spark-breadcrumb, .teacher-spark-breadcrumb');
    if (crumb) { crumb.replaceChildren(sparkBreadcrumb(location, navigate)); crumb.hidden = !location.trimester && !location.month; }
    const repository = {
        readAssignment: async id => ({ content: owner.findSparkById(id) }),
        listResponses: async () => []
    };
    await renderClassSparkLibrary(root, {
        items, route: owner.sparkBrowserRoute || { all: true }, navigate, repository, current,
        viewMode: owner.sparkBrowserMode || 'cards',
        getDateLabel: item => item.spark.scheduledDate ? formatShortDate(item.spark.scheduledDate) : 'No date',
        getStatus: item => owner.formatSparkStatusLabel(item.spark.status),
        emptyMessage: 'No Spark materials in this view.',
        decorateCard(card, item) {
            const wrapper = createElement('article', `teacher-material-item${owner.sparkBrowserMode === 'rows' ? ' teacher-material-row' : ''}`);
            const actions = createElement('div', 'teacher-material-actions');
            const button = (label, action) => {
                const node = createElement('button', 'btn secondary-btn', label); node.type = 'button';
                node.dataset.sparkAction = action; node.dataset.sparkId = item.id; actions.append(node);
            };
            button('Student preview', 'preview');
            button('Edit', 'edit');
            if (owner.publishMaterial && schoolContext.hasRole('teacher') && !owner.isAuthenticationDisabled()) button('Assign', 'assign');
            const menu = createElement('div');
            const trigger = createElement('button', 'btn secondary-btn');
            trigger.setAttribute('aria-label', `More actions for ${item.title}`);
            button('Duplicate', 'duplicate');
            if (item.spark.status !== 'archived') { button('Archive', 'archive'); }
            menu.append(...actions.children);
            menu.setAttribute('aria-label', `Actions for ${item.title}`);
            menu.querySelectorAll('button').forEach(node => node.setAttribute('role', 'menuitem'));
            actions.append(trigger, menu); bindFloatingActionMenu({ trigger, menu });
            const metadata = createElement('small', 'teacher-material-context', item.spark.targetGrades?.map(value => `Grade ${value}`).join(' · ') || 'All grades');
            card.querySelector('.student-vocab-copy')?.append(metadata);
            wrapper.append(card, actions); return wrapper;
        }
    });
    if (current()) {
        root.querySelector(':scope > .student-spark-breadcrumb')?.remove();
        owner.refreshIcons(workspace);
    }
}
