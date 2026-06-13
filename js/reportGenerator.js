import { createElement, $ } from './main.js';
import { imageDB } from './db.js';
import { jsPDF } from 'jspdf';
import { PDF_PAGE_FORMAT } from './classroomActivityPdfStyles.js';

const WORD_HUNT_TEXT_RULES = {
    definition: { minChars: 12, minWords: 3 },
    example: { minChars: 18, minWords: 4 }
};

export class ReportGenerator {
    static async ensureHtml2Canvas() {
        if (typeof window.html2canvas === 'function') return window.html2canvas;

        const module = await import('html2canvas');
        return module.default || module;
    }

    static getStudentInfo(studentProfile = {}) {
        const fullName = studentProfile.firstName && studentProfile.lastName
            ? `${studentProfile.firstName} ${studentProfile.lastName}`
            : studentProfile.name || 'Student';
        const grade = studentProfile.grade ?? studentProfile.gradeLevel ?? studentProfile.grade_level ?? '';
        const group = studentProfile.group ?? studentProfile.sectionLetter ?? studentProfile.section_letter ?? '';
        return { fullName, grade, group };
    }

    static getVocabName(vocabOrName) {
        return typeof vocabOrName === 'string' ? vocabOrName : (vocabOrName?.name || 'Vocabulary');
    }

    static getSubjectName(vocabOrName) {
        if (!vocabOrName || typeof vocabOrName === 'string') return 'Technology';
        if (vocabOrName.subjectName) return vocabOrName.subjectName;
        const slug = String(vocabOrName.subjectSlug || vocabOrName.subject_slug || 'technology');
        return slug
            .split('-')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ') || 'Technology';
    }

    static getWordHuntWords(vocabOrName) {
        const allWords = Array.isArray(vocabOrName?.words) ? vocabOrName.words : [];
        const settings = vocabOrName?.activitySettings || {};
        const wordHuntIsRequired = Array.isArray(settings.requiredActivities)
            && settings.requiredActivities.includes('illustration');
        if (wordHuntIsRequired && settings.wordHuntSelectionMode !== 'custom') {
            return allWords;
        }

        const selectedWords = allWords.filter(word => (
            word.wordHunt === true ||
            word.wordHunt === 'true' ||
            word.word_hunt === true
        ));
        const fallbackLimit = vocabOrName?.activitySettings?.illustration || 5;
        return selectedWords.length > 0 ? selectedWords : allWords.slice(0, fallbackLimit);
    }

    static mergeSavedWordHuntWords(words = [], wordHunt = {}) {
        const merged = [];
        const seen = new Set();

        words.forEach(wordObj => {
            const normalized = typeof wordObj === 'string' ? { word: wordObj } : wordObj;
            const word = String(normalized?.word || '').trim();
            if (!word || seen.has(word)) return;
            seen.add(word);
            merged.push(normalized);
        });

        Object.keys(wordHunt || {}).forEach(word => {
            const normalizedWord = String(word || '').trim();
            if (!normalizedWord || seen.has(normalizedWord)) return;
            seen.add(normalizedWord);
            merged.push({ word: normalizedWord });
        });

        return merged;
    }

