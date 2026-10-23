/* Presentation preferences never change the combat model or recorded inputs. */
(()=>{
 'use strict';
 const key='ridumu-layout-v1';
 const defaults={side:'enemy-left',result:'bottom',timeline:'middle',steps:true,element:false,discoveries:false,description:false,feedback:false,wave:true};
 const labels={steps:'パートの進行一覧',element:'属性の予測メーター',discoveries:'発見済みの弱点',description:'敵の詳しい説明',feedback:'結果の解説・アドバイス',wave:'敵の背景波形'};
 let prefs={...defaults};
 try{const saved=JSON.parse(localStorage.getItem(key));for(const name of Object.keys(defaults)){if(typeof defaults[name]==='boolean'&&typeof saved?.[name]==='boolean')prefs[name]=saved[name];}for(const [name,values] of Object.entries({side:['enemy-left','enemy-right'],result:['top','bottom'],timeline:['top','middle','bottom']})){if(values.includes(saved?.[name]))prefs[name]=saved[name];}}catch{}
 const el=id=>document.getElementById(id);
 const dialog=document.createElement('dialog');dialog.id='layoutDialog';dialog.className='workspace-dialog layout-dialog';dialog.setAttribute('aria-labelledby','layoutTitle');
 dialog.innerHTML='<div class="dialog-heading"><h2 id="layoutTitle">画面のカスタマイズ</h2><button type="button" id="closeLayout">閉じる</button></div><p>変更はすぐに反映・保存されます。敵のHP・行動予告・演奏操作・正確さは常に確認できます。</p><fieldset><legend>表示する情報</legend><div id="layoutOptions"></div></fieldset><fieldset><legend>位置</legend><label>戦闘情報の配置<select data-layout="side"><option value="enemy-left">敵の名前・HPが左</option><option value="enemy-right">敵の名前・HPが右</option></select></label><label>演奏結果<select data-layout="result"><option value="bottom">パッドの下</option><option value="top">演奏欄の上</option></select></label><label>タイムライン<select data-layout="timeline"><option value="top">演奏欄の上</option><option value="middle">パッドの上</option><option value="bottom">パッドの下</option></select></label><p>PCでは上が戦闘、下が演奏です。詳細情報は各欄の中でスクロールできます。</p></fieldset><div class="layout-actions"><button type="button" id="layoutSimple">シンプルに戻す</button><button type="button" id="layoutAll">情報をすべて表示</button></div><p id="layoutSaveStatus" role="status"></p>';
 document.body.append(dialog);
 for(const [name,label] of Object.entries(labels)){const row=document.createElement('label');const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='checkbox';input.dataset.layout=name;row.append(text,input);el('layoutOptions').append(row);}
 const targets={steps:el('partSteps'),element:el('elementMeter'),discoveries:el('discoveries'),description:el('enemyDesc'),wave:el('battleWaveform')};
 const consolePanel=document.querySelector('#game > .console');
 function placeResult(){const slot=el('mobileMoveSlot');if(el('result').parentElement!==slot)slot.append(el('result'));slot.style.order=prefs.result==='top'?'0':'70';}
 // Move the existing effects node only at the device breakpoint; listeners survive.
 const desktop=matchMedia('(min-width:760px)');
 function placeEffects(){
  (desktop.matches?consolePanel:el('arena')).append(el('effectsPanel'));
  (desktop.matches?consolePanel.querySelector('.performance-heading'):consolePanel).append(el('elementMeter'),consolePanel.querySelector('.console-top'));
 }
 desktop.addEventListener('change',placeEffects);placeEffects();
 globalThis.RidumuLayout={placeResult};
 function apply(save=false){
  document.body.classList.add('custom-layout');document.body.dataset.layoutSide=prefs.side;
  document.body.dataset.layoutResult=prefs.result;document.body.dataset.layoutTimeline=prefs.timeline;
  for(const [name,node] of Object.entries(targets))node.classList.toggle('layout-hidden',!prefs[name]);
  for(const id of ['resultCause','resultFeedback','partTimingAccuracy','pitchOutcome'])el(id).classList.toggle('layout-hidden',!prefs.feedback);
  consolePanel.querySelector('.timeline').style.order={top:1,middle:40,bottom:65}[prefs.timeline];placeResult();
  dialog.querySelectorAll('[data-layout]').forEach(input=>{const value=prefs[input.dataset.layout];if(input.type==='checkbox')input.checked=value;else input.value=value;});
  if(save){try{localStorage.setItem(key,JSON.stringify(prefs));el('layoutSaveStatus').textContent='保存しました';}catch{el('layoutSaveStatus').textContent='このブラウザでは保存できません。今回の表示には反映しています。';}}
 }
 dialog.addEventListener('change',event=>{const name=event.target.dataset.layout;if(!Object.hasOwn(defaults,name))return;prefs[name]=event.target.type==='checkbox'?event.target.checked:event.target.value;apply(true);});
 el('layoutSimple').onclick=()=>{prefs={...defaults};apply(true);};el('layoutAll').onclick=()=>{for(const name of Object.keys(labels))prefs[name]=true;apply(true);};
 el('openLayout').onclick=()=>{if(typeof releaseAllInputs==='function')releaseAllInputs();el('playSettingsDialog').close();dialog.showModal();};
 el('closeLayout').onclick=()=>dialog.close();dialog.addEventListener('close',()=>el('openMenu').focus());
 const rack=el('rogueRack');const gearToggle=document.createElement('button');gearToggle.type='button';gearToggle.id='toggleGearDetails';gearToggle.className='small';gearToggle.textContent='機材を見る';gearToggle.setAttribute('aria-expanded','false');gearToggle.setAttribute('aria-controls','rogueGear rogueRunStatus');rack.querySelector('.rogue-rack-head').append(gearToggle);
 gearToggle.onclick=()=>{const expanded=rack.classList.toggle('gear-expanded');gearToggle.setAttribute('aria-expanded',String(expanded));gearToggle.textContent=expanded?'機材を閉じる':'機材を見る';};
 apply();
})();
