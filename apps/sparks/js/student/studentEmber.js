import { openSpotlight } from '../activities/emberSpotlight.js';
import { watchEmberIdle } from '../activities/emberIdle.js';
import { readStudentValue, writeStudentValue } from './persistence/studentStorage.js';
import { ACTIVITY_EMBER_PLANS, SCREEN_EMBER_PLANS, resolveEmberSteps, resolveNextWorkSteps, isEmberTargetVisible } from './studentEmberPlans.js';
import '../../css/ember.css';

export class StudentEmber {
 constructor({sm,root,type,instance=null}) {
  this.sm=sm;this.root=root;this.type=type;this.instance=instance;this.disposed=false;
  this.key=`ember-guide:${instance ? sm.activities?.getUnitProgressKey(sm.currentVocab) || sm.currentVocab?.id || '' : 'screen'}:${type}`;
  try {this.preferences=JSON.parse(readStudentValue(this.key)||'{}');}catch{this.preferences={};}
  this.help=document.createElement('button');this.help.type='button';this.help.className='btn secondary-btn ember-context-help';this.help.textContent='What’s next?';this.help.setAttribute('aria-haspopup','dialog');
  this.help.addEventListener('click',()=>this.show());
  this.host=document.querySelector('.student-top-bar .student-sidebar-context');
  this.host?.prepend(this.help);
  this.idle=watchEmberIdle({container:root,emberHelpButton:this.help,
   get guideSkipped(){return Boolean(this.controller.preferences.skipped || this.controller.blocked());},
   get currentIndex(){return this.controller.round();},
   getScore:()=>({isComplete:this.complete()}),showGuide:()=>this.show(),controller:this});
  this.observer=new MutationObserver(records=>{
   if(records.every(record=>record.target.closest?.('.ember-screen-toolbar,.ember-retry-offer,.ember-idle-prompt')))return;
   this.schedule();
  });
  this.observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled','aria-busy']});
  this.onInput=()=>this.schedule();root.addEventListener('input',this.onInput);root.addEventListener('click',this.onInput);
  this.schedule();
 }
 save(){try{writeStudentValue(this.key,JSON.stringify(this.preferences));}catch{/* Help still works if storage is unavailable. */}}
 round(){return `${this.instance?.currentIndex ?? this.instance?.currentWordIndex ?? this.instance?.roundsCompleted ?? 0}`;}
 complete(){return Boolean(this.instance?.getScore?.()?.isComplete);}
 blocked(){
  return this.disposed || !isEmberTargetVisible(this.root) || this.root.getAttribute('aria-busy')==='true'
   || Boolean(this.instance?.isPlaying) || Boolean(this.root.querySelector('iframe'))
   || Boolean([...this.root.querySelectorAll('.modal:not(.hidden)')].find(isEmberTargetVisible));
 }
 schedule(){if(!this.pending&&!this.disposed)this.pending=setTimeout(()=>{this.pending=null;this.refresh();},80);}
 mistakes(){
  if(this.type==='fill-in-blank'||this.type==='scramble')return Number(this.instance?.attempts)||0;
  if(this.type==='matching')return Math.max(0,(this.instance?.roundAttempts||0)-(this.instance?.getCurrentRoundMatchedCount?.()||0));
  return 0;
 }
 steps(){
  if(this.complete())return resolveEmberSteps(document,[{selector:'#back-to-menu-btn',pose:'complete',title:'Activity complete',message:'You finished this activity. Choose Back to see your activities.',action:'Done'}]);
  const summary=this.root.querySelector('.quiz-summary,.scramble-summary,.completion-screen,.wordle-completion,.word-hunt-completion');
  if(isEmberTargetVisible(summary))return resolveEmberSteps(this.root,[{selector:'.activity-result-heading,.quiz-summary h2,.scramble-summary h2,.completion-screen h2,.wordle-completion h2,.word-hunt-completion h2',pose:'calm',title:'Review your result',message:'Read your result. Use the available review or replay controls to continue.',action:'Got it'}]);
  const nextWork=resolveNextWorkSteps(this.root,this.type);
  if(nextWork!==null)return nextWork;
  let plan=ACTIVITY_EMBER_PLANS[this.type] || SCREEN_EMBER_PLANS[this.type] || [];
  if(this.type==='matching'&&this.instance?.selectedTerm)plan=plan.slice(1);
  if(this.type==='wordle'&&this.instance?.isRoundComplete?.())plan=[{selector:'.wordle-wrapper > button',pose:'correct',title:'Continue',message:'Read the feedback, then continue to the next word.'}];
  // A library card is only a target while no reading is open.
  if(this.type==='student-sparks-view'&&this.root.querySelector('.student-current-class-spark,.spark-reading-copy'))plan=plan.slice(0,3);
  let steps=resolveEmberSteps(this.type==='main-menu-view'?document:this.root,plan);
  if(this.type==='student-sparks-view'){
   const response=this.root.querySelector('.student-class-spark-questions');
   const submit=response?.querySelector('button[type="submit"]:not(:disabled)');
   if(submit)steps=steps.map(s=>s.target===submit?{...s,message:`Choose ${submit.textContent.trim()}. Wait for confirmation before leaving.`}:s);
   if(response && /Closed\./.test(response.textContent))steps=steps.filter(s=>!response.contains(s.target)).concat(resolveEmberSteps(response,[{selector:'h3',title:'Review your answers',message:'This Spark is closed. You can read it and review your saved answers.',pose:'calm'}]));
  }
  if(!steps.length&&!this.root.querySelector('.student-page-skeleton,.loading-spinner'))steps=resolveEmberSteps(this.root,[{selector:'h2,h3,[role="status"],.teacher-empty-state,p',title:'Check this screen',message:'Read the message here. If no work is available, choose another unit or ask your teacher.',pose:'calm'}]);
  return steps;
 }
 refresh(){
  if(this.disposed)return;
  const blocked=this.blocked();this.help.disabled=blocked;
  this.help.title=blocked?'Help is available when this round or dialog closes.':'';
  if(blocked){this.close?.();this.close=null;return;}
  if(this.targets?.some(target=>!target.isConnected)){this.close?.();this.close=null;this.targets=null;}
  const round=this.round();if(round!==this.lastRound){this.lastRound=round;this.idle.reset();this.offer?.remove();this.offer=null;}
  if(this.complete()){
   if(!this.preferences.completed){this.preferences.completed=true;this.save();this.show();}return;
  }
  if(!this.preferences.introduced&&!this.preferences.skipped&&this.steps().length){this.preferences.introduced=true;this.save();this.show();return;}
  if(this.preferences.skipped)return;
  const mistakes=this.mistakes();
  if(mistakes>0&&!this.offer?.isConnected){
   this.offer=document.createElement('aside');this.offer.className='ember-retry-offer';
   const text=document.createElement('span');text.textContent='Need help with the next step? ';
   const button=document.createElement('button');button.type='button';button.className='btn secondary-btn';button.textContent='Show a clue';button.onclick=()=>this.show(true);
   this.offer.append(text,button);this.root.append(this.offer);
  }
  // Wait until the activity has finished its own feedback and input focus changes.
  const settling=this.instance?.lockBoard || this.root.querySelector('.wrong');
  if(mistakes>=2&&!settling&&this.preferences.clueRound!==round){this.preferences.clueRound=round;this.save();this.show(true);}
 }
 show(clue=false){
  if(this.blocked())return;
  this.idle.dismiss();this.close?.();
  const steps=this.steps();if(!steps.length)return;
  if(clue){steps[0]={...steps[0],pose:'clue',title:'Try this clue'};}
  this.targets=steps.map(step=>step.target);
  this.close=openSpotlight({steps,
   onSkip:()=>{this.preferences.skipped=true;this.save();this.close=null;this.targets=null;this.idle.reset();},
   onFinish:()=>{this.close=null;this.targets=null;this.idle.reset();}
  });
 }
 destroy(){
  if(this.disposed)return;this.disposed=true;clearTimeout(this.pending);this.observer.disconnect();
  this.root.removeEventListener('input',this.onInput);this.root.removeEventListener('click',this.onInput);
  this.idle.destroy();this.close?.();this.offer?.remove();this.help.remove();
 }
}
export function attachActivityEmber(sm,type,instance){
 if(type==='flashcards'||!ACTIVITY_EMBER_PLANS[type])return;
 const guide=new StudentEmber({sm,type,instance,root:instance.container});
 const destroy=instance.destroy?.bind(instance);
 instance.destroy=()=>{guide.destroy();destroy?.();};
 instance.emberGuidance=guide;
}
export function attachScreenEmber(sm,viewId){
 if(!SCREEN_EMBER_PLANS[viewId])return null;
 const root=document.getElementById(viewId);if(!root)return null;
 return new StudentEmber({sm,type:viewId,root});
}
