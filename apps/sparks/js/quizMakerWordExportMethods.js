import {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType
} from 'docx';

const PAGE_SIZE = { width: 12240, height: 15840 };
const PAGE_MARGIN = { top: 648, right: 648, bottom: 648, left: 648, header: 360, footer: 360, gutter: 0 };
const DEFAULT_FONT = 'Arial';
const DEFAULT_FONT_SIZE = 24;
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
const TABLE_INNER_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' };

function alignmentFor(value) {
    if (value === 'center') return AlignmentType.CENTER;
    if (value === 'right' || value === 'end') return AlignmentType.RIGHT;
    if (value === 'justify') return AlignmentType.JUSTIFIED;
    return AlignmentType.LEFT;
}

function createTextRuns(text = '', options = {}) {
    const lines = String(text ?? '').split(/\r?\n/);
    return lines.map((line, index) => new TextRun({
        text: line,
        break: index > 0 ? 1 : undefined,
        bold: options.bold === true,
        italics: options.italic === true,
        color: options.color,
        font: DEFAULT_FONT,
        size: options.size || DEFAULT_FONT_SIZE
    }));
}

function paragraph(text = '', options = {}) {
    return new Paragraph({
        alignment: options.align ? alignmentFor(options.align) : undefined,
        indent: options.indent ? { left: options.indent } : undefined,
        spacing: { before: options.before || 0, after: options.after ?? 80 },
        children: options.children || createTextRuns(text, options)
    });
}

function blankParagraph(after = 120) {
    return paragraph('', { after });
}

function normalizeCellChildren(content) {
    if (Array.isArray(content)) return content.length ? content : [paragraph('')];
    if (content instanceof Paragraph || content instanceof Table) return [content];
    return [paragraph(String(content ?? ''))];
}

function tableCell(content, width, options = {}) {
    return new TableCell({
        width: width ? { size: width, type: WidthType.DXA } : undefined,
        shading: options.shade ? { fill: options.shade } : undefined,
        margins: {
            top: options.compact ? 35 : 90,
            bottom: options.compact ? 35 : 90,
            left: options.compact ? 35 : 90,
            right: options.compact ? 35 : 90
        },
        children: normalizeCellChildren(content)
    });
}

function table(rows, options = {}) {
    const border = options.dashed
        ? { ...TABLE_BORDER, style: BorderStyle.DASHED }
        : TABLE_BORDER;
    const widths = options.widths || [];

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: widths,
        borders: {
            top: border,
            left: border,
            bottom: border,
            right: border,
            insideHorizontal: TABLE_INNER_BORDER,
            insideVertical: TABLE_INNER_BORDER
        },
        rows: rows.map((row, rowIndex) => new TableRow({
            children: row.map((cell, cellIndex) => {
                const shade = options.shading
                    || (options.shadeEmpty
                        ? (options.shadeEmpty[rowIndex]?.[cellIndex]?.letter ? 'FFFFFF' : 'E5E7EB')
                        : null);
                return tableCell(cell, widths[cellIndex], { shade, compact: options.compact });
            })
        }))
    });
}

function logoParagraph(logoBuffer = null) {
    if (!logoBuffer) {
        return paragraph('AID', { bold: true, align: 'center', after: 0 });
    }

    return paragraph('', {
        align: 'center',
        after: 0,
        children: [
            new ImageRun({
                type: 'jpg',
                data: logoBuffer,
                transformation: { width: 64, height: 64 },
                altText: {
                    title: 'School logo',
                    description: 'School logo',
                    name: 'School logo'
                }
            })
        ]
    });
}

function headerTable(meta = {}, logoBuffer = null) {
    return table([
        [
            logoParagraph(logoBuffer),
            [
                paragraph(meta.schoolName || '', { bold: true, align: 'center', after: 40 }),
                paragraph(meta.title || '', { bold: true, align: 'center', after: 40 }),
                paragraph(`Teacher: ${meta.teacherName || ''} • Grade: ${meta.grade || ''}`, {
                    bold: true,
                    align: 'center',
                    color: '475569',
                    after: 0
                })
            ],
            paragraph(' ', { align: 'center', after: 0 })
        ]
    ], { widths: [1200, 7200, 1200], shading: 'F8FAFC' });
}

function infoRow() {
    return table([[
        paragraph('Name:', { bold: true, color: '64748B', after: 0 }),
        paragraph('Date:', { bold: true, color: '64748B', after: 0 }),
        paragraph('Grade:', { bold: true, color: '64748B', after: 0 })
    ]], { widths: [3200, 3200, 3200], dashed: true });
}

