import { createSupabaseClient, isSupabaseConfigured } from './services/supabaseClient.js';
import {
    DEFAULT_COIN_DATA,
    mapProfileRow,
    normalizeProfile,
    normalizeUser,
    profilePayload,
    toClientTimestamp
} from './services/supabaseValues.js';

function normalizeTeacherProgressRecord(record, { detailed = false } = {}) {
    if (!record) return null;
    const studentProfile = normalizeProfile(record.studentProfile || {});
    return {
        ...record,
        id: record.id || record.userId,
        userId: record.userId || record.id,
        email: record.email || studentProfile.email,
        role: record.role || 'student',
        mustChangePassword: Boolean(record.mustChangePassword),
        studentProfile,
        units: detailed ? (record.units || {}) : undefined,
        coins: Number(record.coins) || 0,
        coinData: record.coinData || { ...DEFAULT_COIN_DATA },
        totalXp: Number(record.totalXp) || 0,
        version: Number(record.version) || 0,
        createdAt: toClientTimestamp(record.createdAt),
        updatedAt: toClientTimestamp(record.updatedAt),
        progressDetailLoaded: detailed
    };
}

export function installSupabaseAuthProfileMethods(supabaseService) {
    Object.assign(supabaseService, {
    async init() {
        if (this.initPromise) return this.initPromise;
        if (this.client && this.initialized) return this;

        if (!isSupabaseConfigured()) {
            throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or provide window.SUPABASE_CONFIG.');
        }

        this.initPromise = (async () => {
            const client = this.client || createSupabaseClient();
            this.client = client;
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            this.currentSession = data.session || null;
            this.currentUser = normalizeUser(this.currentSession?.user || null);
            this.initialized = true;
            return this;
        })().catch(error => {
            this.client = null;
            this.currentSession = null;
            this.currentUser = null;
            this.initialized = false;
            throw error;
        }).finally(() => {
            this.initPromise = null;
        });

        return this.initPromise;
    },

    getClient() {
        if (!this.client) {
            throw new Error('Supabase client has not been initialized.');
        }
        return this.client;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    getCurrentSession() {
        return this.currentSession;
    },

    async signInWithPassword(email, password) {
        await this.init();
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.currentSession = data.session || null;
        this.currentUser = normalizeUser(data.user);
        return { ...data, user: this.currentUser };
    },

    async signUpStudent(profile, password) {
        await this.init();
        const normalized = normalizeProfile(profile);
        const { data, error } = await this.client.auth.signUp({
            email: normalized.email,
            password,
            options: {
                data: {
                    first_name: normalized.firstName,
                    last_name: normalized.lastName,
                    full_name: normalized.name
                }
            }
        });

        if (error) throw error;

        if (!data.session) {
            const { data: loginData, error: loginError } = await this.client.auth.signInWithPassword({
                email: normalized.email,
                password
            });

            if (loginError) {
                const message = loginError.message || '';
                if (message.toLowerCase().includes('email not confirmed')) {
                    throw new Error('This email was registered while confirmation was still required. Confirm or delete that user in Supabase Auth, then try again.');
                }
                throw new Error(`Account created, but no session was returned. Try logging in instead. ${message}`);
            }

            this.currentSession = loginData.session || null;
            this.currentUser = normalizeUser(loginData.user);
        } else {
            this.currentSession = data.session || null;
            this.currentUser = normalizeUser(data.user);
        }

        await this.upsertStudentProfile(this.currentUser.uid, normalized);
        await this.ensureStudentProgress(this.currentUser.uid, normalized);
        return { ...data, user: this.currentUser };
    },

    async signUpTeacher(email, password) {
        await this.init();
        const { data, error } = await this.client.auth.signUp({ email, password });
        if (error) throw error;

        if (!data.session) {
            const { data: loginData, error: loginError } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (loginError) {
                const message = loginError.message || '';
                if (message.toLowerCase().includes('email not confirmed')) {
                    throw new Error('This teacher email was registered while confirmation was still required. Confirm or delete that user in Supabase Auth, then try again.');
                }
                throw new Error(`Teacher account created, but no session was returned. Try logging in instead. ${message}`);
            }

            this.currentSession = loginData.session || null;
            this.currentUser = normalizeUser(loginData.user);
        } else {
            this.currentSession = data.session || null;
            this.currentUser = normalizeUser(data.user);
        }

        const profile = await this.getProfile(this.currentUser.uid);
        if (profile?.role !== 'teacher') {
            await this.signOut();
            throw new Error('This email is not in teacher_allowlist. Add it there before using teacher tools.');
        }
        return { ...data, user: this.currentUser };
    },

    async upsertStudentProfile(userId, profile) {
        await this.init();
        const normalized = normalizeProfile(profile);
        const payload = profilePayload({
            ...normalized,
            role: 'student'
        }, userId);

        const { data, error } = await this.client
            .from('profiles')
            .update(payload)
            .eq('user_id', userId)
            .select('user_id')
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Student profile was not provisioned by a teacher.');
    },

    async updateStudentProfile(profile) {
        await this.init();
        if (!this.currentUser) throw new Error('You must be signed in to update your profile.');
        await this.upsertStudentProfile(this.currentUser.uid, {
            ...profile,
            email: this.currentUser.email || profile.email
        });
    },

    async ensureStudentProgress(userId, profile = {}) {
        await this.init();
        if (userId && this.currentUser?.uid && userId !== this.currentUser.uid) {
            throw new Error('Students can only initialize their own progress.');
        }
        if (typeof this.ensureOwnStudentProgress === 'function') {
            return this.ensureOwnStudentProgress(normalizeProfile(profile));
        }
        throw new Error('Student progress initialization RPC is unavailable.');
    },

    async getProfile(userId = null, options = {}) {
        await this.init();
        const id = userId || this.currentUser?.uid;
        if (!id) return null;

        let query = this.client
            .from('profiles')
            .select('*')
            .eq('user_id', id)
            .maybeSingle();
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return mapProfileRow(data);
    },

    async ensureAllowlistedTeacherProfile() {
        await this.init();
        if (!this.currentUser) throw new Error('You must be signed in to verify teacher access.');

        const { data, error } = await this.client.rpc('ensure_allowlisted_teacher_profile');
        if (error) throw error;
        return mapProfileRow(Array.isArray(data) ? data[0] : data);
    },

    async listStudentProgressSummaries({
        limit = 100,
        offset = 0,
        grade = null,
        section = null,
        search = null
    } = {}) {
        await this.init();
        const pageLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 200);
        const pageOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
        const { data, error } = await this.client.rpc('list_student_progress_summaries_v1', {
            p_limit: pageLimit,
            p_offset: pageOffset,
            p_grade: grade === null || grade === '' ? null : Number.parseInt(grade, 10),
            p_section: section || null,
            p_search: search || null
        });
        if (error) throw error;
        const page = Array.isArray(data) ? data[0] : data;
        return {
            items: (page?.items || []).map(item => normalizeTeacherProgressRecord(item)),
            total: Number(page?.total) || 0,
            limit: Number(page?.limit) || pageLimit,
            offset: Number(page?.offset) || pageOffset
        };
    },

    async getStudentsWithProgress() {
        const students = [];
        const limit = 100;
        let offset = 0;
        let total = Infinity;

        while (offset < total) {
            const page = await this.listStudentProgressSummaries({ limit, offset });
            students.push(...page.items);
            total = page.total;
            if (page.items.length === 0) break;
            offset += page.items.length;
        }

        return students;
    },

    async getWordHuntReviewData() {
        await this.init();
        const { data, error } = await this.client.rpc('list_word_hunt_reviews_v1');
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.map(row => normalizeTeacherProgressRecord(row, { detailed: true }));
    },

    async listStudentIdentityRoster() {
        await this.init();
        const { data, error } = await this.client.rpc('list_student_identity_roster_v1');
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.map(row => normalizeTeacherProgressRecord(row));
    },

    async getStudentRosterFilters() {
        await this.init();
        const { data, error } = await this.client.rpc('list_student_roster_filters_v1');
        if (error) throw error;
        const filters = Array.isArray(data) ? data[0] : data;
        return {
            grades: (filters?.grades || []).map(String),
            classes: (filters?.classes || []).map(item => ({
                grade: String(item?.grade || ''),
                section: String(item?.section || '')
            })).filter(item => item.grade && item.section)
        };
    },

    async getTeacherDashboardAnalytics({ grade = null } = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('get_teacher_dashboard_analytics_v1', {
            p_grade: grade === null || grade === '' ? null : Number.parseInt(grade, 10)
        });
        if (error) throw error;
        const analytics = Array.isArray(data) ? data[0] : data;
        return {
            totalStudents: Number(analytics?.totalStudents) || 0,
            activeStudents: Number(analytics?.activeStudents) || 0,
            averageCoins: Number(analytics?.averageCoins) || 0,
            availableGrades: (analytics?.availableGrades || []).map(String),
            gradeCounts: analytics?.gradeCounts || {},
            coinDistribution: (analytics?.coinDistribution || []).map(value => Number(value) || 0),
            activities: analytics?.activities || {},
            recentActivities: analytics?.recentActivities || []
        };
    },

    async getStudentProgressForTeacher(userId, options = {}) {
        await this.init();
        let query = this.client.rpc('get_student_progress_v3', { p_user_id: userId });
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return normalizeTeacherProgressRecord(Array.isArray(data) ? data[0] : data, { detailed: true });
    },

    async setStudentActivityLateOverride(attemptId, { excused, reason = '' } = {}) {
        await this.init();
        const { data, error } = await this.client.rpc('set_student_activity_late_override_v1', {
            p_attempt_id: attemptId,
            p_excused: Boolean(excused),
            p_reason: String(reason || '').trim()
        });
        if (error) throw error;
        return Array.isArray(data) ? data[0] : data;
    },

    async getStudentsProgressForTeacher(userIds = []) {
        await this.init();
        const ids = Array.from(new Set(userIds.filter(Boolean)));
        if (ids.length === 0) return [];
        if (ids.length > 200) throw new Error('A maximum of 200 students can be loaded at once.');
        const { data, error } = await this.client.rpc('get_students_progress_by_ids_v1', {
            p_user_ids: ids
        });
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        return rows.map(row => normalizeTeacherProgressRecord(row, { detailed: true }));
    },

    async updatePasswordAndClearFlag(password) {
        await this.init();
        if (!this.currentUser) throw new Error('You must be signed in to change your password.');

        const { error: passwordError } = await this.client.auth.updateUser({ password });
        if (passwordError) throw passwordError;

        const { error: profileError } = await this.client
            .from('profiles')
            .update({ must_change_password: false })
            .eq('user_id', this.currentUser.uid);
        if (profileError) throw profileError;
    },

    async resetStudentPassword(userId) {
        await this.init();
        const { data, error } = await this.client.functions.invoke('reset-student-password', {
            body: { userId }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    },

    async createStudentAccount(profile, password) {
        await this.init();
        const normalized = normalizeProfile(profile);
        const { data, error } = await this.client.functions.invoke('create-student-account', {
            body: {
                firstName: normalized.firstName,
                lastName: normalized.lastName,
                email: normalized.email,
                grade: normalized.grade,
                section: normalized.group,
                password
            }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    },

    async signOut() {
        await this.init();
        await this.client.auth.signOut({ scope: 'local' });
        this.currentSession = null;
        this.currentUser = null;
    },

    onAuthStateChanged(callback) {
        if (!this.client) {
            throw new Error('Supabase client has not been initialized.');
        }

        const { data } = this.client.auth.onAuthStateChange((event, session) => {
            const eventSession = session || null;
            const eventUser = normalizeUser(session?.user || null);
            this.currentSession = eventSession;
            this.currentUser = eventUser;
            setTimeout(() => {
                Promise.resolve(callback(eventUser, event, eventSession))
                    .catch(error => console.error('Authentication state handler failed:', error));
            }, 0);
        });

        return () => data.subscription.unsubscribe();
    },

    isEmailSignInLink() {
        return false;
    },

    async completeEmailSignIn() {
        throw new Error('Email link sign-in is not enabled for this build.');
    },

    async sendEmailSignInLink() {
        throw new Error('Email link sign-in is not enabled for this build.');
    },

    async handleRedirectResult() {
        return null;
    },
    });
}
