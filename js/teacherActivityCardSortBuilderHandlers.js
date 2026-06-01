import { $, notifications } from './main.js';
import {
    createCardSortCard,
    createCardSortCategory,
    normalizeCardSortTemplate
} from './activityCardSort.js';
import { syncCardSortTemplate } from './teacherActivityBuilderSync.js';
import { refreshPreviewAndAutosave } from './teacherActivityBuilderHandlerUtils.js';

export function handleCardSortBuilderInput(manager, event) {
    if (!event.target.closest('.card-sort-builder-shell')) return;
    syncCardSortTemplate(manager);
    refreshPreviewAndAutosave(manager);
}

export function handleCardSortBuilderClick(manager, event) {
    const root = $('#activity-card-sort-root');
    if (!root) return;
    if (event.target.closest('[data-card-sort-add-category]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        template.categories.push(createCardSortCategory({
            title: `Category ${template.categories.length + 1}`
        }));
        template.cards = template.cards.map(card => ({
            ...card,
            expectedCategoryId: template.categories.some(category => category.id === card.expectedCategoryId)
                ? card.expectedCategoryId
                : template.categories[0]?.id || ''
        }));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-card-sort-add-card]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        template.cards.push(createCardSortCard({
            text: `Card ${template.cards.length + 1}`,
            expectedOrder: template.cards.length + 1
        }, template.categories));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const categoryEl = event.target.closest('[data-card-sort-category-id]');
    if (categoryEl && event.target.closest('[data-card-sort-delete-category]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        if (template.categories.length <= 1) {
            notifications.warning('Keep at least one category.');
            return;
        }
        const deletedId = categoryEl.dataset.cardSortCategoryId;
        template.categories = template.categories.filter(category => category.id !== deletedId);
        const fallbackCategoryId = template.categories[0]?.id || '';
        template.cards = template.cards.map(card => ({
            ...card,
            expectedCategoryId: card.expectedCategoryId === deletedId ? fallbackCategoryId : card.expectedCategoryId
        }));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const cardEl = event.target.closest('[data-card-sort-card-id]');
    if (!cardEl) return;

    if (event.target.closest('[data-card-sort-duplicate-card]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        const cardIndex = template.cards.findIndex(card => card.id === cardEl.dataset.cardSortCardId);
        if (cardIndex < 0) return;
        const clone = {
            ...JSON.parse(JSON.stringify(template.cards[cardIndex])),
            id: undefined,
            text: `${template.cards[cardIndex].text} Copy`,
            expectedOrder: template.cards.length + 1
        };
        template.cards.splice(cardIndex + 1, 0, createCardSortCard(clone, template.categories));
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-card-sort-delete-card]')) {
        syncCardSortTemplate(manager);
        const template = normalizeCardSortTemplate(manager.activity.activityData?.cardSortTemplate, manager.activity.activityData?.templateId || 'category-sort');
        if (template.cards.length <= 1) {
            notifications.warning('Keep at least one card.');
            return;
        }
        template.cards = template.cards.filter(card => card.id !== cardEl.dataset.cardSortCardId);
        manager.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
        manager.renderCardSortBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
