import {
    renderCardSortSubmissionReview as renderSharedCardSortSubmissionReview,
    renderExternalArtifactSubmissionReview as renderSharedExternalArtifactSubmissionReview,
    renderFlowchartSubmissionReview as renderSharedFlowchartSubmissionReview,
    renderImageHotspotSubmissionReview as renderSharedImageHotspotSubmissionReview,
    renderSpreadsheetSubmissionReview as renderSharedSpreadsheetSubmissionReview,
    renderStructuredSubmissionReview as renderSharedStructuredSubmissionReview
} from './classroomActivityRenderers.js';
import {
    createTeacherActivityAssignmentCard,
    renderTeacherActivityAssignmentBreadcrumb,
    renderTeacherActivityAssignmentBrowser,
    renderTeacherActivityAssignmentClassBrowser,
    renderTeacherActivityAssignmentGradePicker,
    renderTeacherActivityAssignmentSubjectPicker
} from './teacherActivityAssignmentRenderers.js';
import {
    buildTeacherActivityAssignmentGroups,
    buildTeacherActivityAssignmentUpdatePayload,
    createTeacherActivityAssignmentId,
    formatStartedTeacherSubmissionWarning,
    formatTeacherActivityAssignmentCount,
    formatTeacherActivityAssignmentWindow,
    formatTeacherActivityDueDate,
    formatTeacherAssignmentReviewSummary,
    formatTeacherAssignmentTarget,
    formatTeacherAvailableDate,
    formatTeacherDateOnly,
    getTeacherActivityAssignmentGroupGrades,
    getTeacherActivityAssignmentSortValue,
    getTeacherActivityLateState,
    getTeacherLocalDateInputValue,
    getTeacherStudentRosterMeta,
    getTeacherStudentRosterName,
    isTeacherActivityAssignmentScheduled,
    normalizeTeacherActivityAssignment,
    normalizeTeacherActivitySubmission,
    normalizeTeacherActivityTargetList,
    readTeacherActivityAssignmentForm,
    teacherActivityAssignmentMatchesStudent,
    teacherActivityDueDateEndMillis,
    teacherActivityTimestampToMillis
} from './teacherActivityAssignmentModel.js';
import {
    createTeacherActivityAssignmentSnapshot,
    deleteTeacherActivityAssignment,
    fetchTeacherActivityAssignments,
    fetchTeacherActivitySubmissions,
    getTeacherActivityAssignments as getTeacherActivityAssignmentsData,
    invalidateTeacherActivityAssignmentCache,
    isTeacherActivityAssignmentCloudSetupPending,
    loadTeacherActivityAssignments,
    openTeacherActivityAssignmentModal,
    resolveTeacherActivitySubmissionScene,
    saveTeacherActivityAssignment,
    setTeacherActivityAssignmentModalStatus,
    toggleTeacherActivityLateOverride,
    updatePublishedTeacherActivityAssignmentFromSource
} from './teacherActivityAssignmentController.js';
import {
    clearTeacherActivityReviewCanvas,
    openTeacherActivitySubmissionReview,
    renderTeacherActivityAssignmentReview,
    selectTeacherActivityReviewStudent,
    showAdjacentTeacherActivityReviewStudent,
    showTeacherActivityAssignmentReview,
    updateTeacherActivityReviewNavigation
} from './teacherActivityReviewController.js';

