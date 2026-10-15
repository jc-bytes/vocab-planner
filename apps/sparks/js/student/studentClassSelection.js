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
    }
    account() { return this.sm.currentUser?.uid || this.sm.currentUser?.id; }
    reset() {
        this.generation++;
        this.controller?.abort();
        this.owner = null;
        this.loadedAt = 0;
        this.classes = [];
        this.vocabs = [];
        this.selectedId = null;
        this.pending = null;
        this.invitations = [];
        this.schoolInvitations = [];
    }
    async load({ forceRefresh = false } = {}) {
        const owner = this.account();
        if (!owner || this.sm.authDisabled) return;
        if (this.owner === owner && this.pending) return this.pending;
        if (this.owner !== owner) this.reset();
        if (!forceRefresh && this.owner === owner && Date.now() - this.loadedAt < 30000) return;
        this.owner = owner;
        this.controller?.abort();
        this.controller = new AbortController();
        const signal = this.controller.signal, generation = ++this.generation;
        const current = () => !signal.aborted && generation === this.generation && owner === this.account();
        this.pending = (async () => {
            const [classes, invitations, schoolInvitations] = await Promise.all([
                this.repository.listMyClasses({ signal }),
                this.repository.listMyInvitations?.({ signal }) || [],
                this.repository === classroomRepository ? schoolRepository.listMyInvitations({ signal }) : []
            ]);
            if (!current()) return;
            this.classes = classes;
            this.invitations = invitations;
            this.schoolInvitations = schoolInvitations;
            this.selectedId = classes.some(c => c.id === this.selectedId) ? this.selectedId : classes[0]?.id || null;
            const selected = classes.find(c => c.id === this.selectedId);
            this.vocabs = [];
            if (!selected) return;
            if (selected.schoolId && schoolContext.getSchoolId() !== selected.schoolId) schoolContext.select(selected.schoolId);
            const assignments = await this.repository.listAssignments(selected.id, { signal });
            const available = assignments.filter(a => a.kind === 'vocabulary' && !a.withdrawn && new Date(a.release_at) <= new Date());
            const vocabs = await Promise.all(available.map(async a => assignmentVocabulary(await this.repository.readAssignment(a.id, { signal }))));
            if (current()) { this.vocabs = vocabs; this.loadedAt = Date.now(); }
        })();
        try { await this.pending; }
        finally { if (current()) this.pending = null; }
    }
    select(id) {
        if (!this.classes.some(c => c.id === id)) return;
        this.loadedAt = 0;
        this.selectedId = id;
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
