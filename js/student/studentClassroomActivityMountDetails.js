import { $, createElement, notifications } from '../main.js';
import { CARD_SORT_TYPE } from '../activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from '../activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from '../activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from '../activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from '../activityFlowchartAlgorithm.js';

const TASK_SUMMARY_LIMIT = 150;

function getCompactTaskSummary(value = '', fallback = '') {
    const text = String(value || fallback || '').trim();
    if (text.length <= TASK_SUMMARY_LIMIT) return text;
    return `${text.slice(0, TASK_SUMMARY_LIMIT - 3).trim()}...`;
}

export const studentClassroomActivityMountDetailsMethods = {
    async showAssignment(assignmentId) {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.switchView('student-classroom-activity-view');
        const title = $('#student-classroom-activity-title');
        const status = $('#student-classroom-activity-save-status');
        const root = $('#student-classroom-excalidraw-root');
        if (title) title.textContent = 'Classroom Activity';
        if (status) status.textContent = 'Loading activity...';
        if (root) root.innerHTML = '<div class="loading-spinner">Loading activity...</div>';

        const assignment = await this.findAssignment(assignmentId, { forceRefresh: true });
        if (!assignment) {
            notifications.warning('This activity is not available for your class.');
            this.sm.navigateTo({ view: 'classroom-activities' }, { replace: true });
            return;
        }

        const submission = await this.loadOrCreateSubmission(assignment);
        this.currentAssignment = assignment;
        this.currentSubmission = submission;
        this.renderAssignmentDetails(assignment, submission);
        await this.mountEditor(assignment, submission);
    },

    renderAssignmentDetails(assignment, submission) {
        const setText = (selector, text) => {
            const el = $(selector);
            if (el) el.textContent = text || '';
        };

        const defaultInstruction = assignment.activityType === CARD_SORT_TYPE
            ? 'Complete the card sort activity.'
            : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                ? 'Complete the spreadsheet activity.'
                : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                    ? 'Complete the image labeling activity.'
                    : (assignment.activityType === EXTERNAL_ARTIFACT_TYPE
                        ? 'Submit the requested external project evidence.'
                        : (assignment.activityType === FLOWCHART_ALGORITHM_TYPE
                            ? 'Build and submit the requested flowchart algorithm.'
                            : 'Complete the canvas activity.'))));
        const defaultOutput = assignment.activityType === CARD_SORT_TYPE
            ? 'Completed card sort'
            : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                ? 'Completed table, chart, and reflection'
                : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                    ? 'Labeled image with pins, notes, and reflection'
                    : (assignment.activityType === EXTERNAL_ARTIFACT_TYPE
                        ? 'Project link or uploaded evidence with reflection'
                        : (assignment.activityType === FLOWCHART_ALGORITHM_TYPE
                            ? 'Completed flowchart with checklist and reflection'
                            : 'Canvas response'))));
        const lateState = this.getLateState(assignment, submission);
        const statusLabel = submission.status === 'submitted' ? 'Submitted' : 'Draft ready';
        const metaParts = [
            this.formatDueDate(assignment.dueDate),
            lateState.label || statusLabel,
            assignment.weekLabel
        ].filter(Boolean);
        const timingParts = [
            assignment.weekLabel,
            this.formatAvailableDate(assignment.availableFrom),
            this.formatDueDate(assignment.dueDate),
            assignment.estimatedMinutes ? `${assignment.estimatedMinutes} min` : ''
        ].filter(Boolean);
        const taskSummary = getCompactTaskSummary(
            assignment.description || assignment.studentInstructions,
            defaultInstruction
        );

        setText('#student-classroom-activity-title', assignment.title);
        setText('#student-classroom-activity-meta', metaParts.join(' · '));
        setText('#student-classroom-activity-task-summary', taskSummary);
        setText('#student-classroom-activity-timing', timingParts.join(' · '));
        setText('#student-classroom-activity-description', assignment.description || 'No description provided.');
        setText('#student-classroom-activity-instructions', assignment.studentInstructions || defaultInstruction);
        setText('#student-classroom-activity-materials', assignment.materials || 'No materials listed.');
        setText('#student-classroom-activity-output', assignment.studentOutput || defaultOutput);
        const timingBlock = $('#student-classroom-activity-timing-block');
        if (timingBlock) timingBlock.hidden = timingParts.length === 0;
        const details = $('.student-classroom-details-disclosure');
        if (details) details.open = false;
        this.renderLateBanner(lateState);
        this.setSaveStatus(submission.status === 'submitted'
            ? `${lateState.label ? `${lateState.label}. ` : ''}Submitted. You can still edit and resubmit.`
            : `${lateState.label ? `${lateState.label}. ` : ''}Draft ready.`);

        const submitBtn = $('#student-submit-classroom-activity-btn');
        if (submitBtn) {
            submitBtn.innerHTML = submission.status === 'submitted'
                ? '<i data-lucide="send"></i> Resubmit'
                : '<i data-lucide="send"></i> Submit';
        }
        this.setPdfExportButtonState(false);
        if (window.lucide) window.lucide.createIcons();
    },

    renderLateBanner(lateState) {
        const body = $('#student-classroom-instructions-body');
        if (!body) return;

        body.querySelector('.student-classroom-late-banner')?.remove();
        if (!lateState?.label) return;

        const banner = createElement('div', `student-classroom-late-banner ${lateState.className}`);
        banner.textContent = lateState.isExcused
            ? `Excused late work${lateState.reason ? `: ${lateState.reason}` : ''}`
            : 'This work is marked late.';
        body.prepend(banner);
    }
};
