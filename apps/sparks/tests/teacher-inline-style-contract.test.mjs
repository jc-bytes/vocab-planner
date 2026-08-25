import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [
    teacherHtml,
    teacherCss,
    teacherQuizCss,
    dashboardRecentActivity,
    teacherDataViewer,
    studentProgressRenderer,
    vocabularyStorage,
    vocabularyWordEditor,
    dataExport,
    dataExportPreviewRenderer
] = await Promise.all([
    read('teacher.html'),
    read('css/teacher.css'),
    read('css/teacherQuiz.css'),
    read('js/teacherDataDashboardRecentActivityMethods.js'),
    read('js/teacherDataViewer.js'),
    read('js/teacherStudentProgressRenderMethods.js'),
    read('js/teacherVocabularyStorage.js'),
    read('js/teacherVocabularyWordEditorMethods.js'),
    read('js/teacherDataExport.js'),
    read('js/teacherDataExportPreviewRenderer.js')
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

test('Teacher loading and login views delegate static presentation to auth classes', () => {
    const start = teacherHtml.indexOf('<!-- View: Loading -->');
    const end = teacherHtml.indexOf('<!-- View: Overview -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded teacher loading and login views');
    const authTemplate = teacherHtml.slice(start, end);

    assert.doesNotMatch(authTemplate, /style="(?=[^"]*(?:width|height|margin|padding|color|background|border))/,
        'Teacher auth markup must keep only runtime display state inline');
    assert.match(authTemplate, /id="teacher-login-error"[^>]*style="display:none;"/,
        'Initial login-error visibility remains with the auth state owner for Task 14');

    for (const declaration of [
        /\.teacher-session-loading\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*height:\s*60vh;/s,
        /\.teacher-session-loading__spinner\s*\{[^}]*width:\s*50px;[^}]*height:\s*50px;[^}]*border-width:\s*4px;/s,
        /\.teacher-session-loading__message\s*\{[^}]*margin-top:\s*1rem;[^}]*color:\s*var\(--color-text-muted\);/s,
        /\.teacher-login-submit\s*\{[^}]*width:\s*100%;/s,
        /\.teacher-login-error\s*\{[^}]*margin-top:\s*1rem;[^}]*padding:\s*1rem;[^}]*border-radius:\s*8px;[^}]*background:\s*rgba\(239, 68, 68, 0\.15\);[^}]*color:\s*var\(--color-danger\);/s
    ]) {
        assert.match(teacherCss, declaration);
    }
});

test('Teacher vocabulary views keep only data-driven color values inline', () => {
    const templateStart = teacherHtml.indexOf('<!-- View: Editor -->');
    const templateEnd = teacherHtml.indexOf('<!-- View: Quiz Maker -->', templateStart);
    assert.ok(templateStart >= 0 && templateEnd > templateStart, 'Missing bounded vocabulary editor template');
    assert.doesNotMatch(teacherHtml.slice(templateStart, templateEnd), /\sstyle=/,
        'Vocabulary editor template must delegate static presentation to its feature CSS');

    const cardStart = vocabularyStorage.indexOf('    createLibraryCard(');
    const cardEnd = vocabularyStorage.indexOf('    loadLocalVocabulary(', cardStart);
    assert.ok(cardStart >= 0 && cardEnd > cardStart, 'Missing bounded vocabulary card renderer');
    const cardRenderer = vocabularyStorage.slice(cardStart, cardEnd);
    assert.doesNotMatch(cardRenderer, /style="(?:background|color|display|margin)/,
        'Vocabulary card renderer must use classes for fixed presentation');
    assert.match(cardRenderer, /style="--subject-color:\$\{escapeHtml\(subject\.color\)\};"/,
        'User-configured subject color remains a data-driven CSS custom property');
    assert.doesNotMatch(vocabularyWordEditor, /<span style=/,
        'Vocabulary image errors must use the feature-owned error class');

    for (const declaration of [
        /\.vocab-editor-title\s*\{[^}]*margin:\s*0\.35rem 0 0;/s,
        /\.teacher-vocab-source-badge--remote\s*\{[^}]*background:\s*var\(--color-brand\);/s,
        /\.teacher-vocab-source-badge--local\s*\{[^}]*background:\s*var\(--accent-color\);/s,
        /\.teacher-vocab-source-badge--cloud\s*\{[^}]*background:\s*var\(--color-brand-hover\);/s,
        /\.teacher-vocab-id,[\s\S]*?\.teacher-vocab-placement\s*\{[^}]*color:\s*var\(--color-text-muted\);/s,
        /\.teacher-vocab-placement\s*\{[^}]*display:\s*block;[^}]*margin-top:\s*0\.35rem;/s,
        /\.vocab-image-error\s*\{[^}]*color:\s*var\(--color-danger\);/s
    ]) {
        assert.match(teacherCss, declaration);
    }
});

