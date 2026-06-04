import { $, closeModal as closeDialog, createElement, escapeHtml, notifications, openModal } from './main.js';
import {
    teacherApi as supabaseService,
    collection,
    doc,
    getDocs,
    serverTimestamp,
    setDoc
} from './services/teacherApi.js';
import { DEFAULT_SUBJECT_SLUG } from './services/vocabularyApi.js';

const SPARK_COLLECTION = 'weeklySparks';

const SPARK_TYPE_META = {
    cool_fact: { label: 'Cool Fact', icon: 'lightbulb' },
    trivia: { label: 'Trivia', icon: 'circle-help' },
    good_news: { label: 'Good News', icon: 'badge-check' },
    reflection: { label: 'Reflection', icon: 'message-circle-question' },
    debate: { label: 'Debate', icon: 'messages-square' }
};

const SPARK_STATUSES = new Set(['draft', 'scheduled', 'archived']);

function getPanamaDateValue(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Panama',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

function normalizeSparkDate(value) {
    const text = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function timestampMillis(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value.seconds !== undefined) return Number(value.seconds) * 1000;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function compareSparkSchedule(a, b) {
    const dateCompare = String(b.scheduledDate || '').localeCompare(String(a.scheduledDate || ''));
    if (dateCompare !== 0) return dateCompare;
    return timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt);
}

function isDuplicateScheduledDateError(error) {
    const text = String(error?.message || error || '').toLowerCase();
    return error?.code === '23505'
        || text.includes('weekly_sparks_unique_scheduled_date_idx')
        || text.includes('weekly_sparks_unique_subject_scheduled_date_idx')
        || (text.includes('duplicate key') && text.includes('scheduled_date'));
}

class TeacherSparkMethods {
    normalizeSpark(spark = {}) {
        const source = spark && typeof spark === 'object' ? spark : {};
        const sparkType = SPARK_TYPE_META[source.sparkType || source.spark_type]
            ? (source.sparkType || source.spark_type)
            : 'cool_fact';
        const status = SPARK_STATUSES.has(source.status) ? source.status : 'draft';
        return {
            id: String(source.id || ''),
            sparkType,
            title: String(source.title || '').trim(),
            sparkText: String(source.sparkText ?? source.spark_text ?? '').trim(),
            whyItMatters: String(source.whyItMatters ?? source.why_it_matters ?? '').trim(),
            question: String(source.question || '').trim(),
            sourceTitle: String(source.sourceTitle ?? source.source_title ?? '').trim(),
            sourceUrl: String(source.sourceUrl ?? source.source_url ?? '').trim(),
            subjectSlug: String(source.subjectSlug ?? source.subject_slug ?? DEFAULT_SUBJECT_SLUG).trim() || DEFAULT_SUBJECT_SLUG,
            scheduledDate: normalizeSparkDate(source.scheduledDate ?? source.scheduled_date),
            status,
            ownerId: source.ownerId || source.owner_id || null,
            createdAt: source.createdAt || source.created_at || null,
            updatedAt: source.updatedAt || source.updated_at || null
        };
    }

    createDefaultSpark() {
        return this.normalizeSpark({
            sparkType: 'cool_fact',
            status: 'draft',
            scheduledDate: getPanamaDateValue()
        });
    }

    createSparkId() {
        return `spark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    invalidateWeeklySparkCache() {
        this.weeklySparkCache = null;
        this.weeklySparkPromise = null;
    }

    async fetchWeeklySparks() {
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(collection(db, SPARK_COLLECTION));
        return snapshot.docs
            .map(docSnap => this.normalizeSpark({ id: docSnap.id, ...docSnap.data() }))
            .sort(compareSparkSchedule);
    }

    async getWeeklySparks({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.weeklySparkCache) return this.weeklySparkCache;
        if (!forceRefresh && this.weeklySparkPromise) return this.weeklySparkPromise;

        this.weeklySparkPromise = this.fetchWeeklySparks()
            .then(sparks => {
                this.weeklySparkCache = sparks;
                return sparks;
            })
            .finally(() => {
                this.weeklySparkPromise = null;
            });

        return this.weeklySparkPromise;
    }

    async showSparksView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-sparks-view');
        await this.loadWeeklySparks();
    }

    async loadWeeklySparks({ forceRefresh = false } = {}) {
        const list = $('#spark-library-list');
        if (!list) return;

        this.weeklySparkRefreshing = true;
        if (!this.weeklySparkItems.length) {
            list.innerHTML = '<div class="loading-spinner">Loading Sparks...</div>';
        } else {
            list.setAttribute('aria-busy', 'true');
        }

        try {
            const sparks = await this.getWeeklySparks({ forceRefresh });
            this.weeklySparkItems = sparks;
            this.renderSparkLibrary();
        } catch (error) {
            console.error('Failed to load Sparks:', error);
            list.innerHTML = '<p class="teacher-empty-state">Could not load Sparks.</p>';
            notifications.warning('Could not load Sparks.');
        } finally {
            this.weeklySparkRefreshing = false;
            list.removeAttribute('aria-busy');
            this.refreshIcons();
        }
    }

    groupWeeklySparks() {
        const today = getPanamaDateValue();
        const scheduled = this.weeklySparkItems
            .filter(spark => spark.status === 'scheduled')
            .sort(compareSparkSchedule);
        const currentAndPrevious = scheduled.filter(spark => spark.scheduledDate && spark.scheduledDate <= today);
        const upcoming = scheduled.filter(spark => spark.scheduledDate && spark.scheduledDate > today);

        return {
            currentAndPrevious,
            currentId: currentAndPrevious[0]?.id || '',
            upcoming,
            drafts: this.weeklySparkItems
                .filter(spark => spark.status === 'draft')
                .sort((a, b) => timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt)),
            archived: this.weeklySparkItems
                .filter(spark => spark.status === 'archived')
                .sort(compareSparkSchedule)
        };
    }

    renderSparkLibrary() {
        const list = $('#spark-library-list');
        if (!list) return;
        list.innerHTML = '';

        if (this.weeklySparkItems.length === 0) {
            list.innerHTML = '<p class="teacher-empty-state">No Sparks yet. Add one to start the weekly routine.</p>';
            return;
        }

        const groups = this.groupWeeklySparks();
        this.renderSparkSection(list, {
            title: 'Current',
            description: 'The latest scheduled Spark whose date has arrived.',
            items: groups.currentAndPrevious,
            emptyText: 'No current Spark is scheduled yet.',
            currentId: groups.currentId
        });
        this.renderSparkSection(list, {
            title: 'Upcoming',
            description: 'Scheduled Sparks waiting for their start date.',
            items: groups.upcoming,
            emptyText: 'No upcoming Sparks.',
            currentId: groups.currentId
        });
        this.renderSparkSection(list, {
            title: 'Drafts',
            description: 'Ideas that are not student-visible.',
            items: groups.drafts,
            emptyText: 'No draft Sparks.',
            currentId: groups.currentId
        });
        this.renderSparkSection(list, {
            title: 'Archived',
            description: 'Stored Sparks that are no longer active.',
            items: groups.archived,
            emptyText: 'No archived Sparks.',
            currentId: groups.currentId
        });
    }

    renderSparkSection(container, { title, description, items, emptyText, currentId }) {
        const section = createElement('section', 'teacher-panel spark-section');
        section.innerHTML = `
            <div class="teacher-panel-header">
                <div>
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(description)}</p>
                </div>
                <span class="spark-section-count">${items.length}</span>
            </div>
        `;

        const grid = createElement('div', 'spark-card-grid');
        if (items.length === 0) {
            grid.innerHTML = `<p class="teacher-empty-state">${escapeHtml(emptyText)}</p>`;
        } else {
            items.forEach(spark => grid.appendChild(this.createSparkCard(spark, { currentId })));
        }
        section.appendChild(grid);
        container.appendChild(section);
    }

    createSparkCard(spark, { currentId = '' } = {}) {
        const meta = SPARK_TYPE_META[spark.sparkType] || SPARK_TYPE_META.cool_fact;
        const isCurrent = spark.id && spark.id === currentId;
        const card = createElement('article', `spark-card is-${spark.status}${isCurrent ? ' is-current' : ''}`);
        const statusLabel = isCurrent ? 'Current' : this.formatSparkStatusLabel(spark.status);
        const sourceHtml = spark.sourceUrl
            ? `<a href="${escapeHtml(spark.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(spark.sourceTitle || 'Source')}</a>`
            : '';
        const archiveAction = spark.status === 'archived'
            ? ''
            : `
                <button class="btn text-btn spark-card-action" type="button" data-spark-action="archive" data-spark-id="${escapeHtml(spark.id)}">
                    <i data-lucide="archive"></i>
                    Archive
                </button>
            `;

        card.innerHTML = `
            <div class="spark-card-topline">
                <span class="spark-type-pill"><i data-lucide="${meta.icon}"></i>${escapeHtml(meta.label)}</span>
                <span class="spark-status-pill">${escapeHtml(statusLabel)}</span>
            </div>
            <h4>${escapeHtml(spark.title || 'Untitled Spark')}</h4>
            <p>${escapeHtml(spark.sparkText || 'No Spark text yet.')}</p>
            ${spark.whyItMatters ? `
                <div class="spark-detail">
                    <strong>Why it matters</strong>
                    <span>${escapeHtml(spark.whyItMatters)}</span>
                </div>
            ` : ''}
            ${spark.question ? `
                <div class="spark-question">
                    <i data-lucide="message-circle-question"></i>
                    <span>${escapeHtml(spark.question)}</span>
                </div>
            ` : ''}
            <div class="spark-card-footer">
                <div class="spark-card-meta">
                    <span>${escapeHtml(this.formatSparkDateLabel(spark))}</span>
                    ${sourceHtml}
                </div>
                <div class="spark-card-actions">
                    <button class="btn text-btn spark-card-action" type="button" data-spark-action="edit" data-spark-id="${escapeHtml(spark.id)}">
                        <i data-lucide="pencil"></i>
                        Edit
                    </button>
                    <button class="btn text-btn spark-card-action" type="button" data-spark-action="duplicate" data-spark-id="${escapeHtml(spark.id)}">
                        <i data-lucide="copy"></i>
                        Duplicate
                    </button>
                    ${archiveAction}
                </div>
            </div>
        `;
        return card;
    }

    formatSparkStatusLabel(status) {
        if (status === 'scheduled') return 'Scheduled';
        if (status === 'archived') return 'Archived';
        return 'Draft';
    }

    formatSparkDateLabel(spark) {
        if (!spark.scheduledDate) return 'No scheduled date';
        return `Starts ${spark.scheduledDate}`;
    }

    findSparkById(id) {
        return this.weeklySparkItems.find(spark => spark.id === id) || null;
    }

    openSparkModal(spark = null, options = {}) {
        const source = this.normalizeSpark(spark || this.createDefaultSpark());
        const duplicate = options.duplicate === true;
        this.sparkModalMode = source.id && !duplicate ? 'edit' : 'create';
        this.editingSparkId = this.sparkModalMode === 'edit' ? source.id : null;

        const title = $('#spark-modal-title');
        if (title) title.textContent = this.sparkModalMode === 'edit' ? 'Edit Spark' : 'Add Spark';

        const values = {
            '#spark-id': this.editingSparkId || '',
            '#spark-type': source.sparkType,
            '#spark-title-input': duplicate ? `Copy of ${source.title || 'Spark'}` : source.title,
            '#spark-text-input': source.sparkText,
            '#spark-why-input': source.whyItMatters,
            '#spark-question-input': source.question,
            '#spark-source-title-input': source.sourceTitle,
            '#spark-source-url-input': source.sourceUrl,
            '#spark-scheduled-date-input': duplicate ? '' : source.scheduledDate,
            '#spark-status-input': duplicate ? 'draft' : source.status
        };

        Object.entries(values).forEach(([selector, value]) => {
            const field = $(selector);
            if (field) field.value = value || '';
        });

        this.setSparkModalStatus('');
        openModal('#spark-modal', { initialFocus: '#spark-title-input' });
    }

    readSparkForm(statusOverride = null) {
        const status = statusOverride || $('#spark-status-input')?.value || 'draft';
        const spark = this.normalizeSpark({
            id: $('#spark-id')?.value || this.editingSparkId || this.createSparkId(),
            sparkType: $('#spark-type')?.value || 'cool_fact',
            title: $('#spark-title-input')?.value || '',
            sparkText: $('#spark-text-input')?.value || '',
            whyItMatters: $('#spark-why-input')?.value || '',
            question: $('#spark-question-input')?.value || '',
            sourceTitle: $('#spark-source-title-input')?.value || '',
            sourceUrl: $('#spark-source-url-input')?.value || '',
            subjectSlug: DEFAULT_SUBJECT_SLUG,
            scheduledDate: $('#spark-scheduled-date-input')?.value || '',
            status,
            ownerId: this.currentUser?.uid || null
        });

        if (!spark.title) throw new Error('Add a title for this Spark.');
        if (!spark.sparkText) throw new Error('Add the Spark text students will read.');
        if (!spark.question) throw new Error('Add a quick question for students to think about.');
        if (spark.status === 'scheduled' && !spark.scheduledDate) {
            throw new Error('Choose a scheduled date before scheduling this Spark.');
        }
        if (spark.sourceUrl && !/^https?:\/\//i.test(spark.sourceUrl)) {
            throw new Error('Source URL must start with http:// or https://.');
        }

        return spark;
    }

    async saveSparkFromForm(statusOverride = null) {
        if (!this.ensureAuthenticated()) return;

        let spark;
        try {
            spark = this.readSparkForm(statusOverride);
        } catch (error) {
            this.setSparkModalStatus(error.message, 'error');
            notifications.warning(error.message);
            return;
        }

        this.setSparkModalStatus('Saving Spark...', 'info');
        try {
            const db = supabaseService.getDatabase();
            await setDoc(doc(db, SPARK_COLLECTION, spark.id), {
                ...spark,
                updatedAt: serverTimestamp()
            });
            this.invalidateWeeklySparkCache();
            closeDialog('#spark-modal');
            notifications.success(spark.status === 'scheduled' ? 'Spark scheduled.' : 'Spark saved.');
            await this.loadWeeklySparks({ forceRefresh: true });
        } catch (error) {
            console.error('Failed to save Spark:', error);
            const message = isDuplicateScheduledDateError(error)
                ? 'A scheduled Spark already starts on this date. Choose a different date or archive the existing one first.'
                : 'Could not save this Spark. Check the fields and try again.';
            this.setSparkModalStatus(message, 'error');
            notifications.error(message);
        }
    }

    async archiveSpark(id) {
        if (!this.ensureAuthenticated()) return;
        const spark = this.findSparkById(id);
        if (!spark) return;

        try {
            const db = supabaseService.getDatabase();
            await setDoc(doc(db, SPARK_COLLECTION, id), {
                ...spark,
                status: 'archived',
                updatedAt: serverTimestamp()
            });
            this.invalidateWeeklySparkCache();
            notifications.success('Spark archived.');
            await this.loadWeeklySparks({ forceRefresh: true });
        } catch (error) {
            console.error('Failed to archive Spark:', error);
            notifications.error('Could not archive this Spark.');
        }
    }

    setSparkModalStatus(text, state = 'muted') {
        const el = $('#spark-modal-status');
        if (!el) return;
        el.textContent = text || '';
        const colors = {
            success: 'var(--success-color)',
            error: 'var(--danger-color)',
            info: 'var(--secondary-color)',
            muted: 'var(--text-muted)'
        };
        el.style.color = colors[state] || colors.muted;
    }
}

export function installTeacherSparkMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherSparkMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherSparkMethods.prototype, name)
        );
    }
}

export function initTeacherSparksListeners(manager) {
    $('#overview-sparks-btn')?.addEventListener('click', () => manager.showTeacherSection('sparks'));
    $('#add-spark-btn')?.addEventListener('click', () => manager.openSparkModal());
    $('#save-spark-draft-btn')?.addEventListener('click', () => manager.saveSparkFromForm('draft'));
    $('#schedule-spark-btn')?.addEventListener('click', () => manager.saveSparkFromForm('scheduled'));
    $('#spark-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        manager.saveSparkFromForm($('#spark-status-input')?.value || 'draft');
    });

    $('#spark-library-list')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-spark-action]');
        if (!button) return;
        const id = button.dataset.sparkId;
        const action = button.dataset.sparkAction;
        const spark = manager.findSparkById(id);
        if (!spark) return;

        if (action === 'edit') {
            manager.openSparkModal(spark);
        } else if (action === 'duplicate') {
            manager.openSparkModal(spark, { duplicate: true });
        } else if (action === 'archive') {
            manager.archiveSpark(id);
        }
    });
}
