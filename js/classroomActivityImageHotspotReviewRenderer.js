import { escapeHtml } from './main.js';
import {
    getImageHotspotCompletionSummary,
    normalizeImageHotspotResponse,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';

export function renderImageHotspotSubmissionReview(assignment = {}, submission = {}, imageUrl = '') {
    const template = normalizeImageHotspotTemplate(
        assignment.activityData?.imageHotspotTemplate || assignment.activityData?.image_hotspot_template,
        assignment.activityData?.templateId || 'label-image-parts'
    );
    const response = normalizeImageHotspotResponse(template, submission.responseData?.imageHotspotResponse || {});
    const summary = getImageHotspotCompletionSummary(template, response);
    const labelMap = new Map(template.labels.map(label => [label.id, label]));

    return `
        <div class="image-hotspot-submission-review">
            <div class="spreadsheet-review-summary image-hotspot-review-summary">
                <div><span>Pins</span><strong>${escapeHtml(summary.pinsPlaced)} / ${escapeHtml(summary.minPins)} required</strong></div>
                <div><span>Required Labels</span><strong>${escapeHtml(summary.placedRequiredLabels)} / ${escapeHtml(summary.requiredLabels)}</strong></div>
                <div><span>Notes</span><strong>${escapeHtml(summary.completedNotes)} / ${escapeHtml(summary.requiredNotes || response.pins.length)}</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(summary.completedReflections)} / ${escapeHtml(summary.requiredReflections)}</strong></div>
            </div>

            ${summary.missing.length ? `
                <section class="spreadsheet-review-section spreadsheet-validation-section">
                    <h4>Validation Summary</h4>
                    <ul>
                        ${summary.missing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </section>
            ` : ''}

            <section class="spreadsheet-review-section image-hotspot-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>Submitted Image</h4>
                    <span>${escapeHtml(response.pins.length)} pin${response.pins.length === 1 ? '' : 's'}</span>
                </div>
                <div class="image-hotspot-image-frame is-review">
                    ${imageUrl ? `
                        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(template.image.altText || 'Submitted image hotspot work')}">
                    ` : '<div class="image-hotspot-image-placeholder">Image unavailable.</div>'}
                    <div class="image-hotspot-pin-layer">
                        ${response.pins.map((pin, index) => {
                            const label = labelMap.get(pin.labelId);
                            const color = label?.color || '#2563eb';
                            return `
                                <span class="image-hotspot-pin is-static" style="--pin-x:${escapeHtml(pin.xPercent)}%; --pin-y:${escapeHtml(pin.yPercent)}%; --pin-color:${escapeHtml(color)};" title="${escapeHtml(pin.labelText)}">
                                    <span>${escapeHtml(index + 1)}</span>
                                </span>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>

            <section class="spreadsheet-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>Labels and Notes</h4>
                </div>
                <div class="image-hotspot-review-label-list">
                    ${response.pins.length ? response.pins.map((pin, index) => {
                        const label = labelMap.get(pin.labelId);
                        return `
                            <article>
                                <span class="image-hotspot-pin-number" style="--label-color:${escapeHtml(label?.color || '#2563eb')};">${escapeHtml(index + 1)}</span>
                                <div>
                                    <strong>${escapeHtml(pin.labelText || label?.text || `Pin ${index + 1}`)}</strong>
                                    <p>${escapeHtml(String(pin.note || '').trim() || 'No note added.')}</p>
                                </div>
                            </article>
                        `;
                    }).join('') : '<p class="spreadsheet-review-empty">No pins were submitted.</p>'}
                </div>
            </section>

            ${template.reflectionPrompts.length ? `
                <section class="spreadsheet-review-section">
                    <div class="spreadsheet-review-heading">
                        <h4>Reflections</h4>
                    </div>
                    <div class="spreadsheet-reflection-review">
                        ${template.reflectionPrompts.map(prompt => `
                            <article>
                                <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                                <p>${escapeHtml(String(response.reflections[prompt.id] || '').trim() || 'No response yet.')}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        </div>
    `;
}
