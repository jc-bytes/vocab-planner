import {
    applyConstraints,
    fromClientPayload,
    primaryKeyFor,
    resolveTable,
    snapshotFromRow
} from './supabaseServiceHelpers.js';

const normalizeRef = (refOrDb, collectionName, id) => {
    if (typeof refOrDb === 'string') {
        return { collectionName: refOrDb, id: collectionName };
    }

    if (refOrDb?.kind === 'collection') {
        return { collectionName: refOrDb.collectionName, id: collectionName };
    }

    return { collectionName, id };
};

export const createSupabaseFirestoreAdapter = (supabaseService) => {
    const collection = (_db, collectionName) => ({
        kind: 'collection',
        collectionName,
        tableName: resolveTable(collectionName)
    });

    const doc = (refOrDb, collectionName, id) => {
        const normalized = normalizeRef(refOrDb, collectionName, id);
        return {
            kind: 'doc',
            ...normalized,
            tableName: resolveTable(normalized.collectionName)
        };
    };

    const getDoc = async (ref) => {
        await supabaseService.init();
        const tableName = ref.tableName || resolveTable(ref.collectionName);
        const primaryKey = primaryKeyFor(tableName);
        const { data, error } = await supabaseService.getClient()
            .from(tableName)
            .select('*')
            .eq(primaryKey, ref.id)
            .maybeSingle();

        if (error) throw error;
        return snapshotFromRow(tableName, data);
    };

    const setDoc = async (ref, payload, _options = {}) => {
        await supabaseService.init();
        const tableName = ref.tableName || resolveTable(ref.collectionName);
        if (tableName === 'student_progress' || tableName === 'scores') {
            throw new Error(`Direct writes to ${tableName} are blocked. Use the validated Supabase RPC methods instead.`);
        }
        const primaryKey = primaryKeyFor(tableName);
        const dbPayload = fromClientPayload(tableName, payload, ref.id);

        if (_options?.merge) {
            const { [primaryKey]: _primaryKeyValue, ...updatePayload } = dbPayload;
            const { data, error } = await supabaseService.getClient()
                .from(tableName)
                .update(updatePayload)
                .eq(primaryKey, ref.id)
                .select(primaryKey)
                .maybeSingle();

            if (error) throw error;
            if (data) return;
        }

        const { error } = await supabaseService.getClient()
            .from(tableName)
            .upsert(dbPayload, { onConflict: primaryKey });

        if (error) throw error;
    };

    const addDoc = async (collectionRef, payload) => {
        await supabaseService.init();
        const tableName = collectionRef.tableName || resolveTable(collectionRef.collectionName);

        if (tableName === 'export_logs') {
            const { data, error } = await supabaseService.getClient()
                .from(tableName)
                .insert(fromClientPayload(tableName, payload))
                .select('*')
                .single();
            if (error) throw error;
            return doc(collectionRef, data.id);
        }

        const id = payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const ref = doc(collectionRef, id);
        await setDoc(ref, payload);
        return ref;
    };

    const deleteDoc = async (ref) => {
        await supabaseService.init();
        const tableName = ref.tableName || resolveTable(ref.collectionName);
        const primaryKey = primaryKeyFor(tableName);
        const { error } = await supabaseService.getClient()
            .from(tableName)
            .delete()
            .eq(primaryKey, ref.id);

        if (error) throw error;
    };

    const serverTimestamp = () => new Date().toISOString();

    const where = (field, operator, value) => ({
        kind: 'where',
        field,
        operator,
        value
    });

    const orderBy = (field, direction = 'asc') => ({
        kind: 'orderBy',
        field,
        direction
    });

    const limit = (count) => ({
        kind: 'limit',
        count
    });

    const query = (collectionRef, ...constraints) => ({
        kind: 'query',
        collectionName: collectionRef.collectionName,
        tableName: collectionRef.tableName || resolveTable(collectionRef.collectionName),
        constraints
    });

    const getDocs = async (refOrQuery) => {
        await supabaseService.init();
        const tableName = refOrQuery.tableName || resolveTable(refOrQuery.collectionName);
        let builder = supabaseService.getClient().from(tableName).select('*');
        builder = applyConstraints(builder, tableName, refOrQuery.constraints || []);

        const { data, error } = await builder;
        if (error) throw error;

        const docs = (data || []).map((row) => snapshotFromRow(tableName, row));
        return {
            docs,
            empty: docs.length === 0,
            forEach(callback) {
                docs.forEach(callback);
            }
        };
    };

    const writeBatch = () => {
        const operations = [];

        return {
            set(ref, payload, options) {
                operations.push(() => setDoc(ref, payload, options));
            },
            delete(ref) {
                operations.push(() => deleteDoc(ref));
            },
            async commit() {
                for (const operation of operations) {
                    await operation();
                }
            }
        };
    };

    return {
        collection,
        doc,
        getDoc,
        setDoc,
        addDoc,
        deleteDoc,
        serverTimestamp,
        where,
        orderBy,
        limit,
        query,
        getDocs,
        writeBatch
    };
};
