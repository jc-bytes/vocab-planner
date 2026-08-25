import { readdir, readFile } from 'node:fs/promises';

const migrationsUrl = new URL('../../supabase/migrations/', import.meta.url);

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractFunctionDefinition(sql, functionName, filename) {
    const functionPattern = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+${escapeRegExp(functionName)}\\s*\\(`,
        'ig'
    );
    const definitions = [];
    let match;

    while ((match = functionPattern.exec(sql)) !== null) {
        const parametersStart = match.index + match[0].length;
        const returnsMatch = /\)\s*returns\b/i.exec(sql.slice(parametersStart));
        if (!returnsMatch) throw new Error(`${filename} has no readable signature for ${functionName}`);
        const parameters = sql.slice(parametersStart, parametersStart + returnsMatch.index).trim();
        const remainder = sql.slice(match.index);
        const delimiterMatch = /\bas\s+(\$[A-Za-z0-9_]*\$)/i.exec(remainder);
        if (!delimiterMatch) throw new Error(`${filename} has no dollar-quoted body for ${functionName}`);
        const delimiter = delimiterMatch[1];
        const bodyStart = match.index + delimiterMatch.index + delimiterMatch[0].length;
        const bodyEnd = sql.indexOf(`${delimiter};`, bodyStart);
        if (bodyEnd < 0) throw new Error(`${filename} has no closing delimiter for ${functionName}`);
        definitions.push({
            definition: sql.slice(match.index, bodyEnd + delimiter.length + 1),
            parameters,
            startIndex: match.index
        });
        functionPattern.lastIndex = bodyEnd + delimiter.length + 1;
    }

    return definitions;
}

export function extractSqlStringArray(definition, arrayPattern, label, filename) {
    const flags = arrayPattern.flags.includes('g') ? arrayPattern.flags : `${arrayPattern.flags}g`;
    const matches = [...definition.matchAll(new RegExp(arrayPattern.source, flags))];
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
    if (unsupportedSql) throw new Error(`${filename} ${label} array contains unsupported SQL: ${unsupportedSql}`);
    if (values.length === 0 || new Set(values).size !== values.length) {
        throw new Error(`${filename} has an empty or duplicate ${label} array`);
    }
    return values;
}

export async function findLatestFunctionDefinition(functionName, createSignature, dropSignature) {
    const filenames = (await readdir(migrationsUrl)).filter(filename => filename.endsWith('.sql')).sort();
    let latest = null;

    for (const filename of filenames) {
        const sql = await readFile(new URL(filename, migrationsUrl), 'utf8');
        for (const candidate of extractFunctionDefinition(sql, functionName, filename)) {
            if (createSignature.test(candidate.parameters.replace(/\s+/g, ' '))) {
                latest = { filename, ...candidate };
            }
        }
    }

    if (!latest) throw new Error(`No migration defines ${functionName}`);

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
