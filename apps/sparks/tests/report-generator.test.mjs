import assert from 'node:assert/strict';
import test from 'node:test';
import { jsPDF } from 'jspdf';

import { imageDB } from '../js/db.js';
import { ReportGenerator } from '../js/reportGenerator.js';

test('report metadata normalizes legacy profile, subject, trimester, and filename values', () => {
    const profile = { name: 'Ada Lovelace', grade_level: 7, section_letter: 'B' };
    const vocab = { name: 'Programming & Logic', subject_slug: 'computer-science', trimester_key: 'IIT' };

    assert.deepEqual(ReportGenerator.getStudentInfo(profile), {
        fullName: 'Ada Lovelace', grade: 7, group: 'B'
    });
    assert.equal(ReportGenerator.getSubjectName(vocab), 'Computer Science');
    assert.equal(ReportGenerator.buildWordHuntFileName(profile, vocab), 'AdaLovelace-7b-t2-ProgrammingLogic.pdf');
    assert.equal(ReportGenerator.buildFinalReportFileName(profile, vocab), 'AdaLovelace-7b-t2-ProgrammingLogic-FinalReport.pdf');
    assert.equal(
        ReportGenerator.buildActivityReportFileName(profile, vocab, 'synonym-antonym'),
        'AdaLovelace-7b-t2-ProgrammingLogic-SynonymAntonym.pdf'
    );
});

test('report activity rows preserve completion, score bounds, evidence, and summary rules', () => {
    const normalized = ReportGenerator.normalizeActivityReportScoreData({
        score: 120,
        accuracy: 88,
        details: { summary: 'Completed work', evidence: { correctCount: 8 } },
        evidence: { attemptedCount: 10 }
    });
    assert.equal(normalized.details, 'Completed work');
    assert.deepEqual(normalized.evidence, { correctCount: 8, attemptedCount: 10, accuracy: 88 });

    const rows = ReportGenerator.getFinalReportActivityRows({
        matching: { score: 120, isComplete: true, details: ['Three', 'rounds'] },
        quiz: { score: 60, isComplete: false, details: { correct: 6, total: 10 } }
    });
    const matching = rows.find(row => row.key === 'matching');
    const quiz = rows.find(row => row.key === 'quiz');
    assert.deepEqual(
        { score: matching.score, status: matching.status, details: matching.details },
        { score: 100, status: 'Completed', details: 'Three, rounds' }
    );
    assert.equal(quiz.status, 'In progress');
    assert.match(quiz.details, /correct: 6/);
    assert.deepEqual(ReportGenerator.getFinalReportSummary(rows, [{ word: 'loop' }]), {
        started: 2,
        completed: 1,
        average: 80,
        wordHuntWords: 1
    });
});

test('report PDF artifact renderers preserve appendices and reject incomplete exports', () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    assert.equal(ReportGenerator.drawWordSearchArtifact(pdf, { grid: [] }), false);
    assert.equal(ReportGenerator.drawWordSearchArtifact(pdf, {
        grid: [['A', 'B'], ['C', 'D']],
        foundWords: ['AB'],
        wordPositions: [{ word: 'AB', positions: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
    }), true);
    assert.equal(pdf.getNumberOfPages(), 2);
    assert.ok(pdf.output('arraybuffer').byteLength > 500);

    assert.throws(() => ReportGenerator.generateActivityReport(
        { name: 'Student' },
        { name: 'Unit' },
        'quiz',
        { score: 70, isComplete: false }
    ), /Only completed activities/);
});

test('Word Hunt row construction keeps saved text when no image is available', async () => {
    const originalLoader = ReportGenerator.loadWordHuntImageBlob;
    ReportGenerator.loadWordHuntImageBlob = async () => null;
    try {
        const rows = await ReportGenerator.buildWordHuntPdfRows('Unit', [{ word: 'algorithm' }], {
            wordHunt: {
                algorithm: {
                    definition: 'A sequence of steps used to solve a problem.',
                    exampleOne: 'The program follows an algorithm.',
                    exampleTwo: 'We designed the steps before coding.'
                }
            }
        });
        assert.equal(rows.length, 1);
        assert.equal(rows[0].word, 'algorithm');
        assert.equal(rows[0].imageDataUrl, '');
        assert.equal(rows[0].imageSize, null);
        assert.match(rows[0].entry.definition, /sequence of steps/);
    } finally {
        ReportGenerator.loadWordHuntImageBlob = originalLoader;
    }
});

test('Word Hunt image access forwards the active owner to browser storage', async () => {
    const original = {
        getDrawing: imageDB.getDrawing,
        getAllKeys: imageDB.getAllKeys
    };
    const calls = [];
    imageDB.getDrawing = async (...args) => {
        calls.push(['drawing', ...args]);
        return null;
    };
    imageDB.getAllKeys = async options => {
        calls.push(['keys', options]);
        return ['Unit_alpha', 'Other_beta'];
    };
    try {
        await ReportGenerator.loadWordHuntImageBlob('Unit', 'alpha', {}, { ownerUserId: 'student-1' });
        assert.deepEqual(await ReportGenerator.getWordsFromImageDB('Unit', { ownerUserId: 'student-1' }), ['alpha']);
        assert.deepEqual(calls, [
            ['drawing', 'Unit', 'alpha', { ownerUserId: 'student-1' }],
            ['keys', { ownerUserId: 'student-1' }]
        ]);
    } finally {
        Object.assign(imageDB, original);
    }
});
