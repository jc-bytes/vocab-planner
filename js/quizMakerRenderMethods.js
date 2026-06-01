import { $, createElement } from './main.js';
import { renderQuizQuestionCard } from './quizMakerQuestionCardRenderer.js';

class QuizMakerRenderMethods {
    renderEditor() {
        const container = $('#quiz-questions-list');
        container.innerHTML = '';

        // Auto-scale preview
        const parentWidth = container.parentElement.offsetWidth;
        const docWidth = 816; // 8.5in
        if (parentWidth < docWidth) {
            const scale = (parentWidth - 40) / docWidth;
            container.style.setProperty('--preview-scale', scale);
            container.style.width = `${docWidth * scale}px`;
        } else {
            container.style.setProperty('--preview-scale', 1);
            container.style.width = `${docWidth}px`;
        }
        container.style.maxWidth = 'none';
        container.style.margin = '0 auto';

        // Helper to create a new page
        const createPage = (pageIndex) => {
            const page = createElement('div', 'document-page');
            page.id = `page-${pageIndex}`;
            page.style.fontFamily = this.meta.fontFamily;
            page.classList.toggle('no-page-border', !this.meta.showBorder);
            if (pageIndex > 0) page.style.pageBreakBefore = 'always';
            container.appendChild(page);
            return page;
        };

        let currentPageIndex = 0;
        let currentPage = createPage(currentPageIndex);

        // Helper to append and check overflow
        const appendToPage = (element) => {
            currentPage.appendChild(element);

            // Check overflow (threshold ~960px for 10in usable height)
            const contentHeight = Array.from(currentPage.children).reduce((acc, child) => {
                const style = window.getComputedStyle(child);
                return acc + child.offsetHeight + parseInt(style.marginTop) + parseInt(style.marginBottom);
            }, 0);

            if (contentHeight > 980) {
                currentPage.removeChild(element);
                currentPageIndex++;
                currentPage = createPage(currentPageIndex);
                currentPage.appendChild(element);
            }
        };

        // 1. Header
        const header = createElement('div', 'band');
        header.innerHTML = `
            <div class="logo">
                <img src="logo.jpeg" alt="Logo">
            </div>
            <div>
                <h3>${this.meta.schoolName}</h3>
                <h3>${this.meta.title}</h3>
                <div class="meta">
                    Teacher: <span contenteditable="true" class="editable-field" id="teacher-name-field">${this.meta.teacherName || 'Porfirio Rios'}</span> 
                    • Grade: ${this.meta.grade || ''}
                </div>
            </div>
            <div class="grade-note"></div>
        `;
        appendToPage(header);

        // Add listener for teacher name edit
        const teacherNameField = header.querySelector('#teacher-name-field');
        if (teacherNameField) {
            teacherNameField.addEventListener('blur', (e) => {
                this.meta.teacherName = e.target.textContent;
                const teacherInput = $('#quiz-teacher-input');
                if (teacherInput) teacherInput.value = this.meta.teacherName;
                this.notifyStateChange();
            });
        }

        // 2. Instructions
        if (this.meta.instructions) {
            const instr = createElement('div', 'doc-instructions');
            instr.innerHTML = `<h4>Instructions:</h4><p>${this.meta.instructions}</p>`;
            appendToPage(instr);
        }

        // 3. Student Info
        const infoRow = createElement('div', 'doc-info-row');
        infoRow.innerHTML = `
            <div class="doc-info-pill"><span class="doc-info-label">Name:</span></div>
            <div class="doc-info-pill"><span class="doc-info-label">Date:</span></div>
            <div class="doc-info-pill"><span class="doc-info-label">Grade:</span></div>
        `;
        appendToPage(infoRow);

        // 4. Rubric
        if (this.meta.rubric && this.meta.rubric.length > 0) {
            const rubricContainer = createElement('div', 'doc-rubric-grid');
            let rubricHTML = '';
            this.meta.rubric.forEach(r => {
                rubricHTML += `
                    <div class="doc-rubric-item">
                        <div class="rubric-title">${r.title}</div>
                        <div class="rubric-desc">${r.desc} <span class="rubric-pts">${r.points} pts</span></div>
                    </div>
                `;
            });
            const rubricTotal = this.meta.rubric.reduce((a, b) => a + b.points, 0);
            rubricHTML += `
                <div class="doc-rubric-total">
                    Total points. ${rubricTotal} pts.
                </div>
            `;
            rubricContainer.innerHTML = rubricHTML;
            appendToPage(rubricContainer);
        }

        // 5. Questions - Group by type and add section headers
        const questionsByType = this.groupQuestionsByType();
        let partNumber = 1;

        questionsByType.forEach(section => {
            if ((section.type === 'wordsearch' || section.type === 'crossword') && currentPage.children.length > 0) {
                currentPageIndex++;
                currentPage = createPage(currentPageIndex);
            }

            const currentContentHeight = Array.from(currentPage.children).reduce((acc, child) => {
                const style = window.getComputedStyle(child);
                return acc + child.offsetHeight + parseInt(style.marginTop) + parseInt(style.marginBottom);
            }, 0);
            if (currentContentHeight > 820) {
                currentPageIndex++;
                currentPage = createPage(currentPageIndex);
            }

            // Add section header
            const sectionHeader = createElement('div', 'section-header');
            sectionHeader.style.cssText = `margin: 1.5rem 0 0.75rem 0; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid;`;
            const sectionPoints = section.questions.reduce((total, question) => total + (parseInt(question.points) || 0), 0);
            const sectionPointsLabel = sectionPoints === 1 ? '1 pt' : `${sectionPoints} pts`;
            sectionHeader.innerHTML = `
                <h3 style="margin: 0 0 0.5rem 0; font-size: 12pt; font-weight: bold;">Part ${partNumber}: ${section.title}. ${sectionPointsLabel}</h3>
                <p style="margin: 0; font-size: 12pt; font-style: italic;">${section.instructions}</p>
            `;
            appendToPage(sectionHeader);
            partNumber++;

            // Add questions in this section
            section.questions.forEach((q, sectionIndex) => {
                const globalIndex = this.questions.indexOf(q);
                const qCard = this.renderQuestionCard(q, sectionIndex + 1); // Use 1-based section numbering
                qCard.classList.add('doc-q-card');
                qCard.dataset.globalIndex = globalIndex; // Store global index for drag/drop
                qCard.dataset.index = globalIndex;
                // Re-attach drag events
                qCard.draggable = true;
                qCard.addEventListener('dragstart', (e) => this.handleDragStart(e, globalIndex));
                qCard.addEventListener('dragover', this.handleDragOver.bind(this));
                qCard.addEventListener('drop', (e) => this.handleDrop(e, globalIndex));
                qCard.addEventListener('dragend', this.handleDragEnd.bind(this));
                qCard.style.pageBreakInside = 'avoid';
                qCard.style.breakInside = 'avoid';
                appendToPage(qCard);
            });
        });

        this.updateTotalPoints();
        this.renderSectionComposer();
        this.notifyStateChange();
    }

