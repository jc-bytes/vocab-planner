import { $, notifications } from '../main.js';
import { teacherApi as supabaseService } from '../services/teacherApi.js';

export const teacherProgressPageMethods = {
    async loadStudentRosterFilters({ forceRefresh = false } = {}) {
        if (this.authDisabled) return { grades: [], classes: [] };
        if (!forceRefresh && this.studentRosterFilters) return this.studentRosterFilters;
        try {
            this.studentRosterFilters = await supabaseService.getStudentRosterFilters();
        } catch (error) {
            console.error('Error fetching roster filters:', error);
            this.studentRosterFilters ||= { grades: [], classes: [] };
        }
        return this.studentRosterFilters;
    },

    getStudentProgressQuery({ page = null } = {}) {
        const currentPage = page ?? this.studentProgressPage?.page ?? 1;
        return {
            page: Math.max(Number.parseInt(currentPage, 10) || 1, 1),
            pageSize: 50,
            grade: $('#filter-grade')?.value || '',
            section: $('#filter-group')?.value || '',
            search: ($('#filter-search')?.value || '').trim()
        };
    },

    async fetchStudentProgressPage({ forceRefresh = false, resetPage = false, showError = true } = {}) {
        if (this.authDisabled) {
            this.applyStudentProgressPage({ items: [], total: 0, limit: 50, offset: 0 });
            return [];
        }

        const query = this.getStudentProgressQuery({ page: resetPage ? 1 : null });
        const offset = (query.page - 1) * query.pageSize;
        const cacheKey = JSON.stringify({ ...query, offset });
        const generation = (this.studentProgressPageGeneration || 0) + 1;
        this.studentProgressPageGeneration = generation;
        this.studentProgressPageCache ||= new Map();
        const cached = this.studentProgressPageCache.get(cacheKey);
        if (!forceRefresh && cached) {
            this.applyStudentProgressPage(cached);
            this.setStudentProgressLoadState('ready');
            return cached.items;
        }

        this.setStudentProgressLoadState('loading');
        try {
            const result = await supabaseService.listStudentProgressSummaries({
                limit: query.pageSize,
                offset,
                grade: query.grade,
                section: query.section,
                search: query.search
            });
            if (generation !== this.studentProgressPageGeneration) return this.allStudentData;
            this.studentProgressPageCache.set(cacheKey, result);
            this.applyStudentProgressPage(result);
            this.setStudentProgressLoadState('ready');
            return result.items;
        } catch (error) {
            if (generation !== this.studentProgressPageGeneration) return this.allStudentData;
            console.error('Error fetching student progress page:', error);
            if (this.studentProgressLastPage) this.applyStudentProgressPage(this.studentProgressLastPage);
            this.setStudentProgressLoadState(this.studentProgressLastPage ? 'stale' : 'error');
            if (showError) notifications.error('Student data could not be refreshed.');
            throw error;
        }
    },

    applyStudentProgressPage(page) {
        this.studentProgressLastPage = page;
        this.applyStudentProgressData(page?.items || []);
        const limit = Number(page?.limit) || 50;
        const offset = Number(page?.offset) || 0;
        this.studentProgressPage = {
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
            total: Number(page?.total) || 0
        };
        this.renderProgressTable();
        this.renderStudentProgressPagination();
    },

    setStudentProgressLoadState(status) {
        this.studentProgressLoadState = status;
        const loading = $('#progress-loading');
        const statusEl = $('#student-progress-status');
        if (loading) loading.classList.toggle('hidden', status !== 'loading');
        if (!statusEl) return;
        const messages = {
            stale: 'Could not refresh the roster. Showing the last successfully loaded page.',
            error: 'The roster is unavailable right now.',
            ready: ''
        };
        statusEl.classList.toggle('hidden', !messages[status]);
        statusEl.innerHTML = messages[status]
            ? `${messages[status]} <button type="button" class="btn text-btn" data-progress-retry>Retry</button>`
            : '';
    },

    renderStudentProgressPagination() {
        const pagination = $('#student-progress-pagination');
        if (!pagination) return;
        const { page = 1, pageSize = 50, total = 0 } = this.studentProgressPage || {};
        const pageCount = Math.max(Math.ceil(total / pageSize), 1);
        pagination.classList.toggle('hidden', total === 0);
        pagination.innerHTML = total ? `
            <button type="button" class="btn text-btn" data-progress-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
            <span>Page ${page} of ${pageCount} · ${total} students</span>
            <button type="button" class="btn text-btn" data-progress-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>Next</button>
        ` : '';
    },

    async changeStudentProgressPage(page) {
        const pageSize = this.studentProgressPage?.pageSize || 50;
        const pageCount = Math.max(Math.ceil((this.studentProgressPage?.total || 0) / pageSize), 1);
        const nextPage = Math.min(Math.max(Number.parseInt(page, 10) || 1, 1), pageCount);
        this.studentProgressPage = { ...(this.studentProgressPage || {}), page: nextPage };
        await this.fetchStudentProgressPage();
    },

    scheduleStudentProgressFilter() {
        window.clearTimeout(this.studentProgressFilterTimer);
        this.studentProgressFilterTimer = window.setTimeout(() => this.applyFilters(), 250);
    }
};
