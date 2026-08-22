export const WORD_HUNT_TEXT_RULES = Object.freeze({
    definition: Object.freeze({ minChars: 12, minWords: 3 }),
    example: Object.freeze({ minChars: 18, minWords: 4 })
});

export function hasMeaningfulWordHuntText(value, rules = WORD_HUNT_TEXT_RULES.definition) {
    const text = String(value || '').trim();
    if (text.length < rules.minChars) return false;
    return text.split(/\s+/).filter(Boolean).length >= rules.minWords;
}

export function getWordHuntQuality(entry = {}) {
    const quality = {
        definition: hasMeaningfulWordHuntText(entry.definition, WORD_HUNT_TEXT_RULES.definition),
        image: Boolean(entry.hasImage || entry.imagePath),
        examples: (
            hasMeaningfulWordHuntText(entry.exampleOne, WORD_HUNT_TEXT_RULES.example) &&
            hasMeaningfulWordHuntText(entry.exampleTwo, WORD_HUNT_TEXT_RULES.example)
        )
    };
    return { ...quality, complete: Object.values(quality).every(Boolean) };
}
