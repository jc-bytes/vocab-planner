import { renderStudentSubjectPicker } from './studentSubjectPicker.js';
import { schoolContext } from '../services/schoolContext.js';
import { schoolRepository } from '../services/schoolRepository.js';
import { classroomRepository, assignmentVocabulary } from '../services/classroomRepository.js';

// Class data belongs to one signed-in account. Old requests cannot replace a
// newer selection or leak the previous student's assignments into the browser.
export class StudentClassSelection {
    constructor(manager, repository = classroomRepository) {
        this.sm = manager;
        this.repository = repository;
        this.classes = [];
        this.vocabs = [];
        this.selectedId = null;
        this.generation = 0;
        this.ready = false;
        this.hasSnapshot = false;
    }
    account() { return this.sm.currentUser?.uid || this.sm.currentUser?.id; }
    reset() {
        this.generation++;
        this.controller?.abort();
        this.owner = null;
        this.hasSnapshot = false;
        this.snapshotClassId = null;
        this.loadedAt = 0;
        this.ready = false;
        this.classes = [];
        this.vocabs = [];
        this.selectedId = null;
        this.pending = null;
        this.invitations = [];
        this.schoolInvitations = [];
    }
    storedSelection(schoolId = schoolContext.getSchoolId()) {
        try { return localStorage.getItem(`sparks:selected-class:${this.account()}:${schoolId || 'no-school'}`); }
        catch { return null; }
    }
    saveSelection(classroom) {
        if (!classroom) return;
        try { localStorage.setItem(`sparks:selected-class:${this.account()}:${classroom.schoolId || schoolContext.getSchoolId() || 'no-school'}`, classroom.id); }
        catch { /* Class selection still works when browser storage is unavailable. */ }
    }
    cancelRead(read) {
        if (!read || this.pending !== read.pending || this.generation !== read.generation || this.owner !== read.owner) return false;
        this.controller?.abort();
        this.generation++;
        this.ready = false;
        this.pending = null;
        return true;
    }
    async load({ forceRefresh = false, onPending } = {}) {
        const owner = this.account();
        if (!owner || this.sm.authDisabled) return;
        if (this.owner === owner && this.pending) {
            onPending?.(this, { pending: this.pending, generation: this.generation, owner });
            return this.pending;
        }
        if (this.owner !== owner) this.reset();
        if (!forceRefresh && this.owner === owner && this.ready
            && this.readySchoolGeneration === schoolContext.getGeneration()
            && (globalThis.navigator?.onLine === false || Date.now() - this.loadedAt < 30000)) return;
        this.owner = owner;
        this.ready = false;
        this.controller?.abort();
        this.controller = new AbortController();
        const signal = this.controller.signal, generation = ++this.generation;
        let schoolGeneration = schoolContext.getGeneration();
        const current = () => !signal.aborted && generation === this.generation && owner === this.account()
            && schoolGeneration === schoolContext.getGeneration();
        const transport = (async () => {
            const [classes, invitations, schoolInvitations] = await Promise.all([
                this.repository.listMyClasses({ signal }),
                this.repository.listMyInvitations?.({ signal }) || [],
                this.repository === classroomRepository ? schoolRepository.listMyInvitations({ signal }) : []
            ]);
            if (!current()) return;
            // The first read can accept a class switch while its assignments are held.
            if (!this.hasSnapshot) this.classes = classes;
            const previous = classes.find(c => c.id === this.selectedId);
            const preferred = previous && (!previous.schoolId || previous.schoolId === schoolContext.getSchoolId())
                ? this.selectedId : this.storedSelection();
            const selectedId = classes.find(c => c.id === preferred)?.id
                || classes.find(c => c.schoolId === schoolContext.getSchoolId())?.id || classes[0]?.id || null;
            const selected = classes.find(c => c.id === selectedId);
            let vocabs = [];
            if (selected) {
                if (selected.schoolId && schoolContext.getSchoolId() !== selected.schoolId) schoolContext.select(selected.schoolId);
                schoolGeneration = schoolContext.getGeneration();
                const assignments = await this.repository.listAssignments(selected.id, { signal });
                const available = assignments.filter(a => a.kind === 'vocabulary' && !a.withdrawn && new Date(a.release_at) <= new Date());
                vocabs = await Promise.all(available.map(async a => assignmentVocabulary(await this.repository.readAssignment(a.id, { signal }))));
            }
            if (current() && schoolGeneration === schoolContext.getGeneration()) {
                this.classes = classes; this.invitations = invitations; this.schoolInvitations = schoolInvitations;
                this.selectedId = selectedId; this.saveSelection(selected);
                this.vocabs = vocabs; this.loadedAt = Date.now();
                this.hasSnapshot = true; this.snapshotClassId = selectedId;
                this.readySchoolGeneration = schoolGeneration;
                this.ready = true;
            }
        })();
        let onAbort;
        const cancelled = new Promise((_, reject) => {
            onAbort = () => reject(new DOMException('Class loading cancelled', 'AbortError'));
            if (signal.aborted) onAbort();
            else signal.addEventListener('abort', onAbort, { once: true });
        });
        const pending = this.pending = Promise.race([transport, cancelled]);
        onPending?.(this, { pending, generation, owner });
        try { await pending; }
        catch (error) {
            if (current() && ([401, 403].includes(Number(error?.status ?? error?.statusCode)) || error?.code === '42501')) {
                this.classes = []; this.vocabs = []; this.invitations = []; this.schoolInvitations = [];
                this.hasSnapshot = false; this.snapshotClassId = null; this.loadedAt = 0;
            }
            throw error;
        }
        finally {
            signal.removeEventListener('abort', onAbort);
            if (this.pending === pending) this.pending = null;
        }
    }
    select(id) {
        if (!this.classes.some(c => c.id === id)) return;
        this.generation++;
        this.controller?.abort();
        this.loadedAt = 0;
        this.ready = false;
        this.hasSnapshot = false;
        this.snapshotClassId = null;
        this.selectedId = id;
        const selected = this.classes.find(c => c.id === id);
        this.saveSelection(selected);
        if (selected.schoolId && schoolContext.getSchoolId() !== selected.schoolId) schoolContext.select(selected.schoolId);
        this.vocabs = [];
        this.pending = null;
        this.sm.resetStudentVocabularyDrilldown();
        this.sm.navigateTo({ view: this.sm.parseRoute()?.view === 'sparks' ? 'sparks' : 'units' });
    }
    renderInvitations(container) {
        if (this.owner !== this.account()) return;
        const owner = this.owner;
        for (const [invites, join] of [
            [this.schoolInvitations, id => schoolRepository.acceptInvitation(id)],
            [this.invitations, id => this.repository.acceptInvitation(id)]
        ]) for (const invite of invites) {
            const row = document.createElement('article');
            row.className = 'card';
            const title = document.createElement('h2');
            title.textContent = invite.className || invite.school_name || invite.schoolName || 'School invitation';
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'btn secondary-btn';
            button.textContent = invite.className ? 'Join class' : 'Join school';
            const status = document.createElement('p'); status.setAttribute('role', 'status');
            button.addEventListener('click', async () => {
                if (owner !== this.account() || button.disabled) return;
                button.disabled = true;
                try { await join(invite.id); this.loadedAt = 0; if (owner === this.account()) this.sm.navigateTo({ view: 'units' }); }
                catch (error) { if (owner === this.account()) { status.textContent = error.message || 'Could not join. Please try again.'; button.disabled = false; } }
            });
            row.append(title, button, status); container.append(row);
        }
    }
    render(container) {
        container.replaceChildren();
        if (this.owner !== this.account()) return;
        const choices = this.classes.map(c => ({ slug: c.id, name: c.subjectName || 'Class', color: '#adc6ff' }));
        if (!choices.length) choices.push({ slug: '', name: 'No classes yet', color: '#adc6ff' });
        const selected = choices.find(c => c.slug === this.selectedId) || choices[0];
        const owner = this.owner;
        renderStudentSubjectPicker(container, choices, selected, id => {
            if (owner === this.account()) this.select(id);
        });
        if (!this.classes.length) container.querySelector('.student-subject-trigger').disabled = true;
    }
}
