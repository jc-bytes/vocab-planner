const teacherDataDashboardMetricMethods = {
    calculateActivityCompletion() {
        const activityLabels = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle'
        };
        const completion = {};

        Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
            completion[activityLabel] = Number(
                this.dashboardAnalytics?.activities?.[activityKey]?.completionRate
            ) || 0;
        });
        return completion;
    },

    calculateGradeProgress() {
        return this.dashboardAnalytics?.gradeCounts || {};
    },

    calculateCoinDistribution() {
        return {
            labels: ['0-100', '101-500', '501-1000', '1001-5000', '5000+'],
            data: this.dashboardAnalytics?.coinDistribution || [0, 0, 0, 0, 0]
        };
    },

    calculateActivityUsage() {
        const activityLabels = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle'
        };
        const usage = {};

        Object.values(activityLabels).forEach(label => {
            usage[label] = 0;
        });

        Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
            usage[activityLabel] = Number(
                this.dashboardAnalytics?.activities?.[activityKey]?.completed
            ) || 0;
        });
        return usage;
    },
};

export function installTeacherDataDashboardMetricMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardMetricMethods);
}
