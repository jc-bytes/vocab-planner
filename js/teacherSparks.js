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
    cool_fact: { label: 'Fact', pluralLabel: 'Facts', icon: 'lightbulb' },
    trivia: { label: 'Trivia', icon: 'circle-help' },
    good_news: { label: 'Good News', icon: 'badge-check' },
    reflection: { label: 'Reflection', icon: 'message-circle-question' },
    debate: { label: 'Debate', icon: 'messages-square' }
};

const SPARK_STATUSES = new Set(['draft', 'scheduled', 'archived']);
const SPARK_VIEW_TABS = [
    { id: 'week', label: 'This Week', icon: 'calendar-days' },
    { id: 'month', label: 'This Month', icon: 'calendar-range' },
    { id: 'types', label: 'By Type', icon: 'list-filter' },
    { id: 'planning', label: 'Planning', icon: 'archive' }
];
const SPARK_TYPE_FILTERS = [
    { id: 'all', label: 'All', icon: 'layout-grid' },
    ...Object.entries(SPARK_TYPE_META).map(([id, meta]) => ({
        id,
        label: meta.pluralLabel || meta.label,
        icon: meta.icon
    }))
];
const SPARK_GRADE_LEVELS = ['6', '7', '8', '9'];

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

function compareSparkScheduleAscending(a, b) {
    const dateCompare = String(a.scheduledDate || '9999-12-31').localeCompare(String(b.scheduledDate || '9999-12-31'));
    if (dateCompare !== 0) return dateCompare;
    return timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt);
}

function parseDateValue(value) {
    const normalized = normalizeSparkDate(value);
    if (!normalized) return null;
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

function toDateValue(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(value, days) {
    const date = parseDateValue(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() + days);
    return toDateValue(date);
}

function getWeekBounds(value) {
    const date = parseDateValue(value);
    if (!date) return { start: '', end: '' };
    const day = date.getUTCDay() || 7;
    const start = toDateValue(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1)));
    return { start, end: addDays(start, 6) };
}

function getMonthValue(value) {
    return normalizeSparkDate(value).slice(0, 7);
}

