import { $ } from '../main.js';

export class StudentActivityCoverage {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.wordCoverage = {};
    }

    getUnitProgressKey(...args) {
        return this.activities.getUnitProgressKey(...args);
    }

    initWordCoverage() {
        if (!this.sm.currentVocab) return;
        
        const vocabName = this.getUnitProgressKey(this.sm.currentVocab);
        
        // Load from progress data or initialize
        if (!this.sm.progressData.wordCoverage) {
            this.sm.progressData.wordCoverage = {};
        }
        
        if (!this.sm.progressData.wordCoverage[vocabName]) {
            this.sm.progressData.wordCoverage[vocabName] = {};
        }
        
        this.wordCoverage = this.sm.progressData.wordCoverage[vocabName];
    }

    getUnpracticedWords(activityType, allWords) {
        if (!this.wordCoverage[activityType]) {
            this.wordCoverage[activityType] = {};
        }
        
        const practiced = this.wordCoverage[activityType];
        const unpracticed = allWords.filter(w => !practiced[w.word]);
        
        // If all words have been practiced, reset and return all
        if (unpracticed.length === 0) {
            this.wordCoverage[activityType] = {};
            return [...allWords];
        }
        
        return unpracticed;
    }

    markWordsPracticed(activityType, words) {
        if (!this.wordCoverage[activityType]) {
            this.wordCoverage[activityType] = {};
        }
        
        words.forEach(w => {
            const word = typeof w === 'string' ? w : w.word;
            this.wordCoverage[activityType][word] = {
                practicedAt: new Date().toISOString(),
                count: (this.wordCoverage[activityType][word]?.count || 0) + 1
            };
        });
        
        // Save coverage data
        if (this.sm.currentVocab) {
            const vocabName = this.getUnitProgressKey(this.sm.currentVocab);
            if (!this.sm.progressData.wordCoverage) {
                this.sm.progressData.wordCoverage = {};
            }
            this.sm.progressData.wordCoverage[vocabName] = this.wordCoverage;
            this.sm.progress.saveLocalProgress();
        }
    }

    getWordCoverageStats() {
        if (!this.sm.currentVocab) return null;
        
        const totalWords = this.sm.currentVocab.words.length;
        const activities = ['matching', 'quiz', 'synonym-antonym', 'word-search', 'crossword',
                          'hangman', 'scramble', 'wordle', 'speed-match', 'fill-in-blank'];
        
        const stats = {};
        
        activities.forEach(activity => {
            const practiced = this.wordCoverage[activity] ? Object.keys(this.wordCoverage[activity]).length : 0;
            stats[activity] = {
                practiced,
                total: totalWords,
                percentage: Math.round((practiced / totalWords) * 100)
            };
        });
        
        // Overall coverage (words practiced in at least one activity)
        const allPracticed = new Set();
        activities.forEach(activity => {
            if (this.wordCoverage[activity]) {
                Object.keys(this.wordCoverage[activity]).forEach(word => allPracticed.add(word));
            }
        });
        
        stats.overall = {
            practiced: allPracticed.size,
            total: totalWords,
            percentage: Math.round((allPracticed.size / totalWords) * 100)
        };
        
        return stats;
    }

    getPrioritizedWords(activityType, limit = 10, sourceWords = null) {
        if (!this.sm.currentVocab) return [];
        
        const allWords = [...(sourceWords || this.sm.currentVocab.words)];
        const practiced = this.wordCoverage[activityType] || {};
        
        // Sort by practice count (ascending) then shuffle within same count
        allWords.sort((a, b) => {
            const countA = practiced[a.word]?.count || 0;
            const countB = practiced[b.word]?.count || 0;
            if (countA !== countB) return countA - countB;
            return Math.random() - 0.5; // Random within same count
        });
        
        return allWords.slice(0, limit);
    }

    updateOverallCoverageDisplay(coverageStats) {
        let coverageIndicator = $('#overall-coverage-indicator');

        if (!coverageIndicator) {
            return;
        }

        if (coverageIndicator && coverageStats?.overall) {
            const { practiced, total, percentage } = coverageStats.overall;
            coverageIndicator.innerHTML = `
                <span class="activity-menu-summary-label">Word coverage</span>
                <strong>${practiced}/${total} words</strong>
                <small>${percentage}% practiced</small>
                <div class="activity-menu-summary-meter" aria-hidden="true">
                    <div style="width: ${percentage}%;"></div>
                </div>
            `;
        }
    }
}
