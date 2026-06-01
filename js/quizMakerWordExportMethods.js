class QuizMakerWordExportMethods {
    async exportAsWord() {
        if (!this.questions.length) {
            this.generateQuizFromSections();
        }

        let JSZip;
        try {
            JSZip = await this.ensureJSZip();
        } catch (err) {
            console.error('Export Word failed:', err);
            alert('Could not load the Word export library.');
            return;
        }

        try {
            this.updateTotalPoints();
            const logoBuffer = await this.loadDocxLogo();
            this.wordExportLogoRelId = logoBuffer ? 'rIdLogo' : null;
            const zip = new JSZip();
            zip.file('[Content_Types].xml', this.getDocxContentTypes());
            zip.folder('_rels').file('.rels', this.getDocxRootRels());
            const word = zip.folder('word');
            word.file('document.xml', this.buildWordDocumentXml());
            word.file('styles.xml', this.getDocxStyles());
            word.folder('_rels').file('document.xml.rels', this.getDocxDocumentRels());
            if (logoBuffer) {
                word.folder('media').file('logo.jpeg', logoBuffer);
            }

            const blob = await zip.generateAsync({
                type: 'blob',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            this.downloadBlob(blob, `${this.safeFileName(this.meta.title || 'quiz')}.docx`);
        } catch (err) {
            console.error('Export Word failed:', err);
            alert('Could not export Word document.');
        } finally {
            this.wordExportLogoRelId = null;
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

    buildWordDocumentXml() {
        const content = [];
        const rubricTotal = this.meta.rubric.reduce((total, item) => total + (parseInt(item.points) || 0), 0);

        content.push(this.wordHeaderTable());
        if (this.meta.instructions) {
            content.push(this.wordParagraph('INSTRUCTIONS:', { bold: true, color: '475569', after: 80 }));
            content.push(this.wordParagraph(this.meta.instructions, { after: 180 }));
        }
        content.push(this.wordInfoRow());
        if (this.meta.rubric?.length) {
            content.push(this.wordRubricTable(rubricTotal));
        }

        let partNumber = 1;
        this.groupQuestionsByType().forEach(section => {
            const sectionPoints = section.questions.reduce((total, question) => total + (parseInt(question.points) || 0), 0);
            const sectionPointsLabel = sectionPoints === 1 ? '1 pt' : `${sectionPoints} pts`;
            content.push(this.wordParagraph(`Part ${partNumber}: ${section.title}. ${sectionPointsLabel}`, { bold: true, before: 260, after: 80 }));
            content.push(this.wordParagraph(section.instructions, { italic: true, after: 160 }));
            section.questions.forEach((question, index) => {
                content.push(...this.wordQuestionBlocks(question, index + 1));
            });
            partNumber++;
        });

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${content.join('')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="648" w:right="648" w:bottom="648" w:left="648" w:header="360" w:footer="360" w:gutter="0"/>
      <w:pgBorders w:offsetFrom="page">
        <w:top w:val="single" w:sz="6" w:space="24" w:color="111827"/>
        <w:left w:val="single" w:sz="6" w:space="24" w:color="111827"/>
        <w:bottom w:val="single" w:sz="6" w:space="24" w:color="111827"/>
        <w:right w:val="single" w:sz="6" w:space="24" w:color="111827"/>
      </w:pgBorders>
    </w:sectPr>
  </w:body>
</w:document>`;
    }

    wordHeaderTable() {
        return this.wordTable([
            [
                this.wordLogoParagraph(),
                [
                    this.wordParagraph(this.meta.schoolName || '', { bold: true, align: 'center', after: 40 }),
                    this.wordParagraph(this.meta.title || '', { bold: true, align: 'center', after: 40 }),
                    this.wordParagraph(`Teacher: ${this.meta.teacherName || ''} • Grade: ${this.meta.grade || ''}`, { bold: true, align: 'center', color: '475569' })
                ].join(''),
                this.wordParagraph(' ', { align: 'center' })
            ]
        ], { widths: [1200, 7200, 1200], shading: 'F8FAFC' });
    }

    wordLogoParagraph() {
        if (!this.wordExportLogoRelId) {
            return this.wordParagraph('AID', { bold: true, align: 'center' });
        }

        const size = 914400;
        return `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                    <w:spacing w:before="0" w:after="0"/>
                </w:pPr>
                <w:r>
                    <w:drawing>
                        <wp:inline distT="0" distB="0" distL="0" distR="0">
                            <wp:extent cx="${size}" cy="${size}"/>
                            <wp:effectExtent l="0" t="0" r="0" b="0"/>
                            <wp:docPr id="1" name="School logo"/>
                            <wp:cNvGraphicFramePr>
                                <a:graphicFrameLocks noChangeAspect="1"/>
                            </wp:cNvGraphicFramePr>
                            <a:graphic>
                                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                    <pic:pic>
                                        <pic:nvPicPr>
                                            <pic:cNvPr id="1" name="logo.jpeg"/>
                                            <pic:cNvPicPr/>
                                        </pic:nvPicPr>
                                        <pic:blipFill>
                                            <a:blip r:embed="${this.wordExportLogoRelId}"/>
                                            <a:stretch><a:fillRect/></a:stretch>
                                        </pic:blipFill>
                                        <pic:spPr>
                                            <a:xfrm>
                                                <a:off x="0" y="0"/>
                                                <a:ext cx="${size}" cy="${size}"/>
                                            </a:xfrm>
                                            <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                                        </pic:spPr>
                                    </pic:pic>
                                </a:graphicData>
                            </a:graphic>
                        </wp:inline>
                    </w:drawing>
                </w:r>
            </w:p>
        `;
    }

    wordInfoRow() {
        return this.wordTable([[
            this.wordParagraph('Name:', { bold: true, color: '64748B' }),
            this.wordParagraph('Date:', { bold: true, color: '64748B' }),
            this.wordParagraph('Grade:', { bold: true, color: '64748B' })
        ]], { widths: [3200, 3200, 3200], dashed: true });
    }

    wordRubricTable(rubricTotal) {
        const rows = [];
        for (let i = 0; i < this.meta.rubric.length; i += 2) {
            const left = this.meta.rubric[i];
            const right = this.meta.rubric[i + 1];
            rows.push([
                this.wordRubricCell(left),
                right ? this.wordRubricCell(right) : this.wordParagraph('')
            ]);
        }
        rows.push([
            this.wordParagraph(`Total points. ${rubricTotal} pts.`, { bold: true, align: 'right' }),
            this.wordParagraph('', {})
        ]);
        return this.wordTable(rows, { widths: [4800, 4800] });
    }

    wordRubricCell(item) {
        if (!item) return this.wordParagraph('');
        return [
            this.wordParagraph(item.title || '', { bold: true, after: 30 }),
            this.wordParagraph(`${item.desc || ''} ${parseInt(item.points) || 0} pts`, { after: 30 })
        ].join('');
    }

    wordQuestionBlocks(question, index) {
        const points = question.points !== undefined ? `(${question.points} pts)` : '';
        const blocks = [];
        const prompt = `${index}. ${question.prompt || ''} ${points}`.trim();

        if (question.type === 'mc' || question.type === 'synonym') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            (question.options || []).forEach((option, optionIndex) => {
                blocks.push(this.wordParagraph(`${String.fromCharCode(65 + optionIndex)}. ${option}`, { indent: 360, after: 40 }));
            });
        } else if (question.type === 'sata') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            (question.options || []).forEach((option, optionIndex) => {
                blocks.push(this.wordParagraph(`[ ] ${String.fromCharCode(65 + optionIndex)}. ${option.text || option}`, { indent: 360, after: 40 }));
            });
        } else if (question.type === 'tf') {
            blocks.push(this.wordParagraph(`__________ ${prompt}`, { after: 120 }));
        } else if (question.type === 'matching_section') {
            const rows = (question.pairs || []).map((pair, pairIndex) => [
                this.wordParagraph(`${pairIndex + 1}. ${pair.term}`),
                this.wordParagraph(`__________ ${pair.def}`)
            ]);
            blocks.push(this.wordTable(rows, { widths: [4200, 5400] }));
        } else if (question.type === 'short') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            blocks.push(this.wordParagraph('____________________________________________________________________________', { after: 80 }));
            blocks.push(this.wordParagraph('____________________________________________________________________________', { after: 120 }));
        } else if (question.type === 'wordsearch') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            blocks.push(this.wordGridTable(question.grid || []));
            blocks.push(this.wordParagraph(`Words to find: ${(question.words || []).join(', ')}`, { after: 120 }));
        } else if (question.type === 'crossword') {
            blocks.push(this.wordParagraph(prompt, { after: 80 }));
            blocks.push(this.wordCrosswordTable(question.grid || []));
            blocks.push(this.wordParagraph('Across', { bold: true, after: 40 }));
            (question.clues?.across || []).forEach(clue => blocks.push(this.wordParagraph(`${clue.number}. ${clue.clue}`, { after: 30 })));
            blocks.push(this.wordParagraph('Down', { bold: true, after: 40 }));
            (question.clues?.down || []).forEach(clue => blocks.push(this.wordParagraph(`${clue.number}. ${clue.clue}`, { after: 30 })));
        } else {
            blocks.push(this.wordParagraph(prompt, { after: 120 }));
        }

        return blocks;
    }

    wordGridTable(grid) {
        return this.wordTable(grid.map(row => row.map(letter => this.wordParagraph(letter, { bold: true, align: 'center', after: 0 }))), {
            widths: Array(grid[0]?.length || 0).fill(420),
            compact: true
        });
    }

    wordCrosswordTable(grid) {
        return this.wordTable(grid.map(row => row.map(cell => this.wordParagraph(cell?.letter ? '' : '', { after: 0 }))), {
            widths: Array(grid[0]?.length || 0).fill(360),
            compact: true,
            shadeEmpty: grid
        });
    }

    wordTable(rows, options = {}) {
        const widths = options.widths || [];
        const borderStyle = options.dashed ? 'dashed' : 'single';
        const tableRows = rows.map((row, rowIndex) => `
            <w:tr>
                ${row.map((cell, cellIndex) => {
                    const shade = options.shading || (options.shadeEmpty?.[rowIndex]?.[cellIndex]?.letter ? 'FFFFFF' : options.shadeEmpty ? 'E5E7EB' : null);
                    return this.wordCell(cell, widths[cellIndex], { borderStyle, shade, compact: options.compact });
                }).join('')}
            </w:tr>
        `).join('');
        return `
            <w:tbl>
                <w:tblPr>
                    <w:tblW w:w="0" w:type="auto"/>
                    <w:tblBorders>
                        <w:top w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:left w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:bottom w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:right w:val="${borderStyle}" w:sz="4" w:space="0" w:color="CBD5E1"/>
                        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
                    </w:tblBorders>
                </w:tblPr>
                ${tableRows}
            </w:tbl>
            ${this.wordParagraph('', { after: 120 })}
        `;
    }

    wordCell(content, width, options = {}) {
        const widthXml = width ? `<w:tcW w:w="${width}" w:type="dxa"/>` : '';
        const shadeXml = options.shade ? `<w:shd w:fill="${options.shade}"/>` : '';
        const margin = options.compact ? 35 : 90;
        return `
            <w:tc>
                <w:tcPr>
                    ${widthXml}
                    ${shadeXml}
                    <w:tcMar>
                        <w:top w:w="${margin}" w:type="dxa"/>
                        <w:left w:w="${margin}" w:type="dxa"/>
                        <w:bottom w:w="${margin}" w:type="dxa"/>
                        <w:right w:w="${margin}" w:type="dxa"/>
                    </w:tcMar>
                </w:tcPr>
                ${content || this.wordParagraph('')}
            </w:tc>
        `;
    }

    wordParagraph(text, options = {}) {
        const align = options.align ? `<w:jc w:val="${options.align}"/>` : '';
        const indent = options.indent ? `<w:ind w:left="${options.indent}"/>` : '';
        const spacing = `<w:spacing w:before="${options.before || 0}" w:after="${options.after ?? 80}"/>`;
        const color = options.color ? `<w:color w:val="${options.color}"/>` : '';
        return `
            <w:p>
                <w:pPr>${align}${indent}${spacing}</w:pPr>
                <w:r>
                    <w:rPr>
                        <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
                        <w:sz w:val="24"/><w:szCs w:val="24"/>
                        ${options.bold ? '<w:b/>' : ''}
                        ${options.italic ? '<w:i/>' : ''}
                        ${color}
                    </w:rPr>
                    <w:t xml:space="preserve">${this.xmlEscape(text)}</w:t>
                </w:r>
            </w:p>
        `;
    }

    xmlEscape(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    safeFileName(value = 'quiz') {
        return String(value).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'quiz';
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    getDocxContentTypes() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
    }

    getDocxRootRels() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    }

    getDocxDocumentRels() {
        const logoRel = this.wordExportLogoRelId
            ? `\n  <Relationship Id="${this.wordExportLogoRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpeg"/>`
            : '';
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${logoRel}
</Relationships>`;
    }

    getDocxStyles() {
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr>
  </w:style>
</w:styles>`;
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
