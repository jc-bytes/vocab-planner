import { $, createElement, escapeHtml } from '../main.js';
import { normalizeSparkCheckMode, normalizeSparkQuestions, SPARK_CHECK_MODES } from '../sparkCheckModel.js';
import { normalizeSparkGradeQuestions, normalizeSparkTargetGrades, SPARK_GRADE_LEVELS } from '../sparkModel.js';
import { getPanamaDateValue } from '../services/dateUtils.js';
import { SPARK_TYPE_FILTERS, SPARK_TYPE_META, SPARK_VIEW_TABS } from './sparkLibraryConfig.js';
import { formatMonthLabel, formatShortDate, getMonthValue } from './sparkSchedule.js';

export const teacherSparkLibraryViewMethods = {
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
    },

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
    },

createSparkStatHtml(label, value, icon) {
        return `
            <div class="spark-command-stat">
                <i data-lucide="${icon}"></i>
                <span>${escapeHtml(label)}</span>
                <strong>${Number(value) || 0}</strong>
            </div>
        `;
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
                ${this.createSparkCheckSummaryHtml(spark)}
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
    },

renderSparkSection(container, { title, description, items, emptyText, currentId }) {
        const section = createElement('section', 'spark-section');
        section.innerHTML = `
            <div class="spark-section-header section-heading">
                <div>
                    <h3 class="section-header__title">${escapeHtml(title)}</h3>
                    <p class="section-header__description">${escapeHtml(description)}</p>
                </div>
                <span class="spark-section-count section-header__metric">${items.length}</span>
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
    },

createSparkEmptyPanel(text) {
        const empty = createElement('p', 'teacher-empty-state spark-empty-panel');
        empty.textContent = text || 'No Sparks here yet.';
        return empty;
    },

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
            <h4 class="card-title">${escapeHtml(spark.title || 'Untitled Spark')}</h4>
            <p class="card-secondary">${escapeHtml(spark.sparkText || 'No Spark text yet.')}</p>
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
            ${this.createSparkCheckSummaryHtml(spark)}
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
    },

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
    },

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
    },

createSparkCheckSummaryHtml(spark) {
        const mode = normalizeSparkCheckMode(spark?.checkMode ?? spark?.check_mode);
        const questions = normalizeSparkQuestions(spark?.questions);
        const hasLegacyQuestion = Boolean(
            String(spark?.question || '').trim()
            || Object.keys(normalizeSparkGradeQuestions(spark?.gradeQuestions ?? spark?.grade_questions)).length > 0
        );
        const legacyQuestionCount = hasLegacyQuestion ? 1 : 0;
        const questionCount = questions.length || legacyQuestionCount;
        const modeLabels = {
            [SPARK_CHECK_MODES.READING_ONLY]: 'Reading only',
            [SPARK_CHECK_MODES.OPTIONAL]: 'Optional check',
            [SPARK_CHECK_MODES.REQUIRED]: 'Required · gates Arcade'
        };
        const countLabel = questionCount === 1 ? '1 question' : `${questionCount} questions`;
        return `
            <div class="spark-detail spark-check-summary">
                <strong>Understanding check</strong>
                <span>${escapeHtml(modeLabels[mode])}${mode === SPARK_CHECK_MODES.READING_ONLY ? '' : ` · ${escapeHtml(countLabel)}`}</span>
            </div>
        `;
    },

refreshSparkLibrarySurface() {
        this.renderSparkLibrary();
        this.refreshIcons();
    },
};

