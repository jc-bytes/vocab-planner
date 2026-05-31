#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

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

const isBase64Image = value => typeof value === 'string' && /^data:image\//i.test(value);

const loadCandidates = async () => {
    let query = supabase
        .from('student_progress')
        .select('user_id, units');

    if (Number.isInteger(limit) && limit > 0) {
        query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
};

const cleanUnits = (units = {}) => {
    let removable = 0;
    let needsMigration = 0;
    let changed = false;
    const nextUnits = JSON.parse(JSON.stringify(units || {}));

    for (const [unitKey, unit] of Object.entries(nextUnits)) {
        if (!unit || typeof unit !== 'object' || !unit.images || typeof unit.images !== 'object') continue;

        for (const [word, value] of Object.entries(unit.images)) {
            if (!isBase64Image(value)) continue;

            const hasStorageImage = Boolean(unit.wordHunt?.[word]?.imagePath);
            if (hasStorageImage) {
                delete unit.images[word];
                removable += 1;
                changed = true;
            } else {
                needsMigration += 1;
                console.log(`needs migration: ${unitKey}/${word} has base64 image but no wordHunt imagePath`);
            }
        }
    }

    return { units: nextUnits, removable, needsMigration, changed };
};

const main = async () => {
    const candidates = await loadCandidates();
    let rowsChanged = 0;
    let imagesRemoved = 0;
    let imagesNeedingMigration = 0;

    console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${candidates.length} student progress rows with images objects found.`);

    for (const row of candidates) {
        const result = cleanUnits(row.units || {});
        imagesRemoved += result.removable;
        imagesNeedingMigration += result.needsMigration;

        if (!result.changed) continue;
        rowsChanged += 1;
        console.log(`${apply ? 'clean' : 'would clean'} ${row.user_id}: remove ${result.removable} legacy base64 images`);

        if (!apply) continue;

        const { error } = await supabase
            .from('student_progress')
            .update({
                units: result.units,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', row.user_id);
        if (error) throw error;
    }

    console.log(`Rows affected: ${rowsChanged}. Removable images: ${imagesRemoved}. Images needing migration: ${imagesNeedingMigration}.`);
    if (!apply) {
        console.log('Dry run only. Re-run with --apply to remove safe legacy base64 images.');
    }
};

main().catch(error => {
    console.error(error);
    process.exit(1);
});
