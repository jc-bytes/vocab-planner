import { integer, fail } from './contract.js';
import { SIMPLE_LOWERCASE } from './unicodeLowercaseV1.js';
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }
export function fraction(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d <= 0n || n < 0n) fail('INVALID_FRACTION');
    const g = gcd(n, d); return { n: n / g, d: d / g };
}
export function add(a, b) { return fraction(a.n * b.d + b.n * a.d, a.d * b.d); }
export function divide(a, d) { return fraction(a.n, a.d * BigInt(d)); }
export function serializeFraction(a) { return { numerator: String(a.n), denominator: String(a.d) }; }
export function normalizeSpelling(value) {
    if (typeof value !== 'string' || [...value].length > 1024) fail('INVALID_ANSWER');
    return [...value.normalize('NFC')].filter(c => !/[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\u002d\u2010\u2011]/u.test(c))
        .map(c => String.fromCodePoint(SIMPLE_LOWERCASE.get(c.codePointAt(0)) ?? c.codePointAt(0))).join('');
}
export function spellingCredit(expected, answer, assisted = false) {
    const a = [...normalizeSpelling(expected)], b = [...normalizeSpelling(answer)];
    if (!a.length) fail('INVALID_TASK');
    return fraction(BigInt(a.reduce((sum, c, i) => sum + (c === b[i] ? 1 : 0), 0)), BigInt(Math.max(a.length, b.length)) * (assisted ? 2n : 1n));
}
export function binaryCredit(correct, assisted = false) { return fraction(correct ? 1 : 0, assisted ? 2 : 1); }
export function weightedCredit(outcomes, scheduled) {
    if (!scheduled.length) fail('INVALID_TASK');
    const words = new Map(), byId = new Map();
    for (const outcome of outcomes) { if (byId.has(outcome.opportunityId)) fail('DUPLICATE_OUTCOME'); byId.set(outcome.opportunityId, outcome); }
    for (const opportunity of scheduled) {
        if (!byId.has(opportunity.id)) fail('EVIDENCE_INCOMPLETE', opportunity.id);
        const value = byId.get(opportunity.id).credit;
        if (value.n > value.d) fail('INVALID_CREDIT');
        const word = words.get(opportunity.wordId) || { total: fraction(0), count: 0 };
        word.total = add(word.total, value); word.count++; words.set(opportunity.wordId, word);
    }
    if (byId.size !== scheduled.length) fail('EXTRA_OUTCOME');
    let sum = fraction(0); for (const word of words.values()) sum = add(sum, divide(word.total, word.count));
    return divide(sum, words.size);
}
export function comboSummary(outcomes) {
    let current = 0, longest = 0; const celebrations = [];
    for (const outcome of outcomes) {
        current = outcome.credit.n === outcome.credit.d && !outcome.assisted ? current + 1 : 0;
        longest = Math.max(longest, current);
        if (current === 3 || current === 5 || (current >= 10 && current % 5 === 0)) celebrations.push(current);
    }
    return { current, longest, celebrations };
}
export function calculateResult({ outcomes, scheduled, recordedMilliseconds, sharedTargetMilliseconds, passingTarget = 80, finished = true }) {
    integer(recordedMilliseconds); integer(sharedTargetMilliseconds, 1000, 86400000); integer(passingTarget, 1, 100);
    const p = weightedCredit(outcomes, scheduled), t = BigInt(recordedMilliseconds), target = BigInt(sharedTargetMilliseconds);
    const accuracy = fraction(950n * p.n, p.d);
    const speedN = 2n * target - t;
    const speed = !finished || 5n * p.n < 4n * p.d ? fraction(0) : fraction(50n * (speedN < 0n ? 0n : speedN > target ? target : speedN), target);
    const total = add(accuracy, speed), points = Number(total.n / total.d);
    return { weighted: serializeFraction(p), accuracy: serializeFraction(accuracy), speed: serializeFraction(speed), points,
        stars: points === 1000 ? 5 : Math.floor(points / 200), passed: 100n * p.n >= BigInt(passingTarget) * p.d,
        finished, recordedMilliseconds, longestCombo: comboSummary(outcomes).longest };
}
