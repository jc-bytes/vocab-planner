import { $ } from './main.js';

const teacherDataDashboardViewMethods = {
    async showDataManagementView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-data-management-view');
        this.loadSubjectSettings();
        this.loadGamificationSettings();
        this.loadSchoolCalendarSettings();
        if (this.allStudentData.length === 0) {
            await this.fetchAllStudentProgress();
        }
        // Initialize data viewer if not already done
        if (!this.dataViewerInitialized) {
            this.initDataViewer();
        }
        this.initExportListeners();
        this.populateExportGradeSelect();
        this.switchDataTab(options.tab || 'subjects');
    },

    async loadDashboardData() {
        // Ensure student data is loaded
        if (this.allStudentData.length === 0) {
            await this.fetchAllStudentProgress();
        }

        // Populate grade filter dropdown
        this.populateDashboardGradeFilter();

        // Get filtered data based on selected grade
        const filteredData = this.getDashboardFilteredData();

        // Load summary stats
        const totalStudents = filteredData.length;
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const activeStudents = filteredData.filter(s => {
            const lastActive = this.getStudentUpdatedTime(s);
            return lastActive > sevenDaysAgo;
        }).length;

        const totalCoins = filteredData.reduce((sum, s) => {
            const coins = s.coinData?.balance || s.coins || 0;
            return sum + coins;
        }, 0);
        const avgCoins = totalStudents > 0 ? Math.round(totalCoins / totalStudents) : 0;

        // Update summary cards
        $('#dashboard-total-students').textContent = totalStudents;
        $('#dashboard-active-students').textContent = activeStudents;
        $('#dashboard-avg-coins').textContent = avgCoins.toLocaleString();

        // Load vocabulary count
        try {
            const { cloudVocabs, remoteVocabs, localVocabs } = await this.getTeacherLibrary();
            $('#dashboard-vocab-count').textContent = cloudVocabs.length + remoteVocabs.length + localVocabs.length;
        } catch (err) {
            console.error('Error loading vocab count:', err);
            $('#dashboard-vocab-count').textContent = '--';
        }

        // Load charts
        await this.renderDashboardCharts();
        this.renderRecentActivity();
    },

    populateDashboardGradeFilter() {
        const gradeFilter = $('#dashboard-grade-filter');
        if (!gradeFilter) return;

        // Get unique grades from student data (grade is in studentProfile.grade)
        const grades = new Set();
        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            const grade = profile.grade || '';
            if (grade) grades.add(grade);
        });

        // Sort grades (handle both numeric and string grades)
        const sortedGrades = Array.from(grades).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a).localeCompare(String(b));
        });

        // Preserve current selection
        const currentValue = gradeFilter.value;

        // Clear and rebuild options
        gradeFilter.innerHTML = '<option value="">All Grades</option>';
        sortedGrades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = `Grade ${grade}`;
            gradeFilter.appendChild(option);
        });

        // Restore selection if still valid
        if (currentValue && sortedGrades.includes(currentValue)) {
            gradeFilter.value = currentValue;
        }
    },

    getDashboardFilteredData() {
        const gradeFilter = $('#dashboard-grade-filter');
        const selectedGrade = gradeFilter?.value || '';

        if (!selectedGrade) {
            return this.allStudentData;
        }

        return this.allStudentData.filter(student => {
            const profile = student.studentProfile || {};
            const studentGrade = profile.grade || '';
            return String(studentGrade) === String(selectedGrade);
        });
    },
};

export function installTeacherDataDashboardViewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardViewMethods);
}
