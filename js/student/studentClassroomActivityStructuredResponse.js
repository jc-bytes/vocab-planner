import { $, escapeHtml } from '../main.js';
import { STRUCTURED_RESPONSE_TYPE, normalizeResponseTemplate } from '../activityStructuredResponse.js';

class StudentClassroomActivityStructuredResponseMethods {
    renderStructuredResponseForm(template, responses = {}) {
        const normalized = normalizeResponseTemplate(template);
        return `
            <div class="student-structured-response-form">
                ${normalized.blocks.map(block => this.renderStructuredResponseBlock(block, responses?.[block.id])).join('')}
            </div>
        `;
    }

    renderStructuredResponseBlock(block, response = {}) {
        const helper = block.helperText ? `<p>${escapeHtml(block.helperText)}</p>` : '';
        if (block.type === 'instructions') {
            return `
                <section class="structured-response-block instructions-block" data-response-block-id="${escapeHtml(block.id)}">
                    <h4>${escapeHtml(block.prompt)}</h4>
                    ${helper}
                </section>
            `;
        }

        if (block.type === 'checklist') {
            const checkedItems = response?.checkedItems || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="checklist">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist">
                        ${block.items.map(item => `
                            <label>
                                <input type="checkbox" data-response-item-id="${escapeHtml(item.id)}" ${checkedItems[item.id] ? 'checked' : ''}>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'multiple-choice' || block.type === 'multi-select') {
            const selectedItemIds = block.type === 'multiple-choice'
                ? { [response?.selectedItemId]: Boolean(response?.selectedItemId) }
                : (Array.isArray(response?.selectedItemIds)
                    ? Object.fromEntries(response.selectedItemIds.map(itemId => [itemId, true]))
                    : response?.selectedItemIds || {});
            const inputType = block.type === 'multiple-choice' ? 'radio' : 'checkbox';
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="${escapeHtml(block.type)}">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        ${block.items.map(item => `
                            <label>
                                <input type="${inputType}" name="response-${escapeHtml(block.id)}" data-response-item-id="${escapeHtml(item.id)}" ${selectedItemIds[item.id] ? 'checked' : ''}>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'select') {
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="select">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <select data-response-select>
                        <option value="">Choose an option</option>
                        ${block.items.map(item => `
                            <option value="${escapeHtml(item.id)}" ${response?.selectedItemId === item.id ? 'selected' : ''}>${escapeHtml(item.text)}</option>
                        `).join('')}
                    </select>
                </section>
            `;
        }

        if (block.type === 'true-false') {
            const selectedValue = response?.selectedItemId || '';
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="true-false">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        ${['true', 'false'].map(value => `
                            <label>
                                <input type="radio" name="response-${escapeHtml(block.id)}" value="${value}" data-response-true-false ${selectedValue === value ? 'checked' : ''}>
                                <span>${value === 'true' ? 'True' : 'False'}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'rating-scale') {
            const scaleValues = Array.from(
                { length: Math.max(1, Math.min(10, Number(block.scaleMax || 5) - Number(block.scaleMin || 1) + 1)) },
                (_, scaleIndex) => Number(block.scaleMin || 1) + scaleIndex
            );
            const selectedRating = String(response?.rating ?? '');
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="rating-scale">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-rating">
                        ${scaleValues.map(value => `
                            <label>
                                <input type="radio" name="response-${escapeHtml(block.id)}" value="${escapeHtml(value)}" data-response-rating ${selectedRating === String(value) ? 'checked' : ''}>
                                <span>${escapeHtml(value)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'number' || block.type === 'date') {
            const fieldName = block.type === 'number' ? 'number' : 'date';
            const value = escapeHtml(response?.[fieldName] ?? '');
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="${escapeHtml(block.type)}">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <input type="${fieldName}" data-response-${fieldName} value="${value}">
                </section>
            `;
        }

        if (block.type === 'matching') {
            const matches = response?.matches || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="matching">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-matching">
                        ${block.items.map(item => `
                            <label class="structured-response-matching-row">
                                <span>${escapeHtml(item.text)}</span>
                                <select data-response-match-id="${escapeHtml(item.id)}">
                                    <option value="">Choose match</option>
                                    ${block.items.map(option => `
                                        <option value="${escapeHtml(option.id)}" ${matches[item.id] === option.id ? 'selected' : ''}>${escapeHtml(option.matchText)}</option>
                                    `).join('')}
                                </select>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'ranking') {
            const ranks = response?.ranks || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="ranking">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-ranking">
                        ${block.items.map(item => `
                            <label>
                                <input type="number" min="1" max="${escapeHtml(block.items.length)}" data-response-rank-id="${escapeHtml(item.id)}" value="${escapeHtml(ranks[item.id] || '')}">
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'table-grid') {
            const cells = response?.cells || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="table-grid">
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
                                        ${block.columns.map(column => `
                                            <td>
                                                <input type="text" data-response-row-id="${escapeHtml(row.id)}" data-response-column-id="${escapeHtml(column.id)}" value="${escapeHtml(cells[row.id]?.[column.id] || '')}">
                                            </td>
                                        `).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }

        const value = escapeHtml(response?.text || '');
        const field = block.type === 'long-text'
            ? `<textarea rows="6" data-response-text>${value}</textarea>`
            : `<input type="text" data-response-text value="${value}">`;
        return `
            <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="${escapeHtml(block.type)}">
                <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                ${helper}
                ${field}
                <div class="writing-suggestion-panel" data-writing-suggestions role="status" hidden></div>
            </section>
        `;
    }

    syncStructuredResponses() {
        const root = $('#student-classroom-excalidraw-root');
        if (!root || !this.currentSubmission?.id || this.currentAssignment?.activityType !== STRUCTURED_RESPONSE_TYPE) return;
        const structuredResponses = {};

        root.querySelectorAll('[data-response-block-id]').forEach(blockEl => {
            const blockId = blockEl.dataset.responseBlockId;
            const type = blockEl.dataset.responseType || 'instructions';
            if (!blockId || type === 'instructions') return;

            if (type === 'checklist') {
                const checkedItems = {};
                blockEl.querySelectorAll('[data-response-item-id]').forEach(itemEl => {
                    checkedItems[itemEl.dataset.responseItemId] = itemEl.checked === true;
                });
                structuredResponses[blockId] = { checkedItems };
                return;
            }

            if (type === 'multiple-choice') {
                const selectedItem = blockEl.querySelector('[data-response-item-id]:checked');
                structuredResponses[blockId] = {
                    selectedItemId: selectedItem?.dataset.responseItemId || ''
                };
                return;
            }

            if (type === 'multi-select') {
                const selectedItemIds = {};
                blockEl.querySelectorAll('[data-response-item-id]').forEach(itemEl => {
                    selectedItemIds[itemEl.dataset.responseItemId] = itemEl.checked === true;
                });
                structuredResponses[blockId] = { selectedItemIds };
                return;
            }

            if (type === 'select') {
                structuredResponses[blockId] = {
                    selectedItemId: blockEl.querySelector('[data-response-select]')?.value || ''
                };
                return;
            }

            if (type === 'true-false') {
                structuredResponses[blockId] = {
                    selectedItemId: blockEl.querySelector('[data-response-true-false]:checked')?.value || ''
                };
                return;
            }

            if (type === 'rating-scale') {
                structuredResponses[blockId] = {
                    rating: blockEl.querySelector('[data-response-rating]:checked')?.value || ''
                };
                return;
            }

            if (type === 'number') {
                structuredResponses[blockId] = {
                    number: blockEl.querySelector('[data-response-number]')?.value || ''
                };
                return;
            }

            if (type === 'date') {
                structuredResponses[blockId] = {
                    date: blockEl.querySelector('[data-response-date]')?.value || ''
                };
                return;
            }

            if (type === 'matching') {
                const matches = {};
                blockEl.querySelectorAll('[data-response-match-id]').forEach(matchEl => {
                    matches[matchEl.dataset.responseMatchId] = matchEl.value || '';
                });
                structuredResponses[blockId] = { matches };
                return;
            }

            if (type === 'ranking') {
                const ranks = {};
                blockEl.querySelectorAll('[data-response-rank-id]').forEach(rankEl => {
                    ranks[rankEl.dataset.responseRankId] = rankEl.value || '';
                });
                structuredResponses[blockId] = { ranks };
                return;
            }

            if (type === 'table-grid') {
                const cells = {};
                blockEl.querySelectorAll('[data-response-row-id][data-response-column-id]').forEach(cellEl => {
                    const rowId = cellEl.dataset.responseRowId;
                    const columnId = cellEl.dataset.responseColumnId;
                    if (!cells[rowId]) cells[rowId] = {};
                    cells[rowId][columnId] = cellEl.value || '';
                });
                structuredResponses[blockId] = { cells };
                return;
            }

            structuredResponses[blockId] = {
                text: blockEl.querySelector('[data-response-text]')?.value || ''
            };
        });

        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            structuredResponses
        };
    }
}

export function installStudentClassroomActivityStructuredResponseMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityStructuredResponseMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityStructuredResponseMethods.prototype, name)
        );
    }
}
