import { $, createElement } from './main.js';

class QuizMakerComposerMethods {
    renderSectionComposer() {
        const list = $('#quiz-section-list');
        if (!list) return;

        const addSectionBtn = $('#add-quiz-section-btn');
        if (addSectionBtn) {
            addSectionBtn.onclick = () => {
                const select = $('#quiz-section-type-select');
                const type = select?.value || 'mc';
                this.syncSectionsFromInputs();
                this.quizSections.push(this.createQuizSection(type));
                this.renderSectionComposer();
                this.scheduleAutoGenerate();
            };
        }

        const generateBtn = $('#generate-questions-btn');
        if (generateBtn) {
            generateBtn.onclick = () => this.generateQuizFromSections();
        }

        list.innerHTML = this.quizSections.map((section, index) => {
            const config = this.sectionTypes[section.type];
            const extraControls = section.type === 'sata' ? `
                <label>
                    <span>Choices</span>
                    <input type="number" min="3" max="8" value="${section.choices || 5}" data-field="choices">
                </label>
                <label>
                    <span>Correct</span>
                    <input type="number" min="2" max="5" value="${section.correct || 2}" data-field="correct">
                </label>
            ` : '';

            return `
                <article class="quiz-section-card" data-section-id="${section.id}">
                    <div class="quiz-section-card-header">
                        <div>
                            <span class="quiz-section-kicker">Part ${index + 1}</span>
                            <strong>${config.title}</strong>
                        </div>
                        <div class="quiz-section-actions">
                            <button type="button" class="btn text-btn quiz-section-up" title="Move section up" aria-label="Move section up" ${index === 0 ? 'disabled' : ''}><i data-lucide="arrow-up" aria-hidden="true"></i></button>
                            <button type="button" class="btn text-btn quiz-section-down" title="Move section down" aria-label="Move section down" ${index === this.quizSections.length - 1 ? 'disabled' : ''}><i data-lucide="arrow-down" aria-hidden="true"></i></button>
                            <button type="button" class="btn text-btn quiz-section-remove" title="Remove section" aria-label="Remove section"><i data-lucide="circle-x" aria-hidden="true"></i></button>
                        </div>
                    </div>
                    <div class="quiz-section-fields">
                        <label>
                            <span>${config.countLabel}</span>
                            <input type="number" min="0" value="${section.count}" data-field="count">
                        </label>
                        <label>
                            <span>${config.pointsLabel}</span>
                            <input type="number" min="0" value="${section.points}" data-field="points">
                        </label>
                        ${extraControls}
                    </div>
                </article>
            `;
        }).join('');

        window.lucide?.createIcons({ root: list });

        list.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                this.syncSectionsFromInputs();
                this.scheduleAutoGenerate();
            });
        });

        list.querySelectorAll('.quiz-section-up').forEach(btn => {
            btn.addEventListener('click', () => {
                this.syncSectionsFromInputs();
                const id = btn.closest('.quiz-section-card')?.dataset.sectionId;
                const idx = this.quizSections.findIndex(section => section.id === id);
                if (idx > 0) {
                    [this.quizSections[idx - 1], this.quizSections[idx]] = [this.quizSections[idx], this.quizSections[idx - 1]];
                    this.renderSectionComposer();
                    this.scheduleAutoGenerate();
                }
            });
        });

        list.querySelectorAll('.quiz-section-down').forEach(btn => {
            btn.addEventListener('click', () => {
                this.syncSectionsFromInputs();
                const id = btn.closest('.quiz-section-card')?.dataset.sectionId;
                const idx = this.quizSections.findIndex(section => section.id === id);
                if (idx >= 0 && idx < this.quizSections.length - 1) {
                    [this.quizSections[idx], this.quizSections[idx + 1]] = [this.quizSections[idx + 1], this.quizSections[idx]];
                    this.renderSectionComposer();
                    this.scheduleAutoGenerate();
                }
            });
        });

        list.querySelectorAll('.quiz-section-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.syncSectionsFromInputs();
                const id = btn.closest('.quiz-section-card')?.dataset.sectionId;
                this.quizSections = this.quizSections.filter(section => section.id !== id);
                this.renderSectionComposer();
                this.scheduleAutoGenerate();
            });
        });
    }

    attachToolTabs() {
        const tabs = Array.from(document.querySelectorAll('.quiz-tool-tab'));
        const panels = Array.from(document.querySelectorAll('.quiz-tool-panel'));
        tabs.forEach(tab => {
            tab.onclick = () => {
                const target = tab.dataset.quizToolTab;
                tabs.forEach(item => item.classList.toggle('active', item === tab));
                panels.forEach(panel => {
                    panel.classList.toggle('active', panel.dataset.quizToolPanel === target);
                });
            };
        });
    }

    attachGlobalListeners() {
        const closeEditor = () => {
            this.notifyStateChange();
            this.onClose();
        };
        const backBtn = $('#quiz-maker-back-btn');
        if (backBtn) backBtn.onclick = closeEditor;
        const closeBtn = $('#quiz-maker-close-btn');
        if (closeBtn) closeBtn.onclick = closeEditor;
        const wordBtn = $('#quiz-maker-word-btn');
        if (wordBtn) {
            wordBtn.onclick = () => this.exportAsWord();
        }

        this.renderSectionComposer();
        this.attachToolTabs();

        // Meta inputs
        $('#quiz-title-input').value = this.meta.title;
        $('#quiz-title-input').oninput = (e) => {
            this.meta.title = e.target.value;
            this.renderEditor();
        };

        $('#quiz-instructions-input').value = this.meta.instructions || 'This is an individual summative activity. This sheet must be filled out in pen (black or blue). Follow the instructions given by the teacher, stay seated and focused on your activity at all times during this assignment.';
        $('#quiz-instructions-input').oninput = (e) => {
            this.meta.instructions = e.target.value;
            this.renderEditor();
        };

        // New Settings
        $('#quiz-school-input').value = this.meta.schoolName;
        $('#quiz-school-input').oninput = (e) => {
            this.meta.schoolName = e.target.value;
            this.renderEditor();
        };

        const teacherInput = $('#quiz-teacher-input');
        if (teacherInput) {
            teacherInput.value = this.meta.teacherName;
            teacherInput.oninput = (e) => {
                this.meta.teacherName = e.target.value;
                this.renderEditor();
            };
        }

        const gradeInput = $('#quiz-grade-input');
        if (gradeInput) {
            gradeInput.value = this.meta.grade;
            gradeInput.oninput = (e) => {
                this.meta.grade = e.target.value;
                this.renderEditor();
            };
        }

        $('#quiz-border-toggle').checked = this.meta.showBorder;
        $('#quiz-border-toggle').onchange = (e) => {
            this.meta.showBorder = e.target.checked;
            this.renderEditor();
        };

        $('#quiz-font-select').value = this.meta.fontFamily;
        $('#quiz-font-select').onchange = (e) => {
            this.meta.fontFamily = e.target.value;
            this.renderEditor();
        };

        $('#edit-rubric-btn').onclick = () => this.editRubric();
    }

    editRubric() {
        if (this.disposed) return;
        const escapeHtml = (value = '') => String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const modalHtml = `
            <div id="rubric-modal" class="rubric-modal-backdrop">
                <div class="rubric-modal-panel" role="dialog" aria-modal="true" aria-labelledby="rubric-modal-title">
                    <div class="rubric-modal-header">
                        <div>
                            <p class="rubric-modal-eyebrow">Rubric</p>
                            <h3 id="rubric-modal-title">Edit Rubric</h3>
                        </div>
                    </div>
                    <div id="rubric-rows" class="rubric-modal-rows">
                        ${this.meta.rubric.map((r, i) => `
                            <div class="rubric-row-edit">
                                <div class="rubric-row-top">
                                    <label>
                                        <span>Criterion</span>
                                        <input type="text" value="${escapeHtml(r.title)}" class="r-title" placeholder="Criterion title">
                                    </label>
                                    <label class="rubric-points-field">
                                        <span>Pts</span>
                                        <input type="number" value="${parseInt(r.points) || 0}" class="r-points" placeholder="0" min="0">
                                    </label>
                                </div>
                                <label>
                                    <span>Description</span>
                                    <textarea class="r-desc" placeholder="Description" rows="2">${escapeHtml(r.desc || '')}</textarea>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                    <div class="rubric-modal-footer">
                        <button id="close-rubric-btn" class="btn text-btn" type="button">Cancel</button>
                        <button id="save-rubric-btn" class="btn primary-btn" type="button">Save</button>
                    </div>
                </div>
            </div>
        `;
        const el = createElement('div');
        el.innerHTML = modalHtml;
        document.body.appendChild(el);
        this.rubricOverlays.add(el);

        const removeOverlay = () => {
            this.rubricOverlays.delete(el);
            el.remove();
        };

        el.querySelector('#close-rubric-btn').onclick = removeOverlay;
        el.querySelector('#save-rubric-btn').onclick = () => {
            if (this.disposed) {
                removeOverlay();
                return;
            }
            const rows = el.querySelectorAll('.rubric-row-edit');
            const newRubric = [];
            rows.forEach(row => {
                const title = row.querySelector('.r-title').value;
                const desc = row.querySelector('.r-desc').value;
                const points = parseInt(row.querySelector('.r-points').value) || 0;
                if (title.trim()) {
                    newRubric.push({ title, desc, points });
                }
            });
            this.meta.rubric = newRubric;
            removeOverlay();
            this.renderEditor();
        };
    }
}

export function installQuizMakerComposerMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerComposerMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerComposerMethods.prototype, name)
        );
    }
}
