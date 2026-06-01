import { escapeHtml } from './main.js';
import { STRUCTURED_RESPONSE_TYPE } from './activityStructuredResponse.js';
import { CARD_SORT_TYPE } from './activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from './activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from './activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from './activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from './activityFlowchartAlgorithm.js';
import {
    activityUsesCanvas,
    getActivityTypeConfig
} from './classroomActivityRegistry.js';
import { renderStructuredResponsePreview } from './teacherActivityStructuredPreviewRenderer.js';
import {
    renderCardSortPreview,
    renderExternalArtifactPreview,
    renderFlowchartPreview,
    renderImageHotspotPreview,
    renderSpreadsheetPreview
} from './teacherActivityTypePreviewRenderers.js';

export { renderStructuredResponsePreview } from './teacherActivityStructuredPreviewRenderer.js';

export function renderTeacherActivityResponsePreview(activity = {}) {
    const activityType = activity.activityType || '';
    const activityData = activity.activityData || {};
    const config = getActivityTypeConfig(activityType);

    if (activityUsesCanvas(config.type)) {
        return `
            <section class="activity-preview-section activity-preview-map-note">
                <h4>Canvas</h4>
                <p>Students will receive their own editable copy of the map or diagram canvas. Use the Build tab to inspect and edit the template.</p>
            </section>
        `;
    }

    const template = activityData[config.templateDataKey];
    if (config.type === STRUCTURED_RESPONSE_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Response</h4>
                <div class="structured-preview activity-preview-structured">
                    ${renderStructuredResponsePreview(template)}
                </div>
            </section>
        `;
    }

    if (config.type === CARD_SORT_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Card Sort</h4>
                ${renderCardSortPreview(template)}
            </section>
        `;
    }

    if (config.type === SPREADSHEET_TABLE_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Spreadsheet</h4>
                ${renderSpreadsheetPreview(template)}
            </section>
        `;
    }

    if (config.type === IMAGE_HOTSPOT_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Image Hotspot</h4>
                ${renderImageHotspotPreview(template)}
            </section>
        `;
    }

    if (config.type === EXTERNAL_ARTIFACT_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Evidence</h4>
                ${renderExternalArtifactPreview(template)}
            </section>
        `;
    }

    if (config.type === FLOWCHART_ALGORITHM_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Flowchart</h4>
                ${renderFlowchartPreview(template)}
            </section>
        `;
    }

    return '';
}

export function renderTeacherActivityPreviewShell(activity = {}, options = {}) {
    const subject = options.subject || activity.subjectSlug || 'No subject selected';
    const typeLabel = options.typeLabel || getActivityTypeConfig(activity.activityType || '').label || 'Activity';
    const grades = Array.isArray(activity.grades) && activity.grades.length
        ? activity.grades.join(', ')
        : 'No grade selected';
    const minutes = activity.estimatedMinutes ? `${activity.estimatedMinutes} min` : 'No time set';
    const purpose = String(activity.assessmentPurpose || 'formative')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
    const maybeText = (value, fallback = 'Not added yet.') => escapeHtml(String(value || '').trim() || fallback);
    const detailCards = [
        ['Subject', subject],
        ['Grades', grades],
        ['Type', typeLabel],
        ['Purpose', purpose],
        ['Time', minutes]
    ].map(([label, value]) => `
        <div class="activity-preview-detail">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join('');

    return `
        <div class="activity-preview-shell">
            <section class="activity-preview-hero">
                <div>
                    <span>${escapeHtml(typeLabel)}</span>
                    <h3>${maybeText(activity.title, 'Untitled Activity')}</h3>
                    <p>${maybeText(activity.description, 'No description added yet.')}</p>
                </div>
                <div class="activity-preview-detail-grid">
                    ${detailCards}
                </div>
            </section>

            <section class="activity-preview-section">
                <h4>Student Instructions</h4>
                <p>${maybeText(activity.studentInstructions)}</p>
            </section>

            <div class="activity-preview-two-column">
                <section class="activity-preview-section">
                    <h4>Materials</h4>
                    <p>${maybeText(activity.materials)}</p>
                </section>
                <section class="activity-preview-section">
                    <h4>Expected Output</h4>
                    <p>${maybeText(activity.studentOutput)}</p>
                </section>
            </div>

            ${renderTeacherActivityResponsePreview(activity)}
        </div>
    `;
}
