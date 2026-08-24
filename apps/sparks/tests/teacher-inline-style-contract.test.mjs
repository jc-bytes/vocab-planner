import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [teacherHtml, teacherCss, teacherQuizCss, dashboardRecentActivity, teacherDataViewer, studentProgressRenderer] = await Promise.all([
    read('teacher.html'),
    read('css/teacher.css'),
    read('css/teacherQuiz.css'),
    read('js/teacherDataDashboardRecentActivityMethods.js'),
    read('js/teacherDataViewer.js'),
    read('js/teacherStudentProgressRenderMethods.js')
]);

function quizTemplate() {
    const match = teacherHtml.match(/<template id="teacher-quizzes-view-template">([\s\S]*?)<\/template>/);
    assert.ok(match, 'Missing teacher Quiz Maker template');
    return match[1];
}

test('Quiz Maker template delegates static presentation to its lazy stylesheet', () => {
    const template = quizTemplate();
    assert.doesNotMatch(template, /\sstyle=/, 'Quiz Maker template must not recreate static styles inline');
    for (const className of ['quiz-maker-container', 'quiz-sidebar', 'quiz-tool-heading', 'quiz-border-option', 'quiz-canvas', 'quiz-list', 'quiz-empty-state']) {
        assert.match(template, new RegExp(`class="[^"]*${className}`));
        assert.match(teacherQuizCss, new RegExp(`\\.${className}[^\\{]*\\{`), `Lazy Quiz CSS must own .${className}`);
    }

    for (const declaration of [
        /\.quiz-maker-container\s*\{[^}]*display:\s*flex;[^}]*height:\s*calc\(100vh - 80px\);[^}]*gap:\s*1\.25rem;/s,
        /\.quiz-sidebar\s*\{[^}]*display:\s*flex;[^}]*width:\s*clamp\(380px, 26vw, 500px\);[^}]*flex-direction:\s*column;[^}]*overflow-y:\s*auto;/s,
        /\.quiz-tool-heading\s*\{[^}]*margin-bottom:\s*0\.5rem;[^}]*font-size:\s*0\.9rem;/s,
        /#edit-rubric-btn\s*\{[^}]*font-size:\s*0\.8rem;/s,
        /\.quiz-canvas\s*\{[^}]*flex:\s*1;[^}]*padding:\s*clamp\(1rem, 2vw, 2\.25rem\);[^}]*overflow-y:\s*auto;[^}]*background:\s*rgba\(15, 23, 42, 0\.3\);/s,
        /\.quiz-list\s*\{[^}]*max-width:\s*800px;[^}]*margin:\s*0 auto;/s,
        /\.quiz-empty-state\s*\{[^}]*padding:\s*3rem;[^}]*color:\s*var\(--text-muted\);[^}]*text-align:\s*center;/s
    ]) {
        assert.match(teacherQuizCss, declaration);
    }
});

