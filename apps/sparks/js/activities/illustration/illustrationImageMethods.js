import { imageDB } from '../../db.js';
import { compressImageToWebp } from '../../imageUtils.js';

export const illustrationImageMethods = {
async refreshImageStatus() {
        for (const word of this.words) {
            const entry = this.getEntry(word.word);
            const blob = await imageDB.getDrawing(this.vocabName, word.word, { ownerUserId: this.ownerUserId });
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
                        await imageDB.saveDrawing(this.vocabName, word.word, remoteBlob, { ownerUserId: this.ownerUserId });
                        entry.hasImage = true;
                        entry.pendingImageUpload = false;
                    }
                } catch (error) {
                    console.warn('Could not restore Word Hunt image from Storage:', error);
                }
            }
        }

        this.persistLocalEntries();
    },

async processAndSaveImage(file) {
        try {
            const imageData = await compressImageToWebp(file);
            const word = this.getCurrentWord().word;
            const entry = this.getEntry(word);
            const now = new Date().toISOString();

            await imageDB.saveDrawing(this.vocabName, word, imageData.blob, { ownerUserId: this.ownerUserId });
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
    },

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
    },

async loadImage() {
        const word = this.getCurrentWord()?.word;
        if (!word || !this.previewImage) return;

        const entry = this.getEntry(word);
        const blob = await imageDB.getDrawing(this.vocabName, word, { ownerUserId: this.ownerUserId });
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
                    await imageDB.saveDrawing(this.vocabName, word, remoteBlob, { ownerUserId: this.ownerUserId });
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
    },

async removeCurrentImage() {
        const word = this.getCurrentWord()?.word;
        if (!word) return;

        const entry = this.getEntry(word);
        await imageDB.deleteDrawing(this.vocabName, word, { ownerUserId: this.ownerUserId });
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
    },

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
    },

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
    },

toggleImageInput(showInput) {
        const uploadArea = this.container.querySelector('.word-hunt-upload-area');
        if (uploadArea) {
            uploadArea.classList.toggle('hidden', !showInput);
        }

        if (showInput) {
            this.showImageInputFeedback('');
        }
    },

showImageInputFeedback(message) {
        const feedback = this.container.querySelector('.word-hunt-paste-feedback');
        if (!feedback) return;
        feedback.textContent = message;
        feedback.hidden = !message;
    },
};

