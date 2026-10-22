/* Equipment rack and intermission choices. Combat remains in game.js. */
(function(root){
 'use strict';
 const R=root.RogueRun,el=id=>document.getElementById(id);
 const labels={normal:'通常戦',elite:'強敵戦',session:'セッション戦',boss:'最終戦'};
 const fits={stone:'重いKick・間',fly:'風・交互の刻み',machine:'雷・裏拍',plant:'火・後半の展開',ghost:'雷・揺れるノリ',crystal:'土・交互の刻み',furnace:'風・休符と掛け合い',pulse:'土・拍頭のKickと余白',conductor:'火・モチーフの変化'};
 function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
 const effectText=item=>R.effectText(item);
 function gearCard(item){const g=R.byId(item.id);return {id:g.id,kicker:g.style+' · Lv.'+item.rank,title:g.name,text:(g.audio?'音：'+g.audio.description+'\n戦闘条件：':'')+g.condition,detail:'成立した演奏の戦闘再生前に '+effectText(item)+(g.audio?' / 音響は装備中に常時有効':'')};}
 function render(run,{hp=100,shield=0}={}){
  const rack=el('rogueRack');if(!rack)return;rack.hidden=!run;if(!run)return;
  el('modeBadge').textContent=`ROGUELITE · ${run.floor} / ${run.total}`;
  el('rogueProgress').replaceChildren(...Array.from({length:run.total},(_,i)=>{const n=node('span',String(i+1),i+1<run.floor?'passed':i+1===run.floor?'current':'');if(i+1===run.floor)n.setAttribute('aria-current','step');n.title=i===run.total-1?'終奏の指揮者':'第'+(i+1)+'戦';return n;}));
  el('rogueRigCount').textContent=`機材 ${run.gear.length}個 · 合計Lv.${run.gear.reduce((sum,item)=>sum+item.rank,0)}`;
  const gearNodes=run.gear.map(item=>{const g=R.byId(item.id),card=node('details',undefined,'rig-item'),summary=node('summary',g.name+' Lv.'+item.rank);
   const proc=run.lastEffects.find(t=>t.id===item.id);card.dataset.active=String(!!proc&&proc.value>0);summary.append(node('small',proc?proc.value>0?'発動':'待機':g.audio?'音響ON':'待機'));card.append(summary,...(g.audio?[node('p','音：'+g.audio.description)]:[]),node('p',g.condition),node('p',effectText(item),'rig-effect'));return card;});
  el('rogueGear').replaceChildren(...(gearNodes.length?gearNodes:[node('p','最初の演奏前に機材を1つ選びます。','rig-empty')]));
  const texts={starter:'出発機材を選んで、演奏スタイルを決めよう。',reward:'勝利。機材を選び、次の進路へ。',route:'敵と報酬を見比べて、次の進路を選ぼう。',bonus:'セッション成功。機材を1つ強化できます。',complete:'全8戦クリア！ 今回の機材で終奏を奏で切った。',over:'周回終了。新しい機材と進路で再挑戦しよう。'};
  el('rogueRunStatus').textContent=texts[run.phase]??`${labels[run.current.kind]} · ${run.current.kind==='elite'?'勝利で強化済み機材から3択':'勝利で機材から3択'}${run.skipReward?'（休憩と交換済み）':''}`;
  el('rogueChallenge').hidden=!run.challenge;
  if(run.challenge)el('rogueChallenge').textContent=`${run.challenge.done?'✓ 達成':'◇ 課題'} · ${run.challenge.name}：${run.challenge.text}。達成して勝利 → 所持機材を1つ強化。`;
  el('rogueProc').textContent=run.lastSummary??'機材はすべて所持・発動できます。重複は何度でもレベルアップ。音響は常時ON、戦闘強化は条件成立時に一巡1回。攻撃・盾・回復の合計制限なし。貫通強度は重なるほど装甲軽減を100%無視に近づけます。';
  el('rogueResources').textContent=`HP ${hp} / 100 · SHIELD ${shield} / ${R.shieldCapacity(run.gear)}`;
 }
 function choose({title,text,cards,footer='あとで選ぶ'}){
  const dialog=el('rogueRewardDialog');el('rewardTitle').textContent=title;el('rogueChoiceHelp').textContent=text;
  const buttons=cards.map(card=>{const button=node('button',undefined,'rogue-choice');button.type='button';button.dataset.rogueChoice=card.id;
   if(card.kind)button.dataset.kind=card.kind;
   button.append(node('small',card.kicker??''),node('strong',card.title),node('span',card.text),node('em',card.detail??''));return button;});
  el('rogueChoices').replaceChildren(...buttons);el('rogueChoiceCancel').textContent=footer;
  return new Promise(resolve=>{
   let done=false;
   const finish=value=>{if(done)return;done=true;dialog.removeEventListener('click',click);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);if(dialog.open)dialog.close();resolve(value);};
   const click=event=>{const button=event.target.closest?.('[data-rogue-choice]');if(button)finish(button.dataset.rogueChoice);else if(event.target.closest?.('#rogueChoiceCancel'))finish(null);};
   // close events are queued: a previous choice may dispatch after the next
   // screen has already reopened this dialog. Only close the current screen.
   const cancel=event=>{event.preventDefault();finish(null);},closed=()=>{if(!dialog.open)finish(null);};
   dialog.addEventListener('click',click);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);dialog.showModal();buttons[0]?.focus();
  });
 }
 function routeCard(option,run){
  if(option.kind==='rest')return {id:option.id,kind:'rest',kicker:'寄り道 · 戦闘なし',title:'音を休める休憩所',text:'HPを35回復、または所持機材を1つ強化。その後、戦う敵を選べます。',detail:'代償：次の勝利の機材報酬を失う。各休憩所で1回のみ。'};
  const e=option.enemy;
  return {id:option.id,kind:option.kind,kicker:`${labels[option.kind]} · 第${run.floor+1}戦 / 8 · BPM ${e.bpm}`,title:e.name,text:`HP ${e.hp} · 攻撃 ${e.attack} · 装甲 ${Math.round((e.guard??0)*100)}%\n有効：${fits[e.kind]??'演奏を工夫しよう'}`,detail:option.kind==='elite'?`敵HP＋20%・攻撃＋12%。${run.skipReward?'今回の機材報酬は休憩と交換済み。':'勝利で強化済み機材から3択。'}`:option.kind==='session'?'敵HP＋10%。演奏課題を選択。達成して勝利で機材強化＋通常報酬。':option.kind==='boss'?'最後の相手。育てた機材と演奏で全8戦クリアへ。':run.skipReward?'通常の敵。今回の機材報酬は休憩と交換済み。':'勝利で機材から3択。同じ機材を選ぶと強化。'};
 }
 async function progress(run,roster,resources){
  while(!['battle','over','complete'].includes(run.phase)){
   resources.refresh();
   if(run.phase==='starter'||run.phase==='reward'){
    const offers=R.rewardOffers(run),id=await choose({title:run.phase==='starter'?'最初の機材を選ぶ':'勝利報酬を選ぶ',text:'機材の所持数に制限はなく、この周回中はすべて有効。音響機材は装備中に常時音を変え、戦闘強化は条件成立時に発動します。同じ機材を選ぶと何度でもレベルアップします。勝利でHP18回復。',cards:[...offers.map(item=>{const card=gearCard(item),owned=run.gear.some(g=>g.id===item.id);return {...card,kicker:owned?'所持機材 → Lv.'+item.rank:card.kicker,detail:(owned?'強化後：':'')+card.detail};}),{id:'skip',kicker:'報酬を辞退',title:'今の構成を維持する',text:'機材を取らずに進みます。',detail:'回復や追加効果はありません。'}]});
    if(id===null)return false;
    if(id==='skip'){R.skip(run);continue;}
    R.claim(run,id);
   }else if(run.phase==='bonus'){
    const upgrades=run.gear,id=await choose({title:'セッション成功',text:upgrades.length?'所持機材を1つレベルアップします。':'機材がないため、代わりにHPを15回復します。',cards:upgrades.length?upgrades.map(g=>gearCard({...g,rank:g.rank+1})):[{id:'heal',title:'HPを15回復',text:'通常の勝利報酬も、この後に受け取れます。'}]});
    if(id===null)return false;const result=R.bonus(run,id);if(result)resources.heal(result.heal);
   }else if(run.phase==='route'){
    const options=R.routes(run,roster),id=await choose({title:'次の進路を選ぶ',text:`第${run.floor}戦を突破。敵・テンポ・報酬を見て、機材に合う道を選ぼう。${run.skipReward?' 次の機材報酬は休憩と交換済みです。':''}`,cards:options.map(o=>routeCard(o,run))});
    if(id===null)return false;const option=options.find(o=>o.id===id);
    if(option.kind==='rest'){
     const action=await choose({title:'休憩所',text:'回復か機材強化を選びます。利用すると次の勝利の機材報酬を失います。',cards:[{id:'heal',title:'HPを35回復',text:`現在HP ${resources.hp()} / 100`,detail:`実際の回復量：${Math.min(35,100-resources.hp())}`},...run.gear.map(g=>gearCard({...g,rank:g.rank+1}))],footer:'進路の選択に戻る'});
     if(action!==null){const result=R.rest(run,action);if(result)resources.heal(result.heal);}continue;
    }
    let challenge=null;
    if(option.kind==='session'){
     challenge=await choose({title:'セッションの課題を選ぶ',text:'次の戦闘中、1回でも達成してから勝利すれば機材を1つ強化。課題未達でも通常の機材報酬は得られます。敵HPは10%増えます。',cards:R.challenges.map(c=>({id:c.id,kicker:'演奏課題',title:c.name,text:c.text,detail:'達成はDrums・Bass・Leadの一巡後に判定します。'})),footer:'進路の選択に戻る'});
     if(challenge===null)continue;
    }
    R.enter(run,id,challenge);
   }
  }
  resources.refresh();return run.phase==='battle';
 }
 const instruction=run=>run?({starter:'出発機材を選んで、最初の演奏へ',reward:'勝利！ 機材を選んで、次の進路へ',bonus:'セッション成功！ 機材を強化しよう',route:'敵と報酬を見比べて、次の進路へ',complete:'全8戦クリア！ 新しい機材で次の周回へ',over:'機材と進路を選び直して再挑戦しよう'})[run.phase]??null:null;
 root.RogueUI={render,choose,progress,routeCard,instruction};
})(globalThis);