test('Teacher settings keeps layout presentation separate from tab state', () => {
    const templateStart = teacherHtml.indexOf('<template id="teacher-data-management-view-template">');
    const exportStart = teacherHtml.indexOf('id="data-export-section"', templateStart);
    assert.ok(templateStart >= 0 && exportStart > templateStart, 'Missing bounded teacher settings template');
    const settingsTemplate = teacherHtml.slice(templateStart, exportStart);

    assert.doesNotMatch(settingsTemplate, /style="align-items:/,
        'Settings action layout must use its feature class');
    assert.match(settingsTemplate, /class="teacher-settings-grid teacher-settings-grid--actions"/);
    assert.match(settingsTemplate, /id="data-gamification-section"[^>]*style="display: none;"/,
        'Initial settings tab visibility remains runtime state for Task 14');
    assert.match(settingsTemplate, /id="data-calendar-section"[^>]*style="display: none;"/,
        'Initial settings tab visibility remains runtime state for Task 14');
    assert.match(teacherCss, /\.teacher-settings-grid--actions\s*\{[^}]*align-items:\s*end;/s);
});

test('Data Export delegates fixed presentation while retaining calculated runtime state', () => {
    const start = teacherHtml.indexOf('<!-- Export Tab -->');
    const end = teacherHtml.indexOf('<!-- View Data Tab -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded Data Export template');
    const exportTemplate = teacherHtml.slice(start, end);
    const inlineStyles = [...exportTemplate.matchAll(/style="([^"]*)"/g)].map(match => match[1]);

    assert.deepEqual(inlineStyles, [
        'display: none;',
        'display: none;',
        'width: 0%;',
        'display: none;',
        'display: none;'
    ], 'Data Export template must keep only initial visibility and calculated progress inline');
    assert.doesNotMatch(exportTemplate, /<style>|@keyframes/,
        'Data Export animations must be owned by teacher CSS');
    assert.doesNotMatch(dataExportPreviewRenderer, /style=/,
        'Generated Data Export preview markup must use owned classes');
    assert.doesNotMatch(dataExport, /style="/,
        'Generated Data Export feedback must use owned classes');

    for (const runtimeAssignment of [
        /previewSection\.style\.display\s*=\s*'block'/,
        /loadingEl\.style\.display\s*=\s*'block'/,
        /progressBar\.style\.width\s*=\s*`\$\{percent\}%`/,
        /resetSection\.style\.opacity\s*=\s*'1'/,
        /resetSection\.style\.pointerEvents\s*=\s*'auto'/
    ]) {
        assert.match(dataExport, runtimeAssignment);
    }

    for (const declaration of [
        /\.data-export-type-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(280px, 1fr\)\);/s,
        /\.data-export-student-option\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s,
        /\.data-export-loading__progress-bar\s*\{[^}]*height:\s*100%;[^}]*animation:\s*progress-pulse 1\.5s ease-in-out infinite;/s,
        /\.data-export-preview__tables\s*\{[^}]*max-height:\s*500px;/s,
        /\.data-export-runtime-summary\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(150px, 1fr\)\);/s,
        /\.data-export-table\s*\{[^}]*width:\s*100%;[^}]*border-collapse:\s*collapse;/s,
        /\.data-export-preview-error\s*\{[^}]*color:\s*var\(--color-danger\);/s,
        /\.data-export-reset-enabled\s*\{[^}]*color:\s*var\(--color-success\);/s,
        /@keyframes spin\s*\{/,
        /@keyframes progress-pulse\s*\{/
    ]) {
        assert.match(teacherCss, declaration);
    }
});

