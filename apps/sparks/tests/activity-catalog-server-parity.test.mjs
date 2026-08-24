import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    DEFAULT_PRACTICE_REQUIRED_ROTATION,
    DEFAULT_REQUIRED_BY_PURPOSE
} from '../js/activityFlowPolicy.js';
import { getStudentActivityIds } from '../js/student/studentActivityRegistry.js';

const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFunctionDefinition(sql, functionName, filename) {
    const functionPattern = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+${escapeRegExp(functionName)}\\s*\\(`,
        'ig'
    );
    const definitions = [];
    let match;

    while ((match = functionPattern.exec(sql)) !== null) {
        const parametersStart = match.index + match[0].length;
        const returnsMatch = /\)\s*returns\b/i.exec(sql.slice(parametersStart));
        if (!returnsMatch) {
            throw new Error(`${filename} has no readable signature for ${functionName}`);
        }
        const parameters = sql.slice(parametersStart, parametersStart + returnsMatch.index).trim();
        const remainder = sql.slice(match.index);
        const delimiterMatch = /\bas\s+(\$[A-Za-z0-9_]*\$)/i.exec(remainder);
        if (!delimiterMatch) {
            throw new Error(`${filename} has no dollar-quoted body for ${functionName}`);
        }
        const delimiter = delimiterMatch[1];
        const bodyStart = match.index + delimiterMatch.index + delimiterMatch[0].length;
        const bodyEnd = sql.indexOf(`${delimiter};`, bodyStart);
        if (bodyEnd < 0) {
            throw new Error(`${filename} has no closing delimiter for ${functionName}`);
        }
        definitions.push({
            definition: sql.slice(match.index, bodyEnd + delimiter.length + 1),
            parameters,
            startIndex: match.index
        });
        functionPattern.lastIndex = bodyEnd + delimiter.length + 1;
    }

    return definitions;
}

function extractSqlStringArray(definition, arrayPattern, label, filename) {
    const flags = arrayPattern.flags.includes('g') ? arrayPattern.flags : `${arrayPattern.flags}g`;
    const pattern = new RegExp(arrayPattern.source, flags);
    const matches = [...definition.matchAll(pattern)];
    if (matches.length !== 1) {
        throw new Error(`${filename} must expose exactly one ${label} array, found ${matches.length}`);
    }

    const arraySource = matches[0][1];
    const values = [];
    const stringPattern = /'((?:''|[^'])*)'/g;
    let stringMatch;
    while ((stringMatch = stringPattern.exec(arraySource)) !== null) {
        values.push(stringMatch[1].replaceAll("''", "'"));
    }
    const unsupportedSql = arraySource.replace(/'((?:''|[^'])*)'/g, '').replace(/[\s,]/g, '');
    if (unsupportedSql) {
        throw new Error(`${filename} ${label} array contains unsupported SQL: ${unsupportedSql}`);
    }
    if (values.length === 0 || new Set(values).size !== values.length) {
        throw new Error(`${filename} has an empty or duplicate ${label} array`);
    }
    return values;
}

async function findLatestFunctionDefinition(functionName, createSignature, dropSignature) {
    const filenames = (await readdir(migrationsUrl))
        .filter(filename => filename.endsWith('.sql'))
        .sort();
    let latest = null;

    for (const filename of filenames) {
        const sql = await readFile(new URL(filename, migrationsUrl), 'utf8');
        for (const candidate of extractFunctionDefinition(sql, functionName, filename)) {
            if (createSignature.test(candidate.parameters.replace(/\s+/g, ' '))) {
                latest = { filename, ...candidate };
            }
        }
    }

    if (!latest) {
        throw new Error(`No migration defines ${functionName}`);
    }

    const dropPattern = new RegExp(
        `drop\\s+function\\s+(?:if\\s+exists\\s+)?${escapeRegExp(functionName)}\\s*\\(([^)]*)\\)`,
        'ig'
    );
    for (const filename of filenames.filter(name => name >= latest.filename)) {
        const sql = await readFile(new URL(filename, migrationsUrl), 'utf8');
        let dropMatch;
        while ((dropMatch = dropPattern.exec(sql)) !== null) {
            const occursAfterLatest = filename > latest.filename || dropMatch.index > latest.startIndex;
            if (occursAfterLatest && dropSignature.test(dropMatch[1].replace(/\s+/g, ' ').trim())) {
                throw new Error(`${functionName} is dropped after its latest definition in ${filename}`);
            }
        }
    }
    return latest;
}

test('SQL allowlist extraction rejects ambiguous or computed arrays', () => {
    const pattern = /allowed\s*:=\s*array\s*\[([\s\S]*?)\]\s*;/i;
    assert.throws(
        () => extractSqlStringArray(
            "allowed := array['matching']; allowed := array['quiz'];",
            pattern,
            'test',
            'synthetic.sql'
        ),
        /exactly one/
    );
    assert.throws(
        () => extractSqlStringArray(
            "allowed := array['matching', private.extra_activity()];",
            pattern,
            'test',
            'synthetic.sql'
        ),
        /unsupported SQL/
    );
});

test('client activity IDs match every effective server vocabulary activity allowlist', async () => {
    const accessFunction = await findLatestFunctionDefinition(
        'private.assert_student_activity_access',
        /^p_user_id uuid, p_unit_key text, p_vocabulary_id text, p_activity_type text$/i,
        /^uuid, text, text, text$/i
    );
    const flowFunction = await findLatestFunctionDefinition(
        'private.normalize_vocabulary_activity_flow',
        /^$/,
        /^$/
    );
    const requiredFunction = await findLatestFunctionDefinition(
        'private.required_vocabulary_activities',
        /^vocabulary_row public\.vocabularies$/i,
        /^public\.vocabularies$/i
    );

    const accessIds = extractSqlStringArray(
        accessFunction.definition,
        /p_activity_type\s*<>\s*all\s*\(\s*array\s*\[([\s\S]*?)\]\s*\)/i,
        'student activity access',
        accessFunction.filename
    );
    const flowIds = extractSqlStringArray(
        flowFunction.definition,
        /allowed_activities\s+text\[\]\s*:=\s*array\s*\[([\s\S]*?)\]\s*;/i,
        'vocabulary activity flow',
        flowFunction.filename
    );
    const requiredIds = extractSqlStringArray(
        requiredFunction.definition,
        /where\s+value\s*=\s*any\s*\(\s*array\s*\[([\s\S]*?)\]\s*\)/i,
        'required vocabulary activity filtering',
        requiredFunction.filename
    );
    const clientIds = getStudentActivityIds();
    const sortedClientIds = [...clientIds].sort();

    assert.deepEqual(
        [...accessIds].sort(),
        sortedClientIds,
        `Client registry differs from server access authority in ${accessFunction.filename}`
    );
    assert.deepEqual(
        [...flowIds].sort(),
        sortedClientIds,
        `Client registry differs from server flow authority in ${flowFunction.filename}`
    );
    assert.deepEqual(
        [...requiredIds].sort(),
        sortedClientIds,
        `Client registry differs from server required-activity filter in ${requiredFunction.filename}`
    );
});

test('client default activity flow matches the independent server fallback policy', async () => {
    const requiredFunction = await findLatestFunctionDefinition(
        'private.required_vocabulary_activities',
        /^vocabulary_row public\.vocabularies$/i,
        /^public\.vocabularies$/i
    );
    const summative = extractSqlStringArray(
        requiredFunction.definition,
        /like\s+'%summative%'[\s\S]*?return\s+array\s*\[([\s\S]*?)\]\s*;/i,
        'summative activity fallback',
        requiredFunction.filename
    );
    const caseMatch = /second_activity\s*:=\s*case[\s\S]*?end\s*;/i.exec(requiredFunction.definition);
    assert.ok(caseMatch, `${requiredFunction.filename} must expose a readable default activity rotation`);

    const indexedActivities = [...caseMatch[0].matchAll(/when\s+(\d+)\s+then\s+'([^']+)'/gi)]
        .map(match => [Number(match[1]), match[2]]);
    const elseMatch = /else\s+'([^']+)'/i.exec(caseMatch[0]);
    assert.ok(elseMatch, `${requiredFunction.filename} default activity rotation must include an else case`);
    const serverRotation = indexedActivities
        .sort(([left], [right]) => left - right)
        .map(([, activityId]) => ['flashcards', activityId]);
    serverRotation.push(['flashcards', elseMatch[1]]);

    assert.deepEqual(summative, DEFAULT_REQUIRED_BY_PURPOSE.summative);
    assert.deepEqual(serverRotation, DEFAULT_PRACTICE_REQUIRED_ROTATION);
});
