// Loaded only when PDF is selected for download; no PDF library enters the teacher shell.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function createAssignmentResultsPdf({ rows, studentIds, kind, className, assignmentTitle, orientation = 'portrait' }) {
    const selected = new Set(studentIds);
    const scopedRows = rows.filter(row => selected.has(row.studentId));
    const doc = new jsPDF({ orientation: orientation === 'landscape' ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    doc.setProperties({ title: assignmentTitle, subject: `Assignment results: ${className}` });
    const width = doc.internal.pageSize.getWidth() - 28;
    doc.setFontSize(16); const titleLines = doc.splitTextToSize(assignmentTitle, width); doc.text(titleLines, 14, 18);
    let y = 20 + titleLines.length * 6;
    doc.setFontSize(10); const scopeLines = doc.splitTextToSize(`${className} | ${new Set(scopedRows.map(r => r.studentId)).size} students selected`, width);
    doc.text(scopeLines, 14, y); y += scopeLines.length * 5 + 3;
    const columns = kind === 'spark' ? ['Student', 'Status', 'Response', 'Automatic check', 'Written review'] : ['Student', 'Activity', 'Status', 'Score', 'Accuracy'];
    const body = scopedRows.map(row => kind === 'spark'
        ? [row.name, row.status, row.response, row.automaticTotal !== '' ? `${row.score} / ${row.automaticTotal}` : '', row.status === 'No work submitted' ? '' : row.needsTeacherReview ? 'Needed' : 'Not needed']
        : [row.name, row.activity, row.status, row.score, row.accuracy]);
    autoTable(doc, { head: [columns], body, startY: y, margin: { left: 14, right: 14 },
        styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 2 },
        headStyles: { fillColor: [45, 62, 80] },
        didDrawPage: () => { doc.setFontSize(8); doc.text('Missing work has no score. Automatic checks do not grade written answers.', 14, doc.internal.pageSize.getHeight() - 8); }
    });
    return doc.output('blob');
}
