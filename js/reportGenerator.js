import { imageDB } from './db.js';
import { jsPDF } from 'jspdf';

const PDF_PAGE_FORMAT = 'letter';
const WORD_HUNT_TEXT_RULES = {
    definition: { minChars: 12, minWords: 3 },
    example: { minChars: 18, minWords: 4 }
};
const FINAL_REPORT_ACTIVITIES = [
    ['flashcards', 'Flashcards'],
    ['matching', 'Matching'],
    ['quiz', 'Quiz'],
    ['synonym-antonym', 'Synonym & Antonym'],
    ['word-search', 'Word Search'],
    ['crossword', 'Crossword'],
    ['hangman', 'Hangman'],
    ['scramble', 'Word Scramble'],
    ['wordle', 'Vocabulary Wordle'],
    ['speed-match', 'Speed Match'],
    ['fill-in-blank', 'Fill in Blank'],
    ['illustration', 'Word Hunt']
];

export class ReportGenerator {
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

    static buildFinalReportFileName(studentProfile, vocabOrName, options = {}) {
        const baseName = this.buildWordHuntFileName(studentProfile, vocabOrName, options).replace(/\.pdf$/i, '');
        return `${baseName}-FinalReport.pdf`;
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
        return Math.max(104, evidenceHeight + 10, statusHeight + 10);
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

    static getFinalReportActivityRows(scores = {}) {
        return FINAL_REPORT_ACTIVITIES.map(([key, label]) => {
            const data = scores?.[key] || null;
            const rawScore = Number(data?.score);
            const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null;
            const completed = Boolean(data) && (
                typeof data.isComplete === 'boolean' ? data.isComplete : score === 100
            );
            let details = data?.details;
            if (Array.isArray(details)) details = details.join(', ');
            if (details && typeof details === 'object') {
                details = Object.entries(details)
                    .map(([detailKey, value]) => `${detailKey.replace(/[-_]/g, ' ')}: ${value}`)
                    .join(' | ');
            }

            return {
                key,
                label,
                started: Boolean(data),
                completed,
                score,
                details: String(details || (data ? 'Progress saved' : 'No activity data yet')),
                status: !data ? 'Not started' : (completed ? 'Completed' : 'In progress')
            };
        });
    }

    static getFinalReportSummary(rows = [], wordHuntRows = []) {
        const startedRows = rows.filter(row => row.started);
        const completed = rows.filter(row => row.completed).length;
        const scoredRows = startedRows.filter(row => Number.isFinite(row.score));
        const average = scoredRows.length > 0
            ? Math.round(scoredRows.reduce((sum, row) => sum + row.score, 0) / scoredRows.length)
            : 0;
        return {
            started: startedRows.length,
            completed,
            average,
            wordHuntWords: wordHuntRows.length
        };
    }

    static drawFinalReportHeader(pdf, { vocabName, subjectName, fullName, grade, group, pageNumber }) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 42;
        const rightX = pageWidth - margin;
        const compact = pageNumber > 1;
        let y = margin;

        this.setPdfTextStyle(pdf, { size: compact ? 16 : 20, style: 'bold', color: [17, 24, 39] });
        pdf.text('Vocabulary Progress Report', margin, y);
        this.setPdfTextStyle(pdf, { size: compact ? 10 : 12, style: 'bold', color: [79, 70, 229] });
        pdf.text(pdf.splitTextToSize(vocabName, 225), rightX, y, { align: 'right' });

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
        this.setPdfTextStyle(pdf, { size: 8, color: [107, 114, 128] });
        pdf.text('Name', margin + 14, y + 34);
        pdf.text('Grade', margin + 230, y + 34);
        pdf.text('Group', margin + 340, y + 34);
        this.setPdfTextStyle(pdf, { size: 11, color: [31, 41, 55] });
        pdf.text(fullName, margin + 14, y + 49);
        pdf.text(String(grade || '-'), margin + 230, y + 49);
        pdf.text(String(group || '-'), margin + 340, y + 49);
        return y + 78;
    }

