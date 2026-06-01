import { $, $$, closeModal as closeDialog, setupModal } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from './classroomActivityRegistry.js';

export function initTeacherListeners(manager) {
    window.addEventListener('hashchange', () => manager.handleRouteChange());
    window.addEventListener('popstate', () => manager.handleRouteChange());
    window.addEventListener('resize', () => manager.setTeacherMobileMenu(false));

    setupModal('#student-detail-modal', {
        dismissible: true,
        onClose: () => {
            manager.activeStudentId = null;
        }
    });
    setupModal('#word-modal', {
        dismissible: true,
        onClose: () => {
            manager.editingWordIndex = -1;
        }
    });
    setupModal('#quiz-modal', { dismissible: true });
    setupModal('#activity-assignment-modal', { dismissible: true });

    if (!manager.authDisabled) {
        $('#teacher-login-form')?.addEventListener('submit', (event) => manager.handleTeacherLogin(event));
        $('#teacher-signup-form')?.addEventListener('submit', (event) => manager.handleTeacherSignup(event));
        $('#show-teacher-login-btn')?.addEventListener('click', () => manager.showTeacherAuthPanel('login'));
        $('#show-teacher-signup-btn')?.addEventListener('click', () => manager.showTeacherAuthPanel('signup'));
        $('#teacher-login-btn')?.addEventListener('click', () => manager.showLoginView());

        const signOutBtn = $('#teacher-sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                await supabaseService.signOut();
                localStorage.removeItem('was_logged_in');
                manager.isAuthenticated = false;
                manager.currentUser = null;
                manager.updateAuthUI(null);
                manager.showLoginView();
            });
        }
    }

    $('#teacher-mobile-menu-toggle')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = $('#teacher-tab-shell')?.classList.contains('mobile-menu-open');
        manager.setTeacherMobileMenu(!isOpen);
    });

    document.addEventListener('click', (event) => {
        const shell = $('#teacher-tab-shell');
        if (shell && !shell.contains(event.target)) manager.closeTeacherMobileMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') manager.closeTeacherMobileMenu({ focusToggle: true });
    });

    $$('.teacher-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.showTeacherSection(tab.dataset.section);
        });
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.teacher-tab'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex].focus();
            manager.showTeacherSection(tabs[nextIndex].dataset.section);
        });
    });

    $('#overview-create-vocab-btn')?.addEventListener('click', () => manager.startNewVocab());
    $('#overview-students-btn')?.addEventListener('click', () => manager.showTeacherSection('students'));
    $('#overview-vocabulary-btn')?.addEventListener('click', () => manager.showTeacherSection('vocabulary'));
    $('#overview-activities-btn')?.addEventListener('click', () => manager.showTeacherSection('activities'));
    $('#overview-quiz-btn')?.addEventListener('click', () => manager.showTeacherSection('quizzes'));
    $('#overview-settings-btn')?.addEventListener('click', () => manager.showTeacherSection('data-settings'));
    $('#overview-export-btn')?.addEventListener('click', () => {
        manager.showTeacherSection('data-settings', { tab: 'export' });
    });

    // Dashboard Actions
    $('#create-new-btn').addEventListener('click', () => {
        manager.startNewVocab();
    });

    $('#create-activity-btn')?.addEventListener('click', () => {
        const templateId = $('#activity-template-select')?.value || DEFAULT_ACTIVITY_TEMPLATE_ID;
        manager.startNewActivity(templateId);
    });

    $$('.activity-workflow-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.setActivityWorkflowTab(tab.dataset.activityTab || 'assign');
        });
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.activity-workflow-tab'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex]?.focus();
            manager.setActivityWorkflowTab(tabs[nextIndex]?.dataset.activityTab || 'assign');
        });
    });

    $$('.activity-editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.setActivityEditorTab(tab.dataset.activityEditorTab || 'settings');
        });
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.activity-editor-tab'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex]?.focus();
            manager.setActivityEditorTab(tabs[nextIndex]?.dataset.activityEditorTab || 'settings');
        });
    });

    $('#back-to-activities')?.addEventListener('click', () => {
        if (!manager.ensureAuthenticated(false)) return;
        manager.triggerActivityAutoSave({ syncEditor: true });
        manager.activityMode = 'assign';
        manager.showActivityLibrary();
    });

    $('#back-to-activity-assignments')?.addEventListener('click', () => {
        if (!manager.ensureAuthenticated(false)) return;
        manager.activityMode = 'review';
        manager.showActivityLibrary();
    });

    $('#refresh-activity-assignment-review-btn')?.addEventListener('click', () => {
        if (!manager.activeActivityAssignment?.id) return;
        manager.showActivityAssignmentReview(manager.activeActivityAssignment.id, { forceRefresh: true });
    });

    $('#update-published-activity-assignment-btn')?.addEventListener('click', () => {
        manager.updatePublishedActivityAssignmentFromSource();
    });

    $('#activity-review-prev-student-btn')?.addEventListener('click', () => {
        manager.showAdjacentActivityReviewStudent(-1);
    });

    $('#activity-review-next-student-btn')?.addEventListener('click', () => {
        manager.showAdjacentActivityReviewStudent(1);
    });

    $('#assign-activity-toolbar-btn')?.addEventListener('click', () => {
        manager.openActivityAssignmentModal(manager.activity);
    });

    $('#activity-assignment-form')?.addEventListener('submit', (event) => {
        manager.saveActivityAssignment(event);
    });

    $('#cancel-activity-assignment-btn')?.addEventListener('click', () => {
        closeDialog('#activity-assignment-modal');
    });

    $('#close-activity-assignment-modal')?.addEventListener('click', () => {
        closeDialog('#activity-assignment-modal');
    });

    $('#save-activity-update-btn')?.addEventListener('click', () => {
        manager.publishActivity({ asNew: false });
    });

    $('#save-activity-new-version-btn')?.addEventListener('click', () => {
        manager.publishActivity({ asNew: true });
    });

    $('#activity-canvas-focus-btn')?.addEventListener('click', () => {
        manager.toggleActivityCanvasFocus();
    });

    $('#export-activity-btn')?.addEventListener('click', () => {
        manager.exportActivityJson();
    });

    [
        '#activity-title',
        '#activity-description',
        '#activity-grades',
        '#activity-estimated-minutes',
        '#activity-teacher-instructions',
        '#activity-student-instructions',
        '#activity-materials',
        '#activity-student-output',
        '#activity-makeup-instructions'
    ].forEach(selector => {
        $(selector)?.addEventListener('input', () => manager.triggerActivityAutoSave());
    });

    [
        '#activity-subject',
        '#activity-assessment-purpose'
    ].forEach(selector => {
        $(selector)?.addEventListener('change', () => manager.triggerActivityAutoSave());
    });

    $('#activity-type')?.addEventListener('change', () => {
        manager.handleActivityTypeSelectChange();
    });

    $('#view-progress-btn')?.addEventListener('click', () => {
        manager.showProgressView();
    });

    // Gamification Settings
    const saveGamificationBtn = $('#save-gamification-btn');
    if (saveGamificationBtn) {
        saveGamificationBtn.addEventListener('click', () => {
            manager.saveGamificationSettings();
        });
    }

    const saveSchoolCalendarBtn = $('#save-school-calendar-btn');
    if (saveSchoolCalendarBtn) {
        saveSchoolCalendarBtn.addEventListener('click', () => {
            manager.saveSchoolCalendarSettings();
        });
    }

    $('#add-subject-btn')?.addEventListener('click', () => manager.addSubjectFromForm());
    $('#save-subjects-btn')?.addEventListener('click', () => manager.saveSubjectSettings());

    $('#back-to-dashboard').addEventListener('click', () => {
        if (!manager.ensureAuthenticated(false)) return;
        // Auto-save before leaving
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

    $('#back-to-dashboard-from-progress')?.addEventListener('click', () => {
        manager.showDashboard();
    });

    // Progress Filters
    $('#filter-grade').addEventListener('change', () => manager.applyFilters());
    $('#filter-group').addEventListener('change', () => manager.applyFilters());
    $('#filter-search').addEventListener('input', () => manager.applyFilters());

    // Detail Modal
    $('#close-detail-modal').addEventListener('click', () => {
        closeDialog('#student-detail-modal');
    });

    // Data Management View Navigation
    $('#open-data-management-btn')?.addEventListener('click', () => {
        manager.showDataManagementView();
    });

    $('#back-to-progress-from-data')?.addEventListener('click', () => {
        manager.showProgressView();
    });
    $('#coin-adjust-btn').addEventListener('click', () => manager.handleCoinAdjust());
    $$('.quick-coin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amt = parseInt(btn.dataset.amount, 10) || 0;
            $('#coin-adjust-input').value = amt;
            manager.handleCoinAdjust();
        });
    });

    // Bulk Coin Distribution
    $('#select-all-students')?.addEventListener('change', (e) => {
        manager.handleSelectAll(e.target.checked);
    });
    $('#select-visible-students-mobile')?.addEventListener('change', (e) => {
        manager.handleSelectAll(e.target.checked);
    });

    $('#bulk-add-coins-btn')?.addEventListener('click', () => {
        manager.handleBulkCoinAdjust();
    });

    $('#bulk-clear-selection-btn')?.addEventListener('click', () => {
        manager.clearSelection();
    });

    $('#reset-student-password-btn')?.addEventListener('click', () => manager.handlePasswordReset());

    // Meta fields
    $('#vocab-id').addEventListener('input', (e) => { manager.vocabSet.id = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-name').addEventListener('input', (e) => { manager.vocabSet.name = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-desc').addEventListener('input', (e) => { manager.vocabSet.description = e.target.value; manager.triggerAutoSave(); });
    $('#vocab-subject')?.addEventListener('change', (e) => {
        manager.vocabSet.subjectSlug = getVocabSubjectSlug({ subjectSlug: e.target.value });
        manager.triggerAutoSave();
    });
    $('#vocab-grade').addEventListener('input', (e) => {
        // Parse comma separated values into array of numbers/strings
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

    $('#publish-update-btn')?.addEventListener('click', () => {
        manager.publishVocabulary({ asNew: false });
    });
    $('#publish-new-version-btn')?.addEventListener('click', () => {
        manager.publishVocabulary({ asNew: true });
    });

    // Activity Settings
    $('#setting-flashcards').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.flashcards = parseInt(e.target.value) || null;
        manager.triggerAutoSave();
    });
    $('#setting-matching').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.matching = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-quiz').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.quiz = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-synonym-antonym').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.synonymAntonym = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-word-search').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.wordSearch = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-illustration').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.illustration = parseInt(e.target.value) || 5;
        manager.triggerAutoSave();
    });
    $('#setting-crossword').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.crossword = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-hangman').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.hangman = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-scramble').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.scramble = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-wordle').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.wordle = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-speed-match').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.speedMatch = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-fill-in-blank').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.fillInBlank = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#activity-flow-settings')?.addEventListener('change', (e) => {
        if (!e.target.classList.contains('activity-flow-select')) return;
        manager.setActivityFlowChoice(e.target.dataset.activity, e.target.value);
    });

    // Gamification Settings
    $('#setting-completion-bonus').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.completionBonus = parseInt(e.target.value) || 50;
        manager.triggerAutoSave();
    });
    $('#setting-exchange-rate').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.exchangeRate = parseInt(e.target.value) || 10;
        manager.triggerAutoSave();
    });
    $('#setting-progress-reward').addEventListener('input', (e) => {
        if (!manager.vocabSet.activitySettings) manager.vocabSet.activitySettings = {};
        manager.vocabSet.activitySettings.progressReward = parseInt(e.target.value) || 1;
        manager.triggerAutoSave();
    });

    // Add Word
    $('#add-word-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.openWordModal();
    });
    $('#generate-quiz-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.openQuizMaker({ returnTo: 'editor' });
    });

    // Modal Actions
    $$('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeDialog('#word-modal');
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

    // Image Preview
    $('#image-input').addEventListener('input', (e) => {
        manager.updateImagePreview(e.target.value);
    });

    // Export
    $('#export-btn').addEventListener('click', () => {
        if (!manager.ensureAuthenticated()) return;
        manager.normalizeActivityFlowSettings();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(manager.vocabSet, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", (manager.vocabSet.id || "vocabulary") + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    // Import
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
                manager.triggerAutoSave(); // Save imported file to localStorage
                manager.showEditor();

                // Auto-download for repository
                await manager.downloadForRepository(data);
            } catch (err) {
                alert('Error parsing JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    });

    // Disable old modal listeners or redirect them
    $('#close-quiz-modal').addEventListener('click', () => {
        closeDialog('#quiz-modal');
    });
    // These buttons are inside the old modal, so they shouldn't be reachable if we don't open it.
    // But just in case:
    $('#refresh-quiz-btn').addEventListener('click', () => {
        // Redirect to new quiz maker if somehow clicked?
        // Or just leave as is for legacy support if needed, but we want to hide the modal.
        // manager.currentQuiz = manager.generateSummativeQuiz();
        // manager.renderQuizPreview();
    });
    $('#print-quiz-btn').addEventListener('click', () => {
        // manager.printQuiz();
    });
}
