import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
import {randomUUID} from 'node:crypto'

test('ornament event gates voting by exact approved file and protects private records',async()=>{
 const db=new PGlite()
 try{
  await db.exec('create role anon;create role authenticated')
  await db.exec(await readFile(new URL('../supabase/migrations/20261124011500_ornament_gallery.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261124160000_ornament_repairs.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261125123000_ornament_additions.sql',import.meta.url),'utf8'))
  // Keep exercising approval withdrawal when every real exhibit is eligible.
  await db.exec("update ornament_gallery.model set approved=false where id='6C-001'")
  const key=(await db.query("select code from ornament_gallery.class_code where section='6B'")).rows[0].code
  const teacher=(await db.query("insert into ornament_gallery.teacher_code(event_id) values('christmas-2026') returning code")).rows[0].code
  await db.exec('set role anon')
  const rows=(await db.query('select public.ornament_catalog() items')).rows[0].items
  const files=JSON.parse(await readFile(new URL('../view-models/catalog.json',import.meta.url),'utf8'))
  assert.deepEqual(rows.map(x=>x.id+x.asset).sort(),files.map(x=>x.id+x.asset).sort())
  const valid=rows.find(x=>x.eligible), denied=rows.find(x=>!x.eligible),id=randomUUID()
  const vote=(m,score,credential=null)=>db.query('select public.ornament_rate($1,$2,$3,$4,$5)',[m.id,m.asset,id,score,credential])
  for(const score of [1,5,10])await vote(valid,score)
  await vote(valid,8,teacher)
  for(const args of [[denied,5],[{...valid,asset:'unknown'},5],[valid,0],[valid,11],[valid,5,randomUUID()]])await assert.rejects(vote(...args))
  const mine=async(code=null)=>(await db.query('select public.ornament_my_ratings($1,$2) scores',[id,code])).rows[0].scores
  assert.equal((await mine())[valid.id],10);assert.equal((await mine(teacher))[valid.id],8)
  await assert.rejects(db.query('select * from ornament_gallery.vote'))
  await assert.rejects(db.query('select * from ornament_gallery.claim'))
  const claim=model=>db.query('select public.ornament_claim($1,$2,$3,$4,$5)',[model,key,'Private student','Twilight',''])
  await assert.rejects(claim('6C-001'));await claim('6B-001')
  await assert.rejects(db.query('select ornament_gallery.review_claim(1,true)'))
  await db.exec('reset role;select ornament_gallery.review_claim(1,true)')
  assert.equal((await db.query("select title from ornament_gallery.model where id='6B-001'")).rows[0].title,'Twilight')
  await db.query('update ornament_gallery.model set approved=false where id=$1',[valid.id])
  await db.exec('set role anon');await assert.rejects(vote(valid,6));assert.deepEqual(await mine(),{})
  await db.exec("reset role;delete from ornament_gallery.event where id='christmas-2026'")
  for(const table of ['vote','claim','model','teacher_code','class_code'])assert.equal((await db.query('select * from ornament_gallery.'+table)).rows.length,0)
 }finally{await db.close()}
})
