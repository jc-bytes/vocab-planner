import { createElement, escapeHtml } from './main.js';
import { getSubjectBySlug, getVocabSubjectSlug, preloadVocabularyFile } from './services/vocabularyApi.js';

export function createVocabularyCard(vocab) {
        const card = createElement('button', 'card option-card student-vocab-card');
        card.type = 'button';
        const subject = getSubjectBySlug(this.sm.subjects, getVocabSubjectSlug(vocab));
        const title = this.formatVocabularyCardTitle(vocab);
        const purposeLabel = this.formatVocabularyPurpose(vocab.purpose);
        const purposeClass = this.getVocabularyPurposeClass(vocab.purpose);
        const scheduleLabel = this.formatVocabularyScheduleLabel(vocab);
        const description = this.formatVocabularyCardDescription(vocab, title);
        const progress = this.getVocabularyRequiredProgress(vocab);
        const iconName = String(vocab.purpose || '').toLowerCase() === 'summative'
            ? 'clipboard-check'
            : 'book-open';

        card.style.setProperty('--subject-color', subject.color);
        card.classList.add(purposeClass);
        card.classList.toggle('has-progress', progress.percent > 0);
        card.classList.toggle('is-required-complete', progress.isComplete);
        card.ariaLabel = `${title}. ${purposeLabel}. ${progress.ariaLabel}`;

        card.innerHTML = `<div class="student-vocab-card-head"><span class="student-vocab-icon" aria-hidden="true"><i data-lucide="${iconName}"></i></span><span class="student-vocab-card-meta"><span class="student-vocab-schedule">${escapeHtml(scheduleLabel)}</span><strong class="student-vocab-progress-percent">${progress.percent}%</strong></span></div><div class="student-vocab-copy"><h3>${escapeHtml(title)}</h3><span class="student-vocab-purpose ${purposeClass}">${escapeHtml(purposeLabel)}</span><p data-vocab-description>${escapeHtml(description)}</p></div><span class="student-vocab-required-progress" aria-label="${escapeHtml(progress.ariaLabel)}"><span class="student-vocab-required-progress-copy"><span>Required activities</span><strong>${progress.completed} of ${progress.total}</strong></span><span class="student-vocab-required-progress-track" aria-hidden="true"><span style="width:${progress.percent}%"></span></span></span>`;
        if (vocab.path) {
            card.dataset.vocabPath = vocab.path;
            const preload = () => preloadVocabularyFile(vocab.path);
            card.addEventListener('pointerenter', preload, { once: true });
            card.addEventListener('focus', preload, { once: true });
        }
        card.addEventListener('click', () => this.vocabularyData.loadVocabulary(vocab));
        return card;
    }


export function formatVocabularyCardTitle(vocab) {
        let title = String(vocab?.name || 'Vocabulary Unit').trim();
        title = title.replace(/^Grade\s+\d+\s+(?:I{1,3}T|T\d)\s+/i, '');
        title = title.replace(/^(Practice|Summative)\s*:\s*/i, '');
        title = title.replace(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+Week\s+\d{1,2}\s*[-:]\s*/i, '');
        return title || 'Vocabulary Unit';
    }


export function formatVocabularyCardDescription(vocab, title) {
        const raw = String(vocab?.description || '').trim();
        if (!raw) {
            return `Practice the key terms for ${title.toLowerCase()}.`;
        }

        if (/^practice words for grade \d+ second-trimester python and data work\.?$/i.test(raw)) {
            return `Practice the terms you need for ${title.toLowerCase()} activities.`;
        }

        if (/^ten core second-trimester words for the grade \d+ python and data vocabulary table\.?$/i.test(raw)) {
            return 'Review the core Python and data terms for the second-trimester vocabulary check.';
        }

        return raw;
    }

