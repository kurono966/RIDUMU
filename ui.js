/* Presentation only: observe the existing engine rather than duplicating its rules. */
(function(root){
 'use strict';
 function presentation({state,part,hat,remaining=0,duration=1}){
  const name=hat?'ハイハット':({drums:'ドラム',bass:'ベース',lead:'リード'}[part]||'演奏');
  const busy={countin:'拍に合わせて、もうすぐスタート',recording:hat?'SPACE またはパッドでリズムを刻もう':'キーまたはパッドで演奏しよう',attack:'あなたの演奏で攻撃中',enemyAttack:'敵の攻撃を防いでいます',cleared:'クリア！ もう一度、新しいリズムを',over:'もう一度チャレンジしよう'};
  return {title:name,step:hat?'hat':part,instruction:busy[state]||(hat?'開始 → SPACE / パッドで2小節のリズムを作る':'開始 → パッドで2小節を演奏。長押しで音を伸ばす'),progress:state==='recording'?Math.max(0,Math.min(1,1-remaining/duration)):0};
 }
 const api={presentation,isModalOpen:()=>!!root.document?.querySelector('.workspace-dialog[open]')};root.RidumuUI=api;
 if(typeof module!=='undefined')module.exports=api;
 if(!root.document)return;
 const el=id=>document.getElementById(id),settings=el('playSettingsDialog'),analysis=el('resultDetailsDialog');
 function refresh(){
  const model=presentation({state,part:instrumentForTurn(turn).id,hat:state==='ready'?needsHat():phase==='hat',remaining:Number(el('timer').textContent),duration:timing().duration});
  if(state==='ready'){
   const consoleNode=document.querySelector('.console'),hat=needsHat();
   if(consoleNode.classList.contains('hat-phase')!==hat)consoleNode.classList.toggle('hat-phase',hat);
   el('hat').disabled=!hat;
  }
  el('partTitle').textContent=model.title;el('nextAction').textContent=model.instruction;el('phraseProgress').value=model.progress;document.body.dataset.playState=state;
  document.querySelectorAll('#partSteps li').forEach(node=>{if(node.dataset.part===model.step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  analysis.dataset.panel=el('result').dataset.panel||'summary';
  const label=el('damageLabel').textContent,prepared=label.includes('READY');el('damage').hidden=prepared;el('preparedLabel').hidden=!prepared;el('resultMetricLabel').textContent=prepared?'次のパートへ':label.includes('SHIELD')?'シールド':'ダメージ';
  el('resultCause').textContent=el('factors').querySelector('li')?.textContent||'';el('resultFeedback').textContent=el('reaction').textContent.split(/(?<=[。！])/)[0]||'';
  el('openPlaySettings').disabled=['recording','countin','attack','enemyAttack'].includes(state);
 }
 api.refresh=refresh;
 function open(dialog){if(typeof releaseAllInputs==='function')releaseAllInputs();dialog.showModal();}
 el('openMenu').onclick=el('openPlaySettings').onclick=()=>open(settings);el('closePlaySettings').onclick=()=>settings.close();el('openResultDetails').onclick=()=>open(analysis);el('closeResultDetails').onclick=()=>analysis.close();
 const replay=document.createElement('button');replay.type='button';replay.className='small';replay.id='analysisReplay';replay.textContent='▶ 演奏を再生';replay.onclick=()=>el('replay').click();analysis.querySelector('.analysis-context').prepend(replay);
 for(const [trigger,dialog,parent] of [['openSynth','synthDialog',settings],['pitchSetup','pitchDialog',settings],['openHistory','historyDialog',settings],['openCodex','codexDialog',settings],['openDebug','debugDialog',settings],['damageLabel','damageDialog',analysis]]){
  el(trigger).addEventListener('click',()=>{parent.close();},{capture:true});el(dialog).addEventListener('close',()=>el(parent===settings?'openPlaySettings':'openResultDetails').focus());
 }
 function effects(show){el('effectsPanel').hidden=!show;el('toggleEffects').setAttribute('aria-expanded',String(show));if(!show)resetFilterPad();try{localStorage.setItem('ridumu-effects-open',String(show));}catch{}}
 el('toggleEffects').onclick=()=>effects(el('effectsPanel').hidden);el('closeEffects').onclick=()=>{effects(false);el('toggleEffects').focus();};el('restorePads').onclick=()=>setPadsVisible(true);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))effects(false);});
 for(const dialog of [settings,analysis])dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();}});
 let queued=false;const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}});
 for(const id of ['status','phaseLabel','instrument','timer','start','hint','damageLabel','reaction','factors'])observer.observe(el(id),{childList:true,subtree:true,characterData:true});
 observer.observe(el('result'),{attributes:true,attributeFilter:['hidden','data-panel']});observer.observe(document.querySelector('.console'),{attributes:true,attributeFilter:['class']});
 try{effects(localStorage.getItem('ridumu-effects-open')==='true');}catch{effects(false);}refresh();
})(globalThis);
