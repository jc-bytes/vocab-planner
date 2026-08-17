import { jsPDF } from "jspdf";
import { FINAL_REPORT_ACTIVITIES, PDF_PAGE_FORMAT } from "./reportConstants.js";

export const finalReportMethods = {
    getFinalReportActivityRows(scores = {}) {
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
    },

    getFinalReportSummary(rows = [], wordHuntRows = []) {
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
    },

    drawFinalReportHeader(pdf, { vocabName, subjectName, fullName, grade, group, pageNumber }) {
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
    },

    drawFinalReportSummary(pdf, summary, y) {
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
    },

    getFinalReportColumns() {
        const widths = [138, 62, 214, 114];
        let x = 42;
        const labels = ['Activity', 'Score', 'Details', 'Status'];
        const items = widths.map((width, index) => {
            const column = { label: labels[index], width, x, index };
            x += width;
            return column;
        });
        return { items, totalWidth: widths.reduce((sum, width) => sum + width, 0) };
    },

    drawFinalReportTableHeader(pdf, y) {
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
    },

    getFinalReportRowHeight(pdf, row) {
        const detailsWidth = this.getFinalReportColumns().items[2].width - 16;
        return Math.max(34, 16 + (this.getPdfTextLines(pdf, row.details, detailsWidth, 8).length * 9));
    },

    drawFinalReportRow(pdf, row, y, height) {
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
    },

    async generateReport(studentProfile, vocabOrName, scores, options = {}) {
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
    },
};

