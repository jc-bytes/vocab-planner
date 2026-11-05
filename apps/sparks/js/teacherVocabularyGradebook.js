import { compactFilter } from './compactAssignmentControls.js';
import { defaultProgressPeriod, normalizeProgressContext, progressTerms, validProgressRange } from './teacherClassProgressModel.js';
import { createAssignmentDialog, node, action, inputField } from './teacherAssignmentUi.js';
import { getActivityLabel } from './activityMetadata.js';
import '../css/teacher-vocabulary-gradebook.css';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const points = value => finite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Unavailable';
const percentage = value => finite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : 'Unavailable';
const dateLabel = (value, timeZone) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone });
};
const measurable = grade => grade?.enabled === true && grade.status !== 'unavailable' && finite(grade.earnedPoints) && finite(grade.maxPoints) && grade.maxPoints > 0 && finite(grade.percent);
const snapshot = grade => grade?.published?.grade || grade?.published?.snapshot || grade?.published || null;
function needsPublication(grade) {
    if (!grade) return false;
    const saved = snapshot(grade);
    if (!grade.enabled) return Boolean(saved && saved.enabled !== false && saved.status !== 'ungraded');
    const signature = item => JSON.stringify({
        enabled: item?.enabled, status: item?.status, requiredCount: item?.requiredCount, requiredCompleted: item?.requiredCompleted,
        additionalCount: item?.additionalCount, additionalCompleted: item?.additionalCompleted, basePoints: item?.basePoints,
        bonusPoints: item?.bonusPoints, rawBonusPoints: item?.rawBonusPoints, bonusLimited: item?.bonusLimited, earnedPoints: item?.earnedPoints, maxPoints: item?.maxPoints, percent: item?.percent,
        grading: item?.grading ? Object.fromEntries(Object.entries(item.grading).sort(([a], [b]) => a.localeCompare(b))) : null,
        activities: [...(item?.activities || [])].map(activity => ({ activityType: activity.activityType, required: activity.required, complete: activity.complete, points: activity.points })).sort((a, b) => a.activityType.localeCompare(b.activityType))
    });
    return !saved || signature(saved) !== signature(grade);
}
function totals(student, assignments) {
    const enabled = assignments.filter(assignment => assignment.grading?.enabled === true);
    const rows = enabled.map(assignment => student.grades?.find(grade => grade.assignmentId === assignment.id));
    const known = rows.filter(measurable), earned = known.reduce((sum, grade) => sum + grade.earnedPoints, 0), possible = known.reduce((sum, grade) => sum + grade.maxPoints, 0);
    return { enabled: enabled.length, known: known.length, earned, possible, percent: possible > 0 ? earned / possible * 100 : null, published: rows.filter(grade => Boolean(snapshot(grade))).length };
}

