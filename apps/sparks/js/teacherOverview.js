// Home uses the same class workspace and permissions as class navigation.
export function installTeacherOverviewMethods(TeacherManager) {
    TeacherManager.prototype.loadTeacherOverview = function () {
        if (!this.ensureAuthenticated(false)) return;
        return this.showClassHome();
    };
}
