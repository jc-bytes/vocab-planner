import { $ } from './main.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from './classroomActivityRegistry.js';
import {
    renderStructuredResponsePreview
} from './teacherActivityPreviewRenderers.js';
import {
    renderCardSortBuilder as renderTeacherCardSortBuilder,
    renderExternalArtifactBuilder as renderTeacherExternalArtifactBuilder,
    renderFlowchartBuilder as renderTeacherFlowchartBuilder,
    renderImageHotspotBuilder as renderTeacherImageHotspotBuilder,
    renderSpreadsheetBuilder as renderTeacherSpreadsheetBuilder,
    renderStructuredResponseBuilder as renderTeacherStructuredResponseBuilder
} from './teacherActivityBuilderRenderers.js';
import {
    handleCardSortBuilderClick as handleTeacherCardSortBuilderClick,
    handleCardSortBuilderInput as handleTeacherCardSortBuilderInput,
    handleExternalArtifactBuilderClick as handleTeacherExternalArtifactBuilderClick,
    handleExternalArtifactBuilderInput as handleTeacherExternalArtifactBuilderInput,
    handleFlowchartBuilderClick as handleTeacherFlowchartBuilderClick,
    handleFlowchartBuilderInput as handleTeacherFlowchartBuilderInput,
    handleImageHotspotBuilderClick as handleTeacherImageHotspotBuilderClick,
    handleImageHotspotBuilderInput as handleTeacherImageHotspotBuilderInput,
    handleSpreadsheetBuilderClick as handleTeacherSpreadsheetBuilderClick,
    handleSpreadsheetBuilderInput as handleTeacherSpreadsheetBuilderInput,
    handleStructuredBuilderClick as handleTeacherStructuredBuilderClick,
    handleStructuredBuilderInput as handleTeacherStructuredBuilderInput,
    syncCardSortTemplate as syncTeacherCardSortTemplate,
    syncExternalArtifactTemplate as syncTeacherExternalArtifactTemplate,
    syncFlowchartTemplate as syncTeacherFlowchartTemplate,
    syncImageHotspotTemplate as syncTeacherImageHotspotTemplate,
    syncSpreadsheetTemplate as syncTeacherSpreadsheetTemplate,
    syncStructuredResponseTemplate as syncTeacherStructuredResponseTemplate
} from './teacherActivityBuilderController.js';
import {
    mountTeacherActivityEditor,
    mountTeacherCardSortActivityEditor,
    mountTeacherExternalArtifactActivityEditor,
    mountTeacherFlowchartActivityEditor,
    mountTeacherImageHotspotActivityEditor,
    mountTeacherMapActivityEditor,
    mountTeacherSpreadsheetActivityEditor,
    mountTeacherStructuredActivityEditor
} from './teacherActivityEditorMounts.js';
import {
    getSelectedTeacherActivityClassContext,
    getTeacherActivityEditorTab,
    handleTeacherActivityTypeSelectChange,
    isCardSortTeacherActivity,
    isExternalArtifactTeacherActivity,
    isFlowchartTeacherActivity,
    isImageHotspotTeacherActivity,
    isSpreadsheetTeacherActivity,
    isStructuredTeacherActivity,
    readTeacherActivityFormIntoModel,
    renderTeacherActivityEditorLoadError,
    setTeacherActivityCanvasFocus,
    setTeacherActivityEditorTab,
    setTeacherActivitySaveStatus,
    showTeacherActivityEditor,
    startNewTeacherActivity,
    syncTeacherActivityEditorScene,
    syncTeacherActivityWorkspace,
    toggleTeacherActivityCanvasFocus,
    updateTeacherActivityFocusButtonLabel,
    updateTeacherActivityFormUI,
    validateTeacherActivityClass
} from './teacherActivityEditorController.js';
import {
    handleTeacherImageHotspotImageUpload,
    hydrateTeacherImageHotspotImages,
    resolveTeacherActivityImageUrl
} from './teacherActivityMediaController.js';
import {
    createTeacherActivityIdSuggestion,
    deleteCloudTeacherActivity,
    exportTeacherActivityJson,
    publishTeacherActivity,
    queueTeacherActivityCloudSave,
    queueTeacherActivityLocalSave,
    saveTeacherActivityToCloud,
    triggerTeacherActivityAutoSave
} from './teacherActivityPersistence.js';

