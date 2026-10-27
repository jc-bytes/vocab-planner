// Flow/layout fixtures represent returning students. Guide interaction has its
// own acceptance checks; keep the help control available without automatic modals.
export async function seedReturningStudentGuidePreferences(page, ownerUserId) {
    await page.addInitScript(owner => {
        for (const type of ['main-menu-view', 'vocab-selection-view', 'student-sparks-view', 'activity-menu-view', 'activity-view', 'arcade-view']) {
            const key = `student:v2:${encodeURIComponent(owner)}:${encodeURIComponent(`ember-guide:screen:${type}`)}`;
            localStorage.setItem(key, JSON.stringify({ introduced: true, skipped: true }));
        }
    }, ownerUserId);
}
