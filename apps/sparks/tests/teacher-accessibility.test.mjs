import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const teacherHtml = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');

test('teacher editor fields have explicit accessible labels', () => {
    const fieldIds = [
        'quiz-title-input',
        'quiz-school-input',
        'quiz-teacher-input',
        'quiz-grade-input',
        'quiz-instructions-input',
        'quiz-font-select',
        'word-input',
        'pos-input',
        'def-input',
        'example-input',
        'image-input'
    ];

    for (const id of fieldIds) {
        assert.match(teacherHtml, new RegExp(`<label[^>]+for=["']${id}["']`), `${id} needs an explicit label`);
    }
});
