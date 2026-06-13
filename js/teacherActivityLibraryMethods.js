import { $, $$ } from './main.js';
import {
    DEFAULT_ACTIVITY_TEMPLATE_ID,
    DEFAULT_ACTIVITY_TYPE
} from './classroomActivityRegistry.js';
import {
    DEFAULT_SUBJECT_SLUG,
    getSubjectBySlug,
    normalizeSubjectSlug
} from './services/vocabularyApi.js';
import {
    createTeacherActivityCard,
    renderTeacherActivityClassBrowser,
    renderTeacherActivityGradePicker,
    renderTeacherActivityLibraryBreadcrumb,
    renderTeacherActivityLibraryBrowser,
    renderTeacherActivityMonthPicker,
    renderTeacherActivitySubjectPicker,
    renderTeacherActivityTrimesterPicker,
    renderTeacherActivityWeekPicker
} from './teacherActivityLibraryRenderers.js';
import {
    buildTeacherActivityLibraryGroups,
    buildTeacherActivityMonthWeekGroups,
    buildTeacherActivityTrimesterGroups,
    collapseDuplicateTeacherActivityItems,
    compareTeacherActivityGroupGrades,
    compareTeacherActivityPlacement,
    createTeacherDefaultActivity,
    formatTeacherActivityCount,
    formatTeacherActivityGroupGradeLabel,
    formatTeacherActivityMonthSummary,
    formatTeacherActivityTemplateSummary,
    formatTeacherActivityTrimesterSummary,
    formatTeacherActivityTypeSummary,
    formatTeacherActivityUpdatedLabel,
    formatTeacherActivityWeekLabel,
    formatTeacherActivityWeekShortLabel,
    formatTeacherActivityWeekSummary,
    getTeacherActivityDuplicateSignature,
    getTeacherActivityGroupGrades,
    getTeacherActivityMonthKey,
    getTeacherActivityPlacementSortValue,
    getTeacherActivityPlacementSource,
    getTeacherActivitySortName,
    getTeacherActivityTemplate,
    getTeacherActivityTemplateLabel,
    getTeacherActivityTemplateType,
    getTeacherActivityTimestamp,
    getTeacherActivityTrimesterKey,
    getTeacherActivityTypeLabel,
    getTeacherActivityWeekKey,
    getTeacherActivityWeekOrder,
    inferTeacherActivitySlotMinutes,
    inferTeacherActivityWeek,
    normalizeTeacherActivity,
    normalizeTeacherActivityGrades,
    normalizeTeacherActivityWeekKey
} from './teacherActivityLibraryModel.js';
import {
    cancelTeacherActivityAutoSave,
    fetchCloudTeacherActivities,
    getLocalTeacherActivities,
    getTeacherActivityLibrary as getTeacherActivityLibraryData,
    isTeacherActivityCloudSetupPending,
    isTeacherActivityDeleted,
    markTeacherActivityDeleted,
    removeLocalTeacherActivity,
    saveTeacherActivityToLocal
} from './teacherActivityPersistence.js';

