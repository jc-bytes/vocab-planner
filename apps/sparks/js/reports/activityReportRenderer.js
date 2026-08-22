import { jsPDF } from "jspdf";
import { PDF_PAGE_FORMAT } from "./reportConstants.js";

export const activityReportMethods = {
    startActivityAppendixPage(pdf, title, subtitle = '') {
        pdf.addPage(PDF_PAGE_FORMAT, 'portrait');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 42;
        this.setPdfTextStyle(pdf, { size: 19, style: 'bold', color: [17, 24, 39] });
        pdf.text(title, margin, 48);
        if (subtitle) {
            this.setPdfTextStyle(pdf, { size: 9, color: [107, 114, 128] });
            pdf.text(pdf.splitTextToSize(subtitle, pageWidth - (margin * 2)), margin, 66);
        }
        pdf.setDrawColor(79, 70, 229);
        pdf.setLineWidth(1.2);
        pdf.line(margin, subtitle ? 82 : 66, pageWidth - margin, subtitle ? 82 : 66);
        return subtitle ? 102 : 86;
    },

    getActivityVocabularyRows(vocabOrName) {
        if (!Array.isArray(vocabOrName?.words)) return [];
        return vocabOrName.words.map((word, index) => ({
            number: index + 1,
            word: String(word?.word || '').trim(),
            definition: String(word?.definition || word?.matchText || word?.example || '').trim()
        })).filter(row => row.word);
    },

    drawWordSearchArtifact(pdf, state = {}, completed = false) {
        const grid = Array.isArray(state?.grid) ? state.grid : [];
        if (grid.length === 0 || !grid.every(row => Array.isArray(row))) return false;

        let y = this.startActivityAppendixPage(
            pdf,
            'Completed Word Search',
            'The saved puzzle is reconstructed below. Green cells show the vocabulary words the student found.'
        );
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 42;
        const columnCount = Math.max(...grid.map(row => row.length));
        const cellSize = Math.min(27, Math.floor((pageWidth - (margin * 2)) / Math.max(1, columnCount)));
        const gridWidth = cellSize * columnCount;
        const startX = (pageWidth - gridWidth) / 2;
        const foundWords = new Set((Array.isArray(state.foundWords) ? state.foundWords : []).map(String));
        const foundCells = new Set();
        const wordPositions = Array.isArray(state.wordPositions) ? state.wordPositions : [];
        wordPositions.forEach(position => {
            const isFound = completed || foundWords.has(String(position?.word || ''));
            if (!isFound) return;
            (Array.isArray(position?.positions) ? position.positions : []).forEach(cell => {
                foundCells.add(`${cell.row}:${cell.col}`);
            });
        });

        grid.forEach((row, rowIndex) => {
            for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
                const x = startX + (columnIndex * cellSize);
                const cellY = y + (rowIndex * cellSize);
                const isFound = foundCells.has(`${rowIndex}:${columnIndex}`);
                pdf.setFillColor(...(isFound ? [209, 250, 229] : [249, 250, 251]));
                pdf.setDrawColor(...(isFound ? [16, 185, 129] : [209, 213, 219]));
                pdf.rect(x, cellY, cellSize, cellSize, 'FD');
                this.setPdfTextStyle(pdf, {
                    size: Math.max(7, Math.min(10, cellSize * 0.36)),
                    style: isFound ? 'bold' : 'normal',
                    color: isFound ? [6, 95, 70] : [31, 41, 55]
                });
                pdf.text(String(row[columnIndex] || '').slice(0, 1), x + (cellSize / 2), cellY + (cellSize * 0.67), {
                    align: 'center'
                });
            }
        });

        y += (grid.length * cellSize) + 24;
        this.setPdfTextStyle(pdf, { size: 11, style: 'bold', color: [31, 41, 55] });
        pdf.text(`Words found (${wordPositions.length})`, margin, y);
        y += 18;
        const labels = wordPositions.map(item => String(item?.word || '').trim()).filter(Boolean).sort();
        const columns = 3;
        const columnWidth = (pageWidth - (margin * 2)) / columns;
        labels.forEach((label, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [6, 95, 70] });
            pdf.text(`Found - ${label}`, margin + (column * columnWidth), y + (row * 15));
        });
        return true;
    },

    drawCrosswordArtifact(pdf, state = {}) {
        const grid = Array.isArray(state?.grid) ? state.grid : [];
        if (grid.length === 0 || !grid.every(row => Array.isArray(row))) return false;

        let y = this.startActivityAppendixPage(
            pdf,
            'Completed Crossword',
            'The completed crossword and its saved vocabulary clues are reconstructed from the student activity.'
        );
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 42;
        const columnCount = Math.max(...grid.map(row => row.length));
        const cellSize = Math.min(25, Math.floor((pageWidth - (margin * 2)) / Math.max(1, columnCount)));
        const gridWidth = cellSize * columnCount;
        const startX = (pageWidth - gridWidth) / 2;

        grid.forEach((row, rowIndex) => {
            for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
                const cell = row[columnIndex];
                const x = startX + (columnIndex * cellSize);
                const cellY = y + (rowIndex * cellSize);
                if (!cell) {
                    pdf.setFillColor(31, 41, 55);
                    pdf.rect(x, cellY, cellSize, cellSize, 'F');
                    continue;
                }
                pdf.setFillColor(236, 253, 245);
                pdf.setDrawColor(110, 231, 183);
                pdf.rect(x, cellY, cellSize, cellSize, 'FD');
                if (cell.isStart) {
                    this.setPdfTextStyle(pdf, { size: 5, style: 'bold', color: [107, 114, 128] });
                    pdf.text(String((Number(cell.wordIndex) || 0) + 1), x + 2, cellY + 6);
                }
                this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [6, 95, 70] });
                pdf.text(String(cell.char || cell.value || '').slice(0, 1), x + (cellSize / 2), cellY + (cellSize * 0.7), {
                    align: 'center'
                });
            }
        });

        y += (grid.length * cellSize) + 22;
        const placedWords = Array.isArray(state.placedWords) ? state.placedWords : [];
        this.setPdfTextStyle(pdf, { size: 11, style: 'bold', color: [31, 41, 55] });
        pdf.text(`Solved clues (${placedWords.length})`, margin, y);
        y += 17;
        placedWords.forEach((item, index) => {
            const label = `${item.number || index + 1}. ${item.word || ''} - ${item.definition || ''}`;
            const lines = pdf.splitTextToSize(label, pageWidth - (margin * 2));
            const clueHeight = (lines.length * 9) + 3;
            if (y + clueHeight > pageHeight - 46) {
                y = this.startActivityAppendixPage(pdf, 'Completed Crossword - clues continued');
            }
            this.setPdfTextStyle(pdf, { size: 8, color: [55, 65, 81] });
            pdf.text(lines, margin, y);
            y += clueHeight;
        });
        return true;
    },

    drawQuestionReviewArtifact(pdf, activityLabel, state = {}) {
        const questions = Array.isArray(state?.questions) ? state.questions : [];
        const answers = Array.isArray(state?.selectedAnswers) ? state.selectedAnswers : [];
        if (questions.length === 0 || answers.length === 0) return false;

        const pageHeight = pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 42;
        let y = this.startActivityAppendixPage(
            pdf,
            `${activityLabel} Answer Review`,
            'Each saved response is shown with the expected answer and its result.'
        );

        questions.forEach((question, index) => {
            const answer = answers[index] || {};
            const prompt = question.type
                ? `${question.type}: ${question.word || ''}`
                : String(question.word || question.prompt || `Question ${index + 1}`);
            const selected = String(answer.selected || 'No saved response');
            const correct = String(answer.correct || question.correctAnswer || '');
            const promptLines = pdf.splitTextToSize(`${index + 1}. ${prompt}`, pageWidth - (margin * 2) - 20);
            const selectedLines = pdf.splitTextToSize(`Student answer: ${selected}`, pageWidth - (margin * 2) - 20);
            const correctLines = pdf.splitTextToSize(`Correct answer: ${correct}`, pageWidth - (margin * 2) - 20);
            const rowHeight = 22 + ((promptLines.length + selectedLines.length + correctLines.length) * 10);
            if (y + rowHeight > pageHeight - 46) {
                y = this.startActivityAppendixPage(pdf, `${activityLabel} Answer Review - continued`);
            }
            pdf.setFillColor(answer.isCorrect ? 236 : 254, answer.isCorrect ? 253 : 242, answer.isCorrect ? 245 : 242);
            pdf.setDrawColor(answer.isCorrect ? 110 : 254, answer.isCorrect ? 231 : 202, answer.isCorrect ? 183 : 202);
            pdf.roundedRect(margin, y, pageWidth - (margin * 2), rowHeight, 4, 4, 'FD');
            this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [31, 41, 55] });
            pdf.text(promptLines, margin + 10, y + 16);
            let textY = y + 18 + (promptLines.length * 10);
            this.setPdfTextStyle(pdf, { size: 8, color: answer.isCorrect ? [6, 95, 70] : [153, 27, 27] });
            pdf.text(selectedLines, margin + 10, textY);
            textY += selectedLines.length * 10;
            this.setPdfTextStyle(pdf, { size: 8, color: [75, 85, 99] });
            pdf.text(correctLines, margin + 10, textY);
            y += rowHeight + 7;
        });
        return true;
    },

    drawVocabularyArtifact(pdf, activityLabel, vocabOrName, state = {}) {
        const rows = this.getActivityVocabularyRows(vocabOrName);
        if (rows.length === 0) return false;
        const pageHeight = pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 42;
        let y = this.startActivityAppendixPage(
            pdf,
            `${activityLabel} Completed Work`,
            'Vocabulary used in this completed activity. Saved activity state is reflected where available.'
        );

        rows.forEach(row => {
            const definitionLines = pdf.splitTextToSize(row.definition || 'No definition saved', pageWidth - 232);
            const rowHeight = Math.max(34, 16 + (definitionLines.length * 9));
            if (y + rowHeight > pageHeight - 46) {
                y = this.startActivityAppendixPage(pdf, `${activityLabel} Completed Work - continued`);
            }
            pdf.setDrawColor(229, 231, 235);
            pdf.rect(margin, y, pageWidth - (margin * 2), rowHeight);
            this.setPdfTextStyle(pdf, { size: 8, style: 'bold', color: [6, 95, 70] });
            pdf.text('COMPLETED', margin + 9, y + 18);
            this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [31, 41, 55] });
            pdf.text(`${row.number}. ${row.word}`, margin + 78, y + 18);
            this.setPdfTextStyle(pdf, { size: 8, color: [75, 85, 99] });
            pdf.text(definitionLines, margin + 148, y + 17);
            y += rowHeight;
        });

        if (activityLabel === 'Matching' && Array.isArray(state?.roundStats) && state.roundStats.length > 0) {
            y += 18;
            if (y + 48 > pageHeight - 46) y = this.startActivityAppendixPage(pdf, 'Matching Round Performance');
            this.setPdfTextStyle(pdf, { size: 11, style: 'bold', color: [31, 41, 55] });
            pdf.text('Round performance', margin, y);
            y += 17;
            state.roundStats.forEach(round => {
                const seconds = Math.max(0, Math.round((Number(round.elapsedMs) || 0) / 1000));
                this.setPdfTextStyle(pdf, { size: 8, color: [55, 65, 81] });
                pdf.text(
                    `Set ${round.roundNumber}: ${round.size} pairs, ${round.attempts} attempts, ${round.accuracy}% accuracy, ${seconds}s`,
                    margin,
                    y
                );
                y += 13;
            });
        }
        return true;
    },

    drawActivityArtifact(pdf, activityType, vocabOrName, reportData, state = {}) {
        if (activityType === 'word-search' && this.drawWordSearchArtifact(pdf, state, reportData.isComplete)) return;
        if (activityType === 'crossword' && this.drawCrosswordArtifact(pdf, state)) return;
        if (['quiz', 'synonym-antonym'].includes(activityType)
            && this.drawQuestionReviewArtifact(pdf, this.getActivityLabel(activityType), state)) return;
        this.drawVocabularyArtifact(pdf, this.getActivityLabel(activityType), vocabOrName, state);
    },

    drawActivityReportFooters(pdf) {
        const totalPages = pdf.getNumberOfPages();
        for (let index = 1; index <= totalPages; index += 1) {
            pdf.setPage(index);
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();
            this.setPdfTextStyle(pdf, { size: 8, color: [107, 114, 128] });
            pdf.text('Vocabulary Master - Individual Activity Export', 42, pageHeight - 24);
            pdf.text(`Page ${index} of ${totalPages}`, pageWidth - 42, pageHeight - 24, { align: 'right' });
        }
    },

    generateActivityReport(studentProfile, vocabOrName, activityType, scoreData = {}, options = {}) {
        const reportData = this.normalizeActivityReportScoreData(scoreData);
        const activityLabel = this.getActivityLabel(activityType);
        const vocabName = this.getVocabName(vocabOrName);
        const subjectName = this.getSubjectName(vocabOrName);
        const { fullName, grade, group } = this.getStudentInfo(studentProfile);
        const rawScore = Number(reportData.score);
        const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
        const completed = Boolean(reportData.isComplete) || score >= 100;
        if (!completed) throw new Error('Only completed activities can be exported.');

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: PDF_PAGE_FORMAT });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 48;
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        this.setPdfTextStyle(pdf, { size: 21, style: 'bold', color: [17, 24, 39] });
        pdf.text(`${activityLabel} Result`, margin, y);
        y += 22;
        this.setPdfTextStyle(pdf, { size: 10, color: [107, 114, 128] });
        pdf.text(`${subjectName}  |  ${vocabName}`, margin, y);
        const completionDate = reportData.finishedAt ? new Date(reportData.finishedAt) : new Date();
        pdf.text(`Completed ${completionDate.toLocaleDateString()}`, pageWidth - margin, y, { align: 'right' });
        y += 16;
        pdf.setDrawColor(79, 70, 229);
        pdf.setLineWidth(1.5);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 26;

        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(margin, y, contentWidth, 68, 6, 6, 'FD');
        this.setPdfTextStyle(pdf, { size: 8, style: 'bold', color: [107, 114, 128] });
        pdf.text('STUDENT', margin + 16, y + 20);
        pdf.text('GRADE / GROUP', margin + 280, y + 20);
        this.setPdfTextStyle(pdf, { size: 12, style: 'bold', color: [31, 41, 55] });
        pdf.text(fullName, margin + 16, y + 43);
        pdf.text(`${grade || '-'} / ${group || '-'}`, margin + 280, y + 43);
        y += 92;

        const cardGap = 12;
        const cardWidth = (contentWidth - cardGap) / 2;
        [['BEST SCORE', `${score}%`], ['STATUS', 'Completed']].forEach(([label, value], index) => {
            const x = margin + (index * (cardWidth + cardGap));
            const fill = index === 0 ? [238, 242, 255] : [236, 253, 245];
            pdf.setFillColor(...fill);
            pdf.roundedRect(x, y, cardWidth, 70, 6, 6, 'F');
            this.setPdfTextStyle(pdf, { size: 8, style: 'bold', color: [79, 70, 229] });
            pdf.text(label, x + 16, y + 20);
            this.setPdfTextStyle(pdf, { size: 22, style: 'bold', color: [31, 41, 55] });
            pdf.text(value, x + 16, y + 50);
        });
        y += 100;

        const lifetimeAttempted = Number(reportData.lifetimeAttempted) || 0;
        const lifetimeCorrect = Number(reportData.lifetimeCorrect) || 0;
        if (lifetimeAttempted > 0) {
            const lifetimeAccuracy = Number.isFinite(Number(reportData.lifetimeAccuracy))
                ? Number(reportData.lifetimeAccuracy)
                : Math.round((lifetimeCorrect / lifetimeAttempted) * 1000) / 10;
            const runCount = Number(reportData.finishedRuns) || 1;
            const metricLabel = String(reportData.metricLabel || 'accuracy');
            const lifetimeLabel = metricLabel.charAt(0).toLowerCase() + metricLabel.slice(1);
            this.setPdfTextStyle(pdf, { size: 10, style: 'bold', color: [55, 65, 81] });
            pdf.text(
                `Lifetime ${lifetimeLabel}: ${lifetimeAccuracy}% `
                + `(${lifetimeCorrect}/${lifetimeAttempted} across ${runCount} finished ${runCount === 1 ? 'attempt' : 'attempts'})`,
                margin,
                y - 18
            );
        }

        this.setPdfTextStyle(pdf, { size: 13, style: 'bold', color: [31, 41, 55] });
        pdf.text('Activity details', margin, y);
        y += 19;
        y = this.drawWrappedPdfText(pdf, reportData.details, margin, y, contentWidth, {
            size: 10, color: [75, 85, 99], lineHeight: 13
        }) + 14;

        const evidenceRows = this.getActivityEvidenceRows(reportData);
        if (evidenceRows.length > 0) {
            this.setPdfTextStyle(pdf, { size: 13, style: 'bold', color: [31, 41, 55] });
            pdf.text('Saved evidence', margin, y);
            y += 18;
            evidenceRows.forEach(row => {
                const valueLines = this.getPdfTextLines(pdf, row.value, contentWidth - 170, 9);
                const rowHeight = Math.max(30, 14 + (valueLines.length * 10));
                pdf.setDrawColor(229, 231, 235);
                pdf.rect(margin, y, contentWidth, rowHeight);
                this.setPdfTextStyle(pdf, { size: 9, style: 'bold', color: [55, 65, 81] });
                pdf.text(row.label, margin + 10, y + 18);
                this.setPdfTextStyle(pdf, { size: 9, color: [75, 85, 99] });
                pdf.text(valueLines, margin + 170, y + 18);
                y += rowHeight;
            });
        }

        this.drawActivityArtifact(pdf, activityType, vocabOrName, reportData, options.state || {});
        this.drawActivityReportFooters(pdf);
        pdf.save(this.buildActivityReportFileName(studentProfile, vocabOrName, activityType, options));
    },
};

