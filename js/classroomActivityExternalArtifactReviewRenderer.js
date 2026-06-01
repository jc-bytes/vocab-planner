import { escapeHtml } from './main.js';
import {
    getExternalArtifactCompletionSummary,
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';

export function renderExternalArtifactSubmissionReview(assignment = {}, submission = {}, artifactUrl = '') {
    const template = normalizeExternalArtifactTemplate(
        assignment.activityData?.externalArtifactTemplate,
        assignment.activityData?.templateId || 'project-evidence'
    );
    const response = normalizeExternalArtifactResponse(template, submission.responseData?.externalArtifactResponse || {});
    const summary = getExternalArtifactCompletionSummary(template, response);
    const artifact = response.artifact;
    const artifactIsImage = artifact?.mimeType?.startsWith('image/');
    const artifactLabel = artifact
        ? `${artifact.fileName || 'Uploaded artifact'}${artifact.sizeBytes ? ` · ${Math.round(artifact.sizeBytes / 1024)} KB` : ''}`
        : 'No file uploaded.';

    return `
        <div class="external-artifact-submission-review">
            <div class="spreadsheet-review-summary external-artifact-review-summary">
                <div><span>Evidence</span><strong>${summary.hasLink || summary.hasArtifact ? 'Provided' : 'Missing'}</strong></div>
                <div><span>Link</span><strong>${summary.hasLink ? 'Ready' : 'Not provided'}</strong></div>
                <div><span>Upload</span><strong>${summary.hasArtifact ? 'Ready' : 'Not provided'}</strong></div>
                <div><span>Checklist</span><strong>${escapeHtml(summary.checkedRequired)} / ${escapeHtml(summary.requiredChecks)}</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(summary.completedPrompts)} / ${escapeHtml(summary.requiredPrompts)}</strong></div>
            </div>

            <section class="structured-response-block instructions-block">
                <h4>${escapeHtml(template.prompt)}</h4>
                ${template.helperText ? `<p>${escapeHtml(template.helperText)}</p>` : ''}
            </section>

            <section class="spreadsheet-review-section external-artifact-review-section">
                <h4>${escapeHtml(template.linkLabel)}</h4>
                ${response.linkUrl ? `
                    <a href="${escapeHtml(response.linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(response.linkUrl)}</a>
                ` : '<p class="spreadsheet-review-empty">No link submitted.</p>'}
            </section>

            <section class="spreadsheet-review-section external-artifact-review-section">
                <h4>${escapeHtml(template.uploadLabel)}</h4>
                ${artifact ? `
                    <article class="external-artifact-file-card">
                        ${artifactIsImage && artifactUrl ? `<img src="${escapeHtml(artifactUrl)}" alt="${escapeHtml(artifact.fileName || 'Uploaded evidence')}">` : '<i data-lucide="file-text"></i>'}
                        <div>
                            <strong>${escapeHtml(artifactLabel)}</strong>
                            <p>${escapeHtml(artifact.mimeType || 'Unknown file type')}</p>
                            ${artifactUrl ? `<a href="${escapeHtml(artifactUrl)}" target="_blank" rel="noopener noreferrer">Open artifact</a>` : ''}
                        </div>
                    </article>
                ` : '<p class="spreadsheet-review-empty">No file uploaded.</p>'}
            </section>

            ${template.checklistItems.length ? `
                <section class="spreadsheet-review-section external-artifact-review-section">
                    <h4>Checklist</h4>
                    <div class="structured-response-checklist readonly">
                        ${template.checklistItems.map(item => {
                            const checked = response.checklist[item.id] === true;
                            return `
                                <div class="${checked ? 'is-checked' : ''}">
                                    <i data-lucide="${checked ? 'check-square' : 'square'}"></i>
                                    <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            ` : ''}

            ${template.reflectionPrompts.length ? `
                <section class="spreadsheet-reflection-review external-artifact-reflection-review">
                    ${template.reflectionPrompts.map(prompt => `
                        <article>
                            <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                            <p>${escapeHtml(response.reflections[prompt.id] || 'No response yet.')}</p>
                        </article>
                    `).join('')}
                </section>
            ` : ''}
        </div>
    `;
}
