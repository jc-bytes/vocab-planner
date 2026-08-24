const CROSSWORD_ICON = `
    <svg class="activity-art-icon" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="13" y="5" width="6" height="22" rx="1.2"></rect>
        <rect x="5" y="13" width="22" height="6" rx="1.2"></rect>
        <path d="M13 13h6v6h-6z"></path>
    </svg>
`;

const HANGMAN_ICON = `
    <svg class="activity-art-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 26h9"></path>
        <path d="M11 26V7"></path>
        <path d="M11 7h13"></path>
        <path d="M11 12l5-5"></path>
        <path d="M24 7v5"></path>
    </svg>
`;

function isMatchingWordPlayable(word = {}) {
    return (
        String(word.word || '').trim().length >= 2
        && String(word.definition || '').trim().length > 0
    );
}

function hasWordAndDefinition(word = {}) {
    return (
        String(word.word || '').trim().length > 0
        && String(word.definition || '').trim().length > 0
    );
}

function hasWord(word = {}) {
    return String(word.word || '').trim().length > 0;
}

function hasSynonymOrAntonym(word = {}) {
    return word.synonyms?.length > 0 || word.antonyms?.length > 0;
}

function isSynonymAntonymWordPlayable(word = {}) {
    return String(word.word || '').trim().length > 0 && hasSynonymOrAntonym(word);
}

function isWordleWordPlayable(word = {}) {
    const label = String(word.word || '');
    const letters = label.replace(/[^a-zA-Z]/g, '');
    return /^[a-zA-Z\s-]+$/.test(label) && letters.length >= 3 && letters.length <= 10;
}

function prepareMatchingActivity({ savedState, wordLimit, prioritize, restore }) {
    return {
        words: restore(
            savedState,
            prioritize(wordLimit, isMatchingWordPlayable),
            isMatchingWordPlayable
        )
    };
}

function prepareFlashcardsActivity({ playableWords, wordLimit }) {
    return {
        words: playableWords.slice(0, wordLimit)
    };
}

function prepareQuizActivity({ savedState, wordLimit, prioritize, restore }) {
    return {
        words: restore(
            savedState,
            prioritize(wordLimit),
            hasWordAndDefinition
        )
    };
}

function prepareSynonymAntonymActivity({ savedState, wordLimit, prioritize, restore }) {
    return {
        words: restore(
            savedState,
            prioritize(wordLimit, isSynonymAntonymWordPlayable),
            isSynonymAntonymWordPlayable
        )
    };
}

function prepareWordleActivity({ savedState, wordLimit, prioritize, restore }) {
    return {
        words: restore(
            savedState,
            prioritize(wordLimit, isWordleWordPlayable),
            isWordleWordPlayable
        )
    };
}

function preparePrioritizedActivity({ wordLimit, prioritize }) {
    return {
        words: prioritize(wordLimit)
    };
}

function createWordListActivity({
    ActivityClass,
    container,
    prepared,
    onProgress,
    onSaveState,
    savedState
}) {
    return new ActivityClass(
        container,
        prepared.words,
        onProgress,
        onSaveState,
        savedState
    );
}

function requireNonEmptyString(activity, field, index) {
    if (typeof activity[field] !== 'string' || !activity[field].trim()) {
        throw new TypeError(`Activity descriptor at index ${index} must provide a non-empty ${field}`);
    }
}

