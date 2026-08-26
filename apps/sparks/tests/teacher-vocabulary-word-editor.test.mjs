import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
    buildVocabularyWord,
    getVocabularyDataIssues,
    parseVocabularyRelationList,
    validateVocabularyWord
} from '../js/teacherVocabularyWordModel.js';

const teacherHtml = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');
const wordEditorSource = await readFile(new URL('../js/teacherVocabularyWordEditorMethods.js', import.meta.url), 'utf8');

test('word editor exposes every canonical vocabulary field and removes the unused image path', () => {
    for (const id of [
        'word-input',
        'def-input',
        'example-input',
        'difficulty-input',
        'synonyms-input',
        'antonyms-input'
    ]) {
        assert.match(teacherHtml, new RegExp(`id="${id}"`), `Missing #${id}`);
    }

    assert.doesNotMatch(teacherHtml, /id="image-input"/);
    assert.doesNotMatch(wordEditorSource, /word-image-path/);
    assert.match(teacherHtml, /<option value="">Not specified<\/option>/);
});

test('relation inputs become clean unique arrays', () => {
    assert.deepEqual(
        parseVocabularyRelationList('result, outcome\nResult; finding'),
        ['result', 'outcome', 'finding']
    );
    assert.deepEqual(parseVocabularyRelationList([' output ', '', 'Output', 'result']), ['output', 'result']);
});

test('new words save canonical fields without invented part of speech or image data', () => {
    const word = buildVocabularyWord({
        word: 'algorithm',
        definition: 'A sequence of steps used to solve a problem.',
        example: 'The algorithm sorts the values.',
        difficulty: '2',
        synonyms: 'procedure, process',
        antonyms: '',
        partOfSpeech: '',
        wordHunt: true
    });

    assert.deepEqual(word, {
        word: 'algorithm',
        definition: 'A sequence of steps used to solve a problem.',
        example: 'The algorithm sorts the values.',
        difficulty: 2,
        synonyms: ['procedure', 'process'],
        antonyms: [],
        wordHunt: true
    });
});

test('editing preserves legacy image data without keeping a blank part-of-speech property', () => {
    const word = buildVocabularyWord({
        existingWord: { image: 'legacy/router.png', part_of_speech: 'noun', custom: 'kept' },
        word: 'router',
        definition: 'A device that directs network traffic.',
        example: 'The router connected the classroom computers.',
        difficulty: 1,
        synonyms: ['gateway'],
        antonyms: [],
        partOfSpeech: '',
        wordHunt: false
    });

    assert.equal(word.image, 'legacy/router.png');
    assert.equal(word.custom, 'kept');
    assert.equal(Object.hasOwn(word, 'part_of_speech'), false);
});

test('word validation rejects duplicates and examples missing from an enabled Fill in Blank activity', () => {
    const words = [{ word: 'Router', definition: 'Connects networks.', example: 'The router sends traffic.' }];

    assert.equal(validateVocabularyWord({
        draft: { word: ' router ', definition: 'Another definition.', example: 'Another example.' },
        words,
        editingIndex: -1,
        enabledActivityIds: []
    }), 'A word named "router" already exists in this vocabulary.');

    assert.equal(validateVocabularyWord({
        draft: { word: 'switch', definition: 'Connects devices.', example: '' },
        words,
        editingIndex: -1,
        enabledActivityIds: ['fill-in-blank']
    }), 'Example is required while Fill in Blank is enabled.');
});

test('readiness reports duplicate words, missing examples, and insufficient relationship data', () => {
    const issues = getVocabularyDataIssues({
        words: [
            { word: 'Input', definition: 'Data entered.', example: '', synonyms: ['entry'], antonyms: ['output'] },
            { word: 'input', definition: 'A repeated word.', example: 'Input enters a program.', synonyms: ['source'] },
            { word: 'Result', definition: 'The outcome.', example: 'The result appears.', synonyms: ['outcome'] }
        ],
        enabledActivityIds: ['fill-in-blank', 'synonym-antonym']
    });

    assert.ok(issues.some(issue => issue.id === 'duplicate-words'));
    assert.ok(issues.some(issue => issue.id === 'missing-examples'));
    assert.ok(issues.some(issue => issue.id === 'synonym-antonym-readiness' && /3\/4 synonyms/.test(issue.message)));
});
