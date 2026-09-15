import { studentApi } from '../services/studentApi.js';
import { readLocalArcadeTime } from './studentArcadeTimeStorage.js';

const requests = new WeakMap();

export function renderArcadeHeader(seconds) {
    const target = typeof document === 'undefined' ? null : document.querySelector('[data-student-arcade-time]');
    if (!target) return;
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    target.textContent = `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

export function refreshArcadeHeader(sm) {
    if (typeof document === 'undefined' || !document.querySelector('[data-student-arcade-time]')) return;
    if (sm.authDisabled) { renderArcadeHeader(readLocalArcadeTime().availableSeconds); return; }
    const owner = sm.currentUser?.id;
    if (!owner) { renderArcadeHeader(0); return; }
    if (requests.get(sm)?.owner === owner) return;
    const request = { owner };
    requests.set(sm, request);
    void studentApi.getOwnArcadeTime().then(wallet => {
        if (sm.currentUser?.id === owner) renderArcadeHeader(wallet?.availableSeconds);
    }).catch(() => {}).finally(() => {
        if (requests.get(sm) === request) requests.delete(sm);
    });
}