    groupQuestionsByType() {
        const sections = [];
        const typeMap = {
            'mc': { title: 'Multiple Choice', instructions: 'Choose the best answer for each question.' },
            'sata': { title: 'Select All That Apply', instructions: 'Select every correct answer. More than one answer may be correct.' },
            'tf': { title: 'True or False', instructions: 'Indicate whether the statement is true or false by writing T for True or F for False.' },
            'matching_section': { title: 'Matching', instructions: 'Match each term with its correct definition.' },
            'short': { title: 'Short Answer', instructions: 'Answer each question in complete sentences.' },
            'synonym': { title: 'Synonyms & Antonyms', instructions: 'Choose the synonym or antonym that best fits.' },
            'wordsearch': { title: 'Word Search', instructions: 'Find all the vocabulary words in the grid.' },
            'crossword': { title: 'Crossword Puzzle', instructions: 'Complete the crossword using the clues provided.' }
        };

        // Group consecutive questions of the same type
        let currentType = null;
        let currentSection = null;

        this.questions.forEach(q => {
            const qType = q.type;
            if (qType !== currentType) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentType = qType;
                currentSection = {
                    type: qType,
                    title: typeMap[qType]?.title || 'Questions',
                    instructions: typeMap[qType]?.instructions || 'Answer the following questions.',
                    questions: [q]
                };
            } else {
                currentSection.questions.push(q);
            }
        });

        if (currentSection) {
            sections.push(currentSection);
        }

        return sections;
    }

    updateTotalPoints() {
        // Calculate total from questions
        const questionsTotal = this.questions.reduce((a, b) => a + b.points, 0);

        // Find and update the "Content" rubric item to match questions total
        const contentRubricItem = this.meta.rubric.find(r => r.title.toLowerCase().includes('content'));
        if (contentRubricItem) {
            contentRubricItem.points = questionsTotal;
        }

        // Calculate grand total from all rubric items (which now includes updated content)
        const grandTotal = this.meta.rubric.reduce((a, b) => a + b.points, 0);

        // Update the rubric total display in the document
        const rubricTotalElement = document.querySelector('.doc-rubric-total');
        if (rubricTotalElement) {
            rubricTotalElement.textContent = `Total points. ${grandTotal} pts.`;
        }

        // Update the content rubric item display if it exists
        const rubricItems = document.querySelectorAll('.doc-rubric-item');
        rubricItems.forEach(item => {
            const titleElement = item.querySelector('.rubric-title');
            if (titleElement && titleElement.textContent.toLowerCase().includes('content')) {
                const ptsElement = item.querySelector('.rubric-pts');
                if (ptsElement) {
                    ptsElement.textContent = `${questionsTotal} pts`;
                }
            }
        });
    }

    renderQuestionsList() {
        // Redundant in doc view
    }

    renderQuestionCard(q, index) {
        return renderQuizQuestionCard(q, index);
    }

    handleDragStart(e) {
        this.dragSrcEl = e.target.closest('.doc-q-card');
        if (!this.dragSrcEl) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.dragSrcEl.innerHTML);
        this.dragSrcEl.classList.add('dragging');
    }

    handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        return false;
    }

    handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        const target = e.target.closest('.doc-q-card');
        if (this.dragSrcEl !== target) {
            const srcIdx = parseInt(this.dragSrcEl.dataset.index);
            const tgtIdx = parseInt(target?.dataset.index);
            if (Number.isNaN(srcIdx) || Number.isNaN(tgtIdx)) return false;

            // Swap in array
            const item = this.questions.splice(srcIdx, 1)[0];
            this.questions.splice(tgtIdx, 0, item);

            this.renderEditor();
            this.updateTotalPoints();
        }
        return false;
    }

    handleDragEnd(e) {
        this.questions.forEach((q, i) => {
            const card = document.querySelector(`.doc-q-card[data-index="${i}"]`);
            if (card) card.classList.remove('dragging');
        });
        // Also remove from the source element if we can find it
        if (this.dragSrcEl) {
            this.dragSrcEl.classList.remove('dragging');
        }
    }
}

export function installQuizMakerRenderMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerRenderMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerRenderMethods.prototype, name)
        );
    }
}
