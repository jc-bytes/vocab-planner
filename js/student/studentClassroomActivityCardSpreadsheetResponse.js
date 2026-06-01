import { $, escapeHtml } from '../main.js';
import { CARD_SORT_TRAY_ID, CARD_SORT_TYPE, normalizeCardSortResponse, normalizeCardSortTemplate } from '../activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE, normalizeSpreadsheetResponse, normalizeSpreadsheetTemplate } from '../activitySpreadsheetTable.js';

class StudentClassroomActivityCardSpreadsheetResponseMethods {
    renderCardSortBoard(template, response = {}) {
        const normalized = normalizeCardSortTemplate(template);
        const normalizedResponse = normalizeCardSortResponse(normalized, response);
        const categoryOptions = [
            `<option value="${CARD_SORT_TRAY_ID}">Unsorted</option>`,
            ...normalized.categories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.title)}</option>`)
        ].join('');
        const renderCard = (cardId, laneId, index, total) => {
            const card = normalized.cards.find(item => item.id === cardId);
            if (!card) return '';
            return `
                <article class="card-sort-card" draggable="true" data-card-sort-card-id="${escapeHtml(card.id)}">
                    <div>
                        <strong>${escapeHtml(card.text)}</strong>
                        ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                    </div>
                    <div class="card-sort-card-actions">
                        <label>
                            <span>Move to</span>
                            <select data-card-sort-target-select="${escapeHtml(card.id)}">
                                ${categoryOptions.replace(`value="${escapeHtml(laneId)}"`, `value="${escapeHtml(laneId)}" selected`)}
                            </select>
                        </label>
                        <div>
                            <button type="button" class="btn text-btn icon-btn" data-card-sort-move-card="${escapeHtml(card.id)}" data-card-sort-move-direction="up" ${index <= 0 ? 'disabled' : ''} aria-label="Move card up">
                                <i data-lucide="arrow-up"></i>
                            </button>
                            <button type="button" class="btn text-btn icon-btn" data-card-sort-move-card="${escapeHtml(card.id)}" data-card-sort-move-direction="down" ${index >= total - 1 ? 'disabled' : ''} aria-label="Move card down">
                                <i data-lucide="arrow-down"></i>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        };
        const renderLane = (laneId, title, helperText = '') => {
            const cardIds = normalizedResponse.placements[laneId] || [];
            return `
                <section class="card-sort-lane ${laneId === CARD_SORT_TRAY_ID ? 'card-sort-tray' : ''}" data-card-sort-lane="${escapeHtml(laneId)}">
                    <div class="card-sort-lane-header">
                        <h4>${escapeHtml(title)}</h4>
                        <span>${escapeHtml(cardIds.length)}</span>
                    </div>
                    ${helperText ? `<p>${escapeHtml(helperText)}</p>` : ''}
                    <div class="card-sort-card-list">
                        ${cardIds.map((cardId, index) => renderCard(cardId, laneId, index, cardIds.length)).join('') || '<p class="card-sort-empty">Drop cards here.</p>'}
                    </div>
                </section>
            `;
        };

        return `
            <div class="student-card-sort-shell">
                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(normalized.prompt)}</h4>
                    ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
                    ${normalized.requireAllCards ? '<p>Place every card before submitting.</p>' : ''}
                </section>
                <div class="card-sort-board">
                    ${renderLane(CARD_SORT_TRAY_ID, 'Unsorted Cards')}
                    <div class="card-sort-category-grid">
                        ${normalized.categories.map(category => renderLane(category.id, category.title, category.helperText)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    syncCardSortResponse() {
        const root = $('#student-classroom-excalidraw-root');
        if (!root || !this.currentSubmission?.id || this.currentAssignment?.activityType !== CARD_SORT_TYPE) return;
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const placements = { [CARD_SORT_TRAY_ID]: [] };
        template.categories.forEach(category => {
            placements[category.id] = [];
        });
        root.querySelectorAll('[data-card-sort-lane]').forEach(laneEl => {
            const laneId = laneEl.dataset.cardSortLane || CARD_SORT_TRAY_ID;
            if (!placements[laneId]) placements[laneId] = [];
            laneEl.querySelectorAll('[data-card-sort-card-id]').forEach(cardEl => {
                placements[laneId].push(cardEl.dataset.cardSortCardId);
            });
        });
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: normalizeCardSortResponse(template, {
                placements,
                updatedAt: new Date().toISOString()
            })
        };
    }

    syncSpreadsheetResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== SPREADSHEET_TABLE_TYPE) return;
        const template = normalizeSpreadsheetTemplate(
            this.currentAssignment.activityData?.spreadsheetTemplate,
            this.currentAssignment.activityData?.templateId || 'data-table'
        );
        const spreadsheetResponse = this.editorHandle?.getResponse?.()
            || normalizeSpreadsheetResponse(template, this.currentSubmission.responseData?.spreadsheetResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            spreadsheetResponse: normalizeSpreadsheetResponse(template, spreadsheetResponse)
        };
    }

    renderCurrentCardSortBoard() {
        const root = $('#student-classroom-excalidraw-root');
        if (!root || this.currentAssignment?.activityType !== CARD_SORT_TYPE || !this.currentSubmission?.id) return;
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, this.currentSubmission.responseData?.cardSortResponse || {});
        root.innerHTML = this.renderCardSortBoard(template, response);
        if (window.lucide) window.lucide.createIcons();
    }

    moveCardSortCard(cardId, targetLaneId) {
        if (!cardId || this.currentAssignment?.activityType !== CARD_SORT_TYPE || !this.currentSubmission?.id) return;
        this.syncCardSortResponse();
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, this.currentSubmission.responseData?.cardSortResponse || {});
        const validLaneIds = new Set([CARD_SORT_TRAY_ID, ...template.categories.map(category => category.id)]);
        const laneId = validLaneIds.has(targetLaneId) ? targetLaneId : CARD_SORT_TRAY_ID;
        Object.keys(response.placements).forEach(key => {
            response.placements[key] = (response.placements[key] || []).filter(existingCardId => existingCardId !== cardId);
        });
        response.placements[laneId] = response.placements[laneId] || [];
        response.placements[laneId].push(cardId);
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: normalizeCardSortResponse(template, response)
        };
        this.renderCurrentCardSortBoard();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    moveCardSortCardWithinLane(cardId, direction = 'up') {
        if (!cardId || this.currentAssignment?.activityType !== CARD_SORT_TYPE || !this.currentSubmission?.id) return;
        this.syncCardSortResponse();
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, this.currentSubmission.responseData?.cardSortResponse || {});
        const laneEntry = Object.entries(response.placements).find(([, cardIds]) => cardIds.includes(cardId));
        if (!laneEntry) return;
        const [laneId, cardIds] = laneEntry;
        const index = cardIds.indexOf(cardId);
        const targetIndex = direction === 'down' ? index + 1 : index - 1;
        if (targetIndex < 0 || targetIndex >= cardIds.length) return;
        const [moved] = cardIds.splice(index, 1);
        cardIds.splice(targetIndex, 0, moved);
        response.placements[laneId] = cardIds;
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: normalizeCardSortResponse(template, response)
        };
        this.renderCurrentCardSortBoard();
        if (this.editorAutosaveReady) this.queueAutosave();
    }
}

export function installStudentClassroomActivityCardSpreadsheetResponseMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityCardSpreadsheetResponseMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityCardSpreadsheetResponseMethods.prototype, name)
        );
    }
}
