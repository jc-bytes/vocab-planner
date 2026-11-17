import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../../supabase/migrations/',import.meta.url);
// Uses real application migrations. Managed Supabase services below are explicit test fixtures.
// This proves PostgreSQL behavior, not the hosted Auth, Storage, Realtime, cron or PostgREST boundary.
export const learningPlatformFixture=`create schema extensions;create schema auth;create schema storage;
 create role anon;create role authenticated;create role service_role bypassrls;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}',raw_app_meta_data jsonb not null default '{}',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz default now(),updated_at timestamptz default now());
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 create function storage.filename(text) returns text language sql immutable as $$select (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)]$$;
 create schema realtime;create table realtime.messages(id bigint,extension text);
 create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
 create function realtime.broadcast_changes(text,text,text,text,text,record,record) returns void language plpgsql as $$begin return;end$$;
 create schema cron;create table cron.job(jobid bigint,jobname text);create table cron.job_run_details(end_time timestamptz);
 create function cron.unschedule(bigint) returns boolean language sql as $$select true$$;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
 create publication supabase_realtime;
 `;
export async function createLearningPostgres() {
const db=new PGlite({extensions:{citext,pgcrypto}});await db.waitReady;
try {
 await db.exec(learningPlatformFixture);
 let count=0;
 for(const name of (await readdir(root)).filter(n=>n.endsWith('.sql')).sort()) {
  try {await db.exec((await readFile(new URL(name,root),'utf8')).replace('create extension if not exists pg_cron;','-- pg_cron scheduling is a platform stub in this isolated test.'));count++;}catch(error){console.error(name+': '+error.message);throw error;}
 }
 return {db,migrationCount:count};
}catch(error){await db.close();throw error;}
}