const teacherActivityEditorMethods = {
        deleteLocalActivity(id) {
            this.markActivityDeleted(id);
            this.removeLocalActivity(id);
        },

        async deleteCloudActivity(id) {
            await deleteCloudTeacherActivity(this, id);
        },

        loadActivityObject(activity, type = activity?.source || 'local') {
            if (!this.ensureAuthenticated()) return;
            this.activity = this.normalizeActivity({ ...activity, source: type });
            this.deletedActivityIds.delete(this.activity.id);
            this.showActivityEditor();
        },

        getSelectedActivityClassContext() {
            return getSelectedTeacherActivityClassContext(this);
        },

        async startNewActivity(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
            await startNewTeacherActivity(this, templateId);
        },

        async showActivityEditor() {
            await showTeacherActivityEditor(this);
        },

        getActivityEditorTab(tab = this.activityEditorTab) {
            return getTeacherActivityEditorTab(this, tab);
        },

        updateActivityFocusButtonLabel() {
            updateTeacherActivityFocusButtonLabel(this);
        },

        setActivityEditorTab(tab = 'settings', options = {}) {
            setTeacherActivityEditorTab(this, tab, options);
        },

        updateActivityFormUI() {
            updateTeacherActivityFormUI(this);
        },

        readActivityFormIntoModel() {
            readTeacherActivityFormIntoModel(this);
        },

        validateActivityClass(activity = this.activity) {
            return validateTeacherActivityClass(this, activity);
        },

        isStructuredActivity(activity = this.activity) {
            return isStructuredTeacherActivity(activity);
        },

        isCardSortActivity(activity = this.activity) {
            return isCardSortTeacherActivity(activity);
        },

        isSpreadsheetActivity(activity = this.activity) {
            return isSpreadsheetTeacherActivity(activity);
        },

        isImageHotspotActivity(activity = this.activity) {
            return isImageHotspotTeacherActivity(activity);
        },

        isExternalArtifactActivity(activity = this.activity) {
            return isExternalArtifactTeacherActivity(activity);
        },

        isFlowchartActivity(activity = this.activity) {
            return isFlowchartTeacherActivity(activity);
        },

        syncActivityWorkspace() {
            syncTeacherActivityWorkspace(this);
        },

        syncActivityEditorScene() {
            syncTeacherActivityEditorScene(this);
        },

        syncStructuredResponseTemplate() {
            syncTeacherStructuredResponseTemplate(this);
        },

        syncCardSortTemplate() {
            syncTeacherCardSortTemplate(this);
        },

        syncSpreadsheetTemplate() {
            syncTeacherSpreadsheetTemplate(this);
        },

        syncImageHotspotTemplate() {
            syncTeacherImageHotspotTemplate(this);
        },

        syncExternalArtifactTemplate() {
            syncTeacherExternalArtifactTemplate(this);
        },

        syncFlowchartTemplate() {
            syncTeacherFlowchartTemplate(this);
        },

        configureExcalidrawAssets() {
            if (typeof window === 'undefined' || window.EXCALIDRAW_ASSET_PATH) return;
            const viteEnv = import.meta.env || {};
            window.EXCALIDRAW_ASSET_PATH = viteEnv.DEV
                ? '/node_modules/@excalidraw/excalidraw/dist/'
                : new URL('./', window.location.href).href;
        },

        async mountActivityEditor() {
            await mountTeacherActivityEditor(this);
        },

        async mountMapActivityEditor() {
            await mountTeacherMapActivityEditor(this);
        },

        mountStructuredActivityEditor() {
            mountTeacherStructuredActivityEditor(this);
        },

        mountCardSortActivityEditor() {
            mountTeacherCardSortActivityEditor(this);
        },

        mountSpreadsheetActivityEditor() {
            mountTeacherSpreadsheetActivityEditor(this);
        },

        mountImageHotspotActivityEditor() {
            mountTeacherImageHotspotActivityEditor(this);
        },

        mountExternalArtifactActivityEditor() {
            mountTeacherExternalArtifactActivityEditor(this);
        },

        mountFlowchartActivityEditor() {
            mountTeacherFlowchartActivityEditor(this);
        },

        async resolveActivityImageUrl(path) {
            return resolveTeacherActivityImageUrl(this, path);
        },

        hydrateImageHotspotImages(root, template = {}) {
            hydrateTeacherImageHotspotImages(this, root, template);
        },

        renderFlowchartBuilder(root = $('#activity-flowchart-root')) {
            renderTeacherFlowchartBuilder(this, root);
        },

        handleFlowchartBuilderInput(event) {
            handleTeacherFlowchartBuilderInput(this, event);
        },

        handleFlowchartBuilderClick(event) {
            handleTeacherFlowchartBuilderClick(this, event);
        },

        renderExternalArtifactBuilder(root = $('#activity-external-artifact-root')) {
            renderTeacherExternalArtifactBuilder(this, root);
        },

        handleExternalArtifactBuilderInput(event) {
            handleTeacherExternalArtifactBuilderInput(this, event);
        },

        handleExternalArtifactBuilderClick(event) {
            handleTeacherExternalArtifactBuilderClick(this, event);
        },

        renderImageHotspotBuilder(root = $('#activity-image-hotspot-root')) {
            renderTeacherImageHotspotBuilder(this, root);
        },

        async handleImageHotspotImageUpload(event) {
            await handleTeacherImageHotspotImageUpload(this, event);
        },

        handleImageHotspotBuilderInput(event) {
            handleTeacherImageHotspotBuilderInput(this, event);
        },

        handleImageHotspotBuilderClick(event) {
            handleTeacherImageHotspotBuilderClick(this, event);
        },

        renderSpreadsheetBuilder(root = $('#activity-spreadsheet-root')) {
            renderTeacherSpreadsheetBuilder(this, root);
        },

        handleSpreadsheetBuilderInput(event) {
            handleTeacherSpreadsheetBuilderInput(this, event);
        },

        handleSpreadsheetBuilderClick(event) {
            handleTeacherSpreadsheetBuilderClick(this, event);
        },

        renderCardSortBuilder(root = $('#activity-card-sort-root')) {
            renderTeacherCardSortBuilder(this, root);
        },

        handleCardSortBuilderInput(event) {
            handleTeacherCardSortBuilderInput(this, event);
        },

        handleCardSortBuilderClick(event) {
            handleTeacherCardSortBuilderClick(this, event);
        },

        renderStructuredResponseBuilder(root = $('#activity-structured-root')) {
            renderTeacherStructuredResponseBuilder(this, root);
        },

        async renderActivityPreviewPanel() {
            const root = $('#activity-preview-root');
            if (!root) return;

            if (this.activityStudentPreviewMode === 'inline') {
                this.closeActivityStudentPreview();
            }

            if (!this.activity?.id) {
                root.innerHTML = '<div class="teacher-empty-state">Open or create an activity to preview it.</div>';
                return;
            }

            this.syncActivityWorkspace();
            this.readActivityFormIntoModel();
            root.innerHTML = '<div class="loading-spinner">Loading student preview...</div>';
            await this.openActivityStudentPreview(this.activity, { inline: true });
        },

        refreshStructuredResponsePreview() {
            const preview = $('#activity-structured-root [data-structured-preview-body]');
            if (!preview) return;
            this.syncStructuredResponseTemplate();
            preview.innerHTML = renderStructuredResponsePreview(this.activity.activityData?.responseTemplate);
        },

        handleStructuredBuilderInput(event) {
            handleTeacherStructuredBuilderInput(this, event);
        },

        handleStructuredBuilderClick(event) {
            handleTeacherStructuredBuilderClick(this, event);
        },

        renderActivityEditorLoadError(root) {
            renderTeacherActivityEditorLoadError(this, root);
        },

        setActivitySaveStatus(text, state = 'muted') {
            setTeacherActivitySaveStatus(text, state);
        },

        setActivityCanvasFocus(isFocused) {
            setTeacherActivityCanvasFocus(this, isFocused);
        },

        toggleActivityCanvasFocus() {
            toggleTeacherActivityCanvasFocus(this);
        },

        async handleActivityTypeSelectChange() {
            await handleTeacherActivityTypeSelectChange(this);
        },

        triggerActivityAutoSave(options = {}) {
            triggerTeacherActivityAutoSave(this, options);
        },

        queueActivityLocalSave() {
            queueTeacherActivityLocalSave(this);
        },

        queueActivityCloudSave() {
            queueTeacherActivityCloudSave(this);
        },

        async saveActivityToCloud(options = {}) {
            return saveTeacherActivityToCloud(this, options);
        },

        createActivityIdSuggestion(activity = this.activity) {
            return createTeacherActivityIdSuggestion(this, activity);
        },

        async publishActivity({ asNew = false } = {}) {
            await publishTeacherActivity(this, { asNew });
        },

        exportActivityJson() {
            exportTeacherActivityJson(this);
        }
};

export function installTeacherActivityEditorMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherActivityEditorMethods);
}
