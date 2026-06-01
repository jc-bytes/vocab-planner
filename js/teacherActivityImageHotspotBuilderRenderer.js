import { $, escapeHtml } from './main.js';
import {
    IMAGE_HOTSPOT_MAX_LABELS,
    IMAGE_HOTSPOT_MAX_PINS,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';

function renderImageHotspotBuilderLabel(label, index, total) {
    return `
        <article class="structured-builder-block image-hotspot-builder-label" data-image-hotspot-label-id="${escapeHtml(label.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(label.text || `Label ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-image-hotspot-delete-label ${total <= 1 ? 'disabled' : ''} aria-label="Delete label">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields image-hotspot-label-fields">
                <label>
                    <span>Label</span>
                    <input type="text" data-image-hotspot-label-text value="${escapeHtml(label.text)}">
                </label>
                <label>
                    <span>Hint</span>
                    <input type="text" data-image-hotspot-label-hint value="${escapeHtml(label.hint)}">
                </label>
                <label>
                    <span>Color</span>
                    <input type="color" data-image-hotspot-label-color value="${escapeHtml(label.color)}">
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-image-hotspot-label-required ${label.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
            </div>
        </article>
    `;
}

function renderImageHotspotBuilderPrompt(prompt, index, total) {
    return `
        <article class="structured-builder-block image-hotspot-builder-prompt" data-image-hotspot-prompt-id="${escapeHtml(prompt.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(`Prompt ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-image-hotspot-delete-prompt ${total <= 0 ? 'disabled' : ''} aria-label="Delete prompt">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields">
                <label>
                    <span>Prompt</span>
                    <textarea rows="2" data-image-hotspot-prompt-text>${escapeHtml(prompt.prompt)}</textarea>
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-image-hotspot-prompt-required ${prompt.required ? 'checked' : ''}>
                    <span>Required on submit</span>
                </label>
            </div>
        </article>
    `;
}

export function renderImageHotspotBuilder(manager, root = $('#activity-image-hotspot-root')) {
    if (!root || !manager.activity?.id) return;
    const template = normalizeImageHotspotTemplate(
        manager.activity.activityData?.imageHotspotTemplate,
        manager.activity.activityData?.templateId || 'label-image-parts'
    );
    manager.activity.activityData.imageHotspotTemplate = template;
    const labelCountText = template.labels.length === 1 ? '1 label' : `${template.labels.length} labels`;
    const imageStatus = template.image.storagePath ? 'Image ready' : 'Upload image';

    root.innerHTML = `
        <div class="structured-builder-shell image-hotspot-builder-shell">
            <div class="structured-mode-header image-hotspot-mode-header">
                <div>
                    <h4>Build Image Hotspot</h4>
                    <p>${escapeHtml(`${labelCountText} · ${template.minPins}-${template.maxPins} pins · ${imageStatus}`)}</p>
                </div>
            </div>

            <section class="image-hotspot-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Image</h4>
                        <p>Background students will label with pins.</p>
                    </div>
                    <label class="btn secondary-btn image-hotspot-upload-btn">
                        <i data-lucide="upload"></i>
                        Upload Image
                        <input type="file" accept="image/png,image/jpeg,image/webp" data-image-hotspot-upload>
                    </label>
                </div>
                <div class="image-hotspot-builder-image-row">
                    <div class="image-hotspot-image-frame is-preview">
                        ${template.image.storagePath ? `
                            <img class="hidden" data-image-hotspot-src="${escapeHtml(template.image.storagePath)}" alt="${escapeHtml(template.image.altText || 'Activity image')}">
                            <div class="image-hotspot-image-placeholder" data-image-hotspot-placeholder="${escapeHtml(template.image.storagePath)}">Loading image...</div>
                        ` : '<div class="image-hotspot-image-placeholder">No image uploaded yet.</div>'}
                    </div>
                    <label>
                        <span>Alt Text</span>
                        <textarea rows="3" data-image-hotspot-field="altText">${escapeHtml(template.image.altText)}</textarea>
                    </label>
                </div>
            </section>

            <section class="image-hotspot-builder-section">
                <div class="card-sort-builder-grid image-hotspot-pin-settings">
                    <label>
                        <span>Required Pins</span>
                        <input type="number" min="0" max="${IMAGE_HOTSPOT_MAX_PINS}" data-image-hotspot-field="minPins" value="${escapeHtml(template.minPins)}">
                    </label>
                    <label>
                        <span>Maximum Pins</span>
                        <input type="number" min="1" max="${IMAGE_HOTSPOT_MAX_PINS}" data-image-hotspot-field="maxPins" value="${escapeHtml(template.maxPins)}">
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-image-hotspot-field="allowExtraPins" ${template.allowExtraPins ? 'checked' : ''}>
                        <span>Allow extra pins</span>
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-image-hotspot-field="requireNotes" ${template.requireNotes ? 'checked' : ''}>
                        <span>Require pin notes</span>
                    </label>
                </div>
            </section>

            <section class="image-hotspot-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Labels</h4>
                        <p>Students place these as pins on the image.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-image-hotspot-add-label ${template.labels.length >= IMAGE_HOTSPOT_MAX_LABELS ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Label
                    </button>
                </div>
                <div class="image-hotspot-builder-label-list">
                    ${template.labels.map((label, index) => renderImageHotspotBuilderLabel(label, index, template.labels.length)).join('')}
                </div>
            </section>

            <section class="image-hotspot-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Reflection Prompts</h4>
                        <p>Short student explanations after labeling.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-image-hotspot-add-prompt>
                        <i data-lucide="plus"></i>
                        Add Prompt
                    </button>
                </div>
                <div class="image-hotspot-builder-prompt-list">
                    ${template.reflectionPrompts.map((prompt, index) => renderImageHotspotBuilderPrompt(prompt, index, template.reflectionPrompts.length)).join('')}
                </div>
            </section>
        </div>
    `;

    root.onclick = event => manager.handleImageHotspotBuilderClick(event);
    root.oninput = event => manager.handleImageHotspotBuilderInput(event);
    root.onchange = event => {
        if (event.target.matches('[data-image-hotspot-upload]')) {
            manager.handleImageHotspotImageUpload(event);
            return;
        }
        manager.handleImageHotspotBuilderInput(event);
    };
    manager.hydrateImageHotspotImages(root, template);
    manager.refreshIcons();
}
