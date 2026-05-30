/**
 * Student Activities Module
 * Handles vocabulary loading, activity management, and progress tracking
 */

import { $, $$, createElement, escapeHtml } from '../main.js';
import { notifications } from '../notifications.js';
import { doc, getDoc, studentApi as supabaseService } from '../services/studentApi.js';
import {
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    calculateVocabularyPlacement,
    getSubjectBySlug,
    getVocabSubjectSlug,
    getCurrentTrimesterFromCalendar,
    getCurrentSchoolYear,
    loadCloudVocabularyList,
    loadManifest,
    loadVocabularyFile,
    normalizeSchoolCalendar,
    preloadVocabularyFile
} from '../services/vocabularyApi.js';
import { imageDB } from '../db.js';
import { compressImageToWebp, dataUrlToBlob } from '../imageUtils.js';

const VOCAB_ACTIVITY_IDS = [
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
const DEFAULT_REQUIRED_BY_PURPOSE = {
    summative: ['flashcards', 'matching', 'quiz'],
    practice: ['flashcards', 'matching'],
    default: ['flashcards', 'matching']
};
const ACTIVITY_MODULES = {
    matching: () => import('../activities/matching.js'),
    flashcards: () => import('../activities/flashcards.js'),
    quiz: () => import('../activities/quiz.js'),
    illustration: () => import('../activities/illustration.js'),
    'synonym-antonym': () => import('../activities/synonymAntonym.js'),
    'word-search': () => import('../activities/wordSearch.js'),
    crossword: () => import('../activities/crossword.js'),
    hangman: () => import('../activities/hangman.js'),
    scramble: () => import('../activities/scramble.js'),
    wordle: () => import('../activities/wordle.js'),
    'speed-match': () => import('../activities/speedMatch.js'),
    'fill-in-blank': () => import('../activities/fillInBlank.js')
};
const ACTIVITY_EXPORTS = {
    matching: 'MatchingActivity',
    flashcards: 'FlashcardsActivity',
    quiz: 'QuizActivity',
    illustration: 'IllustrationActivity',
    'synonym-antonym': 'SynonymAntonymActivity',
    'word-search': 'WordSearchActivity',
    crossword: 'CrosswordActivity',
    hangman: 'HangmanActivity',
    scramble: 'ScrambleActivity',
    wordle: 'WordleActivity',
    'speed-match': 'SpeedMatchActivity',
    'fill-in-blank': 'FillInBlankActivity'
};
const MONTH_INDEX = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
};