function rubricCell(item) {
    if (!item) return paragraph('');
    return [
        paragraph(item.title || '', { bold: true, after: 30 }),
        paragraph(`${item.desc || ''} ${parseInt(item.points, 10) || 0} pts`, { after: 30 })
    ];
}

function rubricTable(meta = {}) {
    const rows = [];
    const rubric = Array.isArray(meta.rubric) ? meta.rubric : [];
    const total = rubric.reduce((sum, item) => sum + (parseInt(item.points, 10) || 0), 0);

    for (let index = 0; index < rubric.length; index += 2) {
        rows.push([
            rubricCell(rubric[index]),
            rubric[index + 1] ? rubricCell(rubric[index + 1]) : paragraph('')
        ]);
    }

    rows.push([
        paragraph(`Total points. ${total} pts.`, { bold: true, align: 'right', after: 0 }),
        paragraph('', { after: 0 })
    ]);

    return table(rows, { widths: [4800, 4800] });
}

function gridTable(grid = []) {
    const width = grid[0]?.length || 0;
    return table(grid.map(row => (
        row.map(letter => paragraph(letter, { bold: true, align: 'center', after: 0 }))
    )), {
        widths: Array(width).fill(420),
        compact: true
    });
}

function crosswordTable(grid = []) {
    const width = grid[0]?.length || 0;
    return table(grid.map(row => (
        row.map(cell => paragraph(cell?.letter ? '' : '', { after: 0 }))
    )), {
        widths: Array(width).fill(360),
        compact: true,
        shadeEmpty: grid
    });
}

function questionBlocks(question = {}, index = 1) {
    const points = question.points !== undefined ? `(${question.points} pts)` : '';
    const prompt = `${index}. ${question.prompt || ''} ${points}`.trim();
    const blocks = [];

    if (question.type === 'mc' || question.type === 'synonym') {
        blocks.push(paragraph(prompt, { after: 80 }));
        (question.options || []).forEach((option, optionIndex) => {
            blocks.push(paragraph(`${String.fromCharCode(65 + optionIndex)}. ${option}`, { indent: 360, after: 40 }));
        });
    } else if (question.type === 'sata') {
        blocks.push(paragraph(prompt, { after: 80 }));
        (question.options || []).forEach((option, optionIndex) => {
            blocks.push(paragraph(`[ ] ${String.fromCharCode(65 + optionIndex)}. ${option.text || option}`, { indent: 360, after: 40 }));
        });
    } else if (question.type === 'tf') {
        blocks.push(paragraph(`__________ ${prompt}`, { after: 120 }));
    } else if (question.type === 'matching_section') {
        blocks.push(table((question.pairs || []).map((pair, pairIndex) => [
            paragraph(`${pairIndex + 1}. ${pair.term}`, { after: 0 }),
            paragraph(`__________ ${pair.def}`, { after: 0 })
        ]), { widths: [4200, 5400] }));
        blocks.push(blankParagraph());
    } else if (question.type === 'short') {
        blocks.push(paragraph(prompt, { after: 80 }));
        blocks.push(paragraph('____________________________________________________________________________', { after: 80 }));
        blocks.push(paragraph('____________________________________________________________________________', { after: 120 }));
    } else if (question.type === 'wordsearch') {
        blocks.push(paragraph(prompt, { after: 80 }));
        blocks.push(gridTable(question.grid || []));
        blocks.push(paragraph(`Words to find: ${(question.words || []).join(', ')}`, { after: 120 }));
    } else if (question.type === 'crossword') {
        blocks.push(paragraph(prompt, { after: 80 }));
        blocks.push(crosswordTable(question.grid || []));
        blocks.push(paragraph('Across', { bold: true, after: 40 }));
        (question.clues?.across || []).forEach(clue => {
            blocks.push(paragraph(`${clue.number}. ${clue.clue}`, { after: 30 }));
        });
        blocks.push(paragraph('Down', { bold: true, after: 40 }));
        (question.clues?.down || []).forEach(clue => {
            blocks.push(paragraph(`${clue.number}. ${clue.clue}`, { after: 30 }));
        });
    } else {
        blocks.push(paragraph(prompt, { after: 120 }));
    }

    return blocks;
}

