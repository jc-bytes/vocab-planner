import JSZip from 'jszip';
import { Packer } from 'docx';
import { buildQuizWordDocument } from '../js/quizMakerWordExportMethods.js';
import { getLevelProgress, getStudentExperience } from '../js/student/studentExperience.js';

function assertIncludes(text, needle, label) {
    if (text.includes(needle)) return;
    throw new Error(`${label}: expected generated DOCX XML to include "${needle}"`);
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

function runStudentExperienceTests() {
    const experience = getStudentExperience({
        units: {
            'technology:week-1': {
                unitId: 'week-1',
                scores: {
                    matching: { score: 100, isComplete: true },
                    quiz: { score: 80, isComplete: false },
                    flashcards: { score: 100 }
                }
            },
            'Week 1': {
                unitId: 'week-1',
                scores: {
                    matching: { score: 100, isComplete: true }
                }
            },
            'technology:week-2': {
                unitId: 'week-2',
                scores: {
                    matching: { score: 100, isComplete: true },
                    quiz: { score: 100, isComplete: true },
                    flashcards: { score: 100, isComplete: true }
                }
            }
        }
    });

    if (experience.completedCount !== 5) throw new Error('XP should count unique completed activities.');
    if (experience.totalXp !== 100) throw new Error('Five completed activities should earn 100 XP.');
    if (experience.level !== 2) throw new Error('A student should reach level 2 at 100 XP.');
    if (experience.xpIntoLevel !== 0) throw new Error('XP progress should reset at a new level.');
    if (experience.xpForNextLevel !== 150) throw new Error('Level 2 should require 150 XP.');

    const progressed = getLevelProgress(450);
    if (progressed.level !== 4 || progressed.xpIntoLevel !== 0 || progressed.xpForNextLevel !== 250) {
        throw new Error('Progressive XP thresholds should be 100, 150, 200, 250...');
    }
    if (progressed.title !== 'Builder') throw new Error('Levels 3-5 should use the Builder title.');

    const authoritative = getStudentExperience({ totalXp: 249, units: {} });
    if (authoritative.level !== 2 || authoritative.xpIntoLevel !== 149) {
        throw new Error('Supabase total XP should be authoritative when present.');
    }
}

await runDocxTests();
runStudentExperienceTests();

console.log('Package refactor tests passed.');