export function defineStudentActivityRegistry(activities) {
    if (!Array.isArray(activities) || activities.length === 0) {
        throw new TypeError('Activity registry must be a non-empty array');
    }

    const ids = new Set();
    const settingKeys = new Set();
    const hasOwn = (value, field) => Object.prototype.hasOwnProperty.call(value, field);
    const descriptors = activities.map((activity, index) => {
        if (!activity || typeof activity !== 'object' || Array.isArray(activity)) {
            throw new TypeError(`Activity descriptor at index ${index} must be an object`);
        }

        ['id', 'title', 'description', 'settingKey', 'exportName'].forEach(field => {
            requireNonEmptyString(activity, field, index);
        });
        for (const field of ['id', 'settingKey', 'exportName']) {
            if (activity[field] !== activity[field].trim()) {
                throw new TypeError(`Activity descriptor at index ${index} ${field} cannot have surrounding whitespace`);
            }
        }

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(activity.id)) {
            throw new TypeError(`Activity ${activity.id} must use a lowercase kebab-case ID`);
        }
        if (ids.has(activity.id)) {
            throw new TypeError(`Duplicate activity ID: ${activity.id}`);
        }
        ids.add(activity.id);

        if (settingKeys.has(activity.settingKey)) {
            throw new TypeError(`Duplicate activity setting key: ${activity.settingKey}`);
        }
        settingKeys.add(activity.settingKey);

        const hasIcon = hasOwn(activity, 'icon');
        const hasIconMarkup = hasOwn(activity, 'iconMarkup');
        if (hasIcon && (typeof activity.icon !== 'string' || !activity.icon.trim())) {
            throw new TypeError(`Activity ${activity.id} icon must be a non-empty string`);
        }
        if (hasIconMarkup && (typeof activity.iconMarkup !== 'string' || !activity.iconMarkup.trim())) {
            throw new TypeError(`Activity ${activity.id} iconMarkup must be a non-empty string`);
        }
        if (hasIcon === hasIconMarkup) {
            throw new TypeError(`Activity ${activity.id} must provide exactly one icon or iconMarkup`);
        }
        if (typeof activity.load !== 'function') {
            throw new TypeError(`Activity ${activity.id} must provide a lazy loader`);
        }
        if (!/Activity$/.test(activity.exportName)) {
            throw new TypeError(`Activity ${activity.id} exportName must end with Activity`);
        }
        if (hasOwn(activity, 'xp')) {
            throw new TypeError(`Activity ${activity.id} cannot define client XP; rewards are server-authoritative`);
        }

        for (const field of ['routeable', 'tracksCoverage', 'nonReplayable']) {
            if (hasOwn(activity, field) && typeof activity[field] !== 'boolean') {
                throw new TypeError(`Activity ${activity.id} ${field} must be a boolean`);
            }
        }
        if (activity.routeable === false) {
            throw new TypeError(`Activity ${activity.id} cannot disable routing in the student activity registry`);
        }
        for (const field of ['isPlayable', 'prepare', 'create']) {
            if (hasOwn(activity, field) && typeof activity[field] !== 'function') {
                throw new TypeError(`Activity ${activity.id} ${field} must be a function`);
            }
        }
        if (hasOwn(activity, 'prepare') !== hasOwn(activity, 'create')) {
            throw new TypeError(`Activity ${activity.id} must provide prepare and create together`);
        }
        if (hasOwn(activity, 'prepare') && !hasOwn(activity, 'isPlayable')) {
            throw new TypeError(`Activity ${activity.id} must provide isPlayable with prepare and create`);
        }

        return Object.freeze({
            routeable: true,
            tracksCoverage: true,
            nonReplayable: false,
            ...activity
        });
    });

    return Object.freeze(descriptors);
}

