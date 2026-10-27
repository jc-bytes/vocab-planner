import { installLazyTeacherProfileMethods } from './supabaseTeacherProfileMethods.js';
import { createSupabaseClient, isSupabaseConfigured } from './services/supabaseClient.js';
import { capturePasswordChangeIntent, invalidatePasswordChangeIntents } from './services/passwordChangeIntent.js';
import { requestWithTimeout } from './services/requestReliability.js';
import {
    mapProfileRow,
    normalizeProfile,
    normalizeUser
} from './services/supabaseValues.js';

function profileWriteGuard(service, userId) {
    const user = service.currentUser;
    const generation = service.authIdentityGeneration || 0;
    return () => {
        if (!user || user.uid !== userId || service.currentUser !== user || generation !== (service.authIdentityGeneration || 0)) {
            throw new DOMException('The account changed. Save your profile again.', 'AbortError');
        }
    };
}

export function installSupabaseAuthProfileMethods(supabaseService, options = {}) {
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

    async signInWithPassword(email, password) {
        invalidatePasswordChangeIntents(this.client);
        await this.init();
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.authIdentityGeneration = (this.authIdentityGeneration || 0) + 1;
        this.currentSession = data.session || null;
        this.currentUser = normalizeUser(data.user);
        return { ...data, user: this.currentUser };
    },

    async upsertStudentProfile(userId, profile) {
        const assertCurrent = profileWriteGuard(this, userId);
        assertCurrent();
        await this.init();
        assertCurrent();
        const normalized = normalizeProfile(profile);
        const payload = { first_name: normalized.firstName, last_name: normalized.lastName };

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
        const user = this.currentUser;
        if (!user) throw new Error('You must be signed in to update your profile.');
        const assertCurrent = profileWriteGuard(this, user.uid);
        await this.init();
        assertCurrent();
        await this.upsertStudentProfile(user.uid, { ...profile, email: user.email || profile.email });
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

    async ensureAllowlistedTeacherProfile(options = {}) {
        await this.init();
        if (!this.currentUser) throw new Error('You must be signed in to verify teacher access.');

        let query = this.client.rpc('ensure_allowlisted_teacher_profile');
        if (options.signal && typeof query.abortSignal === 'function') {
            query = query.abortSignal(options.signal);
        }
        const { data, error } = await query;
        if (error) throw error;
        return mapProfileRow(Array.isArray(data) ? data[0] : data);
    },

    capturePasswordChangeIntent({ ownerUserId = this.currentUser?.uid } = {}) {
        const userId = ownerUserId;
        if (!userId || this.currentUser?.uid !== userId || this.currentSession?.user?.id !== userId) {
            throw new DOMException('The account changed. Open the password form again.', 'AbortError');
        }
        return capturePasswordChangeIntent(this.client, { session: this.currentSession,
            isCurrent: () => this.currentUser?.uid === userId });
    },

    async updatePasswordAndClearFlag(password, settings = {}) {
        return this.updateAccountPassword(password, { ...settings, clearFlag: true });
    },

    async updateAccountPassword(password, settings = {}) {
        const intent = settings.intent || this.capturePasswordChangeIntent();
        try {
            if (!intent.isCurrent()) throw new DOMException('The account changed.', 'AbortError');
            return await requestWithTimeout(async signal => {
                await this.init();
                signal.throwIfAborted();
                const { updatePasswordForIntent } = await (options.loadPasswordOperation
                    ? options.loadPasswordOperation() : import('./services/passwordChangeOperation.js'));
                return updatePasswordForIntent(intent, password, { ...options.passwordChangeDependencies,
                    signal, clearFlag: settings.clearFlag });
            }, { signal: intent.signal, timeoutMs: settings.timeoutMs || 30000, label: 'Password update' });
        } finally { if (!settings.intent) intent.dispose(); }
    },

    async signOut() {
        invalidatePasswordChangeIntents(this.client);
        this.authIdentityGeneration = (this.authIdentityGeneration || 0) + 1;
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
            this.authIdentityGeneration = (this.authIdentityGeneration || 0) + 1;
            this.currentSession = eventSession;
            this.currentUser = eventUser;
            setTimeout(() => {
                Promise.resolve(callback(eventUser, event, eventSession))
                    .catch(error => console.error('Authentication state handler failed:', error));
            }, 0);
        });

        return () => data.subscription.unsubscribe();
    },

    });
    installLazyTeacherProfileMethods(supabaseService, options);
}
