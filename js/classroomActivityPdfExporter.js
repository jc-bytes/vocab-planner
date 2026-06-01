import { exportToBlob } from '@excalidraw/excalidraw';
import { jsPDF } from 'jspdf';
import { createElement, escapeHtml } from './main.js';
import { STRUCTURED_RESPONSE_TYPE } from './activityStructuredResponse.js';
import { SPREADSHEET_TABLE_TYPE } from './activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE, normalizeImageHotspotTemplate } from './activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from './activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from './activityFlowchartAlgorithm.js';
import {
    renderExternalArtifactSubmissionReview,
    renderFlowchartSubmissionReview,
    renderImageHotspotSubmissionReview,
    renderSpreadsheetSubmissionReview,
    renderStructuredSubmissionReview
} from './classroomActivityRenderers.js';
import {
    activityUsesCanvas,
    getActivityTypeConfig
} from './classroomActivityRegistry.js';
import { ReportGenerator } from './reportGenerator.js';
import { supabaseService } from './supabaseService.js';
import {
    PDF_PAGE_FORMAT,
    getClassroomActivityPdfStyles
} from './classroomActivityPdfStyles.js';
import {
    buildDownloadFileName,
    formatDateOnly,
    formatSubmittedStatus
} from './classroomActivityPdfMetadata.js';

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
        <style>${getClassroomActivityPdfStyles()}</style>
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

function renderFlowchartWork(container, assignment, submission) {
    container.innerHTML = renderFlowchartSubmissionReview(assignment, submission);
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

const PDF_WORK_RENDERERS = {
    [STRUCTURED_RESPONSE_TYPE]: async (container, assignment, submission) => {
        renderStructuredWork(container, assignment, submission);
        if (window.lucide?.createIcons) window.lucide.createIcons();
    },
    [SPREADSHEET_TABLE_TYPE]: async (container, assignment, submission) => {
        renderSpreadsheetWork(container, assignment, submission);
    },
    [IMAGE_HOTSPOT_TYPE]: renderImageHotspotWork,
    [EXTERNAL_ARTIFACT_TYPE]: renderExternalArtifactWork,
    [FLOWCHART_ALGORITHM_TYPE]: async (container, assignment, submission) => {
        renderFlowchartWork(container, assignment, submission);
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }
};

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
        const config = getActivityTypeConfig(assignment.activityType);
        const renderWork = PDF_WORK_RENDERERS[config.type];
        if (renderWork) {
            await renderWork(workBody, assignment, submission);
        } else if (activityUsesCanvas(config.type)) {
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
