import { dataUrlToBlob } from '../../imageUtils.js';

export const illustrationInputMethods = {
async handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            await this.processAndSaveImage(file);
        }
        event.target.value = '';
    },

async handlePaste(event) {
        const items = Array.from((event.clipboardData || event.originalEvent?.clipboardData)?.items || []);
        const imageItem = items.find(item => item.type.indexOf('image') === 0);
        if (imageItem) {
            const blob = imageItem.getAsFile();
            event.preventDefault();
            if (blob) await this.processAndSaveImage(blob);
            return;
        }

        const textarea = event.target?.closest?.('[data-word-hunt-writing="true"]');
        if (!this.allowTextPaste && textarea && this.clipboardContainsText(event.clipboardData || event.originalEvent?.clipboardData)) {
            event.preventDefault();
            this.showTextPasteBlocked(textarea);
        }
    },

clipboardContainsText(clipboardData) {
        const types = Array.from(clipboardData?.types || []);
        if (types.some(type => type === 'text/plain' || type === 'text/html')) return true;
        return Array.from(clipboardData?.items || []).some(item => String(item.type || '').startsWith('text/'));
    },

handleWritingBeforeInput(event, textarea) {
        if (!['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) return;
        if (this.allowTextPaste) return;
        event.preventDefault();
        this.showTextPasteBlocked(textarea);
    },

async handleWritingDrop(event, textarea) {
        const image = Array.from(event.dataTransfer?.files || []).find(file => file.type.startsWith('image/'));
        if (image) {
            event.preventDefault();
            await this.processAndSaveImage(image);
            return;
        }
        if (this.allowTextPaste) return;
        event.preventDefault();
        this.showTextPasteBlocked(textarea);
    },

showTextPasteBlocked(textarea) {
        const feedback = textarea?.closest?.('.word-hunt-field')?.querySelector?.('.word-hunt-text-paste-feedback');
        if (feedback) feedback.hidden = false;
    },

hideTextPasteFeedback(textarea) {
        const feedback = textarea?.closest?.('.word-hunt-field')?.querySelector?.('.word-hunt-text-paste-feedback');
        if (feedback) feedback.hidden = true;
    },

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
    },

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
    },

extractImageDataUrl(text = '') {
        const dataUrlMatch = String(text).match(/data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+/i);
        return dataUrlMatch ? dataUrlMatch[0] : '';
    },
};
