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
    const links = [...template.head.querySelectorAll('link[rel="stylesheet"]')];
    await Promise.all(links.map(link => new Promise((resolve, reject) => {
        let settled = false;
        const finish = error => {
            if (settled) return; settled = true; clearTimeout(timeout);
            link.removeEventListener('load', loaded); link.removeEventListener('error', failed);
            if (error) reject(error); else resolve();
        };
        const loaded = () => finish();
        const failed = () => finish(new Error('The student screen styles did not load. Try again.'));
        const timeout = setTimeout(failed, 8000);
        link.addEventListener('load', loaded); link.addEventListener('error', failed);
        link.href = new URL(link.getAttribute('href'), response.url).href;
        document.head.append(link);
        if (link.sheet) finish();
    })));
    // Keep the themed loading status visible until every required style is ready.
    document.body.replaceChildren(...template.body.childNodes);
    document.body.className = 'student-site teacher-unit-preview-runtime';
    // Only the selected unit and its activities belong to this embedded screen.
    const helpBar = document.querySelector('.student-top-bar');
    const helpContext = helpBar?.querySelector('.student-sidebar-context');
    if (helpContext) { helpContext.replaceChildren(); helpBar.replaceChildren(helpContext); }
    document.querySelectorAll('.app-header, aside:not(.student-top-bar)').forEach(node => node.remove());
    document.querySelectorAll('.view').forEach(view => { if (!views.includes(view.id)) view.remove(); });
}