    static drawFinalReportSummary(pdf, summary, y) {
        const margin = 42;
        const gap = 8;
        const cardWidth = 126;
        const cards = [
            ['ACTIVITIES STARTED', `${summary.started} of ${FINAL_REPORT_ACTIVITIES.length}`],
            ['COMPLETED', String(summary.completed)],
            ['AVERAGE BEST SCORE', `${summary.average}%`],
            ['WORD HUNT WORDS', String(summary.wordHuntWords)]
        ];

        cards.forEach(([label, value], index) => {
            const x = margin + (index * (cardWidth + gap));
            pdf.setFillColor(249, 250, 251);
            pdf.setDrawColor(229, 231, 235);
            pdf.roundedRect(x, y, cardWidth, 52, 5, 5, 'FD');
            this.setPdfTextStyle(pdf, { size: 7, style: 'bold', color: [107, 114, 128] });
            pdf.text(label, x + 10, y + 16);
            this.setPdfTextStyle(pdf, { size: 17, style: 'bold', color: [31, 41, 55] });
            pdf.text(value, x + 10, y + 39);
        });
        return y + 72;
    }

    static getFinalReportColumns() {
        const widths = [138, 62, 214, 114];
        let x = 42;
        const labels = ['Activity', 'Score', 'Details', 'Status'];
        const items = widths.map((width, index) => {
            const column = { label: labels[index], width, x, index };
            x += width;
            return column;
        });
        return { items, totalWidth: widths.reduce((sum, width) => sum + width, 0) };
    }

