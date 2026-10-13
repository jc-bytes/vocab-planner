let fallbackSequence = 0;

function formatUuid(bytes) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

export function shuffleInPlace(items, random = Math.random) {
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
}

export function shuffled(items, random = Math.random) {
    return shuffleInPlace([...items], random);
}

export function createUniqueId(prefix = '', cryptoProvider = globalThis.crypto) {
    if (typeof cryptoProvider?.randomUUID === 'function') {
        return `${prefix}${cryptoProvider.randomUUID()}`;
    }

    if (typeof cryptoProvider?.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        cryptoProvider.getRandomValues(bytes);
        return `${prefix}${formatUuid(bytes)}`;
    }

    fallbackSequence += 1;
    return `${prefix}${Date.now().toString(36)}-${fallbackSequence.toString(36)}`;
}