test('Quiz responsive layout stays with the lazy feature instead of the teacher entry', () => {
    assert.match(teacherQuizCss, /@media \(max-width: 1024px\)\s*\{[\s\S]*?\.quiz-maker-container\s*\{[^}]*flex-direction:\s*column;[^}]*height:\s*auto;[\s\S]*?\.quiz-sidebar\s*\{[^}]*max-height:\s*none;[\s\S]*?\.quiz-canvas\s*\{[^}]*width:\s*100%;[^}]*overflow-x:\s*auto;/);
    assert.doesNotMatch(teacherQuizCss, /@media \(max-width: 1024px\)\s*\{[\s\S]*?\.quiz-sidebar\s*\{[^}]*width:/,
        'The established responsive layout keeps the clamped sidebar width');
    assert.doesNotMatch(teacherCss, /@media \(max-width: 1024px\)[\s\S]*?\.quiz-maker-container\s*\{/);
    assert.doesNotMatch(teacherQuizCss, /!important/);
});

test('Analytics Dashboard delegates static presentation to its owned stylesheet', () => {
    const start = teacherHtml.indexOf('<!-- Dashboard Tab -->');
    const end = teacherHtml.indexOf('<!-- Export Tab -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded Analytics Dashboard template');
    const dashboardTemplate = teacherHtml.slice(start, end);

    assert.doesNotMatch(dashboardTemplate, /\sstyle=/,
        'Analytics Dashboard markup must not recreate static styles inline');
    assert.doesNotMatch(dashboardRecentActivity, /style=/,
        'Recent Activity rendering must use dashboard-owned classes');

    for (const selector of [
        '.data-dashboard-panel',
        '.data-dashboard-header h3',
        '.data-dashboard-header p',
        '.data-grade-filter-card label',
        '.data-grade-filter-card select',
        '.data-summary-stat .card-metric',
        '.data-summary-stat--active .card-metric',
        '.data-summary-stat .card-secondary',
        '.data-dashboard-empty',
        '.data-dashboard-table'
    ]) {
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(teacherCss, new RegExp(`${escaped}[^\\{]*\\{`), `Teacher CSS must own ${selector}`);
    }

    for (const declaration of [
        /\.data-dashboard-panel\s*\{[^}]*display:\s*none;/s,
        /\.data-dashboard-header h3\s*\{[^}]*margin:\s*0 0 0\.5rem;[^}]*color:\s*var\(--color-text\);[^}]*font-size:\s*1\.3rem;[^}]*font-weight:\s*600;/s,
        /\.data-grade-filter-card select\s*\{[^}]*min-width:\s*150px;[^}]*padding:\s*0\.5rem 1rem;[^}]*border:\s*1px solid var\(--color-border\);[^}]*border-radius:\s*6px;[^}]*background:\s*rgba\(15, 23, 42, 0\.6\);[^}]*color:\s*var\(--color-text\);/s,
        /\.data-summary-stat--active \.card-metric\s*\{[^}]*color:\s*var\(--color-success\);/s,
        /\.data-dashboard-table\s*\{[^}]*width:\s*100%;[^}]*border-collapse:\s*collapse;/s,
        /\.data-dashboard-table \.data-dashboard-table__numeric\s*\{[^}]*text-align:\s*right;/s
    ]) {
        assert.match(teacherCss, declaration);
    }

    const dashboardCssStart = teacherCss.indexOf('.data-dashboard-panel');
    const dashboardCssEnd = teacherCss.indexOf('.word-hunt-review-shell', dashboardCssStart);
    assert.ok(dashboardCssStart >= 0 && dashboardCssEnd > dashboardCssStart);
    assert.doesNotMatch(teacherCss.slice(dashboardCssStart, dashboardCssEnd), /!important/);
    assert.match(teacherDataViewer, /content\.style\.display\s*=\s*isActive\s*\?\s*'block'\s*:\s*'none'/,
        'Tab visibility remains runtime state instead of static presentation');
});

test('Student Progress roster delegates static presentation to its owned stylesheet', () => {
    const start = teacherHtml.indexOf('<!-- View: Student Progress -->');
    const end = teacherHtml.indexOf('<!-- View: Group Generator -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded Student Progress roster view');
    const rosterTemplate = teacherHtml.slice(start, end);
    const renderStart = studentProgressRenderer.indexOf('renderProgressTable()');
    const renderEnd = studentProgressRenderer.indexOf('getStudentProgressDetails(', renderStart);
    assert.ok(renderStart >= 0 && renderEnd > renderStart, 'Missing bounded roster renderer');
    const rosterRenderer = studentProgressRenderer.slice(renderStart, renderEnd);

    assert.doesNotMatch(rosterTemplate, /\sstyle=/,
        'Student Progress roster markup must not recreate static styles inline');
    assert.doesNotMatch(rosterRenderer, /style=/,
        'Desktop roster rows must use Student Progress classes');

    for (const declaration of [
        /\.student-progress-filter-control\s*\{[^}]*width:\s*100%;[^}]*padding:\s*0\.5rem;/s,
        /\.student-progress-table\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*760px;[^}]*border-collapse:\s*collapse;[^}]*text-align:\s*left;/s,
        /\.student-progress-table-head\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*10;[^}]*background:\s*var\(--card-bg,/s,
        /\.student-progress-table-heading-row\s*\{[^}]*border-bottom:\s*2px solid var\(--color-border\);/s,
        /\.student-progress-table :is\(\.data-table__header-cell, \.data-table__cell\)\s*\{[^}]*padding:\s*1rem;/s,
        /\.student-progress-select-column\s*\{[^}]*width:\s*50px;/s,
        /\.student-progress-table \.add-coins-btn\s*\{[^}]*margin-left:\s*0\.5rem;/s,
        /\.bulk-actions input\[type="number"\]\s*\{[^}]*width:\s*90px;[^}]*padding:\s*0\.5rem;/s,
        /\.student-progress-table tr\.selected\s*\{/s
    ]) {
        assert.match(teacherCss, declaration);
    }

    const rosterCssStart = teacherCss.indexOf('.student-filter-card');
    const rosterCssEnd = teacherCss.indexOf('.activity-student-preview-modal', rosterCssStart);
    assert.ok(rosterCssStart >= 0 && rosterCssEnd > rosterCssStart);
    assert.doesNotMatch(teacherCss.slice(rosterCssStart, rosterCssEnd), /!important/);
    assert.doesNotMatch(teacherCss, /#teacher-progress-view \.card>div\[style\*="overflow-x"\]/,
        'Roster overflow must not depend on an inline-style substring selector');
});

