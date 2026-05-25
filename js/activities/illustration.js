import { createElement, $ } from '../main.js';
import { imageDB } from '../db.js';
import { compressImageToWebp } from '../imageUtils.js';

export class IllustrationActivity {
    constructor(container, words, vocabName, onProgress, onWordHuntSave, initialData = null, options = {}) {
        this.container = container;
        this.words = words;
        this.vocabName = vocabName;
        this.onProgress = onProgress;
        this.onWordHuntSave = onWordHuntSave;
        this.onWordChange = typeof options.onWordChange === 'function' ? options.onWordChange : null;
        this.uploadImage = typeof options.uploadImage === 'function' ? options.uploadImage : null;
        this.loadRemoteImage = typeof options.loadImage === 'function' ? options.loadImage : null;
        this.onDownloadWordHunt = typeof options.onDownloadWordHunt === 'function' ? options.onDownloadWordHunt : null;
        this.currentIndex = this.clampIndex(options.initialIndex || 0);
        this.entries = this.mergeEntries(initialData);
        this.previewImage = null;
        this.previewUrl = null;
        this.pasteHandler = null;

        this.init();
    }

    getStorageKey() {
        return `word_hunt_state_${this.vocabName}_${this.words.length}`;
    }

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
    }

    loadLocalEntries() {
        try {
            return JSON.parse(localStorage.getItem(this.getStorageKey()) || '{}');
        } catch (error) {
            console.error('Failed to load word hunt state', error);
            return {};
        }
    }

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
    }

    getCurrentWord() {
        return this.words[this.currentIndex];
    }

    clampIndex(index) {
        const numericIndex = Number.parseInt(index, 10);
        if (!Number.isFinite(numericIndex) || numericIndex < 0) return 0;
        return Math.min(numericIndex, Math.max(0, this.words.length - 1));
    }

    setCurrentIndex(index, notify = true) {
        this.currentIndex = this.clampIndex(index);
        if (notify && this.onWordChange) {
            this.onWordChange(this.currentIndex);
        }
        this.renderWord();
        this.checkProgress();
    }

    getEntry(word = this.getCurrentWord()?.word) {
        if (!word) return this.normalizeEntry();
        this.entries[word] = this.normalizeEntry(this.entries[word]);
        return this.entries[word];
    }

    isEntryComplete(entry) {
        return Boolean(
            entry?.hasImage &&
            entry.definition?.trim() &&
            entry.exampleOne?.trim() &&
            entry.exampleTwo?.trim()
        );
    }

    getCompletedCount() {
        return this.words.filter(word => this.isEntryComplete(this.getEntry(word.word))).length;
    }

    async init() {
        this.destroyPasteListener();
        this.container.innerHTML = '';

        if (this.words.length === 0) {
            const emptyState = createElement('div', 'matching-empty-state');
            emptyState.innerHTML = '<h2>Word Hunt</h2><p>No words are available for this unit.</p>';
            this.container.appendChild(emptyState);
            this.checkProgress();
            return;
        }

        await this.refreshImageStatus();
        this.renderWord();
        this.checkProgress();
    }

    async refreshImageStatus() {
        for (const word of this.words) {
            const entry = this.getEntry(word.word);
            const blob = await imageDB.getDrawing(this.vocabName, word.word);
            if (blob) {
                entry.hasImage = true;
                if (entry.pendingImageUpload) {
                    await this.uploadStoredImage(word.word, blob, entry);
                }
                continue;
            }

            if (entry.imagePath && this.loadRemoteImage) {
                try {
                    const remoteBlob = await this.loadRemoteImage(entry.imagePath);
                    if (remoteBlob) {
                        await imageDB.saveDrawing(this.vocabName, word.word, remoteBlob);
                        entry.hasImage = true;
                        entry.pendingImageUpload = false;
                    }
                } catch (error) {
                    console.warn('Could not restore Word Hunt image from Storage:', error);
                }
            }
        }

        this.persistLocalEntries();
    }

    renderWord() {
        this.destroyPasteListener();
        this.container.innerHTML = '';

        const word = this.getCurrentWord();
        const entry = this.getEntry(word.word);

        const wrapper = createElement('div', 'word-hunt-wrapper');
        wrapper.appendChild(this.createHeader(word, entry));
        wrapper.appendChild(this.createResearchActions(word));
        wrapper.appendChild(this.createHuntGrid(word, entry));
        wrapper.appendChild(this.createStatusPanel(entry));
        this.container.appendChild(wrapper);

        this.previewImage = this.container.querySelector('#word-hunt-preview');
        this.loadImage();

        this.pasteHandler = event => this.handlePaste(event);
        window.addEventListener('paste', this.pasteHandler);
    }

    createHeader(word, entry) {
        const header = createElement('div', 'word-hunt-header');

        const copy = createElement('div', 'word-hunt-title');
        const eyebrow = createElement('span');
        eyebrow.textContent = `Word ${this.currentIndex + 1} of ${this.words.length}`;
        const title = createElement('h2');
        title.textContent = 'Word Hunt';
        const wordText = createElement('strong');
        wordText.textContent = word.word || '';
        copy.appendChild(eyebrow);
        copy.appendChild(title);
        copy.appendChild(wordText);

        const nav = createElement('div', 'word-hunt-nav');
        const previous = createElement('button', 'btn secondary-btn', 'Previous');
        previous.type = 'button';
        previous.disabled = this.currentIndex === 0;
        previous.addEventListener('click', () => this.navigate(-1));

        const next = createElement('button', 'btn primary-btn', this.currentIndex === this.words.length - 1 ? 'Finish' : 'Next');
        next.type = 'button';
        next.disabled = !this.isEntryComplete(entry);
        next.addEventListener('click', () => this.navigate(1));

        nav.appendChild(previous);
        if (this.onDownloadWordHunt) {
            const download = createElement('button', 'btn secondary-btn', 'Download');
            download.type = 'button';
            download.addEventListener('click', () => this.downloadWordHunt());
            nav.appendChild(download);
        }
        nav.appendChild(next);
        header.appendChild(copy);
        header.appendChild(nav);

        return header;
    }

    createResearchActions(word) {
        const actions = createElement('div', 'word-hunt-actions');
        const searchTerm = word.word || '';
        const links = [
            ['Definition', `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} definition`)}`],
            ['Image', `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTerm)}`],
            ['Examples', `https://www.google.com/search?q=${encodeURIComponent(`${searchTerm} example sentence`)}`]
        ];

        links.forEach(([label, href]) => {
            const button = createElement('button', 'btn secondary-btn word-hunt-search-link', label);
            button.type = 'button';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                window.open(href, '_blank', 'noopener,noreferrer');
            });
            actions.appendChild(button);
        });

        return actions;
    }

    createHuntGrid(word, entry) {
        const grid = createElement('div', 'word-hunt-grid');

        grid.appendChild(this.createTextField({
            id: 'word-hunt-definition',
            label: 'Definition',
            value: entry.definition,
            placeholder: `Write a definition for ${word.word}`,
            field: 'definition'
        }));

        grid.appendChild(this.createImagePanel(entry));

        grid.appendChild(this.createTextField({
            id: 'word-hunt-example-one',
            label: 'Example 1',
            value: entry.exampleOne,
            placeholder: `Use ${word.word} in a sentence`,
            field: 'exampleOne'
        }));

        grid.appendChild(this.createTextField({
            id: 'word-hunt-example-two',
            label: 'Example 2',
            value: entry.exampleTwo,
            placeholder: `Write a second example with ${word.word}`,
            field: 'exampleTwo'
        }));

        return grid;
    }

    createTextField({ id, label, value, placeholder, field }) {
        const group = createElement('div', 'word-hunt-field');
        const labelEl = document.createElement('label');
        labelEl.setAttribute('for', id);
        labelEl.textContent = label;

        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.rows = field === 'definition' ? 4 : 3;
        textarea.placeholder = placeholder;
        textarea.value = value || '';
        textarea.addEventListener('input', event => this.updateEntryField(field, event.target.value));

        group.appendChild(labelEl);
        group.appendChild(textarea);
        return group;
    }

    createImagePanel(entry) {
        const panel = createElement('div', 'word-hunt-image-panel');
        const label = createElement('div', 'word-hunt-image-label');
        label.textContent = 'Image';

        const uploadArea = createElement('div', 'word-hunt-upload-area');
        uploadArea.tabIndex = 0;

        const instruction = createElement('p');
        instruction.textContent = entry.hasImage ? 'Image saved. Paste or upload to replace it.' : 'Paste an image or upload a file.';

        const uploadAction = createElement('span', 'word-hunt-upload-action');
        uploadAction.textContent = entry.hasImage ? 'Replace Image' : 'Choose Image';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.setAttribute('aria-label', 'Upload image');
        fileInput.addEventListener('change', event => this.handleFileSelect(event));

        uploadArea.appendChild(instruction);
        uploadArea.appendChild(uploadAction);
        uploadArea.appendChild(fileInput);

        const preview = createElement('div', 'word-hunt-preview-frame');
        const image = document.createElement('img');
        image.id = 'word-hunt-preview';
        image.alt = 'Saved word hunt image';
        image.hidden = true;
        preview.appendChild(image);

        panel.appendChild(label);
        panel.appendChild(uploadArea);
        panel.appendChild(preview);

        return panel;
    }

    createStatusPanel(entry) {
        const status = createElement('div', 'word-hunt-status');
        const completed = this.getCompletedCount();
        const progress = createElement('strong');
        progress.textContent = `${completed}/${this.words.length} words complete`;
        status.appendChild(progress);

        const requirements = createElement('div', 'word-hunt-requirements');
        [
            ['definition', 'Definition', Boolean(entry.definition?.trim())],
            ['image', 'Image', Boolean(entry.hasImage)],
            ['example-one', 'Example 1', Boolean(entry.exampleOne?.trim())],
            ['example-two', 'Example 2', Boolean(entry.exampleTwo?.trim())]
        ].forEach(([key, label, done]) => {
            const item = createElement('span', `word-hunt-requirement ${done ? 'complete' : ''}`);
            item.dataset.requirement = key;
            item.textContent = label;
            requirements.appendChild(item);
        });

        status.appendChild(requirements);
        return status;
    }

    updateEntryField(field, value) {
        const word = this.getCurrentWord()?.word;
        if (!word) return;

        const entry = this.getEntry(word);
        entry[field] = value;
        entry.updatedAt = new Date().toISOString();
        this.saveEntry(word);
        this.updateLiveStatus();
    }

    updateLiveStatus() {
        const entry = this.getEntry();
        const nextButton = this.container.querySelector('.word-hunt-nav .primary-btn');
        if (nextButton) {
            nextButton.disabled = !this.isEntryComplete(entry);
        }

        const fields = {
            definition: Boolean(entry.definition.trim()),
            image: Boolean(entry.hasImage),
            'example-one': Boolean(entry.exampleOne.trim()),
            'example-two': Boolean(entry.exampleTwo.trim())
        };

        Object.entries(fields).forEach(([key, done]) => {
            const item = this.container.querySelector(`[data-requirement="${key}"]`);
            if (item) item.classList.toggle('complete', done);
        });

        const progress = this.container.querySelector('.word-hunt-status strong');
        if (progress) {
            progress.textContent = `${this.getCompletedCount()}/${this.words.length} words complete`;
        }
    }

    persistLocalEntries() {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.entries));
    }

    saveEntry(word) {
        const entry = this.getEntry(word);
        this.persistLocalEntries();

        if (typeof this.onWordHuntSave === 'function') {
            this.onWordHuntSave(this.vocabName, word, {
                entry: { ...entry }
            });
        }

        this.checkProgress();
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            await this.processAndSaveImage(file);
        }
        event.target.value = '';
    }

    async handlePaste(event) {
        const items = Array.from((event.clipboardData || event.originalEvent?.clipboardData)?.items || []);
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                const blob = item.getAsFile();
                await this.processAndSaveImage(blob);
                break;
            }
        }
    }

    async processAndSaveImage(file) {
        try {
            const imageData = await compressImageToWebp(file);
            const word = this.getCurrentWord().word;
            const entry = this.getEntry(word);
            const now = new Date().toISOString();

            await imageDB.saveDrawing(this.vocabName, word, imageData.blob);
            entry.hasImage = true;
            entry.imageSizeBytes = imageData.sizeBytes;
            entry.imageWidth = imageData.width;
            entry.imageHeight = imageData.height;
            entry.imageUpdatedAt = now;
            entry.updatedAt = now;

            await this.uploadStoredImage(word, imageData.blob, entry);

            this.displayImage(imageData.blob);
            this.saveEntry(word);
            this.updateLiveStatus();
        } catch (error) {
            console.error('Error processing image:', error);
            alert(error.message || 'Failed to process image.');
        }
    }

    async uploadStoredImage(word, blob, entry) {
        if (!this.uploadImage) return;

        try {
            const metadata = await this.uploadImage(word, blob, {
                width: entry.imageWidth,
                height: entry.imageHeight,
                sizeBytes: blob.size
            });

            if (metadata) {
                Object.assign(entry, metadata);
            }

            entry.hasImage = true;
            entry.pendingImageUpload = false;
        } catch (error) {
            entry.pendingImageUpload = true;
            console.warn('Word Hunt image saved locally but not uploaded yet:', error);
        }
    }

    async loadImage() {
        const word = this.getCurrentWord()?.word;
        if (!word || !this.previewImage) return;

        const entry = this.getEntry(word);
        const blob = await imageDB.getDrawing(this.vocabName, word);
        if (blob) {
            entry.hasImage = true;
            this.displayImage(blob);
            this.updateLiveStatus();
            return;
        }

        if (entry.imagePath && this.loadRemoteImage) {
            try {
                const remoteBlob = await this.loadRemoteImage(entry.imagePath);
                if (remoteBlob) {
                    await imageDB.saveDrawing(this.vocabName, word, remoteBlob);
                    entry.hasImage = true;
                    entry.pendingImageUpload = false;
                    this.displayImage(remoteBlob);
                    this.updateLiveStatus();
                    this.saveEntry(word);
                    return;
                }
            } catch (error) {
                console.warn('Could not load Word Hunt image from Storage:', error);
            }
        }

        this.previewImage.hidden = true;
    }

    displayImage(blob) {
        if (!this.previewImage) return;
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = URL.createObjectURL(blob);
        this.previewImage.src = this.previewUrl;
        this.previewImage.hidden = false;
    }

    navigate(direction) {
        const entry = this.getEntry();
        if (direction > 0 && !this.isEntryComplete(entry)) return;

        const newIndex = this.currentIndex + direction;
        if (newIndex >= this.words.length) {
            this.renderCompletion();
            return;
        }

        if (newIndex >= 0) {
            this.setCurrentIndex(newIndex);
        }
    }

    renderCompletion() {
        this.destroyPasteListener();
        this.container.innerHTML = '';

        const completion = createElement('div', 'word-hunt-completion');
        const count = this.getCompletedCount();
        completion.innerHTML = `
            <h2>Word Hunt Complete</h2>
            <p>${count}/${this.words.length} words completed.</p>
            <div class="matching-completion-actions">
                <button id="word-hunt-review" class="btn secondary-btn" type="button">Review Words</button>
                ${this.onDownloadWordHunt ? '<button id="word-hunt-download" class="btn secondary-btn" type="button">Download</button>' : ''}
                <button id="word-hunt-back" class="btn primary-btn" type="button">Back to Activities</button>
            </div>
        `;
        this.container.appendChild(completion);

        $('#word-hunt-review')?.addEventListener('click', () => {
            this.setCurrentIndex(0);
        });

        $('#word-hunt-download')?.addEventListener('click', () => this.downloadWordHunt());

        $('#word-hunt-back')?.addEventListener('click', () => {
            $('#back-to-menu-btn')?.click();
        });

        this.checkProgress();
    }

    downloadWordHunt() {
        if (this.onDownloadWordHunt) {
            this.onDownloadWordHunt();
        }
    }

    checkProgress() {
        if (this.onProgress) {
            this.onProgress(this.getScore());
        }
    }

    getScore() {
        const total = this.words.length;
        const count = this.getCompletedCount();
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);

        return {
            score: percentage,
            details: `Completed ${count}/${total} word hunts`,
            isComplete: total > 0 && count === total
        };
    }

    destroyPasteListener() {
        if (this.pasteHandler) {
            window.removeEventListener('paste', this.pasteHandler);
            this.pasteHandler = null;
        }
    }

    destroy() {
        this.destroyPasteListener();
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
    }
}
