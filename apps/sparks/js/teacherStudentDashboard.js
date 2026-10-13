import { escapeHtml } from './main.js';
import { getActivityLabel } from './activityMetadata.js';
import { activityAttention } from './teacherStudentInsightModel.js';

import { assignmentProgressSeries, dashboardActivityChoices } from './teacherStudentGraphModel.js';
const text = escapeHtml;
const button = (label, assignment = '', activity = '', filter = 'all') => `<button type="button" class="btn secondary-btn" data-dashboard-work="${text(assignment)}" data-dashboard-activity="${text(activity)}" data-dashboard-filter="${filter}">${label}</button>`;
const tasks = assignment => assignment.kind === 'spark'
    ? assignment.readingRequired ? [{ status: assignment.readingStatus }] : []
    : assignment.activities.filter(activity => activity.required);

export function renderStudentDashboard(model, year) {
    const s = model.summary;
    const progress = assignmentProgressSeries(model), choices = dashboardActivityChoices(model);
    const work = model.work.filter(assignment => assignment.current);
    const concerns = work.flatMap(assignment => assignment.activities
        .filter(activity => activityAttention(activity).length)
        .map(activity => ({ assignment, activity })));
    const remaining = s.notStarted + s.inProgress + s.needsRevision;
    const headline = !work.length ? 'No current assignments'
        : s.overdue || s.needsRevision || concerns.length ? 'Needs a check-in'
        : s.review ? 'Ready for your review'
        : s.unknown ? 'Some progress is unavailable'
        : remaining ? 'Work in progress'
        : s.required ? 'Required work complete' : 'No required tasks to measure';
    const card = (label, value, description, filter) => `<article class="teacher-panel student-dashboard-stat"><span>${label}</span><strong>${value}</strong><p>${description}</p>${button('View work', '', '', filter)}</article>`;
    const next = work.filter(a => a.overdue || a.readingStatus === 'Needs review' || a.readingStatus === 'Needs revision')
        .sort((a, b) => Number(b.overdue) - Number(a.overdue)).slice(0, 4);
    const row = a => {
        const required = tasks(a), complete = required.filter(item => item.status === 'Completed').length;
        const label = a.kind === 'spark' && a.readingRequired ? a.readingStatus === 'Needs review' ? 'Waiting for your review' : a.readingStatus
            : !a.known ? 'Progress unavailable' : required.length ? `${complete} of ${required.length} tasks complete` : 'No required tasks';
        return `<article class="student-dashboard-work-row"><div><h4>${text(a.title)}</h4><p>${text(a.className || '')}${a.overdue ? ' · Past due' : ''}</p><span>${text(label)}</span>${required.length ? `<progress value="${complete}" max="${required.length}" aria-label="${text(a.title)} completion"></progress>` : ''}</div>${button(a.readingStatus === 'Needs review' ? 'Review answers' : 'Open work', a.id)}</article>`;
    };
    return `<div class="student-dashboard">
        <header class="student-dashboard-heading"><div><p>Student dashboard · ${year}</p><h3>${headline}</h3></div>${button('All work')}</header>
        <section class="teacher-panel student-dashboard-progress" aria-label="Required work progress"><div><strong>${s.completed} of ${s.required} required tasks completed</strong><span>Activities and required reading checks</span></div><progress value="${s.completed}" max="${Math.max(1, s.required)}" aria-label="Required tasks completed"></progress>${s.unknown ? `<p>${s.unknown} assignment${s.unknown === 1 ? '' : 's'} without measurable required completion.</p>` : ''}</section>
        <div class="student-dashboard-stats">
            ${card('Completed', s.completed, 'Required tasks finished', 'all')}
            ${card('Still to do', remaining, `${s.notStarted} not started · ${s.inProgress} in progress${s.needsRevision ? ` · ${s.needsRevision} to revise` : ''}`, 'pending')}
            ${card('Past due', s.overdue, 'Unfinished tasks past their deadline', 'overdue')}
            ${card('For you to review', s.review, 'Submitted reading checks', 'review')}
        </div>
        <div class="student-dashboard-columns">
            <section class="teacher-panel" aria-label="Progress by assignment"><h3>Progress by assignment</h3>
                <p data-dashboard-progress-status>Completed tasks, work still to do, and checks waiting for you.</p>
                ${progress.length ? `<div class="student-dashboard-chart-frame"><canvas data-dashboard-progress-chart role="img" aria-label="Required task counts by assignment. Exact values and links follow."></canvas></div>
                    <div class="student-dashboard-graph-values">${progress.map(row => `<div><span><strong>${text(row.title)}</strong><br>${row.completed} of ${row.total} complete · ${row.remaining} still to do · ${row.review} for review</span>${button('Open work', row.id)}</div>`).join('')}</div>`
                    : '<p>No measurable required tasks to graph.</p>'}
                ${s.unknown ? '<p>Assignments with unavailable requirements are not included in this graph.</p>' : ''}
                ${work.filter(a => a.known && tasks(a).length).length > 5 ? '<p>Showing up to 5 current assignments. Open All work for the rest.</p>' : ''}
            </section>
            <section class="teacher-panel" aria-label="Accuracy across attempts"><h3>Accuracy across attempts</h3>
                ${choices.length ? `<label class="student-dashboard-chart-picker">Activity<select data-dashboard-activity-picker class="form-control">${choices.map(choice => `<option value="${text(choice.key)}">${text(choice.title)} · ${text(getActivityLabel(choice.type))}</option>`).join('')}</select></label><div data-dashboard-trend aria-live="polite"></div>`
                    : '<p>No vocabulary activities to graph yet.</p>'}
            </section>
        </div>
        <div class="student-dashboard-columns">
            <section class="teacher-panel"><h3>What to check next</h3>${next.length ? next.map(row).join('') : `<p>${remaining ? 'There is unfinished work. Open the assignments below to see what is left.' : s.unknown ? 'Open the assignments to check work that has no measured completion.' : 'No past-due tasks or reading reviews in the current assignments.'}</p>`}</section>
            <section class="teacher-panel"><h3>Where they may need help</h3>${concerns.length ? concerns.slice(0, 4).map(({ assignment, activity }) => {
                const p = activity.progress, latest = p.latestAttempt;
                const reasons = [];
                if (activity.status !== 'Completed' && Number(p.finished_runs) >= 3) reasons.push(`${p.finished_runs} attempts finished, task still incomplete`);
                if (latest?.finishedAt && latest.accuracy !== null && latest.accuracy !== undefined && Number(latest.attemptedActions) >= 3 && Number(latest.accuracy) < 60) reasons.push(`${Math.round(Number(latest.accuracy))}% accuracy on the latest attempt`);
                if (latest?.isLate) reasons.push('Went over the activity time limit');
                return `<article class="student-dashboard-help"><h4>${text(getActivityLabel(activity.type))} · ${text(assignment.title)}</h4><ul>${reasons.map(reason => `<li>${text(reason)}</li>`).join('')}</ul>${button('See attempts', assignment.id, activity.type)}</article>`;
            }).join('') : '<p>No help flags in the available activity records.</p>'}<p class="student-dashboard-caption">These are clues to check together. Longer work time alone does not mean a student is struggling.</p></section>
        </div>

    </div>`;
}
