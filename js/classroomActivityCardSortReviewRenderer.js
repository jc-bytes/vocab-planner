import { escapeHtml } from './main.js';
import {
    CARD_SORT_TRAY_ID,
    getCardSortCardStatus,
    getCardSortPlacementSummary,
    normalizeCardSortResponse,
    normalizeCardSortTemplate
} from './activityCardSort.js';

export function renderCardSortSubmissionReview(assignment = {}, submission = {}) {
    const template = normalizeCardSortTemplate(
        assignment.activityData?.cardSortTemplate,
        assignment.activityData?.templateId || 'category-sort'
    );
    const response = normalizeCardSortResponse(template, submission.responseData?.cardSortResponse || {});
    const summary = getCardSortPlacementSummary(template, response);
    const renderCard = (cardId, laneId, index) => {
        const status = getCardSortCardStatus(template, response, cardId, laneId, index);
        const card = status.card;
        if (!card) return '';
        const badges = laneId === CARD_SORT_TRAY_ID
            ? '<span class="card-sort-signal is-unplaced">Unplaced</span>'
            : `
                <span class="card-sort-signal ${status.categoryMatches ? 'is-correct' : 'is-misplaced'}">
                    ${status.categoryMatches ? 'Expected category' : `Expected ${escapeHtml(status.expectedCategoryTitle || 'another category')}`}
                </span>
                ${template.orderMode === 'within-categories' ? `
                    <span class="card-sort-signal ${status.orderMatches ? 'is-correct' : 'is-misplaced'}">
                        ${status.orderMatches ? 'Expected order' : `Expected #${escapeHtml(status.expectedOrder || '')}`}
                    </span>
                ` : ''}
            `;
        return `
            <article class="card-sort-card ${status.categoryMatches ? 'is-correct' : (laneId === CARD_SORT_TRAY_ID ? 'is-unplaced' : 'is-misplaced')}">
                <strong>${escapeHtml(card.text)}</strong>
                ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                <div class="card-sort-review-signals">${badges}</div>
            </article>
        `;
    };

    return `
        <div class="card-sort-review">
            <div class="card-sort-review-summary">
                <div><span>Placed</span><strong>${escapeHtml(summary.placedCards)} / ${escapeHtml(summary.totalCards)}</strong></div>
                <div><span>Expected category</span><strong>${escapeHtml(summary.correctCategory)} correct</strong></div>
                ${template.orderMode === 'within-categories'
                    ? `<div><span>Expected order</span><strong>${escapeHtml(summary.correctOrder)} / ${escapeHtml(summary.orderedCards)}</strong></div>`
                    : ''}
            </div>
            <div class="card-sort-board is-review">
                <section class="card-sort-lane card-sort-tray">
                    <div class="card-sort-lane-header">
                        <h4>Unsorted</h4>
                        <span>${escapeHtml((response.placements[CARD_SORT_TRAY_ID] || []).length)}</span>
                    </div>
                    <div class="card-sort-card-list">
                        ${(response.placements[CARD_SORT_TRAY_ID] || []).map((cardId, index) => renderCard(cardId, CARD_SORT_TRAY_ID, index)).join('') || '<p class="card-sort-empty">No unplaced cards.</p>'}
                    </div>
                </section>
                <div class="card-sort-category-grid">
                    ${template.categories.map(category => `
                        <section class="card-sort-lane">
                            <div class="card-sort-lane-header">
                                <h4>${escapeHtml(category.title)}</h4>
                                <span>${escapeHtml((response.placements[category.id] || []).length)}</span>
                            </div>
                            ${category.helperText ? `<p>${escapeHtml(category.helperText)}</p>` : ''}
                            <div class="card-sort-card-list">
                                ${(response.placements[category.id] || []).map((cardId, index) => renderCard(cardId, category.id, index)).join('') || '<p class="card-sort-empty">No cards placed here.</p>'}
                            </div>
                        </section>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}
