/* Orchestration and DOM only. Musical analysis is in PerformanceReview. */
(function(root){
 'use strict';
 const el=id=>document.getElementById(id),R=root.PerformanceReview,last=new Map(),recentHints=new Map();
 let enabled=true,pending=null,lastAdvice=null,cueTimer=null,hitTimer=null,queued=false,inputQueue=null,lastCue='',lastCueAt=-Infinity;
 try{enabled=localStorage.getItem('ridumu-feedback-effects')!=='false';}catch{}
 const sign=n=>(n>0?'+':'')+n;
 function effects(value){enabled=!!value;root.FeedbackAudio?.setEnabled(enabled);el('feedbackEffects').checked=enabled;if(!enabled){el('performanceCue').hidden=true;el('hitReason').hidden=true;}try{localStorage.setItem('ridumu-feedback-effects',String(enabled));}catch{}}
 function cue(event,handle,at){
  if(!enabled)return;const now=performance.now(),key=event.kind+':'+event.q;if(key===lastCue&&now-lastCueAt<160)return;lastCue=key;lastCueAt=now;
  const node=el('performanceCue'),content=document.createElement('span'),certainty=document.createElement('small');content.textContent=(event.strength>.66?'▰▰▰ ':event.strength>.33?'▰▰ ':'▰ ')+event.label;certainty.textContent=event.provisional?'途中':'確定';node.replaceChildren(content,certainty);node.title=event.label+(event.provisional?'（途中評価）':'（実益あり）');node.dataset.kind=event.kind;node.style.setProperty('--strength',String(event.strength));node.hidden=false;clearTimeout(cueTimer);cueTimer=setTimeout(()=>{node.hidden=true;},2500);
  root.FeedbackAudio?.apply(handle,event,at);
 }
 function input(note,voice,handle){
  if(!enabled||!note||state!=='recording'||phase!=='parts')return;inputQueue={note,voice,handle,turn,run};if(queued)return;queued=true;
  requestAnimationFrame(()=>{queued=false;const current=inputQueue;inputQueue=null;if(!current||current.turn!==turn||current.run!==run||state!=='recording')return;
   const parts=new Map(tracks);parts.set(current.voice,notes);const events=R.live(parts,hatNotes,current.voice,current.note,timing().bpm,timing().duration,enemies[stage]);
   if(events.length)cue({...events[0],label:events.map(e=>e.label).join(' / ')},current.handle,ctx.currentTime);
  });
 }
 function renderFactors(review){
  const list=el('factors');list.replaceChildren();for(const f of review.top){const item=document.createElement('li');item.textContent=f.text;item.dataset.reviewFactor=f.id;list.append(item);}
  if(!review.top.length){const item=document.createElement('li');item.textContent='今回は補正による実益なし。上限や敵の残HPも影響します。';list.append(item);}
  el('pitchOutcome').textContent=(review.top.find(f=>f.id!=='drums')??review.top[0])?.cause??'補正の実益なし';el('pitchOutcome').title=review.top.map(f=>f.text).join('\n');el('pitchOutcome').hidden=false;
  const detail=el('reviewFactors');detail.replaceChildren();
  for(const f of review.all){const item=document.createElement('p');item.textContent=f.text+`（この補正を外した場合との差：実ダメージ ${sign(f.damage)} / 生成盾 ${sign(f.shield)} / 防いだHP ${sign(f.saved)}）`;detail.append(item);}
 }
 function renderComparison(comparison,previous,current){
  const node=el('performanceComparison');node.replaceChildren();const p=document.createElement('p');
  if(!comparison){p.textContent='この起動中、同じ敵との次の戦闘から比較します。履歴再生は比較を更新しません。';node.append(p);return;}
  p.textContent=comparison.conditions;node.append(p);
  const summary=document.createElement('p');summary.className='comparison-summary';summary.textContent=comparison.changes.length?comparison.changes.slice(0,2).map(c=>c.observation+'。'+c.cause+'による利益が'+(c.delta>0?'増えた':'減った')).join('。')+'。':'同じ条件での演奏性能は、前回とほぼ同じでした。';node.append(summary);
  const table=document.createElement('table'),body=document.createElement('tbody');table.append(body);
  const row=(name,a,b)=>{const tr=document.createElement('tr');for(const [i,text] of [name,String(a),String(b)].entries()){const td=document.createElement(i===0?'th':'td');if(i===0)td.scope='row';td.textContent=text;tr.append(td);}body.append(tr);};
  const a=comparison.before,b=comparison.after,names={earth:'土',wind:'風',fire:'炎',lightning:'雷'},ensembles=v=>v.ensemble.selected.map(s=>({grooveLock:'Kick＋Bass同期',bassLaidBack:'Bassの後ノリ',response:'Drums→Lead応答',interlock:'空白の補完',unison:'重要拍で合流',callResponse:'フレーズの応答'})[s.id]).join(' / ')||'なし';row('同条件の性能','前回','今回');row('全打撃のダメージ',a.damage,b.damage);row('生成盾（持ち越し0）',a.shieldGenerated,b.shieldGenerated);row('反撃によるHP減少（敵生存想定）',a.received.damage,b.received.damage);row('属性 / 最終敵相性',names[a.analysis.element]+' / ×'+a.result.affinity.toFixed(2),names[b.analysis.element]+' / ×'+b.result.affinity.toFixed(2));row('グルーヴ',Groove.describe(a.groove),Groove.describe(b.groove));row('成立したアンサンブル',ensembles(a),ensembles(b));row('音程：攻撃 / 命中 / 貫通',pitchText(a),pitchText(b));node.append(table);
  const change=document.createElement('p');change.textContent=`同条件では：ダメージ ${sign(comparison.damage)}、生成盾 ${sign(comparison.shield)}、受けるHPダメージ ${sign(comparison.received)}。各補正は相互作用するため、要因ごとの差分は足し合わせません。`;node.append(change);
  const actual=document.createElement('p');actual.className='actual-conditions';actual.textContent=`実戦条件は別：前回は敵HP ${previous.packet.conditions.enemyHp} / 戦闘開始HP ${previous.packet.conditions.hp} / 持ち越し盾 ${previous.packet.conditions.shield}、今回は ${current.packet.conditions.enemyHp} / ${current.packet.conditions.hp} / ${current.packet.conditions.shield}。実際の与ダメージ ${previous.actual.damage} → ${current.actual.damage}、生成盾 ${previous.actual.shield} → ${current.actual.shield}、反撃で受けたHPダメージ ${previous.actual.received} → ${current.actual.received}。入力中の毒は戦闘開始HPに反映し、反撃ダメージには含めません。`;node.append(actual);
 }
 function pitchText(v){const p=v.analysis.pitchApplied,g=v.result.calculation.guard;return `攻撃 +${(p.attack*100).toFixed(1)}% / 命中 ${(p.accuracy*100).toFixed(1)}pt / 貫通 ${((g.rate?p.pierce:0)*100).toFixed(1)}%${g.rate?'':'（装甲なし）'} / 音程耐性 ${(v.reduction.pitch*100).toFixed(1)}%`;}
 function begin(packet,actual){
  const snapshot=R.copy(packet),review=R.factors(snapshot),previous=last.get(packet.enemy.kind);
  // A mismatch must never replace the actual combat report with a reconstruction.
  const matches=review.actual.result.total===actual.result.total&&review.actual.shield===actual.shield&&['power','accuracy','effect'].every(k=>Math.abs(review.actual.analysis[k]-actual.analysis[k])<1e-8);
  pending={packet:snapshot,review,previous,matches,startHp:packet.conditions.hp,startEnemy:packet.conditions.enemyHp,actual:{damage:0,shield:actual.shield-packet.conditions.shield,received:0,counter:false}};
  el('performanceReview').hidden=false;if(matches)renderFactors(review);else{el('reviewFactors').textContent='実戦の条件を再現できなかったため、今回の要因比較は省略します。';el('performanceComparison').textContent='比較は省略しました。';}
  const recent=recentHints.get(packet.enemy.kind)??[],tip=R.hint(review.actual,packet.enemy,recent);pending.tip=tip;el('nextPerformanceTip').textContent='次はひとつ：'+(root.ExperienceUI.advice??tip.text);el('reaction').textContent=tip.text;
  el('performanceReviewStatus').textContent='演奏評価は確定。実戦の与ダメージ・被ダメージは戦闘終了後に記録します。';root.RidumuUI?.refresh();
  return pending;
 }
 function complete(hp,enemyHp,counter){
  if(!pending)return;const current=pending;pending=null;current.actual.damage=current.startEnemy-enemyHp;current.actual.received=current.startHp-hp;current.actual.counter=counter;
  lastAdvice={enemyKind:current.packet.enemy.kind,text:current.tip.text};
  el('nextPerformanceTip').textContent='次はひとつ：'+current.tip.text;
  if(current.matches){const comparison=current.previous?R.compare(current.previous.packet,current.packet):null;renderComparison(comparison,current.previous,current);last.set(current.packet.enemy.kind,{packet:current.packet,actual:current.actual});const recent=recentHints.get(current.packet.enemy.kind)??[];recentHints.set(current.packet.enemy.kind,[...recent,current.tip.id].slice(-3));}
  el('performanceReviewStatus').textContent=`実戦：Drumsで ${current.actual.damage} ダメージ / Bass＋Leadで生成盾 ${sign(current.actual.shield)} / 受けたHPダメージ ${current.actual.received}${counter?'':'（敵撃破で反撃なし）'}。`;
  root.RidumuUI?.refresh();return current;
 }
 function playback(event,handle,at){
  if(!enabled||!pending?.matches)return;const v=pending.review.actual,step=60/pending.packet.bpm/4,q=Math.max(0,Math.min(31,Math.round((event.inputT??event.time)/step)));
  if(pending.review.all.some(f=>f.id==='ensemble'))for(const s of v.ensemble.selected){if(!pending.review.ensembleBenefits.includes(s.id)||!['grooveLock','bassLaidBack','response'].includes(s.id)||!s.cells.some(c=>c.voice===event.voice&&c.q===q))continue;
   root.FeedbackAudio?.apply(handle,{kind:s.id==='response'?'response':'lock',strength:s.score},at);
   const owner=pending;setTimeout(()=>{if(pending===owner)cue({kind:s.id==='response'?'response':'lock',strength:s.score,label:s.id==='grooveLock'?'◎ Kick + Bass → 連携が効いた':s.id==='bassLaidBack'?'◎ Bassの後ノリ → 連携が効いた':'↔ Drums → Lead → 支援が効いた',q,provisional:false},null,at);},Math.max(0,(at-ctx.currentTime)*1000));
  }
 }
 function hit(damage){
  if(!enabled||!pending?.matches||damage<12)return;const top=pending.review.all.find(f=>f.id!=='drums'&&f.damage>0)||pending.review.top.find(f=>f.damage>0);if(!top)return;
  const node=el('hitReason');node.textContent=top.cause;node.hidden=false;clearTimeout(hitTimer);hitTimer=setTimeout(()=>{node.hidden=true;},5000);
  const v=pending.review.actual,benefits=new Set(pending.review.all.filter(f=>f.damage>0||f.saved>0).map(f=>f.id));
  if(benefits.has('pitch')){const p=v.analysis.pitchApplied,factor=pending.review.all.find(f=>f.id==='pitch'),attack=factor.damage>0;root.ExperienceUI.waveform?.trigger('pitch',{rise:attack?p.causes.filter(c=>c.voice==='lead'&&c.id==='rise').reduce((s,c)=>s+Math.max(0,c.value),0):0,fall:factor.saved>0&&v.lead.pitch?.effects.weaken?Math.min(v.reduction.pitch,v.lead.pitch.effects.weaken):0,pierce:attack&&pending.packet.enemy.guard?p.pierce:0,high:attack?v.bass.pitch?.effects.attack??0:0,repeat:attack?Math.max(0,p.causes.find(c=>c.id==='repeat')?.value??0):0});}
  const expressive=pending.review.all.find(f=>['affinity','groove','timbre','rhythm'].includes(f.id)&&f.damage>0);if(expressive)cue({kind:expressive.id,q:-2,strength:Math.min(1,expressive.damage/30),label:expressive.cause+' → 効いた',provisional:false});
 }
 function shield(amount,kind='bass'){if(!enabled||amount<=0)return;cue({kind:'low',q:-1,strength:Math.min(1,amount/30),label:kind==='bass'?'▰ Bass → 盾を生成':'↗ Lead → 盾を支援',provisional:false});if(cycleBass?.pitch&&cycleBass.pitchShieldApplied>0)battleWaveform?.trigger('pitch',{low:Math.max(0,cycleBass.pitch.effects.shield)});}
 function reset(){inputQueue=null;lastCue='';el('performanceCue').hidden=true;el('hitReason').hidden=true;}
 root.ExperienceUI={input,begin,complete,playback,hit,shield,reset,effects,clearAdvice(){lastAdvice=null;},get advice(){return lastAdvice?.enemyKind===enemies[stage].kind?lastAdvice.text:null;},get enabled(){return enabled;},get pending(){return pending;},waveform:null};
 el('feedbackEffects').onchange=()=>effects(el('feedbackEffects').checked);effects(enabled);
})(globalThis);