export class StudentActivities {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
        this.wordCoverage = {}; // Track which words have been used in each activity
        this.activityModulePromises = new Map();
        this.activityPreloadKeys = new Set();
    }

    scheduleIdleTask(callback, timeout = 1500) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback, { timeout });
        } else {
            window.setTimeout(callback, timeout);
        }
    }

    getCurrentTrimesterKey(date = new Date()) {
        const calendarTrimester = getCurrentTrimesterFromCalendar(date, this.sm.schoolCalendar);
        if (calendarTrimester) return calendarTrimester;

        const month = date.getMonth() + 1;

        if (month >= 3 && month <= 5) return 'IT';
        if (month >= 6 && month <= 8) return 'IIT';
        return 'IIIT';
    }

    async loadSchoolCalendar() {
        if (this.sm.authDisabled) {
            try {
                const localCalendar = JSON.parse(localStorage.getItem(SCHOOL_CALENDAR_LOCAL_KEY) || 'null');
                this.sm.schoolCalendar = localCalendar ? normalizeSchoolCalendar(localCalendar) : null;
            } catch (error) {
                console.error('Failed to load local school calendar:', error);
                this.sm.schoolCalendar = null;
            }
            return;
        }

        if (!this.sm.currentUser) {
            this.sm.schoolCalendar = null;
            return;
        }

        try {
            const db = supabaseService.getDatabase();
            const settingsSnap = await getDoc(doc(db, 'appSettings', SCHOOL_CALENDAR_SETTINGS_KEY));
            this.sm.schoolCalendar = settingsSnap.exists() ? normalizeSchoolCalendar(settingsSnap.data()) : null;
        } catch (error) {
            console.error('Failed to load school calendar:', error);
            this.sm.schoolCalendar = null;
        }
    }
    
    // Initialize word coverage tracking for current vocabulary
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
    
    // Get words that haven't been practiced in a specific activity
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
    
    // Mark words as practiced for an activity
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
    
    // Get word coverage statistics for display
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
    
    // Get words prioritized by least practiced
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

    async loadManifest() {
        const data = await loadManifest();
        if (data) {
            this.sm.manifest = data;
        } else {
            // Fallback or error handling
            console.error('Could not load manifest');
            $('#vocab-list').innerHTML = '<p class="error">Failed to load vocabulary list.</p>';
        }
    }

    getAllVocabularySources() {
        let vocabs = [];

        if (Array.isArray(this.sm.cloudVocabs) && this.sm.cloudVocabs.length > 0) {
            vocabs = vocabs.concat(this.sm.cloudVocabs);
        }

        if (this.sm.manifest && Array.isArray(this.sm.manifest.vocabularies)) {
            const manifestVocabs = this.sm.manifest.vocabularies.map(v => ({
                ...v,
                subjectSlug: getVocabSubjectSlug(v),
                __source: 'manifest'
            }));
            vocabs = vocabs.concat(manifestVocabs);
        }

        try {
            const localStored = localStorage.getItem('teacher_vocab_library');
            if (localStored) {
                const localVocabs = JSON.parse(localStored);
                if (Array.isArray(localVocabs)) {
                    const normalized = localVocabs.map(v => ({
                        ...v,
                        subjectSlug: getVocabSubjectSlug(v),
                        __source: 'local'
                    }));
                    vocabs = vocabs.concat(normalized);
                }
            }
        } catch (e) {
            console.error("Error loading local vocabularies", e);
        }

        return this.dedupeVocabularySources(vocabs);
    }

    dedupeVocabularySources(vocabs = []) {
        const priority = {
            cloud: 3,
            local: 2,
            manifest: 1
        };
        const byKey = new Map();

        vocabs.forEach(vocab => {
            const key = vocab.id || vocab.path || vocab.name;
            if (!key) return;

            const current = byKey.get(key);
            const currentPriority = priority[current?.__source] || 0;
            const nextPriority = priority[vocab.__source] || 0;

            if (!current || nextPriority >= currentPriority) {
                byKey.set(key, {
                    ...(current || {}),
                    ...vocab
                });
            }
        });

        return Array.from(byKey.values());
    }

    getVisibleVocabularyList(options = {}) {
        const { currentTrimesterOnly = false } = options;
        let vocabs = this.getAllVocabularySources();

        if (vocabs.length === 0) {
            return { vocabs: [], message: 'No vocabularies found.' };
        }

        const studentGrade = this.sm.studentProfile.grade ? String(this.sm.studentProfile.grade).trim() : '';

        if (studentGrade) {
            vocabs = vocabs.filter(v => {
                if (v.grades && Array.isArray(v.grades)) {
                    return v.grades.some(g => String(g).trim() === studentGrade);
                }
                if (v.grade) {
                    return String(v.grade).trim() === studentGrade;
                }
                return true;
            });
        }

        if (vocabs.length === 0) {
            return {
                vocabs: [],
                message: `No vocabularies found for Grade ${studentGrade}.`
            };
        }

        this.sm.ensureSelectedSubject(vocabs);
        const selectedSubject = this.sm.getSelectedSubject();
        vocabs = vocabs.filter(vocab => getVocabSubjectSlug(vocab) === this.sm.selectedSubjectSlug);

        if (vocabs.length === 0) {
            const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
            return {
                vocabs: [],
                message: `No ${selectedSubject.name} vocabularies found${gradeContext}.`
            };
        }

        if (currentTrimesterOnly) {
            const currentTrimester = this.getCurrentTrimesterKey();
            vocabs = vocabs.filter(v => this.getVocabTrimesterKey(v) === currentTrimester);

            if (vocabs.length === 0) {
                const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
                return {
                    vocabs: [],
                    message: `No ${selectedSubject.name} ${this.getTrimesterLabel(currentTrimester)} vocabularies found${gradeContext}.`
                };
            }
        }

        this.sm.availableVocabs = vocabs;
        return { vocabs, message: '' };
    }

    getGradeMatchedVocabularySources() {
        let vocabs = this.getAllVocabularySources();
        const studentGrade = this.sm.studentProfile.grade ? String(this.sm.studentProfile.grade).trim() : '';

        if (studentGrade) {
            vocabs = vocabs.filter(v => {
                if (v.grades && Array.isArray(v.grades)) {
                    return v.grades.some(g => String(g).trim() === studentGrade);
                }
                if (v.grade) {
                    return String(v.grade).trim() === studentGrade;
                }
                return true;
            });
        }

        return vocabs;
    }

    renderSubjectPicker(targetId) {
        const container = $(targetId);
        if (!container) return;

        const gradeVocabs = this.getGradeMatchedVocabularySources();
        this.sm.ensureSelectedSubject(gradeVocabs);
        const counts = gradeVocabs.reduce((map, vocab) => {
            const subjectSlug = getVocabSubjectSlug(vocab);
            map.set(subjectSlug, (map.get(subjectSlug) || 0) + 1);
            return map;
        }, new Map());

        const subjects = this.sm.getActiveSubjects().filter(subject => counts.has(subject.slug));
        if (subjects.length === 0) {
            container.innerHTML = '';
            return;
        }

        const selectedSubject = subjects.find(subject => subject.slug === this.sm.selectedSubjectSlug) || subjects[0];
        const selectId = `${targetId.replace(/[^a-z0-9_-]/gi, '')}-class-select`;

        container.innerHTML = '';
        container.style.setProperty('--subject-color', selectedSubject.color);

        const picker = createElement('label', 'student-class-picker');
        picker.setAttribute('for', selectId);
        picker.innerHTML = `
            <span class="student-class-picker-label">Class</span>
            <span class="subject-color-dot" style="background:${escapeHtml(selectedSubject.color)};"></span>
            <select id="${escapeHtml(selectId)}" class="student-subject-select" aria-label="Choose class">
                ${subjects.map(subject => {
                    return `<option value="${escapeHtml(subject.slug)}"${subject.slug === selectedSubject.slug ? ' selected' : ''}>${escapeHtml(subject.name)}</option>`;
                }).join('')}
            </select>
        `;

        picker.querySelector('select')?.addEventListener('change', event => this.sm.selectSubject(event.target.value));
        container.appendChild(picker);
    }

    async loadCloudVocabularies() {
        if (this.sm.authDisabled) {
            this.sm.cloudVocabs = [];
            return;
        }

        try {
            this.sm.cloudVocabs = await loadCloudVocabularyList(supabaseService);
        } catch (error) {
            console.error('Failed to load cloud vocabularies:', error);
            const isOffline = !navigator.onLine;
            if (isOffline) {
                // Silently fail offline - we'll use local/manifest vocabularies
                this.sm.cloudVocabs = [];
            } else {
                notifications.warning('Could not load cloud vocabularies. Using local versions.');
                this.sm.cloudVocabs = [];
            }
            // Re-throw to let caller know we failed
            throw error;
        }
    }

    renderDashboard() {
        const container = $('#vocab-list');
        this.renderSubjectPicker('#vocab-subject-picker');
        container.innerHTML = '';
        container.className = 'vocab-groups';
        this.sm.availableVocabs = [];

        const { vocabs, message } = this.getVisibleVocabularyList();

        if (vocabs.length === 0) {
            container.innerHTML = `<p>${message}</p>`;
            return;
        }

        this.renderVocabularyBrowser(container, vocabs);
        this.scheduleFirstVocabularyPreload(container);
    }

    getVocabSchedule(vocab, date = new Date()) {
        let assignedDate = vocab.assignedDate || '';
        let month = String(vocab.month || '').trim().toLowerCase();
        let week = Number.parseInt(vocab.week, 10);

        if (assignedDate && this.sm.schoolCalendar) {
            const placement = calculateVocabularyPlacement(assignedDate, this.sm.schoolCalendar);
            month = placement?.month || month;
            week = Number.parseInt(placement?.week, 10) || week;
        }

        const searchableText = `${vocab.id || ''} ${vocab.name || ''} ${vocab.path || ''}`.toLowerCase();
        if (!month) {
            month = Object.keys(MONTH_INDEX).find(key => searchableText.includes(key)) || '';
        }
        if (!Number.isFinite(week)) {
            const weekMatch = searchableText.match(/week[\s_-]*(\d{1,2})/);
            week = weekMatch ? Number.parseInt(weekMatch[1], 10) : 0;
        }

        if (!month && week > 0) {
            month = this.getMonthFromTrimesterWeek(this.getVocabTrimesterKey(vocab), week);
        }

        if (!month) {
            month = this.getFallbackMonthForTrimester(this.getVocabTrimesterKey(vocab));
        }

        let dueDate = null;
        if (assignedDate) {
            dueDate = new Date(`${assignedDate}T12:00:00`);
        } else if (month && Number.isFinite(week) && week > 0) {
            const year = date.getFullYear();
            dueDate = new Date(year, MONTH_INDEX[month], 1 + ((week - 1) * 7), 12);
        }

        return {
            month,
            week: Number.isFinite(week) ? week : 0,
            dueDate,
            label: [month ? month[0].toUpperCase() + month.slice(1) : '', week ? `Week ${week}` : '']
                .filter(Boolean)
                .join(' ')
        };
    }

    getMonthFromTrimesterWeek(trimester, week) {
        const key = this.getTrimesterKey(trimester);
        if (key === 'IT') {
            if (week <= 4) return 'march';
            if (week <= 8) return 'april';
            return 'may';
        }
        if (key === 'IIT') {
            if (week <= 4) return 'june';
            if (week <= 8) return 'july';
            return 'august';
        }
        if (key === 'IIIT') {
            if (week <= 4) return 'september';
            if (week <= 8) return 'october';
            if (week <= 12) return 'november';
            return 'december';
        }
        return '';
    }

    getFallbackMonthForTrimester(trimester) {
        const key = this.getTrimesterKey(trimester);
        if (key === 'IT') return 'may';
        if (key === 'IIT') return 'august';
        if (key === 'IIIT') return 'december';
        return '';
    }

    getUnitProgressSummary(vocab) {
        const unitProgress = this.sm.progressData?.units?.[this.getUnitProgressKey(vocab)]
            || this.sm.progressData?.units?.[vocab.name]
            || {};
        const scores = unitProgress.scores || {};
        const flow = this.getActivityFlowConfig(vocab);
        const completedRequired = flow.required.filter(activityType => {
            const scoreData = scores[activityType];
            return Boolean(scoreData?.isComplete) || (Number(scoreData?.score) || 0) >= 100;
        }).length;
        const latestPlayed = Object.values(scores).reduce((latest, scoreData) => {
            const timestamp = scoreData?.lastPlayed || scoreData?.updatedAt || '';
            const time = timestamp ? new Date(timestamp).getTime() : 0;
            return Number.isFinite(time) ? Math.max(latest, time) : latest;
        }, 0);
        const bestScore = Object.values(scores).reduce((best, scoreData) => {
            return Math.max(best, Number(scoreData?.score) || 0);
        }, 0);

        return {
            scores,
            completedRequired,
            requiredTotal: flow.required.length,
            isComplete: flow.required.length > 0 && completedRequired >= flow.required.length,
            latestPlayed,
            bestScore
        };
    }

    renderStudentHome() {
        const container = $('#student-home-dashboard');
        if (!container) return;

        this.renderSubjectPicker('#student-subject-picker');
        container.innerHTML = '';
        const { vocabs, message } = this.getVisibleVocabularyList({ currentTrimesterOnly: true });

        if (vocabs.length === 0) {
            container.innerHTML = `<p class="teacher-empty-state">${message}</p>`;
            return;
        }

        const today = new Date();
        const currentMonth = today.getMonth();
        const currentWeek = Math.floor((today.getDate() - 1) / 7) + 1;
        const decorated = vocabs.map(vocab => ({
            vocab,
            schedule: this.getVocabSchedule(vocab, today),
            progress: this.getUnitProgressSummary(vocab)
        })).sort((a, b) => {
            const aTime = a.schedule.dueDate?.getTime() || 0;
            const bTime = b.schedule.dueDate?.getTime() || 0;
            if (aTime !== bTime) return aTime - bTime;
            return String(a.vocab.name || '').localeCompare(String(b.vocab.name || ''));
        });

        const dueItems = decorated
            .filter(item => {
                if (item.progress.isComplete) return false;
                if (item.schedule.dueDate) return item.schedule.dueDate <= today;
                if (!item.schedule.month || !item.schedule.week) return true;
                const monthIndex = MONTH_INDEX[item.schedule.month];
                return monthIndex < currentMonth || (monthIndex === currentMonth && item.schedule.week <= currentWeek);
            })
            .slice(-2)
            .reverse();

        const recentItems = decorated
            .filter(item => item.progress.latestPlayed > 0 && !item.progress.isComplete)
            .sort((a, b) => b.progress.latestPlayed - a.progress.latestPlayed)
            .slice(0, 2);

        const weekItems = decorated
            .filter(item => {
                const monthIndex = MONTH_INDEX[item.schedule.month];
                return monthIndex === currentMonth && item.schedule.week === currentWeek;
            })
            .slice(0, 3);

        const fallbackWeekItems = weekItems.length > 0
            ? weekItems
            : decorated
                .filter(item => !item.progress.isComplete)
                .slice(-3)
                .reverse();

        const panels = [
            {
                key: 'pending',
                title: 'Pending',
                subtitle: 'Due this trimester',
                items: dueItems,
                emptyText: 'No pending units due yet.'
            },
            {
                key: 'recent',
                title: 'Recent',
                subtitle: 'Unfinished practice',
                items: recentItems,
                emptyText: 'No unfinished recent work.'
            },
            {
                key: 'week',
                title: 'This Week',
                subtitle: 'Current vocabulary',
                items: fallbackWeekItems,
                emptyText: 'No vocabulary is scheduled this week.'
            }
        ];

        const tabList = createElement('div', 'student-home-tabs');
        tabList.setAttribute('role', 'tablist');
        tabList.setAttribute('aria-label', 'Dashboard sections');
        panels.forEach((panel, index) => {
            const tab = createElement('button', `student-home-tab${index === 0 ? ' active' : ''}`);
            tab.type = 'button';
            tab.id = `student-home-tab-${panel.key}`;
            tab.dataset.panel = panel.key;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            tab.setAttribute('aria-controls', `student-home-panel-${panel.key}`);
            tab.tabIndex = index === 0 ? 0 : -1;
            tab.innerHTML = `<span>${panel.title}</span>`;
            tabList.appendChild(tab);
        });
        container.appendChild(tabList);

        panels.forEach((panel, index) => {
            container.appendChild(this.createHomePanel(panel.key, panel.title, panel.subtitle, panel.items, panel.emptyText, index === 0));
        });
        this.bindHomePanelTabs(container);
        this.scheduleFirstVocabularyPreload(container);

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    bindHomePanelTabs(container) {
        const tabs = Array.from(container.querySelectorAll('.student-home-tab'));
        const panels = Array.from(container.querySelectorAll('.student-home-panel'));
        const activate = (key, focus = false) => {
            tabs.forEach(tab => {
                const active = tab.dataset.panel === key;
                tab.classList.toggle('active', active);
                tab.setAttribute('aria-selected', active ? 'true' : 'false');
                tab.tabIndex = active ? 0 : -1;
                if (active && focus) tab.focus({ preventScroll: true });
            });
            panels.forEach(panel => {
                const active = panel.dataset.panel === key;
                panel.classList.toggle('active', active);
            });
        };

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activate(tab.dataset.panel));
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                let nextIndex = index;
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                activate(tabs[nextIndex].dataset.panel, true);
            });
        });
    }

    createHomePanel(key, title, subtitle, items, emptyText, active = false) {
        const panel = createElement('section', `student-home-panel${active ? ' active' : ''}`);
        panel.id = `student-home-panel-${key}`;
        panel.dataset.panel = key;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', `student-home-tab-${key}`);
        panel.innerHTML = `
            <div class="teacher-panel-header">
                <div>
                    <h3>${title}</h3>
                    <p>${subtitle}</p>
                </div>
            </div>
        `;

        const list = createElement('div', 'student-home-list');
        if (items.length === 0) {
            list.innerHTML = `<p class="teacher-empty-state">${emptyText}</p>`;
        } else {
            items.forEach(item => list.appendChild(this.createHomeUnitCard(item)));
        }
        panel.appendChild(list);
        return panel;
    }

    createHomeUnitCard(item) {
        const { vocab, schedule, progress } = item;
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const card = createElement('button', 'student-home-unit');
        card.type = 'button';
        if (vocab.path) card.dataset.vocabPath = vocab.path;

        const progressText = progress.requiredTotal > 0
            ? `${progress.completedRequired}/${progress.requiredTotal} required`
            : `${progress.bestScore}% best`;

        card.innerHTML = `
            <div class="student-home-unit-icon"><i data-lucide="book-open"></i></div>
            <div class="student-home-unit-copy">
                <strong>${escapeHtml(vocab.name || 'Vocabulary Unit')}</strong>
                <span>${escapeHtml(subject.name)} · ${escapeHtml(schedule.label || this.getTrimesterLabel(this.getVocabTrimesterKey(vocab)))}</span>
            </div>
            <div class="student-home-unit-status">
                <span>${progressText}</span>
                <i data-lucide="chevron-right"></i>
            </div>
        `;
        if (vocab.path) {
            const preload = () => preloadVocabularyFile(vocab.path);
            card.addEventListener('pointerenter', preload, { once: true });
            card.addEventListener('focus', preload, { once: true });
        }
        card.addEventListener('click', () => this.loadVocabulary(vocab));
        return card;
    }

    getTrimesterKey(trimester) {
        const normalized = String(trimester || '').trim().toUpperCase();
        if (normalized === '1' || normalized === 'IT' || normalized === 'T1') return 'IT';
        if (normalized === '2' || normalized === 'IIT' || normalized === 'T2') return 'IIT';
        if (normalized === '3' || normalized === 'IIIT' || normalized === 'T3') return 'IIIT';
        return 'other';
    }

    getVocabTrimesterKey(vocab) {
        if (vocab?.assignedDate && this.sm.schoolCalendar) {
            const placement = calculateVocabularyPlacement(vocab.assignedDate, this.sm.schoolCalendar);
            if (placement?.trimester) return placement.trimester;
        }

        return this.getTrimesterKey(vocab?.trimester);
    }

    getTrimesterLabel(trimester) {
        const key = this.getTrimesterKey(trimester);
        if (key === 'IT') return 'IT';
        if (key === 'IIT') return 'IIT';
        if (key === 'IIIT') return 'IIIT';
        return 'Other Units';
    }

    getTrimesterShortLabel(trimester) {
        return this.getTrimesterLabel(trimester);
    }

    getTrimesterOrder(trimester) {
        const order = {
            IT: 1,
            IIT: 2,
            IIIT: 3,
            other: 99
        };

        return order[this.getTrimesterKey(trimester)] || order.other;
    }

    formatUnitCount(count) {
        return `${count} ${count === 1 ? 'unit' : 'units'}`;
    }

    formatMonthSummary(monthGroups) {
        return Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .map(([monthKey, monthVocabs]) => `${this.getMonthLabel(monthKey)}: ${monthVocabs.length}`)
            .join(' · ');
    }

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

    renderVocabularyBrowser(container = $('#vocab-list'), vocabs = null) {
        if (!container) return;

        container.classList.remove('vocab-grid', 'vocab-groups');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const visibleVocabs = Array.isArray(vocabs) ? vocabs : this.getVisibleVocabularyList().vocabs;
        const drilldown = this.sm.studentVocabularyDrilldown || { trimester: null, month: null };
        const trimesterGroups = this.buildVocabularyTrimesterGroups(visibleVocabs);
        const selectedTrimester = drilldown.trimester;
        const selectedMonth = drilldown.month;

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.sm.studentVocabularyDrilldown = { trimester: null, month: null };
            this.renderStudentTrimesterPicker(container, trimesterGroups);
            return;
        }

        const monthGroups = this.buildVocabularyMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.sm.studentVocabularyDrilldown.month = null;
            this.renderStudentMonthPicker(container, selectedTrimester, monthGroups);
            return;
        }

        this.renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    buildVocabularyTrimesterGroups(vocabs = []) {
        return vocabs.reduce((groups, vocab) => {
            const trimesterKey = this.getVocabTrimesterKey(vocab);
            if (!groups.has(trimesterKey)) groups.set(trimesterKey, []);
            groups.get(trimesterKey).push(vocab);
            return groups;
        }, new Map());
    }

    renderStudentLibraryBreadcrumb(container, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');
        const rootButton = this.createStudentBreadcrumbButton('Vocabulary', () => {
            this.sm.studentVocabularyDrilldown = { trimester: null, month: null };
            this.sm.navigateTo({ view: 'units', all: true });
        });
        nav.appendChild(rootButton);

        if (selectedTrimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createStudentBreadcrumbButton(trimesterLabel, () => {
                    this.sm.studentVocabularyDrilldown = { trimester: selectedTrimester, month: null };
                    this.sm.navigateTo({ view: 'units', trimester: selectedTrimester });
                })
                : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', this.getMonthLabel(selectedMonth)));
        }

        container.appendChild(nav);
    }

    createStudentBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

    renderStudentTrimesterPicker(container, trimesterGroups) {
        this.renderStudentLibraryBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => this.getTrimesterOrder(trimesterA) - this.getTrimesterOrder(trimesterB))
            .forEach(([trimesterKey, trimesterVocabs]) => {
                const card = this.createStudentLibraryChoiceCard({
                    title: this.getTrimesterLabel(trimesterKey),
                    count: this.formatUnitCount(trimesterVocabs.length),
                    meta: this.formatMonthSummary(this.buildVocabularyMonthGroups(trimesterVocabs)),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.sm.studentVocabularyDrilldown = { trimester: trimesterKey, month: null };
                    this.sm.navigateTo({ view: 'units', trimester: trimesterKey });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
        this.refreshIcons();
    }

    renderStudentMonthPicker(container, selectedTrimester, monthGroups) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
            .forEach(([monthKey, monthVocabs]) => {
                const card = this.createStudentLibraryChoiceCard({
                    title: this.getMonthLabel(monthKey),
                    count: this.formatUnitCount(monthVocabs.length),
                    meta: this.getTrimesterLabel(selectedTrimester),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.sm.studentVocabularyDrilldown = {
                        trimester: selectedTrimester,
                        month: monthKey
                    };
                    this.sm.navigateTo({ view: 'units', trimester: selectedTrimester, month: monthKey });
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
        this.refreshIcons();
    }

    renderStudentAssignmentPicker(container, selectedTrimester, selectedMonth, monthVocabs) {
        this.renderStudentLibraryBreadcrumb(container, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
        monthVocabs
            .sort((a, b) => this.compareVocabularySchedule(a, b))
            .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

        container.appendChild(grid);
        this.scheduleFirstVocabularyPreload(container);
    }

    createStudentLibraryChoiceCard({ title, count, meta, icon }) {
        const card = createElement('button', 'teacher-library-choice-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        text.appendChild(createElement('strong', null, title));
        text.appendChild(createElement('span', 'teacher-library-choice-count', count));
        if (meta) text.appendChild(createElement('small', null, meta));
        card.appendChild(text);

        if (icon) {
            const iconEl = createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            card.appendChild(iconEl);
        }

        return card;
    }

    refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    renderVocabularyGroups(container, vocabs) {
        const grouped = vocabs.reduce((groups, vocab) => {
            const key = this.getVocabTrimesterKey(vocab);
            if (!groups[key]) groups[key] = [];
            groups[key].push(vocab);
            return groups;
        }, {});

        ['IT', 'IIT', 'IIIT', 'other'].forEach(trimester => {
            const trimesterVocabs = grouped[trimester];
            if (!trimesterVocabs || trimesterVocabs.length === 0) return;

            const group = createElement('section', 'vocab-trimester-group');
            const heading = createElement('div', 'vocab-trimester-heading');
            heading.innerHTML = `
                <h3>${this.getTrimesterLabel(trimester)}</h3>
                <span>${trimesterVocabs.length} ${trimesterVocabs.length === 1 ? 'unit' : 'units'}</span>
            `;

            const monthGroups = this.buildVocabularyMonthGroups(trimesterVocabs);
            const monthList = createElement('div', 'student-vocab-month-list');
            Array.from(monthGroups.entries())
                .sort(([monthA], [monthB]) => this.getMonthOrder(monthA) - this.getMonthOrder(monthB))
                .forEach(([monthKey, monthVocabs]) => {
                    const monthSection = createElement('section', 'student-vocab-month-group');
                    const monthHeading = createElement('div', 'student-vocab-month-heading');
                    monthHeading.innerHTML = `
                        <h4>${this.getMonthLabel(monthKey)}</h4>
                        <span>${monthVocabs.length} ${monthVocabs.length === 1 ? 'unit' : 'units'}</span>
                    `;

                    const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
                    monthVocabs
                        .sort((a, b) => this.compareVocabularySchedule(a, b))
                        .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

                    monthSection.appendChild(monthHeading);
                    monthSection.appendChild(grid);
                    monthList.appendChild(monthSection);
                });

            group.appendChild(heading);
            group.appendChild(monthList);
            container.appendChild(group);
        });
    }

    buildVocabularyMonthGroups(vocabs = []) {
        return vocabs.reduce((groups, vocab) => {
            const schedule = this.getVocabSchedule(vocab);
            const monthKey = this.normalizeMonthKey(schedule.month);
            if (!groups.has(monthKey)) groups.set(monthKey, []);
            groups.get(monthKey).push(vocab);
            return groups;
        }, new Map());
    }

    normalizeMonthKey(month) {
        const value = String(month || '').trim().toLowerCase();
        const aliases = {
            january: 'january',
            jan: 'january',
            february: 'february',
            feb: 'february',
            march: 'march',
            mar: 'march',
            april: 'april',
            apr: 'april',
            may: 'may',
            june: 'june',
            jun: 'june',
            july: 'july',
            jul: 'july',
            august: 'august',
            aug: 'august',
            september: 'september',
            sept: 'september',
            sep: 'september',
            october: 'october',
            oct: 'october',
            november: 'november',
            nov: 'november',
            december: 'december',
            dec: 'december'
        };

        return aliases[value] || 'other';
    }

    getMonthLabel(monthKey) {
        const labels = {
            january: 'January',
            february: 'February',
            march: 'March',
            april: 'April',
            may: 'May',
            june: 'June',
            july: 'July',
            august: 'August',
            september: 'September',
            october: 'October',
            november: 'November',
            december: 'December',
            other: 'Other'
        };

        return labels[monthKey] || labels.other;
    }

    getMonthOrder(monthKey) {
        if (monthKey in MONTH_INDEX) return MONTH_INDEX[monthKey] + 1;
        return 99;
    }

    compareVocabularySchedule(a, b) {
        const scheduleA = this.getVocabSchedule(a);
        const scheduleB = this.getVocabSchedule(b);
        const dateA = scheduleA.dueDate?.getTime?.() || 0;
        const dateB = scheduleB.dueDate?.getTime?.() || 0;

        if (dateA !== dateB) {
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA - dateB;
        }

        if (scheduleA.week !== scheduleB.week) {
            return (scheduleA.week || 99) - (scheduleB.week || 99);
        }

        return String(a.name || '').localeCompare(String(b.name || ''));
    }

    createVocabularyCard(vocab) {
        const card = createElement('div', 'card option-card');
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const sourceLabel = vocab.__source === 'cloud'
            ? 'Cloud'
            : vocab.__source === 'local'
                ? 'Local'
                : 'Repo';

        card.innerHTML = `
            <div class="icon">${vocab.__source === 'cloud' ? '☁️' : '📚'}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3>${escapeHtml(vocab.name)}</h3>
            <p>${escapeHtml(vocab.description || '')}</p>
            ${vocab.grades ? `<small>Grade: ${escapeHtml(vocab.grades.join(', '))}</small>` : ''}
            <small style="color:var(--text-muted); display:block; margin-top:0.5rem;">${sourceLabel}</small>
        `;
        if (vocab.path) {
            card.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            card.addEventListener('pointerenter', preload, { once: true });
            card.addEventListener('focus', preload, { once: true });
        }
        card.addEventListener('click', () => this.loadVocabulary(vocab));
        return card;
    }

    scheduleFirstVocabularyPreload(container) {
        const firstRepoCard = container.querySelector('[data-vocab-path]');
        const path = firstRepoCard?.dataset?.vocabPath;
        if (!path) return;

        this.scheduleIdleTask(() => {
            preloadVocabularyFile(path);
        }, 1200);
    }

    async loadVocabularyOverride(vocabMeta) {
        if (this.sm.authDisabled || !vocabMeta?.id) return null;

        try {
            const db = supabaseService.getDatabase();
            const snapshot = await getDoc(doc(db, 'vocabularies', vocabMeta.id));
            if (!snapshot.exists()) return null;
            return {
                ...snapshot.data(),
                __source: 'cloud'
            };
        } catch (error) {
            console.warn('Could not load live vocabulary settings:', error);
            return null;
        }
    }

    mergeVocabularyData({ meta = {}, fileData = null, override = null } = {}) {
        const merged = {
            ...meta,
            ...(fileData || {}),
            ...(override || {})
        };

        merged.id = override?.id || fileData?.id || meta.id;
        merged.path = meta.path || override?.path || fileData?.path;
        merged.subjectSlug = getVocabSubjectSlug(merged);
        merged.grades = override?.grades?.length ? override.grades : (fileData?.grades || meta.grades);
        merged.assignedDate = override?.assignedDate || fileData?.assignedDate || meta.assignedDate;
        merged.trimester = override?.trimester || fileData?.trimester || meta.trimester;
        merged.month = override?.month || fileData?.month || meta.month;
        merged.week = override?.week || fileData?.week || meta.week;
        merged.words = Array.isArray(override?.words) && override.words.length > 0
            ? override.words
            : (Array.isArray(fileData?.words) ? fileData.words : (meta.words || []));
        merged.activitySettings = {
            ...(fileData?.activitySettings || {}),
            ...(meta.activitySettings || {}),
            ...(override?.activitySettings || {})
        };
        merged.__source = override?.__source || meta.__source;

        return merged;
    }

    async loadVocabulary(vocabMeta, options = {}) {
        let vocabData = null;
        const override = await this.loadVocabularyOverride(vocabMeta);

        if (vocabMeta.path) {
            const fetched = await loadVocabularyFile(vocabMeta.path, { fresh: true });
            if (fetched) {
                vocabData = this.mergeVocabularyData({ meta: vocabMeta, fileData: fetched, override });
            } else if (override) {
                vocabData = this.mergeVocabularyData({ meta: vocabMeta, override });
            }
        } else {
            vocabData = this.mergeVocabularyData({ meta: vocabMeta, override });
        }

        if (!vocabData) {
            console.error('Failed to load vocabulary data for:', vocabMeta);
            notifications.error('Failed to load vocabulary data. Please try again or contact your teacher.');
            return;
        }

        this.sm.currentVocab = vocabData;

        const unitProgress = this.ensureUnitProgress(this.sm.currentVocab);

        // Load scores into current session (reference to the stored object)
        this.sm.unitScores = unitProgress.scores;
        this.sm.unitImages = unitProgress.images;
        this.sm.unitWordHunt = unitProgress.wordHunt;
        this.sm.unitStates = unitProgress.states;
        
        // Initialize word coverage tracking
        this.initWordCoverage();
        await this.migrateLegacyWordHuntImages();

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId });
            }
        }

        this.showActivityMenu(options);
    }

    showActivityMenu(options = {}) {
        $('#current-unit-title').textContent = this.sm.currentVocab.name;
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(this.sm.currentVocab));
        const subjectEl = $('#current-unit-subject');
        if (subjectEl) {
            subjectEl.textContent = subject.name;
            subjectEl.style.setProperty('--subject-color', subject.color);
        }

        // Get word coverage stats
        const coverageStats = this.getWordCoverageStats();
        const activityFlow = this.getActivityFlowConfig();

        // Update progress on cards
        const cards = $$('.activity-card');
        cards.forEach(card => {
            const type = card.dataset.activity;
            const scoreData = this.sm.unitScores[type];
            let progress = 0;
            let isComplete = false;

            if (scoreData) {
                progress = scoreData.score || 0;
                isComplete = scoreData.isComplete || (progress >= 100);
            }

            // Remove existing badges
            const existingBadge = card.querySelector('.progress-badge');
            if (existingBadge) existingBadge.remove();
            const existingCoverage = card.querySelector('.coverage-badge');
            if (existingCoverage) existingCoverage.remove();
            const existingPlays = card.querySelector('.plays-badge');
            if (existingPlays) existingPlays.remove();

            if (scoreData) {
                const badge = createElement('div', 'progress-badge');
                const nonReplayable = ['flashcards', 'illustration'];
                badge.textContent = nonReplayable.includes(type) ? `${progress}%` : `Best ${progress}%`;
                if (isComplete) badge.classList.add('complete');
                card.appendChild(badge);
                
                // Show plays count for replayable activities
                if (!nonReplayable.includes(type) && scoreData.plays > 0) {
                    const playsBadge = createElement('div', 'plays-badge');
                    playsBadge.textContent = scoreData.plays === 1 ? '1 play' : `${scoreData.plays} plays`;
                    card.appendChild(playsBadge);
                }
            }
            
            // Show word coverage for activities that track it
            if (coverageStats && coverageStats[type] && !['flashcards', 'illustration'].includes(type)) {
                const coverage = coverageStats[type];
                if (coverage.practiced > 0) {
                    const coverageBadge = createElement('div', 'coverage-badge');
                    const allSeen = coverage.practiced >= coverage.total;
                    coverageBadge.textContent = allSeen ? `All ${coverage.total} seen` : `${coverage.practiced} seen`;
                    coverageBadge.title = `${coverage.practiced} of ${coverage.total} unit words have appeared in this activity. New rounds rotate through less-practiced words.`;
                    card.appendChild(coverageBadge);
                }
            }
        });
        this.updateActivityGateDisplay(cards, activityFlow);
        
        // Update overall coverage display if element exists
        this.updateOverallCoverageDisplay(coverageStats);

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId });
            }
        }

        this.sm.switchView('activity-menu-view');
        this.scheduleActivityPreload(activityFlow);
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

    async uploadWordHuntImage(word, blob, imageInfo = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return null;

        const unitProgress = this.getCurrentUnitProgress();
        const path = supabaseService.buildWordHuntImagePath({
            userId: this.sm.currentUser.uid,
            schoolYear: unitProgress.schoolYear,
            trimesterKey: unitProgress.trimester,
            grade: unitProgress.grade,
            unitId: unitProgress.unitId,
            subjectSlug: unitProgress.subjectSlug,
            word
        });

        await supabaseService.uploadWordHuntImage({ path, blob });

        const now = new Date().toISOString();
        return {
            hasImage: true,
            imagePath: path,
            imageSizeBytes: imageInfo.sizeBytes || blob.size,
            imageWidth: imageInfo.width || null,
            imageHeight: imageInfo.height || null,
            imageUpdatedAt: now,
            updatedAt: now,
            pendingImageUpload: false
        };
    }

    async loadWordHuntImage(path) {
        if (this.sm.authDisabled || !path) return null;
        return supabaseService.downloadWordHuntImage(path);
    }

    async downloadWordHuntSubmission() {
        if (!this.sm.currentVocab) return;

        if (this.sm.activityInstance && typeof this.sm.activityInstance.getScore === 'function' && this.sm.currentActivityType) {
            this.sm.unitScores[this.sm.currentActivityType] = this.sm.activityInstance.getScore();
            this.sm.progress.saveLocalProgress();
        }

        const { ReportGenerator } = await import('../reportGenerator.js');
        await ReportGenerator.generateWordHuntReport(this.sm.studentProfile, this.sm.currentVocab, {
            wordHunt: this.sm.unitWordHunt || {},
            loadImage: path => this.loadWordHuntImage(path)
        });
    }

    async migrateLegacyWordHuntImages() {
        if (this.sm.authDisabled || !this.sm.currentUser || !this.sm.currentVocab) return;

        const unitName = this.sm.currentVocab.name;
        const unitProgress = this.getCurrentUnitProgress();
        const images = unitProgress.images || {};
        const wordHunt = unitProgress.wordHunt || {};
        let changed = false;

        for (const [word, dataUrl] of Object.entries(images)) {
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;

            const existingEntry = wordHunt[word] || {};
            if (existingEntry.imagePath) {
                delete images[word];
                changed = true;
                continue;
            }

            try {
                const sourceBlob = await dataUrlToBlob(dataUrl);
                const imageData = await compressImageToWebp(sourceBlob);
                await imageDB.saveDrawing(unitName, word, imageData.blob);
                const metadata = await this.uploadWordHuntImage(word, imageData.blob, imageData);
                wordHunt[word] = {
                    ...existingEntry,
                    ...metadata,
                    hasImage: true,
                    updatedAt: metadata?.updatedAt || new Date().toISOString()
                };
                delete images[word];
                changed = true;
            } catch (error) {
                console.warn('Could not migrate legacy Word Hunt image:', unitName, word, error);
            }
        }

        if (changed) {
            unitProgress.images = images;
            unitProgress.wordHunt = wordHunt;
            this.sm.unitImages = images;
            this.sm.unitWordHunt = wordHunt;
            this.sm.progress.saveLocalProgress();
        }
    }

    async loadActivityClass(type) {
        const loadModule = ACTIVITY_MODULES[type];
        const exportName = ACTIVITY_EXPORTS[type];

        if (!loadModule || !exportName) {
            throw new Error(`Unknown activity type: ${type}`);
        }

        if (!this.activityModulePromises.has(type)) {
            this.activityModulePromises.set(type, loadModule());
        }

        const module = await this.activityModulePromises.get(type);
        const ActivityClass = module[exportName];

        if (!ActivityClass) {
            this.activityModulePromises.delete(type);
            throw new Error(`Activity export ${exportName} was not found.`);
        }

        return ActivityClass;
    }

    async startActivity(type, options = {}) {
        if (!this.sm.currentVocab) {
            this.sm.navigateTo({ view: 'units' });
            return;
        }

        if (!this.sm.isKnownActivityType(type)) {
            this.showActivityMenu({ fromRoute: true });
            return;
        }

        if (!this.isActivityUnlocked(type)) {
            notifications.warning('Finish the required activities first to unlock additional practice.');
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId }, { replace: true });
            }
            this.showActivityMenu({ fromRoute: true });
            return;
        }

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                const route = { view: 'activity', unitId, activityType: type };
                if (type === 'illustration') {
                    route.word = Math.max(1, (options.initialWordIndex || 0) + 1);
                }
                this.sm.setRoute(route);
            }
        }

        this.sm.currentActivityType = type; // Track current activity type
        this.sm.switchView('activity-view');

        const container = $('#activity-container');
        if (this.sm.activityInstance && typeof this.sm.activityInstance.destroy === 'function') {
            this.sm.activityInstance.destroy();
        }
        container.innerHTML = ''; // Clear previous
        container.classList.remove('flashcards-activity-container');
        $('#activity-view')?.classList.remove('flashcards-active');
        container.innerHTML = '<div class="loading-spinner">Loading activity...</div>';

        const onProgress = this.handleAutoSave.bind(this);
        const onSaveState = this.handleStateSave.bind(this);
        const initialState = this.sm.unitStates ? this.sm.unitStates[type] : null;
        const settings = this.sm.currentVocab.activitySettings || {};
        let ActivityClass;

        try {
            ActivityClass = await this.loadActivityClass(type);
        } catch (error) {
            console.error('Failed to load activity module:', error);
            container.innerHTML = '<p class="error">Could not load this activity. Please try again.</p>';
            notifications.error('Could not load this activity.');
            return;
        }

        container.innerHTML = '';
        
        // Helper to get prioritized words (least practiced first)
        const getPrioritized = (limit, filter = null) => {
            let words = filter 
                ? this.sm.currentVocab.words.filter(filter)
                : [...this.sm.currentVocab.words];
            return this.getPrioritizedWords(type, Math.min(limit, words.length), words);
        };

        switch (type) {
            case 'matching':
                const matchingLimit = settings.matching || 10;
                const matchingWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(matchingLimit, w => w.word.length >= 2),
                    w => w.word.length >= 2
                );
                this.sm.activityInstance = new ActivityClass(container, matchingWords, onProgress, onSaveState, initialState);
                // Mark words as used when activity starts
                this.markWordsPracticed(type, matchingWords);
                break;
            case 'flashcards':
                // Flashcards: use all words (non-replayable, study mode)
                const flashcardsLimit = settings.flashcards || this.sm.currentVocab.words.length;
                const flashcardsWords = this.sm.currentVocab.words.slice(0, flashcardsLimit);
                this.sm.activityInstance = new ActivityClass(container, flashcardsWords, onProgress, onSaveState, initialState);
                break;
            case 'quiz':
                const quizLimit = settings.quiz || 10;
                const quizWords = this.restoreWordsFromState(initialState, getPrioritized(quizLimit));
                this.sm.activityInstance = new ActivityClass(container, quizWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, quizWords);
                break;
            case 'synonym-antonym':
                const synonymLimit = settings.synonymAntonym || 10;
                const synonymFilter = w => (w.synonyms?.length > 0 || w.antonyms?.length > 0);
                const synonymWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(synonymLimit, synonymFilter),
                    synonymFilter
                );
                this.sm.activityInstance = new ActivityClass(container, synonymWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, synonymWords);
                break;
            case 'illustration':
                // Illustration: non-replayable, use sequential words
                const illustrationWords = this.getWordHuntWords(settings);
                this.sm.activityInstance = new ActivityClass(
                    container,
                    illustrationWords,
                    this.sm.currentVocab.name,
                    onProgress,
                    this.handleIllustrationSave.bind(this),
                    this.sm.unitWordHunt,
                    {
                        initialIndex: options.initialWordIndex || 0,
                        onWordChange: index => {
                            const unitId = this.sm.getCurrentVocabRouteId();
                            if (!unitId) return;
                            this.sm.setRoute({
                                view: 'activity',
                                unitId,
                                activityType: 'illustration',
                                word: index + 1
                            }, { replace: true });
                        },
                        uploadImage: (word, blob, imageInfo) => this.uploadWordHuntImage(word, blob, imageInfo),
                        loadImage: path => this.loadWordHuntImage(path),
                        onDownloadWordHunt: () => this.downloadWordHuntSubmission()
                    }
                );
                break;
            case 'word-search':
                const wordSearchLimit = settings.wordSearch || 10;
                const wordSearchWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(wordSearchLimit, w => w.word.length >= 4),
                    w => w.word.length >= 4
                );
                // Pass vocab ID (or name as fallback) for stable persistence
                const vocabID = this.sm.currentVocab.id || this.sm.currentVocab.name;
                this.sm.activityInstance = new ActivityClass(
                    container,
                    wordSearchWords,
                    onProgress,
                    vocabID,
                    onSaveState,
                    initialState,
                    {
                        onNewPuzzle: () => {
                            this.resetActivityState('word-search');
                            this.startActivity('word-search', { fromRoute: true }).catch(error => {
                                console.error('Failed to restart word search:', error);
                            });
                        }
                    }
                );
                this.markWordsPracticed(type, this.sm.activityInstance.words);
                break;
            case 'crossword':
                const crosswordWords = getPrioritized(this.sm.currentVocab.words.length);
                this.sm.activityInstance = new ActivityClass(container, crosswordWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, this.sm.activityInstance.placedWords);
                break;
            case 'hangman':
                const hangmanWords = getPrioritized(this.sm.currentVocab.words.length);
                this.sm.activityInstance = new ActivityClass(container, hangmanWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, hangmanWords);
                break;
            case 'scramble':
                const scrambleWords = getPrioritized(this.sm.currentVocab.words.length);
                this.sm.activityInstance = new ActivityClass(container, scrambleWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, scrambleWords);
                break;
            case 'wordle':
                const wordleLimit = settings.wordle || 10;
                const wordleWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(wordleLimit, w => {
                        const cleanWord = w.word.replace(/[^a-zA-Z]/g, '');
                        return /^[a-zA-Z\s-]+$/.test(w.word) && cleanWord.length >= 3 && cleanWord.length <= 10;
                    }),
                    w => {
                        const cleanWord = w.word.replace(/[^a-zA-Z]/g, '');
                        return /^[a-zA-Z\s-]+$/.test(w.word) && cleanWord.length >= 3 && cleanWord.length <= 10;
                    }
                );
                this.sm.activityInstance = new ActivityClass(container, wordleWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, wordleWords);
                break;
            case 'speed-match':
                // Speed match uses all words randomly during gameplay
                this.sm.activityInstance = new ActivityClass(container, this.sm.currentVocab.words, onProgress, onSaveState, initialState);
                // Mark all words as potentially practiced
                this.markWordsPracticed(type, this.sm.currentVocab.words);
                break;
            case 'fill-in-blank':
                const fibWords = getPrioritized(this.sm.currentVocab.words.length, w => w.example);
                this.sm.activityInstance = new ActivityClass(container, fibWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, fibWords);
                break;
            default:
                container.innerHTML = `<p>Activity ${type} not implemented yet.</p>`;
                this.sm.activityInstance = null;
        }
    }

    handleAutoSave(scoreData) {
        if (this.sm.currentVocab && this.sm.currentActivityType) {
            const activityType = this.sm.currentActivityType;
            const settings = this.sm.currentVocab.activitySettings || {};
            const progressReward = settings.progressReward !== undefined ? settings.progressReward : 1;
            const completionBonus = settings.completionBonus !== undefined ? settings.completionBonus : 50;
            
            // Non-replayable activities (flashcards, illustration) - only reward first-time progress
            const nonReplayable = ['flashcards', 'illustration'];
            
            if (nonReplayable.includes(activityType)) {
                // Original behavior: only reward if new score > old score
                const oldScoreData = this.sm.unitScores[activityType];
                const oldScore = oldScoreData ? (oldScoreData.score || 0) : 0;
                const newScore = scoreData.score || 0;

                if (newScore > oldScore) {
                    const stepsOld = Math.floor(oldScore / 10);
                    const stepsNew = Math.floor(newScore / 10);
                    const stepsGained = stepsNew - stepsOld;
                    let totalReward = Math.max(0, stepsGained * progressReward);

                    if (newScore === 100 && oldScore < 100) {
                        totalReward += completionBonus;
                    }

                    if (totalReward > 0) {
                        this.sm.progress.addCoins(totalReward);
                    }
                }
                
                this.sm.unitScores[activityType] = scoreData;
            } else {
                // Replayable activities: track best score + total plays + earn coins on each play
                const oldScoreData = this.sm.unitScores[activityType] || { score: 0, plays: 0, totalEarned: 0 };
                const oldScore = oldScoreData.score || 0;
                const newScore = scoreData.score || 0;
                
                // Track session progress for coin rewards
                if (!this.sm.sessionProgress) this.sm.sessionProgress = {};
                if (!this.sm.sessionProgress[activityType]) {
                    this.sm.sessionProgress[activityType] = { lastScore: 0 };
                }
                
                const sessionLastScore = this.sm.sessionProgress[activityType].lastScore;
                
                // Award coins for progress within this session
                if (newScore > sessionLastScore) {
                    const stepsOld = Math.floor(sessionLastScore / 10);
                    const stepsNew = Math.floor(newScore / 10);
                    const stepsGained = stepsNew - stepsOld;
                    let totalReward = Math.max(0, stepsGained * progressReward);

                    // Completion bonus only once per session
                    if (newScore === 100 && sessionLastScore < 100) {
                        totalReward += completionBonus;
                    }

                    if (totalReward > 0) {
                        this.sm.progress.addCoins(totalReward);
                        oldScoreData.totalEarned = (oldScoreData.totalEarned || 0) + totalReward;
                    }
                }
                
                this.sm.sessionProgress[activityType].lastScore = newScore;
                
                // Update best score and increment plays on completion
                if (scoreData.isComplete) {
                    oldScoreData.plays = (oldScoreData.plays || 0) + 1;
                    this.sm.sessionProgress[activityType].lastScore = 0; // Reset for next play
                }
                
                // Keep best score
                oldScoreData.score = Math.max(oldScore, newScore);
                oldScoreData.details = scoreData.details;
                oldScoreData.isComplete = oldScoreData.isComplete || scoreData.isComplete;
                oldScoreData.lastPlayed = new Date().toISOString();
                
                this.sm.unitScores[activityType] = oldScoreData;
            }
            
            this.sm.progress.saveLocalProgress();
            this.scheduleActivityPreload();

            // Update in-game progress indicator
            const indicator = $('#activity-progress-indicator');
            if (indicator) {
                const percent = scoreData.score || 0;
                indicator.textContent = `Progress: ${percent}%`;
                indicator.classList.remove('hidden');
            }
        }
    }
    
    // Reset activity state for replay
    resetActivityState(activityType) {
        if (!this.sm.currentVocab) return;
        
        const vocabName = this.sm.currentVocab.name;
        const vocabID = this.sm.currentVocab.id || vocabName;
        
        // Clear localStorage state
        const stateKeys = [
            `flashcards_state_${this.sm.currentVocab.words[0]?.word || 'empty'}_${this.sm.currentVocab.words.length}`,
            `flashcards_state_${this.sm.currentVocab.words.length}`,
            `hangman_state_${this.sm.currentVocab.words.length}`,
            `scramble_state_${this.sm.currentVocab.words.length}`,
            `wordle_state_${this.sm.currentVocab.words.length}`,
            `crossword_state_${this.sm.currentVocab.words.length}`,
            `fib_state_${this.sm.currentVocab.words.length}`,
            `matching_state_${this.sm.currentVocab.words[0]?.word}_${this.sm.currentVocab.words.length}`,
            `quiz_state_${this.sm.currentVocab.words[0]?.word || 'empty'}_${this.sm.currentVocab.words.length}`,
            `synonym_antonym_state_${this.sm.currentVocab.words[0]?.word || 'empty'}_${this.sm.currentVocab.words.length}`,
            `word_search_state_${vocabID}`,
            `speedmatch_highscore_${this.sm.currentVocab.words.length}`
        ];
        
        stateKeys.forEach(key => {
            localStorage.removeItem(key);
            localStorage.removeItem(key.trim()); // Handle keys with trailing spaces
        });
        
        // Clear saved state in progress data
        if (this.sm.unitStates && this.sm.unitStates[activityType]) {
            delete this.sm.unitStates[activityType];
        }

        if (activityType === 'illustration') {
            localStorage.removeItem(`word_hunt_state_${vocabName}_${this.sm.currentVocab.words.length}`);
            const progressKey = this.getUnitProgressKey(this.sm.currentVocab);
            if (this.sm.progressData.units[progressKey]?.wordHunt) {
                delete this.sm.progressData.units[progressKey].wordHunt;
            }
            this.sm.unitWordHunt = {};
        }
        
        // Reset session progress
        if (this.sm.sessionProgress && this.sm.sessionProgress[activityType]) {
            this.sm.sessionProgress[activityType].lastScore = 0;
        }

        this.sm.progress.saveLocalProgress();
    }

    handleIllustrationSave(vocabName, word, payload) {
        const unitName = vocabName || (this.sm.currentVocab ? this.sm.currentVocab.name : null);
        if (!unitName) return;
        const unitProgress = this.sm.currentVocab && this.sm.currentVocab.name === unitName
            ? this.getCurrentUnitProgress()
            : (this.sm.progressData.units?.[unitName] || null);
        if (!unitProgress) return;

        if (!unitProgress.images) unitProgress.images = {};
        if (!unitProgress.wordHunt) unitProgress.wordHunt = {};

        if (typeof payload === 'string') {
            console.warn('Ignored legacy base64 Word Hunt image payload.');
        } else if (payload && typeof payload === 'object') {
            if (payload.entry) {
                unitProgress.wordHunt[word] = payload.entry;

                if (payload.entry.imagePath && typeof unitProgress.images[word] === 'string') {
                    delete unitProgress.images[word];
                }
            }
        }

        if (this.sm.currentVocab && this.sm.currentVocab.name === unitName) {
            this.sm.unitImages = unitProgress.images;
            this.sm.unitWordHunt = unitProgress.wordHunt;
        }
        this.sm.progress.saveLocalProgress();
    }

    sanitizeActivityState(stateData) {
        if (stateData === null) return null;

        try {
            const serialized = JSON.stringify(stateData);
            if (/data:image\/|base64/i.test(serialized)) {
                console.warn('Rejected activity state because it contains image data.');
                return undefined;
            }

            const byteLength = new TextEncoder().encode(serialized).length;
            if (byteLength > 50 * 1024) {
                console.warn(`Rejected activity state above 50 KB (${byteLength} bytes).`);
                return undefined;
            }

            return JSON.parse(serialized);
        } catch (error) {
            console.warn('Rejected invalid activity state:', error);
            return undefined;
        }
    }

    handleStateSave(stateData) {
        if (this.sm.currentVocab && this.sm.currentActivityType) {
            const sanitizedState = this.sanitizeActivityState(stateData);
            if (sanitizedState === undefined) return;

            const unitProgress = this.getCurrentUnitProgress();
            if (!unitProgress.states) unitProgress.states = {};

            if (sanitizedState === null) {
                delete unitProgress.states[this.sm.currentActivityType];
            } else {
                unitProgress.states[this.sm.currentActivityType] = sanitizedState;
            }

            this.sm.unitStates = unitProgress.states;
            this.sm.progress.saveLocalProgress();
        }
    }
}