function formatShortDate(value) {
    const date = parseDateValue(value);
    if (!date) return 'No date';
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function formatMonthLabel(value) {
    const monthValue = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(monthValue)) return 'No month';
    const [year, month] = monthValue.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function isInDateRange(value, start, end) {
    const normalized = normalizeSparkDate(value);
    return normalized && normalized >= start && normalized <= end;
}

function isDuplicateScheduledDateError(error) {
    const text = String(error?.message || error || '').toLowerCase();
    return error?.code === '23505'
        || text.includes('weekly_sparks_unique_scheduled_date_idx')
        || text.includes('weekly_sparks_unique_subject_scheduled_date_idx')
        || (text.includes('duplicate key') && text.includes('scheduled_date'));
}

function normalizeSparkGradeQuestions(value) {
    const source = value && typeof value === 'object' ? value : {};
    return SPARK_GRADE_LEVELS.reduce((questions, grade) => {
        const text = String(source[grade] ?? source[`grade${grade}`] ?? '').trim();
        if (text) questions[grade] = text;
        return questions;
    }, {});
}

function normalizeSparkTargetGrades(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const grades = source
        .flatMap(item => String(item || '').split(','))
        .map(item => item.trim().match(/\d+/)?.[0] || '')
        .filter(grade => SPARK_GRADE_LEVELS.includes(grade));
    return Array.from(new Set(grades));
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
            gradeQuestions: normalizeSparkGradeQuestions(source.gradeQuestions ?? source.grade_questions),
            targetGrades: normalizeSparkTargetGrades(source.targetGrades ?? source.target_grades ?? SPARK_GRADE_LEVELS),
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
            scheduledDate: getPanamaDateValue(),
            targetGrades: SPARK_GRADE_LEVELS
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

    getSparkLibraryData() {
        const today = getPanamaDateValue();
        const scheduled = this.weeklySparkItems
            .filter(spark => spark.status === 'scheduled')
            .sort(compareSparkScheduleAscending);
        const currentAndPrevious = scheduled
            .filter(spark => spark.scheduledDate && spark.scheduledDate <= today)
            .sort(compareSparkSchedule);
        const currentSpark = currentAndPrevious[0] || null;
        const currentId = currentSpark?.id || '';
        const weekBounds = getWeekBounds(today);
        const weekSparks = scheduled.filter(spark => isInDateRange(spark.scheduledDate, weekBounds.start, weekBounds.end));
        const nextSparks = scheduled
            .filter(spark => spark.scheduledDate && spark.scheduledDate > today)
            .slice(0, 4);
        const drafts = this.weeklySparkItems
            .filter(spark => spark.status === 'draft')
            .sort((a, b) => timestampMillis(b.updatedAt) - timestampMillis(a.updatedAt));
        const archived = this.weeklySparkItems
            .filter(spark => spark.status === 'archived')
            .sort(compareSparkSchedule);
        const activeSparks = this.weeklySparkItems
            .filter(spark => spark.status !== 'archived')
            .sort(compareSparkScheduleAscending);
        const monthOptions = Array.from(new Set(scheduled
            .map(spark => getMonthValue(spark.scheduledDate))
            .filter(Boolean)))
            .sort();
        const todayMonth = getMonthValue(today);
        if (!monthOptions.includes(this.weeklySparkMonth)) {
            const nextMonth = monthOptions.find(month => month >= todayMonth);
            this.weeklySparkMonth = monthOptions.includes(todayMonth)
                ? todayMonth
                : nextMonth || getMonthValue(currentSpark?.scheduledDate) || monthOptions[0] || todayMonth;
        }
        if (!SPARK_TYPE_FILTERS.some(type => type.id === this.weeklySparkTypeFilter)) {
            this.weeklySparkTypeFilter = 'all';
        }
        if (!SPARK_VIEW_TABS.some(tab => tab.id === this.weeklySparkActiveView)) {
            this.weeklySparkActiveView = 'week';
        }

        const selectedMonthSparks = scheduled.filter(spark => getMonthValue(spark.scheduledDate) === this.weeklySparkMonth);
        const sparkOfMonth = selectedMonthSparks.find(spark => spark.id === currentId)
            || selectedMonthSparks.find(spark => spark.scheduledDate >= today)
            || selectedMonthSparks[0]
            || null;
        const typeCounts = activeSparks.reduce((counts, spark) => {
            counts[spark.sparkType] = (counts[spark.sparkType] || 0) + 1;
            return counts;
        }, {});

        return {
            today,
            weekBounds,
            scheduled,
            currentSpark,
            currentId,
            weekSparks,
            nextSparks,
            drafts,
            archived,
            activeSparks,
            monthOptions,
            selectedMonthSparks,
            sparkOfMonth,
            typeCounts
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

        const data = this.getSparkLibraryData();
        list.appendChild(this.createSparkOverview(data));
        list.appendChild(this.createSparkViewTabs(data));

        const body = createElement('div', 'spark-library-body');
        if (this.weeklySparkActiveView === 'month') {
            this.renderSparkMonthView(body, data);
        } else if (this.weeklySparkActiveView === 'types') {
            this.renderSparkTypeView(body, data);
        } else if (this.weeklySparkActiveView === 'planning') {
            this.renderSparkPlanningView(body, data);
        } else {
            this.renderSparkWeekView(body, data);
        }
        list.appendChild(body);
    }

    createSparkOverview(data) {
        const overview = createElement('section', 'spark-command-strip');
        const currentTitle = data.currentSpark?.title || 'No current Spark';
        const currentMeta = data.currentSpark
            ? `${formatShortDate(data.currentSpark.scheduledDate)} · ${this.getSparkTypeLabel(data.currentSpark.sparkType)}`
            : 'Schedule a Spark to make it student-visible.';
        overview.innerHTML = `
            <div class="spark-command-main">
                <span class="spark-command-kicker">Current Spark</span>
                <strong>${escapeHtml(currentTitle)}</strong>
                <span>${escapeHtml(currentMeta)}</span>
            </div>
            <div class="spark-command-stats" aria-label="Spark summary">
                ${this.createSparkStatHtml('This week', data.weekSparks.length, 'calendar-days')}
                ${this.createSparkStatHtml(formatMonthLabel(this.weeklySparkMonth), data.selectedMonthSparks.length, 'calendar-range')}
                ${this.createSparkStatHtml('Drafts', data.drafts.length, 'file-pen-line')}
                ${this.createSparkStatHtml('Archived', data.archived.length, 'archive')}
            </div>
        `;
        return overview;
    }

    createSparkStatHtml(label, value, icon) {
        return `
            <div class="spark-command-stat">
                <i data-lucide="${icon}"></i>
                <span>${escapeHtml(label)}</span>
                <strong>${Number(value) || 0}</strong>
            </div>
        `;
    }

    createSparkViewTabs(data) {
        const counts = {
            week: data.weekSparks.length,
            month: data.selectedMonthSparks.length,
            types: data.activeSparks.length,
            planning: data.drafts.length + data.archived.length
        };
        const tabs = createElement('div', 'data-tab-list spark-view-tabs');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Spark library views');
        tabs.innerHTML = SPARK_VIEW_TABS.map(tab => {
            const active = tab.id === this.weeklySparkActiveView;
            return `
                <button class="data-tab-btn spark-view-tab${active ? ' active' : ''}" type="button"
                    role="tab" aria-selected="${active ? 'true' : 'false'}" data-spark-view="${escapeHtml(tab.id)}">
                    <i data-lucide="${tab.icon}"></i>
                    <span>${escapeHtml(tab.label)}</span>
                    <span class="spark-tab-count">${counts[tab.id] || 0}</span>
                </button>
            `;
        }).join('');
        return tabs;
    }

    renderSparkWeekView(container, data) {
        const panel = createElement('div', 'spark-view-panel');
        if (data.currentSpark) {
            panel.appendChild(this.createSparkSpotlight(data.currentSpark, {
                eyebrow: 'Spark of the Week',
                currentId: data.currentId
            }));
        }
        this.renderSparkSection(panel, {
            title: 'Week Lineup',
            description: `${formatShortDate(data.weekBounds.start)} - ${formatShortDate(data.weekBounds.end)}`,
            items: data.weekSparks,
            emptyText: 'No Sparks are scheduled for this calendar week.',
            currentId: data.currentId
        });
        this.renderSparkSection(panel, {
            title: 'Up Next',
            description: 'Next scheduled Sparks',
            items: data.nextSparks,
            emptyText: 'No future Sparks are scheduled.',
            currentId: data.currentId
        });
        container.appendChild(panel);
    }

    renderSparkMonthView(container, data) {
        const panel = createElement('div', 'spark-view-panel');
        panel.appendChild(this.createSparkMonthToolbar(data));
        if (data.sparkOfMonth) {
            panel.appendChild(this.createSparkSpotlight(data.sparkOfMonth, {
                eyebrow: 'Spark of the Month',
                currentId: data.currentId
            }));
        }

        const weekGroups = this.groupSparksByWeek(data.selectedMonthSparks);
        if (weekGroups.length === 0) {
            panel.appendChild(this.createSparkEmptyPanel('No Sparks are scheduled for this month.'));
        } else {
            weekGroups.forEach(group => {
                this.renderSparkSection(panel, {
                    title: `Week of ${formatShortDate(group.start)}`,
                    description: `${formatShortDate(group.start)} - ${formatShortDate(group.end)}`,
                    items: group.items,
                    emptyText: '',
                    currentId: data.currentId
                });
            });
        }
        container.appendChild(panel);
    }

    createSparkMonthToolbar(data) {
        const toolbar = createElement('div', 'spark-month-toolbar');
        const selectedIndex = data.monthOptions.indexOf(this.weeklySparkMonth);
        const previousDisabled = selectedIndex <= 0;
        const nextDisabled = selectedIndex < 0 || selectedIndex >= data.monthOptions.length - 1;
        const options = data.monthOptions.length
            ? data.monthOptions
            : [this.weeklySparkMonth || getMonthValue(getPanamaDateValue())];
        toolbar.innerHTML = `
            <button class="btn secondary-btn icon-btn" type="button" data-spark-month-shift="-1"
                aria-label="Previous Spark month" title="Previous Spark month"${previousDisabled ? ' disabled' : ''}>
                <i data-lucide="chevron-left"></i>
            </button>
            <label class="spark-month-select-label">
                <span>Month</span>
                <select data-spark-month-select>
                    ${options.map(month => `
                        <option value="${escapeHtml(month)}"${month === this.weeklySparkMonth ? ' selected' : ''}>
                            ${escapeHtml(formatMonthLabel(month))}
                        </option>
                    `).join('')}
                </select>
            </label>
            <button class="btn secondary-btn icon-btn" type="button" data-spark-month-shift="1"
                aria-label="Next Spark month" title="Next Spark month"${nextDisabled ? ' disabled' : ''}>
                <i data-lucide="chevron-right"></i>
            </button>
        `;
        return toolbar;
    }

    groupSparksByWeek(sparks) {
        const groups = new Map();
        sparks.forEach(spark => {
            const bounds = getWeekBounds(spark.scheduledDate);
            const key = bounds.start || 'unscheduled';
            if (!groups.has(key)) {
                groups.set(key, { ...bounds, items: [] });
            }
            groups.get(key).items.push(spark);
        });
        return Array.from(groups.values())
            .map(group => ({
                ...group,
                items: group.items.sort(compareSparkScheduleAscending)
            }))
            .sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
    }

    renderSparkTypeView(container, data) {
        const panel = createElement('div', 'spark-view-panel');
        panel.appendChild(this.createSparkTypeTabs(data));
        if (this.weeklySparkTypeFilter === 'all') {
            SPARK_TYPE_FILTERS
                .filter(type => type.id !== 'all')
                .forEach(type => {
                    const items = data.activeSparks.filter(spark => spark.sparkType === type.id);
                    this.renderSparkSection(panel, {
                        title: type.label,
                        description: `${items.length} active`,
                        items,
                        emptyText: `No ${type.label.toLowerCase()} Sparks yet.`,
                        currentId: data.currentId
                    });
                });
        } else {
            const type = SPARK_TYPE_FILTERS.find(item => item.id === this.weeklySparkTypeFilter) || SPARK_TYPE_FILTERS[0];
            const items = data.activeSparks.filter(spark => spark.sparkType === type.id);
            this.renderSparkSection(panel, {
                title: type.label,
                description: `${items.length} active`,
                items,
                emptyText: `No ${type.label.toLowerCase()} Sparks yet.`,
                currentId: data.currentId
            });
        }
        container.appendChild(panel);
    }

    createSparkTypeTabs(data) {
        const tabs = createElement('div', 'spark-type-tabs');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Spark type filters');
        tabs.innerHTML = SPARK_TYPE_FILTERS.map(type => {
            const active = type.id === this.weeklySparkTypeFilter;
            const count = type.id === 'all' ? data.activeSparks.length : data.typeCounts[type.id] || 0;
            return `
                <button class="spark-type-tab${active ? ' active' : ''}" type="button"
                    role="tab" aria-selected="${active ? 'true' : 'false'}" data-spark-type-filter="${escapeHtml(type.id)}">
                    <i data-lucide="${type.icon}"></i>
                    <span>${escapeHtml(type.label)}</span>
                    <span>${count}</span>
                </button>
            `;
        }).join('');
        return tabs;
    }

    renderSparkPlanningView(container, data) {
        const panel = createElement('div', 'spark-view-panel');
        this.renderSparkSection(panel, {
            title: 'Drafts',
            description: 'Not student-visible',
            items: data.drafts,
            emptyText: 'No draft Sparks.',
            currentId: data.currentId
        });
        this.renderSparkSection(panel, {
            title: 'Archived',
            description: 'Stored for reference',
            items: data.archived,
            emptyText: 'No archived Sparks.',
            currentId: data.currentId
        });
        container.appendChild(panel);
    }

    createSparkSpotlight(spark, { eyebrow, currentId }) {
        const meta = SPARK_TYPE_META[spark.sparkType] || SPARK_TYPE_META.cool_fact;
        const spotlight = createElement('section', `spark-spotlight${spark.id === currentId ? ' is-current' : ''}`);
        spotlight.innerHTML = `
            <div class="spark-spotlight-copy">
                <span class="spark-command-kicker">${escapeHtml(eyebrow)}</span>
                <div class="spark-card-topline">
                    <span class="spark-type-pill"><i data-lucide="${meta.icon}"></i>${escapeHtml(meta.label)}</span>
                    <span class="spark-status-pill">${escapeHtml(this.formatSparkDateLabel(spark))}</span>
                </div>
                <h3>${escapeHtml(spark.title || 'Untitled Spark')}</h3>
                <p>${escapeHtml(spark.sparkText || 'No Spark text yet.')}</p>
                ${spark.question ? `
                    <div class="spark-question">
                        <i data-lucide="message-circle-question"></i>
                        <span>${escapeHtml(spark.question)}</span>
                    </div>
                ` : ''}
                ${this.createSparkTargetGradeSummaryHtml(spark)}
                ${this.createSparkGradeQuestionSummaryHtml(spark)}
            </div>
            <div class="spark-spotlight-actions">
                <button class="btn secondary-btn spark-card-action" type="button" data-spark-action="edit" data-spark-id="${escapeHtml(spark.id)}">
                    <i data-lucide="pencil"></i>
                    Edit
                </button>
                <button class="btn secondary-btn spark-card-action" type="button" data-spark-action="duplicate" data-spark-id="${escapeHtml(spark.id)}">
                    <i data-lucide="copy"></i>
                    Duplicate
                </button>
            </div>
        `;
        return spotlight;
    }

    renderSparkSection(container, { title, description, items, emptyText, currentId }) {
        const section = createElement('section', 'spark-section');
        section.innerHTML = `
            <div class="spark-section-header">
                <div>
                    <h3>${escapeHtml(title)}</h3>
                    <p>${escapeHtml(description)}</p>
                </div>
                <span class="spark-section-count">${items.length}</span>
            </div>
        `;

        const grid = createElement('div', 'spark-card-grid');
        if (items.length === 0) {
            grid.appendChild(this.createSparkEmptyPanel(emptyText));
        } else {
            items.forEach(spark => grid.appendChild(this.createSparkCard(spark, { currentId })));
        }
        section.appendChild(grid);
        container.appendChild(section);
    }

    createSparkEmptyPanel(text) {
        const empty = createElement('p', 'teacher-empty-state spark-empty-panel');
        empty.textContent = text || 'No Sparks here yet.';
        return empty;
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
            ${this.createSparkTargetGradeSummaryHtml(spark)}
            ${this.createSparkGradeQuestionSummaryHtml(spark)}
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
        return `Starts ${formatShortDate(spark.scheduledDate)}`;
    }

    getSparkTypeLabel(sparkType) {
        return (SPARK_TYPE_META[sparkType] || SPARK_TYPE_META.cool_fact).label;
    }

    getSparkGradeQuestionEntries(spark) {
        const questions = normalizeSparkGradeQuestions(spark?.gradeQuestions);
        return SPARK_GRADE_LEVELS
            .map(grade => [grade, questions[grade] || ''])
            .filter(([, question]) => question);
    }

    createSparkGradeQuestionSummaryHtml(spark) {
        const entries = this.getSparkGradeQuestionEntries(spark);
        if (entries.length === 0) return '';
        const labels = entries.map(([grade]) => `Grade ${grade}`).join(', ');
        return `
            <div class="spark-detail spark-grade-question-summary">
                <strong>Grade questions</strong>
                <span>${escapeHtml(labels)}</span>
            </div>
        `;
    }

    createSparkTargetGradeSummaryHtml(spark) {
        const targetGrades = normalizeSparkTargetGrades(spark?.targetGrades ?? spark?.target_grades);
        const grades = targetGrades.length ? targetGrades : SPARK_GRADE_LEVELS;
        const allGrades = SPARK_GRADE_LEVELS.every(grade => grades.includes(grade));
        const label = allGrades
            ? 'All grades'
            : grades.map(grade => `Grade ${grade}`).join(', ');
        return `
            <div class="spark-detail spark-target-grade-summary">
                <strong>Target grades</strong>
                <span>${escapeHtml(label)}</span>
            </div>
        `;
    }

    refreshSparkLibrarySurface() {
        this.renderSparkLibrary();
        this.refreshIcons();
    }

    selectSparkView(view) {
        if (!SPARK_VIEW_TABS.some(tab => tab.id === view)) return;
        this.weeklySparkActiveView = view;
        this.refreshSparkLibrarySurface();
    }

    selectSparkTypeFilter(type) {
        if (!SPARK_TYPE_FILTERS.some(item => item.id === type)) return;
        this.weeklySparkTypeFilter = type;
        this.weeklySparkActiveView = 'types';
        this.refreshSparkLibrarySurface();
    }

    selectSparkMonth(month) {
        if (!/^\d{4}-\d{2}$/.test(String(month || ''))) return;
        this.weeklySparkMonth = month;
        this.weeklySparkActiveView = 'month';
        this.refreshSparkLibrarySurface();
    }

    shiftSparkMonth(offset) {
        const data = this.getSparkLibraryData();
        if (data.monthOptions.length === 0) return;
        const currentIndex = Math.max(0, data.monthOptions.indexOf(this.weeklySparkMonth));
        const nextIndex = Math.min(data.monthOptions.length - 1, Math.max(0, currentIndex + offset));
        this.weeklySparkMonth = data.monthOptions[nextIndex];
        this.weeklySparkActiveView = 'month';
        this.refreshSparkLibrarySurface();
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
            '#spark-grade-question-6-input': source.gradeQuestions['6'],
            '#spark-grade-question-7-input': source.gradeQuestions['7'],
            '#spark-grade-question-8-input': source.gradeQuestions['8'],
            '#spark-grade-question-9-input': source.gradeQuestions['9'],
            '#spark-source-title-input': source.sourceTitle,
            '#spark-source-url-input': source.sourceUrl,
            '#spark-scheduled-date-input': duplicate ? '' : source.scheduledDate,
            '#spark-status-input': duplicate ? 'draft' : source.status
        };

        Object.entries(values).forEach(([selector, value]) => {
            const field = $(selector);
            if (field) field.value = value || '';
        });

        SPARK_GRADE_LEVELS.forEach(grade => {
            const field = $(`#spark-target-grade-${grade}-input`);
            if (field) field.checked = source.targetGrades.includes(grade);
        });

        this.setSparkModalStatus('');
        openModal('#spark-modal', { initialFocus: '#spark-title-input' });
    }

    readSparkTargetGradesFromForm() {
        return SPARK_GRADE_LEVELS.filter(grade => $(`#spark-target-grade-${grade}-input`)?.checked);
    }

    readSparkGradeQuestionsFromForm() {
        return SPARK_GRADE_LEVELS.reduce((questions, grade) => {
            const field = $(`#spark-grade-question-${grade}-input`);
            const text = String(field?.value || '').trim();
            if (text) questions[grade] = text;
            return questions;
        }, {});
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
            gradeQuestions: this.readSparkGradeQuestionsFromForm(),
            targetGrades: this.readSparkTargetGradesFromForm(),
            sourceTitle: $('#spark-source-title-input')?.value || '',
            sourceUrl: $('#spark-source-url-input')?.value || '',
            subjectSlug: DEFAULT_SUBJECT_SLUG,
            scheduledDate: $('#spark-scheduled-date-input')?.value || '',
            status,
            ownerId: this.currentUser?.uid || null
        });

        if (!spark.title) throw new Error('Add a title for this Spark.');
        if (!spark.sparkText) throw new Error('Add the Spark text students will read.');
        if (!spark.question) throw new Error('Add a fallback question for students to think about.');
        if (spark.targetGrades.length === 0) throw new Error('Choose at least one target grade.');
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
                ? 'A Spark with that exact schedule already exists. Check the date and try again.'
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
        const viewButton = event.target.closest('[data-spark-view]');
        if (viewButton) {
            manager.selectSparkView(viewButton.dataset.sparkView);
            return;
        }

        const typeButton = event.target.closest('[data-spark-type-filter]');
        if (typeButton) {
            manager.selectSparkTypeFilter(typeButton.dataset.sparkTypeFilter);
            return;
        }

        const monthButton = event.target.closest('[data-spark-month-shift]');
        if (monthButton) {
            manager.shiftSparkMonth(Number(monthButton.dataset.sparkMonthShift) || 0);
            return;
        }

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

    $('#spark-library-list')?.addEventListener('change', (event) => {
        const select = event.target.closest('[data-spark-month-select]');
        if (!select) return;
        manager.selectSparkMonth(select.value);
    });
}
