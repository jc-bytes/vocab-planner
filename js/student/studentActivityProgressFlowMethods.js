import { $, createElement } from '../main.js';
import { getCurrentSchoolYear, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import { DEFAULT_REQUIRED_BY_PURPOSE, VOCAB_ACTIVITY_IDS } from './studentActivityConstants.js';

class StudentActivityProgressFlowMethods {
    getUnitGrade(vocab = this.sm.currentVocab) {
        const profileGrade = this.sm.studentProfile?.grade;
        if (profileGrade) return String(profileGrade);
        if (Array.isArray(vocab?.grades) && vocab.grades.length > 0) return String(vocab.grades[0]);
        if (vocab?.grade) return String(vocab.grade);
        return '';
    }

    getUnitProgressKey(vocab = this.sm.currentVocab) {
        const unitId = this.sm.getVocabRouteId(vocab) || vocab?.id || vocab?.name || 'unit';
        return `${getVocabSubjectSlug(vocab)}:${unitId}`;
    }

    ensureUnitProgress(vocab = this.sm.currentVocab) {
        if (!vocab) return null;
        if (!this.sm.progressData.units) this.sm.progressData.units = {};

        const progressKey = this.getUnitProgressKey(vocab);
        const legacyProgress = this.sm.progressData.units[vocab.name] || {};
        const existing = this.sm.progressData.units[progressKey] || (
            getVocabSubjectSlug(vocab) === 'technology' ? legacyProgress : {}
        );
        const unitProgress = {
            ...existing,
            unitId: this.sm.getVocabRouteId(vocab),
            unitName: vocab.name || '',
            subjectSlug: getVocabSubjectSlug(vocab),
            trimester: this.getVocabTrimesterKey(vocab),
            schoolYear: existing.schoolYear || getCurrentSchoolYear(),
            grade: this.getUnitGrade(vocab),
            scores: existing.scores || {},
            images: existing.images || {},
            wordHunt: existing.wordHunt || {},
            states: existing.states || {}
        };

        this.sm.progressData.units[progressKey] = unitProgress;
        return unitProgress;
    }

    getCurrentUnitProgress() {
        if (!this.sm.currentVocab) return null;
        return this.ensureUnitProgress(this.sm.currentVocab);
    }

    restoreWordsFromState(initialState, fallbackWords, filter = null) {
        const wordKeys = Array.isArray(initialState?.wordKeys) ? initialState.wordKeys : null;
        if (!wordKeys || wordKeys.length === 0 || !this.sm.currentVocab?.words) {
            return fallbackWords;
        }

        const eligibleWords = filter
            ? this.sm.currentVocab.words.filter(filter)
            : this.sm.currentVocab.words;
        const wordsByKey = new Map(eligibleWords.map(word => [word.word, word]));
        const restoredWords = wordKeys.map(wordKey => wordsByKey.get(wordKey)).filter(Boolean);

        return restoredWords.length === wordKeys.length ? restoredWords : fallbackWords;
    }

    getWordHuntWords(settings = {}) {
        if (!this.sm.currentVocab?.words) return [];

        const selectedWords = this.sm.currentVocab.words.filter(word => (
            word.wordHunt === true ||
            word.wordHunt === 'true' ||
            word.word_hunt === true
        ));
        if (selectedWords.length > 0) {
            return selectedWords;
        }

        const fallbackLimit = settings.illustration || 5;
        return this.sm.currentVocab.words.slice(0, fallbackLimit);
    }

    getDefaultRequiredActivities(vocab = this.sm.currentVocab) {
        const purpose = String(vocab?.purpose || '').trim().toLowerCase();
        return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
    }

    getActivityFlowConfig(vocab = this.sm.currentVocab) {
        const settings = vocab?.activitySettings || {};
        const validIds = new Set(VOCAB_ACTIVITY_IDS);
        const hasExplicitFlow = Array.isArray(settings.requiredActivities) || Array.isArray(settings.additionalActivities);
        const defaultRequired = this.getDefaultRequiredActivities(vocab).filter(id => validIds.has(id));
        const requestedRequired = hasExplicitFlow ? settings.requiredActivities : defaultRequired;
        const required = (Array.isArray(requestedRequired) ? requestedRequired : defaultRequired)
            .filter(id => validIds.has(id));
        const uniqueRequired = [...new Set(required)];
        const requiredSet = new Set(uniqueRequired);
        const requestedAdditional = hasExplicitFlow
            ? settings.additionalActivities
            : VOCAB_ACTIVITY_IDS.filter(id => !requiredSet.has(id));
        const additional = (Array.isArray(requestedAdditional) ? requestedAdditional : [])
            .filter(id => validIds.has(id) && !requiredSet.has(id));

        if (uniqueRequired.length === 0) {
            uniqueRequired.push('flashcards');
        }

        return {
            required: uniqueRequired,
            additional: [...new Set(additional)]
        };
    }

    isActivityComplete(activityType) {
        const scoreData = this.sm.unitScores?.[activityType];
        if (!scoreData) return false;
        return Boolean(scoreData.isComplete) || (Number(scoreData.score) || 0) >= 100;
    }

    getRequiredCompletion(flow = this.getActivityFlowConfig()) {
        const completed = flow.required.filter(activityType => this.isActivityComplete(activityType)).length;
        return {
            completed,
            total: flow.required.length,
            isComplete: flow.required.length > 0 && completed >= flow.required.length
        };
    }

    isActivityUnlocked(activityType) {
        const flow = this.getActivityFlowConfig();
        if (flow.required.includes(activityType)) return true;
        if (!flow.additional.includes(activityType)) return false;
        return this.getRequiredCompletion(flow).isComplete;
    }

    updateActivityGateDisplay(cards, flow = this.getActivityFlowConfig()) {
        const grid = document.querySelector('#activity-menu-view .activities-grid');
        if (!grid) return;

        const completion = this.getRequiredCompletion(flow);
        let status = $('#required-activities-status');
        if (!status) {
            status = createElement('div', 'required-activities-status');
            status.id = 'required-activities-status';
            status.style.cssText = 'max-width: 800px; margin: 0 auto 1rem; color: var(--text-muted); font-weight: 600;';
            grid.parentNode.insertBefore(status, grid);
        }
        status.textContent = `Required activities: ${completion.completed}/${completion.total} complete`;

        const allCards = Array.from(cards);
        allCards.forEach(card => card.remove());
        grid.querySelectorAll('.activity-flow-section, .activity-hidden-holder').forEach(section => section.remove());
        grid.style.display = 'block';

        const createSection = (title, className) => {
            const section = createElement('section', `activity-flow-section ${className}`);
            section.style.cssText = 'margin: 0 auto 1.5rem; max-width: 1000px;';
            const heading = createElement('h3');
            heading.textContent = title;
            heading.style.cssText = 'margin: 0 0 0.75rem; color: var(--text-main);';
            const innerGrid = createElement('div', 'activities-grid-inner');
            innerGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;';
            section.appendChild(heading);
            section.appendChild(innerGrid);
            grid.appendChild(section);
            return innerGrid;
        };

        const requiredGrid = createSection('Required Activities', 'required-activity-section');
        const additionalGrid = completion.isComplete ? createSection('Additional Practice', 'additional-activity-section') : null;
        const hiddenHolder = createElement('div', 'activity-hidden-holder');
        hiddenHolder.style.display = 'none';
        grid.appendChild(hiddenHolder);

        allCards.forEach(card => {
            const activityType = card.dataset.activity;
            card.classList.toggle('required-activity-card', flow.required.includes(activityType));
            card.classList.toggle('additional-activity-card', flow.additional.includes(activityType));

            if (flow.required.includes(activityType)) {
                requiredGrid.appendChild(card);
            } else if (flow.additional.includes(activityType) && completion.isComplete && additionalGrid) {
                additionalGrid.appendChild(card);
            } else {
                hiddenHolder.appendChild(card);
            }
        });
    }

    getNextActivityPreloadType(flow = this.getActivityFlowConfig()) {
        const completion = this.getRequiredCompletion(flow);

        if (completion.isComplete) {
            return flow.additional.find(activityType => this.isActivityUnlocked(activityType)) || null;
        }

        return flow.required.find(activityType => !this.isActivityComplete(activityType))
            || flow.required.find(activityType => this.isActivityUnlocked(activityType))
            || null;
    }

    scheduleActivityPreload(flow = this.getActivityFlowConfig()) {
        const activityType = this.getNextActivityPreloadType(flow);
        if (!activityType) return;

        const vocabId = this.sm.getCurrentVocabRouteId() || this.sm.currentVocab?.name || 'current';
        const key = `${vocabId}:${activityType}`;
        if (this.activityPreloadKeys.has(key)) return;
        this.activityPreloadKeys.add(key);

        this.scheduleIdleTask(() => {
            this.loadActivityClass(activityType).catch(() => {});
        }, 900);
    }
}

export function installStudentActivityProgressFlowMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityProgressFlowMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityProgressFlowMethods.prototype, name)
        );
    }
}
