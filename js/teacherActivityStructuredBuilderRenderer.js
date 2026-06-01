import { $, escapeHtml } from './main.js';
import {
    STRUCTURED_BLOCK_TYPE_LABELS,
    STRUCTURED_BLOCK_TYPES,
    canRequireStructuredBlock,
    getStructuredBlockPolicy,
    normalizeResponseTemplate,
    structuredBlockUsesGrid,
    structuredBlockUsesItems,
    structuredBlockUsesPairs
} from './activityStructuredResponse.js';

function renderStructuredBuilderBlock(block, index, total) {
    const typeOptions = STRUCTURED_BLOCK_TYPES
        .map(type => `<option value="${escapeHtml(type)}" ${block.type === type ? 'selected' : ''}>${escapeHtml(STRUCTURED_BLOCK_TYPE_LABELS[type])}</option>`)
        .join('');
    const blockPolicy = getStructuredBlockPolicy(block.type);
    const canBeRequired = canRequireStructuredBlock(block.type);
    const requiredLabel = canBeRequired ? 'Required on submit' : blockPolicy.lockedRequiredLabel || 'Not required';
    const itemCopy = {
        checklist: ['Checklist Items', 'Checklist item', 'Add Item'],
        ranking: ['Ranking Items', 'Ranking item', 'Add Item'],
        select: ['Dropdown Choices', 'Dropdown choice', 'Add Choice'],
        'multiple-choice': ['Answer Choices', 'Answer choice', 'Add Choice'],
        'multi-select': ['Answer Choices', 'Answer choice', 'Add Choice']
    };
    const [itemsLabel, itemInputLabel, addItemLabel] = itemCopy[block.type] || ['Answer Choices', 'Answer choice', 'Add Choice'];
    const itemsHtml = structuredBlockUsesItems(block.type)
        ? `
            <div class="structured-builder-items">
                <div class="structured-builder-items-heading">
                    <strong>${escapeHtml(itemsLabel)}</strong>
                    <button type="button" class="btn text-btn" data-structured-add-item="${escapeHtml(block.id)}">
                        <i data-lucide="plus"></i>
                        ${escapeHtml(addItemLabel)}
                    </button>
                </div>
                ${block.items.map(item => `
                    <div class="structured-builder-item" data-item-id="${escapeHtml(item.id)}">
                        <input type="text" data-structured-item-text value="${escapeHtml(item.text)}" aria-label="${escapeHtml(itemInputLabel)}">
                        <button type="button" class="btn text-btn icon-btn" data-structured-delete-item="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(itemInputLabel.toLowerCase())}">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `
        : '';
    const matchingHtml = structuredBlockUsesPairs(block.type)
        ? `
            <div class="structured-builder-items">
                <div class="structured-builder-items-heading">
                    <strong>Matching Pairs</strong>
                    <button type="button" class="btn text-btn" data-structured-add-match="${escapeHtml(block.id)}">
                        <i data-lucide="plus"></i>
                        Add Pair
                    </button>
                </div>
                ${block.items.map(item => `
                    <div class="structured-builder-item structured-builder-match-item" data-item-id="${escapeHtml(item.id)}">
                        <label>
                            <span>Item</span>
                            <input type="text" data-structured-match-text value="${escapeHtml(item.text)}" aria-label="Matching item">
                        </label>
                        <label>
                            <span>Correct match</span>
                            <input type="text" data-structured-match-answer value="${escapeHtml(item.matchText)}" aria-label="Matching answer">
                        </label>
                        <button type="button" class="btn text-btn icon-btn" data-structured-delete-match="${escapeHtml(item.id)}" aria-label="Delete matching pair">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `
        : '';
    const ratingHtml = block.type === 'rating-scale'
        ? `
            <div class="structured-builder-scale">
                <label>
                    <span>Lowest rating</span>
                    <input type="number" min="0" max="9" step="1" data-structured-scale-min value="${escapeHtml(block.scaleMin ?? 1)}">
                </label>
                <label>
                    <span>Highest rating</span>
                    <input type="number" min="1" max="10" step="1" data-structured-scale-max value="${escapeHtml(block.scaleMax ?? 5)}">
                </label>
            </div>
        `
        : '';
    const tableGridHtml = structuredBlockUsesGrid(block.type)
        ? `
            <div class="structured-builder-grid-config">
                <div class="structured-builder-items">
                    <div class="structured-builder-items-heading">
                        <strong>Rows</strong>
                        <button type="button" class="btn text-btn" data-structured-add-grid-row="${escapeHtml(block.id)}">
                            <i data-lucide="plus"></i>
                            Add Row
                        </button>
                    </div>
                    ${block.rows.map(row => `
                        <div class="structured-builder-item structured-builder-grid-row" data-item-id="${escapeHtml(row.id)}">
                            <input type="text" data-structured-grid-text value="${escapeHtml(row.text)}" aria-label="Table row label">
                            <button type="button" class="btn text-btn icon-btn" data-structured-delete-grid-row="${escapeHtml(row.id)}" aria-label="Delete row">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div class="structured-builder-items">
                    <div class="structured-builder-items-heading">
                        <strong>Columns</strong>
                        <button type="button" class="btn text-btn" data-structured-add-grid-column="${escapeHtml(block.id)}">
                            <i data-lucide="plus"></i>
                            Add Column
                        </button>
                    </div>
                    ${block.columns.map(column => `
                        <div class="structured-builder-item structured-builder-grid-column" data-item-id="${escapeHtml(column.id)}">
                            <input type="text" data-structured-grid-text value="${escapeHtml(column.text)}" aria-label="Table column label">
                            <button type="button" class="btn text-btn icon-btn" data-structured-delete-grid-column="${escapeHtml(column.id)}" aria-label="Delete column">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `
        : '';

    return `
        <article class="structured-builder-block" data-block-id="${escapeHtml(block.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(STRUCTURED_BLOCK_TYPE_LABELS[block.type] || 'Block')}</strong>
                <div class="structured-builder-actions">
                    <button type="button" class="btn text-btn icon-btn" data-structured-move="up" ${index === 0 ? 'disabled' : ''} aria-label="Move block up">
                        <i data-lucide="arrow-up"></i>
                    </button>
                    <button type="button" class="btn text-btn icon-btn" data-structured-move="down" ${index === total - 1 ? 'disabled' : ''} aria-label="Move block down">
                        <i data-lucide="arrow-down"></i>
                    </button>
                    <button type="button" class="btn text-btn icon-btn" data-structured-duplicate-block aria-label="Duplicate block">
                        <i data-lucide="copy"></i>
                    </button>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-structured-delete-block aria-label="Delete block">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="structured-builder-fields">
                <label>
                    <span>Block Type</span>
                    <select data-structured-field="type">${typeOptions}</select>
                </label>
                <label>
                    <span>Prompt</span>
                    <textarea rows="2" data-structured-field="prompt">${escapeHtml(block.prompt)}</textarea>
                </label>
                <label>
                    <span>Helper Text</span>
                    <textarea rows="2" data-structured-field="helperText">${escapeHtml(block.helperText)}</textarea>
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-structured-field="required" ${block.required ? 'checked' : ''} ${canBeRequired ? '' : 'disabled'}>
                    <span>${escapeHtml(requiredLabel)}</span>
                </label>
                ${itemsHtml}
                ${matchingHtml}
                ${ratingHtml}
                ${tableGridHtml}
            </div>
        </article>
    `;
}

export function renderStructuredResponseBuilder(manager, root = $('#activity-structured-root')) {
    if (!root || !manager.activity?.id) return;
    const template = normalizeResponseTemplate(
        manager.activity.activityData?.responseTemplate,
        manager.activity.activityData?.templateId || 'worksheet'
    );
    manager.activity.activityData.responseTemplate = template;
    const blockCount = template.blocks.length;
    const responseCount = template.blocks.filter(block => block.type !== 'instructions').length;

    root.innerHTML = `
        <div class="structured-builder-shell" data-structured-mode="build">
            <div class="structured-mode-header">
                <div>
                    <h4>Build Response Form</h4>
                    <p>${escapeHtml(`${blockCount} blocks · ${responseCount} student response prompts`)}</p>
                </div>
            </div>

            <section class="structured-builder-build" data-structured-build-panel>
                <div class="structured-builder-toolbar">
                    <label class="teacher-toolbar-select" for="structured-add-block-type">
                        <span>Add block</span>
                        <select id="structured-add-block-type" data-structured-add-type>
                            ${STRUCTURED_BLOCK_TYPES.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(STRUCTURED_BLOCK_TYPE_LABELS[type])}</option>`).join('')}
                        </select>
                    </label>
                    <button type="button" class="btn secondary-btn" data-structured-add-block>
                        <i data-lucide="plus"></i>
                        Add Block
                    </button>
                </div>
                <div class="structured-builder-list">
                    ${template.blocks.map((block, index) => renderStructuredBuilderBlock(block, index, template.blocks.length)).join('')}
                </div>
            </section>
        </div>
    `;

    root.onclick = event => manager.handleStructuredBuilderClick(event);
    root.oninput = event => manager.handleStructuredBuilderInput(event);
    root.onchange = event => manager.handleStructuredBuilderInput(event);
    manager.refreshIcons();
}
