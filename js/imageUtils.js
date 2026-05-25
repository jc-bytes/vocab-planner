export const WORD_HUNT_IMAGE_LIMITS = {
    maxWidth: 220,
    maxHeight: 140,
    initialQuality: 0.55,
    targetBytes: 45 * 1024,
    maxBytes: 64 * 1024
};

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
        if (blob) {
            resolve(blob);
        } else {
            reject(new Error('Could not create WebP image.'));
        }
    }, 'image/webp', quality);
});

const loadImageElement = (blob) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
    };
    image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not load image.'));
    };
    image.src = url;
});

export async function compressImageToWebp(fileOrBlob, options = {}) {
    const limits = { ...WORD_HUNT_IMAGE_LIMITS, ...options };
    const image = await loadImageElement(fileOrBlob);
    const ratio = Math.min(
        limits.maxWidth / image.width,
        limits.maxHeight / image.height,
        1
    );

    let baseWidth = Math.max(1, Math.round(image.width * ratio));
    let baseHeight = Math.max(1, Math.round(image.height * ratio));
    let best = null;

    for (let scaleAttempt = 0; scaleAttempt < 5; scaleAttempt++) {
        const scale = Math.pow(0.86, scaleAttempt);
        const width = Math.max(1, Math.round(baseWidth * scale));
        const height = Math.max(1, Math.round(baseHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.drawImage(image, 0, 0, width, height);

        const qualities = [
            limits.initialQuality,
            0.5,
            0.45,
            0.4,
            0.35,
            0.3
        ].filter((quality, index, values) => (
            quality > 0 && values.indexOf(quality) === index
        ));

        for (const quality of qualities) {
            const blob = await canvasToBlob(canvas, quality);
            const candidate = {
                blob,
                width,
                height,
                sizeBytes: blob.size,
                mimeType: 'image/webp'
            };

            if (!best || candidate.sizeBytes < best.sizeBytes) {
                best = candidate;
            }

            if (candidate.sizeBytes <= limits.targetBytes) {
                return candidate;
            }
        }
    }

    if (!best || best.sizeBytes > limits.maxBytes) {
        throw new Error('Image is too large. Try a simpler or smaller image.');
    }

    return best;
}

export async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
}
