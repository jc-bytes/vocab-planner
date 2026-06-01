import { escapeHtml } from './main.js';
import { normalizeResponseTemplate } from './activityStructuredResponse.js';

export function renderStructuredResponsePreview(template) {
    const normalized = normalizeResponseTemplate(template);
    return normalized.blocks.map(block => {
        const helper = block.helperText ? `<p>${escapeHtml(block.helperText)}</p>` : '';
        if (block.type === 'instructions') {
            return `
                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(block.prompt)}</h4>
                    ${helper}
                </section>
            `;
        }
        if (block.type === 'checklist') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist">
                        ${block.items.map(item => `
                            <label>
                                <input type="checkbox" disabled>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'multiple-choice' || block.type === 'multi-select') {
            const inputType = block.type === 'multiple-choice' ? 'radio' : 'checkbox';
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        ${block.items.map(item => `
                            <label>
                                <input type="${inputType}" disabled>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'select') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <select disabled>
                        <option>Choose an option</option>
                        ${block.items.map(item => `<option>${escapeHtml(item.text)}</option>`).join('')}
                    </select>
                </section>
            `;
        }
        if (block.type === 'true-false') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        <label>
                            <input type="radio" disabled>
                            <span>True</span>
                        </label>
                        <label>
                            <input type="radio" disabled>
                            <span>False</span>
                        </label>
                    </div>
                </section>
            `;
        }
        if (block.type === 'rating-scale') {
            const scaleValues = Array.from(
                { length: Math.max(1, Math.min(10, Number(block.scaleMax || 5) - Number(block.scaleMin || 1) + 1)) },
                (_, scaleIndex) => Number(block.scaleMin || 1) + scaleIndex
            );
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-rating">
                        ${scaleValues.map(value => `
                            <label>
                                <input type="radio" disabled>
                                <span>${escapeHtml(value)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'number' || block.type === 'date') {
            const inputType = block.type === 'number' ? 'number' : 'date';
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <input type="${inputType}" disabled>
                </section>
            `;
        }
        if (block.type === 'matching') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-matching">
                        ${block.items.map(item => `
                            <div class="structured-response-matching-row">
                                <span>${escapeHtml(item.text)}</span>
                                <select disabled>
                                    <option>${escapeHtml(item.matchText)}</option>
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'ranking') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-ranking">
                        ${block.items.map((item, itemIndex) => `
                            <label>
                                <input type="number" min="1" max="${escapeHtml(block.items.length)}" value="${escapeHtml(itemIndex + 1)}" disabled>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'table-grid') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-table-wrapper">
                        <table class="structured-response-table">
                            <thead>
                                <tr>
                                    <th scope="col"></th>
                                    ${block.columns.map(column => `<th scope="col">${escapeHtml(column.text)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${block.rows.map(row => `
                                    <tr>
                                        <th scope="row">${escapeHtml(row.text)}</th>
                                        ${block.columns.map(() => '<td><input type="text" disabled></td>').join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }
        const field = block.type === 'long-text'
            ? '<textarea rows="4" disabled></textarea>'
            : '<input type="text" disabled>';
        return `
            <section class="structured-response-block">
                <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                ${helper}
                ${field}
            </section>
        `;
    }).join('');
}
