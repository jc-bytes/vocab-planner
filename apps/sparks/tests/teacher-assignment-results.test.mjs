import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentResultRows, assignmentResultsCsv, assignmentStatus } from '../js/teacherAssignmentResults.js';

test('review preserves zero results and represents absent work without an invented score', () => {
    const rows = assignmentResultRows('vocabulary', [{ studentId: 'a', name: 'A', activity: 'matching', score: 0, accuracy: 0, complete: false }], [{ studentId: 'a', name: 'A' }, { studentId: 'b', name: 'B' }]);
    assert.equal(rows[0].score, 0); assert.equal(rows[0].accuracy, 0);
    assert.equal(rows[1].score, ''); assert.equal(rows[1].status, 'No work submitted');
});
test('scoped CSV exports only selected students, exact content, and neutralizes spreadsheet formulas', () => {
    const rows = assignmentResultRows('spark', [{ student_id: 'a', response: ' =SUM(1,2)\n"quoted"', evaluation: { correct: 0, automaticTotal: 2, needsTeacherReview: true } }], [{ studentId: 'a', name: 'A' }, { studentId: 'b', name: 'B' }]);
    const csv = assignmentResultsCsv({ rows, studentIds: ['a'], kind: 'spark', className: '6A', assignmentTitle: 'My Spark', includeDates: false });
    assert.match(csv, /"a","A","Submitted"/); assert.ok(!csv.includes('"b","B"'));
    assert.ok(csv.includes('"\' =SUM(1,2)\n""quoted"""')); assert.match(csv, /"0","2","Yes"/);
    assert.ok(!csv.includes('Updated at'));
});
test('assignment statuses distinguish release, response close, and withdrawal', () => {
    const assignment = { release_at: '2026-09-10T00:00:00Z', close_at: '2026-09-12T00:00:00Z' };
    assert.equal(assignmentStatus(assignment, Date.parse('2026-09-09')), 'Scheduled');
    assert.equal(assignmentStatus(assignment, Date.parse('2026-09-11')), 'Available');
    assert.equal(assignmentStatus(assignment, Date.parse('2026-09-13')), 'Closed');
    assert.equal(assignmentStatus({ ...assignment, withdrawn: true }, 0), 'Withdrawn');
});

test('PDF contains only selected students and preserves missing scores', async () => {
    const { createAssignmentResultsPdf } = await import('../js/teacherAssignmentPdf.js');
    const rows = assignmentResultRows('vocabulary', [{ studentId: 'a', name: 'Selected student', activity: 'matching', score: 0 }], [{ studentId: 'b', name: 'Excluded student' }]);
    const blob = createAssignmentResultsPdf({ rows, studentIds: ['a'], kind: 'vocabulary', className: 'Technology 6A', assignmentTitle: 'Vocabulary assessment', orientation: 'landscape' });
    const pdf = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    assert.ok(pdf.startsWith('%PDF-')); assert.ok(pdf.includes('Selected student')); assert.ok(!pdf.includes('Excluded student'));
    assert.ok(pdf.includes('Vocabulary assessment')); assert.ok(pdf.includes('Technology 6A'));
});

test('written-only Spark responses have no invented automatic score', () => {
    const rows = assignmentResultRows('spark', [{ student_id: 'a', response: '<script>plain text</script>', evaluation: { correct: 0, automaticTotal: 0, needsTeacherReview: true } }], []);
    assert.equal(rows[0].score, ''); assert.equal(rows[0].automaticTotal, ''); assert.equal(rows[0].needsTeacherReview, true);
});

test('legacy written Spark responses still need review without automatic evaluation', () => {
    const [row] = assignmentResultRows('spark', [{ student_id: 'a', response: 'My written explanation.' }], []);
    assert.equal(row.needsTeacherReview, true); assert.equal(row.score, '');
});
