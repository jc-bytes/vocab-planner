export function resolveLocalDatabaseSource(config, env = {}) {
    const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"\s*(?:#.*)?$/m)?.[1];
    if (!projectId && !env.SPARKS_LOCAL_DB_CONTAINER) throw new Error('Missing project_id in local Supabase config.');
    const container = env.SPARKS_LOCAL_DB_CONTAINER || `supabase_db_${projectId}`;
    if (!/^supabase_db_[a-zA-Z0-9_-]+$/.test(container)) throw new Error('Expected a local Supabase Docker database container.');
    const database = env.SPARKS_LOCAL_SOURCE_DATABASE || 'postgres';
    if (!/^(?:postgres|student_insight_rehearsal_[a-f0-9]+)$/.test(database)) throw new Error('Expected the normal or disposable local source database.');
    return { container, database };
}
