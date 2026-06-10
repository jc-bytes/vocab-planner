import JSZip from 'jszip';
import { Packer } from 'docx';
import { evaluateFormulaValue, valueToNumber } from '../js/activitySpreadsheetFormula.js';
import { buildQuizWordDocument } from '../js/quizMakerWordExportMethods.js';

function assertEqual(actual, expected, label) {
    if (Object.is(actual, expected)) return;
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertNear(actual, expected, label) {
    if (Math.abs(actual - expected) < 0.000001) return;
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertIncludes(text, needle, label) {
    if (text.includes(needle)) return;
    throw new Error(`${label}: expected generated DOCX XML to include "${needle}"`);
}

function runFormulaTests() {
    const data = [
        ['Item', 'Value A', 'Value B', 'Total'],
        ['Example 1', '4', '3', '=B2+C2'],
        ['Example 2', '8', '2', '=B3+C3'],
        ['Example 3', '1', '5', '=B4+C4']
    ];

    assertEqual(valueToNumber('12', data), 12, 'plain number');
    assertEqual(valueToNumber('1,200', data), 1200, 'comma number');
    assertEqual(valueToNumber('', data), null, 'blank number');
    assertEqual(valueToNumber('not a number', data), null, 'nonnumeric text');
    assertEqual(evaluateFormulaValue('=B2+C2', data), 7, 'formula addition');
    assertEqual(evaluateFormulaValue('B2*C2', data), 12, 'formula without equals');
    assertNear(evaluateFormulaValue('=(B2+C2)/2', data), 3.5, 'parenthesized formula');
    assertEqual(evaluateFormulaValue('=SUM(B2:B4)', data), 13, 'SUM range');
    assertNear(evaluateFormulaValue('=AVERAGE(B2:C3)', data), 4.25, 'AVERAGE range');
    assertEqual(evaluateFormulaValue('=D2*2', data), 14, 'nested formula reference');
    assertEqual(evaluateFormulaValue('=SUM(', data), null, 'invalid formula');
    assertEqual(valueToNumber('=A1', [['=A1']]), 0, 'circular formula fallback');
}

function createQuizFixture() {
    const sections = [
        {
            type: 'mc',
            title: 'Multiple Choice',
            instructions: 'Choose the best answer.',
            questions: [{
                type: 'mc',
                prompt: 'Which part stores data?',
                points: 1,
                options: ['CPU', 'Keyboard', 'Storage', 'Monitor']
            }]
        },
        {
            type: 'sata',
            title: 'Select All That Apply',
            instructions: 'Select every correct answer.',
            questions: [{
                type: 'sata',
                prompt: 'Select input devices.',
                points: 2,
                options: [{ text: 'Keyboard' }, { text: 'Mouse' }, { text: 'Speaker' }]
            }]
        },
        {
            type: 'tf',
            title: 'True or False',
            instructions: 'Write T or F.',
            questions: [{ type: 'tf', prompt: 'A spreadsheet uses cells.', points: 1 }]
        },
        {
            type: 'matching_section',
            title: 'Matching',
            instructions: 'Match each term.',
            questions: [{
                type: 'matching_section',
                prompt: 'Match terms.',
                points: 2,
                pairs: [{ term: 'Algorithm', def: 'Step-by-step plan' }]
            }]
        },
        {
            type: 'short',
            title: 'Short Answer',
            instructions: 'Answer in complete sentences.',
            questions: [{ type: 'short', prompt: 'Explain why formulas are useful.', points: 2 }]
        },
        {
            type: 'synonym',
            title: 'Synonyms & Antonyms',
            instructions: 'Choose the best word.',
            questions: [{
                type: 'synonym',
                prompt: 'Choose a synonym for fix.',
                points: 1,
                options: ['Repair', 'Break', 'Ignore']
            }]
        },
        {
            type: 'wordsearch',
            title: 'Word Search',
            instructions: 'Find all words.',
            questions: [{
                type: 'wordsearch',
                prompt: 'Find vocabulary words.',
                points: 3,
                grid: [['C', 'P', 'U'], ['R', 'A', 'M']],
                words: ['CPU', 'RAM']
            }]
        },
        {
            type: 'crossword',
            title: 'Crossword Puzzle',
            instructions: 'Use the clues.',
            questions: [{
                type: 'crossword',
                prompt: 'Complete the crossword.',
                points: 3,
                grid: [[{ letter: 'C' }, {}], [{}, { letter: 'P' }]],
                clues: {
                    across: [{ number: 1, clue: 'Computer brain' }],
                    down: [{ number: 2, clue: 'Programming plan' }]
                }
            }]
        }
    ];

    return {
        meta: {
            title: 'Technology Quiz',
            instructions: 'Use black or blue pen.',
            schoolName: 'ACADEMIA INTERNACIONAL DE DAVID',
            teacherName: 'Porfirio Rios',
            grade: '6',
            rubric: [
                { title: 'Date and Name:', desc: 'Complete name and date.', points: 2 },
                { title: 'Content:', desc: 'Correct answers.', points: 15 }
            ]
        },
        groupQuestionsByType() {
            return sections;
        }
    };
}

async function runDocxTests() {
    const document = buildQuizWordDocument(createQuizFixture());
    const buffer = await Packer.toBuffer(document);
    if (!buffer || buffer.length < 1000) {
        throw new Error(`DOCX buffer is unexpectedly small: ${buffer?.length || 0}`);
    }

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
        throw new Error('Generated DOCX is missing word/document.xml');
    }

    assertIncludes(documentXml, 'Technology Quiz', 'DOCX title');
    assertIncludes(documentXml, 'Use black or blue pen.', 'DOCX instructions');
    assertIncludes(documentXml, 'Date and Name:', 'DOCX rubric');
    assertIncludes(documentXml, 'Which part stores data?', 'DOCX multiple choice');
    assertIncludes(documentXml, 'Algorithm', 'DOCX matching');
    assertIncludes(documentXml, 'Find vocabulary words.', 'DOCX word search');
    assertIncludes(documentXml, 'Complete the crossword.', 'DOCX crossword');
}

runFormulaTests();
await runDocxTests();

console.log('Package refactor tests passed.');
