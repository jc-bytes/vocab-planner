function csvCell(value) {
    const text = String(value ?? '');
    return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
export function showClassroomResults(root, title, results) {
    root.querySelector('[data-class-results]')?.remove();
    const section = document.createElement('section'); section.dataset.classResults = '';
    if (!results.length) { section.textContent = 'No activity results yet.'; root.append(section); return; }
    const columns = ['Student', 'Activity', 'Score', 'Complete', 'Accuracy'];
    const rows = results.map(r => [r.name, r.activity, r.score, r.complete ? 'Yes' : 'No', r.accuracy ?? '']);
    const table = document.createElement('table'); const caption = document.createElement('caption'); caption.textContent = title;
    table.append(caption);
    for (const [index, values] of [columns, ...rows].entries()) {
        const row = document.createElement('tr');
        for (const value of values) { const cell = document.createElement(index ? 'td' : 'th'); cell.textContent = String(value); row.append(cell); }
        table.append(row);
    }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn secondary-btn'; button.textContent = 'Export results';
    button.addEventListener('click', () => {
        const csv = [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = 'class-assignment-results.csv'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    section.append(table, button); root.append(section);
}
