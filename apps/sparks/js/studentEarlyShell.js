try {
    if (localStorage.getItem('student_sidebar_collapsed') === 'true') {
        document.querySelector('.app-container')?.classList.add('student-sidebar-collapsed');
    }
    if (localStorage.getItem('was_logged_in') === 'true') {
        const appContainer = document.querySelector('.app-container');
        const studentShell = document.getElementById('student-tab-shell');
        const routePath = String(window.location.hash || '#/menu')
            .replace(/^#\/?/, '')
            .split('?')[0];
        const initialSection = routePath === 'sparks'
            ? 'sparks'
            : routePath === 'arcade'
                ? 'arcade'
                : routePath === 'units' || routePath.startsWith('unit/')
                    ? 'vocabulary'
                    : 'today';
        appContainer?.classList.add('student-session-loading');
        if (studentShell) {
            studentShell.classList.remove('hidden');
            studentShell.dataset.sessionReserved = 'true';
            studentShell.setAttribute('aria-hidden', 'true');
            studentShell.inert = true;
            studentShell.querySelectorAll('.student-tab').forEach(tab => {
                const isActive = tab.dataset.section === initialSection;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                tab.tabIndex = isActive ? 0 : -1;
            });
            const mobileLabel = document.getElementById('student-mobile-section-label');
            const activeTab = studentShell.querySelector(`.student-tab[data-section="${initialSection}"]`);
            if (mobileLabel && activeTab) {
                mobileLabel.textContent = activeTab.textContent.trim().replace(/\s+/g, ' ');
            }
        }
    }
} catch {
    // Storage can be unavailable in privacy modes; the normal loading view still works.
}
