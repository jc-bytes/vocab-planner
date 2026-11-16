import {node,button,textInput,formSubmit} from './games/ui.js';
import {choiceGame} from './games/choice.js';
import {spellingGame} from './games/spelling.js';
import {matchingGame} from './games/matching.js';
import {speedMatchGame} from './games/speedMatch.js';
import {puzzleGame} from './games/puzzles.js';
import {normalizeSpelling} from './scoring.js';
import {mountLearningResult} from './presenter.js';
import {bindLearningVisibility} from './lifecycle.js';
import '../../css/learning-results.css';
export class VocabularyLearningRuntime {
    constructor({root,session,coordinator,onSaved=()=>{},isCurrent=()=>true,onRetry}){
        Object.assign(this,{root,session,coordinator,onSaved,isCurrent,onRetry});this.busy=false;this.destroyed=false;this.pendingDraft=null;this.cleanup=null;this.resultView=null;this.flashcardStudy=null;
        this.body=node('div',undefined,'learning-game');this.status=node('p');this.status.setAttribute('role','status');this.combo=node('p',undefined,'learning-combo');this.combo.setAttribute('role','status');root.replaceChildren(this.status,this.combo,this.body);
        this.lifecycle=bindLearningVisibility({session,root:this.body,isCurrent:()=>this.current(),onError:error=>this.error(error),onHide:()=>this.cleanup?.(),onResume:()=>this.render()});
    }
    current(){return !this.destroyed && this.isCurrent();}
    error(error){if(this.current())this.status.textContent=error?.code==='OWNER_CHANGED'?'Sign in again to continue your saved activity.':'Your last change could not be saved. Try again before continuing.';}
    saved(){this.onSaved();}
    draftFor(opportunity){return (this.pendingDraft || this.session.attempt.state.draft).games?.[opportunity.id] || {};}
    saveDraft(opportunity,value){this.pendingDraft={...(this.pendingDraft || this.session.attempt.state.draft),games:{...(this.pendingDraft || this.session.attempt.state.draft).games,[opportunity.id]:value}};this.scheduleDraft();}
    savePuzzle(value){this.pendingDraft={...(this.pendingDraft || this.session.attempt.state.draft),puzzle:{...value}};this.scheduleDraft();}
    scheduleDraft(){clearTimeout(this.draftTimeout);this.draftTimeout=setTimeout(()=>void this.flushDraft().catch(error=>this.error(error)),250);}
    async flushDraft(){clearTimeout(this.draftTimeout);if(this.pendingDraft){const value=this.pendingDraft;this.pendingDraft=null;try{await this.session.draft(value);this.saved();}catch(error){if(!this.pendingDraft)this.pendingDraft=value;throw error;}}await this.session.tail;}
    async persistDraft(opportunity,value){this.saveDraft(opportunity,value);await this.flushDraft();}
    async run(action){if(!this.current() || this.busy)return;this.busy=true;this.root.setAttribute('aria-busy','true');const controls=[...this.body.querySelectorAll('button,input,textarea')].filter(el=>!el.disabled);controls.forEach(el=>el.disabled=true);
        try{await this.flushDraft();if(this.current())await action();}catch(error){this.error(error);if(this.session.attempt.state.phase==='answer' && !this.body.hidden)this.session.timer.resume();}finally{this.busy=false;this.root.removeAttribute('aria-busy');for(const el of controls)if(el.isConnected)el.disabled=false;}}
    answer(opportunity,response){if(!this.current() || this.busy)return;this.session.timer.pause();return this.run(()=>this.record(opportunity,response));}
    async record(opportunity,response){await this.session.original(opportunity.id,response);this.saved();await this.render();}
    hint(opportunity,text,ids=[opportunity.id]){return this.run(async()=>{
        await this.session.assist(ids);this.saved();this.cleanup?.();this.body.replaceChildren(node('h3','Clue'),node('p',text),button('Return to the activity',()=>this.run(async()=>{await this.session.resume();await this.render();})));this.status.textContent='Answer time is paused. Answers helped by this clue can earn up to half credit.';
    });}
    async render(){
        if(!this.current())return;this.cleanup?.();this.cleanup=null;this.resultView?.destroy();this.resultView=null;this.body.replaceChildren();
        const attempt=this.session.attempt;
        if(attempt.confirmed || attempt.status==='submitted'){await this.showResult();return;}
        const originals=Object.values(attempt.state.originals),combo=this.session.combo();
        this.combo.classList.toggle('learning-combo-celebrate',combo.celebrations.at(-1)===combo.current);
        this.combo.textContent=combo.current?`${combo.current} correct in a row${combo.celebrations.at(-1)===combo.current?'!':''}. Longest combo: ${combo.longest}.`:`Longest combo: ${combo.longest}.`;
        this.status.textContent=`${originals.length} of ${attempt.schedule.length} original answers saved. Passing target: ${attempt.passingTarget}%.`;
        const allOriginals=originals.length===attempt.schedule.length;
        const missed=attempt.schedule.find(o=>attempt.state.originals[o.id] && !attempt.state.originals[o.id].correct && !Object.hasOwn(attempt.state.corrections,o.id));
        if(missed && (attempt.task.activity!=='crossword' || allOriginals)){this.renderCorrection(missed);return;}
        if(allOriginals){this.body.append(node('h3','The full set is finished'),node('p','Your first answers determine your score. Corrections do not change it.'),button('See my result',()=>this.run(async()=>{await this.session.submit();this.saved();await this.showResult();})));return;}
        const opportunity=attempt.schedule.find(o=>!attempt.state.originals[o.id]),word=attempt.task.words.find(w=>w.id===opportunity.wordId);
        if(attempt.task.activity==='flashcards' && this.flashcardStudy!==opportunity.id){
            if(attempt.state.phase!=='study')await this.session.setPhase('study');this.body.append(node('h3',word.word),node('p',word.definition),node('p',word.example || ''),button('Ready for the question',()=>this.run(async()=>{this.flashcardStudy=opportunity.id;await this.session.resume();await this.render();})));return;
        }
        if(attempt.state.phase!=='answer')await this.session.resume();if(!this.current())return;
        if(['quiz','synonym-antonym','flashcards'].includes(attempt.task.activity))choiceGame({root:this.body,word,opportunity,runtime:this});
        else if(['wordle','hangman','scramble','fill-in-blank'].includes(attempt.task.activity))spellingGame({root:this.body,word,opportunity,runtime:this});
        else if(attempt.task.activity==='matching')matchingGame({root:this.body,runtime:this});
        else if(attempt.task.activity==='speed-match')this.cleanup=speedMatchGame({root:this.body,word,opportunity,runtime:this});
        else this.cleanup=puzzleGame({root:this.body,runtime:this});
        if(!['crossword','word-search'].includes(attempt.task.activity))this.body.append(button('Clue',()=>this.hint(opportunity,`The word is ${word.word}. ${word.definition}`),'btn secondary-btn'));
        this.saved();
    }
    renderCorrection(opportunity){
        const word=this.session.attempt.task.words.find(w=>w.id===opportunity.wordId),form=node('form'),{wrapper,input}=textInput(`Type ${word.word} to correct this answer`),feedback=node('p');feedback.setAttribute('role','status');
        this.body.append(node('h3','Correct this word'),node('p',word.definition),node('p','Your original score is saved. Correction time does not reduce your speed score.'),form);form.append(wrapper,feedback);
        formSubmit(form,'Save correction',()=>this.run(async()=>{if(normalizeSpelling(input.value)!==normalizeSpelling(word.word)){feedback.textContent=`Type ${word.word} to continue.`;return;}await this.session.correct(opportunity.id,input.value);this.saved();await this.render();}));input.focus();
    }
    async showResult(){
        if(!this.current())return;this.cleanup?.();this.cleanup=null;this.resultView?.destroy();this.body.replaceChildren();
        const saved=await this.coordinator.store.get('learningAttempts',this.session.attempt.ownerUserId,this.session.attempt.id);if(!this.current())return;
        const confirmed=!!saved?.confirmed,result=confirmed?saved.result:this.session.preview();
        if(saved?.syncStatus==='held')this.status.textContent='This attempt could not be verified. Your answers are saved on this computer. You can start a new full attempt.';
        this.resultView=mountLearningResult({root:this.body,result,confirmed,passingTarget:this.session.attempt.passingTarget,kind:this.session.attempt.kind,onRetry:()=>this.onRetry?.(this.session.attempt.id),board:{taskId:this.session.attempt.task.id,owner:this.session.attempt.ownerUserId,getOwner:this.coordinator.owner}});
        if(!confirmed)this.body.append(button('Sync saved result',()=>this.run(async()=>{await this.coordinator.delivery.run(this.session.attempt.ownerUserId);await this.showResult();}),'btn secondary-btn'));
    }
    async destroy(){if(this.destroyed)return;this.destroyed=true;clearTimeout(this.draftTimeout);this.cleanup?.();this.resultView?.destroy();await this.flushDraft().catch(()=>{});await this.lifecycle.destroy();}
}