const teacherActivityAssignmentMethods = {
        normalizeTargetList(value, { uppercase = false } = {}) {
            return normalizeTeacherActivityTargetList(value, { uppercase });
        },

        normalizeActivityAssignment(assignment = {}) {
            return normalizeTeacherActivityAssignment(this, assignment);
        },

        normalizeActivitySubmission(submission = {}) {
            return normalizeTeacherActivitySubmission(submission);
        },

        createActivityAssignmentSnapshot(activity = this.activity) {
            return createTeacherActivityAssignmentSnapshot(this, activity);
        },

        openActivityAssignmentModal(activity = this.activity) {
            openTeacherActivityAssignmentModal(this, activity);
        },

        getLocalDateInputValue(date = new Date()) {
            return getTeacherLocalDateInputValue(date);
        },

        setActivityAssignmentModalStatus(text, state = 'muted') {
            setTeacherActivityAssignmentModalStatus(text, state);
        },

        readActivityAssignmentForm() {
            return readTeacherActivityAssignmentForm(this);
        },

        createActivityAssignmentId(activity = {}) {
            return createTeacherActivityAssignmentId(this, activity);
        },

        async saveActivityAssignment(event) {
            await saveTeacherActivityAssignment(this, event);
        },

        invalidateActivityAssignmentCache() {
            invalidateTeacherActivityAssignmentCache(this);
        },

        isActivityAssignmentCloudSetupPending(error) {
            return isTeacherActivityAssignmentCloudSetupPending(error);
        },

        async fetchActivityAssignments() {
            return fetchTeacherActivityAssignments(this);
        },

        async getActivityAssignments({ forceRefresh = false } = {}) {
            return getTeacherActivityAssignmentsData(this, { forceRefresh });
        },

        async loadActivityAssignments() {
            await loadTeacherActivityAssignments(this);
        },

        formatActivityAssignmentCount(count) {
            return formatTeacherActivityAssignmentCount(count);
        },

        getActivityAssignmentGroupGrades(assignment = {}) {
            return getTeacherActivityAssignmentGroupGrades(this, assignment);
        },

        buildActivityAssignmentGroups(assignments = this.activityAssignmentItems) {
            return buildTeacherActivityAssignmentGroups(this, assignments);
        },

        renderActivityAssignmentBrowser(container = $('#activity-assignment-list')) {
            renderTeacherActivityAssignmentBrowser(this, container);
        },

        renderActivityAssignmentBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null) {
            renderTeacherActivityAssignmentBreadcrumb(this, container, selectedSubject, selectedGrade, selectedTrimester);
        },

        formatAssignmentReviewSummary(assignments = []) {
            return formatTeacherAssignmentReviewSummary(this, assignments);
        },

        renderActivityAssignmentSubjectPicker(container, subjectGroups) {
            renderTeacherActivityAssignmentSubjectPicker(this, container, subjectGroups);
        },

        renderActivityAssignmentGradePicker(container, selectedSubject, gradeGroups) {
            renderTeacherActivityAssignmentGradePicker(this, container, selectedSubject, gradeGroups);
        },

        renderActivityAssignmentClassBrowser(container, selectedSubject, selectedGrade, selectedTrimester, assignments) {
            renderTeacherActivityAssignmentClassBrowser(this, container, selectedSubject, selectedGrade, selectedTrimester, assignments);
        },

        getActivityAssignmentSortValue(assignment = {}) {
            return getTeacherActivityAssignmentSortValue(assignment);
        },

        createActivityAssignmentCard(container, assignment) {
            createTeacherActivityAssignmentCard(this, container, assignment);
        },

        async deleteActivityAssignment(id) {
            await deleteTeacherActivityAssignment(this, id);
        },

        formatAssignmentTarget(assignment = {}) {
            return formatTeacherAssignmentTarget(this, assignment);
        },

        formatDueDate(value) {
            return formatTeacherActivityDueDate(value);
        },

        formatDateOnly(value) {
            return formatTeacherDateOnly(value);
        },

        formatAvailableDate(value) {
            return formatTeacherAvailableDate(value);
        },

        formatAssignmentWindow(assignment = {}) {
            return formatTeacherActivityAssignmentWindow(assignment);
        },

        timestampToMillis(value) {
            return teacherActivityTimestampToMillis(value);
        },

        dueDateEndMillis(value) {
            return teacherActivityDueDateEndMillis(value);
        },

        isAssignmentScheduled(assignment = {}) {
            return isTeacherActivityAssignmentScheduled(assignment);
        },

        getActivityLateState(assignment = {}, submission = null) {
            return getTeacherActivityLateState(assignment, submission);
        },

        activityAssignmentMatchesStudent(assignment = {}, student = {}) {
            return teacherActivityAssignmentMatchesStudent(this, assignment, student);
        },

        getStudentRosterName(student = {}) {
            return getTeacherStudentRosterName(student);
        },

        getStudentRosterMeta(student = {}) {
            return getTeacherStudentRosterMeta(this, student);
        },

        async fetchActivitySubmissions(assignmentId) {
            return fetchTeacherActivitySubmissions(this, assignmentId);
        },

        async showActivityAssignmentReview(assignmentId, options = {}) {
            await showTeacherActivityAssignmentReview(this, assignmentId, options);
        },

        buildActivityAssignmentUpdatePayload(assignment = {}, sourceActivity = {}) {
            return buildTeacherActivityAssignmentUpdatePayload(assignment, sourceActivity);
        },

        formatStartedSubmissionWarning(submissions = []) {
            return formatStartedTeacherSubmissionWarning(submissions);
        },

        async updatePublishedActivityAssignmentFromSource() {
            await updatePublishedTeacherActivityAssignmentFromSource(this);
        },

        renderActivityAssignmentReview(assignment, submissions = [], students = []) {
            renderTeacherActivityAssignmentReview(this, assignment, submissions, students);
        },

        getActivityReviewStudentId(student = {}) {
            return String(student.id || student.userId || '');
        },

        updateActivityReviewNavigation() {
            updateTeacherActivityReviewNavigation(this);
        },

        clearActivityReviewCanvas(message = 'Select a student submission to preview.') {
            clearTeacherActivityReviewCanvas(this, message);
        },

        selectActivityReviewStudent(index) {
            selectTeacherActivityReviewStudent(this, index);
        },

        showAdjacentActivityReviewStudent(delta) {
            showAdjacentTeacherActivityReviewStudent(this, delta);
        },

        async toggleActivityLateOverride(assignment, submission, student = {}) {
            await toggleTeacherActivityLateOverride(this, assignment, submission, student);
        },

        async resolveActivitySubmissionScene(assignment, submission) {
            return resolveTeacherActivitySubmissionScene(assignment, submission);
        },

        async openActivitySubmissionReview(assignment, submission, student = {}) {
            await openTeacherActivitySubmissionReview(this, assignment, submission, student);
        },

        renderStructuredSubmissionReview(assignment, submission) {
            return renderSharedStructuredSubmissionReview(assignment, submission);
        },

        renderSpreadsheetSubmissionReview(assignment, submission) {
            return renderSharedSpreadsheetSubmissionReview(assignment, submission);
        },

        renderImageHotspotSubmissionReview(assignment, submission, imageUrl = '') {
            return renderSharedImageHotspotSubmissionReview(assignment, submission, imageUrl);
        },

        renderExternalArtifactSubmissionReview(assignment, submission, artifactUrl = '') {
            return renderSharedExternalArtifactSubmissionReview(assignment, submission, artifactUrl);
        },

        renderFlowchartSubmissionReview(assignment, submission) {
            return renderSharedFlowchartSubmissionReview(assignment, submission);
        },

        renderCardSortSubmissionReview(assignment, submission) {
            return renderSharedCardSortSubmissionReview(assignment, submission);
        },
};

export function installTeacherActivityAssignmentMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherActivityAssignmentMethods);
}