function documentChildren(quizMaker, logoBuffer = null) {
    const meta = quizMaker.meta || {};
    const children = [headerTable(meta, logoBuffer), blankParagraph(120)];

    if (meta.instructions) {
        children.push(paragraph('INSTRUCTIONS:', { bold: true, color: '475569', after: 80 }));
        children.push(paragraph(meta.instructions, { after: 180 }));
    }

    children.push(infoRow(), blankParagraph(120));

    if (Array.isArray(meta.rubric) && meta.rubric.length) {
        children.push(rubricTable(meta), blankParagraph(160));
    }

    const sections = typeof quizMaker.groupQuestionsByType === 'function'
        ? quizMaker.groupQuestionsByType()
        : [];
    sections.forEach((section, sectionIndex) => {
        const sectionPoints = (section.questions || []).reduce((total, question) => (
            total + (parseInt(question.points, 10) || 0)
        ), 0);
        children.push(paragraph(
            `Part ${sectionIndex + 1}: ${section.title}. ${sectionPoints === 1 ? '1 pt' : `${sectionPoints} pts`}`,
            { bold: true, before: 260, after: 80 }
        ));
        children.push(paragraph(section.instructions, { italic: true, after: 160 }));
        (section.questions || []).forEach((question, questionIndex) => {
            children.push(...questionBlocks(question, questionIndex + 1));
        });
    });

    return children;
}

export function buildQuizWordDocument(quizMaker, logoBuffer = null) {
    const meta = quizMaker.meta || {};
    return new Document({
        title: meta.title || 'Quiz',
        creator: meta.teacherName || 'Vocabulary Master',
        styles: {
            default: {
                document: {
                    run: {
                        font: DEFAULT_FONT,
                        size: DEFAULT_FONT_SIZE
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    size: PAGE_SIZE,
                    margin: PAGE_MARGIN,
                    borders: {
                        pageBorders: { offsetFrom: 'page' },
                        pageBorderTop: { ...TABLE_BORDER, color: '111827', space: 24, size: 6 },
                        pageBorderRight: { ...TABLE_BORDER, color: '111827', space: 24, size: 6 },
                        pageBorderBottom: { ...TABLE_BORDER, color: '111827', space: 24, size: 6 },
                        pageBorderLeft: { ...TABLE_BORDER, color: '111827', space: 24, size: 6 }
                    }
                }
            },
            children: documentChildren(quizMaker, logoBuffer)
        }]
    });
}

export async function buildQuizWordDocumentBlob(quizMaker, logoBuffer = null) {
    return Packer.toBlob(buildQuizWordDocument(quizMaker, logoBuffer));
}

class QuizMakerWordExportMethods {
    async exportAsWord() {
        if (this.disposed) return false;
        const lifecycleGeneration = this.lifecycleGeneration;
        if (!this.questions.length) {
            this.generateQuizFromSections();
        }

        try {
            this.updateTotalPoints();
            const logoBuffer = await this.loadDocxLogo();
            if (this.disposed || lifecycleGeneration !== this.lifecycleGeneration) return false;
            const blob = await this.buildWordDocumentBlob(logoBuffer);
            if (this.disposed || lifecycleGeneration !== this.lifecycleGeneration) return false;
            this.downloadBlob(blob, `${this.safeFileName(this.meta.title || 'quiz')}.docx`);
            return true;
        } catch (err) {
            if (this.disposed || lifecycleGeneration !== this.lifecycleGeneration) return false;
            console.error('Export Word failed:', err);
            alert('Could not export Word document.');
            return false;
        }
    }

    async loadDocxLogo() {
        try {
            const response = await fetch('logo.jpeg');
            if (!response.ok) return null;
            return await response.arrayBuffer();
        } catch (error) {
            console.warn('Could not embed logo in Word export:', error);
            return null;
        }
    }

    buildWordDocument(logoBuffer = null) {
        return buildQuizWordDocument(this, logoBuffer);
    }

    async buildWordDocumentBlob(logoBuffer = null) {
        return buildQuizWordDocumentBlob(this, logoBuffer);
    }

    safeFileName(value = 'quiz') {
        return String(value).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'quiz';
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        this.downloadUrls.add(url);
        const link = document.createElement('a');
        const revokeUrl = () => {
            if (!this.downloadUrls.delete(url)) return;
            URL.revokeObjectURL(url);
        };

        try {
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            revokeUrl();
            throw error;
        } finally {
            link.remove();
        }

        try {
            const timer = window.setTimeout(() => {
                this.downloadRevokeTimers.delete(url);
                revokeUrl();
            }, 1000);
            this.downloadRevokeTimers.set(url, timer);
        } catch (error) {
            revokeUrl();
            throw error;
        }
    }
}

export function installQuizMakerWordExportMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerWordExportMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerWordExportMethods.prototype, name)
        );
    }
}