    static async waitForImages(root) {
        const images = Array.from(root?.querySelectorAll?.('img') || []);
        await Promise.all(images.map(image => {
            if (image.complete && image.naturalWidth > 0) return Promise.resolve();
            return new Promise(resolve => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            });
        }));
    }

    static slugForDownload(value) {
        return String(value || 'word-hunt')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'word-hunt';
    }

    static toPascalFileSegment(value, fallback = 'WordHunt') {
        const parts = String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-zA-Z0-9]+/)
            .filter(Boolean);

        if (parts.length === 0) return fallback;

        return parts.map(part => {
            const lower = part.toLowerCase();
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join('');
    }

    static getGradeGroupFileSegment(grade, group) {
        const groupText = String(group || '').replace(/[^a-zA-Z0-9]+/g, '');
        const gradeText = groupText
            ? (String(grade || '').match(/\d+/)?.[0] || String(grade || '').replace(/[^a-zA-Z0-9]+/g, ''))
            : String(grade || '').replace(/[^a-zA-Z0-9]+/g, '');
        return `${gradeText}${groupText}`.toLowerCase() || 'class';
    }

    static getTrimesterFileSegment(vocabOrName, options = {}) {
        const raw = String(
            options.trimester
            || vocabOrName?.trimester
            || vocabOrName?.trimesterKey
            || vocabOrName?.trimester_key
            || ''
        ).trim().toUpperCase();

        if (!raw) return '';
        if (raw === 'IT' || raw === 'T1' || raw === '1') return 't1';
        if (raw === 'IIT' || raw === 'T2' || raw === '2') return 't2';
        if (raw === 'IIIT' || raw === 'T3' || raw === '3') return 't3';

        return raw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '')
            .replace(/^trimester/, 't');
    }

    static buildWordHuntFileName(studentProfile, vocabOrName, options = {}) {
        const vocabName = this.getVocabName(vocabOrName);
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);
        const segments = [
            this.toPascalFileSegment(fullName, 'Student'),
            this.getGradeGroupFileSegment(grade, group),
            this.getTrimesterFileSegment(vocabOrName, options),
            this.toPascalFileSegment(vocabName, 'Vocabulary')
        ].filter(Boolean);

        return `${segments.join('-')}.pdf`;
    }

    static async blobToDataUrl(blob) {
        if (!blob) return '';
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    }

    static async getImageSize(dataUrl) {
        if (!dataUrl) return null;
        const image = new Image();
        image.src = dataUrl;
        return new Promise(resolve => {
            image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
            image.onerror = () => resolve(null);
        });
    }

    static async normalizePdfImageDataUrl(dataUrl) {
        if (!dataUrl) return '';
        const image = new Image();
        image.src = dataUrl;

        const loadedImage = await new Promise(resolve => {
            image.onload = () => resolve(image);
            image.onerror = () => resolve(null);
        });
        if (!loadedImage) return '';

        const canvas = document.createElement('canvas');
        canvas.width = loadedImage.naturalWidth || 1;
        canvas.height = loadedImage.naturalHeight || 1;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(loadedImage, 0, 0);
        return canvas.toDataURL('image/png');
    }

    static setPdfTextStyle(pdf, { size = 10, style = 'normal', color = [55, 65, 81] } = {}) {
        pdf.setFont('helvetica', style);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
    }

    static drawWrappedPdfText(pdf, text, x, y, width, options = {}) {
        const lineHeight = options.lineHeight || 11;
        this.setPdfTextStyle(pdf, options);
        const lines = pdf.splitTextToSize(String(text || ''), width);
        pdf.text(lines, x, y);
        return y + (lines.length * lineHeight);
    }

    static getPdfTextLines(pdf, text, width, fontSize = 9, style = 'normal') {
        pdf.setFont('helvetica', style);
        pdf.setFontSize(fontSize);
        return pdf.splitTextToSize(String(text || ''), width);
    }

    static drawWordHuntPdfHeader(pdf, { vocabName, subjectName, fullName, grade, group, pageNumber }) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 42;
        const rightX = pageWidth - margin;
        const compact = pageNumber > 1;
        let y = margin;

        this.setPdfTextStyle(pdf, { size: compact ? 16 : 20, style: 'bold', color: [17, 24, 39] });
        pdf.text('Word Hunt Submission', margin, y);

        this.setPdfTextStyle(pdf, { size: compact ? 10 : 12, style: 'bold', color: [79, 70, 229] });
        const vocabLines = pdf.splitTextToSize(vocabName, 230);
        pdf.text(vocabLines, rightX, y, { align: 'right' });

        y += compact ? 17 : 22;
        this.setPdfTextStyle(pdf, { size: 9, color: [107, 114, 128] });
        pdf.text(`Generated on ${new Date().toLocaleDateString()}`, margin, y);
        pdf.text(subjectName, rightX, y, { align: 'right' });

        y += 14;
        pdf.setDrawColor(79, 70, 229);
        pdf.setLineWidth(1.4);
        pdf.line(margin, y, rightX, y);

        y += compact ? 16 : 24;
        if (compact) {
            this.setPdfTextStyle(pdf, { size: 10, style: 'bold', color: [55, 65, 81] });
            pdf.text(`${fullName} - Grade ${grade || '-'} Group ${group || '-'}`, margin, y);
            return y + 18;
        }

        pdf.setFillColor(249, 250, 251);
        pdf.roundedRect(margin, y, pageWidth - (margin * 2), 58, 5, 5, 'F');
        this.setPdfTextStyle(pdf, { size: 12, style: 'bold', color: [55, 65, 81] });
        pdf.text('Student Information', margin + 14, y + 18);
        this.setPdfTextStyle(pdf, { size: 8, style: 'normal', color: [107, 114, 128] });
        pdf.text('Name', margin + 14, y + 34);
        pdf.text('Grade', margin + 230, y + 34);
        pdf.text('Group', margin + 340, y + 34);
        this.setPdfTextStyle(pdf, { size: 11, style: 'normal', color: [31, 41, 55] });
        pdf.text(fullName, margin + 14, y + 49);
        pdf.text(String(grade || '-'), margin + 230, y + 49);
        pdf.text(String(group || '-'), margin + 340, y + 49);
        return y + 78;
    }

    static drawWordHuntPdfTableHeader(pdf, y) {
        const margin = 42;
        const columns = this.getWordHuntPdfColumns();
        pdf.setFillColor(243, 244, 246);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, y, columns.totalWidth, 26, 'FD');
        this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [31, 41, 55] });
        columns.items.forEach(column => {
            pdf.text(column.label, column.x + 8, y + 17);
            if (column.index > 0) {
                pdf.line(column.x, y, column.x, y + 26);
            }
        });
        return y + 26;
    }

    static getWordHuntPdfColumns() {
        const margin = 42;
        const widths = [72, 216, 116, 124];
        let x = margin;
        const labels = ['Word', 'Evidence', 'Image', 'Submission'];
        const items = widths.map((width, index) => {
            const column = { label: labels[index], width, x, index };
            x += width;
            return column;
        });
        return { items, totalWidth: widths.reduce((sum, width) => sum + width, 0) };
    }

    static getWordHuntPdfRowHeight(pdf, row) {
        const columns = this.getWordHuntPdfColumns().items;
        const evidenceWidth = columns[1].width - 16;
        const definitionLines = this.getPdfTextLines(pdf, row.entry.definition || 'Missing definition', evidenceWidth, 9);
        const examplesText = [
            row.entry.exampleOne ? `1. ${row.entry.exampleOne}` : '',
            row.entry.exampleTwo ? `2. ${row.entry.exampleTwo}` : ''
        ].filter(Boolean).join('\n') || 'Missing two examples';
        const exampleLines = this.getPdfTextLines(pdf, examplesText, evidenceWidth, 9);
        const evidenceHeight = 13 + (definitionLines.length * 11) + 16 + 13 + (exampleLines.length * 11);
        const statusHeight = 24 + (4 * 18);
        return Math.max(104, evidenceHeight + 18, statusHeight + 18);
    }

    static drawWordHuntStatusBadge(pdf, label, x, y, options = {}) {
        const done = Boolean(options.done);
        const width = options.width || (done ? 34 : 42);
        pdf.setFillColor(...(done ? [209, 250, 229] : [254, 226, 226]));
        pdf.roundedRect(x, y - 9, width, 14, 7, 7, 'F');
        this.setPdfTextStyle(pdf, {
            size: 7,
            style: 'bold',
            color: done ? [6, 95, 70] : [153, 27, 27]
        });
        pdf.text(label, x + width / 2, y + 1, { align: 'center' });
    }

    static drawWordHuntPdfRow(pdf, row, y, height) {
        const columns = this.getWordHuntPdfColumns().items;
        const padding = 8;

        pdf.setDrawColor(229, 231, 235);
        pdf.rect(columns[0].x, y, columns.reduce((sum, column) => sum + column.width, 0), height);
        columns.slice(1).forEach(column => {
            pdf.line(column.x, y, column.x, y + height);
        });

        this.drawWrappedPdfText(pdf, row.word, columns[0].x + padding, y + 18, columns[0].width - (padding * 2), {
            size: 9,
            style: 'bold',
            color: [31, 41, 55],
            lineHeight: 11
        });

        let textY = y + 16;
        this.setPdfTextStyle(pdf, { size: 7, style: 'bold', color: [107, 114, 128] });
        pdf.text('DEFINITION', columns[1].x + padding, textY);
        textY += 12;
        textY = this.drawWrappedPdfText(
            pdf,
            row.entry.definition || 'Missing definition',
            columns[1].x + padding,
            textY,
            columns[1].width - (padding * 2),
            {
                size: 9,
                color: row.entry.definition ? [55, 65, 81] : [156, 163, 175],
                style: row.entry.definition ? 'normal' : 'italic',
                lineHeight: 11
            }
        );
        textY += 8;
        this.setPdfTextStyle(pdf, { size: 7, style: 'bold', color: [107, 114, 128] });
        pdf.text('EXAMPLES', columns[1].x + padding, textY);
        textY += 12;
        const examples = [
            row.entry.exampleOne ? `1. ${row.entry.exampleOne}` : '',
            row.entry.exampleTwo ? `2. ${row.entry.exampleTwo}` : ''
        ].filter(Boolean).join('\n');
        this.drawWrappedPdfText(
            pdf,
            examples || 'Missing two examples',
            columns[1].x + padding,
            textY,
            columns[1].width - (padding * 2),
            {
                size: 9,
                color: examples ? [55, 65, 81] : [156, 163, 175],
                style: examples ? 'normal' : 'italic',
                lineHeight: 11
            }
        );

        if (row.imageDataUrl && row.imageSize) {
            const maxWidth = columns[2].width - (padding * 2);
            const maxHeight = Math.min(76, height - 18);
            const ratio = Math.min(maxWidth / row.imageSize.width, maxHeight / row.imageSize.height);
            const imageWidth = row.imageSize.width * ratio;
            const imageHeight = row.imageSize.height * ratio;
            const imageX = columns[2].x + (columns[2].width - imageWidth) / 2;
            const imageY = y + 14;
            pdf.addImage(row.imageDataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
        } else {
            this.setPdfTextStyle(pdf, { size: 9, style: 'italic', color: [107, 114, 128] });
            pdf.text('No image saved', columns[2].x + padding, y + 24);
        }

        const provided = {
            definition: Boolean(String(row.entry.definition || '').trim()),
            image: Boolean(row.imageDataUrl),
            exampleOne: Boolean(String(row.entry.exampleOne || '').trim()),
            exampleTwo: Boolean(String(row.entry.exampleTwo || '').trim())
        };
        const hasSavedWork = Object.values(provided).some(Boolean);
        this.drawWordHuntStatusBadge(pdf, hasSavedWork ? 'Saved' : 'Review', columns[3].x + padding, y + 18, {
            done: hasSavedWork,
            width: hasSavedWork ? 42 : 46
        });
        [
            ['Definition', provided.definition],
            ['Image', provided.image],
            ['Example 1', provided.exampleOne],
            ['Example 2', provided.exampleTwo]
        ].forEach(([label, done], index) => {
            const itemY = y + 42 + (index * 18);
            this.setPdfTextStyle(pdf, { size: 8, style: 'bold', color: [55, 65, 81] });
            pdf.text(label, columns[3].x + padding, itemY);
            this.drawWordHuntStatusBadge(pdf, done ? 'Done' : 'Review', columns[3].x + columns[3].width - 44, itemY, {
                done,
                width: done ? 34 : 42
            });
        });
    }

    static async buildWordHuntPdfRows(vocabName, words, options = {}) {
        const wordHunt = options.wordHunt || {};
        const fallbackWords = words.length > 0
            ? words
            : (await this.getWordsFromImageDB(vocabName)).map(word => ({ word }));
        const sourceWords = this.mergeSavedWordHuntWords(fallbackWords, wordHunt);
        const rows = [];

        for (const wordObj of sourceWords) {
            const word = wordObj.word || '';
            const entry = wordHunt[word] || {};
            const imageBlob = await this.loadWordHuntImageBlob(vocabName, word, entry, options);
            const imageDataUrl = await this.normalizePdfImageDataUrl(await this.blobToDataUrl(imageBlob));
            rows.push({
                word,
                entry,
                imageDataUrl,
                imageSize: await this.getImageSize(imageDataUrl)
            });
        }

        return rows;
    }

    static hasMeaningfulWordHuntText(value, rules = WORD_HUNT_TEXT_RULES.definition) {
        const text = String(value || '').trim();
        if (text.length < rules.minChars) return false;
        return text.split(/\s+/).filter(Boolean).length >= rules.minWords;
    }

    static getWordHuntQuality(entry = {}) {
        const quality = {
            definition: this.hasMeaningfulWordHuntText(entry.definition, WORD_HUNT_TEXT_RULES.definition),
            image: Boolean(entry.hasImage || entry.imagePath),
            examples: (
                this.hasMeaningfulWordHuntText(entry.exampleOne, WORD_HUNT_TEXT_RULES.example) &&
                this.hasMeaningfulWordHuntText(entry.exampleTwo, WORD_HUNT_TEXT_RULES.example)
            )
        };
        quality.complete = Object.values(quality).every(Boolean);
        return quality;
    }

    static async generateReport(studentProfile, vocabOrName, scores, options = {}) {
        const vocabName = this.getVocabName(vocabOrName);
        const subjectName = this.getSubjectName(vocabOrName);
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);
        const objectUrls = [];

        // Create a temporary report element
        const reportCard = createElement('div', 'report-card');
        reportCard.style.padding = '3rem';
        reportCard.style.background = 'white';
        reportCard.style.color = '#1f2937';
        reportCard.style.borderRadius = '0'; // Document style
        reportCard.style.width = '800px'; // Letter width approx
        reportCard.style.fontFamily = "'Inter', sans-serif";
        reportCard.style.position = 'fixed';
        reportCard.style.top = '-9999px'; // Hide off-screen
        reportCard.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';

        // Helper to format score row
        const renderRow = (activity, data) => {
            let status = 'Not Started';
            let score = '-';
            let details = '-';
            let color = '#9ca3af';
            let statusColor = '#f3f4f6';
            let statusTextColor = '#374151';

            if (data) {
                score = `${data.score}%`;
                details = data.details;
                color = data.score >= 80 ? '#10b981' : (data.score >= 50 ? '#f59e0b' : '#ef4444');

                // Determine status
                let isCompleted = false;
                if (data.isComplete !== undefined) {
                    isCompleted = data.isComplete;
                } else {
                    // Fallback for activities without explicit isComplete (like Quiz/Flashcards where score implies progress/completion)
                    // Actually, Quiz score is accuracy. Flashcards score is progress.
                    // Let's assume if score is 100, it's completed.
                    isCompleted = data.score >= 100;
                }

                if (isCompleted) {
                    status = 'Completed';
                    statusColor = '#d1fae5';
                    statusTextColor = '#065f46';
                } else {
                    status = 'In Progress';
                    statusColor = '#dbeafe';
                    statusTextColor = '#1e40af';
                }
            }

            return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 1rem; font-weight: 500;">${activity}</td>
                    <td style="padding: 1rem; color: ${color}; font-weight: bold;">${score}</td>
                    <td style="padding: 1rem; color: #4b5563;">${details}</td>
                    <td style="padding: 1rem;">
                        <span style="background: ${statusColor}; color: ${statusTextColor}; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem;">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        };

        reportCard.innerHTML = `
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h1 style="font-size: 2rem; font-weight: 800; color: #111827; margin: 0;">Vocabulary Report</h1>
                    <p style="color: #6b7280; margin-top: 0.5rem;">Generated on ${new Date().toLocaleDateString()}</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.5rem; font-weight: bold; color: #4f46e5;">${vocabName}</div>
                    <div style="font-size: 0.95rem; color: #6b7280;">${subjectName}</div>
                </div>
            </div>

            <div style="margin-bottom: 3rem; background: #f9fafb; padding: 1.5rem; border-radius: 0.5rem;">
                <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #374151;">Student Information</h2>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Name</p>
                        <p style="font-size: 1.125rem; font-weight: 500;">${fullName}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Grade</p>
                        <p style="font-size: 1.125rem; font-weight: 500;">${grade || '-'}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.25rem;">Group</p>
                        <p style="font-size: 1.125rem; font-weight: 500;">${group || '-'}</p>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 2rem;">
                <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #374151;">Activity Performance</h2>
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                            <th style="padding: 1rem; font-weight: 600; color: #374151;">Activity</th>
                            <th style="padding: 1rem; font-weight: 600; color: #374151;">Score</th>
                            <th style="padding: 1rem; font-weight: 600; color: #374151;">Details</th>
                            <th style="padding: 1rem; font-weight: 600; color: #374151;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderRow('Flashcards', scores.flashcards)}
                        ${renderRow('Matching', scores.matching)}
                        ${renderRow('Quiz', scores.quiz)}
                        ${renderRow('Synonym & Antonym', scores['synonym-antonym'])}
                        ${renderRow('Word Search', scores['word-search'])}
                        ${renderRow('Crossword', scores.crossword)}
                        ${renderRow('Hangman', scores.hangman)}
                        ${renderRow('Word Scramble', scores.scramble)}
                        ${renderRow('Vocabulary Wordle', scores.wordle)}
                        ${renderRow('Speed Match', scores['speed-match'])}
                        ${renderRow('Fill in Blank', scores['fill-in-blank'])}
                        ${renderRow('Word Hunt', scores.illustration)}
                    </tbody>
                </table>
            </div>

            <div id="activity-details" style="margin-top: 3rem;">
                <!-- Activity details will be inserted here -->
            </div>

            <div style="margin-top: 4rem; text-align: center; color: #9ca3af; font-size: 0.875rem;">
                <p>Vocabulary Master • Automated Report</p>
            </div>
        `;

        document.body.appendChild(reportCard);

        // Add detailed activity sections
        const detailsContainer = reportCard.querySelector('#activity-details');
        await this.renderActivityDetails(detailsContainer, vocabOrName, scores, {
            ...options,
            objectUrls
        });

        try {
            const html2canvas = await this.ensureHtml2Canvas();
            await this.waitForImages(reportCard);
            const canvas = await html2canvas(reportCard);
            const imgData = canvas.toDataURL('image/png');

            // Download
            const link = document.createElement('a');
            link.download = `vocab-report-${Date.now()}.png`;
            link.href = imgData;
            link.click();

        } catch (err) {
            console.error('Report generation failed:', err);
            alert('Failed to generate report image.');
        } finally {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
            document.body.removeChild(reportCard);
        }
    }

    static async generateWordHuntReport(studentProfile, vocabOrName, options = {}) {
        const vocabName = this.getVocabName(vocabOrName);
        const subjectName = this.getSubjectName(vocabOrName);
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);

        try {
            const words = this.getWordHuntWords(vocabOrName);
            const rows = await this.buildWordHuntPdfRows(vocabName, words, options);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: PDF_PAGE_FORMAT });

            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 42;
            const bottomMargin = 42;
            let pageNumber = 1;
            let y = this.drawWordHuntPdfHeader(pdf, {
                vocabName,
                subjectName,
                fullName,
                grade,
                group,
                pageNumber
            });

            if (rows.length === 0) {
                this.setPdfTextStyle(pdf, { size: 11, style: 'italic', color: [107, 114, 128] });
                pdf.text('No Word Hunt work saved yet.', margin, y + 18);
            } else {
                y = this.drawWordHuntPdfTableHeader(pdf, y);
                for (const row of rows) {
                    const rowHeight = this.getWordHuntPdfRowHeight(pdf, row);
                    if (y + rowHeight > pageHeight - bottomMargin) {
                        pdf.addPage(PDF_PAGE_FORMAT, 'portrait');
                        pageNumber += 1;
                        y = this.drawWordHuntPdfHeader(pdf, {
                            vocabName,
                            subjectName,
                            fullName,
                            grade,
                            group,
                            pageNumber
                        });
                        y = this.drawWordHuntPdfTableHeader(pdf, y);
                    }

                    this.drawWordHuntPdfRow(pdf, row, y, rowHeight);
                    y += rowHeight;
                }
            }

            const totalPages = pdf.getNumberOfPages();
            for (let index = 1; index <= totalPages; index += 1) {
                pdf.setPage(index);
                this.setPdfTextStyle(pdf, { size: 8, color: [107, 114, 128] });
                pdf.text(`Page ${index} of ${totalPages}`, pdf.internal.pageSize.getWidth() - margin, pageHeight - 20, {
                    align: 'right'
                });
            }

            pdf.save(this.buildWordHuntFileName(studentProfile, vocabOrName, options));
        } catch (err) {
            console.error('Word Hunt report generation failed:', err);
            alert('Failed to generate Word Hunt download.');
        }
    }

    static async renderActivityDetails(container, vocabOrName, scores, options = {}) {
        container.innerHTML = '';
        const vocabName = this.getVocabName(vocabOrName);
        const words = this.getWordHuntWords(vocabOrName);

        // Word Hunt Details
        if (scores.illustration && scores.illustration.score > 0) {
            const section = createElement('div');
            section.style.marginBottom = '2rem';
            section.style.pageBreakBefore = 'always'; // For printing

            const heading = createElement('h2');
            heading.textContent = 'Word Hunt';
            heading.style.fontSize = '1.25rem';
            heading.style.fontWeight = '600';
            heading.style.marginBottom = '1rem';
            heading.style.color = '#374151';
            heading.style.borderBottom = '2px solid #e5e7eb';
            heading.style.paddingBottom = '0.5rem';
            section.appendChild(heading);

            try {
                await this.renderWordHuntTable(section, vocabName, words, options);
            } catch (err) {
                console.error('Error loading images for report:', err);
                const error = createElement('p');
                error.textContent = 'Error loading Word Hunt details.';
                error.style.color = '#ef4444';
                error.style.textAlign = 'center';
                section.appendChild(error);
            }

            container.appendChild(section);
        }
    }

    static async renderWordHuntTable(section, vocabName, words, options = {}) {
        const wordHunt = options.wordHunt || {};
        const fallbackWords = words.length > 0
            ? words
            : (await this.getWordsFromImageDB(vocabName)).map(word => ({ word }));
        const sourceWords = this.mergeSavedWordHuntWords(fallbackWords, wordHunt);

        if (sourceWords.length === 0) {
            const empty = createElement('p');
            empty.textContent = 'No Word Hunt work saved yet.';
            empty.style.color = '#6b7280';
            section.appendChild(empty);
            return;
        }

        const rowsPerPage = options.rowsPerPage || 4;
        for (let index = 0; index < sourceWords.length; index += rowsPerPage) {
            const pageWords = sourceWords.slice(index, index + rowsPerPage);
            const page = createElement('div');
            page.style.pageBreakInside = 'avoid';
            page.style.marginBottom = '1.5rem';
            if (index > 0) {
                page.style.pageBreakBefore = 'always';
            }

            const table = createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.tableLayout = 'fixed';
            table.style.fontSize = '0.9rem';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr style="background: #f3f4f6;">
                    <th style="width: 16%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Word</th>
                    <th style="width: 40%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Evidence</th>
                    <th style="width: 22%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Image</th>
                    <th style="width: 22%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Submission</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            for (const wordObj of pageWords) {
                const word = wordObj.word || '';
                const entry = wordHunt[word] || {};
                tbody.appendChild(await this.createWordHuntRow(vocabName, word, entry, options));
            }

            table.appendChild(tbody);
            page.appendChild(table);
            section.appendChild(page);
        }
    }

    static createCell(content = '') {
        const cell = document.createElement('td');
        cell.style.padding = '0.75rem';
        cell.style.border = '1px solid #e5e7eb';
        cell.style.verticalAlign = 'top';
        cell.style.color = '#374151';
        if (typeof content === 'string') {
            cell.textContent = content;
        } else if (content) {
            cell.appendChild(content);
        }
        return cell;
    }

    static createEvidenceBlock(label, value, fallback = 'Not provided') {
        const block = document.createElement('div');
        block.style.marginBottom = '0.65rem';

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.fontSize = '0.72rem';
        labelEl.style.fontWeight = '800';
        labelEl.style.letterSpacing = '0.03em';
        labelEl.style.textTransform = 'uppercase';
        labelEl.style.color = '#6b7280';
        labelEl.style.marginBottom = '0.2rem';

        const textEl = document.createElement('p');
        const text = String(value || '').trim();
        textEl.textContent = text || fallback;
        textEl.style.margin = '0';
        textEl.style.lineHeight = '1.35';
        textEl.style.whiteSpace = 'pre-wrap';
        textEl.style.overflowWrap = 'anywhere';
        if (!text) {
            textEl.style.color = '#9ca3af';
            textEl.style.fontStyle = 'italic';
        }

        block.appendChild(labelEl);
        block.appendChild(textEl);
        return block;
    }

    static createQualityItem(label, done) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.gap = '0.5rem';
        item.style.marginBottom = '0.35rem';

        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        labelEl.style.color = '#374151';

        const badge = document.createElement('span');
        badge.textContent = done ? 'Done' : 'Review';
        badge.style.flex = '0 0 auto';
        badge.style.borderRadius = '999px';
        badge.style.padding = '0.15rem 0.5rem';
        badge.style.fontSize = '0.72rem';
        badge.style.fontWeight = '700';
        badge.style.background = done ? '#d1fae5' : '#fee2e2';
        badge.style.color = done ? '#065f46' : '#991b1b';

        item.appendChild(labelEl);
        item.appendChild(badge);
        return item;
    }

    static async createWordHuntRow(vocabName, word, entry, options = {}) {
        const row = document.createElement('tr');
        row.style.minHeight = '160px';

        const wordCell = this.createCell(word);
        wordCell.style.fontWeight = '700';
        wordCell.style.overflowWrap = 'anywhere';
        row.appendChild(wordCell);

        const evidence = document.createElement('div');
        const examples = [
            entry.exampleOne ? `1. ${entry.exampleOne}` : '',
            entry.exampleTwo ? `2. ${entry.exampleTwo}` : ''
        ].filter(Boolean).join('\n');
        evidence.appendChild(this.createEvidenceBlock('Definition', entry.definition, 'Missing definition'));
        evidence.appendChild(this.createEvidenceBlock('Examples', examples, 'Missing two examples'));
        row.appendChild(this.createCell(evidence));

        const imageCell = this.createCell();
        imageCell.style.textAlign = 'center';
        const imageBlob = await this.loadWordHuntImageBlob(vocabName, word, entry, options);
        if (imageBlob) {
            const imageUrl = URL.createObjectURL(imageBlob);
            options.objectUrls?.push(imageUrl);
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = `${word} Word Hunt`;
            image.style.width = '120px';
            image.style.height = '80px';
            image.style.objectFit = 'cover';
            image.style.borderRadius = '0.375rem';
            image.style.border = '1px solid #e5e7eb';
            imageCell.appendChild(image);
        } else {
            imageCell.textContent = 'No image saved';
            imageCell.style.color = '#6b7280';
        }
        row.appendChild(imageCell);

        const provided = {
            definition: Boolean(String(entry.definition || '').trim()),
            image: Boolean(imageBlob),
            exampleOne: Boolean(String(entry.exampleOne || '').trim()),
            exampleTwo: Boolean(String(entry.exampleTwo || '').trim())
        };
        const hasSavedWork = Object.values(provided).some(Boolean);

        const status = document.createElement('div');
        const statusBadge = document.createElement('div');
        statusBadge.textContent = hasSavedWork ? 'Saved' : 'No saved work';
        statusBadge.style.display = 'inline-flex';
        statusBadge.style.marginBottom = '0.65rem';
        statusBadge.style.borderRadius = '999px';
        statusBadge.style.padding = '0.25rem 0.65rem';
        statusBadge.style.fontWeight = '800';
        statusBadge.style.fontSize = '0.78rem';
        statusBadge.style.background = hasSavedWork ? '#d1fae5' : '#fef3c7';
        statusBadge.style.color = hasSavedWork ? '#065f46' : '#92400e';
        status.appendChild(statusBadge);
        [
            ['Definition', provided.definition],
            ['Image', provided.image],
            ['Example 1', provided.exampleOne],
            ['Example 2', provided.exampleTwo]
        ].forEach(([label, done]) => {
            status.appendChild(this.createQualityItem(label, done));
        });
        row.appendChild(this.createCell(status));

        return row;
    }

    static async loadWordHuntImageBlob(vocabName, word, entry, options = {}) {
        if (entry.imagePath && typeof options.loadImage === 'function') {
            try {
                const blob = await options.loadImage(entry.imagePath);
                if (blob) return blob;
            } catch (error) {
                console.warn('Could not load report image from Storage:', error);
            }
        }

        return imageDB.getDrawing(vocabName, word);
    }

    static async getWordsFromImageDB(vocabName) {
        // Get all keys from imageDB that match this vocab
        const allKeys = await imageDB.getAllKeys();
        const words = [];

        for (const key of allKeys) {
            // Keys are stored as "vocabName_word"
            if (key.startsWith(`${vocabName}_`)) {
                const word = key.substring(vocabName.length + 1);
                words.push(word);
            }
        }

        return words;
    }
}
