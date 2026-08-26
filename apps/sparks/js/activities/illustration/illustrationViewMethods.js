import { $, createElement } from '../../main.js';
import { attachWritingChecker } from '../../studentWritingSuggestions.js';

export const illustrationViewMethods = {
renderWord() {
        this.destroyPasteListener();
        this.destroyWritingChecker();
        this.container.innerHTML = '';

        const word = this.getCurrentWord();
        const entry = this.getEntry(word.word);

        const wrapper = createElement('div', 'word-hunt-wrapper');
        wrapper.appendChild(this.createHeader(word, entry));
        wrapper.appendChild(this.createHuntGrid(word, entry));
        wrapper.appendChild(this.createFooter(entry));
        this.container.appendChild(wrapper);
        this.writingCheckerCleanup = attachWritingChecker(wrapper);

        this.previewImage = this.container.querySelector('#word-hunt-preview');
        this.removeImageButton = this.container.querySelector('[data-word-hunt-remove-image]');
        this.loadImage();

        this.pasteHandler = event => this.handlePaste(event);
        window.addEventListener('paste', this.pasteHandler);
    },

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
    },

    getResearchClassContext() {
        const grade = String(this.researchContext.grade || '').match(/\d+/)?.[0] || '';
        const subjectName = String(this.researchContext.subjectName || '').trim();
        const subjectSlug = String(this.researchContext.subjectSlug || '').trim().toLowerCase();
        const gradeLabel = grade ? `Grade ${grade}` : 'middle school';
        const subjectLabel = subjectName || (subjectSlug
            ? subjectSlug.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
            : 'Technology and Robotics');
        const roboticsContext = subjectSlug === 'technology' && !/robot/i.test(subjectLabel)
            ? ' and Robotics'
            : '';
        return `${gradeLabel} ${subjectLabel}${roboticsContext} class`;
    },

    getResearchTopic() {
        const unitName = String(this.researchContext.unitName || '').trim();
        if (!unitName) return this.getResearchClassContext();

        const unitSections = unitName.split(/\s+-\s+/);
        const focusedTopic = unitSections[unitSections.length - 1]
            .replace(/^Grade\s+\d+\s+[^:]+:\s*/i, '')
            .trim();
        return focusedTopic || unitName;
    },

    getResearchLinks(word) {
        const searchTerm = String(word.word || '').trim();
        const classContext = this.getResearchClassContext();
        const topic = this.getResearchTopic();
        const classMeaning = String(word.definition || '').trim();
        const classMeaningSentence = classMeaning && /[.!?]$/.test(classMeaning)
            ? classMeaning
            : `${classMeaning}.`;
        const contextLine = classMeaning
            ? `\nMeaning hint: ${classMeaningSentence}`
            : '';
        const responseRule = 'Answer only the requested content. Do not add explanations, follow-up questions, offers to help, lesson ideas, quizzes, or extra suggestions.';
        const sharedContext = `Vocabulary word: "${searchTerm}"\nTopic: ${topic}\nClass context: ${classContext}.${contextLine}\nLanguage: English only.\nResponse rule: ${responseRule}`;
        const definitionPrompt = `${sharedContext}\nTask: Write one student-friendly definition using 5 to 12 words. Use the meaning that fits this topic.`;
        const examplesPrompt = `${sharedContext}\nTask: Write exactly 2 short example sentences using this word. Each sentence must use 6 to 12 words and fit this topic. Number them 1 and 2.`;
        const imageContext = classMeaning
            ? `${searchTerm} in the context of ${topic}: ${classMeaning}`
            : `${searchTerm} in the context of ${topic}`;
        const aiModeUrl = prompt => `https://www.google.com/aimode?q=${encodeURIComponent(prompt)}`;

        return [
            ['Definition', aiModeUrl(definitionPrompt)],
            ['Image', `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(imageContext)}`],
            ['Examples', aiModeUrl(examplesPrompt)]
        ];
    },

    createResearchActions(word) {
        const actions = createElement('div', 'word-hunt-actions');
        this.getResearchLinks(word).forEach(([label, href]) => {
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
    },

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
    },

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
        textarea.dataset.writingCheck = 'true';
        textarea.dataset.wordHuntWriting = 'true';
        textarea.addEventListener('beforeinput', event => this.handleWritingBeforeInput(event, textarea));
        textarea.addEventListener('drop', event => this.handleWritingDrop(event, textarea));
        textarea.addEventListener('input', event => {
            this.hideTextPasteFeedback(textarea);
            this.updateEntryField(field, event.target.value);
        });

        group.appendChild(labelEl);
        group.appendChild(textarea);
        const writingSuggestions = createElement('div', 'writing-suggestion-panel');
        writingSuggestions.dataset.writingSuggestions = 'true';
        writingSuggestions.setAttribute('role', 'status');
        writingSuggestions.hidden = true;
        group.appendChild(writingSuggestions);
        const pasteFeedback = createElement('p', 'word-hunt-text-paste-feedback');
        pasteFeedback.setAttribute('role', 'alert');
        pasteFeedback.textContent = 'Your teacher set Word Hunt to typing only. Type this answer in your own words.';
        pasteFeedback.hidden = true;
        group.appendChild(pasteFeedback);
        if (helper) {
            const helperText = createElement('p', 'word-hunt-field-helper', helper);
            group.appendChild(helperText);
        }
        return group;
    },

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
    },

createBottomNav(entry) {
        const nav = createElement('div', 'word-hunt-bottom-nav');
        const next = createElement('button', 'btn primary-btn word-hunt-next-btn', this.currentIndex === this.words.length - 1 ? 'Finish' : 'Next');
        next.type = 'button';
        next.disabled = !this.isEntryComplete(entry);
        next.addEventListener('click', () => this.navigate(1));
        nav.appendChild(next);
        return nav;
    },

createFooter(entry) {
        const footer = createElement('div', 'word-hunt-footer');
        footer.appendChild(this.createStatusPanel(entry));
        footer.appendChild(this.createBottomNav(entry));
        return footer;
    },

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
    },

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
    },

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
    },

downloadWordHunt() {
        if (this.onDownloadWordHunt) {
            this.onDownloadWordHunt();
        }
    },
};
