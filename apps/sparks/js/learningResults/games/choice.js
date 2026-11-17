import {node,button} from './ui.js';
import {shuffle,random32} from '../task.js';
export function choiceGame({root,word,opportunity,runtime}) {
    const activity=runtime.session.attempt.task.activity;
    const prompt=activity==='synonym-antonym'?`Choose a ${word.relation} for ${word.word}.`:`Choose the definition of ${word.word}.`;
    root.append(node('h3',prompt));
    const options=shuffle(word.options,random32(((runtime.session.attempt.seed+runtime.session.attempt.schedule.indexOf(opportunity))>>>0)||1));
    for(const option of options)root.append(button(option.text,()=>runtime.answer(opportunity,{optionId:option.id}),'btn secondary-btn learning-option'));
}
