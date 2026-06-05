import { createSupabaseClient, isSupabaseConfigured } from './services/supabaseClient.js';
import { DEFAULT_COIN_DATA, fromClientPayload, normalizeProfile, normalizeUser, toClientRow } from './supabaseServiceHelpers.js';

export function installSupabaseAuthProfileMethods(supabaseService) {
    Object.assign(supabaseService, {
    async init() {
        if (this.client) return this;

        if (!isSupabaseConfigured()) {
            throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, or provide window.SUPABASE_CONFIG.');
        }

        this.client = createSupabaseClient();

        const { data } = await this.client.auth.getSession();
        this.currentSession = data.session || null;
        this.currentUser = normalizeUser(this.currentSession?.user || null);
        return this;
    },

    getDatabase() {
        if (!this.client) {
            throw new Error('Supabase client has not been initialized.');
        }
        return { kind: 'supabase' };
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
        const payload = fromClientPayload('profiles', {
            ...normalized,
            role: 'student'
        }, userId);

        const { error } = await this.client
            .from('profiles')
            .upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;
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
        const payload = fromClientPayload('student_progress', {
            studentProfile: normalizeProfile(profile),
            coinData: { ...DEFAULT_COIN_DATA },
            coinHistory: [],
            coins: 0,
            units: {}
        }, userId);

        const { error } = await this.client
            .from('student_progress')
            .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: false });
        if (error) throw error;
        return null;
    },

    async getProfile(userId = null) {
        await this.init();
        const id = userId || this.currentUser?.uid;
        if (!id) return null;

        const { data, error } = await this.client
            .from('profiles')
            .select('*')
            .eq('user_id', id)
            .maybeSingle();
        if (error) throw error;
        return toClientRow('profiles', data);
    },

    async getStudentsWithProgress() {
        await this.init();
        const [{ data: profiles, error: profilesError }, { data: progressRows, error: progressError }] =
            await Promise.all([
                this.client
                    .from('profiles')
                    .select('*')
                    .eq('role', 'student')
                    .order('grade_level', { ascending: true })
                    .order('section_letter', { ascending: true })
                    .order('last_name', { ascending: true }),
                this.client
                    .from('student_progress')
                    .select('*')
            ]);

        if (profilesError) throw profilesError;
        if (progressError) throw progressError;

        const progressByUserId = new Map(
            (progressRows || []).map((row) => [row.user_id, toClientRow('student_progress', row)])
        );

        return (profiles || []).map((profileRow) => {
            const profile = toClientRow('profiles', profileRow);
            const progress = progressByUserId.get(profile.userId) || {
                id: profile.userId,
                userId: profile.userId,
                studentProfile: {},
                units: {},
                coins: 0,
                coinData: { ...DEFAULT_COIN_DATA },
                coinHistory: [],
                updatedAt: profile.updatedAt
            };

            const studentProfile = {
                firstName: profile.firstName,
                lastName: profile.lastName,
                name: profile.name,
                email: profile.email,
                grade: profile.grade,
                group: profile.group
            };

            return {
                ...progress,
                id: profile.userId,
                email: profile.email,
                role: profile.role,
                mustChangePassword: profile.mustChangePassword,
                studentProfile: {
                    ...studentProfile,
                    ...(progress.studentProfile || {})
                },
                updatedAt: progress.updatedAt || profile.updatedAt
            };
        });
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
            this.currentSession = session || null;
            this.currentUser = normalizeUser(session?.user || null);
            setTimeout(() => callback(this.currentUser, event, this.currentSession), 0);
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
