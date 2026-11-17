export function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;}
export function button(text,action,className='btn primary-btn'){const el=node('button',text,className);el.type='button';el.addEventListener('click',action);return el;}
export function textInput(label,value=''){const wrapper=node('label',label),input=node('input');input.type='text';input.autocomplete='off';input.spellcheck=false;input.value=value;wrapper.append(input);return {wrapper,input};}
export function formSubmit(root,label,action){const submit=node('button',label,'btn primary-btn');submit.type='submit';root.append(submit);root.addEventListener('submit',event=>{event.preventDefault();action();});return submit;}
