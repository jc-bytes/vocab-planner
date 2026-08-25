import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DEFAULT_PRACTICE_REQUIRED_ROTATION,
    DEFAULT_REQUIRED_BY_PURPOSE
} from '../js/activityFlowPolicy.js';
import { getStudentActivityIds } from '../js/student/studentActivityRegistry.js';
import {
    extractSqlStringArray,
    findLatestFunctionDefinition
} from './helpers/sql-migration-functions.mjs';

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
