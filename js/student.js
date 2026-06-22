import { DEFAULT_SUBJECT_SLUG } from './services/vocabularyApi.js';
// Import modular components
import { StudentAuth } from './student/studentAuth.js';
import { StudentProgress } from './student/studentProgress.js';
import { StudentActivities } from './student/studentActivities.js';
import { installStudentActivityDelegateMethods } from './studentActivityDelegateMethods.js';
import { installStudentAuthDelegateMethods } from './studentAuthDelegateMethods.js';
import { installStudentAuthUiMethods } from './studentAuthUiMethods.js';
import { installStudentCoinNotificationMethods } from './studentCoinNotificationMethods.js';
import { installStudentGameDelegateMethods } from './studentGameDelegateMethods.js';
import { installStudentLegacyProgressMethods } from './studentLegacyProgressMethods.js';
import { installStudentListenerMethods } from './studentListenerMethods.js';
import { installStudentProgressDelegateMethods } from './studentProgressDelegateMethods.js';
import { installStudentRoutingMethods } from './studentRoutingMethods.js';
import { installStudentShellMethods } from './studentShellMethods.js';
import { installStudentSubjectMethods } from './studentSubjectMethods.js';

const DEV_AUTH_DISABLED = false;

class StudentManager {
    constructor() {
        this.currentVocab = null;
        this.manifest = null;
        this.studentProfile = {
            firstName: '',
            lastName: '',
            name: '',
            grade: '',
            studentId: '',
            email: ''
        };
        this.progressData = {};
        this.activityInstance = null;
        this.currentUser = null;
        this.coins = 0; // Legacy support - will be replaced by coinData
        this.coinData = {
            balance: 0,
            giftCoins: 0,
            totalEarned: 0,
            totalSpent: 0,
            totalGifted: 0
        };
        this.coinHistory = [];
        this.currentRole = 'student';

        // Game variables
        this.currentGame = null;
        this.gameTimeRemaining = 0;
        this.gameTimerInterval = null;
        this.isHandlingGameMinute = false;

        // Leaderboard variables
        this.gamesList = [
            {
                id: 'galactic-breaker',
                name: 'Galactic Breaker',
                icon: '🧱',
                art: 'images/game-art/galactic-breaker-cover-neon-cyberpunk-v1.webp',
                desc: 'Break bricks in space!'
            },
            {
                id: 'snake',
                name: 'Snake',
                icon: '🐍',
                art: 'images/game-art/snake-cover-neon-cyberpunk-friendly-v8.webp',
                desc: 'Grow and avoid yourself!'
            },
            {
                id: 'flappy-bird',
                name: 'Flappy Bird',
                icon: '🐦',
                art: 'images/game-art/flappy-bird-cover-neon-cyberpunk-readable-v2.webp',
                desc: 'Fly through pipes!'
            },
            {
                id: 'space-invaders',
                name: 'Space Invaders',
                icon: '👾',
                art: 'images/game-art/space-invaders-cover-neon-cyberpunk-v1.webp',
                desc: 'Defend Earth!'
            },
            {
                id: 'target-shooter',
                name: 'Target Shooter',
                icon: '🎯',
                art: 'images/game-art/target-shooter-cover-neon-cyberpunk-v1.webp',
                desc: 'Hit the targets!'
            },
            {
                id: 'pong',
                name: 'Pong',
                icon: '🏓',
                art: 'images/game-art/pong-cover-neon-cyberpunk-v1.webp',
                desc: 'Use W/S keys to move!'
            },
            {
                id: 'whack-a-mole',
                name: 'Whack-a-Mole',
                icon: '🎪',
                art: 'images/game-art/whack-a-mole-cover-neon-cyberpunk-v1.webp',
                desc: 'Whack the moles!'
            },
            {
                id: 'trapdoor-trials',
                name: 'Trapdoor Trials',
                icon: '🚪',
                art: 'images/game-art/trapdoor-trials-cover-neon-cyberpunk-v1.webp',
                desc: 'Outsmart every surprise trap!'
            },
            {
                id: 'tilt-maze',
                name: 'Tilt Maze',
                icon: '🎲',
                art: 'images/game-art/tilt-maze-cover-neon-cyberpunk-v1.webp',
                desc: 'Tilt a 3D maze to reach the goal!'
            },
            {
                id: 'basic-platformer',
                name: 'Circuit Sprint',
                icon: '🏁',
                art: 'images/game-art/circuit-sprint-cover-neon-cyberpunk-v1.webp',
                desc: 'Run the checkpoint course and chase a clean time!'
            },
            {
                id: 'tower-platformer',
                name: 'Tower Climb',
                icon: '🗼',
                art: 'images/game-art/tower-climb-cover-neon-cyberpunk-v1.webp',
                desc: 'Circle the tower, climb ladders, and collect coins!'
            },
            {
                id: 'radius-raid',
                name: 'Radius Raid',
                icon: '🚀',
                art: 'images/game-art/radius-raid-cover-neon-cyberpunk-v1.webp',
                desc: 'Blast enemies in space!'
            },
            {
                id: 'packabunchas',
                name: 'Packabunchas',
                icon: '🧩',
                art: 'images/game-art/packabunchas-cover-neon-cyberpunk-v1.webp',
                desc: 'Solve tiling puzzles!'
            },
            {
                id: 'spacepi',
                name: 'SpacePi',
                icon: '🛡️',
                art: 'images/game-art/spacepi-cover-neon-cyberpunk-v1.webp',
                desc: 'Defend your base!'
            },
            {
                id: 'black-hole-square',
                name: 'Black Hole Square',
                icon: '⬛',
                art: 'images/game-art/black-hole-square-cover-neon-cyberpunk-v1.webp',
                desc: 'Clean up the squares!'
            },
            {
                id: 'glitch-buster',
                name: 'Glitch Buster',
                icon: '💥',
                art: 'images/game-art/glitch-buster-cover-neon-cyberpunk-v1.webp',
                desc: 'Bust the glitches!'
            },
            {
                id: 'callisto',
                name: 'Callisto',
                icon: '🌌',
                art: 'images/game-art/callisto-cover-neon-cyberpunk-v1.webp',
                desc: 'Run, jump, and collect stars in space!'
            },
            {
                id: 'js13k2021',
                name: 'JS13K 2021',
                icon: '🎮',
                art: 'images/game-art/js13k2021-cover-neon-cyberpunk-v1.webp',
                desc: 'Leap across space platforms and collect orbs!'
            },
            {
                id: 'my-digital-garden',
                name: 'My Magical Garden',
                icon: '🌸',
                art: 'images/game-art/my-magical-garden-cover-neon-cyberpunk-v1.webp',
                desc: 'Breed flowers and fill the garden!'
            },
            {
                id: 'grow-your-garden',
                name: 'Grow Your Garden',
                icon: '🌱',
                art: 'images/game-art/grow-your-garden-cover-neon-cyberpunk-v1.webp',
                desc: 'Plant, harvest, and upgrade your garden!'
            }
        ];
        // HTML/Scratch games that don't have leaderboards.
        this.htmlGames = ['tilt-maze', 'basic-platformer', 'tower-platformer', 'radius-raid', 'packabunchas', 'spacepi', 'black-hole-square', 'glitch-buster', 'callisto', 'js13k2021', 'my-digital-garden', 'grow-your-garden'];
        this.currentGameIndex = 0;
        this.authInitialized = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.joinGrade = this.getJoinGradeFromUrl();
        this.mustChangePassword = false;
        this.cloudVocabs = [];
        this.availableVocabs = [];
        this.schoolCalendar = null;
        this.subjects = [];
        this.selectedSubjectSlug = localStorage.getItem('student_selected_subject') || DEFAULT_SUBJECT_SLUG;
        this.studentVocabularyDrilldown = {
            trimester: null,
            month: null
        };
        this.studentVocabularyViewMode = localStorage.getItem('student_vocabulary_view_mode') || 'cards';
        this.studentSectionScrollPositions = {};
        this.currentSparkSessionCache = new Map();
        this.cloudSaveTimeout = null;
        this.unitImages = {};
        this.routeReady = false;
        this.isApplyingRoute = false;
        this.activityRouteTypes = [
            'illustration',
            'matching',
            'flashcards',
            'quiz',
            'synonym-antonym',
            'word-search',
            'crossword',
            'hangman',
            'scramble',
            'wordle',
            'speed-match',
            'fill-in-blank'
        ];

        // Initialize modular components
        this.auth = new StudentAuth(this);
        this.progress = new StudentProgress(this);
        this.activities = new StudentActivities(this);
        this.games = null;
        this.gamesPromise = null;

        this.init();
    }

