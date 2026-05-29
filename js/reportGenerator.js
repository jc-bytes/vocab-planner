import { createElement, $, loadScript } from './main.js';
import { imageDB } from './db.js';

const HTML2CANVAS_SRC = 'js/libs/html2canvas.min.js';

export class ReportGenerator {
    static async ensureHtml2Canvas() {
        if (typeof window.html2canvas === 'function') return window.html2canvas;

        await loadScript(HTML2CANVAS_SRC);

        if (typeof window.html2canvas !== 'function') {
            throw new Error('html2canvas library not loaded');
        }

        return window.html2canvas;
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

    static getWordHuntWords(vocabOrName) {
        const allWords = Array.isArray(vocabOrName?.words) ? vocabOrName.words : [];
        const selectedWords = allWords.filter(word => (
            word.wordHunt === true ||
            word.wordHunt === 'true' ||
            word.word_hunt === true
        ));
        const fallbackLimit = vocabOrName?.activitySettings?.illustration || 5;
        return selectedWords.length > 0 ? selectedWords : allWords.slice(0, fallbackLimit);
    }

    static slugForDownload(value) {
        return String(value || 'word-hunt')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'word-hunt';
    }

    static async generateReport(studentProfile, vocabOrName, scores, options = {}) {
        const vocabName = this.getVocabName(vocabOrName);
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
                <p>Vocabulary Learning App • Automated Report</p>
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
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);
        const objectUrls = [];
        const reportCard = createElement('div', 'report-card word-hunt-report-card');

        reportCard.style.padding = '3rem';
        reportCard.style.background = 'white';
        reportCard.style.color = '#1f2937';
        reportCard.style.borderRadius = '0';
        reportCard.style.width = '800px';
        reportCard.style.fontFamily = "'Inter', sans-serif";
        reportCard.style.position = 'fixed';
        reportCard.style.top = '-9999px';
        reportCard.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';

        reportCard.innerHTML = `
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 1.5rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div>
                    <h1 style="font-size: 2rem; font-weight: 800; color: #111827; margin: 0;">Word Hunt Submission</h1>
                    <p style="color: #6b7280; margin-top: 0.5rem;">Generated on ${new Date().toLocaleDateString()}</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.4rem; font-weight: bold; color: #4f46e5;">${vocabName}</div>
                </div>
            </div>

            <div style="margin-bottom: 2rem; background: #f9fafb; padding: 1.5rem; border-radius: 0.5rem;">
                <h2 style="font-size: 1.25rem; font-weight: 600; margin: 0 0 1rem 0; color: #374151;">Student Information</h2>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <p style="font-size: 0.875rem; color: #6b7280; margin: 0 0 0.25rem 0;">Name</p>
                        <p style="font-size: 1.125rem; font-weight: 500; margin: 0;">${fullName}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.875rem; color: #6b7280; margin: 0 0 0.25rem 0;">Grade</p>
                        <p style="font-size: 1.125rem; font-weight: 500; margin: 0;">${grade || '-'}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.875rem; color: #6b7280; margin: 0 0 0.25rem 0;">Group</p>
                        <p style="font-size: 1.125rem; font-weight: 500; margin: 0;">${group || '-'}</p>
                    </div>
                </div>
            </div>

            <div id="word-hunt-details"></div>
        `;

        document.body.appendChild(reportCard);

        try {
            const html2canvas = await this.ensureHtml2Canvas();

            const detailsContainer = reportCard.querySelector('#word-hunt-details');
            const section = createElement('div');
            const words = this.getWordHuntWords(vocabOrName);
            await this.renderWordHuntTable(section, vocabName, words, {
                ...options,
                objectUrls
            });
            detailsContainer.appendChild(section);

            const canvas = await html2canvas(reportCard);
            const link = document.createElement('a');
            link.download = `word-hunt-${this.slugForDownload(vocabName)}-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Word Hunt report generation failed:', err);
            alert('Failed to generate Word Hunt download.');
        } finally {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
            document.body.removeChild(reportCard);
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
        const sourceWords = words.length > 0
            ? words.map(word => (typeof word === 'string' ? { word } : word))
            : (await this.getWordsFromImageDB(vocabName)).map(word => ({ word }));

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
                    <th style="width: 31%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Definition</th>
                    <th style="width: 22%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Image</th>
                    <th style="width: 31%; padding: 0.75rem; border: 1px solid #e5e7eb; text-align: left;">Examples</th>
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

    static async createWordHuntRow(vocabName, word, entry, options = {}) {
        const row = document.createElement('tr');
        row.style.minHeight = '110px';

        const wordCell = this.createCell(word);
        wordCell.style.fontWeight = '700';
        row.appendChild(wordCell);
        row.appendChild(this.createCell(entry.definition || ''));

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

        const examples = document.createElement('div');
        const exampleOne = document.createElement('p');
        exampleOne.textContent = entry.exampleOne ? `1. ${entry.exampleOne}` : '1. ';
        exampleOne.style.margin = '0 0 0.5rem 0';
        const exampleTwo = document.createElement('p');
        exampleTwo.textContent = entry.exampleTwo ? `2. ${entry.exampleTwo}` : '2. ';
        exampleTwo.style.margin = '0';
        examples.appendChild(exampleOne);
        examples.appendChild(exampleTwo);
        row.appendChild(this.createCell(examples));

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
