import { installQuizMakerComposerMethods } from './quizMakerComposerMethods.js';
import { installQuizMakerCoreMethods } from './quizMakerCoreMethods.js';
import { installQuizMakerQuestionMethods } from './quizMakerQuestionMethods.js';
import { installQuizMakerPrintMethods } from './quizMakerPrintMethods.js';
import { installQuizMakerRasterExportMethods } from './quizMakerRasterExportMethods.js';
import { installQuizMakerRenderMethods } from './quizMakerRenderMethods.js';
import { installQuizMakerWordExportMethods } from './quizMakerWordExportMethods.js';
import { cleanQuizTitle } from './quizMakerTitle.js';

export class QuizMaker {
    constructor(vocabSet, onClose, options = {}) {
        this.vocabSet = vocabSet;
        this.onClose = onClose;
        this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;
        this.suppressStateSave = true;
        this.questions = [];
        this.meta = {
            title: cleanQuizTitle(vocabSet.name || 'Quiz'),
            instructions: 'This is an individual summative activity. This sheet must be filled out in pen (black or blue). Follow the instructions given by the teacher, stay seated and focused on your activity at all times during this assignment.',
            schoolName: 'ACADEMIA INTERNACIONAL DE DAVID',
            teacherName: 'Porfirio Rios',
            grade: vocabSet.grade || '',
            showBorder: true,
            fontFamily: "Arial, sans-serif",
            rubric: [
                { title: 'Date and Name:', desc: 'Complete Name and Date (short date) in the correct English format.', points: 2 },
                { title: 'Follows instructions:', desc: 'The student follows the assignment guidelines and teacher\'s directions.', points: 1 },
                { title: 'Content:', desc: '', points: 45 },
                { title: 'Punctuality and responsibility:', desc: 'Brings necessary implements, works hard, focuses on his workshop and submits work in time.', points: 2 }
            ],
            date: '',
            name: '',
            score: ''
        };
        this.dragSrcEl = null;
        this.sectionIdCounter = 0;
        this.autoGenerateTimer = null;
        this.wordExportLogoRelId = null;
        this.sectionTypes = {
            mc: { title: 'Multiple Choice', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 5, points: 1 } },
            sata: { title: 'Select All That Apply', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 3, points: 2, choices: 5, correct: 2 } },
            tf: { title: 'True / False', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 5, points: 1 } },
            matching: { title: 'Matching', countLabel: 'Pairs', pointsLabel: 'Pts / pair', defaults: { count: 5, points: 1 } },
            short: { title: 'Short Answer', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 1, points: 1 } },
            synonym: { title: 'Synonym / Antonym', countLabel: 'Questions', pointsLabel: 'Pts / question', defaults: { count: 5, points: 1 } },
            wordsearch: { title: 'Word Search', countLabel: 'Words', pointsLabel: 'Activity points', defaults: { count: 12, points: 10 } },
            crossword: { title: 'Crossword', countLabel: 'Words', pointsLabel: 'Activity points', defaults: { count: 8, points: 10 } }
        };
        this.quizSections = [
            this.createQuizSection('mc', { count: 5, points: 1 }),
            this.createQuizSection('tf', { count: 5, points: 1 }),
            this.createQuizSection('matching', { count: 5, points: 1 }),
            this.createQuizSection('short', { count: 1, points: 1 }),
            this.createQuizSection('synonym', { count: 5, points: 1 })
        ];

        const restored = this.restoreState(options.state);
        this.init({ shouldGenerate: !restored });
    }

}

installQuizMakerComposerMethods(QuizMaker);
installQuizMakerCoreMethods(QuizMaker);
installQuizMakerQuestionMethods(QuizMaker);
installQuizMakerPrintMethods(QuizMaker);
installQuizMakerRasterExportMethods(QuizMaker);
installQuizMakerRenderMethods(QuizMaker);
installQuizMakerWordExportMethods(QuizMaker);
