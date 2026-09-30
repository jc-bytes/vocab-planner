"""Build the approved weekly catalog; never rewrite frozen Week 1 content."""
import argparse, csv, datetime as dt, json, pathlib, hashlib
root=pathlib.Path(__file__).resolve().parents[3]
p=argparse.ArgumentParser();p.add_argument('--app',type=pathlib.Path,required=True);a=p.parse_args()
proposal=json.loads((root/'reports/t3-vocabulary-review-2026-09-16/weekly-pool-proposal.json').read_text())
bank={r['word']:r for r in csv.DictReader((pathlib.Path(__file__).parent/'glossary.tsv').open(),delimiter='\t')}
base=a.app/'vocabularies';manifest=json.loads((base/'manifest.json').read_text());new=[];mapping={};calendar=[]
activities=['flashcards','matching','fill-in-blank','illustration','quiz','synonym-antonym','word-search','crossword','hangman','scramble','wordle','speed-match']
for r in proposal['rows']:
 g,w=r['grade'],r['week'];start=dt.date.fromisoformat(r['week_start']);replacements=[]
 if r['mode'] not in ['no_class','no_vocabulary']:
  variants=[('',list('ABC' if g==6 else 'AB'),r['proposed_pool'],r['mode']=='review')]
  if g==6 and w==8:variants=[('', ['C'],r['proposed_pool'],True)]
  if g==6 and w==9:variants=[('_ab',['A','B'],r['group_pools']['6A/6B'],True),('_c',['C'],r['group_pools']['6C'],False)]
  for suffix,sections,terms,review in variants:
   id=f'grade{g}_t3_2026_w{w:02}_weekly_v1{suffix}'
   offsets={6:{'A':0,'B':1,'C':2},7:{'A':2,'B':3},8:{'A':2,'B':0},9:{'A':0,'B':0}}[g].copy()
   if g==6 and w==7:offsets['B']=2
   if g==6 and w==8:offsets['C']=4
   if g==6 and w==9:offsets['B']=2
   if g==6 and w==12:offsets['C']=4
   if g==7 and w==4:offsets['B']=4
   if g==7 and w==8:offsets={'A':4,'B':4}
   if g==7 and w==12:offsets={'A':4,'B':3}
   if g==8 and w==12:offsets['A']=3
   release={s:(start+dt.timedelta(days=offsets[s])).isoformat() for s in sections}
   required=[] if review else ['flashcards','matching','fill-in-blank']
   words=[]
   for term in terms:
    b=bank[term]; example=b['example']
    if term=='function' and g==7 and w in [4,8]:example='The deliver function moves the sprite and adds one delivery.'
    words.append(dict(word=term.capitalize(),definition=b['definition'],example=example,source=b['source'],difficulty=1,synonyms=[],antonyms=[]))
   title={(6,8):'Check your measured model',(7,7):'Distance warning rule',(8,9):'Scratch controls',(9,2):'Online dangers'}.get((g,w),r['topic'])
   if suffix=='_c':title='Button counter'
   elif suffix=='_ab':title='Measured model review'
   description=('Optional review. No required vocabulary task this week. ' if review else 'Study these five words across this week. Complete Flashcards, Matching and Fill in Blank once. Then choose additional practice. ')
   description+='Reuse this pool throughout the week. Follow your separate class instructions.'
   v=dict(id=id,name=f'G{g} T3 W{w:02} - {title}',description=description,grades=[str(g)],subjectSlug='technology',trimester='3',month=start.strftime('%B'),week=w,assignedDate=min(release.values()),purpose='practice',words=words,activitySettings=dict(weeklyPoolVersion=1,sections=sections,releaseDates=release,reviewOnly=review,requiredActivities=required,additionalActivities=[x for x in activities if x not in required],flashcards=5,matching=5,fillInBlank=5))
   path=f'vocabularies/grade{g}/{id}.json';(a.app/path).write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n')
   new.append(dict(**{k:v[k] for k in v if k!='words'},path=path));replacements.append(id)
 for old in r['existing_ids']:mapping[old]=replacements
 calendar.append(dict(grade=g,week=w,week_start=r['week_start'],mode=r['mode'],units=replacements,note=r['note']))
# Preserve old words, IDs, scores and downloadable evidence. Retire future assignments.
for m in manifest['vocabularies']:
 if m['id'] not in mapping:continue
 path=a.app/m['path'];v=json.loads(path.read_text());v['activitySettings'].update(retiredWeeklySet=True,replacementIds=mapping[m['id']])
 path.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n');m['activitySettings']=v['activitySettings']
manifest['vocabularies']=[m for m in manifest['vocabularies'] if '_weekly_v1' not in m['id']]+new
(base/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
out=pathlib.Path(__file__).parent
(out/'calendar.json').write_text(json.dumps(calendar,indent=2)+'\n');(out/'replacement-map.json').write_text(json.dumps(mapping,indent=2)+'\n')
(out/'weekly-units.json').write_text(json.dumps([json.loads((a.app/m['path']).read_text()) for m in new],indent=2)+'\n')
print(f'{len(new)} weekly units; {len(mapping)} retired sets; Week 1 untouched')
