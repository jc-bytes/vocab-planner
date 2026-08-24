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

export const STUDENT_ACTIVITY_REGISTRY = Object.freeze([
    {
        id: 'illustration', title: 'Word Hunt', description: 'Find a definition, image, and two examples.',
        icon: 'compass', settingKey: 'illustration',
        exportName: 'IllustrationActivity', load: () => import('../activities/illustration.js'),
        nonReplayable: true, tracksCoverage: false
    },
    {
        id: 'matching', title: 'Matching', description: 'Match words to definitions.',
        icon: 'puzzle', settingKey: 'matching',
        exportName: 'MatchingActivity', load: () => import('../activities/matching.js')
    },
    {
        id: 'flashcards', title: 'Flashcards', description: 'Study words and images.',
        icon: 'layers-3', settingKey: 'flashcards',
        exportName: 'FlashcardsActivity', load: () => import('../activities/flashcards.js'),
        nonReplayable: true, tracksCoverage: false
    },
    {
        id: 'quiz', title: 'Quiz', description: 'Test your knowledge.',
        icon: 'circle-help', settingKey: 'quiz',
        exportName: 'QuizActivity', load: () => import('../activities/quiz.js')
    },
    {
        id: 'synonym-antonym', title: 'Synonym & Antonym', description: 'Challenge your word knowledge.',
        icon: 'repeat-2', settingKey: 'synonymAntonym',
        exportName: 'SynonymAntonymActivity', load: () => import('../activities/synonymAntonym.js')
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
        exportName: 'HangmanActivity', load: () => import('../activities/hangman.js')
    },
    {
        id: 'scramble', title: 'Word Scramble', description: 'Unscramble the letters.',
        icon: 'shuffle', settingKey: 'scramble',
        exportName: 'ScrambleActivity', load: () => import('../activities/scramble.js')
    },
    {
        id: 'wordle', title: 'Vocabulary Wordle', description: 'Guess words from clues.',
        icon: 'layout-grid', settingKey: 'wordle',
        exportName: 'WordleActivity', load: () => import('../activities/wordle.js')
    },
    {
        id: 'speed-match', title: 'Speed Match', description: 'Race against time.',
        icon: 'timer', settingKey: 'speedMatch',
        exportName: 'SpeedMatchActivity', load: () => import('../activities/speedMatch.js?v=20260706a')
    },
    {
        id: 'fill-in-blank', title: 'Fill in Blank', description: 'Complete the sentence.',
        icon: 'text-cursor-input', settingKey: 'fillInBlank',
        exportName: 'FillInBlankActivity', load: () => import('../activities/fillInBlank.js')
    }
].map(activity => Object.freeze({ routeable: true, tracksCoverage: true, ...activity })));

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