export async function mountVocabularyGradebook({ root, active, calendar, timeZone = 'UTC', repository, signal, isCurrent, initial, onStateChange, onStudent, ownerUserId }) {
    let state = { ...normalizeProgressContext(initial || defaultProgressPeriod(calendar, active.school_year, timeZone)), studentId: initial?.studentId || null };
    const terms = progressTerms(calendar, active.school_year);
    if (state.period !== 'custom') {
        const term = terms.find(item => item.period === state.period);
        state = { ...state, from: term?.from || '', to: term?.to || '' };
    }
    if (!terms.some(item => item.period === state.period)) state.period = 'custom';
    const section = node('section', undefined, 'vocabulary-gradebook'); section.setAttribute('aria-label', 'Vocabulary grades');
    const heading = node('div', undefined, 'vocabulary-gradebook-heading'); heading.append(node('h3', 'Vocabulary grades'), node('p', 'Required activities earn the base points. Additional activities can earn bonus points.'));
    const filters = node('div', undefined, 'vocabulary-gradebook-toolbar');
    const period = compactFilter(filters, 'Period', [...terms.map(term => [term.period, `Trimester ${term.period}`]), ['custom', 'Custom dates']], 'Grade period'); period.value = state.period;
    const searchLabel = node('label', 'Student'), search = node('input'); search.type = 'search'; search.value = state.search; search.placeholder = 'Find a student'; search.setAttribute('aria-label', 'Search grade students'); searchLabel.append(search); filters.append(searchLabel);
    const options = node('details', undefined, 'vocabulary-gradebook-options'), optionsTitle = node('summary', 'Filters'), optionsBody = node('div', undefined, 'vocabulary-gradebook-options-body'); options.append(optionsTitle, optionsBody); filters.append(options);
    const sort = compactFilter(optionsBody, 'Sort', [['name', 'Name A–Z'], ['completion-asc', 'Lowest live total'], ['completion-desc', 'Highest live total']], 'Sort grades'); sort.value = state.sort;
    const pendingLabel = node('label', undefined, 'vocabulary-gradebook-check'), pending = node('input'); pending.type = 'checkbox'; pending.checked = state.unfinished; pendingLabel.append(pending, document.createTextNode('Needs publication')); optionsBody.append(pendingLabel);
    const dates = node('div', undefined, 'vocabulary-gradebook-dates');
    const from = inputField(dates, 'Assigned from', 'from', 'date'), to = inputField(dates, 'Assigned through', 'to', 'date'); from.required = to.required = true;
    const apply = action('Apply dates', () => {
        if (!current() || !from.reportValidity() || !to.reportValidity()) return;
        state.from = from.value; state.to = to.value; state.offset = 0; state.scroll = 0; void load();
    }); dates.append(apply);
    const message = node('p', '', 'vocabulary-gradebook-status'); message.setAttribute('role', 'status');
    const retry = action('Retry grades', () => { if (current()) void load(); }); retry.hidden = true;
    const surface = node('div', undefined, 'vocabulary-gradebook-surface');
    const footer = node('div', undefined, 'vocabulary-gradebook-footer'), count = node('span'), paging = node('div'); count.setAttribute('role', 'status');
    const previous = action('Previous students', () => { if (current()) { state.offset = Math.max(0, state.offset - 25); render(); notify(); } });
    const next = action('Next students', () => { if (current()) { state.offset += 25; render(); notify(); } }); paging.append(previous, next); footer.append(paging, count);
    const help = node('p', 'Live calculations are provisional. Students see only published grades. Ungraded vocabularies are excluded from totals.', 'vocabulary-gradebook-footnote');
    section.append(heading, filters, dates, message, retry, surface, footer, help); root.append(section);
    let data = null, loading = false, request = 0, readController, closeDialog, selectedStudentId = state.studentId, activeMutation = false;
    const current = () => !signal.aborted && isCurrent() && section.isConnected;
    const notify = () => { if (current()) onStateChange?.({ ...state }); };
    const onAbort = () => { request++; readController?.abort(); closeDialog?.(); };
    signal.addEventListener('abort', onAbort, { once: true });
    function syncDates() { dates.hidden = state.period !== 'custom'; from.value = state.from; to.value = state.to; }
    function studentGrades(student) { return new Map((student.grades || []).map(grade => [grade.assignmentId, grade])); }
    function openStudent(student) {
        if (!current()) return;
        state.scroll = window.scrollY; notify(); onStudent?.({ classId: active.id, studentId: student.studentId, tab: 'assigned', gradebookContext: { ...state } });
    }
    function gradeButton(student, assignment, grade) {
        const button = action('', () => { if (current()) openGrade(student, assignment, grade); }); button.className = 'vocabulary-grade-cell';
        button.setAttribute('aria-label', `${student.name}, ${assignment.title}: ${!grade?.enabled ? 'Not graded' : measurable(grade) ? `${points(grade.earnedPoints)} of ${points(grade.maxPoints)} points` : 'Grade unavailable'}`);
        if (!grade?.enabled) button.append(node('span', 'Not graded', 'vocabulary-grade-empty'));
        else if (!measurable(grade)) button.append(node('span', 'Unavailable', 'vocabulary-grade-empty'));
        else {
            button.append(node('strong', `${points(grade.earnedPoints)} / ${points(grade.maxPoints)}`, 'vocabulary-grade-mark'), node('span', percentage(grade.percent), 'vocabulary-grade-percent'));
            if (grade.bonusPoints > 0) button.append(node('small', `+${points(grade.bonusPoints)} bonus`, 'vocabulary-grade-bonus'));
        }
        const saved = snapshot(grade);
        button.append(node('small', saved ? needsPublication(grade) ? `Published ${points(saved.earnedPoints)} / ${points(saved.maxPoints)} · Live changes` : 'Published' : grade?.enabled ? 'Not published' : '', 'vocabulary-grade-publication'));
        return button;
    }
    function totalMark(student, assignments) {
        const total = totals(student, assignments), holder = node('div', undefined, 'vocabulary-grade-total');
        holder.append(node('strong', total.percent === null ? total.enabled ? 'Unavailable' : 'Not graded' : percentage(total.percent)));
        if (total.percent !== null) holder.append(node('small', `${points(total.earned)} / ${points(total.possible)} points`));
        holder.append(node('small', `${total.known}/${total.enabled} measurable · Provisional`)); return holder;
    }
    function render() {
        if (!current()) return;
        surface.replaceChildren();
        const activeFilters = Number(state.unfinished) + Number(state.sort !== 'name'); optionsTitle.textContent = activeFilters ? `Filters (${activeFilters})` : 'Filters';
        if (!data) { surface.append(node('p', loading ? 'Loading grades…' : 'Grades unavailable.')); paging.hidden = true; count.textContent = ''; return; }
        const assignments = data.assignments, query = state.search.trim().toLocaleLowerCase();
        const students = data.students.filter(student => `${student.name} ${student.email || ''}`.toLocaleLowerCase().includes(query) && (!state.unfinished || student.grades?.some(needsPublication)));
        const cache = new Map(students.map(student => [student.studentId, totals(student, assignments)]));
        students.sort((a, b) => {
            if (state.sort !== 'name') {
                const av = cache.get(a.studentId).percent, bv = cache.get(b.studentId).percent;
                if (av === null && bv !== null) return 1; if (bv === null && av !== null) return -1;
                if (av !== bv) return (av - bv) * (state.sort === 'completion-desc' ? -1 : 1);
            }
            return a.name.localeCompare(b.name) || a.studentId.localeCompare(b.studentId);
        });
        if (!assignments.length) { surface.append(node('p', 'No vocabulary assignments were released during these dates.')); paging.hidden = true; count.textContent = `${students.length} students`; return; }
        if (!students.length) { surface.append(node('p', data.students.length ? 'No students match these filters.' : 'No students have joined this class.')); paging.hidden = true; count.textContent = '0 students'; return; }
        state.offset = Math.min(state.offset, Math.max(0, Math.ceil(students.length / 25) - 1) * 25);
        const scroller = node('div', undefined, 'vocabulary-gradebook-scroll'); scroller.tabIndex = 0; scroller.setAttribute('role', 'region'); scroller.setAttribute('aria-label', 'Vocabulary grade table');
        const table = node('table', undefined, 'vocabulary-gradebook-table'); table.setAttribute('aria-label', 'Class vocabulary grades');
        const head = node('thead'), row = node('tr'), studentHeading = node('th', 'Student', 'vocabulary-grade-student'); studentHeading.scope = 'col'; row.append(studentHeading);
        for (const assignment of assignments) {
            const th = node('th'); th.scope = 'col';
            const settings = action(assignment.title, () => { if (current()) openSettings(assignment); }); settings.className = 'vocabulary-grade-assignment'; settings.setAttribute('aria-label', `Grading settings for ${assignment.title}`);
            settings.append(node('small', dateLabel(assignment.releaseAt, timeZone)), node('small', assignment.grading?.enabled ? 'Graded · Settings' : 'Not graded · Settings'));
            th.append(settings); row.append(th);
        }
        const totalHeading = node('th', 'Live total', 'vocabulary-grade-total-column'); totalHeading.scope = 'col'; totalHeading.title = 'Points-weighted percentage from measurable, graded vocabularies. Provisional; not a published trimester result.'; row.append(totalHeading); head.append(row);
        const body = node('tbody');
        for (const student of students.slice(state.offset, state.offset + 25)) {
            const tr = node('tr'), name = node('th', undefined, 'vocabulary-grade-student'); name.scope = 'row';
            const link = action(student.name, () => openStudent(student)); link.className = 'vocabulary-grade-student-link'; name.append(link); tr.append(name);
            const grades = studentGrades(student);
            for (const assignment of assignments) { const cell = node('td'); cell.append(gradeButton(student, assignment, grades.get(assignment.id))); tr.append(cell); }
            const total = node('td', undefined, 'vocabulary-grade-total-column'); total.append(totalMark(student, assignments)); tr.append(total); body.append(tr);
        }
        table.append(head, body); scroller.append(table);
        const mobile = node('div', undefined, 'vocabulary-gradebook-mobile'), select = compactFilter(mobile, 'Student', students.map(student => [student.studentId, student.name]), 'Grade student');
        if (!students.some(student => student.studentId === selectedStudentId)) selectedStudentId = students[0].studentId;
        select.value = selectedStudentId;
        const mobileList = node('div');
        const renderMobile = () => {
            mobileList.replaceChildren(); const student = students.find(item => item.studentId === selectedStudentId); if (!student) return;
            const grades = studentGrades(student);
            for (const assignment of assignments) {
                const item = node('article', undefined, 'vocabulary-grade-mobile-row'), description = node('div');
                const title = action(assignment.title, () => { if (current()) openSettings(assignment); }); title.className = 'vocabulary-grade-assignment'; description.append(title, node('small', dateLabel(assignment.releaseAt, timeZone)));
                item.append(description, gradeButton(student, assignment, grades.get(assignment.id))); mobileList.append(item);
            }
            const total = node('div', undefined, 'vocabulary-grade-mobile-row'); total.append(node('strong', 'Live total'), totalMark(student, assignments)); mobileList.append(total);
            const details = action('Open student work', () => openStudent(student)); mobileList.append(details);
        };
        select.addEventListener('change', () => { if (current()) { selectedStudentId = select.value; state.studentId = selectedStudentId; renderMobile(); notify(); } });
        renderMobile(); mobile.append(mobileList); surface.append(scroller, mobile);
        previous.disabled = loading || state.offset === 0; next.disabled = loading || state.offset + 25 >= students.length;
        paging.hidden = students.length <= 25;
        count.textContent = students.length <= 25 ? `${students.length} students · ${assignments.length} vocabularies` : `Students ${state.offset + 1}–${Math.min(state.offset + 25, students.length)} of ${students.length}`;
    }
    function dialog(title) {
        closeDialog?.(); const view = createAssignmentDialog(title); view.dialog.classList.add('vocabulary-grade-dialog'); closeDialog = view.close; return view;
    }
    function openGrade(student, assignment, grade) {
        const view = dialog(`${student.name} · ${assignment.title}`);
        view.body.append(node('p', 'Live calculation', 'vocabulary-grade-section-label'));
        if (!grade?.enabled) view.body.append(node('p', 'This vocabulary is not graded. It does not count in grade totals.'));
        else if (!measurable(grade)) view.body.append(node('p', grade.reason || 'The required activity evidence is unavailable. No grade can be calculated.'));
        else {
            view.body.append(node('p', `${points(grade.earnedPoints)} / ${points(grade.maxPoints)} points · ${percentage(grade.percent)}`, 'vocabulary-grade-detail-score'));
            const breakdown = node('dl', undefined, 'vocabulary-grade-breakdown');
            for (const [label, value] of [['Required activities', `${grade.requiredCompleted} / ${grade.requiredCount} complete`], ['Base points', points(grade.basePoints)], ['Additional activities', `${grade.additionalCompleted} / ${grade.additionalCount} complete`], ['Bonus points', `+${points(grade.bonusPoints)}`]]) breakdown.append(node('dt', label), node('dd', value));
            view.body.append(breakdown);
            const activities = node('ul', undefined, 'vocabulary-grade-activities');
            for (const activity of grade.activities || []) activities.append(node('li', `${getActivityLabel(activity.activityType)} · ${activity.required ? 'Required' : 'Additional'} · ${activity.complete ? 'Complete' : 'Not complete'} · ${points(activity.points)} points`));
            view.body.append(node('p', 'Activity points before limits', 'vocabulary-grade-section-label'), activities, node('p', 'Bonus limits are applied to the total, so individual activity points may add up to more than the awarded bonus.', 'vocabulary-gradebook-footnote'), node('p', 'This live calculation can change as more verified activity results arrive. It does not replace a published grade until you publish again.', 'vocabulary-gradebook-footnote'));
        }
        view.body.append(node('p', 'Last published grade', 'vocabulary-grade-section-label'));
        const saved = snapshot(grade);
        if (saved) view.body.append(node('p', saved.enabled === false || saved.status === 'ungraded' ? 'Published as ungraded. No numeric grade is visible to students.' : `${points(saved.earnedPoints)} / ${points(saved.maxPoints)} points · ${percentage(saved.percent)}`), node('p', `Published ${dateLabel(saved.publishedAt || grade.published?.publishedAt, timeZone) || 'previously'}. Students see this snapshot.`));
        else view.body.append(node('p', 'No grade has been published for this vocabulary and student.'));
        const work = action('Open student work', () => { if (current()) { view.close(); openStudent(student); } }); view.footer.append(work);
    }
    function openSettings(assignment) {
        const view = dialog(`Grading · ${assignment.title}`), config = { enabled: false, maxPoints: 100, bonusPerActivity: 0, bonusCap: null, capAtMaxPoints: false, ...assignment.grading };
        const canPublish = config.enabled || Boolean(assignment.publishedAt);
        const form = node('form'), enabledLabel = node('label', undefined, 'vocabulary-gradebook-check'), enabled = node('input'); enabled.type = 'checkbox'; enabled.checked = config.enabled; enabledLabel.append(enabled, document.createTextNode('Grade this vocabulary')); form.append(enabledLabel);
        form.addEventListener('submit', event => event.preventDefault());
        const fields = node('fieldset'), legend = node('legend', 'Points'); fields.append(legend); form.append(fields); fields.disabled = !enabled.checked;
        const maximum = inputField(fields, 'Required work points', 'maxPoints', 'number'); maximum.min = '0.01'; maximum.max = '100000'; maximum.step = '0.01'; maximum.required = true; maximum.value = String(config.maxPoints);
        const bonus = inputField(fields, 'Bonus points per additional activity', 'bonusPerActivity', 'number'); bonus.min = '0'; bonus.max = '100000'; bonus.step = '0.01'; bonus.required = true; bonus.value = String(config.bonusPerActivity);
        const cap = inputField(fields, 'Maximum bonus points (optional)', 'bonusCap', 'number'); cap.min = '0'; cap.max = '100000'; cap.step = '0.01'; cap.value = config.bonusCap === null ? '' : String(config.bonusCap);
        const capLabel = node('label', undefined, 'vocabulary-gradebook-check'), capAtMaximum = node('input'); capAtMaximum.type = 'checkbox'; capAtMaximum.checked = config.capAtMaxPoints; capLabel.append(capAtMaximum, document.createTextNode('Limit total to the required work points')); fields.append(capLabel);
        form.append(node('p', 'Base points are shared equally across required activities. Only verified completion earns points. Additional activities never reduce the base grade.', 'vocabulary-gradebook-footnote'));
        const error = node('p'); error.setAttribute('role', 'alert'); form.append(error); view.body.append(form);
        enabled.addEventListener('change', () => { fields.disabled = !enabled.checked; });
        const save = action('Save grading', async () => {
            if (!current() || activeMutation || !form.reportValidity()) return;
            activeMutation = true; save.disabled = publish.disabled = true; fields.disabled = enabled.disabled = true; error.textContent = '';
            const grading = { enabled: enabled.checked, maxPoints: Number(maximum.value), bonusPerActivity: Number(bonus.value), bonusCap: cap.value === '' ? null : Number(cap.value), capAtMaxPoints: capAtMaximum.checked };
            try {
                await repository.setAssignmentGrading(assignment.id, grading, assignment.revision, { signal, ownerUserId });
                if (!current()) return; view.close(); await load();
            } catch (reason) { if (current() && view.dialog.isConnected) error.textContent = reason.message || 'Could not save grading. Reload grades and try again.'; }
            finally { activeMutation = false; if (view.dialog.isConnected) { save.disabled = false; enabled.disabled = false; fields.disabled = !enabled.checked; publish.disabled = !canPublish || isDirty(); } }
        });
        const publish = action(config.enabled ? 'Publish current grades' : 'Publish ungraded status', async () => {
            if (!current() || activeMutation || isDirty()) return;
            activeMutation = true; save.disabled = publish.disabled = true; fields.disabled = enabled.disabled = true; error.textContent = '';
            try {
                await repository.publishVocabularyGrades(assignment.id, assignment.revision, { signal, ownerUserId });
                if (!current()) return; view.close(); await load();
            } catch (reason) { if (current() && view.dialog.isConnected) error.textContent = reason.message || 'Grades could not be published. Reload grades and try again.'; }
            finally { activeMutation = false; if (view.dialog.isConnected) { save.disabled = false; enabled.disabled = false; fields.disabled = !enabled.checked; publish.disabled = !canPublish || isDirty(); } }
        });
        const readConfig = () => ({ enabled: enabled.checked, maxPoints: Number(maximum.value), bonusPerActivity: Number(bonus.value), bonusCap: cap.value === '' ? null : Number(cap.value), capAtMaxPoints: capAtMaximum.checked });
        const isDirty = () => JSON.stringify(readConfig()) !== JSON.stringify(config);
        form.addEventListener('input', () => { publish.disabled = !canPublish || isDirty(); error.textContent = isDirty() ? 'Save grading before publishing changes.' : ''; });
        form.addEventListener('change', () => { publish.disabled = !canPublish || isDirty(); error.textContent = isDirty() ? 'Save grading before publishing changes.' : ''; });
        publish.disabled = !canPublish;
        view.body.append(node('p', !config.enabled && assignment.publishedAt ? 'Grading is disabled in the live settings. Publish the ungraded status to remove the previously published numeric grade from the student display.' : assignment.publishedAt ? `Last published ${dateLabel(assignment.publishedAt, timeZone)}. Publishing again replaces the visible snapshot for this vocabulary.` : 'Nothing has been published yet. Save any settings changes before publishing.', 'vocabulary-gradebook-footnote'));
        view.footer.append(save, publish);
    }
    async function load() {
        readController?.abort(); readController = new AbortController(); const token = ++request;
        data = null; retry.hidden = true;
        if (!validProgressRange(state)) { loading = false; message.textContent = 'Choose valid assigned dates. The end must be on or after the start.'; render(); notify(); return; }
        if (!current()) return;
        loading = true; section.setAttribute('aria-busy', 'true'); message.textContent = 'Loading grades…'; render(); notify();
        try {
            const result = await repository.classGradebook(active.id, state.from, state.to, { signal: readController.signal });
            if (!current() || token !== request) return;
            if (!Array.isArray(result?.assignments) || !Array.isArray(result?.students)) throw new Error('Invalid gradebook response.');
            data = result; message.textContent = `Assigned between ${state.from} and ${state.to} · Live calculations`;
        } catch {
            if (!current() || token !== request) return;
            message.textContent = 'Grades could not be loaded. Existing grades have not been replaced with zeros.'; retry.hidden = false;
        } finally {
            if (current() && token === request) { loading = false; section.setAttribute('aria-busy', 'false'); render(); notify(); }
        }
    }
    period.addEventListener('change', () => {
        if (!current()) return; state.period = period.value; state.offset = 0; state.scroll = 0;
        const term = terms.find(item => item.period === state.period); if (term) { state.from = term.from; state.to = term.to; }
        syncDates(); void load();
    });
    for (const control of [search, sort, pending]) control.addEventListener(control === search ? 'input' : 'change', () => {
        if (!current()) return; state.search = search.value; state.sort = sort.value; state.unfinished = pending.checked; state.offset = 0; state.scroll = 0; render(); notify();
    });
    syncDates(); await load(); if (current() && state.scroll) window.scrollTo({ top: state.scroll, behavior: 'instant' });
}
