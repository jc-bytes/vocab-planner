import {learningResultsRepository} from './services/learningResultsRepository.js';
import {scoredTime,weightedPercent} from './learningResults/presenter.js';
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
function button(label,action){const el=node('button',label);el.type='button';el.className='btn secondary-btn';el.addEventListener('click',action);return el;}
export function mountTeacherLearningResults({root,classId,assignmentId,roster,getOwner,isCurrent=()=>true,repository=learningResultsRepository}){
 let destroyed=false,generation=0,cursor=null,rows=[];const owner=getOwner(),section=node('section'),heading=node('h3','Game point results'),status=node('p'),table=node('table'),body=node('tbody'),more=button('Load more results',()=>load()),refresh=button('Refresh game results',()=>load(true)),evidence=node('section');
 status.setAttribute('role','status');more.hidden=true;const names=new Map(roster.map(student=>[student.studentId,student.name]));
 const header=node('tr');for(const title of ['Student','Activity','Points','Accuracy','Answer time','Passing target','Status','Support','Details']){const th=node('th',title);th.scope='col';header.append(th);}const head=node('thead');head.append(header);table.append(head,body);section.append(heading,status,table,more,refresh,evidence);root.append(section);
 const current=id=>!destroyed && id===generation && owner===getOwner() && isCurrent();
 async function inspect(row){const id=++generation;evidence.replaceChildren(node('h4',`${names.get(row.user_id) || 'Student'}: ${row.activity_type}`),node('p','Loading saved answers…'));more.disabled=refresh.disabled=true;
  try{const snapshot=await repository.read({mode:'evidence',classId,attemptId:row.id},owner,{teacher:true});if(!current(id))return;
   evidence.replaceChildren(node('h4','Saved answers and corrections'));const list=node('ol');evidence.append(list);let after=0,hasMore=true;
   while(hasMore){const page=await repository.read({mode:'evidence',classId,attemptId:row.id,afterSequence:after,expectedRevision:snapshot.revision},owner,{teacher:true});if(!current(id))return;if(page.status==='refresh_required'){evidence.append(node('p','This attempt changed. Reopen its details to see the latest saved answers.'));return;}
    for(const event of page.events){
     if(event.type==='original'){const opportunityId=event.opportunityId,word=snapshot.task.words.find(w=>w.id===opportunityId.replace(/:\d+$/,'')),response=event.response;let answer=response.answer ?? response.guesses?.join(', ') ?? response.letters?.join(', ');
      if(response.optionId)answer=word?.options?.find(o=>o.id===response.optionId)?.text;
      if(response.selectedDefinitionId)answer=snapshot.task.words.find(w=>w.id===response.selectedDefinitionId)?.definition;
      if(response.selectedWordId)answer=snapshot.task.words.find(w=>w.id===response.selectedWordId)?.word;
      if(response.missed)answer='Missed';if(response.path)answer='Word found in the grid';list.append(node('li',`${word?.word || 'Word'}: ${answer || 'Blank answer'}${event.assisted?' (clue used)':''}. Answer time ${scoredTime(event.recordedMilliseconds)}.`));
     }else if(event.type==='correction')list.append(node('li',`Correction saved: ${event.answer}.`));
     else if(event.type==='reading-submission')for(const [id,response] of Object.entries(event.responses)){const word=snapshot.task.words.find(w=>id===`${w.id}:0`);list.append(node('li',`${word?.word || 'Question'}: ${word?.options?.find(o=>o.id===response.optionId)?.text || 'Submitted'}.`));}
    }
    hasMore=page.hasMore;after=page.nextAfterSequence;
   }
   if(!list.children.length)evidence.append(node('p','No scored answers have been synced yet.'));
  }catch{if(current(id))evidence.append(node('p','Saved answers could not be loaded. Try opening them again.'));}
  finally{if(current(id))more.disabled=refresh.disabled=false;}
 }
 function render(){body.replaceChildren();for(const row of rows){const tr=node('tr'),accuracy=row.weighted_numerator!==null && row.weighted_numerator!==undefined?`${weightedPercent({numerator:row.weighted_numerator,denominator:row.weighted_denominator})}%`:'Pending',state=row.full_task_finished_at?(row.passed?'Passed':'Full set finished'):row.validation_status==='original_locked'?'Corrections pending':'In progress';
  for(const value of [names.get(row.user_id) || 'Student',row.activity_type,row.points===null?'Pending':`${row.points} / 1000`,accuracy,scoredTime(row.recorded_milliseconds),`${row.target}%`,state,row.help?'Help recommended':''])tr.append(node('td',value));const details=node('td');details.append(button('View saved answers',()=>inspect(row)));tr.append(details);body.append(tr);}table.hidden=!rows.length;more.hidden=!cursor;}
 async function load(reset=false){const id=++generation;if(reset){rows=[];cursor=null;evidence.replaceChildren();render();}more.disabled=refresh.disabled=true;status.textContent='Loading game results…';try{const response=await repository.read({mode:'results',classId,assignmentId,afterId:cursor,limit:50},owner,{teacher:true});if(!current(id))return;rows.push(...response.results);cursor=response.nextAfterId;render();status.textContent=rows.length?'Points use the original answers. Passing status includes the required corrections.':'No game point results have been synced for this assignment.';}catch{if(current(id))status.textContent='Game results could not be loaded. Refresh to try again.';}finally{if(current(id))more.disabled=refresh.disabled=false;}}
 void load(true);return {destroy(){destroyed=true;generation++;section.remove();}};
}
