// Home uses the same class workspace and permissions as class navigation.
export function installTeacherOverviewMethods(TeacherManager) {
    TeacherManager.prototype.loadTeacherOverview = function (options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        return this.showClassHome(options);
    };
}
