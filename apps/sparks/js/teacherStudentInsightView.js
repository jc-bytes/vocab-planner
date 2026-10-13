import { classroomRepository } from './services/classroomRepository.js';
import { escapeHtml } from './main.js';
import { createStudentFeedbackEditor } from './teacherStudentFeedbackEditor.js';
import { assignmentFeedback } from './teacherStudentFeedbackModel.js';
import { getActivityLabel } from './activityMetadata.js';
import { buildStudentInsight, attemptTiming, comparableTrend, activityAttention, capturedAnswerRows } from './teacherStudentInsightModel.js';
import { mountStudentDashboardCharts } from './teacherStudentDashboardCharts.js';
import { renderStudentDashboard } from './teacherStudentDashboard.js';
const text = escapeHtml;
const formatDate = value => value ? new Date(value).toLocaleString() : 'No deadline';
const metric = value => value === null || value === undefined ? 'Unavailable' : `${Math.round(Number(value))}%`;
const pretty = value => text(JSON.stringify(value, null, 2));

export async function loadStudentInsight(manager, studentId, schoolYear = manager.studentInsightYear || new Date().getFullYear()) {
    const host = document.querySelector('#student-profile-assigned-work');
    if (!host) return;
    const session = manager.studentProgressSessionGeneration || 0;
    const request = (manager.studentInsightRequest || 0) + 1;
    manager.studentInsightRequest = request;
    manager.studentDashboardCharts?.dispose();
    manager.studentDashboardCharts = null;
    const current = () => manager.activeStudentId === studentId && manager.studentInsightRequest === request
        && (manager.studentProgressSessionGeneration || 0) === session;
    await import('../css/teacher-student-feedback.css');
    await import('../css/teacher-student-dashboard.css');
    if (!current()) return;
    const repository = manager.classroomRepository || classroomRepository;
    const year = Number(schoolYear);
    manager.studentInsightYear = year;
    host.innerHTML = '<p role="status">Loading assigned work...</p>';
    const overview = document.querySelector('#student-insight-summary');
    if (overview) overview.textContent = 'Loading assigned-work insight...';
    try {
        const data = await repository.studentInsight(studentId, year);
        if (!current()) return;
        let model = buildStudentInsight(data);
        function renderSummary() {
            if (!overview) return;
            const selectedKey = manager.studentDashboardCharts?.selectedKey;
            manager.studentDashboardCharts?.dispose();
            overview.innerHTML = renderStudentDashboard(model, year);
            manager.studentDashboardCharts = mountStudentDashboardCharts({ root: overview, model, repository, studentId,
                isCurrent: current, selectedKey, openWork });
        }
        renderSummary();
        host.innerHTML = `<p>Required work includes vocabulary activities and reading checks. Scheduled, withdrawn and historical assignments appear below but do not count as current work. Older answer and time records may be incomplete.</p>
            <div class="teacher-toolbar"><label>School year <input id="student-insight-year" type="number" required min="2020" max="2200" value="${year}" class="form-control"></label><button id="student-insight-load-year" type="button" class="btn secondary-btn">Load year</button></div>
            <label>Show <select id="student-insight-filter"><option value="all">All assignments</option><option value="pending">Unfinished current work</option><option value="overdue">Past due</option><option value="review">Waiting for my review</option><option value="history">Scheduled and historical</option></select></label>
            <div id="student-insight-work-list"></div><section id="student-insight-attempts" class="teacher-panel" aria-live="polite"></section>`;
        const list = host.querySelector('#student-insight-work-list');
        const editors = new Map();
        function feedbackEditor(assignment, activityType = '') {
            const key = JSON.stringify([assignment.id, activityType]);
            if (!editors.has(key)) editors.set(key, createStudentFeedbackEditor({ repository,
                assignmentId: assignment.id, studentId, activityType, kind: assignment.kind,
                responseRevision: assignment.response?.revision ?? null, feedback: assignmentFeedback(assignment, activityType),
                isCurrent: current, onSaved: record => updateFeedback(assignment.id, record) }));
            return editors.get(key);
        }
        const render = filter => {
            const work = model.work.filter(a => filter === 'all' || filter === 'overdue' && a.overdue
                || filter === 'review' && a.current && a.kind === 'spark' && a.readingStatus === 'Needs review'
                || filter === 'history' && !a.current || filter === 'pending' && a.current && (!a.known || a.kind === 'spark' && a.readingRequired && !['Completed', 'Needs review'].includes(a.readingStatus) || a.activities.some(r => r.required && r.status !== 'Completed')));
            list.innerHTML = work.length ? work.map(a => `<article class="teacher-panel student-insight-assignment" data-assignment-card="${text(a.id)}">
                <h3>${text(a.title)}</h3><p data-insight-lifecycle="${text(a.id)}">${text(a.className)} · ${text(a.lifecycle)}${a.overdue ? ' · Past due and unfinished' : ''}</p>
                <p>Released ${text(formatDate(a.releaseAt))} · Due ${text(formatDate(a.dueAt))}</p>
                ${a.kind === 'spark' ? renderReading(a) : `${!a.known ? '<p>Required activities unavailable. Completion cannot be calculated.</p>' : ''}
                    <ul>${a.activities.map(r => `<li><strong>${text(getActivityLabel(r.type))}</strong> · ${r.required ? 'Required' : 'Optional / previously recorded'} · ${text(r.status)}
                    ${r.progress ? ` · Best score ${metric(r.progress.score)} · Lifetime accuracy ${metric(Number(r.progress.lifetime_attempted) > 0 ? 100 * Number(r.progress.lifetime_correct) / Number(r.progress.lifetime_attempted) : null)} · ${Number(r.progress.finished_runs) || 0} finished runs` : ''}
                    ${r.progress?.latestAttempt ? `<p>Latest score ${metric(r.progress.latestAttempt.score)} · Latest accuracy ${metric(r.progress.latestAttempt.accuracy)} · ${text(attemptTiming(r.progress.latestAttempt))}</p>` : ''}
                    ${activityAttention(r).length ? `<p>${activityAttention(r).map(text).join(' · ')}</p>` : ''}
                    <button type="button" class="btn secondary-btn" data-insight-assignment="${text(a.id)}" data-insight-activity="${text(r.type)}">Inspect attempts</button></li>`).join('')}</ul>`}
                <div data-feedback-assignment="${text(a.id)}"></div>
                <details><summary>Assignment content used by the student</summary><pre class="student-insight-evidence">${pretty(a.content)}</pre></details>
            </article>`).join('') : '<p>No assignments match this filter.</p>';
            for (const holder of list.querySelectorAll('[data-feedback-assignment]')) {
                const a = model.work.find(item => item.id === holder.dataset.feedbackAssignment);
                holder.append(feedbackEditor(a));
            }
        };
        function updateFeedback(assignmentId, record) {
            const assignment = data.assignments.find(a => a.id === assignmentId);
            assignment.feedback = [...(assignment.feedback || []).filter(f => f.activity_type !== record.activity_type), record];
            model = buildStudentInsight(data); renderSummary();
            const updated = model.work.find(a => a.id === assignmentId);
            for (const label of list.querySelectorAll('[data-insight-lifecycle]')) {
                if (label.dataset.insightLifecycle === assignmentId) label.textContent = `${updated.className} · ${updated.lifecycle}${updated.overdue ? ' · Past due and unfinished' : ''}`;
            }
            for (const label of list.querySelectorAll('[data-reading-status]')) {
                if (label.dataset.readingStatus === assignmentId) label.textContent = updated.readingStatus;
            }
        }
        render('all');
        host.querySelector('#student-insight-load-year').onclick = () => {
            const input = host.querySelector('#student-insight-year');
            if (input.reportValidity()) void loadStudentInsight(manager, studentId, Number(input.value));
        };
        host.querySelector('#student-insight-filter').onchange = event => render(event.target.value);
        host.onclick = event => {
            const button = event.target.closest('[data-insight-assignment]');
            if (!button) return;
            const a = model.work.find(item => item.id === button.dataset.insightAssignment);
            void inspectAttempts(a, button.dataset.insightActivity);
        };
        function openWork(assignmentId, activity, filter = 'all') {
            if (!current()) return;
            host.querySelector('#student-insight-filter').value = filter;
            render(filter);
            manager.setStudentProfileTab('assigned');
            const assignment = model.work.find(a => a.id === assignmentId);
            if (assignment && activity) void inspectAttempts(assignment, activity);
            else if (assignment) [...list.querySelectorAll('[data-assignment-card]')].find(card => card.dataset.assignmentCard === assignment.id)?.scrollIntoView({ block: 'start' });
        }
        if (overview) overview.onclick = event => {
            const button = event.target.closest('[data-dashboard-work]');
            if (!button || !current()) return;
            openWork(button.dataset.dashboardWork, button.dataset.dashboardActivity, button.dataset.dashboardFilter);
        };
        let attemptRequest = 0;
        async function inspectAttempts(assignment, activity, offset = 0) {
            const token = ++attemptRequest;
            const target = host.querySelector('#student-insight-attempts');
            target.innerHTML = '<p role="status">Loading attempts...</p>';
            try {
                const page = await repository.studentAttempts(studentId, assignment.id, activity, offset);
                if (!current() || token !== attemptRequest) return;
                const trend = offset === 0 ? comparableTrend(page.attempts) : null;
                target.innerHTML = `<h3>${text(assignment.title)} · ${text(getActivityLabel(activity))}</h3><p>${page.total} recorded attempts. Started attempts may have no submitted result.</p>
                    ${trend ? `<p>Latest accuracy ${trend.latest}%, previous ${trend.previous}% · ${text(trend.label)}.</p>` : ''}
                    ${(page.attempts || []).map(a => `<article class="student-insight-attempt"><h4>${text(formatDate(a.startedAt))}</h4>
                        <p>${a.finishedAt ? `Finished ${text(formatDate(a.finishedAt))}` : 'No finished result recorded'} · ${a.mastered ? 'Mastered' : 'Mastery not recorded'}</p>
                        <p>Score ${metric(a.score)} · Accuracy ${metric(a.accuracy)}${a.metricLabel ? ` · ${text(a.metricLabel)}` : ''} · ${text(attemptTiming(a))}${a.wasLate ? a.isLate ? ' · Activity time limit exceeded' : ' · Time limit excused' : ''}</p>
                        <p>${a.captureQuality === 'complete' ? 'Captured result' : 'Partial capture: some evidence may be unavailable'}</p>
                        ${renderCapturedAnswers(activity, a, assignment.content)}
                        <details><summary>Saved evidence</summary><pre class="student-insight-evidence">${pretty({ actions: { correct: a.correctActions, attempted: a.attemptedActions }, metrics: a.metrics, details: a.details, state: a.state })}</pre></details></article>`).join('') || '<p>No attempts recorded.</p>'}
                    <div class="teacher-toolbar">${offset > 0 ? '<button type="button" class="btn secondary-btn" data-attempt-page="previous">Previous attempts</button>' : ''}${offset + page.attempts.length < page.total ? '<button type="button" class="btn secondary-btn" data-attempt-page="next">More attempts</button>' : ''}</div>`;
                target.querySelectorAll('[data-attempt-page]').forEach(button => button.onclick = () => void inspectAttempts(assignment, activity, offset + (button.dataset.attemptPage === 'next' ? 20 : -20)));
                target.append(feedbackEditor(model.work.find(a => a.id === assignment.id), activity));
                target.scrollIntoView({ block: 'nearest' });
            } catch (error) {
                if (current() && token === attemptRequest) target.innerHTML = '<p role="alert">Attempt history could not be loaded. Select Inspect attempts to retry.</p>';
            }
        }
    } catch (error) {
        if (!current()) return;
        if (overview) overview.textContent = 'Assigned-work insight unavailable. Recorded activity below does not include untouched assignments.';
        host.innerHTML = '<p role="alert">Assigned work could not be loaded.</p><button type="button" class="btn secondary-btn" id="student-insight-retry">Retry assigned work</button>';
        host.querySelector('#student-insight-retry').onclick = () => void loadStudentInsight(manager, studentId);
    }
}
function renderReading(assignment) {
    const response = assignment.response;
    const questions = assignment.content?.questions || [];
    return `<p><strong data-reading-status="${text(assignment.id)}">${text(assignment.readingStatus)}</strong></p>${!assignment.readingRequired ? '<p>This reading has no required check. Reading completion is not measured in the assigned-task totals.</p>' : ''}${response ? `<p>Submitted ${text(formatDate(response.submitted_at))} · Revision ${Number(response.revision) || 0}</p>
        ${response.evaluation?.automaticTotal > 0 ? `<p>Automatic check: ${Number(response.evaluation.correct) || 0} of ${Number(response.evaluation.automaticTotal)} correct.</p>` : ''}
        ${Array.isArray(questions) ? questions.map(q => `<div class="student-insight-answer"><strong>${text(q.prompt || q.question || q.text || q.id)}</strong><p>${text(readingAnswer(q, response.answers?.[q.id]))}</p></div>`).join('') : ''}
        ${response.response ? `<p class="student-insight-answer">${text(response.response)}</p>` : ''}
        <details><summary>All reading answers and check results</summary><pre class="student-insight-evidence">${pretty({ answers: response.answers, evaluation: response.evaluation })}</pre></details>` : '<p>No reading submission recorded.</p>'}`;
}

function readingAnswer(question, answer) {
    if (answer === null || answer === undefined || answer === '') return 'No answer recorded';
    return question.type === 'multiple_choice' && question.options?.[Number(answer)] !== undefined
        ? String(question.options[Number(answer)]) : String(answer);
}

function renderCapturedAnswers(activity, attempt, content) {
    const rows = capturedAnswerRows(activity, attempt, content);
    if (!rows.length) return '<p>Individual answers are not available in a readable record for this attempt. Saved evidence may contain additional details.</p>';
    return `<ul>${rows.map(row => `<li><strong>${text(row.prompt)}</strong><p>Student: ${text(row.answer ?? 'No answer captured')}${row.expected !== null ? `<br>Expected: ${text(row.expected)}` : ''}<br>${row.correct === null ? 'Result unavailable' : row.correct ? 'Correct on the recorded answer' : 'Incorrect on the recorded answer'}</p></li>`).join('')}</ul>`;
}
