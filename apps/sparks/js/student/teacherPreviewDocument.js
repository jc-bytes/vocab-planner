import '../../css/teacher-preview-runtime.css';
import '../icons.js';

export async function mountPreviewDocument(views) {
    // Read the shipped student document, including its styles and activity markup.
    // Never run its login/bootstrap scripts in the teacher's preview frame.
    const response = await fetch(new URL('student.html', document.baseURI));
    if (!response.ok) throw new Error('The student screen is unavailable.');
    const template = new DOMParser().parseFromString(await response.text(), 'text/html');
    // Keep the preview shell's original CSP; imported student bootstrap/policy never runs.
    template.querySelectorAll('script, meta[http-equiv="Content-Security-Policy"]').forEach(node => node.remove());
    document.head.append(...template.head.querySelectorAll('link[rel="stylesheet"]'));
    document.body.replaceChildren(...template.body.childNodes);
    document.body.className = 'student-site teacher-unit-preview-runtime';
    // Only the selected unit and its activities belong to this embedded screen.
    const helpBar = document.querySelector('.student-top-bar');
    const helpContext = helpBar?.querySelector('.student-sidebar-context');
    if (helpContext) { helpContext.replaceChildren(); helpBar.replaceChildren(helpContext); }
    document.querySelectorAll('.app-header, aside:not(.student-top-bar)').forEach(node => node.remove());
    document.querySelectorAll('.view').forEach(view => { if (!views.includes(view.id)) view.remove(); });
}
