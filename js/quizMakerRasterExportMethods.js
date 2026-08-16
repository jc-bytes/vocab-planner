import { $ } from './main.js';

class QuizMakerRasterExportMethods {
    async exportAsImage() {
        const target = $('#quiz-questions-list');
        if (!target) {
            alert('Preview not ready to export.');
            return;
        }

        const pages = Array.from(target.querySelectorAll('.document-page')).filter(Boolean);
        if (pages.length === 0) {
            alert('No pages to export.');
            return;
        }

        let html2canvas;
        try {
            html2canvas = await this.ensureHtml2Canvas();
        } catch (err) {
            console.error('Export image failed:', err);
            alert('Could not load the image export library.');
            return;
        }

        const captures = [];
        for (const page of pages) {
            const clone = page.cloneNode(true);
            clone.style.background = '#fff';
            clone.style.zoom = '1';
            clone.style.padding = '0.45in';
            clone.style.width = '8.5in';
            clone.style.minHeight = '11in';
            clone.style.boxSizing = 'border-box';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            document.body.appendChild(clone);

            try {
                const canvas = await html2canvas(clone, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    width: clone.offsetWidth,
                    height: clone.offsetHeight,
                    useCORS: true
                });
                captures.push(canvas.toDataURL('image/png'));
            } catch (err) {
                console.error('Export image failed:', err);
                alert('Could not export image.');
            } finally {
                document.body.removeChild(clone);
            }
        }

        if (!captures.length) return;

        // Show preview overlay with pagination and download
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.55);
            display:flex; align-items:center; justify-content:center;
            z-index:10000; padding:2rem; box-sizing:border-box;
        `;

        const pagesHtml = captures.map((src, idx) => `
            <div class="image-page" data-idx="${idx}" style="display:${idx === 0 ? 'block' : 'none'};">
                <img src="${src}" alt="Quiz page ${idx + 1}" style="max-width:100%; height:auto; display:block; margin:0 auto;">
                <div style="text-align:center; margin-top:0.5rem; color:#555;">Page ${idx + 1} of ${captures.length}</div>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div style="background:#fff; width:90vw; max-width:1000px; max-height:90vh; padding:1rem; border-radius:10px; box-shadow:0 10px 40px rgba(0,0,0,0.3); display:flex; flex-direction:column; gap:0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
                    <strong>Image Preview</strong>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button id="quiz-image-prev" class="btn secondary-btn" style="padding:0.3rem 0.75rem;">Prev</button>
                        <button id="quiz-image-next" class="btn secondary-btn" style="padding:0.3rem 0.75rem;">Next</button>
                        <button id="quiz-image-download" class="btn primary-btn">Download PNGs</button>
                        <button id="quiz-image-close" class="btn text-btn">Close</button>
                    </div>
                </div>
                <div id="quiz-image-pages" style="overflow:auto; max-height:75vh; text-align:center;">
                    ${pagesHtml}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const pageEls = Array.from(overlay.querySelectorAll('.image-page'));
        let current = 0;
        const showPage = (idx) => {
            pageEls.forEach((p, i) => p.style.display = i === idx ? 'block' : 'none');
        };

        overlay.querySelector('#quiz-image-prev').onclick = () => {
            current = (current - 1 + pageEls.length) % pageEls.length;
            showPage(current);
        };
        overlay.querySelector('#quiz-image-next').onclick = () => {
            current = (current + 1) % pageEls.length;
            showPage(current);
        };
        overlay.querySelector('#quiz-image-close').onclick = () => overlay.remove();
        overlay.querySelector('#quiz-image-download').onclick = () => {
            captures.forEach((src, idx) => {
                const link = document.createElement('a');
                link.href = src;
                link.download = `${this.meta.title || 'quiz'}-page-${idx + 1}.png`;
                link.click();
            });
        };

        showPage(0);
    }

    async exportAsPDF() {
        const target = $('#quiz-questions-list');
        if (!target) {
            alert('Preview not ready to export.');
            return;
        }

        const pages = Array.from(target.querySelectorAll('.document-page')).filter(Boolean);
        if (pages.length === 0) {
            alert('No pages to export.');
            return;
        }

        const title = this.escapeHtml(this.meta.title || 'quiz');
        const pdfFrame = document.createElement('iframe');
        pdfFrame.title = `${title} PDF export`;
        pdfFrame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; opacity:0; pointer-events:none;';
        document.body.appendChild(pdfFrame);

        const pdfWindow = pdfFrame.contentWindow;
        const pdfDocument = pdfFrame.contentDocument || pdfWindow?.document;
        if (!pdfWindow || !pdfDocument) {
            pdfFrame.remove();
            alert('Could not prepare the PDF export.');
            return;
        }

        const cleanupPdfFrame = () => {
            window.setTimeout(() => {
                pdfFrame.remove();
                window.focus();
            }, 150);
        };

        pdfDocument.open();
        pdfDocument.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body {
                            margin: 0;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-family: Arial, sans-serif;
                            color: #111827;
                        }
                    </style>
                </head>
                <body>Preparing PDF...</body>
            </html>
        `);
        pdfDocument.close();

        let html2canvas;
        try {
            html2canvas = await this.ensureHtml2Canvas();
        } catch (err) {
            console.error('Export PDF failed:', err);
            pdfFrame.remove();
            alert('Could not load the PDF export library.');
            return;
        }

        const pageImages = [];
        for (const page of pages) {
            const clone = page.cloneNode(true);
            clone.style.background = '#fff';
            clone.style.zoom = '1';
            clone.style.padding = '0.45in';
            clone.style.width = '8.5in';
            clone.style.minHeight = '11in';
            clone.style.boxSizing = 'border-box';
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            document.body.appendChild(clone);

            try {
                const canvas = await html2canvas(clone, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    width: clone.offsetWidth,
                    height: clone.offsetHeight,
                    useCORS: true
                });
                pageImages.push(canvas.toDataURL('image/jpeg', 0.95));
            } catch (err) {
                console.error('Export PDF failed:', err);
                alert('Could not export PDF.');
            } finally {
                document.body.removeChild(clone);
            }
        }

        if (!pageImages.length) {
            pdfFrame.remove();
            return;
        }

        pdfDocument.open();
        pdfDocument.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { size: 8.5in 11in; margin: 0; }
                        body { margin:0; padding:0; }
                        .page { width:8.5in; height:11in; display:flex; align-items:center; justify-content:center; page-break-after: always; }
                        .page:last-child { page-break-after: auto; }
                        img { width:100%; height:auto; }
                    </style>
                </head>
                <body>
                    ${pageImages.map(src => `<div class="page"><img src="${src}"></div>`).join('')}
                </body>
            </html>
        `);
        pdfDocument.close();
        pdfWindow.addEventListener('afterprint', cleanupPdfFrame, { once: true });
        pdfWindow.focus();
        pdfWindow.addEventListener('load', () => {
            pdfWindow.setTimeout(() => pdfWindow.print(), 250);
        }, { once: true });
    }
}

export function installQuizMakerRasterExportMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerRasterExportMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerRasterExportMethods.prototype, name)
        );
    }
}
