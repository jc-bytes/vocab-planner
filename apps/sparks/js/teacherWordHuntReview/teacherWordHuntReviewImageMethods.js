import { $, escapeHtml } from '../main.js';
import { supabaseService } from '../supabaseService.js';

export const teacherWordHuntReviewImageMethods = {
async loadWordHuntReviewImages(row) {
        if (this.authDisabled) return;

        await Promise.all(row.words.map(async wordRow => {
            const path = wordRow.entry.imagePath;
            if (!path) return;
            const target = $(`.word-hunt-image-review[data-word-hunt-image="${CSS.escape(wordRow.word)}"]`);
            if (!target) return;

            try {
                const blob = await supabaseService.downloadWordHuntImage(path);
                if (!blob) {
                    target.innerHTML = '<span>Image unavailable</span>';
                    return;
                }
                const url = URL.createObjectURL(blob);
                this.wordHuntReviewImageUrls.push(url);
                target.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(wordRow.word)} Word Hunt image">`;
            } catch (error) {
                console.warn('Could not load Word Hunt image:', path, error);
                target.innerHTML = '<span>Image unavailable</span>';
            }
        }));
    },

revokeWordHuntReviewImageUrls() {
        (this.wordHuntReviewImageUrls || []).forEach(url => URL.revokeObjectURL(url));
        this.wordHuntReviewImageUrls = [];
    },
};