const teacherActivityLibraryMethods = {
        getActivityTemplate(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
            return getTeacherActivityTemplate(templateId);
        },

        getActivityTemplateType(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
            return getTeacherActivityTemplateType(templateId);
        },

        getActivityTemplateLabel(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
            return getTeacherActivityTemplateLabel(templateId);
        },

        getActivityTypeLabel(activityType = DEFAULT_ACTIVITY_TYPE) {
            return getTeacherActivityTypeLabel(activityType);
        },

        createDefaultActivity(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
            return createTeacherDefaultActivity(templateId);
        },

        normalizeActivityGrades(activity = {}) {
            return normalizeTeacherActivityGrades(this, activity);
        },

        normalizeActivity(activity = {}) {
            return normalizeTeacherActivity(this, activity);
        },

        updateActivitySubjectSelect() {
            const select = $('#activity-subject');
            if (!select) return;
            const selected = normalizeSubjectSlug(this.activity?.subjectSlug || DEFAULT_SUBJECT_SLUG);
            select.innerHTML = this.getSubjectOptionsHtml(selected);
            select.value = selected;
        },

        getSubjectForActivity(activity = this.activity) {
            return getSubjectBySlug(this.getSubjects(), normalizeSubjectSlug(activity?.subjectSlug || DEFAULT_SUBJECT_SLUG));
        },

        invalidateActivityLibraryCache() {
            this.activityLibraryCache = null;
            this.activityLibraryPromise = null;
            this.activityLibraryStale = true;
        },

        getActivityDuplicateSignature(activity = {}) {
            return getTeacherActivityDuplicateSignature(this, activity);
        },

        getActivityTimestamp(activity = {}) {
            return getTeacherActivityTimestamp(activity);
        },

        collapseDuplicateActivityItems(items = []) {
            return collapseDuplicateTeacherActivityItems(this, items);
        },

        isActivityCloudSetupPending(error) {
            return isTeacherActivityCloudSetupPending(error);
        },

        cancelActivityAutoSave(id = null) {
            cancelTeacherActivityAutoSave(this, id);
        },

        markActivityDeleted(id) {
            markTeacherActivityDeleted(this, id);
        },

        isActivityDeleted(id) {
            return isTeacherActivityDeleted(this, id);
        },

        getLocalActivities() {
            return getLocalTeacherActivities(this);
        },

        saveActivityToLocal(activity = this.activity) {
            saveTeacherActivityToLocal(this, activity);
        },

        removeLocalActivity(id) {
            return removeLocalTeacherActivity(this, id);
        },

        async fetchCloudActivities() {
            return fetchCloudTeacherActivities(this);
        },

        async getTeacherActivityLibrary({ forceRefresh = false } = {}) {
            return getTeacherActivityLibraryData(this, { forceRefresh });
        },

        async showActivityLibrary() {
            if (!this.ensureAuthenticated(false)) return;
            this.lastActivitiesRoute = {
                view: 'activities',
                subject: this.activityDrilldown.subject,
                grade: this.activityDrilldown.grade,
                trimester: this.activityDrilldown.trimester,
                month: this.activityDrilldown.month,
                week: this.activityDrilldown.week,
                mode: this.activityMode
            };
            this.switchView('teacher-activities-view');
            this.setActivityWorkflowTab(this.activityMode || 'assign');
            await this.loadActivityLibrary();
            if (this.activityMode === 'review') {
                await this.loadActivityAssignments();
            }
        },

        setActivityWorkflowTab(mode = 'assign', options = {}) {
            const nextMode = mode === 'review' ? 'review' : 'assign';
            this.activityMode = nextMode;

            $$('.activity-workflow-tab').forEach(tab => {
                const active = tab.dataset.activityTab === nextMode;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
                tab.tabIndex = active ? 0 : -1;
            });

            const assignPanel = $('#activity-assign-panel');
            const reviewPanel = $('#activity-review-panel');
            assignPanel?.classList.toggle('hidden', nextMode !== 'assign');
            reviewPanel?.classList.toggle('hidden', nextMode !== 'review');

            if (nextMode === 'assign' && this.activityLibraryLoaded) {
                const list = $('#activity-library-list');
                if (list && this.activityLibraryItems.length === 0) {
                    list.innerHTML = '<p class="teacher-empty-state">No classroom activities yet.</p>';
                } else {
                    this.renderActivityLibraryBrowser();
                }
            }
            if (nextMode === 'review' && !this.activityAssignmentRefreshing) {
                this.loadActivityAssignments();
            }

            if (options.updateRoute !== false) {
                this.updateActivityRoute({ replace: true });
            }
        },

        async loadActivityLibrary() {
            const list = $('#activity-library-list');
            if (!list) return;

            if (!this.authDisabled && !this.isAuthenticated) {
                list.innerHTML = '<p>Please sign in to view activities.</p>';
                return;
            }

            const renderActiveList = this.activityMode === 'assign';
            const hasUsableContent = renderActiveList
                && this.activityLibraryItems.length > 0
                && Boolean(list.textContent.trim())
                && !list.querySelector('.loading-spinner');

            this.activityLibraryRefreshing = true;
            if (renderActiveList && !hasUsableContent) {
                list.innerHTML = '<div class="loading-spinner">Loading activities...</div>';
            } else if (renderActiveList) {
                list.setAttribute('aria-busy', 'true');
            }

            try {
                const { cloudActivities, localActivities, items } = await this.getTeacherActivityLibrary();
                this.activityLibraryRefreshing = false;

                if (this.activityLibraryLastFetchFailed && this.activityLibraryItems.length > 0) {
                    this.activityLibraryCache = null;
                    this.activityLibraryStale = true;
                    list.removeAttribute('aria-busy');
                    this.refreshIcons();
                    return;
                }

                if (renderActiveList) {
                    list.innerHTML = '';
                }
                this.activityLibraryItems = items;
                this.activityLibraryLoaded = true;
                this.activityLibraryStale = false;

                if (cloudActivities.length === 0 && localActivities.length === 0) {
                    if (this.activityMode === 'assign') {
                        list.innerHTML = '<p class="teacher-empty-state">No classroom activities yet.</p>';
                    }
                    list.removeAttribute('aria-busy');
                    return;
                }

                if (this.activityMode === 'assign') {
                    this.renderActivityLibraryBrowser(list);
                }
                list.removeAttribute('aria-busy');
                this.refreshIcons();
            } catch (error) {
                console.error('Failed to load classroom activities:', error);
                this.activityLibraryRefreshing = false;
                this.activityLibraryStale = this.activityLibraryItems.length > 0;
                list.removeAttribute('aria-busy');
                if (!hasUsableContent) {
                    list.innerHTML = '<p class="teacher-empty-state">Could not load classroom activities.</p>';
                }
            }
        },

        resetActivityLibraryDrilldown() {
            this.activityDrilldown = {
                subject: null,
                grade: null,
                trimester: null,
                month: null,
                week: null
            };
        },

        formatActivityCount(count) {
            return formatTeacherActivityCount(count);
        },

        getActivityGroupGrades(activity = {}) {
            return getTeacherActivityGroupGrades(this, activity);
        },

        formatActivityGroupGradeLabel(grade) {
            return formatTeacherActivityGroupGradeLabel(this, grade);
        },

        compareActivityGroupGrades(gradeA, gradeB) {
            return compareTeacherActivityGroupGrades(this, gradeA, gradeB);
        },

        buildActivityLibraryGroups(items = this.activityLibraryItems) {
            return buildTeacherActivityLibraryGroups(this, items);
        },

        renderActivityLibraryBrowser(container = $('#activity-library-list')) {
            renderTeacherActivityLibraryBrowser(this, container);
        },

        renderActivityLibraryBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null, selectedWeek = null) {
            renderTeacherActivityLibraryBreadcrumb(this, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek);
        },

        formatActivityTemplateSummary(activityItems = []) {
            return formatTeacherActivityTemplateSummary(this, activityItems);
        },

        formatActivityTypeSummary(activityItems = []) {
            return formatTeacherActivityTypeSummary(this, activityItems);
        },

        formatActivityMonthSummary(monthGroups) {
            return formatTeacherActivityMonthSummary(this, monthGroups);
        },

        formatActivityTrimesterSummary(trimesterGroups) {
            return formatTeacherActivityTrimesterSummary(this, trimesterGroups);
        },

        formatActivityWeekSummary(weekGroups) {
            return formatTeacherActivityWeekSummary(this, weekGroups);
        },

        renderActivitySubjectPicker(container, subjectGroups) {
            renderTeacherActivitySubjectPicker(this, container, subjectGroups);
        },

        renderActivityGradePicker(container, selectedSubject, gradeGroups) {
            renderTeacherActivityGradePicker(this, container, selectedSubject, gradeGroups);
        },

        renderActivityMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
            renderTeacherActivityMonthPicker(this, container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
        },

        renderActivityTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups) {
            renderTeacherActivityTrimesterPicker(this, container, selectedSubject, selectedGrade, trimesterGroups);
        },

        renderActivityWeekPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, weekGroups) {
            renderTeacherActivityWeekPicker(this, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, weekGroups);
        },

        renderActivityClassBrowser(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek, activityItems) {
            renderTeacherActivityClassBrowser(this, container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, selectedWeek, activityItems);
        },

        getActivitySortName(activity) {
            return getTeacherActivitySortName(activity);
        },

        getActivityPlacementSource(activity = {}) {
            return getTeacherActivityPlacementSource(activity);
        },

        getActivityMonthKey(activity = {}) {
            return getTeacherActivityMonthKey(this, activity);
        },

        getActivityTrimesterKey(activity = {}) {
            return getTeacherActivityTrimesterKey(this, activity);
        },

        inferActivityWeek(activity = {}) {
            return inferTeacherActivityWeek(activity);
        },

        normalizeActivityWeekKey(weekKey) {
            return normalizeTeacherActivityWeekKey(weekKey);
        },

        getActivityWeekKey(activity = {}) {
            return getTeacherActivityWeekKey(activity);
        },

        getActivityWeekOrder(weekKey) {
            return getTeacherActivityWeekOrder(weekKey);
        },

        formatActivityWeekLabel(weekKey) {
            return formatTeacherActivityWeekLabel(weekKey);
        },

        formatActivityWeekShortLabel(weekKey) {
            return formatTeacherActivityWeekShortLabel(weekKey);
        },

        inferActivitySlotMinutes(activity = {}) {
            return inferTeacherActivitySlotMinutes(activity);
        },

        buildActivityMonthWeekGroups(activityItems = []) {
            return buildTeacherActivityMonthWeekGroups(this, activityItems);
        },

        buildActivityTrimesterGroups(activityItems = []) {
            return buildTeacherActivityTrimesterGroups(this, activityItems);
        },

        getActivityPlacementSortValue(activity = {}) {
            return getTeacherActivityPlacementSortValue(this, activity);
        },

        compareActivityPlacement(activityA = {}, activityB = {}) {
            return compareTeacherActivityPlacement(this, activityA, activityB);
        },

        formatActivityUpdatedLabel(activity = {}) {
            return formatTeacherActivityUpdatedLabel(this, activity);
        },

        createActivityCard(container, activity, type) {
            createTeacherActivityCard(this, container, activity, type);
        },
};

export function installTeacherActivityLibraryMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherActivityLibraryMethods);
}
