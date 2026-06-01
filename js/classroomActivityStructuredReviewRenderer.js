import { escapeHtml } from './main.js';
import { normalizeResponseTemplate } from './activityStructuredResponse.js';

export function renderStructuredSubmissionReview(assignment = {}, submission = {}) {
    const template = normalizeResponseTemplate(
        assignment.activityData?.responseTemplate,
        assignment.activityData?.templateId || 'worksheet'
    );
    const responses = submission.responseData?.structuredResponses || {};

    return `
        <div class="structured-submission-review">
            ${template.blocks.map(block => {
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
                    const checkedItems = responses[block.id]?.checkedItems || {};
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-checklist readonly">
                                ${block.items.map(item => `
                                    <div class="${checkedItems[item.id] ? 'is-checked' : ''}">
                                        <i data-lucide="${checkedItems[item.id] ? 'check-square' : 'square'}"></i>
                                        <span>${escapeHtml(item.text)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'multiple-choice' || block.type === 'multi-select') {
                    const response = responses[block.id] || {};
                    const selectedItemIds = block.type === 'multiple-choice'
                        ? { [response.selectedItemId]: Boolean(response.selectedItemId) }
                        : (Array.isArray(response.selectedItemIds)
                            ? Object.fromEntries(response.selectedItemIds.map(itemId => [itemId, true]))
                            : response.selectedItemIds || {});
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-checklist structured-response-options readonly">
                                ${block.items.map(item => {
                                    const isSelected = selectedItemIds[item.id] === true;
                                    const icon = block.type === 'multiple-choice'
                                        ? (isSelected ? 'circle-dot' : 'circle')
                                        : (isSelected ? 'check-square' : 'square');
                                    return `
                                        <div class="${isSelected ? 'is-checked' : ''}">
                                            <i data-lucide="${icon}"></i>
                                            <span>${escapeHtml(item.text)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'select') {
                    const response = responses[block.id] || {};
                    const selectedItem = block.items.find(item => item.id === response.selectedItemId);
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-answer-readonly">${escapeHtml(selectedItem?.text || 'No response yet.')}</div>
                        </section>
                    `;
                }

                if (block.type === 'true-false') {
                    const answer = responses[block.id]?.selectedItemId;
                    const display = answer === 'true' ? 'True' : (answer === 'false' ? 'False' : 'No response yet.');
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-answer-readonly">${escapeHtml(display)}</div>
                        </section>
                    `;
                }

                if (block.type === 'rating-scale' || block.type === 'number' || block.type === 'date') {
                    const response = responses[block.id] || {};
                    const answer = block.type === 'rating-scale'
                        ? response.rating
                        : (block.type === 'number' ? response.number : response.date);
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-answer-readonly">${escapeHtml(String(answer ?? '').trim() || 'No response yet.')}</div>
                        </section>
                    `;
                }

                if (block.type === 'matching') {
                    const matches = responses[block.id]?.matches || {};
                    const matchMap = Object.fromEntries(block.items.map(item => [item.id, item.matchText]));
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-matching readonly">
                                ${block.items.map(item => `
                                    <div class="structured-response-matching-row">
                                        <span>${escapeHtml(item.text)}</span>
                                        <strong>${escapeHtml(matchMap[matches[item.id]] || 'No match selected.')}</strong>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'ranking') {
                    const ranks = responses[block.id]?.ranks || {};
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-ranking readonly">
                                ${block.items.map(item => `
                                    <div>
                                        <strong>${escapeHtml(ranks[item.id] || '-')}</strong>
                                        <span>${escapeHtml(item.text)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'table-grid') {
                    const cells = responses[block.id]?.cells || {};
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-table-wrapper">
                                <table class="structured-response-table readonly">
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
                                                ${block.columns.map(column => `<td>${escapeHtml(cells[row.id]?.[column.id] || '')}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    `;
                }

                const answer = String(responses[block.id]?.text || '').trim();
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-answer-readonly">${escapeHtml(answer || 'No response yet.')}</div>
                    </section>
                `;
            }).join('')}
        </div>
    `;
}
