import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

for (const endpoint of ['create-student-account', 'reset-student-password']) {
 test(`${endpoint} executes retired handler without account lookup or mutation`, async () => {
  const file = new URL(`../supabase/functions/${endpoint}/index.ts`, import.meta.url);
  const original = readFileSync(file, 'utf8');
  // The only omitted import is the Edge Runtime type declaration. Execute the
  // actual handler source with native Request/Response and deny every I/O API.
  const declaration = /^import "@supabase\/functions-js\/edge-runtime\.d\.ts";\s*/;
  assert.match(original, declaration);
  const executable = stripTypeScriptTypes(original.replace(declaration, ''));
  let handler;
  let attemptedIO = 0;
  const denyIO = () => { attemptedIO += 1; throw new Error('Retired endpoint attempted external I/O'); };
  runInNewContext(executable, {
   Request, Response, Headers,
   fetch: denyIO,
   Deno: Object.freeze({
    serve: (callback) => { assert.equal(handler, undefined); handler = callback; },
    env: Object.freeze({ get: denyIO, toObject: denyIO }),
    open: denyIO, readFile: denyIO, writeFile: denyIO, connect: denyIO,
   }),
  }, { filename: file.pathname, timeout: 1000 });
  assert.equal(typeof handler, 'function');
  for (const authorization of ['', 'Bearer forged-school-admin', 'Bearer legacy-token']) {
   const response = await handler(new Request(`http://local.test/${endpoint}`, {
    method: 'POST', headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ studentId: 'other-account', password: 'never-used', email: 'recipient@example.invalid', app_metadata: { school_admin: true } }),
   }));
   assert.equal(response.status, 410);
   assert.equal((await response.json()).code, 'SCHOOL_ACCOUNT_RECOVERY_REQUIRED');
  }
  assert.equal((await handler(new Request(`http://local.test/${endpoint}`, { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handler(new Request(`http://local.test/${endpoint}`, { method: 'GET' }))).status, 405);
  assert.equal(attemptedIO, 0, 'No secret access, account lookup, or network mutation is allowed');
 });
}