    static drawFinalReportTableHeader(pdf, y) {
        const columns = this.getFinalReportColumns();
        pdf.setFillColor(243, 244, 246);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(42, y, columns.totalWidth, 26, 'FD');
        this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [31, 41, 55] });
        columns.items.forEach(column => {
            pdf.text(column.label, column.x + 8, y + 17);
            if (column.index > 0) pdf.line(column.x, y, column.x, y + 26);
        });
        return y + 26;
    }

    static getFinalReportRowHeight(pdf, row) {
        const detailsWidth = this.getFinalReportColumns().items[2].width - 16;
        return Math.max(34, 16 + (this.getPdfTextLines(pdf, row.details, detailsWidth, 8).length * 9));
    }

    static drawFinalReportRow(pdf, row, y, height) {
        const columns = this.getFinalReportColumns().items;
        const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
        pdf.setDrawColor(229, 231, 235);
        pdf.rect(columns[0].x, y, totalWidth, height);
        columns.slice(1).forEach(column => pdf.line(column.x, y, column.x, y + height));

        this.drawWrappedPdfText(pdf, row.label, columns[0].x + 8, y + 17, columns[0].width - 16, {
            size: 9, style: 'bold', color: [31, 41, 55], lineHeight: 10
        });
        this.setPdfTextStyle(pdf, {
            size: 10,
            style: 'bold',
            color: row.score === null ? [156, 163, 175] : (row.score >= 80 ? [6, 95, 70] : (row.score >= 50 ? [146, 64, 14] : [153, 27, 27]))
        });
        pdf.text(row.score === null ? '-' : `${row.score}%`, columns[1].x + 8, y + 17);
        this.drawWrappedPdfText(pdf, row.details, columns[2].x + 8, y + 16, columns[2].width - 16, {
            size: 8, color: row.started ? [75, 85, 99] : [156, 163, 175], lineHeight: 9
        });

        const badge = row.completed
            ? { fill: [209, 250, 229], text: [6, 95, 70], label: 'Completed', width: 58 }
            : (row.started
                ? { fill: [219, 234, 254], text: [30, 64, 175], label: 'In progress', width: 64 }
                : { fill: [243, 244, 246], text: [107, 114, 128], label: 'Not started', width: 66 });
        pdf.setFillColor(...badge.fill);
        pdf.roundedRect(columns[3].x + 8, y + 8, badge.width, 16, 8, 8, 'F');
        this.setPdfTextStyle(pdf, { size: 7, style: 'bold', color: badge.text });
        pdf.text(badge.label, columns[3].x + 8 + (badge.width / 2), y + 19, { align: 'center' });
    }

    static async generateReport(studentProfile, vocabOrName, scores, options = {}) {
        const vocabName = this.getVocabName(vocabOrName);
        const subjectName = this.getSubjectName(vocabOrName);
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);

        try {
            const words = this.getWordHuntWords(vocabOrName);
            const wordHuntRows = await this.buildWordHuntPdfRows(vocabName, words, options);
            const activityRows = this.getFinalReportActivityRows(scores);
            const summary = this.getFinalReportSummary(activityRows, wordHuntRows);
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: PDF_PAGE_FORMAT });
            const pageHeight = pdf.internal.pageSize.getHeight();
            const bottomMargin = 42;
            let pageNumber = 1;
            let y = this.drawFinalReportHeader(pdf, {
                vocabName, subjectName, fullName, grade, group, pageNumber
            });
            y = this.drawFinalReportSummary(pdf, summary, y);
            this.setPdfTextStyle(pdf, { size: 13, style: 'bold', color: [31, 41, 55] });
            pdf.text('Activity Performance', 42, y);
            y += 14;
            this.setPdfTextStyle(pdf, { size: 8, color: [107, 114, 128] });
            pdf.text('Best saved result for each activity in this vocabulary unit.', 42, y);
            y = this.drawFinalReportTableHeader(pdf, y + 12);

            for (const row of activityRows) {
                const rowHeight = this.getFinalReportRowHeight(pdf, row);
                if (y + rowHeight > pageHeight - bottomMargin) {
                    pdf.addPage(PDF_PAGE_FORMAT, 'portrait');
                    pageNumber += 1;
                    y = this.drawFinalReportHeader(pdf, {
                        vocabName, subjectName, fullName, grade, group, pageNumber
                    });
                    y = this.drawFinalReportTableHeader(pdf, y);
                }
                this.drawFinalReportRow(pdf, row, y, rowHeight);
                y += rowHeight;
            }

            if (wordHuntRows.length > 0) {
                pdf.addPage(PDF_PAGE_FORMAT, 'portrait');
                pageNumber += 1;
                y = this.drawFinalReportHeader(pdf, {
                    vocabName, subjectName, fullName, grade, group, pageNumber
                });
                this.setPdfTextStyle(pdf, { size: 13, style: 'bold', color: [31, 41, 55] });
                pdf.text('Word Hunt Evidence', 42, y);
                y += 14;
                this.setPdfTextStyle(pdf, { size: 8, color: [107, 114, 128] });
                pdf.text('Saved definitions, examples, images, and submission checks.', 42, y);
                y = this.drawWordHuntPdfTableHeader(pdf, y + 12);

                for (const row of wordHuntRows) {
                    const rowHeight = this.getWordHuntPdfRowHeight(pdf, row);
                    if (y + rowHeight > pageHeight - bottomMargin) {
                        pdf.addPage(PDF_PAGE_FORMAT, 'portrait');
                        pageNumber += 1;
                        y = this.drawFinalReportHeader(pdf, {
                            vocabName, subjectName, fullName, grade, group, pageNumber
                        });
                        this.setPdfTextStyle(pdf, { size: 11, style: 'bold', color: [31, 41, 55] });
                        pdf.text('Word Hunt Evidence - continued', 42, y);
                        y = this.drawWordHuntPdfTableHeader(pdf, y + 12);
                    }
                    this.drawWordHuntPdfRow(pdf, row, y, rowHeight);
                    y += rowHeight;
                }
            }

            const totalPages = pdf.getNumberOfPages();
            for (let index = 1; index <= totalPages; index += 1) {
                pdf.setPage(index);
                this.setPdfTextStyle(pdf, { size: 8, color: [107, 114, 128] });
                pdf.text('Vocabulary Master - Automated Report', 42, pageHeight - 20);
                pdf.text(`Page ${index} of ${totalPages}`, pdf.internal.pageSize.getWidth() - 42, pageHeight - 20, {
                    align: 'right'
                });
            }
            pdf.save(this.buildFinalReportFileName(studentProfile, vocabOrName, options));
        } catch (err) {
            console.error('Report generation failed:', err);
            alert('Failed to generate final report PDF.');
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
