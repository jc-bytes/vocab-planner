import { node, action, inputField, selectField, createAssignmentDialog } from './teacherAssignmentUi.js';
import { assignmentResultsCsv } from './teacherAssignmentResults.js';

export function openAssignmentExport({ rows, kind, className, assignmentTitle, isCurrent, onClose }) {
    const urls = new Set(); let busy = false;
    const view = createAssignmentDialog('Export assignment results', () => {
        for (const url of urls) URL.revokeObjectURL(url);
        urls.clear(); onClose?.();
    });
    view.body.append(node('p', `${className} · ${assignmentTitle}`), node('p', kind === 'vocabulary-completion'
        ? 'Each required or recorded activity gets a row with its vocabulary completion total. Untouched work has no score. Current and historical members are labeled separately.'
        : 'Each activity or response gets its own row. Missing work is marked without a score.'));
    const form = node('form');
    const format = selectField(form, 'Format', 'format', [['csv', 'Spreadsheet (CSV; opens in Excel)'], ['pdf', 'PDF report']]);
    const people = new Map(rows.map(row => [row.studentId, row.name]));
    const choices = node('fieldset'); choices.append(node('legend', 'Students'));
    for (const [id, name] of people) {
        const label = node('label', name); const input = node('input'); input.type = 'checkbox'; input.value = id; input.checked = true;
        label.prepend(input); choices.append(label);
    }
    const count = node('p'); count.setAttribute('role', 'status');
    const selected = () => [...choices.querySelectorAll('input:checked')].map(input => input.value);
    const updateCount = () => { count.textContent = `${selected().length} of ${people.size} students selected`; download.disabled = busy || selected().length === 0; };
    const all = action('Select all', () => { for (const input of choices.querySelectorAll('input')) input.checked = true; updateCount(); });
    const none = action('Clear selection', () => { for (const input of choices.querySelectorAll('input')) input.checked = false; updateCount(); });
    form.append(all, none, choices, count);
    const dates = inputField(form, 'Include update times', 'dates', 'checkbox'); dates.checked = true;
    const pdfOptions = node('div'); pdfOptions.hidden = true;
    const orientation = selectField(pdfOptions, 'PDF page layout', 'orientation', [['portrait', 'Portrait'], ['landscape', 'Landscape']]); form.append(pdfOptions);
    const feedback = node('p'); feedback.setAttribute('role', 'status'); form.append(feedback);
    const download = action('Download CSV', async () => {
        if (!isCurrent()) { view.close(); return; }
        if (busy) return;
        const studentIds = selected(); if (!studentIds.length) return;
        const chosenFormat = format.value; const selectedOrientation = orientation.value; const includeDates = dates.checked;
        busy = true; download.disabled = true; feedback.textContent = 'Preparing download…';
        try {
            const blob = chosenFormat === 'pdf'
                ? (await import('./teacherAssignmentPdf.js')).createAssignmentResultsPdf({ rows, studentIds, kind, className, assignmentTitle, orientation: selectedOrientation })
                : new Blob([assignmentResultsCsv({ rows, studentIds, kind, className, assignmentTitle, includeDates })], { type: 'text/csv;charset=utf-8' });
            if (!isCurrent() || !view.dialog.isConnected) return;
            const url = URL.createObjectURL(blob); urls.add(url);
            const link = node('a'); link.href = url; link.download = `assignment-results.${chosenFormat}`; document.body.append(link); link.click(); link.remove();
            setTimeout(() => { URL.revokeObjectURL(url); urls.delete(url); }, 1000);
            feedback.textContent = 'Download prepared.';
        } catch (error) { if (isCurrent() && view.dialog.isConnected) feedback.textContent = error.message || 'Could not export results.'; }
        finally { busy = false; if (isCurrent() && view.dialog.isConnected) updateCount(); }
    }, true);
    format.addEventListener('change', () => {
        const pdf = format.value === 'pdf'; dates.parentElement.hidden = pdf; pdfOptions.hidden = !pdf;
        download.textContent = pdf ? 'Download PDF' : 'Download CSV';
    });
    choices.addEventListener('change', updateCount); updateCount(); view.body.append(form); view.footer.append(download);
    return view;
}
