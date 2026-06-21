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
            { id: 'galactic-breaker', name: 'Galactic Breaker', icon: '🧱', desc: 'Break bricks in space!' },
            { id: 'snake', name: 'Snake', icon: '🐍', desc: 'Grow and avoid yourself!' },
            { id: 'flappy-bird', name: 'Flappy Bird', icon: '🐦', desc: 'Fly through pipes!' },
            { id: 'space-invaders', name: 'Space Invaders', icon: '👾', desc: 'Defend Earth!' },
            { id: 'target-shooter', name: 'Target Shooter', icon: '🎯', desc: 'Hit the targets!' },
            { id: 'pong', name: 'Pong', icon: '🏓', desc: 'Use W/S keys to move!' },
            { id: 'whack-a-mole', name: 'Whack-a-Mole', icon: '🎪', desc: 'Whack the moles!' },
            { id: 'trapdoor-trials', name: 'Trapdoor Trials', icon: '🚪', desc: 'Outsmart every surprise trap!' },
            { id: 'tilt-maze', name: 'Tilt Maze', icon: '🎲', desc: 'Tilt a 3D maze to reach the goal!' },
            { id: 'basic-platformer', name: 'Checkpoint Runner', icon: '🏁', desc: 'Run, jump, and master six levels!' },
            { id: 'ball-blast', name: 'Ball Blast', icon: '💥', desc: 'Blast the balls!' },
            { id: 'radius-raid', name: 'Radius Raid', icon: '🚀', desc: 'Blast enemies in space!' },
            { id: 'packabunchas', name: 'Packabunchas', icon: '🧩', desc: 'Solve tiling puzzles!' },
            { id: 'spacepi', name: 'SpacePi', icon: '🛡️', desc: 'Defend your base!' },
            { id: 'mystic-valley', name: 'Mystic Valley', icon: '🏔️', desc: 'Multiplayer platformer!' },
            { id: 'slash-knight', name: 'Slash Knight', icon: '⚔️', desc: 'Adventure platformer!' },
            { id: 'black-hole-square', name: 'Black Hole Square', icon: '⬛', desc: 'Clean up the squares!' },
            { id: 'glitch-buster', name: 'Glitch Buster', icon: '💥', desc: 'Bust the glitches!' },
            { id: 'callisto', name: 'Callisto', icon: '🌌', desc: '3D space action!' },
            { id: 'js13k2021', name: 'JS13K 2021', icon: '🎮', desc: 'TypeScript adventure!' },
            { id: 'my-digital-garden', name: 'My Magical Garden', icon: '🌸', desc: 'Breed flowers and fill the garden!' },
            { id: 'grow-your-garden', name: 'Grow Your Garden', icon: '🌱', desc: 'Plant, harvest, and upgrade your garden!' }
        ];
        // HTML/Scratch games that don't have leaderboards.
        this.htmlGames = ['tilt-maze', 'basic-platformer', 'ball-blast', 'radius-raid', 'packabunchas', 'spacepi', 'mystic-valley', 'slash-knight', 'black-hole-square', 'glitch-buster', 'callisto', 'js13k2021', 'my-digital-garden', 'grow-your-garden'];
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
