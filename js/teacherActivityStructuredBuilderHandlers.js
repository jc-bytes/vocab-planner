import { $, notifications } from './main.js';
import {
    createStructuredBlock,
    createStructuredId,
    normalizeResponseTemplate,
    normalizeStructuredBlock
} from './activityStructuredResponse.js';
import { syncStructuredResponseTemplate } from './teacherActivityBuilderSync.js';
import { refreshPreviewAndAutosave } from './teacherActivityBuilderHandlerUtils.js';

export function handleStructuredBuilderInput(manager, event) {
    if (!event.target.closest('.structured-builder-shell')) return;
    syncStructuredResponseTemplate(manager);
    if (event.target.matches('[data-structured-field="type"]')) {
        manager.renderStructuredResponseBuilder();
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }
    refreshPreviewAndAutosave(manager);
}

export function handleStructuredBuilderClick(manager, event) {
    const root = $('#activity-structured-root');
    if (!root) return;
    const blockEl = event.target.closest('.structured-builder-block');

    if (event.target.closest('[data-structured-add-block]')) {
        syncStructuredResponseTemplate(manager);
        const type = root.querySelector('[data-structured-add-type]')?.value || 'short-text';
        const template = normalizeResponseTemplate(manager.activity.activityData?.responseTemplate, manager.activity.activityData?.templateId || 'worksheet');
        template.blocks.push(createStructuredBlock(type));
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (!blockEl) return;
    syncStructuredResponseTemplate(manager);
    const template = normalizeResponseTemplate(manager.activity.activityData?.responseTemplate, manager.activity.activityData?.templateId || 'worksheet');
    const blockIndex = template.blocks.findIndex(block => block.id === blockEl.dataset.blockId);
    if (blockIndex < 0) return;

    const moveButton = event.target.closest('[data-structured-move]');
    if (moveButton) {
        const direction = moveButton.dataset.structuredMove;
        const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
        if (targetIndex >= 0 && targetIndex < template.blocks.length) {
            const [block] = template.blocks.splice(blockIndex, 1);
            template.blocks.splice(targetIndex, 0, block);
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-duplicate-block]')) {
        const clone = JSON.parse(JSON.stringify(template.blocks[blockIndex]));
        clone.id = createStructuredId(clone.type.replace(/[^a-z0-9]+/g, '_'));
        if (Array.isArray(clone.items)) {
            clone.items = clone.items.map(item => ({ ...item, id: createStructuredId('item') }));
        }
        if (Array.isArray(clone.rows)) {
            clone.rows = clone.rows.map(row => ({ ...row, id: createStructuredId('row') }));
        }
        if (Array.isArray(clone.columns)) {
            clone.columns = clone.columns.map(column => ({ ...column, id: createStructuredId('column') }));
        }
        template.blocks.splice(blockIndex + 1, 0, normalizeStructuredBlock(clone, blockIndex + 1));
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-delete-block]')) {
        if (template.blocks.length <= 1) {
            notifications.warning('Keep at least one block in the activity.');
            return;
        }
        template.blocks.splice(blockIndex, 1);
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-item]')) {
        const block = template.blocks[blockIndex];
        block.items = Array.isArray(block.items) ? block.items : [];
        block.items.push({
            id: createStructuredId('item'),
            text: block.type === 'checklist'
                ? 'Checklist item'
                : (block.type === 'ranking' ? `Ranking item ${block.items.length + 1}` : `Option ${block.items.length + 1}`)
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-match]')) {
        const block = template.blocks[blockIndex];
        block.items = Array.isArray(block.items) ? block.items : [];
        block.items.push({
            id: createStructuredId('match'),
            text: `Item ${block.items.length + 1}`,
            matchText: `Match ${block.items.length + 1}`
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteMatchButton = event.target.closest('[data-structured-delete-match]');
    if (deleteMatchButton) {
        const block = template.blocks[blockIndex];
        block.items = (block.items || []).filter(item => item.id !== deleteMatchButton.dataset.structuredDeleteMatch);
        if (block.items.length === 0) {
            block.items.push({
                id: createStructuredId('match'),
                text: 'Item 1',
                matchText: 'Match 1'
            });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-grid-row]')) {
        const block = template.blocks[blockIndex];
        block.rows = Array.isArray(block.rows) ? block.rows : [];
        block.rows.push({
            id: createStructuredId('row'),
            text: `Row ${block.rows.length + 1}`
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-structured-add-grid-column]')) {
        const block = template.blocks[blockIndex];
        block.columns = Array.isArray(block.columns) ? block.columns : [];
        block.columns.push({
            id: createStructuredId('column'),
            text: `Column ${block.columns.length + 1}`
        });
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteGridRowButton = event.target.closest('[data-structured-delete-grid-row]');
    if (deleteGridRowButton) {
        const block = template.blocks[blockIndex];
        block.rows = (block.rows || []).filter(row => row.id !== deleteGridRowButton.dataset.structuredDeleteGridRow);
        if (block.rows.length === 0) {
            block.rows.push({ id: createStructuredId('row'), text: 'Row 1' });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteGridColumnButton = event.target.closest('[data-structured-delete-grid-column]');
    if (deleteGridColumnButton) {
        const block = template.blocks[blockIndex];
        block.columns = (block.columns || []).filter(column => column.id !== deleteGridColumnButton.dataset.structuredDeleteGridColumn);
        if (block.columns.length === 0) {
            block.columns.push({ id: createStructuredId('column'), text: 'Column 1' });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const deleteItemButton = event.target.closest('[data-structured-delete-item]');
    if (deleteItemButton) {
        const block = template.blocks[blockIndex];
        block.items = (block.items || []).filter(item => item.id !== deleteItemButton.dataset.structuredDeleteItem);
        if (block.items.length === 0) {
            block.items.push({
                id: createStructuredId('item'),
                text: block.type === 'checklist'
                    ? 'Checklist item'
                    : (block.type === 'ranking' ? 'Ranking item 1' : 'Option 1')
            });
        }
        manager.activity.activityData.responseTemplate = template;
        manager.renderStructuredResponseBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
