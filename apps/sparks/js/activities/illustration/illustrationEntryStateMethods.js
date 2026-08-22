import { WORD_HUNT_TEXT_RULES } from '../../services/wordHuntQuality.js';
import {
    getStudentWordHuntStorageKey,
    quarantineLegacyStudentStorageKey,
    readStudentJson,
    writeStudentJson
} from '../../student/persistence/studentStorage.js';

export const illustrationEntryStateMethods = {
getStorageKey() {
        return getStudentWordHuntStorageKey(this.vocabName, this.words.length, this.ownerUserId);
    },

getLegacyStorageKey() {
        return `word_hunt_state_${this.vocabName}_${this.words.length}`;
    },

mergeEntries(initialData) {
        const stored = this.loadLocalEntries();
        const initialEntries = initialData && typeof initialData === 'object' ? initialData : {};
        const storedEntries = stored && typeof stored === 'object' ? stored : {};
        const merged = { ...initialEntries };

        Object.entries(storedEntries).forEach(([word, entry]) => {
            const initialEntry = initialEntries[word] || {};
            merged[word] = {
                ...initialEntry,
                ...entry,
                imagePath: entry.imagePath || initialEntry.imagePath || '',
                imageSizeBytes: entry.imageSizeBytes || initialEntry.imageSizeBytes || null,
                imageWidth: entry.imageWidth || initialEntry.imageWidth || null,
                imageHeight: entry.imageHeight || initialEntry.imageHeight || null,
                imageUpdatedAt: entry.imageUpdatedAt || initialEntry.imageUpdatedAt || null
            };
        });

        return merged;
    },

loadLocalEntries() {
        try {
            quarantineLegacyStudentStorageKey(this.getLegacyStorageKey());
            return readStudentJson(`word-hunt:${this.vocabName}:${this.words.length}`, {}, {
                owner: this.ownerUserId
            });
        } catch (error) {
            console.error('Failed to load word hunt state', error);
            return {};
        }
    },

normalizeEntry(entry = {}) {
        return {
            definition: typeof entry.definition === 'string' ? entry.definition : '',
            exampleOne: typeof entry.exampleOne === 'string' ? entry.exampleOne : '',
            exampleTwo: typeof entry.exampleTwo === 'string' ? entry.exampleTwo : '',
            hasImage: Boolean(entry.hasImage),
            imagePath: typeof entry.imagePath === 'string' ? entry.imagePath : '',
            imageSizeBytes: Number.isFinite(Number(entry.imageSizeBytes)) ? Number(entry.imageSizeBytes) : null,
            imageWidth: Number.isFinite(Number(entry.imageWidth)) ? Number(entry.imageWidth) : null,
            imageHeight: Number.isFinite(Number(entry.imageHeight)) ? Number(entry.imageHeight) : null,
            imageUpdatedAt: entry.imageUpdatedAt || null,
            pendingImageUpload: Boolean(entry.pendingImageUpload),
            updatedAt: entry.updatedAt || null
        };
    },

getCurrentWord() {
        return this.words[this.currentIndex];
    },

clampIndex(index) {
        const numericIndex = Number.parseInt(index, 10);
        if (!Number.isFinite(numericIndex) || numericIndex < 0) return 0;
        return Math.min(numericIndex, Math.max(0, this.words.length - 1));
    },

setCurrentIndex(index, notify = true) {
        this.currentIndex = this.clampIndex(index);
        if (notify && this.onWordChange) {
            this.onWordChange(this.currentIndex);
        }
        this.renderWord();
        this.checkProgress();
    },

getEntry(word = this.getCurrentWord()?.word) {
        if (!word) return this.normalizeEntry();
        this.entries[word] = this.normalizeEntry(this.entries[word]);
        return this.entries[word];
    },

hasMeaningfulText(value, rules = WORD_HUNT_TEXT_RULES.definition) {
        const text = String(value || '').trim();
        if (text.length < rules.minChars) return false;
        return text.split(/\s+/).filter(Boolean).length >= rules.minWords;
    },

getEntryQuality(entry = {}) {
        const normalized = this.normalizeEntry(entry);
        const quality = {
            definition: this.hasMeaningfulText(normalized.definition, WORD_HUNT_TEXT_RULES.definition),
            image: Boolean(normalized.hasImage),
            examples: (
                this.hasMeaningfulText(normalized.exampleOne, WORD_HUNT_TEXT_RULES.example) &&
                this.hasMeaningfulText(normalized.exampleTwo, WORD_HUNT_TEXT_RULES.example)
            )
        };
        quality.complete = Object.values(quality).every(Boolean);
        return quality;
    },

isEntryComplete(entry) {
        return this.getEntryQuality(entry).complete;
    },

getCompletedCount() {
        return this.words.filter(word => this.isEntryComplete(this.getEntry(word.word))).length;
    },

updateEntryField(field, value) {
        const word = this.getCurrentWord()?.word;
        if (!word) return;

        const entry = this.getEntry(word);
        entry[field] = value;
        entry.updatedAt = new Date().toISOString();
        this.saveEntry(word);
        this.updateLiveStatus();
    },

persistLocalEntries() {
        writeStudentJson(`word-hunt:${this.vocabName}:${this.words.length}`, this.entries, {
            owner: this.ownerUserId
        });
    },

getWordHuntEntries() {
        return Object.fromEntries(
            Object.entries(this.entries || {}).map(([word, entry]) => [
                word,
                this.normalizeEntry(entry)
            ])
        );
    },

saveEntry(word) {
        const entry = this.getEntry(word);
        this.persistLocalEntries();

        if (typeof this.onWordHuntSave === 'function') {
            this.onWordHuntSave(this.vocabName, word, {
                entry: { ...entry }
            });
        }

        this.checkProgress();
    },

checkProgress() {
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }
    },

getScore() {
        const total = this.words.length;
        const count = this.getCompletedCount();
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);

        return {
            score: percentage,
            details: `Completed ${count}/${total} word hunts`,
            evidence: { correctCount: count, totalCount: total },
            isComplete: total > 0 && count === total
        };
    },
};

