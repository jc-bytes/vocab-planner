import {VocabularyLearningRuntime} from './vocabularyRuntime.js';
import {node,button} from './games/ui.js';
export class ReadingLearningRuntime extends VocabularyLearningRuntime {
    constructor(options){super(options);this.content=options.content || {};this.section='reading';}
    async render(){
        if(!this.current())return;this.cleanup?.();this.resultView?.destroy();this.resultView=null;this.body.replaceChildren();
        const attempt=this.session.attempt;if(attempt.confirmed || attempt.status==='submitted'){await this.showResult();return;}
        const draft=this.pendingDraft || attempt.state.draft,answers={...(draft.multipleChoice || {})},writing={...(attempt.writingSnapshot?.responses || {}),...(draft.writing || {})};
        this.status.textContent='Answer every multiple-choice question and complete the written responses, then submit the whole check. Only multiple-choice answer time is scored.';this.combo.textContent='Combos appear after submission.';
        const tabs=node('div');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Reading check sections');
        for(const [id,label] of [['reading','Read'],['multiple-choice','Multiple choice'],['writing','Written responses']]){if(id==='writing' && !attempt.task.writingQuestions?.length)continue;const control=button(label,()=>this.run(async()=>{await this.flushDraft();this.section=id;await this.render();}),'btn secondary-btn');control.setAttribute('aria-pressed',String(this.section===id));tabs.append(control);}this.body.append(tabs);
        if(this.section==='multiple-choice'){
            if(attempt.state.phase!=='answer')await this.session.resume();
            for(const opportunity of attempt.schedule){const word=attempt.task.words.find(w=>w.id===opportunity.wordId),group=node('fieldset'),legend=node('legend',word.word);group.append(legend);
                for(const option of word.options){const label=node('label',option.text),input=node('input');input.type='radio';input.name=`learning-${attempt.id}-${opportunity.id}`;input.value=option.id;input.checked=answers[opportunity.id]?.optionId===option.id;input.addEventListener('change',()=>{answers[opportunity.id]={optionId:option.id};this.pendingDraft={...(this.pendingDraft || this.session.attempt.state.draft),multipleChoice:{...answers}};this.scheduleDraft();});label.prepend(input);group.append(label);}this.body.append(group);}
        }else{
            if(attempt.state.phase!==this.section)await this.session.setPhase(this.section);
            if(this.section==='reading'){this.body.append(node('h3',this.content.title || 'Read this Spark'),node('p',this.content.sparkText || this.content.spark_text || ''));if(this.content.whyItMatters)this.body.append(node('p',this.content.whyItMatters));}
            else for(const question of attempt.task.writingQuestions || []){const label=node('label',question.prompt),input=node('textarea');input.minLength=12;input.maxLength=3000;input.required=true;input.value=writing[question.id] || '';input.addEventListener('input',()=>{writing[question.id]=input.value;this.pendingDraft={...(this.pendingDraft || this.session.attempt.state.draft),writing:{...writing}};this.scheduleDraft();});label.append(input);this.body.append(label);}
        }
        this.body.append(button('Submit whole reading check',()=>this.run(async()=>{
            await this.flushDraft();const saved=this.session.attempt.state.draft,choices=saved.multipleChoice || {},responses={...(this.session.attempt.writingSnapshot?.responses || {}),...(saved.writing || {})};
            if(attempt.schedule.some(o=>!choices[o.id])){this.status.textContent='Choose an answer for every multiple-choice question before submitting.';return;}
            if((attempt.task.writingQuestions || []).some(q=>[...(responses[q.id] || '').trim()].length<12)){this.status.textContent='Complete every written response with at least 12 characters before submitting.';return;}
            this.session.timer.pause();const writingRevisionId=attempt.task.writingQuestions?.length?await this.session.stageWriting(responses):null;
            await this.session.submitReading({responses:choices,writingRevisionId});this.saved();await this.showResult();
        })));
        this.saved();
    }
    async showResult(){await super.showResult();if(!this.current())return;
        const list=node('ol');for(const opportunity of this.session.attempt.schedule){const outcome=this.session.attempt.state.originals[opportunity.id],word=this.session.attempt.task.words.find(w=>w.id===opportunity.wordId);if(outcome)list.append(node('li',`${word.word}: ${outcome.correct?'Correct':'Review this answer'}.`));}this.body.append(list);
        const combo=this.session.combo();this.combo.textContent=`Longest combo: ${combo.longest}.`;
    }
}
