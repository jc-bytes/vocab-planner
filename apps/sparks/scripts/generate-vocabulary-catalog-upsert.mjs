import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVocabularyCatalog, validateVocabulary } from './lib/vocabularyCatalog.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function argumentValue(name) {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : '';
}

function sqlText(value) {
    if (value === null || value === undefined || value === '') return 'null';
    return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value, fallback) {
    return `${sqlText(JSON.stringify(value ?? fallback))}::jsonb`;
}

function sqlTextArray(values = []) {
    const items = Array.isArray(values) ? values.map(value => sqlText(String(value))) : [];
    return `array[${items.join(', ')}]::text[]`;
}

const grade = String(argumentValue('--grade') || '').trim();
if (grade !== 'all' && !/^\d+$/.test(grade)) {
    throw new Error('Usage: node scripts/generate-vocabulary-catalog-upsert.mjs --grade <number|all>');
}

const catalog = await loadVocabularyCatalog(workspaceRoot);
const entries = catalog.filter(({ vocabulary }) => (
    grade === 'all'
    || (Array.isArray(vocabulary.grades) && vocabulary.grades.map(String).includes(grade))
));

const rows = [];
for (const { entry, vocabulary } of entries) {
    const errors = validateVocabulary(vocabulary, entry.path);
    if (errors.length > 0) throw new Error(errors.join('\n'));
    rows.push(`(
        ${sqlText(vocabulary.id)},
        ${sqlText(vocabulary.name || '')},
        ${sqlText(vocabulary.description || '')},
        ${sqlTextArray(vocabulary.grades || [grade])},
        ${sqlText(vocabulary.subjectSlug || vocabulary.subject_slug || 'technology')},
        ${sqlText(vocabulary.assignedDate || vocabulary.assigned_date)},
        ${sqlText(vocabulary.trimester)},
        ${sqlText(vocabulary.month)},
        ${Number.isInteger(Number(vocabulary.week)) ? Number(vocabulary.week) : 'null'},
        ${sqlJson(vocabulary.activitySettings, {})},
        ${sqlJson(vocabulary.words, [])}
    )`);
}

if (rows.length === 0) {
    throw new Error(`No vocabulary entries found for Grade ${grade}.`);
}

process.stdout.write(`begin;

create temporary table vocabulary_catalog_sync (
    id text primary key,
    name text not null,
    description text not null,
    grades text[] not null,
    subject_slug text not null,
    assigned_date date,
    trimester text,
    month text,
    week integer,
    activity_settings jsonb not null,
    words jsonb not null
) on commit drop;

insert into vocabulary_catalog_sync (
    id, name, description, grades, subject_slug, assigned_date,
    trimester, month, week, activity_settings, words
) values
${rows.join(',\n')};

insert into public.vocabularies (
    id, name, description, grades, subject_slug, assigned_date,
    trimester, month, week, activity_settings, words
)
select
    id, name, description, grades, subject_slug, assigned_date,
    trimester, month, week, activity_settings, words
from vocabulary_catalog_sync
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    grades = excluded.grades,
    subject_slug = excluded.subject_slug,
    assigned_date = excluded.assigned_date,
    trimester = excluded.trimester,
    month = excluded.month,
    week = excluded.week,
    activity_settings = excluded.activity_settings,
    words = excluded.words;

do $$
begin
    if exists (
        select 1
        from vocabulary_catalog_sync expected
        left join public.vocabularies actual using (id)
        where actual.id is null
           or row(
                actual.name, actual.description, actual.grades, actual.subject_slug,
                actual.assigned_date, actual.trimester, actual.month, actual.week,
                actual.activity_settings, actual.words
           ) is distinct from row(
                expected.name, expected.description, expected.grades, expected.subject_slug,
                expected.assigned_date, expected.trimester, expected.month, expected.week,
                expected.activity_settings, expected.words
           )
    ) then
        raise exception 'Vocabulary catalog verification failed after upsert.';
    end if;
end;
$$;

commit;\n`);