    async init() {
        // Attach listeners first so buttons work immediately
        this.initListeners();
        window.addEventListener('online', () => this.setAuthStatus('Synced'));
        window.addEventListener('offline', () => this.setAuthStatus('Offline'));
        this.prefillRegistrationFromJoinLink();

        // Default view/state
        this.switchView('loading-view');

        if (this.authDisabled) {
            this.currentUser = null;
            this.currentRole = 'student';
            this.auth.setAuthStatus('Local development');
            this.auth.updateGuestStatus(true);

            await this.activities.loadManifest();
            await this.loadSubjectSettings();
            await this.activities.loadSchoolCalendar();
            this.progress.loadLocalProgress();
            this.auth.updateHeader();
            this.activities.renderDashboard();
            await this.restoreRouteOrDefault();
            return;
        }

        // Load manifest and local data
        await this.activities.loadManifest();
        await this.loadSubjectSettings();
        this.progress.loadLocalProgress();

        await this.auth.initBackendAuth();
    }

}

installStudentActivityDelegateMethods(StudentManager);
installStudentAuthDelegateMethods(StudentManager);
installStudentAuthUiMethods(StudentManager);
installStudentCoinNotificationMethods(StudentManager);
installStudentGameDelegateMethods(StudentManager);
installStudentLegacyProgressMethods(StudentManager);
installStudentListenerMethods(StudentManager);
installStudentProgressDelegateMethods(StudentManager);
installStudentRoutingMethods(StudentManager);
installStudentShellMethods(StudentManager);
installStudentSubjectMethods(StudentManager);

// Initialize immediately if DOM is already ready, otherwise wait
const startStudentApp = () => {
    if (!window.studentApp) {
        window.studentApp = new StudentManager();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStudentApp, { once: true });
} else {
    startStudentApp();
}
