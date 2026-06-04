import { $, $$, closeModal as closeDialog } from './main.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';

function ensureActivitySettings(manager) {
    if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
    return manager.vocabSet.activitySettings;
}

function bindVocabularyMetaListeners(manager) {
    $('#vocab-id').addEventListener('input', (e) => { manager.vocabSet.id = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-name').addEventListener('input', (e) => { manager.vocabSet.name = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-desc').addEventListener('input', (e) => { manager.vocabSet.description = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-subject')?.addEventListener('change', (e) => {
        manager.vocabSet.subjectSlug = getVocabSubjectSlug({ subjectSlug: e.target.value });
        manager.triggerAutoSave();
    });
    $('#vocab-grade').addEventListener('input', (e) => {
        const val = e.target.value;
        manager.vocabSet.grades = val.split(',').map(s => s.trim()).filter(s => s !== '');
        manager.triggerAutoSave();
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

function bindActivitySettingInputs(manager) {
    $('#setting-flashcards').addEventListener('input', (e) => {
        ensureActivitySettings(manager).flashcards = parseInt(e.target.value) || null;
        manager.triggerAutoSave();
    });
    $('#setting-matching').addEventListener('input', (e) => {
        ensureActivitySettings(manager).matching = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-quiz').addEventListener('input', (e) => {
        ensureActivitySettings(manager).quiz = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-synonym-antonym').addEventListener('input', (e) => {
        ensureActivitySettings(manager).synonymAntonym = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-word-search').addEventListener('input', (e) => {
        ensureActivitySettings(manager).wordSearch = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-illustration').addEventListener('input', (e) => {
        ensureActivitySettings(manager).illustration = parseInt(e.target.value) || 5;
        manager.triggerAutoSave();
    });
    $('#setting-crossword').addEventListener('input', (e) => {
        ensureActivitySettings(manager).crossword = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-hangman').addEventListener('input', (e) => {
        ensureActivitySettings(manager).hangman = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-scramble').addEventListener('input', (e) => {
        ensureActivitySettings(manager).scramble = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-wordle').addEventListener('input', (e) => {
        ensureActivitySettings(manager).wordle = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-speed-match').addEventListener('input', (e) => {
        ensureActivitySettings(manager).speedMatch = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-fill-in-blank').addEventListener('input', (e) => {
        ensureActivitySettings(manager).fillInBlank = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#activity-flow-settings')?.addEventListener('change', (e) => {
        if (!e.target.classList.contains('activity-flow-select')) return;
        manager.setActivityFlowChoice(e.target.dataset.activity, e.target.value);
    });

    $('#setting-completion-bonus').addEventListener('input', (e) => {
        ensureActivitySettings(manager).completionBonus = parseInt(e.target.value) || 50;
        manager.triggerAutoSave();
    });
    $('#setting-exchange-rate').addEventListener('input', (e) => {
        ensureActivitySettings(manager).exchangeRate = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-progress-reward').addEventListener('input', (e) => {
        ensureActivitySettings(manager).progressReward = parseInt(e.target.value) || 1;
        manager.triggerAutoSave();
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
    $('#close-quiz-modal').addEventListener('click', () => {
        closeDialog('#quiz-modal');
    });
    $('#refresh-quiz-btn').addEventListener('click', () => manager.handleGenerateQuiz(true));
    $('#print-quiz-btn').addEventListener('click', () => manager.printQuiz());

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
        manager.normalizeActivityFlowSettings();
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(manager.vocabSet, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', (manager.vocabSet.id || 'vocabulary') + '.json');
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    $('#import-file').addEventListener('change', async (e) => {
        if (!manager.ensureAuthenticated()) {
            e.target.value = '';
            return;
        }
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                data.subjectSlug = getVocabSubjectSlug(data);
                manager.vocabSet = data;

                manager.updateFormUI();
                manager.renderWords();
                manager.triggerAutoSave();
                manager.showEditor();

                await manager.downloadForRepository(data);
            } catch (err) {
                alert('Error parsing JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

function bindLegacyQuizModalListeners() {
    $('#close-quiz-modal').addEventListener('click', () => {
        closeDialog('#quiz-modal');
    });
    $('#refresh-quiz-btn').addEventListener('click', () => {
    });
    $('#print-quiz-btn').addEventListener('click', () => {
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
    bindVocabularyPublishListeners(manager);
    bindActivitySettingInputs(manager);
    bindVocabularyModalListeners(manager);
    bindVocabularyImportExport(manager);
    bindLegacyQuizModalListeners();
}
