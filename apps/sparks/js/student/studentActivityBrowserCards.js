import { formatVocabularyPurpose, getVocabularyPurposeClass, scheduleFirstVocabularyPreload } from './studentVocabularyPresentation.js';
import { createLibraryChoiceCard, createLibraryRowList, createLibraryRow } from '../learningLibraryView.js';
import { createVocabularyCard, formatVocabularyCardTitle, formatVocabularyCardDescription } from '../vocabularyCardView.js';
import { createElement, escapeHtml, refreshIcons } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from '../services/vocabularyApi.js';

export class StudentActivityBrowserCards {
    constructor(browser) {
        this.browser = browser;
        this.activities = browser.activities;
        this.sm = browser.sm;
        this.calendar = browser.calendar;
        this.schedule = browser.schedule;
        this.vocabularyData = browser.vocabularyData;
    }

    createStudentLibraryChoiceCard(options) { return createLibraryChoiceCard(options); }
    createStudentVocabRowList(headers = []) { return createLibraryRowList(headers); }
    createStudentVocabRow(options) { return createLibraryRow(options); }

    refreshIcons(root = document) {
        refreshIcons(root);
    }

    renderVocabularyGroups(container, vocabs) {
        const visibleVocabs = this.schedule.filterStudentAvailableVocabulary(vocabs);
        const grouped = visibleVocabs.reduce((groups, vocab) => {
            const key = this.schedule.getVocabTrimesterKey(vocab);
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
                <h3>${this.schedule.getTrimesterLabel(trimester)}</h3>
                <span>${trimesterVocabs.length} ${trimesterVocabs.length === 1 ? 'unit' : 'units'}</span>
            `;

            const monthGroups = this.schedule.buildVocabularyMonthGroups(trimesterVocabs);
            const monthList = createElement('div', 'student-vocab-month-list');
            Array.from(monthGroups.entries())
                .sort(([monthA], [monthB]) => this.schedule.getMonthOrder(monthA) - this.schedule.getMonthOrder(monthB))
                .forEach(([monthKey, monthVocabs]) => {
                    const monthSection = createElement('section', 'student-vocab-month-group');
                    const monthHeading = createElement('div', 'student-vocab-month-heading');
                    monthHeading.innerHTML = `
                        <h4>${this.schedule.getMonthLabel(monthKey)}</h4>
                        <span>${monthVocabs.length} ${monthVocabs.length === 1 ? 'unit' : 'units'}</span>
                    `;

                    const grid = createElement('div', 'vocab-grid trimester-vocab-grid');
                    monthVocabs
                        .sort((a, b) => this.schedule.compareVocabularySchedule(a, b))
                        .forEach(vocab => grid.appendChild(this.createVocabularyCard(vocab)));

                    monthSection.appendChild(monthHeading);
                    monthSection.appendChild(grid);
                    monthList.appendChild(monthSection);
                });

            group.appendChild(heading);
            group.appendChild(monthList);
            container.appendChild(group);
        });
        this.refreshIcons(container);
    }

    createVocabularyCard(vocab) {
        const card = createVocabularyCard.call(this, vocab);
        this.markEmberUnit(card, vocab);
        return card;
    }

    createVocabularyRow(vocab) {
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const schedule = this.schedule.getVocabSchedule(vocab);
        const title = this.formatVocabularyCardTitle(vocab);
        const purposeLabel = this.formatVocabularyPurpose(vocab.purpose);
        const monthLabel = this.schedule.getMonthLabel(schedule.month);
        const weekLabel = schedule.week ? `Week ${schedule.week}` : 'No week';
        const progress = this.getVocabularyRequiredProgress(vocab);
        const progressState = progress.isComplete
            ? 'is-complete'
            : (progress.percent > 0 ? 'is-in-progress' : 'is-not-started');
        const progressLabel = progress.isComplete
            ? 'Complete'
            : (progress.percent > 0 ? 'In progress' : 'Not started');
        const row = createElement('button', 'student-vocab-row student-vocab-unit-row');
        row.type = 'button';
        row.style.setProperty('--subject-color', subject.color);
        row.classList.add(progressState);
        row.setAttribute('aria-label', `${title}. ${purposeLabel}. ${progress.ariaLabel}.`);
        row.innerHTML = `
            <strong>${escapeHtml(title)}</strong>
            <span class="student-vocab-row-month">${escapeHtml(monthLabel)}</span>
            <span class="student-vocab-row-week">${escapeHtml(weekLabel)}</span>
            <span class="student-vocab-purpose student-vocab-row-type ${escapeHtml(this.getVocabularyPurposeClass(vocab.purpose))}">${escapeHtml(purposeLabel)}</span>
            <span class="student-vocab-row-progress ${progressState}" aria-label="${escapeHtml(progress.ariaLabel)}">
                <strong>${progress.percent}%</strong>
                <small>${progressLabel}</small>
            </span>
            <i data-lucide="arrow-right"></i>
        `;
        if (vocab.path) {
            row.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            row.addEventListener('pointerenter', preload, { once: true });
            row.addEventListener('focus', preload, { once: true });
        }
        row.addEventListener('click', () => this.vocabularyData.loadVocabulary(vocab));
        this.markEmberUnit(row, vocab);
        return row;
    }

    markEmberUnit(element, vocab) {
        const progress = this.getVocabularyRequiredProgress(vocab);
        element.dataset.emberUnit = String(vocab.id);
        element.dataset.emberRequiredTotal = String(progress.total);
        element.dataset.emberRequiredCompleted = String(progress.completed);
    }

    getVocabularyRequiredProgress(vocab) {
        const completion = this.activities.getUnitRequiredCompletion(vocab);
        const completed = Math.max(0, Number(completion?.completed) || 0);
        const total = Math.max(0, Number(completion?.total) || 0);
        const percent = total > 0
            ? Math.min(100, Math.round((completed / total) * 100))
            : 0;
        const isComplete = total > 0 && completed >= total;
        const actionLabel = isComplete ? 'Review unit' : percent > 0 ? 'Continue unit' : 'Start unit';

        return {
            completed,
            total,
            percent,
            isComplete,
            actionLabel,
            ariaLabel: `${percent}% complete: ${completed} of ${total} required activities`
        };
    }

    formatVocabularyCardTitle(vocab) { return formatVocabularyCardTitle(vocab); }

    formatVocabularyPurpose(purpose) { return formatVocabularyPurpose(purpose); }

    getVocabularyPurposeClass(purpose) { return getVocabularyPurposeClass(purpose); }

    formatVocabularyScheduleLabel(vocab) {
        const schedule = this.schedule.getVocabSchedule(vocab);
        return schedule.label || this.schedule.getTrimesterLabel(this.schedule.getVocabTrimesterKey(vocab));
    }

    formatVocabularyCardDescription(vocab, title) { return formatVocabularyCardDescription(vocab, title); }

    scheduleFirstVocabularyPreload(container) {
        return scheduleFirstVocabularyPreload(container, this.calendar);
    }
}
