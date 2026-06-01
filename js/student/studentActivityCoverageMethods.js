import { $, createElement } from '../main.js';

class StudentActivityCoverageMethods {
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
        // Create or update overall coverage indicator
        let coverageIndicator = $('#overall-coverage-indicator');
        
        if (!coverageIndicator) {
            // Create the indicator if it doesn't exist
            const header = document.querySelector('#activity-menu-view .section-header');
            if (header) {
                coverageIndicator = createElement('div', 'overall-coverage');
                coverageIndicator.id = 'overall-coverage-indicator';
                coverageIndicator.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-muted); margin-left: auto;';
                header.appendChild(coverageIndicator);
            }
        }
        
        if (coverageIndicator && coverageStats?.overall) {
            const { practiced, total, percentage } = coverageStats.overall;
            coverageIndicator.innerHTML = `
                <span title="Words practiced across all activities">📖 Word Coverage: ${practiced}/${total} (${percentage}%)</span>
                <div style="width: 60px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: var(--primary-color, #6366f1); transition: width 0.3s;"></div>
                </div>
            `;
        }
    }
}

export function installStudentActivityCoverageMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityCoverageMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityCoverageMethods.prototype, name)
        );
    }
}
