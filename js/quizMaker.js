import { $, createElement, loadScript } from './main.js';

const HTML2CANVAS_SRC = 'js/libs/html2canvas.min.js';
const JSZIP_SRC = 'js/libs/jszip.min.js';

export class QuizMaker {
    constructor(vocabSet, onClose) {
        this.vocabSet = vocabSet;
        this.onClose = onClose;
        this.questions = [];
        this.meta = {
            title: `${vocabSet.name || 'Quiz'}`,
            instructions: 'This is an individual summative activity. This sheet must be filled out in pen (black or blue). Follow the instructions given by the teacher, stay seated and focused on your activity at all times during this assignment.',
            schoolName: 'ACADEMIA INTERNACIONAL DE DAVID',
            teacherName: 'Porfirio Rios',
            grade: vocabSet.grade || '',
            showBorder: true,
            fontFamily: "Arial, sans-serif",
            rubric: [
                { title: 'Date and Name:', desc: 'Complete Name and Date (short date) in the correct English format.', points: 2 },
                { title: 'Follows instructions:', desc: 'The student follows the assignment guidelines and teacher\'s directions.', points: 1 },
                { title: 'Content:', desc: '', points: 45 },
                { title: 'Punctuality and responsibility:', desc: 'Brings necessary implements, works hard, focuses on his workshop and submits work in time.', points: 2 }
            ],
            date: '',
            name: '',
            score: ''
        };
        this.dragSrcEl = null;
        this.sectionIdCounter = 0;
        this.autoGenerateTimer = null;
        this.sectionTypes = {
            mc: { title: 'Multiple Choice', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 5, points: 1 } },
            sata: { title: 'Select All That Apply', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 3, points: 2, choices: 5, correct: 2 } },
            tf: { title: 'True / False', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 5, points: 1 } },
            matching: { title: 'Matching', countLabel: 'Pairs', pointsLabel: 'Pts / pair', defaults: { count: 5, points: 1 } },
            short: { title: 'Short Answer', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 1, points: 1 } },
            synonym: { title: 'Synonym / Antonym', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 5, points: 1 } },
            wordsearch: { title: 'Word Search', countLabel: 'Words', pointsLabel: 'Activity points', defaults: { count: 12, points: 10 } },
            crossword: { title: 'Crossword', countLabel: 'Words', pointsLabel: 'Activity points', defaults: { count: 8, points: 10 } }
        };
        this.quizSections = [
            this.createQuizSection('mc', { count: 5, points: 1 }),
            this.createQuizSection('tf', { count: 5, points: 1 }),
            this.createQuizSection('matching', { count: 5, points: 1 }),
            this.createQuizSection('short', { count: 1, points: 1 }),
            this.createQuizSection('synonym', { count: 5, points: 1 })
        ];

        this.init();
    }

    init() {
        this.renderEditor();
        this.attachGlobalListeners();
        this.generateQuizFromSections();
    }

    createQuizSection(type, overrides = {}) {
        const defaults = this.sectionTypes?.[type]?.defaults || {};
        this.sectionIdCounter += 1;
        return {
            id: `section-${this.sectionIdCounter}`,
            type,
            ...defaults,
            ...overrides
        };
    }

    syncSectionsFromInputs() {
        const rows = Array.from(document.querySelectorAll('.quiz-section-card'));
        rows.forEach(row => {
            const section = this.quizSections.find(item => item.id === row.dataset.sectionId);
            if (!section) return;
            section.count = parseInt(row.querySelector('[data-field="count"]')?.value) || 0;
            section.points = parseInt(row.querySelector('[data-field="points"]')?.value) || 0;
            section.choices = parseInt(row.querySelector('[data-field="choices"]')?.value) || section.choices;
            section.correct = parseInt(row.querySelector('[data-field="correct"]')?.value) || section.correct;
        });
    }

    async ensureHtml2Canvas() {
        if (typeof window.html2canvas === 'function') return window.html2canvas;
        await loadScript(HTML2CANVAS_SRC);
        if (typeof window.html2canvas !== 'function') {
            throw new Error('html2canvas library not loaded');
        }
        return window.html2canvas;
    }

    async ensureJSZip() {
        if (typeof window.JSZip === 'function') return window.JSZip;
        await loadScript(JSZIP_SRC);
        if (typeof window.JSZip !== 'function') {
            throw new Error('JSZip library not loaded');
        }
        return window.JSZip;
    }

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    generateQuizFromSections() {
        this.syncSectionsFromInputs();
        this.questions = [];
        this.quizSections.forEach(section => {
            const count = parseInt(section.count) || 0;
            if (count > 0) {
                this.addQuestions(section.type, count, parseInt(section.points) || 1, section);
            }
        });
        this.renderEditor();
    }

    scheduleAutoGenerate() {
        window.clearTimeout(this.autoGenerateTimer);
        this.autoGenerateTimer = window.setTimeout(() => this.generateQuizFromSections(), 350);
    }

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
                            <button type="button" class="btn text-btn quiz-section-up" title="Move section up" ${index === 0 ? 'disabled' : ''}>↑</button>
                            <button type="button" class="btn text-btn quiz-section-down" title="Move section down" ${index === this.quizSections.length - 1 ? 'disabled' : ''}>↓</button>
                            <button type="button" class="btn text-btn quiz-section-remove" title="Remove section">×</button>
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
        $('#quiz-maker-close-btn').onclick = () => this.onClose();
        $('#quiz-maker-print-btn').onclick = () => this.printQuiz();
        const imageBtn = $('#quiz-maker-image-btn');
        if (imageBtn) {
            imageBtn.onclick = () => this.exportAsImage();
        }
        const pdfBtn = $('#quiz-maker-pdf-btn');
        if (pdfBtn) {
            pdfBtn.onclick = () => this.exportAsPDF();
        }
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

    async exportAsImage() {
        const target = $('#quiz-questions-list');
        if (!target) {
            alert('Preview not ready to export.');
            return;
        }

        const pages = Array.from(target.querySelectorAll('.document-page')).filter(Boolean);
        if (pages.length === 0) {
            alert('No pages to export.');
            return;
        }

        let html2canvas;
        try {
            html2canvas = await this.ensureHtml2Canvas();
        } catch (err) {
            console.error('Export image failed:', err);
            alert('Could not load the image export library.');
            return;
        }

        const captures = [];
        for (const page of pages) {
            const clone = page.cloneNode(true);
            clone.style.background = '#fff';
            clone.style.zoom = '1';
            clone.style.padding = '0.45in';
            clone.style.width = '8.5in';
            clone.style.minHeight = '11in';
            clone.style.boxSizing = 'border-box';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            document.body.appendChild(clone);

            try {
                const canvas = await html2canvas(clone, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    width: clone.offsetWidth,
                    height: clone.offsetHeight,
                    useCORS: true
                });
                captures.push(canvas.toDataURL('image/png'));
            } catch (err) {
                console.error('Export image failed:', err);
                alert('Could not export image.');
            } finally {
                document.body.removeChild(clone);
            }
        }

        if (!captures.length) return;

        // Show preview overlay with pagination and download
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.55);
            display:flex; align-items:center; justify-content:center;
            z-index:10000; padding:2rem; box-sizing:border-box;
        `;

        const pagesHtml = captures.map((src, idx) => `
            <div class="image-page" data-idx="${idx}" style="display:${idx === 0 ? 'block' : 'none'};">
                <img src="${src}" alt="Quiz page ${idx + 1}" style="max-width:100%; height:auto; display:block; margin:0 auto;">
                <div style="text-align:center; margin-top:0.5rem; color:#555;">Page ${idx + 1} of ${captures.length}</div>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div style="background:#fff; width:90vw; max-width:1000px; max-height:90vh; padding:1rem; border-radius:10px; box-shadow:0 10px 40px rgba(0,0,0,0.3); display:flex; flex-direction:column; gap:0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
                    <strong>Image Preview</strong>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button id="quiz-image-prev" class="btn secondary-btn" style="padding:0.3rem 0.75rem;">Prev</button>
                        <button id="quiz-image-next" class="btn secondary-btn" style="padding:0.3rem 0.75rem;">Next</button>
                        <button id="quiz-image-download" class="btn primary-btn">Download PNGs</button>
                        <button id="quiz-image-close" class="btn text-btn">Close</button>
                    </div>
                </div>
                <div id="quiz-image-pages" style="overflow:auto; max-height:75vh; text-align:center;">
                    ${pagesHtml}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const pageEls = Array.from(overlay.querySelectorAll('.image-page'));
        let current = 0;
        const showPage = (idx) => {
            pageEls.forEach((p, i) => p.style.display = i === idx ? 'block' : 'none');
        };

        overlay.querySelector('#quiz-image-prev').onclick = () => {
            current = (current - 1 + pageEls.length) % pageEls.length;
            showPage(current);
        };
        overlay.querySelector('#quiz-image-next').onclick = () => {
            current = (current + 1) % pageEls.length;
            showPage(current);
        };
        overlay.querySelector('#quiz-image-close').onclick = () => overlay.remove();
        overlay.querySelector('#quiz-image-download').onclick = () => {
            captures.forEach((src, idx) => {
                const link = document.createElement('a');
                link.href = src;
                link.download = `${this.meta.title || 'quiz'}-page-${idx + 1}.png`;
                link.click();
            });
        };

        showPage(0);
    }

    async exportAsPDF() {
        const target = $('#quiz-questions-list');
        if (!target) {
            alert('Preview not ready to export.');
            return;
        }

        const pages = Array.from(target.querySelectorAll('.document-page')).filter(Boolean);
        if (pages.length === 0) {
            alert('No pages to export.');
            return;
        }

        const title = this.escapeHtml(this.meta.title || 'quiz');
        const pdfFrame = document.createElement('iframe');
        pdfFrame.title = `${title} PDF export`;
        pdfFrame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; opacity:0; pointer-events:none;';
        document.body.appendChild(pdfFrame);

        const pdfWindow = pdfFrame.contentWindow;
        const pdfDocument = pdfFrame.contentDocument || pdfWindow?.document;
        if (!pdfWindow || !pdfDocument) {
            pdfFrame.remove();
            alert('Could not prepare the PDF export.');
            return;
        }

        const cleanupPdfFrame = () => {
            window.setTimeout(() => {
                pdfFrame.remove();
                window.focus();
            }, 150);
        };

        pdfDocument.open();
        pdfDocument.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body {
                            margin: 0;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-family: Arial, sans-serif;
                            color: #111827;
                        }
                    </style>
                </head>
                <body>Preparing PDF...</body>
            </html>
        `);
        pdfDocument.close();

        let html2canvas;
        try {
            html2canvas = await this.ensureHtml2Canvas();
        } catch (err) {
            console.error('Export PDF failed:', err);
            pdfFrame.remove();
            alert('Could not load the PDF export library.');
            return;
        }

        const pageImages = [];
        for (const page of pages) {
            const clone = page.cloneNode(true);
            clone.style.background = '#fff';
            clone.style.zoom = '1';
            clone.style.padding = '0.45in';
            clone.style.width = '8.5in';
            clone.style.minHeight = '11in';
            clone.style.boxSizing = 'border-box';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            document.body.appendChild(clone);

            try {
                const canvas = await html2canvas(clone, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    width: clone.offsetWidth,
                    height: clone.offsetHeight,
                    useCORS: true
                });
                pageImages.push(canvas.toDataURL('image/jpeg', 0.95));
            } catch (err) {
                console.error('Export PDF failed:', err);
                alert('Could not export PDF.');
            } finally {
                document.body.removeChild(clone);
            }
        }

        if (!pageImages.length) {
            pdfFrame.remove();
            return;
        }

        pdfDocument.open();
        pdfDocument.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { size: 8.5in 11in; margin: 0; }
                        body { margin:0; padding:0; }
                        .page { width:8.5in; height:11in; display:flex; align-items:center; justify-content:center; page-break-after: always; }
                        .page:last-child { page-break-after: auto; }
                        img { width:100%; height:auto; }
                    </style>
                </head>
                <body>
                    ${pageImages.map(src => `<div class="page"><img src="${src}"></div>`).join('')}
                    <script>
                        window.addEventListener('load', () => {
                            setTimeout(() => window.print(), 250);
                        });
                    </script>
                </body>
            </html>
        `);
        pdfDocument.close();
        pdfWindow.addEventListener('afterprint', cleanupPdfFrame, { once: true });
        pdfWindow.focus();
    }

    async exportAsWord() {
        if (!this.questions.length) {
            this.generateQuizFromSections();
        }

        let JSZip;
        try {
            JSZip = await this.ensureJSZip();
        } catch (err) {
            console.error('Export Word failed:', err);
            alert('Could not load the Word export library.');
            return;
        }

        try {
            this.updateTotalPoints();
            const zip = new JSZip();
            zip.file('[Content_Types].xml', this.getDocxContentTypes());
            zip.folder('_rels').file('.rels', this.getDocxRootRels());
            const word = zip.folder('word');
            word.file('document.xml', this.buildWordDocumentXml());
            word.file('styles.xml', this.getDocxStyles());
            word.folder('_rels').file('document.xml.rels', this.getDocxDocumentRels());

            const blob = await zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            this.downloadBlob(blob, `${this.safeFileName(this.meta.title || 'quiz')}.docx`);
        } catch (err) {
            console.error('Export Word failed:', err);
            alert('Could not export Word document.');
        }
    }

    buildWordDocumentXml() {
        const content = [];
        const rubricTotal = this.meta.rubric.reduce((total, item) => total + (parseInt(item.points) || 0), 0);

        content.push(this.wordHeaderTable());
        if (this.meta.instructions) {
            content.push(this.wordParagraph('INSTRUCTIONS:', { bold: true, color: '475569', after: 80 }));
            content.push(this.wordParagraph(this.meta.instructions, { after: 180 }));
        }
        content.push(this.wordInfoRow());
        if (this.meta.rubric?.length) {
            content.push(this.wordRubricTable(rubricTotal));
        }

        let partNumber = 1;
        this.groupQuestionsByType().forEach(section => {
            const sectionPoints = section.questions.reduce((total, question) => total + (parseInt(question.points) || 0), 0);
            const sectionPointsLabel = sectionPoints === 1 ? '1 pt' : `${sectionPoints} pts`;
            content.push(this.wordParagraph(`Part ${partNumber}: ${section.title}. ${sectionPointsLabel}`, { bold: true, before: 260, after: 80 }));
            content.push(this.wordParagraph(section.instructions, { italic: true, after: 160 }));
            section.questions.forEach((question, index) => {
                content.push(...this.wordQuestionBlocks(question, index + 1));
            });
            partNumber++;
        });

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${content.join('')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="648" w:right="648" w:bottom="648" w:left="648" w:header="360" w:footer="360" w:gutter="0"/>
      <w:pgBorders w:offsetFrom="page">
        <w:top w:val="single" w:sz="6" w:space="24" w:color="111827"/>
        <w:left w:val="single" w:sz="6" w:space="24" w:color="111827"/>
        <w:bottom w:val="single" w:sz="6" w:space="24" w:color="111827"/>
        <w:right w:val="single" w:sz="6" w:space="24" w:color="111827"/>
      </w:pgBorders>
    </w:sectPr>
  </w:body>
</w:document>`;
    }

    wordHeaderTable() {
        return this.wordTable([
            [
                this.wordParagraph('AID', { bold: true, align: 'center' }),
                [
                    this.wordParagraph(this.meta.schoolName || '', { bold: true, align: 'center', after: 40 }),
                    this.wordParagraph(this.meta.title || '', { bold: true, align: 'center', after: 40 }),
                    this.wordParagraph(`Teacher: ${this.meta.teacherName || ''} • Grade: ${this.meta.grade || ''}`, { bold: true, align: 'center', color: '475569' })
                ].join(''),
                this.wordParagraph(' ', { align: 'center' })
            ]
        ], { widths: [1200, 7200, 1200], shading: 'F8FAFC' });
    }

    wordInfoRow() {
        return this.wordTable([[
            this.wordParagraph('Name:', { bold: true, color: '64748B' }),
            this.wordParagraph('Date:', { bold: true, color: '64748B' }),
            this.wordParagraph('Grade:', { bold: true, color: '64748B' })
        ]], { widths: [3200, 3200, 3200], dashed: true });
    }

    wordRubricTable(rubricTotal) {
        const rows = [];
        for (let i = 0; i < this.meta.rubric.length; i += 2) {
            const left = this.meta.rubric[i];
            const right = this.meta.rubric[i + 1];
            rows.push([
                this.wordRubricCell(left),
                right ? this.wordRubricCell(right) : this.wordParagraph('')
            ]);
        }
        rows.push([
            this.wordParagraph(`Total points. ${rubricTotal} pts.`, { bold: true, align: 'right' }),
            this.wordParagraph('', {})
        ]);
        return this.wordTable(rows, { widths: [4800, 4800] });
    }

    wordRubricCell(item) {
        if (!item) return this.wordParagraph('');
        return [
            this.wordParagraph(item.title || '', { bold: true, after: 30 }),
            this.wordParagraph(`${item.desc || ''} ${parseInt(item.points) || 0} pts`, { after: 30 })
        ].join('');
    }

    wordQuestionBlocks(question, index) {
        const points = question.points !== undefined ? `(${question.points} pts)` : '';
        const blocks = [];
        const prompt = `${index}. ${question.prompt || ''} ${points}`.trim();

        if (question.type === 'mc' || question.type === 'synonym') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            (question.options || []).forEach((option, optionIndex) => {
                blocks.push(this.wordParagraph(`${String.fromCharCode(65 + optionIndex)}. ${option}`, { indent: 360, after: 40 }));
            });
        } else if (question.type === 'sata') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            (question.options || []).forEach((option, optionIndex) => {
                blocks.push(this.wordParagraph(`[ ] ${String.fromCharCode(65 + optionIndex)}. ${option.text || option}`, { indent: 360, after: 40 }));
            });
        } else if (question.type === 'tf') {
            blocks.push(this.wordParagraph(`__________ ${prompt}`, { after: 120 }));
        } else if (question.type === 'matching_section') {
            const rows = (question.pairs || []).map((pair, pairIndex) => [
                this.wordParagraph(`${pairIndex + 1}. ${pair.term}`),
                this.wordParagraph(`__________ ${pair.def}`)
            ]);
            blocks.push(this.wordTable(rows, { widths: [4200, 5400] }));
        } else if (question.type === 'short') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            blocks.push(this.wordParagraph('____________________________________________________________________________', { after: 80 }));
            blocks.push(this.wordParagraph('____________________________________________________________________________', { after: 120 }));
        } else if (question.type === 'wordsearch') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            blocks.push(this.wordGridTable(question.grid || []));
            blocks.push(this.wordParagraph(`Words to find: ${(question.words || []).join(', ')}`, { after: 120 }));
        } else if (question.type === 'crossword') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            blocks.push(this.wordCrosswordTable(question.grid || []));
            blocks.push(this.wordParagraph('Across', { bold: true, after: 40 }));
            (question.clues?.across || []).forEach(clue => blocks.push(this.wordParagraph(`${clue.number}. ${clue.clue}`, { after: 30 })));
            blocks.push(this.wordParagraph('Down', { bold: true, after: 40 }));
            (question.clues?.down || []).forEach(clue => blocks.push(this.wordParagraph(`${clue.number}. ${clue.clue}`, { after: 30 })));
        } else {
            blocks.push(this.wordParagraph(prompt, { after: 120 }));
        }

        return blocks;
    }

    wordGridTable(grid) {
        return this.wordTable(grid.map(row => row.map(letter => this.wordParagraph(letter, { bold: true, align: 'center', after: 0 }))), {
            widths: Array(grid[0]?.length || 0).fill(420),
            compact: true
        });
    }

    wordCrosswordTable(grid) {
        return this.wordTable(grid.map(row => row.map(cell => this.wordParagraph(cell?.letter ? '' : '', { after: 0 }))), {
            widths: Array(grid[0]?.length || 0).fill(360),
            compact: true,
            shadeEmpty: grid
        });
    }

    wordTable(rows, options = {}) {
        const widths = options.widths || [];
        const borderStyle = options.dashed ? 'dashed' : 'single';
        const tableRows = rows.map((row, rowIndex) => `
            <w:tr>
                ${row.map((cell, cellIndex) => {
                    const shade = options.shading || (options.shadeEmpty?.[rowIndex]?.[cellIndex]?.letter ? 'FFFFFF' : options.shadeEmpty ? 'E5E7EB' : null);
                    return this.wordCell(cell, widths[cellIndex], { borderStyle, shade, compact: options.compact });
                }).join('')}
            </w:tr>
        `).join('');
        return `
            <w:tbl>
                <w:tblPr>
                    <w:tblW w:w="0" w:type="auto"/>
                    <w:tblBorders>
                        <w:top w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:left w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:bottom w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:right w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                    </w:tblBorders>
                </w:tblPr>
                ${tableRows}
            </w:tbl>
            ${this.wordParagraph('', { after: 120 })}
        `;
    }

    wordCell(content, width, options = {}) {
        const widthXml = width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '';
        const shadeXml = options.shade ? `<w:shd w:fill="${options.shade}"/>` : '';
        const margin = options.compact ? 35 : 90;
        return `
            <w:tc>
                <w:tcPr>
                    ${widthXml}
                    ${shadeXml}
                    <w:tcMar>
                        <w:top w:w="${margin}" w:type="dxa"/>
                        <w:left w:w="${margin}" w:type="dxa"/>
                        <w:bottom w:w="${margin}" w:type="dxa"/>
                        <w:right w:w="${margin}" w:type="dxa"/>
                    </w:tcMar>
                </w:tcPr>
                ${content || this.wordParagraph('')}
            </w:tc>
        `;
    }

    wordParagraph(text, options = {}) {
        const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
        const indent = options.indent ? `<w:ind w:left="${options.indent}"/>` : '';
        const spacing = `<w:spacing w:before="${options.before || 0}" w:after="${options.after ?? 80}"/>`;
        const color = options.color ? `<w:color w:val="${options.color}"/>` : '';
        return `
            <w:p>
                <w:pPr>${align}${indent}${spacing}</w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
                        <w:sz w:val="24"/><w:szCs w:val="24"/>
                        ${options.bold ? '<w:b/>' : ''}
                        ${options.italic ? '<w:i/>' : ''}
                        ${color}
                    </w:rPr>
                    <w:t xml:space="preserve">${this.xmlEscape(text)}</w:t>
                </w:r>
            </w:p>
        `;
    }

    xmlEscape(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    safeFileName(value = 'quiz') {
        return String(value).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'quiz';
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    getDocxContentTypes() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
    }

    getDocxRootRels() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    }

    getDocxDocumentRels() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    }

    getDocxStyles() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
    }

    editRubric() {
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

        el.querySelector('#close-rubric-btn').onclick = () => el.remove();
        el.querySelector('#save-rubric-btn').onclick = () => {
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
            el.remove();
            this.renderEditor();
        };
    }

    addQuestions(type, count, basePoints = 1, options = {}) {
        const newQuestions = this.generateQuestions(type, count, basePoints, options);
        this.questions = [...this.questions, ...newQuestions];
    }

    generateQuestions(type, count, basePoints = 1, options = {}) {
        const words = this.vocabSet.words.filter(w => w.word && w.definition);
        if (words.length === 0) {
            alert('No valid words in this vocabulary set.');
            return [];
        }

        const generated = [];
        for (let i = 0; i < count; i++) {
            const w = words[Math.floor(Math.random() * words.length)];
            const id = Date.now() + Math.random().toString(36).substr(2, 9);

            let q = { id, type, points: basePoints };

            if (type === 'mc') {
                const distractors = this.getDistractors(w, words, 3);
                const options = this.shuffle([w.word, ...distractors]);
                q.prompt = w.definition;
                q.options = options;
                q.answer = w.word;
                q.points = basePoints;
            } else if (type === 'sata') {
                const choiceCount = Math.max(3, parseInt(options.choices) || 5);
                const correctCount = Math.min(choiceCount - 1, Math.max(2, parseInt(options.correct) || 2));
                const correctWords = this.shuffle(words).slice(0, correctCount);
                const wrongWords = this.shuffle(words.filter(item => !correctWords.includes(item))).slice(0, choiceCount - correctCount);
                const correctOptions = correctWords.map(item => ({
                    text: `${item.word} means "${item.definition}".`,
                    correct: true
                }));
                const wrongOptions = wrongWords.map(item => {
                    const wrongDefinition = this.shuffle(words.filter(other => other.word !== item.word))[0]?.definition || item.definition;
                    return {
                        text: `${item.word} means "${wrongDefinition}".`,
                        correct: false
                    };
                });
                q.prompt = 'Select all correct term-definition matches.';
                q.options = this.shuffle([...correctOptions, ...wrongOptions]);
                q.answer = q.options.filter(option => option.correct).map(option => option.text);
                q.points = basePoints;
            } else if (type === 'tf') {
                const isTrue = Math.random() > 0.5;
                let text = `${w.word} means "${w.definition}".`;
                if (!isTrue) {
                    const wrong = this.getDistractors(w, words, 1)[0];
                    text = `${w.word} means "${wrong}".`; // wrong is just the word string from getDistractors? No, need definition.
                    // Fix getDistractors to return objects or handle this better.
                    // Let's redo getDistractors to return word objects.
                    const wrongWord = words.find(o => o.word !== w.word) || w;
                    text = `${w.word} means "${wrongWord.definition}".`;
                }
                q.prompt = text;
                q.answer = isTrue ? 'True' : 'False';
                q.points = basePoints;
            } else if (type === 'matching') {
                // Matching Section logic
                // We create ONE question object that contains multiple pairs
                // But the loop above creates 'count' questions. 
                // We should break the loop if type is matching and just create one section with 'count' pairs.

                const pairs = [];
                // Get 'count' random words
                const selectedWords = this.shuffle(words).slice(0, count);
                selectedWords.forEach(w => {
                    pairs.push({ term: w.word, def: w.definition });
                });

                q = {
                    id,
                    type: 'matching_section',
                    points: (basePoints || 1) * pairs.length,
                    pairs: pairs,
                    prompt: 'Match the terms with their definitions.'
                };

                generated.push(q);
                break; // Exit loop since we created the section
            } else if (type === 'short') {
                q.prompt = `Describe the meaning of "${w.word}" in your own words.`;
                q.answer = w.definition;
                q.points = basePoints;
            } else if (type === 'synonym') {
                // Synonym/Antonym MC question
                const isSynonym = Math.random() > 0.5;
                const distractors = this.getDistractors(w, words, 3);
                const options = this.shuffle([w.word, ...distractors]);
                q.prompt = isSynonym ?
                    `Which word is a SYNONYM (similar meaning) of "${w.definition}"?` :
                    `Which word is an ANTONYM (opposite meaning) of "${w.definition}"?`;
                q.options = options;
                q.answer = w.word;
                q.type = 'synonym'; // Render like MC but keep its own section
                q.points = basePoints;
            } else if (type === 'wordsearch') {
                // Word Search - create one puzzle with multiple words
                const selectedWords = this.shuffle(words).slice(0, Math.min(count || 15, 15, words.length));
                const wordList = selectedWords.map(w => w.word);
                const puzzleData = this.generateWordSearchGrid(wordList, 15);

                q = {
                    id,
                    type: 'wordsearch',
                    points: basePoints,
                    grid: puzzleData.grid,
                    words: puzzleData.words,
                    prompt: 'Find all the vocabulary words in the word search below.'
                };
                generated.push(q);
                break; // Only create one word search
            } else if (type === 'crossword') {
                // Crossword - create one puzzle with multiple words
                const selectedWords = this.shuffle(words).slice(0, Math.min(count || 10, 10, words.length));
                const wordData = selectedWords.map(w => ({ word: w.word, clue: w.definition }));
                const puzzleData = this.generateCrosswordLayout(wordData, 15);

                q = {
                    id,
                    type: 'crossword',
                    points: basePoints,
                    grid: puzzleData.grid,
                    clues: puzzleData.clues,
                    prompt: 'Complete the crossword puzzle using the clues provided.'
                };
                generated.push(q);
                break; // Only create one crossword
            }

            generated.push(q);
        }
        return generated;
    }

    generateWordSearchGrid(words, size = 15) {
        // Create empty grid
        const grid = Array(size).fill(null).map(() => Array(size).fill(''));
        const placedWords = [];

        // Directions: right, down, diagonal-down-right
        const directions = [
            { dx: 1, dy: 0 },   // horizontal
            { dx: 0, dy: 1 },   // vertical
            { dx: 1, dy: 1 },   // diagonal
        ];

        // Try to place each word
        words.forEach(word => {
            const upperWord = word.toUpperCase();
            let placed = false;
            let attempts = 0;

            while (!placed && attempts < 50) {
                attempts++;
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const startX = Math.floor(Math.random() * size);
                const startY = Math.floor(Math.random() * size);

                // Check if word fits
                let fits = true;
                for (let i = 0; i < upperWord.length; i++) {
                    const x = startX + dir.dx * i;
                    const y = startY + dir.dy * i;

                    if (x >= size || y >= size || (grid[y][x] !== '' && grid[y][x] !== upperWord[i])) {
                        fits = false;
                        break;
                    }
                }

                // Place word if it fits
                if (fits) {
                    for (let i = 0; i < upperWord.length; i++) {
                        const x = startX + dir.dx * i;
                        const y = startY + dir.dy * i;
                        grid[y][x] = upperWord[i];
                    }
                    placedWords.push(word);
                    placed = true;
                }
            }
        });

        // Fill empty cells with random letters
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (grid[y][x] === '') {
                    grid[y][x] = letters[Math.floor(Math.random() * letters.length)];
                }
            }
        }

        return { grid, words: placedWords };
    }

    generateCrosswordLayout(wordData, size = 15) {
        // Simple crossword layout - place words in a grid pattern
        const grid = Array(size).fill(null).map(() => Array(size).fill(null));
        const clues = { across: [], down: [] };
        let clueNumber = 1;

        // Sort words by length (longest first)
        const sorted = wordData.sort((a, b) => b.word.length - a.word.length);

        // Place first word horizontally in the middle
        if (sorted.length > 0) {
            const firstWord = sorted[0].word.toUpperCase();
            const startY = Math.floor(size / 2);
            const startX = Math.floor((size - firstWord.length) / 2);

            for (let i = 0; i < firstWord.length; i++) {
                grid[startY][startX + i] = { letter: firstWord[i], number: i === 0 ? clueNumber : null };
            }
            clues.across.push({ number: clueNumber, clue: sorted[0].clue, answer: sorted[0].word });
            clueNumber++;
        }

        // Try to place remaining words
        for (let i = 1; i < Math.min(sorted.length, 8); i++) {
            const word = sorted[i].word.toUpperCase();
            const isHorizontal = i % 2 === 0;
            let placed = false;

            // Try to find intersection point
            for (let y = 1; y < size - 1 && !placed; y++) {
                for (let x = 1; x < size - 1 && !placed; x++) {
                    if (grid[y][x] && grid[y][x].letter) {
                        const letter = grid[y][x].letter;
                        const letterIndex = word.indexOf(letter);

                        if (letterIndex >= 0) {
                            // Try to place word through this intersection
                            let fits = true;
                            const positions = [];

                            if (isHorizontal) {
                                const startX = x - letterIndex;
                                if (startX >= 0 && startX + word.length <= size) {
                                    for (let j = 0; j < word.length; j++) {
                                        const cell = grid[y][startX + j];
                                        if (cell && cell.letter && cell.letter !== word[j]) {
                                            fits = false;
                                            break;
                                        }
                                        positions.push({ x: startX + j, y });
                                    }

                                    if (fits) {
                                        positions.forEach((pos, idx) => {
                                            grid[pos.y][pos.x] = {
                                                letter: word[idx],
                                                number: idx === 0 ? clueNumber : (grid[pos.y][pos.x]?.number || null)
                                            };
                                        });
                                        clues.across.push({ number: clueNumber, clue: sorted[i].clue, answer: sorted[i].word });
                                        clueNumber++;
                                        placed = true;
                                    }
                                }
                            } else {
                                const startY = y - letterIndex;
                                if (startY >= 0 && startY + word.length <= size) {
                                    for (let j = 0; j < word.length; j++) {
                                        const cell = grid[startY + j][x];
                                        if (cell && cell.letter && cell.letter !== word[j]) {
                                            fits = false;
                                            break;
                                        }
                                        positions.push({ x, y: startY + j });
                                    }

                                    if (fits) {
                                        positions.forEach((pos, idx) => {
                                            grid[pos.y][pos.x] = {
                                                letter: word[idx],
                                                number: idx === 0 ? clueNumber : (grid[pos.y][pos.x]?.number || null)
                                            };
                                        });
                                        clues.down.push({ number: clueNumber, clue: sorted[i].clue, answer: sorted[i].word });
                                        clueNumber++;
                                        placed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return { grid, clues };
    }

    getDistractors(targetWord, allWords, count) {
        const others = allWords.filter(w => w.word !== targetWord.word);
        const shuffled = this.shuffle(others);
        return shuffled.slice(0, count).map(w => w.word);
    }

    shuffle(array) {
        return array.sort(() => Math.random() - 0.5);
    }

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
        const card = createElement('div', 'doc-q-card');
        const pts = q.points !== undefined ? `(${q.points} pts)` : '';

        const renderMC = () => `
            <div class="q-prompt"><strong>${index}.</strong> ${q.prompt} ${pts}</div>
            <div class="q-options" style="margin-left: 1.5rem;">
                ${q.options.map((opt, i) => `
                    <div class="q-option" style="margin-bottom: 0.35rem;">
                        <span style="display:inline-block; width:22px;">${String.fromCharCode(65 + i)}.</span> ${opt}
                    </div>
                `).join('')}
            </div>
        `;

        const renderSATA = () => `
            <div class="q-prompt"><strong>${index}.</strong> ${q.prompt} ${pts}</div>
            <div class="q-options" style="margin-left: 1.5rem;">
                ${q.options.map((opt, i) => `
                    <div class="q-option" style="margin-bottom: 0.35rem;">
                        <span style="display:inline-block; width:22px;">[ ]</span>
                        <span style="display:inline-block; width:22px;">${String.fromCharCode(65 + i)}.</span> ${opt.text || opt}
                    </div>
                `).join('')}
            </div>
        `;

        const renderTF = () => `
            <div class="q-prompt tf-question-line">
                <span class="tf-answer-line"></span>
                <span><strong>${index}.</strong> ${q.prompt} ${pts}</span>
            </div>
        `;

        const renderFill = () => `
            <div class="q-prompt"><strong>${index}.</strong> ${q.prompt} ${pts}</div>
            <div style="margin-left: 1.5rem; border-bottom: 1px solid #000; min-height: 24px; margin-top: 0.5rem;"></div>
        `;

        const renderShort = () => `
            <div class="q-prompt" style="margin-bottom: 0.5rem;"><strong>${index}.</strong> ${q.prompt} ${pts}</div>
            <div style="margin-left: 1.5rem;">
                <div style="border-bottom: 1px solid #000; min-height: 80px;"></div>
            </div>
        `;

        const renderMatching = () => {
            const left = q.pairs.map((pair, i) => `<div style="margin-bottom:0.5rem;"><strong>${i + 1}.</strong> ${pair.term}</div>`).join('');
            const right = q.pairs.map(pair => `
                <div class="matching-definition">
                    <span class="matching-answer-line"></span>
                    <span>${pair.def}</span>
                </div>
            `).join('');
            return `
                <div style="margin-left:1.5rem; display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                    <div class="terms">${left}</div>
                    <div class="defs">${right}</div>
                </div>
            `;
        };

        const renderWordSearch = () => `
            <div class="q-prompt" style="margin-bottom:0.5rem;"><strong>${index}.</strong> ${q.prompt || 'Find all the words'} ${pts}</div>
            <div style="margin: 1rem 0;">
                <table style="border-collapse: collapse; margin: 0 auto; width: 100%; max-width: 600px;">
                    ${q.grid.map(row => `
                        <tr>
                            ${row.map(letter => `
                                <td style="width: 6.67%; height: 32px; border: 1px solid #000; text-align: center; font-weight: bold; font-size: 16px;">
                                    ${letter}
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </table>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.95rem;">
                <strong>Words to find:</strong>
                <div style="column-count: 3; column-gap: 1.5rem; margin-top: 0.35rem; line-height: 1.6;">
                    ${q.words.map(word => `<div>${word}</div>`).join('')}
                </div>
            </div>
        `;

        const renderCrossword = () => `
            <div class="q-prompt" style="margin-bottom:0.5rem;"><strong>${index}.</strong> ${q.prompt || 'Complete the crossword using the clues.'} ${pts}</div>
            <div style="margin: 1rem 0;">
                <table style="border-collapse: collapse; margin: 0 auto;">
                    ${q.grid.map(row => `
                        <tr>
                            ${row.map(cell => {
                                if (cell && cell.letter) {
                                    return `
                                        <td style="width: 30px; height: 30px; border: 1px solid #000; position: relative; background: white;">
                                            ${cell.number ? `<span style="position: absolute; top: 1px; left: 2px; font-size: 8px;">${cell.number}</span>` : ''}
                                            <div style="width: 100%; height: 100%;"></div>
                                        </td>
                                    `;
                                }
                                return `<td style="width: 30px; height: 30px; background: #e5e7eb; border: 1px solid #e5e7eb;"></td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </table>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-top: 1rem;">
                <div>
                    <h4 style="margin: 0 0 0.5rem 0;">Across</h4>
                    ${q.clues.across.map(clue => `<div style="margin-bottom:0.35rem;">${clue.number}. ${clue.clue}</div>`).join('')}
                </div>
                <div>
                    <h4 style="margin: 0 0 0.5rem 0;">Down</h4>
                    ${q.clues.down.map(clue => `<div style="margin-bottom:0.35rem;">${clue.number}. ${clue.clue}</div>`).join('')}
                </div>
            </div>
        `;

        const typeMap = {
            mc: renderMC,
            sata: renderSATA,
            tf: renderTF,
            short: renderShort,
            synonym: renderMC,
            matching_section: renderMatching,
            wordsearch: renderWordSearch,
            crossword: renderCrossword
        };

        const renderer = typeMap[q.type] || (() => `
            <div class="q-prompt"><strong>${index}.</strong> ${q.prompt || ''} ${pts}</div>
        `);

        card.innerHTML = renderer();
        if (q.type === 'wordsearch' || q.type === 'crossword') {
            card.style.pageBreakInside = 'avoid';
        }
        return card;
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

    printQuiz() {
        const editorContent = $('#quiz-questions-list').cloneNode(true);
        editorContent.querySelectorAll('.btn-icon').forEach(el => el.remove());
        editorContent.querySelectorAll('[draggable="true"]').forEach(el => {
            el.removeAttribute('draggable');
        });

        // Remove edit mode classes
        editorContent.querySelectorAll('.edit-mode').forEach(el => {
            el.classList.remove('edit-mode');
        });

        // Convert form controls into print-friendly static markup
        const toTextElement = (oldEl, text, className = '') => {
            const div = document.createElement('div');
            if (className) div.className = className;
            div.innerHTML = text;
            oldEl.replaceWith(div);
        };

        // Headers: swap points input for static text
        editorContent.querySelectorAll('.q-header').forEach(header => {
            const typeText = header.querySelector('.q-type')?.textContent || '';
            const pointsInput = header.querySelector('.q-points');
            const pts = pointsInput ? (pointsInput.value || pointsInput.getAttribute('value') || '') : '';
            header.innerHTML = `
                <span class="q-type">${typeText}</span>
                <span style="margin-left:auto; font-weight:bold;">${pts ? `${pts} pts` : ''}</span>
            `;
        });

        // Prompts: replace textareas with divs
        editorContent.querySelectorAll('textarea.q-prompt').forEach(area => {
            const text = area.value || '';
            toTextElement(area, text, 'q-prompt');
        });

        // Answer inputs: replace with blank line
        editorContent.querySelectorAll('.q-answer-row').forEach(row => {
            const label = row.querySelector('label')?.textContent || 'Answer:';
            row.innerHTML = `
                <label>${label}</label>
                <span style="display:inline-block; border-bottom: 1px solid #000; min-width: 140px; height: 1.4rem;"></span>
            `;
        });

        // MC options: turn option rows into static text
        editorContent.querySelectorAll('.q-options').forEach(optionsEl => {
            const rows = Array.from(optionsEl.querySelectorAll('.option-row'));
            if (rows.length === 0) return;
            const staticHtml = rows.map((row, idx) => {
                const text = row.querySelector('.option-input')?.value || '';
                const letter = String.fromCharCode(65 + idx);
                return `
                    <div class="q-option" style="margin-bottom: 0.25rem;">
                        <span style="display:inline-block; width:20px;">${letter}.</span> ${text}
                    </div>
                `;
            }).join('');
            optionsEl.innerHTML = staticHtml;
        });

        // Matching pairs: render inputs as static text
        editorContent.querySelectorAll('.q-pairs').forEach(pairsEl => {
            const rows = Array.from(pairsEl.querySelectorAll('.pair-row'));
            if (rows.length === 0) return;
            const leftCol = [];
            const rightCol = [];
            rows.forEach((row, idx) => {
                const term = row.querySelector('.pair-term')?.value || '';
                const def = row.querySelector('.pair-def')?.value || '';
                leftCol.push(`<div style="margin-bottom: 0.5rem;"><strong>${idx + 1}.</strong> ${term}</div>`);
                rightCol.push(`<div style="margin-bottom: 0.5rem;"><strong>${String.fromCharCode(65 + idx)}.</strong> ${def}</div>`);
            });
            pairsEl.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="terms">${leftCol.join('')}</div>
                    <div class="defs">${rightCol.join('')}</div>
                </div>
            `;
        });

        const printWindow = window.open('', '_blank');

        printWindow.document.write(`
            <html>
            <head>
                <title>${this.meta.title}</title>
                <style>
                    @page {
                        size: letter;
                        margin: 0;
                    }

                    body { 
                        font-family: ${this.meta.fontFamily}; 
                        font-size: 12pt;
                        padding: 0; 
                        margin: 0; 
                        background: #fff;
                    }

                    #quiz-questions-list {
                        width: 100%;
                        margin: 0;
                    }

                    .document-page {
                        width: 8.5in;
                        min-height: 11in;
                        box-sizing: border-box;
                        padding: 0.45in;
                        border: ${this.meta.showBorder ? '1px solid #111827' : '0'};
                        color: #000;
                        background: #fff;
                        font-family: ${this.meta.fontFamily};
                        font-size: 12pt;
                        page-break-after: always;
                        break-after: page;
                    }

                    .band {
                        display: grid;
                        grid-template-columns: 64px 1fr 64px;
                        gap: 10px;
                        align-items: center;
                        padding: 10px 14px;
                        border-radius: 16px;
                        border: 1px solid rgba(15, 23, 42, 0.2);
                        background: #f8fafc;
                        margin-bottom: 1rem;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        page-break-after: avoid;
                    }
                    
                    .logo {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    
                    .logo img {
                        width: 64px;
                        height: 64px;
                        object-fit: contain;
                    }

                    .band h3 {
                        margin: 0;
                        text-align: center;
                        font-size: 12pt;
                        line-height: 1.3;
                    }

                    .band .meta {
                        margin-top: 2px;
                        text-align: center;
                        color: #475569;
                        font-size: 12pt;
                        font-weight: 700;
                    }
                    
                    .grade-note {
                        width: 64px;
                        height: 64px;
                        border: 1.5px solid #111827;
                        border-radius: 16px;
                    }

                    .doc-instructions {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        padding: 0.75rem;
                        margin-bottom: 1rem;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .doc-instructions h4 {
                        margin: 0 0 0.25rem 0;
                        color: #475569;
                        font-size: 12pt;
                        text-transform: uppercase;
                    }

                    .doc-instructions p {
                        margin: 0;
                        line-height: 1.35;
                    }

                    .doc-info-row {
                        display: flex;
                        gap: 1rem;
                        margin-bottom: 1rem;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .doc-info-pill {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        min-height: 36px;
                        padding: 0.45rem 0.75rem;
                        border: 1px dashed #cbd5e1;
                        border-radius: 18px;
                        background: #fff;
                        color: #64748b;
                        font-weight: 700;
                    }

                    .doc-rubric-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        margin-bottom: 1rem;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        overflow: hidden;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .doc-rubric-item {
                        padding: 0.5rem 0.75rem;
                        border-bottom: 1px solid #e5e7eb;
                        border-right: 1px solid #e5e7eb;
                    }

                    .doc-rubric-item:nth-child(2n) {
                        border-right: 0;
                    }
                    
                    .rubric-title {
                        font-weight: 700;
                        font-size: 12pt;
                    }
                    
                    .rubric-desc {
                        font-size: 12pt;
                        color: #4b5563;
                        line-height: 1.3;
                    }

                    .doc-rubric-total {
                        grid-column: 1 / -1;
                        text-align: right;
                        padding: 0.5rem 1rem;
                        font-weight: 700;
                        border-top: 1px solid #e5e7eb;
                    }

                    .section-header {
                        margin: 1.5rem 0 0.75rem 0;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        page-break-after: avoid;
                    }
                    
                    .section-header h3 {
                        margin: 0 0 0.5rem 0;
                        font-size: 12pt;
                        font-weight: bold;
                    }
                    
                    .section-header p {
                        margin: 0;
                        font-size: 12pt;
                        font-style: italic;
                    }

                    .doc-q-card {
                        margin-bottom: 1rem;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .q-prompt {
                        margin-bottom: 0.5rem;
                        line-height: 1.6;
                    }
                    
                    .q-options {
                        margin-left: 1.5rem;
                    }
                    
                    .q-option {
                        margin-bottom: 0.25rem;
                    }

                    .tf-question-line {
                        display: flex;
                        align-items: baseline;
                        gap: 0.75rem;
                    }

                    .tf-answer-line {
                        display: inline-block;
                        width: 48px;
                        min-width: 48px;
                        border-bottom: 1px solid #000;
                        transform: translateY(-0.15rem);
                    }

                    .matching-definition {
                        display: grid;
                        grid-template-columns: 42px minmax(0, 1fr);
                        gap: 0.5rem;
                        align-items: baseline;
                        margin-bottom: 0.5rem;
                    }

                    .matching-answer-line {
                        display: inline-block;
                        width: 36px;
                        border-bottom: 1px solid #000;
                        transform: translateY(-0.15rem);
                    }
                </style>
            </head>
            <body>
                ${editorContent.innerHTML}
                <script>
                    // Wait for images to load before printing?
                    setTimeout(() => {
                        window.print();
                    }, 250);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
    }
}
