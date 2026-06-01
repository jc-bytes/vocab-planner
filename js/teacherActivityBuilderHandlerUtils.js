export function refreshPreviewAndAutosave(manager) {
    if (manager.activityEditorTab === 'preview') {
        manager.renderActivityPreviewPanel();
    }
    manager.triggerActivityAutoSave({ readForm: false });
}
