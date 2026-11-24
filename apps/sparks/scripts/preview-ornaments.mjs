// A loopback-only gallery preview with the event migration running in PostgreSQL WASM.
import { PGlite } from '@electric-sql/pglite'
import { createServer } from 'vite'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=fileURLToPath(new URL('../',import.meta.url))
const port=Number(process.env.ORNAMENT_PORT||4386)
const origin='http://127.0.0.1:'+port
const dir=process.env.ORNAMENT_DB_DIR||path.join(homedir(),'.local/share/sparks/ornament-gallery-local')
await mkdir(dir,{recursive:true,mode:0o700})
const db=new PGlite(dir)
const {rows}=await db.query("select to_regnamespace('ornament_gallery') is null as fresh")
if(rows[0].fresh){
  await db.transaction(async tx=>{
    await tx.exec('create role anon;create role authenticated')
    await tx.exec(await readFile(path.join(root,'supabase/migrations/20261124011500_ornament_gallery.sql'),'utf8'))
    await tx.exec("insert into ornament_gallery.teacher_code(event_id) values ('christmas-2026')")
  })
}
const classes=(await db.query("select section,code from ornament_gallery.class_code order by section")).rows
const teachers=(await db.query("select code from ornament_gallery.teacher_code")).rows
const access=['# Local ornament gallery access','',...classes.map(c=>c.section+' claim code: '+c.code),'',...teachers.map(t=>'Teacher ballot code: '+t.code)]
await writeFile(path.join(dir,'local-access.md'),access.join('\n')+'\n',{mode:0o600})
const calls={
  catalog:[],my_ratings:['voter_id','teacher_key'],rate:['model_id','asset_key','voter_id','rating','teacher_key'],
  claim:['model_id','class_key','student_name','model_title','public_credit']
}
const server=await createServer({root,define:{
  'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(origin),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('local-preview')
},server:{port,strictPort:true,host:'127.0.0.1'},plugins:[{
  name:'ornament-local-rpc',configureServer(vite){
    vite.middlewares.use('/rest/v1/rpc/',async(req,res)=>{
      const fn=req.url.slice(1).replace(/^ornament_/,'')
      res.setHeader('Content-Type','application/json')
      if(req.method!=='POST'||!Object.hasOwn(calls,fn)||req.headers.host!=='127.0.0.1:'+port||req.headers.origin&&req.headers.origin!==origin){
        res.statusCode=403;res.end('{}');return
      }
      try{
        let text='';for await(const chunk of req){text+=chunk;if(text.length>4096)throw Error('Request too large')}
        const body=JSON.parse(text),keys=calls[fn]
        const result=await db.transaction(async tx=>{
          await tx.exec('set local role anon')
          return tx.query('select public.ornament_'+fn+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') as value',keys.map(k=>body[k]??null))
        })
        res.end(JSON.stringify(result.rows[0].value??null))
      }catch(err){res.statusCode=400;res.end(JSON.stringify({message:err.message}))}
    })
  }
}]})
await server.listen()
console.log('Ornament gallery at '+origin+'/view-models/')
