import { $, notifications } from './main.js';
import {
    SPREADSHEET_MAX_COLUMNS,
    createSpreadsheetColumn,
    createSpreadsheetPrompt,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import { syncSpreadsheetTemplate } from './teacherActivityBuilderSync.js';
import { refreshPreviewAndAutosave } from './teacherActivityBuilderHandlerUtils.js';

export function handleSpreadsheetBuilderInput(manager, event) {
    if (!event.target.closest('.spreadsheet-builder-shell')) return;
    syncSpreadsheetTemplate(manager);
    refreshPreviewAndAutosave(manager);
}

export function handleSpreadsheetBuilderClick(manager, event) {
    const root = $('#activity-spreadsheet-root');
    if (!root) return;

    if (event.target.closest('[data-spreadsheet-add-column]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.columns.length >= SPREADSHEET_MAX_COLUMNS) {
            notifications.warning(`Spreadsheet activities can have up to ${SPREADSHEET_MAX_COLUMNS} columns.`);
            return;
        }
        template.columns.push(createSpreadsheetColumn({ title: `Column ${template.columns.length + 1}` }, template.columns.length));
        template.seedData = template.seedData.map(row => [...row, '']);
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const columnEl = event.target.closest('[data-spreadsheet-column-id]');
    if (columnEl && event.target.closest('[data-spreadsheet-delete-column]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.columns.length <= 1) {
            notifications.warning('Keep at least one column.');
            return;
        }
        const columnIndex = template.columns.findIndex(column => column.id === columnEl.dataset.spreadsheetColumnId);
        if (columnIndex < 0) return;
        template.columns.splice(columnIndex, 1);
        template.seedData = template.seedData.map(row => row.filter((_cell, index) => index !== columnIndex));
        if (!template.columns.some(column => column.id === template.chart.labelColumnId)) {
            template.chart.labelColumnId = template.columns[0]?.id || '';
        }
        if (!template.columns.some(column => column.id === template.chart.valueColumnId)) {
            template.chart.valueColumnId = template.columns[1]?.id || template.columns[0]?.id || '';
        }
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-spreadsheet-add-seed-row]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.seedData.length >= template.maxRows) {
            notifications.warning(`Starter rows cannot exceed the maximum row setting.`);
            return;
        }
        template.seedData.push(template.columns.map(() => ''));
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const seedRow = event.target.closest('[data-spreadsheet-seed-row]');
    if (seedRow && event.target.closest('[data-spreadsheet-delete-seed-row]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        if (template.seedData.length <= 1) {
            notifications.warning('Keep at least one starter row.');
            return;
        }
        const rowIndex = Number.parseInt(seedRow.dataset.spreadsheetSeedRow, 10);
        template.seedData = template.seedData.filter((_row, index) => index !== rowIndex);
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    if (event.target.closest('[data-spreadsheet-add-prompt]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        template.reflectionPrompts.push(createSpreadsheetPrompt({
            prompt: `Reflection prompt ${template.reflectionPrompts.length + 1}`
        }, template.reflectionPrompts.length));
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
        return;
    }

    const promptEl = event.target.closest('[data-spreadsheet-prompt-id]');
    if (promptEl && event.target.closest('[data-spreadsheet-delete-prompt]')) {
        syncSpreadsheetTemplate(manager);
        const template = normalizeSpreadsheetTemplate(manager.activity.activityData?.spreadsheetTemplate, manager.activity.activityData?.templateId || 'data-table');
        template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.spreadsheetPromptId);
        manager.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
        manager.renderSpreadsheetBuilder(root);
        manager.triggerActivityAutoSave({ readForm: false });
    }
}
