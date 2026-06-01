import { createElement } from './main.js';

export function renderQuizQuestionCard(q, index) {
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
