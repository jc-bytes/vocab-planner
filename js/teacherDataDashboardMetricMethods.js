const teacherDataDashboardMetricMethods = {
    calculateActivityCompletion() {
        const filteredData = this.getDashboardFilteredData();
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
            let completed = 0;
            let total = 0;

            filteredData.forEach(student => {
                const units = student.units || {};
                Object.values(units).forEach(unit => {
                    // Scores are stored in unit.scores[activityKey]
                    const scores = unit.scores || {};
                    const activityData = scores[activityKey];
                    if (activityData) {
                        total++;
                        if (activityData.completed || activityData.score > 0) {
                            completed++;
                        }
                    }
                });
            });

            completion[activityLabel] = total > 0 ? Math.round((completed / total) * 100) : 0;
        });

        console.log('Activity Completion Data:', completion);
        return completion;
    },

    calculateGradeProgress() {
        const filteredData = this.getDashboardFilteredData();
        const gradeCounts = {};
        filteredData.forEach(student => {
            const grade = student.studentProfile?.grade || student.grade || 'Unknown';
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
        });
        return gradeCounts;
    },

    calculateCoinDistribution() {
        const filteredData = this.getDashboardFilteredData();
        const ranges = [
            { label: '0-100', min: 0, max: 100 },
            { label: '101-500', min: 101, max: 500 },
            { label: '501-1000', min: 501, max: 1000 },
            { label: '1001-5000', min: 1001, max: 5000 },
            { label: '5000+', min: 5001, max: Infinity }
        ];

        const distribution = ranges.map(range => {
            return filteredData.filter(student => {
                const coins = student.coinData?.balance || student.coins || 0;
                return coins >= range.min && coins <= range.max;
            }).length;
        });

        return {
            labels: ranges.map(r => r.label),
            data: distribution
        };
    },

    calculateActivityUsage() {
        const filteredData = this.getDashboardFilteredData();
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

        filteredData.forEach(student => {
            const units = student.units || {};
            Object.values(units).forEach(unit => {
                // Scores are stored in unit.scores[activityKey]
                const scores = unit.scores || {};
                Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
                    const activityData = scores[activityKey];
                    if (activityData && (activityData.completed || activityData.score > 0)) {
                        usage[activityLabel] = (usage[activityLabel] || 0) + 1;
                    }
                });
            });
        });

        console.log('Activity Usage Data:', usage);
        return usage;
    },
};

export function installTeacherDataDashboardMetricMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardMetricMethods);
}
