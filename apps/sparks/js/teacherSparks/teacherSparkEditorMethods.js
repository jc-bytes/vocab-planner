import { $, escapeHtml, openModal } from '../main.js';
import { DEFAULT_SUBJECT_SLUG } from '../services/vocabularyApi.js';
import {
    normalizeSparkCheckMode,
    normalizeSparkQuestions,
    SPARK_CHECK_MODES,
    SPARK_QUESTION_LIMIT,
    SPARK_QUESTION_TYPES
} from '../sparkCheckModel.js';
import { SPARK_GRADE_LEVELS } from '../sparkModel.js';

export const teacherSparkEditorMethods = {
createSparkQuestionDraft(type = SPARK_QUESTION_TYPES.SHORT_TEXT) {
        return {
            id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type,
            prompt: '',
            options: type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE ? ['', '', '', ''] : [],
            correctOption: 0
        };
    },

readSparkQuestionDraftsFromForm() {
        return Array.from(document.querySelectorAll('#spark-question-builder .spark-question-editor')).map((editor, index) => {
            const type = editor.querySelector('[data-spark-question-type]')?.value === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
                ? SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
                : SPARK_QUESTION_TYPES.SHORT_TEXT;
            const correct = editor.querySelector('[data-spark-correct-option]:checked');
            return {
                id: editor.dataset.questionId || `q${index + 1}`,
                type,
                prompt: editor.querySelector('[data-spark-question-prompt]')?.value || '',
                options: type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
                    ? Array.from(editor.querySelectorAll('[data-spark-question-option]')).map(input => input.value)
                    : [],
                correctOption: Number(correct?.value || 0)
            };
        });
    },

renderSparkQuestionEditors(questions = []) {
        const builder = $('#spark-question-builder');
        if (!builder) return;
        const drafts = Array.isArray(questions) ? questions.slice(0, SPARK_QUESTION_LIMIT) : [];
        this.sparkModalQuestions = drafts;
        if (drafts.length === 0) {
            builder.innerHTML = '<p class="spark-question-builder-empty">No questions yet. Add one or choose Reading only.</p>';
        } else {
            builder.innerHTML = drafts.map((question, index) => {
                const type = question.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
                    ? SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
                    : SPARK_QUESTION_TYPES.SHORT_TEXT;
                const options = Array.from({ length: 4 }, (_, optionIndex) => String(question.options?.[optionIndex] || ''));
                const correctOption = Number.isInteger(Number(question.correctOption)) ? Number(question.correctOption) : 0;
                return `
                    <section class="spark-question-editor" data-question-id="${escapeHtml(question.id || `q${index + 1}`)}">
                        <div class="spark-question-editor-heading">
                            <strong>Question ${index + 1}</strong>
                            <button class="btn text-btn btn-compact" type="button" data-remove-spark-question="${index}" aria-label="Remove question ${index + 1}">
                                <i data-lucide="trash-2"></i> Remove
                            </button>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Question type</label>
                                <select data-spark-question-type>
                                    <option value="short_text"${type === SPARK_QUESTION_TYPES.SHORT_TEXT ? ' selected' : ''}>Short response</option>
                                    <option value="multiple_choice"${type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE ? ' selected' : ''}>Multiple choice</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Prompt</label>
                                <textarea rows="2" maxlength="240" data-spark-question-prompt required>${escapeHtml(question.prompt || '')}</textarea>
                            </div>
                        </div>
                        ${type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE ? `
                            <div class="spark-question-options" role="group" aria-label="Answers for question ${index + 1}">
                                ${options.map((option, optionIndex) => `
                                    <label class="spark-question-option">
                                        <input type="text" maxlength="120" placeholder="Option ${optionIndex + 1}" value="${escapeHtml(option)}" data-spark-question-option required>
                                        <input type="radio" name="spark-correct-${index}" value="${optionIndex}" data-spark-correct-option${correctOption === optionIndex ? ' checked' : ''} aria-label="Mark option ${optionIndex + 1} correct">
                                    </label>
                                `).join('')}
                            </div>
                            <small class="form-helper">Select the correct answer using the circle beside an option.</small>
                        ` : '<small class="form-helper">A complete response of at least 12 characters is required.</small>'}
                    </section>
                `;
            }).join('');
        }
        const addButton = $('#add-spark-question-btn');
        if (addButton) addButton.disabled = drafts.length >= SPARK_QUESTION_LIMIT;
        this.refreshIcons(builder);
    },

updateSparkCheckModeUi() {
        const mode = normalizeSparkCheckMode($('#spark-check-mode-input')?.value);
        const group = $('#spark-question-builder-group');
        if (group) group.hidden = mode === SPARK_CHECK_MODES.READING_ONLY;
    },

addSparkQuestion() {
        const questions = this.readSparkQuestionDraftsFromForm();
        if (questions.length >= SPARK_QUESTION_LIMIT) return;
        questions.push(this.createSparkQuestionDraft());
        this.renderSparkQuestionEditors(questions);
    },

removeSparkQuestion(index) {
        const questions = this.readSparkQuestionDraftsFromForm();
        questions.splice(index, 1);
        this.renderSparkQuestionEditors(questions);
    },

changeSparkQuestionType(index, type) {
        const questions = this.readSparkQuestionDraftsFromForm();
        const question = questions[index];
        if (!question) return;
        question.type = type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
            ? SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
            : SPARK_QUESTION_TYPES.SHORT_TEXT;
        if (question.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE && question.options.length === 0) {
            question.options = ['', '', '', ''];
        }
        this.renderSparkQuestionEditors(questions);
    },

openSparkModal(spark = null, options = {}) {
        const source = this.normalizeSpark(spark || this.createDefaultSpark());
        const duplicate = options.duplicate === true;
        this.sparkModalMode = source.id && !duplicate ? 'edit' : 'create';
        this.editingSparkId = this.sparkModalMode === 'edit' ? source.id : null;

        const title = $('#spark-modal-title');
        if (title) title.textContent = this.sparkModalMode === 'edit' ? 'Edit Spark' : 'Add Spark';

        const values = {
            '#spark-id': this.editingSparkId || '',
            '#spark-type': source.sparkType,
            '#spark-title-input': duplicate ? `Copy of ${source.title || 'Spark'}` : source.title,
            '#spark-text-input': source.sparkText,
            '#spark-why-input': source.whyItMatters,
            '#spark-check-mode-input': source.checkMode,
            '#spark-question-input': source.question,
            '#spark-grade-question-6-input': source.gradeQuestions['6'],
            '#spark-grade-question-7-input': source.gradeQuestions['7'],
            '#spark-grade-question-8-input': source.gradeQuestions['8'],
            '#spark-grade-question-9-input': source.gradeQuestions['9'],
            '#spark-source-title-input': source.sourceTitle,
            '#spark-source-url-input': source.sourceUrl,
            '#spark-scheduled-date-input': duplicate ? '' : source.scheduledDate,
            '#spark-status-input': duplicate ? 'draft' : source.status
        };

        Object.entries(values).forEach(([selector, value]) => {
            const field = $(selector);
            if (field) field.value = value || '';
        });

        SPARK_GRADE_LEVELS.forEach(grade => {
            const field = $(`#spark-target-grade-${grade}-input`);
            if (field) field.checked = source.targetGrades.includes(grade);
        });

        this.renderSparkQuestionEditors(source.questions);
        this.updateSparkCheckModeUi();

        this.setSparkModalStatus('');
        openModal('#spark-modal', { initialFocus: '#spark-title-input' });
    },

readSparkTargetGradesFromForm() {
        return SPARK_GRADE_LEVELS.filter(grade => $(`#spark-target-grade-${grade}-input`)?.checked);
    },

readSparkGradeQuestionsFromForm() {
        return SPARK_GRADE_LEVELS.reduce((questions, grade) => {
            const field = $(`#spark-grade-question-${grade}-input`);
            const text = String(field?.value || '').trim();
            if (text) questions[grade] = text;
            return questions;
        }, {});
    },

readSparkQuestionsFromForm() {
        const drafts = this.readSparkQuestionDraftsFromForm();
        drafts.forEach(question => {
            if (question.type !== SPARK_QUESTION_TYPES.MULTIPLE_CHOICE) return;
            const filledOptions = question.options.filter(option => String(option || '').trim());
            if (filledOptions.length < 2) {
                throw new Error('Each multiple-choice question needs at least two answer options.');
            }
            if (!String(question.options[question.correctOption] || '').trim()) {
                throw new Error('Choose a filled answer option as the correct answer.');
            }
        });
        return normalizeSparkQuestions(drafts);
    },

readSparkForm(statusOverride = null) {
        const status = statusOverride || $('#spark-status-input')?.value || 'draft';
        const spark = this.normalizeSpark({
            id: $('#spark-id')?.value || this.editingSparkId || this.createSparkId(),
            sparkType: $('#spark-type')?.value || 'cool_fact',
            title: $('#spark-title-input')?.value || '',
            sparkText: $('#spark-text-input')?.value || '',
            whyItMatters: $('#spark-why-input')?.value || '',
            question: $('#spark-question-input')?.value || '',
            gradeQuestions: this.readSparkGradeQuestionsFromForm(),
            checkMode: $('#spark-check-mode-input')?.value || SPARK_CHECK_MODES.OPTIONAL,
            questions: this.readSparkQuestionsFromForm(),
            targetGrades: this.readSparkTargetGradesFromForm(),
            sourceTitle: $('#spark-source-title-input')?.value || '',
            sourceUrl: $('#spark-source-url-input')?.value || '',
            subjectSlug: DEFAULT_SUBJECT_SLUG,
            scheduledDate: $('#spark-scheduled-date-input')?.value || '',
            status,
            ownerId: this.currentUser?.uid || null
        });

        if (!spark.title) throw new Error('Add a title for this Spark.');
        if (!spark.sparkText) throw new Error('Add the Spark text students will read.');
        const editorCount = document.querySelectorAll('#spark-question-builder .spark-question-editor').length;
        if (spark.checkMode !== SPARK_CHECK_MODES.READING_ONLY && editorCount > spark.questions.length) {
            throw new Error('Finish every Check Your Understanding question.');
        }
        if (spark.questions.some(question => (
            question.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE && question.options.length < 2
        ))) {
            throw new Error('Each multiple-choice question needs at least two answer options.');
        }
        if (
            spark.checkMode !== SPARK_CHECK_MODES.READING_ONLY
            && spark.questions.length === 0
            && !spark.question
            && Object.keys(spark.gradeQuestions).length === 0
        ) {
            throw new Error('Add at least one question or choose Reading only.');
        }
        if (spark.targetGrades.length === 0) throw new Error('Choose at least one target grade.');
        if (spark.status === 'scheduled' && !spark.scheduledDate) {
            throw new Error('Choose a scheduled date before scheduling this Spark.');
        }
        if (spark.sourceUrl && !/^https?:\/\//i.test(spark.sourceUrl)) {
            throw new Error('Source URL must start with http:// or https://.');
        }

        return spark;
    },

setSparkModalStatus(text, state = 'muted') {
        const el = $('#spark-modal-status');
        if (!el) return;
        el.textContent = text || '';
        const colors = {
            success: 'var(--success-color)',
            error: 'var(--danger-color)',
            info: 'var(--secondary-color)',
            muted: 'var(--text-muted)'
        };
        el.style.color = colors[state] || colors.muted;
    },
};

