import { $, escapeHtml } from './main.js';
import {
    EXTERNAL_ARTIFACT_MODES,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';

function renderExternalArtifactChecklistItem(item, index, total) {
    return `
        <article class="structured-builder-block external-artifact-builder-check" data-external-artifact-check-id="${escapeHtml(item.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(item.text || `Checklist item ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-external-artifact-delete-check ${total <= 1 ? 'disabled' : ''} aria-label="Delete checklist item">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields card-sort-card-fields">
                <label>
                    <span>Item</span>
                    <input type="text" data-external-artifact-check-text value="${escapeHtml(item.text)}">
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-external-artifact-check-required ${item.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
            </div>
        </article>
    `;
}

function renderExternalArtifactPrompt(prompt, index, total) {
    return `
        <article class="structured-builder-block external-artifact-builder-prompt" data-external-artifact-prompt-id="${escapeHtml(prompt.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(prompt.prompt || `Reflection prompt ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-external-artifact-delete-prompt ${total <= 0 ? 'disabled' : ''} aria-label="Delete reflection prompt">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields card-sort-card-fields">
                <label>
                    <span>Prompt</span>
                    <textarea rows="2" data-external-artifact-prompt-text>${escapeHtml(prompt.prompt)}</textarea>
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-external-artifact-prompt-required ${prompt.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
            </div>
        </article>
    `;
}

export function renderExternalArtifactBuilder(manager, root = $('#activity-external-artifact-root')) {
    if (!root || !manager.activity?.id) return;
    const template = normalizeExternalArtifactTemplate(
        manager.activity.activityData?.externalArtifactTemplate,
        manager.activity.activityData?.templateId || 'project-evidence'
    );
    manager.activity.activityData.externalArtifactTemplate = template;
    const checklistText = template.checklistItems.length === 1 ? '1 checklist item' : `${template.checklistItems.length} checklist items`;
    const promptText = template.reflectionPrompts.length === 1 ? '1 reflection' : `${template.reflectionPrompts.length} reflections`;
    const modeOptions = EXTERNAL_ARTIFACT_MODES.map(mode => `
        <option value="${escapeHtml(mode)}" ${template.evidenceMode === mode ? 'selected' : ''}>${escapeHtml(mode.replace(/\b\w/g, letter => letter.toUpperCase()))}</option>
    `).join('');

    root.innerHTML = `
        <div class="structured-builder-shell external-artifact-builder-shell">
            <div class="structured-mode-header external-artifact-mode-header">
                <div>
                    <h4>Build Evidence Upload</h4>
                    <p>${escapeHtml(`${template.evidenceMode} evidence · ${checklistText} · ${promptText}`)}</p>
                </div>
            </div>

            <section class="card-sort-builder-section external-artifact-builder-section">
                <div class="card-sort-builder-grid">
                    <label>
                        <span>Prompt</span>
                        <textarea rows="2" data-external-artifact-field="prompt">${escapeHtml(template.prompt)}</textarea>
                    </label>
                    <label>
                        <span>Helper Text</span>
                        <textarea rows="2" data-external-artifact-field="helperText">${escapeHtml(template.helperText)}</textarea>
                    </label>
                </div>
                <div class="card-sort-builder-grid card-sort-builder-options">
                    <label>
                        <span>Evidence Mode</span>
                        <select data-external-artifact-field="evidenceMode">${modeOptions}</select>
                    </label>
                    <label>
                        <span>Link Label</span>
                        <input type="text" data-external-artifact-field="linkLabel" value="${escapeHtml(template.linkLabel)}">
                    </label>
                    <label>
                        <span>Upload Label</span>
                        <input type="text" data-external-artifact-field="uploadLabel" value="${escapeHtml(template.uploadLabel)}">
                    </label>
                </div>
            </section>

            <section class="card-sort-builder-section external-artifact-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Checklist</h4>
                        <p>Students check these before submitting their evidence.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-external-artifact-add-check ${template.checklistItems.length >= 12 ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Item
                    </button>
                </div>
                <div class="card-sort-builder-list external-artifact-builder-list">
                    ${template.checklistItems.map((item, index) => renderExternalArtifactChecklistItem(item, index, template.checklistItems.length)).join('')}
                </div>
            </section>

            <section class="card-sort-builder-section external-artifact-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Reflection Prompts</h4>
                        <p>Short explanations that travel with the submitted evidence.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-external-artifact-add-prompt ${template.reflectionPrompts.length >= 6 ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Prompt
                    </button>
                </div>
                <div class="card-sort-builder-list external-artifact-builder-list">
                    ${template.reflectionPrompts.map((prompt, index) => renderExternalArtifactPrompt(prompt, index, template.reflectionPrompts.length)).join('')}
                </div>
            </section>
        </div>
    `;

    root.onclick = event => manager.handleExternalArtifactBuilderClick(event);
    root.oninput = event => manager.handleExternalArtifactBuilderInput(event);
    root.onchange = event => manager.handleExternalArtifactBuilderInput(event);
    manager.refreshIcons();
}
