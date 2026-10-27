import { readSectionQuery } from './sectionRead.js';

// Callers own filters and a deterministic order ending in a unique key.
// Count the first page because a server cap may be smaller than our page size.
export async function readCollection(getClient, build, signal, client) {
    signal?.throwIfAborted();
    client ||= await getClient();
    signal?.throwIfAborted();
    const rows = [];
    let total = null;
    do {
        signal?.throwIfAborted();
        let query = build(client, rows.length ? undefined : { count: 'exact' })
            .range(rows.length, rows.length + 499);
        const { data, error, count } = await readSectionQuery(query, { signal });
        signal?.throwIfAborted();
        if (error) throw error;
        if (count != null) total = count;
        if (!data?.length) break;
        rows.push(...data);
    } while (total === null || rows.length < total);
    return rows;
}
