import '@ui-sdk/web/rating'
import { SUPABASE_CONFIG } from '../config/supabase-config.js'
import catalog from './catalog.json'
import './gallery.css'

const root = document.querySelector('#gallery')
const parts = location.pathname.split('/').filter(Boolean)
const start = parts.lastIndexOf('view-models')
const home = '/' + parts.slice(0,start+1).join('/') + '/'
const section = /^6[abc]$/i.test(parts[start+1]) ? parts[start+1].toUpperCase() : ''
const claimPage = parts.includes('this-is-mine')
const teachers = parts.includes('teachers')
const visible = catalog.filter(m=>!section || m.section===section)
const files = import.meta.glob('./media/*', {eager:true,query:'?url',import:'default'})
const asset = (m,ext)=>files['./media/'+m.asset+'.'+ext]
const el = (tag,text) => {const node=document.createElement(tag);if(text!=null)node.textContent=text;return node}
const metadata = new Map()
let teacherKey=''
let myRatings={}
let viewerClose
let viewerGeneration=0
let browserId
try {
  const key='ornament-2026-browser'
  browserId=localStorage.getItem(key)||crypto.randomUUID()
  localStorage.setItem(key,browserId)
} catch {browserId=crypto.randomUUID()}
async function rpc(name,args) {
  const {url,publishableKey}=SUPABASE_CONFIG
  if(!url || !publishableKey)throw Error('The gallery service is unavailable.')
  const response=await fetch(url+'/rest/v1/rpc/ornament_'+name,{method:'POST',headers:{'Content-Type':'application/json',apikey:publishableKey,Authorization:'Bearer '+publishableKey},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)})
  if(!response.ok){
    const body=await response.json().catch(()=>({}))
    throw Error(body.message==='Rating unavailable'?'Rating unavailable':'The gallery service could not save this change.')
  }
  const raw=await response.text();return raw?JSON.parse(raw):null
}
function link(text,path){const a=el('a',text);a.href=home+path;return a}
const header=el('header');header.append(link('✳  Sparks',''),el('span','Technology · Grade 6'));root.append(header)
const hero=el('section');hero.className='hero'
hero.innerHTML='<div class="lights" aria-hidden="true">✦　 ✧　 ✦</div><p>Christmas collection</p><h1>Ornament<br><i>Gallery</i></h1>'
if(claimPage)hero.querySelector('h1').textContent='This is mine'
if(teachers)hero.querySelector('h1').textContent='Teachers’ ballot'
if(!claimPage && !teachers){
  const ornament=el('img');ornament.alt='';ornament.className='cover-ornament';ornament.src=asset(catalog[0],'webp');hero.append(ornament)
}
root.append(hero)
const nav=el('nav');nav.setAttribute('aria-label','Classes')
if(!claimPage && !teachers){
  for(const name of ['All','6A','6B','6C']){
    const a=link(name,name==='All'?'':name.toLowerCase()+'/')
    if((name==='All'&&!section)||name===section)a.setAttribute('aria-current','page')
    nav.append(a)
  }
} else nav.append(link('← Public gallery',section?section.toLowerCase()+'/':''))
nav.append(link('Results','../view-results/'))
root.append(nav)
const intro=el('p',claimPage?'Find your ornament and send your claim to your teacher.':teachers?'Enter your teacher code to rate print-approved ornaments.':'Open an ornament to turn it around. Rate eligible designs from 1 to 10.')
root.append(intro)
const status=el('p');status.setAttribute('role','status');root.append(status)
if(teachers){
  const label=el('label','Teacher code');const input=el('input');input.type='password';label.append(input)
  input.addEventListener('input',()=>{teacherKey=input.value.trim();myRatings={};render()})
  input.addEventListener('change',()=>loadCatalog());root.append(label)
}
const grid=el('section');grid.className='collection';root.append(grid)
const modal=el('dialog');modal.innerHTML='<form method="dialog"><button>Close</button></form><h2></h2><div class="detail"></div>';root.append(modal)
const detail=modal.querySelector('.detail')
modal.addEventListener('close',()=>{viewerGeneration++;viewerClose?.();viewerClose=null;detail.replaceChildren()})
const title=m=>metadata.get(m.id)?.title||'Ornament '+m.id
function openModal(m){
  modal.querySelector('h2').textContent=title(m);detail.replaceChildren();modal.showModal()
}
async function inspect(m){
  openModal(m);const generation=++viewerGeneration
  const holder=el('div');holder.className='viewer';const poster=el('img');poster.src=asset(m,'webp');poster.alt=title(m);holder.append(poster);detail.append(holder)
  const msg=el('p','Loading 3D view…');detail.append(msg)
  try{
    const module=await import('./viewer.js')
    if(generation!==viewerGeneration)return
    const dispose=await module.mount(holder,asset(m,'glb'),title(m))
    if(generation!==viewerGeneration){dispose();return}
    viewerClose=dispose;msg.textContent='Drag to rotate. Use the arrow keys when the model is focused.'
  }catch{msg.textContent='Still preview. The 3D view is unavailable on this device.'}
}
function field(form,label,type,max){
  const wrap=el('label',label),input=el('input');input.type=type;input.maxLength=max;wrap.append(input);form.append(wrap);return input
}
function claim(m){
  openModal(m);const form=el('form');detail.append(form)
  const code=field(form,'Class code','password',36),name=field(form,'Your name for the teacher','text',80),proposed=field(form,'Ornament title','text',65),credit=field(form,'Public name or alias (optional)','text',40)
  for(const f of [code,name,proposed])f.required=true
  const save=el('button','Send claim'),msg=el('p');msg.setAttribute('role','status');form.append(save,msg)
  form.onsubmit=async e=>{
    e.preventDefault();save.disabled=true
    try{await rpc('claim',{model_id:m.id,class_key:code.value.trim(),student_name:name.value.trim(),model_title:proposed.value.trim(),public_credit:credit.value.trim()});form.replaceChildren(el('p','Claim received. Your teacher will review it before your title or credit appears.'))}
    catch{save.disabled=false;msg.textContent='Claim was not saved. Check your class code and connection.'}
  }
}
function rating(m){
  const wrap=el('div');wrap.className='rating'
  const label=el('strong','Your rating'),control=el('ui-rating')
  control.setAttribute('aria-label','Rate '+title(m)+' from 1 to 10');control.setAttribute('max','10')
  control.innerHTML='<template><ui-rating-item></ui-rating-item></template>';control.getValueLabel=n=>n+' out of 10'
  const message=el('small');message.setAttribute('role','status');wrap.append(label,control,message)
  let last=myRatings[m.id]??null
  if(last!==null)control.value=last
  control.addEventListener('valuechange',async e=>{
    const score=e.detail.value
    if(teachers&&!teacherKey){e.preventDefault();message.textContent='Enter your teacher code first.';return}
    control.disabled=true
    try{
      await rpc('rate',{model_id:m.id,asset_key:m.asset,voter_id:browserId,rating:score,teacher_key:teachers?teacherKey:null})
      last=score;myRatings[m.id]=score;message.textContent='Saved · '+score+'/10'
    }catch(error){
      if(error.message==='Rating unavailable'){wrap.replaceChildren(el('small','Voting is closed for this ornament.'));return}
      control.value=last;message.textContent='Rating was not confirmed. Check your connection or reload to check eligibility.'
    }finally{control.disabled=false}
  })
  return wrap
}
function render(){
  grid.replaceChildren()
  if(!visible.length){grid.append(el('p','Class '+section+' ornaments will appear here when the files are ready.'));return}
  for(const m of visible){
    const info=metadata.get(m.id)
    const card=el('article'),picture=el('button');picture.className='picture';picture.setAttribute('aria-label','View '+title(m));picture.onclick=()=>inspect(m)
    const img=el('img');img.loading='lazy';img.alt='';img.src=asset(m,'webp');picture.append(img)
    const body=el('div');body.className='body';body.append(el('small','Class '+m.section),el('h2',title(m)))
    if(info?.credit)body.append(el('p',info.credit))
    if(claimPage){const b=el('button','This is mine');b.onclick=()=>claim(m);body.append(b)}
    else if(info?.eligible===true && info.asset===m.asset)body.append(rating(m))
    else if(info)body.append(el('small','On display'))
    card.append(picture,body);grid.append(card)
  }
}
render()
async function loadCatalog(){
try{
  const keyAtRequest=teacherKey
  const [rows,saved]=await Promise.all([rpc('catalog',{}),claimPage||teachers&&!teacherKey?{}:rpc('my_ratings',{voter_id:browserId,teacher_key:teacherKey||null})])
  if(keyAtRequest!==teacherKey)return
  myRatings=saved
  metadata.clear()
  for(const r of rows)metadata.set(r.id,r)
  render()
}catch{status.textContent='You can browse every ornament. Voting information is unavailable.'}
}
loadCatalog()