export const STUDENT_ACTIVITY_REGISTRY = defineStudentActivityRegistry([
    {
        id: 'illustration', title: 'Word Hunt', description: 'Find a definition, image, and two examples.',
        icon: 'compass', settingKey: 'illustration',
        exportName: 'IllustrationActivity', load: () => import('../activities/illustration.js'),
        nonReplayable: true, tracksCoverage: false
    },
    {
        id: 'matching', title: 'Matching', description: 'Match words to definitions.',
        icon: 'puzzle', settingKey: 'matching',
        exportName: 'MatchingActivity', load: () => import('../activities/matching.js'),
        isPlayable: isMatchingWordPlayable,
        prepare: prepareMatchingActivity,
        create: createWordListActivity
    },
    {
        id: 'flashcards', title: 'Flashcards', description: 'Study words and images.',
        icon: 'layers-3', settingKey: 'flashcards',
        exportName: 'FlashcardsActivity', load: () => import('../activities/flashcards.js'),
        nonReplayable: true, tracksCoverage: false,
        isPlayable: hasWordAndDefinition,
        prepare: prepareFlashcardsActivity,
        create: createWordListActivity
    },
    {
        id: 'quiz', title: 'Quiz', description: 'Test your knowledge.',
        icon: 'circle-help', settingKey: 'quiz',
        exportName: 'QuizActivity', load: () => import('../activities/quiz.js'),
        isPlayable: hasWordAndDefinition,
        prepare: prepareQuizActivity,
        create: createWordListActivity
    },
    {
        id: 'synonym-antonym', title: 'Synonym & Antonym', description: 'Challenge your word knowledge.',
        icon: 'repeat-2', settingKey: 'synonymAntonym',
        exportName: 'SynonymAntonymActivity', load: () => import('../activities/synonymAntonym.js'),
        isPlayable: isSynonymAntonymWordPlayable,
        prepare: prepareSynonymAntonymActivity,
        create: createWordListActivity
    },
    {
        id: 'word-search', title: 'Word Search', description: 'Find hidden vocabulary words.',
        icon: 'search', settingKey: 'wordSearch',
        exportName: 'WordSearchActivity', load: () => import('../activities/wordSearch.js')
    },
    {
        id: 'crossword', title: 'Crossword', description: 'Solve definitions.',
        iconMarkup: CROSSWORD_ICON, settingKey: 'crossword',
        exportName: 'CrosswordActivity', load: () => import('../activities/crossword.js')
    },
    {
        id: 'hangman', title: 'Hangman', description: 'Guess the word.',
        iconMarkup: HANGMAN_ICON, settingKey: 'hangman',
        exportName: 'HangmanActivity', load: () => import('../activities/hangman.js'),
        isPlayable: hasWord,
        prepare: preparePrioritizedActivity,
        create: createWordListActivity
    },
    {
        id: 'scramble', title: 'Word Scramble', description: 'Unscramble the letters.',
        icon: 'shuffle', settingKey: 'scramble',
        exportName: 'ScrambleActivity', load: () => import('../activities/scramble.js'),
        isPlayable: hasWord,
        prepare: preparePrioritizedActivity,
        create: createWordListActivity
    },
    {
        id: 'wordle', title: 'Vocabulary Wordle', description: 'Guess words from clues.',
        icon: 'layout-grid', settingKey: 'wordle',
        exportName: 'WordleActivity', load: () => import('../activities/wordle.js'),
        isPlayable: isWordleWordPlayable,
        prepare: prepareWordleActivity,
        create: createWordListActivity
    },
    {
        id: 'speed-match', title: 'Speed Match', description: 'Race against time.',
        icon: 'timer', settingKey: 'speedMatch',
        exportName: 'SpeedMatchActivity', load: () => import('../activities/speedMatch.js?v=20260706a'),
        isPlayable: hasWordAndDefinition,
        prepare: preparePrioritizedActivity,
        create: createWordListActivity
    },
    {
        id: 'fill-in-blank', title: 'Fill in Blank', description: 'Complete the sentence.',
        icon: 'text-cursor-input', settingKey: 'fillInBlank',
        exportName: 'FillInBlankActivity', load: () => import('../activities/fillInBlank.js')
    }
]);

const ACTIVITY_BY_ID = new Map(STUDENT_ACTIVITY_REGISTRY.map(activity => [activity.id, activity]));

export function getStudentActivity(activityId) {
    return ACTIVITY_BY_ID.get(activityId) || null;
}

export function getStudentActivityIds() {
    return STUDENT_ACTIVITY_REGISTRY.map(activity => activity.id);
}

export function renderStudentActivityCards(container) {
    if (!container) return;

    container.replaceChildren(...STUDENT_ACTIVITY_REGISTRY.map(activity => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card activity-card';
        card.dataset.activity = activity.id;

        const icon = document.createElement('div');
        icon.className = 'icon';
        if (activity.iconMarkup) {
            icon.innerHTML = activity.iconMarkup;
        } else {
            const iconElement = document.createElement('i');
            iconElement.dataset.lucide = activity.icon;
            icon.appendChild(iconElement);
        }

        const title = document.createElement('h3');
        title.textContent = activity.title;
        const description = document.createElement('p');
        description.textContent = activity.description;
        card.append(icon, title, description);
        return card;
    }));
}
