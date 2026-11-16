import {learningResultsRepository} from './services/learningResultsRepository.js';
import {ACTIVITIES,fail,integer,canonical} from './learningResults/contract.js';
import {generateLayout} from './learningResults/task.js';
const labels={'flashcards':'Flashcards','matching':'Matching','scramble':'Scramble','wordle':'Wordle','hangman':'Hangman','fill-in-blank':'Fill in Blank','crossword':'Crossword','word-search':'Word Search','quiz':'Quiz','synonym-antonym':'Synonym and Antonym','speed-match':'Speed Match','reading-check':'Reading check'};
export class TeacherLearningSettings {
    constructor({repository=learningResultsRepository,owner,source,grade,activity,newSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0] || 1}) {Object.assign(this,{repository,owner,source,grade,activity,newSeed});this.snapshot=null;}
    async load(options={}) {
        integer(this.grade,1,12);if(!ACTIVITIES.includes(this.activity))fail('INVALID_ACTIVITY');
        const owner=this.owner();
        const snapshot=await this.repository.read({mode:'authoring',source:this.source,grade:this.grade,activity:this.activity},owner,{...options,teacher:true});
        if(owner!==this.owner())fail('OWNER_CHANGED');this.snapshot=snapshot;return snapshot;
    }
    async publish({targetSeconds,appearances=5,enabled=true},options={}) {
        if(!this.snapshot)fail('SOURCE_REQUIRED');integer(targetSeconds,1,86400);integer(appearances,1,20);
        const snapshot=this.snapshot,owner=this.owner();
        const sameWords=snapshot.task && canonical(snapshot.task.words.map(w=>[w.id,w.word]))===canonical(snapshot.scoredContent.words.map(w=>[w.id,w.word]));
        const layouts=['crossword','word-search'].includes(this.activity)?sameWords?snapshot.task.variants:[generateLayout({words:snapshot.scoredContent.words,activity:this.activity,seed:this.newSeed()})]:[];
        const result=await this.repository.operation('settings',{contractVersion:'learning-results-v1',source:this.source,grade:this.grade,activity:this.activity,
            expectedRevision:snapshot.settings?.revision || 0,sourceDigest:snapshot.source.sourceDigest,sharedTargetMilliseconds:targetSeconds*1000,
            appearances,layoutCandidates:layouts,enabled},owner,options);
        if(owner!==this.owner())fail('OWNER_CHANGED');
        this.snapshot={...snapshot,settings:{...snapshot.settings,revision:result.revision,published_task_id:result.taskId,shared_target_milliseconds:targetSeconds*1000,appearances,enabled}};return result;
    }
    async setTarget({studentId,target,expectedRevision=0},options={}) {
        if(target!==null)integer(target,1,100);integer(expectedRevision);
        const owner=this.owner();const result=await this.repository.operation('target',{contractVersion:'learning-results-v1',source:this.source,grade:this.grade,studentId,activity:this.activity,expectedRevision,target},owner,options);if(owner!==this.owner())fail('OWNER_CHANGED');return result;
    }
}
const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
export function mountLearningResultsSettings({root,source,grades,getOwner,isCurrent=()=>true,activities=ACTIVITIES.filter(id=>id!=='reading-check'),repository=learningResultsRepository}) {
    let request=0,model=null,destroyed=false;
    const section=node('section'),heading=node('h3','Game scores and rankings'),description=node('p','Accuracy provides up to 950 points. Answer speed provides up to 50 points. Students in the same grade use the same speed target for this content.'),form=node('form'),status=node('p');
    status.setAttribute('role','status');
    function select(label,values){const wrapper=node('label',label),control=node('select');for(const [value,text] of values){const option=node('option',text);option.value=String(value);control.append(option);}wrapper.append(control);form.append(wrapper);return control;}
    function numeric(label,min,max){const wrapper=node('label',label),control=node('input');control.type='number';control.min=String(min);control.max=String(max);control.step='1';control.required=true;wrapper.append(control);form.append(wrapper);return control;}
    const grade=select('Grade',grades.map(value=>[value,`Grade ${value}`])),activity=select('Activity',activities.map(value=>[value,labels[value] || value]));
    const seconds=numeric('Shared speed target in seconds',1,86400),repetitions=numeric('Scheduled appearances per word',1,20),enabledLabel=node('label','Enable scores for new attempts '),enabled=node('input');enabled.type='checkbox';enabledLabel.append(enabled);form.append(enabledLabel);
    const affected=node('p'),save=node('button','Publish settings');save.type='submit';save.className='btn primary-btn';form.append(affected,save);const timing=node('p'),targets=node('section');section.append(heading,description,form,timing,targets,status);root.append(section);
    const current=(id,owner)=>!destroyed && id===request && isCurrent() && owner===getOwner();
    async function load(){const id=++request,owner=getOwner();save.disabled=true;targets.replaceChildren();timing.textContent='';status.textContent='Loading scoring settings…';
        model=new TeacherLearningSettings({repository,owner:getOwner,source,grade:Number(grade.value),activity:activity.value});
        try {const snapshot=await model.load();if(!current(id,owner))return;
            seconds.value=snapshot.settings?.shared_target_milliseconds?String(snapshot.settings.shared_target_milliseconds/1000):'';
            repetitions.value=String(snapshot.settings?.appearances || 5);repetitions.parentElement.hidden=!['matching','speed-match'].includes(activity.value);
            enabled.checked=snapshot.settings?.enabled===true;
            affected.textContent=`Shared sections: ${(snapshot.affectedSections || []).map(section=>section.name).join(', ') || 'This grade and content set'}. Changing the speed target or scored content starts a new leaderboard.`;
            const count=snapshot.timing?.finishedAttempts || 0;
            timing.textContent=count?`${count} finished attempts. Median scored answer time: ${Math.ceil(snapshot.timing.medianMilliseconds/1000)} seconds.`:'Timing suggestions will appear after students finish scored attempts.';
            targets.append(node('h4','Individual passing targets'),node('p','The default is 80%. Changing a passing target does not change points or the shared speed target. Leave blank to use the default.'));
            const loadedModel=model;
            for(const student of snapshot.students || []) {
                const row=node('form'),label=node('label',student.name),input=node('input'),button=node('button','Save target'),feedback=node('span');
                input.type='number';input.min='1';input.max='100';input.step='1';input.placeholder='80';input.value=student.target===null?'':String(student.target);button.type='submit';button.className='btn secondary-btn';feedback.setAttribute('role','status');label.append(input);row.append(label,button,feedback);targets.append(row);
                let revision=student.revision;
                row.addEventListener('submit',async event=>{event.preventDefault();if(button.disabled || !current(id,owner))return;button.disabled=true;feedback.textContent='Saving…';
                    try {const result=await loadedModel.setTarget({studentId:student.studentId,target:input.value===''?null:Number(input.value),expectedRevision:revision});if(current(id,owner)){revision=result.revision;feedback.textContent='Target saved for new attempts.';}}
                    catch{if(current(id,owner))feedback.textContent='Could not save. Reload settings to check the current target.';}
                    finally{if(current(id,owner))button.disabled=false;}
                });
            }
            status.textContent='Choose a time students can reasonably complete the scored answers. You can adjust it after reviewing their results.';save.disabled=false;
        }catch(error){if(current(id,owner))status.textContent=error.message==='NO_SCORED_QUESTIONS'?'This reading check has no multiple-choice score.':error.message==='WORD_UNPLAYABLE'?'Every selected word needs usable answers before this activity can be scored.':'These scoring settings could not be loaded. Reopen the assignment to try again.';}
    }
    form.addEventListener('submit',async event=>{event.preventDefault();if(save.disabled || !model)return;const id=request,owner=getOwner();save.disabled=true;status.textContent='Publishing settings…';
        try {await model.publish({targetSeconds:Number(seconds.value),appearances:Number(repetitions.value || 5),enabled:enabled.checked});if(current(id,owner))status.textContent='Settings published. Existing attempts keep their saved settings.';}
        catch(error){if(current(id,owner))status.textContent=/CONFLICT|SOURCE_CHANGED/.test(error.message)?'The content or settings changed. Select the activity again to load the latest version.':error.code==='LAYOUT_GENERATION_FAILED'?'A complete puzzle could not be made with these words. Edit the word list and publish a new assignment.':'Settings could not be published. Your previous settings are still saved.';}
        finally{if(current(id,owner))save.disabled=false;}
    });
    grade.addEventListener('change',load);activity.addEventListener('change',load);void load();
    return {destroy(){destroyed=true;request++;section.remove();}};
}

export function mountAssignmentLearningSettings({root,source,getOwner,isCurrent=()=>true,activities,repository=learningResultsRepository}) {
    let destroyed=false,child=null;const owner=getOwner(),loading=node('p','Loading game scoring controls…');loading.setAttribute('role','status');root.append(loading);
    void repository.read({mode:'grades',source},owner,{teacher:true}).then(snapshot=>{
        if(destroyed || !isCurrent() || owner!==getOwner())return;
        loading.textContent='';if(!snapshot.grades?.length){loading.textContent='Add students with a school grade to configure game scores.';return;}
        child=mountLearningResultsSettings({root,source,grades:snapshot.grades,getOwner,isCurrent,activities,repository});
    }).catch(()=>{if(!destroyed && isCurrent() && owner===getOwner())loading.textContent='Game scoring controls are unavailable. Reopen the assignment to try again.';});
    return {destroy(){destroyed=true;child?.destroy();loading.remove();}};
}
