#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'classroom-activity-scenes';
const MAX_BYTES = 1024 * 1024;

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const apply = args.has('--apply');
const limitEqualsArg = rawArgs.find(arg => arg.startsWith('--limit='));
const limitSpaceIndex = rawArgs.indexOf('--limit');
const limitValue = limitEqualsArg
    ? limitEqualsArg.split('=')[1]
    : limitSpaceIndex >= 0
        ? rawArgs[limitSpaceIndex + 1]
        : null;
const limit = limitValue ? Number.parseInt(limitValue, 10) : null;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

const slugifyStoragePart = (value, fallback = 'item') => {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || fallback;
};

const buildPath = (submission) => [
    submission.student_id,
    'classroom-activities',
    slugifyStoragePart(submission.assignment_id, 'assignment'),
    `${slugifyStoragePart(submission.id, 'submission')}.json`
].join('/');

const loadCandidates = async () => {
    let query = supabase
        .from('classroom_activity_submissions')
        .select('id, assignment_id, student_id, response_data, response_data_storage_path')
        .not('response_data->excalidrawScene', 'is', null)
        .order('updated_at', { ascending: true });

    if (Number.isInteger(limit) && limit > 0) {
        query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

const main = async () => {
    const candidates = await loadCandidates();
    let uploaded = 0;
    let skipped = 0;

    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${candidates.length} classroom submissions with inline scenes found.`);

    for (const submission of candidates) {
        const scene = submission.response_data?.excalidrawScene;
        if (!scene || typeof scene !== 'object') {
            skipped += 1;
            console.log(`skip ${submission.id}: no usable scene object`);
            continue;
        }

        const text = JSON.stringify(scene);
        const sizeBytes = Buffer.byteLength(text, 'utf8');
        if (sizeBytes > MAX_BYTES) {
            skipped += 1;
            console.log(`skip ${submission.id}: scene is ${sizeBytes} bytes, over ${MAX_BYTES}`);
            continue;
        }

        const path = submission.response_data_storage_path || buildPath(submission);
        console.log(`${apply ? 'migrate' : 'would migrate'} ${submission.id}: ${sizeBytes} bytes -> ${BUCKET}/${path}`);

        if (!apply) continue;

        const { error: uploadError } = await supabase
            .storage
            .from(BUCKET)
            .upload(path, Buffer.from(text, 'utf8'), {
                cacheControl: '3600',
                contentType: 'application/json',
                upsert: true
            });
        if (uploadError) throw uploadError;

        const { excalidrawScene: _scene, ...trimmedResponseData } = submission.response_data || {};
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
            .from('classroom_activity_submissions')
            .update({
                response_data: trimmedResponseData,
                response_data_storage_path: path,
                response_data_storage_size_bytes: sizeBytes,
                response_data_storage_updated_at: now,
                updated_at: now
            })
            .eq('id', submission.id);
        if (updateError) throw updateError;

        uploaded += 1;
    }

    console.log(`Done. ${apply ? `Migrated ${uploaded}; ` : ''}Skipped ${skipped}.`);
    if (!apply) {
        console.log('Dry run only. Re-run with --apply to upload scenes and trim response_data.');
    }
};

main().catch(error => {
    console.error(error);
    process.exit(1);
});
