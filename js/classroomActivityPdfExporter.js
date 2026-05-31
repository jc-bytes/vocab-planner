import { exportToBlob } from '@excalidraw/excalidraw';
import { jsPDF } from 'jspdf';
import { createElement, escapeHtml } from './main.js';
import { STRUCTURED_RESPONSE_TYPE } from './activityStructuredResponse.js';
import { SPREADSHEET_TABLE_TYPE } from './activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE, normalizeImageHotspotTemplate } from './activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from './activityExternalArtifact.js';
import {
    renderExternalArtifactSubmissionReview,
    renderImageHotspotSubmissionReview,
    renderSpreadsheetSubmissionReview,
    renderStructuredSubmissionReview
} from './classroomActivityRenderers.js';
import { ReportGenerator } from './reportGenerator.js';
import { supabaseService } from './supabaseService.js';

const REPORT_WIDTH_PX = 816;
const PDF_PAGE_FORMAT = 'letter';

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds !== undefined) return new Date(Number(value.seconds) * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value) {
    if (!value) return 'Not set';
    const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
        ? new Date(`${value.slice(0, 10)}T12:00:00`)
        : toDate(value);
    if (!date || Number.isNaN(date.getTime())) return 'Not set';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function formatSubmittedStatus(submission = {}) {
    if (submission.status === 'submitted') {
        const submittedAt = formatDateTime(submission.submittedAt || submission.submitted_at);
        return submittedAt ? `Submitted on ${submittedAt}` : 'Submitted';
    }

    return 'Draft';
}

function slugForFilename(value, fallback = 'item') {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
}

function getIsoDate(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function buildDownloadFileName(assignment = {}, studentProfile = {}) {
    const { fullName } = ReportGenerator.getStudentInfo(studentProfile);
    return [
        'classroom-activity',
        slugForFilename(assignment.title, 'activity'),
        slugForFilename(fullName, 'student'),
        getIsoDate()
    ].join('-') + '.pdf';
}

function getDocumentStyles() {
    return `
        .classroom-pdf-export,
        .classroom-pdf-export * {
            box-sizing: border-box;
        }

        .classroom-pdf-export {
            width: ${REPORT_WIDTH_PX}px;
            padding: 48px;
            background: #ffffff;
            color: #111827;
            font-family: Inter, Arial, sans-serif;
            line-height: 1.45;
        }

        .classroom-pdf-export h1,
        .classroom-pdf-export h2,
        .classroom-pdf-export h3,
        .classroom-pdf-export h4,
        .classroom-pdf-export p {
            margin-top: 0;
        }

        .classroom-pdf-export p {
            white-space: pre-wrap;
        }

        .pdf-header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 22px;
            border-bottom: 3px solid #2563eb;
        }

        .pdf-header h1 {
            margin-bottom: 8px;
            color: #111827;
            font-size: 28px;
            line-height: 1.12;
        }

        .pdf-header p,
        .pdf-muted {
            color: #6b7280;
            font-size: 13px;
        }

        .pdf-status {
            align-self: flex-start;
            min-width: 160px;
            padding: 10px 12px;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            background: #eff6ff;
            color: #1e40af;
            font-size: 13px;
            font-weight: 800;
            text-align: right;
        }

        .pdf-meta-grid,
        .pdf-instruction-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 20px;
        }

        .pdf-instruction-grid {
            grid-template-columns: 1fr;
        }

        .pdf-meta-card,
        .pdf-section {
            min-width: 0;
            padding: 14px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f9fafb;
        }

        .pdf-label {
            margin: 0 0 5px 0;
            color: #6b7280;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .pdf-value {
            margin: 0;
            color: #111827;
            font-size: 15px;
            font-weight: 700;
        }

        .pdf-work {
            margin-top: 28px;
        }

        .pdf-work h2 {
            margin-bottom: 14px;
            padding-bottom: 9px;
            border-bottom: 1px solid #d1d5db;
            color: #111827;
            font-size: 20px;
        }

        .pdf-canvas-image {
            display: block;
            width: 100%;
            height: auto;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
        }

        .pdf-empty-work {
            padding: 18px;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            color: #64748b;
            font-weight: 700;
            text-align: center;
        }

        .classroom-pdf-export .structured-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .structured-response-block {
            display: grid;
            gap: 8px;
            padding: 14px;
            break-inside: avoid;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            background: #ffffff;
            color: #111827;
        }

        .classroom-pdf-export .structured-response-block.instructions-block {
            border-color: #bae6fd;
            background: #f0f9ff;
        }

        .classroom-pdf-export .structured-response-block h4 {
            margin: 0;
            color: #111827;
            font-size: 15px;
        }

        .classroom-pdf-export .structured-response-block p {
            margin: 0;
            color: #4b5563;
            font-size: 13px;
        }

        .classroom-pdf-export .structured-response-checklist {
            display: grid;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
        }

        .classroom-pdf-export .structured-response-checklist > div {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 9px 10px;
            border-bottom: 1px solid #e5e7eb;
            color: #111827;
            font-size: 13px;
            font-weight: 700;
        }

        .classroom-pdf-export .structured-response-checklist > div:last-child {
            border-bottom: 0;
        }

        .classroom-pdf-export .structured-response-checklist svg {
            flex: 0 0 16px;
            width: 16px;
            height: 16px;
            color: #64748b;
        }

        .classroom-pdf-export .structured-response-checklist .is-checked svg {
            color: #059669;
        }

        .classroom-pdf-export .structured-answer-readonly {
            min-height: 40px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #f9fafb;
            color: #111827;
            font-size: 13px;
            white-space: pre-wrap;
        }

        .classroom-pdf-export .structured-response-matching,
        .classroom-pdf-export .structured-response-ranking {
            display: grid;
            gap: 8px;
        }

        .classroom-pdf-export .structured-response-matching-row,
        .classroom-pdf-export .structured-response-ranking.readonly > div {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(130px, 0.7fr);
            gap: 10px;
            padding: 9px 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #f9fafb;
            color: #111827;
            font-size: 13px;
        }

        .classroom-pdf-export .structured-response-ranking.readonly > div {
            grid-template-columns: 50px minmax(0, 1fr);
        }

        .classroom-pdf-export .structured-response-table-wrapper {
            overflow: visible;
        }

        .classroom-pdf-export .structured-response-table {
            width: 100%;
            min-width: 0;
            table-layout: fixed;
            border-collapse: collapse;
            border: 1px solid #d1d5db;
            font-size: 12px;
        }

        .classroom-pdf-export .structured-response-table th,
        .classroom-pdf-export .structured-response-table td {
            padding: 8px;
            border: 1px solid #e5e7eb;
            background: #ffffff;
            color: #111827;
            text-align: left;
            vertical-align: top;
            overflow-wrap: anywhere;
        }

        .classroom-pdf-export .structured-response-table th {
            background: #f3f4f6;
            color: #374151;
            font-weight: 800;
        }

        .classroom-pdf-export .spreadsheet-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .spreadsheet-review-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
        }

        .classroom-pdf-export .spreadsheet-review-summary div,
        .classroom-pdf-export .spreadsheet-review-section,
        .classroom-pdf-export .spreadsheet-reflection-review article {
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
            break-inside: avoid;
        }

        .classroom-pdf-export .spreadsheet-review-summary span,
        .classroom-pdf-export .spreadsheet-review-heading span {
            display: block;
            color: #6b7280;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .classroom-pdf-export .spreadsheet-review-summary strong,
        .classroom-pdf-export .spreadsheet-review-heading h4,
        .classroom-pdf-export .spreadsheet-reflection-review strong {
            margin: 0;
            color: #111827;
            font-size: 13px;
        }

        .classroom-pdf-export .spreadsheet-reflection-review {
            display: grid;
            gap: 8px;
        }

        .classroom-pdf-export .spreadsheet-reflection-review p {
            margin: 6px 0 0;
            color: #374151;
            font-size: 12px;
        }

        .classroom-pdf-export .spreadsheet-chart-preview {
            display: grid;
            gap: 7px;
            margin-top: 10px;
        }

        .classroom-pdf-export .spreadsheet-chart-preview-row {
            display: grid;
            grid-template-columns: 110px minmax(0, 1fr) 54px;
            gap: 8px;
            align-items: center;
            font-size: 11px;
        }

        .classroom-pdf-export .spreadsheet-chart-preview-row div {
            height: 12px;
            overflow: hidden;
            border-radius: 999px;
            background: #e5e7eb;
        }

        .classroom-pdf-export .spreadsheet-chart-preview-row i {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: #2563eb;
        }

        .classroom-pdf-export .image-hotspot-submission-review {
            display: grid;
            gap: 12px;
        }

        .classroom-pdf-export .image-hotspot-image-frame {
            position: relative;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #f8fafc;
            break-inside: avoid;
        }

        .classroom-pdf-export .image-hotspot-image-frame img {
            display: block;
            width: 100%;
            height: auto;
        }

        .classroom-pdf-export .image-hotspot-pin-layer {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }

        .classroom-pdf-export .image-hotspot-pin {
            position: absolute;
            left: var(--pin-x);
            top: var(--pin-y);
            display: inline-flex;
            width: 24px;
            height: 24px;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            border-radius: 999px;
            background: var(--pin-color, #2563eb);
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
            transform: translate(-50%, -100%);
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.3);
        }

        .classroom-pdf-export .image-hotspot-review-label-list {
            display: grid;
            gap: 8px;
        }

        .classroom-pdf-export .image-hotspot-review-label-list article {
            display: grid;
            grid-template-columns: 30px minmax(0, 1fr);
            gap: 8px;
            align-items: start;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
            break-inside: avoid;
        }

        .classroom-pdf-export .image-hotspot-pin-number {
            display: inline-flex;
            width: 24px;
            height: 24px;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: var(--label-color, #2563eb);
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
        }
    `;
}

function createReportShell({ assignment, submission, studentProfile }) {
    const { fullName, grade, group } = ReportGenerator.getStudentInfo(studentProfile || submission?.studentProfile || {});
    const generatedAt = new Date().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
    const report = createElement('div', 'classroom-pdf-export');
    report.style.position = 'fixed';
    report.style.left = '-10000px';
    report.style.top = '0';
    report.style.zIndex = '-1';
    report.style.pointerEvents = 'none';
    report.innerHTML = `
        <style>${getDocumentStyles()}</style>
        <header class="pdf-header">
            <div>
                <h1>${escapeHtml(assignment.title || 'Classroom Activity')}</h1>
                <p class="pdf-muted">Generated ${escapeHtml(generatedAt)}</p>
            </div>
            <div class="pdf-status">${escapeHtml(formatSubmittedStatus(submission))}</div>
        </header>

        <section class="pdf-meta-grid" aria-label="Student and activity details">
            <div class="pdf-meta-card">
                <p class="pdf-label">Student</p>
                <p class="pdf-value">${escapeHtml(fullName)}</p>
            </div>
            <div class="pdf-meta-card">
                <p class="pdf-label">Grade / Group</p>
                <p class="pdf-value">${escapeHtml([grade || '-', group || '-'].join(' / '))}</p>
            </div>
            <div class="pdf-meta-card">
                <p class="pdf-label">Due Date</p>
                <p class="pdf-value">${escapeHtml(formatDateOnly(assignment.dueDate || assignment.due_date))}</p>
            </div>
        </section>

        <section class="pdf-instruction-grid" aria-label="Activity instructions">
            <div class="pdf-section">
                <p class="pdf-label">Instructions</p>
                <p class="pdf-value">${escapeHtml(assignment.studentInstructions || assignment.description || 'Complete the activity.')}</p>
            </div>
            <div class="pdf-section">
                <p class="pdf-label">Turn In</p>
                <p class="pdf-value">${escapeHtml(assignment.studentOutput || 'Classroom activity response')}</p>
            </div>
        </section>

        <section class="pdf-work">
            <h2>Student Work</h2>
            <div data-pdf-work-body></div>
        </section>
    `;
    return report;
}

async function loadImage(src, alt) {
    const image = new Image();
    image.alt = alt;
    image.className = 'pdf-canvas-image';
    image.decoding = 'async';
    image.src = src;

    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    return image;
}

async function renderCanvasWork(container, scene, objectUrls) {
    const elements = Array.isArray(scene?.elements)
        ? scene.elements.filter(element => !element?.isDeleted)
        : [];

    if (elements.length === 0) {
        container.innerHTML = '<div class="pdf-empty-work">No canvas work saved yet.</div>';
        return;
    }

    try {
        const blob = await exportToBlob({
            elements,
            appState: {
                ...(scene.appState || {}),
                viewBackgroundColor: scene.appState?.viewBackgroundColor || '#ffffff'
            },
            files: scene.files || {},
            mimeType: 'image/png',
            exportPadding: 32,
            maxWidthOrHeight: 1800
        });
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        container.innerHTML = '';
        container.appendChild(await loadImage(url, 'Student canvas work'));
    } catch (error) {
        console.error('Failed to render classroom activity canvas for PDF:', error);
        container.innerHTML = '<div class="pdf-empty-work">The canvas could not be rendered in this PDF.</div>';
    }
}

function renderStructuredWork(container, assignment, submission) {
    container.innerHTML = renderStructuredSubmissionReview(assignment, submission);
}

function renderSpreadsheetWork(container, assignment, submission) {
    container.innerHTML = renderSpreadsheetSubmissionReview(assignment, submission);
}

async function renderImageHotspotWork(container, assignment, submission) {
    const template = normalizeImageHotspotTemplate(
        assignment.activityData?.imageHotspotTemplate,
        assignment.activityData?.templateId || 'label-image-parts'
    );
    let imageUrl = '';
    if (template.image.storagePath) {
        try {
            imageUrl = await supabaseService.getClassroomActivityImageUrl(template.image.storagePath);
        } catch (error) {
            console.warn('Could not load image hotspot image for PDF:', error);
        }
    }
    container.innerHTML = renderImageHotspotSubmissionReview(assignment, submission, imageUrl);
}

async function renderExternalArtifactWork(container, assignment, submission) {
    const artifact = submission.responseData?.externalArtifactResponse?.artifact;
    let artifactUrl = '';
    if (artifact?.storagePath) {
        try {
            artifactUrl = await supabaseService.getExternalArtifactUrl(artifact.storagePath);
        } catch (error) {
            console.warn('Could not load external artifact signed URL for PDF:', error);
        }
    }
    container.innerHTML = renderExternalArtifactSubmissionReview(assignment, submission, artifactUrl);
}

async function waitForImages(container) {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(image => {
        if (image.complete) return Promise.resolve();
        return new Promise(resolve => {
            image.onload = resolve;
            image.onerror = resolve;
        });
    }));
}

function addCanvasToPdf(pdf, canvas) {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pagePixelHeight = Math.floor(canvas.width * (pageHeight / pageWidth));
    const pageCanvas = document.createElement('canvas');
    const pageContext = pageCanvas.getContext('2d');
    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
        const sliceHeight = Math.min(pagePixelHeight, canvas.height - offsetY);
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        pageContext.fillStyle = '#ffffff';
        pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageContext.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
        );

        if (pageIndex > 0) pdf.addPage(PDF_PAGE_FORMAT, 'portrait');
        const imageHeight = sliceHeight * (pageWidth / canvas.width);
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imageHeight);

        offsetY += sliceHeight;
        pageIndex += 1;
    }
}

