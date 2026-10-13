import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const renderSource = await readFile(new URL('../js/quizMakerRenderMethods.js', import.meta.url), 'utf8');
const cardSource = await readFile(new URL('../js/quizMakerQuestionCardRenderer.js', import.meta.url), 'utf8');
const quizCss = await readFile(new URL('../css/teacherQuiz.css', import.meta.url), 'utf8');

test('Quiz Maker delegates pointer reordering to SortableJS across preview pages', () => {
    assert.match(renderSource, /import Sortable from 'sortablejs'/);
    assert.match(renderSource, /group: 'quiz-maker-questions'/);
    assert.match(renderSource, /container\.querySelectorAll\('\.doc-q-card'\)/);
    assert.match(renderSource, /destroyQuestionSortables\(\)/);
    assert.doesNotMatch(renderSource, /handleDragStart|handleDragOver|handleDrop|handleDragEnd/);
    assert.doesNotMatch(renderSource, /\.draggable\s*=|addEventListener\('drag/);
});

test('Quiz Maker offers bounded button reordering that stays out of printed quizzes', () => {
    assert.match(cardSource, /class="quiz-question-move-up"/);
    assert.match(cardSource, /class="quiz-question-move-down"/);
    assert.match(cardSource, /aria-label="Move question \$\{questionNumber\} up"/);
    assert.match(cardSource, /reorder\.canMoveUp === false \? 'disabled'/);
    assert.match(renderSource, /\.focus\(\)/);
    assert.match(quizCss, /@media print[\s\S]*\.quiz-question-reorder\s*\{[\s\S]*display: none/);
});
