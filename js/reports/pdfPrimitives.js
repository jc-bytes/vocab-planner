export const pdfPrimitiveMethods = {
    async blobToDataUrl(blob) {
        if (!blob) return '';
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result || '');
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    },

    async getImageSize(dataUrl) {
        if (!dataUrl) return null;
        const image = new Image();
        image.src = dataUrl;
        return new Promise(resolve => {
            image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
            image.onerror = () => resolve(null);
        });
    },

    async normalizePdfImageDataUrl(dataUrl) {
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
    },

    setPdfTextStyle(pdf, { size = 10, style = 'normal', color = [55, 65, 81] } = {}) {
        pdf.setFont('helvetica', style);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
    },

    drawWrappedPdfText(pdf, text, x, y, width, options = {}) {
        const lineHeight = options.lineHeight || 11;
        this.setPdfTextStyle(pdf, options);
        const lines = pdf.splitTextToSize(String(text || ''), width);
        pdf.text(lines, x, y);
        return y + (lines.length * lineHeight);
    },

    getPdfTextLines(pdf, text, width, fontSize = 9, style = 'normal') {
        pdf.setFont('helvetica', style);
        pdf.setFontSize(fontSize);
        return pdf.splitTextToSize(String(text || ''), width);
    },
};

