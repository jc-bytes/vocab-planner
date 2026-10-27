export const WORD_HUNT_IMAGE_LIMITS = {
    // The PDF renders these at no more than about 100 x 76 pt, so a larger
    // thumbnail adds storage and export weight without visible classroom value.
    maxWidth: 160,
    maxHeight: 112,
    initialQuality: 0.5,
    targetBytes: 24 * 1024,
    maxBytes: 40 * 1024
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
            0.45,
            0.4,
            0.35,
            0.3,
            0.25
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
    // Decode locally: fetch(data:) is blocked by the student's connect-src policy.
    const url = new URL(dataUrl);
    if (url.protocol !== 'data:') throw new TypeError('An image data URL is required.');
    const serialized = url.href.split('#', 1)[0];
    const comma = serialized.indexOf(',');
    if (comma < 0) throw new TypeError('Invalid data URL.');
    let type = serialized.slice(5, comma).trim();
    const base64 = /; *base64$/i.test(type);
    if (base64) type = type.replace(/; *base64$/i, '');
    // Browser data-URL fetches expose the MIME essence on their returned Blob.
    type = type.split(';', 1)[0].trim();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+\/[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(type)) type = 'text/plain';
    const encoded = new TextEncoder().encode(serialized.slice(comma + 1));
    const bytes = [];
    const hex = value => (value >= 48 && value <= 57) || (value >= 65 && value <= 70) || (value >= 97 && value <= 102);
    for (let i = 0; i < encoded.length; i++) {
        if (encoded[i] === 37 && hex(encoded[i + 1]) && hex(encoded[i + 2])) {
            bytes.push(parseInt(String.fromCharCode(encoded[++i], encoded[++i]), 16));
        } else bytes.push(encoded[i]);
    }
    if (!base64) return new Blob([new Uint8Array(bytes)], { type });
    // Percent decoding precedes forgiving-base64 decoding, including whitespace/unpadded input.
    let text = '';
    for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.slice(i, i + 16384));
    const decoded = atob(text);
    return new Blob([Uint8Array.from(decoded, character => character.charCodeAt(0))], { type });
}