test('Data Viewer delegates fixed presentation while retaining file and drag state', () => {
    const start = teacherHtml.indexOf('<!-- View Data Tab -->');
    const end = teacherHtml.indexOf('<!-- Reset Tab -->', start);
    assert.ok(start >= 0 && end > start, 'Missing bounded Data Viewer template');
    const viewerTemplate = teacherHtml.slice(start, end);
    const inlineStyles = [...viewerTemplate.matchAll(/style="([^"]*)"/g)].map(match => match[1]);

    assert.deepEqual(inlineStyles, [
        'display: none;',
        'display: none;',
        'display: none;',
        'display: none;',
        'display: none;'
    ], 'Data Viewer template must keep only initial runtime visibility inline');
    assert.doesNotMatch(teacherDataViewer, /style="/,
        'Generated Data Viewer markup must use Viewer-owned classes');

    for (const runtimeAssignment of [
        /fileLoader\.style\.borderColor\s*=\s*'var\(--color-brand\)'/,
        /fileLoader\.style\.background\s*=\s*'rgba\(99, 102, 241, 0\.2\)'/,
        /fileLoader\.style\.borderColor\s*=\s*'var\(--border-color, rgba\(255, 255, 255, 0\.125\)\)'/,
        /fileLoader\.style\.background\s*=\s*'rgba\(15, 23, 42, 0\.3\)'/,
        /content\.style\.display\s*=\s*isActive\s*\?\s*'block'\s*:\s*'none'/,
        /if \(errorDiv\) errorDiv\.style\.display\s*=\s*'none'/,
        /fileInfo\.style\.display\s*=\s*'block'/,
        /errorDiv\.style\.display\s*=\s*'block'/,
        /\$\('#file-info'\)\.style\.display\s*=\s*'none'/,
        /\$\('#file-error'\)\.style\.display\s*=\s*'none'/,
        /\$\('#viewer-summary'\)\.style\.display\s*=\s*'none'/,
        /\$\('#viewer-tables'\)\.style\.display\s*=\s*'none'/,
        /\$\('#viewer-summary'\)\.style\.display\s*=\s*'block'/,
        /\$\('#viewer-tables'\)\.style\.display\s*=\s*'block'/
    ]) {
        assert.match(teacherDataViewer, runtimeAssignment);
    }

    for (const declaration of [
        /\.data-viewer-file-loader\s*\{[^}]*padding:\s*2\.5rem;[^}]*border:\s*2px dashed var\(--color-border\);[^}]*background:\s*rgba\(15, 23, 42, 0\.3\);/s,
        /\.data-viewer-message\s*\{[^}]*margin-top:\s*1\.5rem;[^}]*padding:\s*1rem;/s,
        /\.data-viewer-message--success\s*\{[^}]*background:\s*rgba\(16, 185, 129, 0\.15\);/s,
        /\.data-viewer-message--error\s*\{[^}]*background:\s*rgba\(239, 68, 68, 0\.15\);/s,
        /\.data-viewer-tables-content\s*\{[^}]*max-height:\s*600px;/s,
        /\.data-viewer-runtime-summary\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(150px, 1fr\)\);/s,
        /\.data-viewer-table\s*\{[^}]*width:\s*100%;[^}]*border-collapse:\s*collapse;/s,
        /\.data-viewer-table \.data-viewer-table__numeric\s*\{[^}]*text-align:\s*right;/s,
        /\.data-viewer-table__empty\s*\{[^}]*color:\s*var\(--color-text-muted\);/s
    ]) {
        assert.match(teacherCss, declaration);
    }
});
