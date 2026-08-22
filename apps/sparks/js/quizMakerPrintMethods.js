import { $ } from './main.js';

class QuizMakerPrintMethods {
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
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.setTimeout(() => printWindow.print(), 250);
    }
}

export function installQuizMakerPrintMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerPrintMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerPrintMethods.prototype, name)
        );
    }
}
