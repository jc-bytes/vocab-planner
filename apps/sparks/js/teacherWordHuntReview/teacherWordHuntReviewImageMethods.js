import { escapeHtml } from '../main.js';

export const teacherWordHuntReviewImageMethods = {
async loadWordHuntReviewImages(row) {
        if (this.isAuthenticationDisabled()) return;

        const generation = ++this.wordHuntReviewImageGeneration;

        await Promise.all(row.words.map(async wordRow => {
            const path = wordRow.entry.imagePath;
            if (!path) return;
            const target = this.query(`.word-hunt-image-review[data-word-hunt-image="${this.escapeSelector(wordRow.word)}"]`);
            if (!target) return;

            try {
                const blob = await this.repository.downloadImage(path);
                if (generation !== this.wordHuntReviewImageGeneration) return;
                if (!blob) {
                    target.innerHTML = '<span>Image unavailable</span>';
                    return;
                }
                const url = this.objectUrls.create(blob);
                if (generation !== this.wordHuntReviewImageGeneration) {
                    this.objectUrls.revoke(url);
                    return;
                }
                this.wordHuntReviewImageUrls.push(url);
                target.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(wordRow.word)} Word Hunt image">`;
            } catch (error) {
                if (generation !== this.wordHuntReviewImageGeneration) return;
                console.warn('Could not load Word Hunt image:', path, error);
                target.innerHTML = '<span>Image unavailable</span>';
            }
        }));
    },

    revokeWordHuntReviewImageUrls() {
        this.wordHuntReviewImageGeneration += 1;
        this.wordHuntReviewImageUrls.forEach(url => this.objectUrls.revoke(url));
        this.wordHuntReviewImageUrls = [];
    },
};