test('Add Student modal delegates static presentation to its feature classes', () => {
    const start = teacherHtml.indexOf('<!-- Modal: Add Student -->');
    const end = teacherHtml.indexOf('<!-- Modal: Student Details -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded Add Student modal');
    const addStudentTemplate = teacherHtml.slice(start, end);

    assert.doesNotMatch(addStudentTemplate, /\sstyle=/,
        'Add Student markup must not recreate static styles inline');
    for (const className of [
        'add-student-dialog',
        'add-student-field-grid',
        'add-student-field-grid--grade',
        'add-student-section-input',
        'add-student-status'
    ]) {
        assert.match(addStudentTemplate, new RegExp(`class="[^"]*${className}`));
    }

    for (const declaration of [
        /\.add-student-dialog\s*\{[^}]*width:\s*92%;[^}]*max-width:\s*620px;/s,
        /\.add-student-field-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(180px, 1fr\)\);[^}]*gap:\s*1rem;/s,
        /\.add-student-field-grid--grade\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/s,
        /\.add-student-section-input\s*\{[^}]*text-transform:\s*uppercase;/s,
        /\.add-student-status\s*\{[^}]*color:\s*var\(--color-text-muted\);/s
    ]) {
        assert.match(teacherCss, declaration);
    }

    const addStudentCssStart = teacherCss.indexOf('.add-student-dialog');
    const addStudentCssEnd = teacherCss.indexOf('.student-progress-cards', addStudentCssStart);
    assert.ok(addStudentCssStart >= 0 && addStudentCssEnd > addStudentCssStart);
    assert.doesNotMatch(teacherCss.slice(addStudentCssStart, addStudentCssEnd), /!important/);
});

test('Student Detail delegates static presentation without disturbing runtime state styles', () => {
    const start = teacherHtml.indexOf('<!-- Modal: Student Details -->');
    const end = teacherHtml.indexOf('<!-- View: Editor -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded Student Detail modal');
    const detailTemplate = teacherHtml.slice(start, end);
    const showStart = studentProgressRenderer.indexOf('    async showStudentDetails(');
    const renderEnd = studentProgressRenderer.indexOf('    formatActivityDuration(', showStart);
    assert.ok(showStart >= 0 && renderEnd > showStart, 'Missing bounded Student Detail renderer');
    const detailRenderer = studentProgressRenderer.slice(showStart, renderEnd);

    assert.doesNotMatch(detailTemplate, /\sstyle=/,
        'Student Detail markup must not recreate static styles inline');
    assert.doesNotMatch(detailRenderer, /style=/,
        'Student Detail generated markup must use feature-owned classes');
    assert.match(detailRenderer, /tempOutput\.style\.display\s*=\s*'none'/,
        'Temporary-password visibility remains runtime state for Task 14');

    for (const declaration of [
        /\.student-detail-section \.modal-section-title,[\s\S]*?\.student-detail-unit-title\s*\{[^}]*margin-bottom:\s*0\.5rem;/s,
        /\.student-detail-control-row\s*\{[^}]*align-items:\s*center;[^}]*gap:\s*0\.75rem;/s,
        /\.student-detail-control-row--coins,[\s\S]*?\.student-detail-quick-actions\s*\{[^}]*gap:\s*0\.5rem;/s,
        /\.student-detail-coin-input\s*\{[^}]*width:\s*90px;/s,
        /\.student-detail-action-button\s*\{[^}]*padding:\s*0\.5rem 1rem;/s,
        /\.student-detail-temp-password\s*\{[^}]*display:\s*none;[^}]*margin-top:\s*0\.75rem;[^}]*padding:\s*0\.75rem 0;[^}]*border-top:\s*1px solid rgba\(255, 255, 255, 0\.1\);[^}]*color:\s*var\(--color-text\);/s,
        /\.student-detail-activity-list\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0;[^}]*margin-top:\s*1rem;/s,
        /\.student-detail-unit-results\s*\{[^}]*min-width:\s*0;[^}]*padding-top:\s*0\.5rem;[^}]*border-top:\s*1px solid var\(--color-border\);/s,
        /\.student-detail-score\s*\{[^}]*color:\s*var\(--color-brand\);/s,
        /#student-detail-modal \.modal-content\s*\{[^}]*width:\s*min\(92vw, 800px\) !important;[^}]*max-width:\s*800px;[^}]*max-height:\s*88vh !important;/s
    ]) {
        assert.match(teacherCss, declaration);
    }

    assert.doesNotMatch(teacherCss, /#detail-activity-list[^\{]*\[style\*="display: flex"\]/,
        'Student Detail layout must not depend on inline-style substring selectors');
});
