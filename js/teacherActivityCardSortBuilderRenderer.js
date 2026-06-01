import { $, escapeHtml } from './main.js';
import {
    CARD_SORT_ORDER_MODES,
    normalizeCardSortTemplate
} from './activityCardSort.js';

function renderCardSortBuilderCategory(category, index, total) {
    return `
        <article class="structured-builder-block card-sort-builder-category" data-card-sort-category-id="${escapeHtml(category.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(category.title || `Category ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-card-sort-delete-category ${total <= 1 ? 'disabled' : ''} aria-label="Delete category">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields">
                <label>
                    <span>Category Name</span>
                    <input type="text" data-card-sort-category-title value="${escapeHtml(category.title)}">
                </label>
                <label>
                    <span>Helper Text</span>
                    <textarea rows="2" data-card-sort-category-helper>${escapeHtml(category.helperText)}</textarea>
                </label>
            </div>
        </article>
    `;
}

function renderCardSortBuilderCard(card, index, template) {
    const categoryOptions = template.categories.map(category => `
        <option value="${escapeHtml(category.id)}" ${card.expectedCategoryId === category.id ? 'selected' : ''}>${escapeHtml(category.title)}</option>
    `).join('');
    return `
        <article class="structured-builder-block card-sort-builder-card" data-card-sort-card-id="${escapeHtml(card.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(card.text || `Card ${index + 1}`)}</strong>
                <div class="structured-builder-actions">
                    <button type="button" class="btn text-btn icon-btn" data-card-sort-duplicate-card aria-label="Duplicate card">
                        <i data-lucide="copy"></i>
                    </button>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-card-sort-delete-card aria-label="Delete card">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
            <div class="structured-builder-fields card-sort-card-fields">
                <label>
                    <span>Card Text</span>
                    <input type="text" data-card-sort-card-text value="${escapeHtml(card.text)}">
                </label>
                <label>
                    <span>Helper Text</span>
                    <textarea rows="2" data-card-sort-card-helper>${escapeHtml(card.helperText)}</textarea>
                </label>
                <label>
                    <span>Expected Category</span>
                    <select data-card-sort-card-category>${categoryOptions}</select>
                </label>
                <label>
                    <span>Expected Order</span>
                    <input type="number" min="1" step="1" data-card-sort-card-order value="${escapeHtml(card.expectedOrder || index + 1)}">
                </label>
            </div>
        </article>
    `;
}

export function renderCardSortBuilder(manager, root = $('#activity-card-sort-root')) {
    if (!root || !manager.activity?.id) return;
    const template = normalizeCardSortTemplate(
        manager.activity.activityData?.cardSortTemplate,
        manager.activity.activityData?.templateId || 'category-sort'
    );
    manager.activity.activityData.cardSortTemplate = template;
    const orderModeOptions = CARD_SORT_ORDER_MODES.map(mode => {
        const label = mode === 'within-categories' ? 'Allow order inside categories' : 'Category only';
        return `<option value="${escapeHtml(mode)}" ${template.orderMode === mode ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');

    root.innerHTML = `
        <div class="structured-builder-shell card-sort-builder-shell">
            <div class="structured-mode-header">
                <div>
                    <h4>Build Card Sort</h4>
                    <p>${escapeHtml(`${template.categories.length} categories · ${template.cards.length} cards`)}</p>
                </div>
            </div>

            <section class="card-sort-builder-section">
                <div class="card-sort-builder-grid">
                    <label>
                        <span>Student Prompt</span>
                        <textarea rows="2" data-card-sort-field="prompt">${escapeHtml(template.prompt)}</textarea>
                    </label>
                    <label>
                        <span>Helper Text</span>
                        <textarea rows="2" data-card-sort-field="helperText">${escapeHtml(template.helperText)}</textarea>
                    </label>
                </div>
                <div class="card-sort-builder-grid card-sort-builder-options">
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-card-sort-field="requireAllCards" ${template.requireAllCards ? 'checked' : ''}>
                        <span>Require all cards before submit</span>
                    </label>
                    <label>
                        <span>Ordering</span>
                        <select data-card-sort-field="orderMode">${orderModeOptions}</select>
                    </label>
                </div>
            </section>

            <section class="card-sort-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Categories</h4>
                        <p>Students sort cards into these lanes.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-card-sort-add-category>
                        <i data-lucide="plus"></i>
                        Add Category
                    </button>
                </div>
                <div class="card-sort-builder-list">
                    ${template.categories.map((category, index) => renderCardSortBuilderCategory(category, index, template.categories.length)).join('')}
                </div>
            </section>

            <section class="card-sort-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Cards</h4>
                        <p>Set the expected category and optional order for review.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-card-sort-add-card>
                        <i data-lucide="plus"></i>
                        Add Card
                    </button>
                </div>
                <div class="card-sort-builder-list">
                    ${template.cards.map((card, index) => renderCardSortBuilderCard(card, index, template)).join('')}
                </div>
            </section>
        </div>
    `;

    root.onclick = event => manager.handleCardSortBuilderClick(event);
    root.oninput = event => manager.handleCardSortBuilderInput(event);
    root.onchange = event => manager.handleCardSortBuilderInput(event);
    manager.refreshIcons();
}