export async function exportClassroomActivityPdf({
    assignment,
    submission,
    studentProfile,
    scene = null
}) {
    if (!assignment || !submission) {
        throw new Error('An activity and submission are required to export a PDF.');
    }

    const objectUrls = [];
    const report = createReportShell({ assignment, submission, studentProfile });
    document.body.appendChild(report);

    try {
        const workBody = report.querySelector('[data-pdf-work-body]');
        if (assignment.activityType === STRUCTURED_RESPONSE_TYPE) {
            renderStructuredWork(workBody, assignment, submission);
            if (window.lucide?.createIcons) window.lucide.createIcons();
        } else if (assignment.activityType === SPREADSHEET_TABLE_TYPE) {
            renderSpreadsheetWork(workBody, assignment, submission);
        } else if (assignment.activityType === IMAGE_HOTSPOT_TYPE) {
            await renderImageHotspotWork(workBody, assignment, submission);
        } else if (assignment.activityType === EXTERNAL_ARTIFACT_TYPE) {
            await renderExternalArtifactWork(workBody, assignment, submission);
        } else {
            await renderCanvasWork(workBody, scene || submission.responseData?.excalidrawScene, objectUrls);
        }

        await waitForImages(report);
        const html2canvas = await ReportGenerator.ensureHtml2Canvas();
        const canvas = await html2canvas(report, {
            backgroundColor: '#ffffff',
            logging: false,
            scale: 2,
            useCORS: true,
            windowHeight: report.scrollHeight,
            windowWidth: report.scrollWidth
        });
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: PDF_PAGE_FORMAT });
        addCanvasToPdf(pdf, canvas);
        pdf.save(buildDownloadFileName(assignment, studentProfile || submission.studentProfile));
    } finally {
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        report.remove();
    }
}
