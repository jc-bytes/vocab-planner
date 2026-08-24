import { $, $$, closeModal as closeDialog } from './main.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';

function bindVocabularyMetaListeners(manager) {
    $('#vocab-name').addEventListener('input', (e) => {
        manager.vocabSet.name = e.target.value;
        manager.updateGeneratedVocabId();
        manager.triggerAutoSave();
        manager.updateVocabularyEditorSummary();
    });
    $('#vocab-desc').addEventListener('input', (e) => { manager.vocabSet.description = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-subject')?.addEventListener('change', (e) => {
        manager.vocabSet.subjectSlug = getVocabSubjectSlug({ subjectSlug: e.target.value });
        manager.updateGeneratedVocabId();
        manager.triggerAutoSave();
        manager.updateVocabularyEditorSummary();
    });
    $('#vocab-grade').addEventListener('input', (e) => {
        const val = e.target.value;
        manager.vocabSet.grades = val.split(',').map(s => s.trim()).filter(s => s !== '');
        manager.updateGeneratedVocabId();
        manager.triggerAutoSave();
        manager.updateVocabularyEditorSummary();
    });
    $('#vocab-assigned-date').addEventListener('change', (e) => {
        manager.setVocabAssignedDate(e.target.value);
    });
    $('#vocab-trimester').addEventListener('change', (e) => {
        manager.setVocabPlacementField('trimester', e.target.value);
    });
    $('#vocab-month').addEventListener('change', (e) => {
        manager.setVocabPlacementField('month', e.target.value);
    });
    $('#vocab-week').addEventListener('input', (e) => {
        manager.setVocabPlacementField('week', e.target.value);
    });
}

function bindVocabularyPublishListeners(manager) {
    $('#publish-update-btn')?.addEventListener('click', () => {
        manager.publishVocabulary({ asNew: false });
    });
    $('#publish-new-version-btn')?.addEventListener('click', () => {
        manager.publishVocabulary({ asNew: true });
    });
}

function bindVocabularyToolbarMenus() {
    const menus = $$('.vocab-editor-heading .toolbar-menu');
    if (!menus.length) return;

    menus.forEach(menu => {
        menu.addEventListener('toggle', () => {
            if (!menu.open) return;
            menus.forEach(otherMenu => {
                if (otherMenu !== menu) otherMenu.removeAttribute('open');
            });
        });

        menu.querySelectorAll('.toolbar-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                menu.removeAttribute('open');
            });
        });
    });

    document.addEventListener('click', (event) => {
        menus.forEach(menu => {
            if (!menu.contains(event.target)) menu.removeAttribute('open');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        menus.forEach(menu => menu.removeAttribute('open'));
    });
}

function bindVocabularyEditorTabs() {
    const tabs = $$('.vocab-editor-tab');
    const panels = $$('.vocab-editor-tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.vocabEditorTab;
            tabs.forEach(item => {
                const isActive = item === tab;
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            panels.forEach(panel => {
                const isActive = panel.dataset.vocabEditorPanel === target;
                panel.classList.toggle('active', isActive);
                panel.classList.toggle('hidden', !isActive);
            });
        });
    });
}

function bindActivitySettingInputs(manager) {
    $('#activity-flow-settings')?.addEventListener('change', (e) => {
        if (!e.target.classList.contains('activity-flow-select')) return;
        manager.setActivityFlowChoice(e.target.dataset.activity, e.target.value);
        manager.updateVocabularyEditorSummary();
    });
    $('#activity-flow-settings')?.addEventListener('input', (e) => {
        if (e.target.dataset.activityWordCount) {
            manager.setActivityWordCount(e.target.dataset.activityWordCount, e.target.value);
            return;
        }
        if (e.target.dataset.activityTimeLimit) {
            manager.setActivityTimeLimit(e.target.dataset.activityTimeLimit, e.target.value);
            return;
        }
        if (e.target.dataset.activityReward) {
            manager.setActivityRewardSetting(e.target.dataset.activity, e.target.dataset.activityReward, e.target.value);
        }
    });
    $('#vocab-word-filter')?.addEventListener('input', () => {
        manager.renderWords();
    });

}

function bindVocabularyModalListeners(manager) {
    $('#add-word-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.openWordModal();
    });
    $('#generate-quiz-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.openQuizMaker({ returnTo: 'editor' });
    });

    $$('.close-modal').forEach(btn => {
        btn.addEventListener('click', (event) => {
            closeDialog(event.currentTarget.closest('.modal') || '#word-modal');
        });
    });
    $('#save-word-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.saveWord();
        manager.triggerAutoSave();
    });
}

function bindVocabularyImportExport(manager) {
    $('#image-input').addEventListener('input', (e) => {
        manager.updateImagePreview(e.target.value);
    });

    $('#export-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.prepareWordHuntWordsForSave();
        manager.normalizeActivityFlowSettings();
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manager.vocabSet, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', (manager.vocabSet.id || 'vocabulary') + '.json');
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    $('#import-file').addEventListener('change', (e) => {
        if (!manager.ensureAuthenticated()) {
            e.target.value = '';
            return;
        }
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
            reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                data.subjectSlug = getVocabSubjectSlug(data);
                manager.vocabSet = data;
                manager.autoGenerateVocabId = false;

                manager.updateFormUI();
                manager.renderWords();
                manager.triggerAutoSave();
                manager.showEditor();
            } catch (err) {
                alert('Error parsing JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

function bindVocabularyWorkflowTabs(manager) {
    $$('.activity-workflow-tab[data-vocabulary-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.setVocabularyWorkflowTab(tab.dataset.vocabularyTab || 'assign');
        });
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.activity-workflow-tab[data-vocabulary-tab]'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex]?.focus();
            manager.setVocabularyWorkflowTab(tabs[nextIndex]?.dataset.vocabularyTab || 'assign');
        });
    });
}

export function initTeacherVocabularyEditorListeners(manager) {
    $('#create-new-btn').addEventListener('click', () => {
        manager.startNewVocab();
    });

    $('#back-to-dashboard').addEventListener('click', () => {
        if (!manager.ensureAuthenticated(false)) return;
        manager.triggerAutoSave();
        if (manager.parseRoute()?.view === 'editor' && manager.lastVocabularyRoute && window.history.length > 1) {
            window.history.back();
            return;
        }
        if (manager.lastVocabularyRoute) {
            manager.setRoute(manager.lastVocabularyRoute);
            manager.applyRoute(manager.lastVocabularyRoute);
            return;
        }
        manager.showVocabularyLibrary();
    });

    bindVocabularyMetaListeners(manager);
    bindVocabularyWorkflowTabs(manager);
    bindVocabularyPublishListeners(manager);
    bindVocabularyToolbarMenus();
    bindVocabularyEditorTabs();
    bindActivitySettingInputs(manager);
    bindVocabularyModalListeners(manager);
    bindVocabularyImportExport(manager);
}
