import { createElement, $ } from '../main.js';
import { imageDB } from '../db.js';
import { compressImageToWebp, dataUrlToBlob } from '../imageUtils.js';

const WORD_HUNT_TEXT_RULES = {
    definition: { minChars: 12, minWords: 3 },
    example: { minChars: 18, minWords: 4 }
};

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

    hasMeaningfulText(value, rules = WORD_HUNT_TEXT_RULES.definition) {
        const text = String(value || '').trim();
        if (text.length < rules.minChars) return false;
        return text.split(/\s+/).filter(Boolean).length >= rules.minWords;
    }

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
    }

    isEntryComplete(entry) {
        return this.getEntryQuality(entry).complete;
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
        wrapper.appendChild(this.createHuntGrid(word, entry));
        wrapper.appendChild(this.createFooter(entry));
        this.container.appendChild(wrapper);

        this.previewImage = this.container.querySelector('#word-hunt-preview');
        this.removeImageButton = this.container.querySelector('[data-word-hunt-remove-image]');
        this.loadImage();

        this.pasteHandler = event => this.handlePaste(event);
        window.addEventListener('paste', this.pasteHandler);
    }

    createHeader(word, entry) {
        const header = createElement('div', 'word-hunt-header');

        const copy = createElement('div', 'word-hunt-title');
        const eyebrow = createElement('span');
        eyebrow.textContent = `Word ${this.currentIndex + 1} of ${this.words.length}`;
        const wordText = createElement('strong');
        wordText.textContent = word.word || '';
        const titleRow = createElement('div', 'word-hunt-title-row');
        titleRow.appendChild(wordText);
        titleRow.appendChild(this.createResearchActions(word));
        copy.appendChild(eyebrow);
        copy.appendChild(titleRow);

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
        const classMeaning = String(word.definition || '').trim();
        const classMeaningSentence = classMeaning && /[.!?]$/.test(classMeaning)
            ? classMeaning
            : `${classMeaning}.`;
        const contextLine = classMeaning
            ? ` Use this class meaning for context: ${classMeaningSentence}`
            : '';
        const definitionPrompt = `Define "${searchTerm}" for a Grade 6 technology and robotics class. Use the technology-related meaning.${contextLine} Keep it simple and classroom appropriate. Answer with one short definition.`;
        const examplesPrompt = `Write exactly 2 student-friendly example sentences using "${searchTerm}" in a Grade 6 technology and robotics class. Use the technology-related meaning.${contextLine} Number them 1 and 2.`;
        const aiModeUrl = prompt => `https://www.google.com/aimode?q=${encodeURIComponent(prompt)}`;
        const links = [
            ['Definition', aiModeUrl(definitionPrompt)],
            ['Image', `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchTerm)}`],
            ['Examples', aiModeUrl(examplesPrompt)]
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
            placeholder: `Write a clear definition for ${word.word}`,
            field: 'definition',
            helper: 'Use a student-friendly definition that matches the word.'
        }));

        grid.appendChild(this.createImagePanel(entry));

        grid.appendChild(this.createTextField({
            id: 'word-hunt-example-one',
            label: 'Example 1',
            value: entry.exampleOne,
            placeholder: `Use ${word.word} in a sentence`,
            field: 'exampleOne',
            helper: 'Show how the word is used in a real technology context.'
        }));

        grid.appendChild(this.createTextField({
            id: 'word-hunt-example-two',
            label: 'Example 2',
            value: entry.exampleTwo,
            placeholder: `Write a second example with ${word.word}`,
            field: 'exampleTwo',
            helper: 'Make this example different from the first one.'
        }));

        return grid;
    }

    createTextField({ id, label, value, placeholder, field, helper = '' }) {
        const group = createElement('div', 'word-hunt-field');
        const labelEl = document.createElement('label');
        labelEl.setAttribute('for', id);
        labelEl.textContent = label;

        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.rows = field === 'definition' ? 3 : 2;
        textarea.placeholder = placeholder;
        textarea.value = value || '';
        textarea.addEventListener('input', event => this.updateEntryField(field, event.target.value));

        group.appendChild(labelEl);
        group.appendChild(textarea);
        if (helper) {
            const helperText = createElement('p', 'word-hunt-field-helper', helper);
            group.appendChild(helperText);
        }
        return group;
    }

    createImagePanel(entry) {
        const panel = createElement('div', 'word-hunt-image-panel');
        const label = createElement('div', 'word-hunt-image-label');
        label.textContent = 'Image';

        const uploadArea = createElement('div', `word-hunt-upload-area ${entry.hasImage ? 'hidden' : ''}`);
        uploadArea.setAttribute('role', 'button');
        uploadArea.tabIndex = 0;
        uploadArea.setAttribute('aria-label', 'Add an image. Paste from clipboard, drag here, or choose a file.');
        uploadArea.addEventListener('click', event => {
            if (event.target.closest('.word-hunt-upload-action')) return;
            uploadArea.focus({ preventScroll: true });
            fileInput.click();
        });
        uploadArea.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            uploadArea.focus({ preventScroll: true });
            fileInput.click();
        });
        uploadArea.addEventListener('dragover', event => {
            event.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', event => {
            if (!uploadArea.contains(event.relatedTarget)) {
                uploadArea.classList.remove('drag-over');
            }
        });
        uploadArea.addEventListener('drop', event => {
            event.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = Array.from(event.dataTransfer?.files || []).find(item => item.type.startsWith('image/'));
            if (file) {
                this.processAndSaveImage(file);
            }
        });

        const title = createElement('strong', 'word-hunt-upload-title', entry.hasImage ? 'Image saved' : 'Add an image');
        const instruction = createElement('p');
        instruction.textContent = entry.hasImage
            ? 'Paste, drag, or choose a new image to replace it.'
            : 'Paste from clipboard, drag here, or choose a file.';

        const actions = createElement('div', 'word-hunt-upload-actions');
        const pasteAction = createElement('button', 'word-hunt-upload-action secondary');
        pasteAction.type = 'button';
        pasteAction.dataset.wordHuntPasteImage = 'true';
        pasteAction.textContent = 'Paste Image';

        const uploadAction = createElement('button', 'word-hunt-upload-action');
        uploadAction.type = 'button';
        uploadAction.dataset.wordHuntChooseImage = 'true';
        uploadAction.textContent = entry.hasImage ? 'Replace Image' : 'Choose Image';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.setAttribute('aria-label', 'Upload image');
        fileInput.addEventListener('change', event => this.handleFileSelect(event));
        pasteAction.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();
            uploadArea.focus({ preventScroll: true });
            await this.pasteImageFromClipboard();
        });
        uploadAction.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            fileInput.click();
        });

        actions.appendChild(pasteAction);
        actions.appendChild(uploadAction);
        const feedback = createElement('p', 'word-hunt-paste-feedback');
        feedback.setAttribute('role', 'status');
        feedback.hidden = true;
        uploadArea.appendChild(title);
        uploadArea.appendChild(instruction);
        uploadArea.appendChild(actions);
        uploadArea.appendChild(feedback);
        uploadArea.appendChild(fileInput);

        const preview = createElement('div', `word-hunt-preview-frame ${entry.hasImage ? '' : 'hidden'}`);
        const image = document.createElement('img');
        image.id = 'word-hunt-preview';
        image.alt = 'Saved word hunt image';
        image.hidden = true;
        const removeButton = createElement('button', 'word-hunt-remove-image');
        removeButton.type = 'button';
        removeButton.dataset.wordHuntRemoveImage = 'true';
        removeButton.setAttribute('aria-label', 'Remove saved image');
        removeButton.title = 'Remove image';
        removeButton.textContent = 'x';
        removeButton.hidden = !entry.hasImage;
        removeButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            this.removeCurrentImage();
        });
        preview.appendChild(image);
        preview.appendChild(removeButton);

        panel.appendChild(label);
        panel.appendChild(uploadArea);
        panel.appendChild(preview);

        return panel;
    }

    createBottomNav(entry) {
        const nav = createElement('div', 'word-hunt-bottom-nav');
        const next = createElement('button', 'btn primary-btn word-hunt-next-btn', this.currentIndex === this.words.length - 1 ? 'Finish' : 'Next');
        next.type = 'button';
        next.disabled = !this.isEntryComplete(entry);
        next.addEventListener('click', () => this.navigate(1));
        nav.appendChild(next);
        return nav;
    }

    createFooter(entry) {
        const footer = createElement('div', 'word-hunt-footer');
        footer.appendChild(this.createStatusPanel(entry));
        footer.appendChild(this.createBottomNav(entry));
        return footer;
    }

    createStatusPanel(entry) {
        const status = createElement('div', 'word-hunt-status');
        const completed = this.getCompletedCount();
        const quality = this.getEntryQuality(entry);
        const progress = createElement('strong');
        progress.textContent = `${completed}/${this.words.length} words complete`;
        status.appendChild(progress);

        const requirements = createElement('div', 'word-hunt-requirements');
        [
            ['definition', 'Definition', quality.definition],
            ['image', 'Image', quality.image],
            ['examples', 'Two examples', quality.examples]
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
        const canContinue = this.isEntryComplete(entry);
        this.container.querySelectorAll('.word-hunt-next-btn, .word-hunt-nav .primary-btn').forEach(nextButton => {
            nextButton.disabled = !canContinue;
        });

        const quality = this.getEntryQuality(entry);
        const fields = {
            definition: quality.definition,
            image: quality.image,
            examples: quality.examples
        };

        Object.entries(fields).forEach(([key, done]) => {
            const item = this.container.querySelector(`[data-requirement="${key}"]`);
            if (item) item.classList.toggle('complete', done);
        });

        const progress = this.container.querySelector('.word-hunt-status strong');
        if (progress) {
            progress.textContent = `${this.getCompletedCount()}/${this.words.length} words complete`;
        }

        if (this.removeImageButton) {
            this.removeImageButton.hidden = !quality.image;
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
                event.preventDefault();
                await this.processAndSaveImage(blob);
                break;
            }
        }
    }

    async pasteImageFromClipboard() {
        this.showImageInputFeedback('Checking clipboard...');
        if (!navigator.clipboard?.read) {
            this.showImageInputFeedback('Press Ctrl+V or Cmd+V to paste the copied image.');
            return;
        }

        const pasteButton = this.container.querySelector('[data-word-hunt-paste-image]');
        if (pasteButton) pasteButton.disabled = true;
        try {
            const clipboardItems = await navigator.clipboard.read();
            const blob = await this.getImageBlobFromClipboardItems(clipboardItems);
            if (blob) {
                await this.processAndSaveImage(blob);
                return;
            }
            this.showImageInputFeedback('No image was found on the clipboard.');
        } catch (error) {
            console.warn('Could not read image from clipboard:', error);
            this.showImageInputFeedback('Press Ctrl+V or Cmd+V to paste the copied image.');
        } finally {
            if (pasteButton) pasteButton.disabled = false;
        }
    }

    async getImageBlobFromClipboardItems(clipboardItems = []) {
        for (const clipboardItem of clipboardItems) {
            const imageType = clipboardItem.types.find(type => type.startsWith('image/'));
            if (imageType) {
                return clipboardItem.getType(imageType);
            }
        }

        for (const clipboardItem of clipboardItems) {
            const textType = clipboardItem.types.find(type => type === 'text/html' || type === 'text/plain');
            if (!textType) continue;

            const textBlob = await clipboardItem.getType(textType);
            const text = await textBlob.text();
            const dataUrl = this.extractImageDataUrl(text);
            if (dataUrl) {
                return dataUrlToBlob(dataUrl);
            }
        }

        return null;
    }

    extractImageDataUrl(text = '') {
        const dataUrlMatch = String(text).match(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/i);
        return dataUrlMatch ? dataUrlMatch[0] : '';
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
        this.previewImage.closest('.word-hunt-preview-frame')?.classList.add('hidden');
        if (this.removeImageButton) this.removeImageButton.hidden = true;
        this.updateImagePanelCopy(false);
        this.toggleImageInput(true);
    }

    async removeCurrentImage() {
        const word = this.getCurrentWord()?.word;
        if (!word) return;

        const entry = this.getEntry(word);
        await imageDB.deleteDrawing(this.vocabName, word);
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }

        entry.hasImage = false;
        entry.imagePath = '';
        entry.imageSizeBytes = null;
        entry.imageWidth = null;
        entry.imageHeight = null;
        entry.imageUpdatedAt = null;
        entry.pendingImageUpload = false;
        entry.updatedAt = new Date().toISOString();

        if (this.previewImage) {
            this.previewImage.removeAttribute('src');
            this.previewImage.hidden = true;
            this.previewImage.closest('.word-hunt-preview-frame')?.classList.add('hidden');
        }
        if (this.removeImageButton) this.removeImageButton.hidden = true;

        this.saveEntry(word);
        this.updateLiveStatus();
        this.updateImagePanelCopy(false);
        this.toggleImageInput(true);
    }

    displayImage(blob) {
        if (!this.previewImage) return;
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = URL.createObjectURL(blob);
        this.previewImage.src = this.previewUrl;
        this.previewImage.hidden = false;
        this.previewImage.closest('.word-hunt-preview-frame')?.classList.remove('hidden');
        if (this.removeImageButton) this.removeImageButton.hidden = false;
        this.updateImagePanelCopy(true);
        this.showImageInputFeedback('');
        this.toggleImageInput(false);
    }

    updateImagePanelCopy(hasImage) {
        const title = this.container.querySelector('.word-hunt-upload-title');
        if (title) title.textContent = hasImage ? 'Image saved' : 'Add an image';

        const instruction = this.container.querySelector('.word-hunt-upload-area p');
        if (instruction) {
            instruction.textContent = hasImage
                ? 'Paste, drag, or choose a new image to replace it.'
                : 'Paste from clipboard, drag here, or choose a file.';
        }

        const chooseButton = this.container.querySelector('[data-word-hunt-choose-image]');
        if (chooseButton) chooseButton.textContent = hasImage ? 'Replace Image' : 'Choose Image';
    }

    toggleImageInput(showInput) {
        const uploadArea = this.container.querySelector('.word-hunt-upload-area');
        if (uploadArea) {
            uploadArea.classList.toggle('hidden', !showInput);
        }

        if (showInput) {
            this.showImageInputFeedback('');
        }
    }

    showImageInputFeedback(message) {
        const feedback = this.container.querySelector('.word-hunt-paste-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.hidden = !message;
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
