const discoveryKey='ridumu.discoveries.v1';
let knownWeaknesses={},discoveryStorageAvailable=true,activeReport=null,discoveryTimer;
try{
 const stored=JSON.parse(localStorage.getItem(discoveryKey)||'{}');
 if(stored&&typeof stored==='object'&&!Array.isArray(stored)){
  for(const kind of ['stone','fly','machine','plant','ghost','crystal'])if(Array.isArray(stored[kind]))knownWeaknesses[kind]=stored[kind].filter(id=>Object.hasOwn(CombatFeedback.discoveryNames,id));
 }
}catch{discoveryStorageAvailable=false;}
function renderDiscoveries(){
 const known=knownWeaknesses[enemies[stage].kind]||[];
 $('discoveries').textContent=known.length?'発見済み： '+known.slice(0,2).map(id=>'✓ '+CombatFeedback.discoveryNames[id]).join(' / ')+(known.length>2?` / 他${known.length-2}件は発見メモへ`:''):'？ 有効な攻撃は未発見';
}
function renderCodex(){
 const container=$('codexEntries');container.replaceChildren();
 for(const enemy of enemies){
  const section=document.createElement('section'),heading=document.createElement('h3'),description=document.createElement('p'),list=document.createElement('ul');
  heading.textContent=enemy.name;description.textContent=enemy.description;
  const known=knownWeaknesses[enemy.kind]||[];
  for(const id of known){const item=document.createElement('li');item.textContent='✓ '+CombatFeedback.discoveryNames[id];list.append(item);}
  if(!known.length){const item=document.createElement('li');item.textContent='？ 未発見。実際に攻撃して確かめよう。';list.append(item);}
  section.append(heading,description,list);container.append(section);
 }
 $('storageNote').textContent=discoveryStorageAvailable?'発見はこのブラウザに保存されます。':'この環境では保存できないため、このプレイ中だけ記録します。';
}
function discoverOnHit(){
 if(!activeReport)return;
 const discovered=CombatFeedback.discover(knownWeaknesses,enemies[stage].kind,activeReport);
 knownWeaknesses=discovered.known;
 if(!discovered.fresh.length)return;
 try{localStorage.setItem(discoveryKey,JSON.stringify(knownWeaknesses));}catch{discoveryStorageAvailable=false;}
 renderDiscoveries();
 const short={earth:'土属性',heavy:'重撃',chain:'交互入力',wind:'風属性',dense:'高密度',fire:'火属性',lightning:'雷属性',laidBack:'レイドバック',pocket:'ポケット',pushed:'前ノリ',snarePushed:'前ノリスネア',swing:'スウィング',tight:'タイト',drunk:'再現する揺れ'};
 $('discoveryToast').textContent='弱点発見：'+discovered.fresh.slice(0,2).map(id=>short[id]).join('・');
 $('discoveryToast').classList.add('visible');
 clearTimeout(discoveryTimer);discoveryTimer=setTimeout(()=>$('discoveryToast').classList.remove('visible'),2000);
}
function showHitFeedback(damage){
 if(!activeReport)return;
 if(damage<=0){clearHitFeedback();return;}
 $('hitLabels').textContent=activeReport.labels.join(' / ');
 $('arena').classList.toggle('weak-hit',activeReport.weaknesses.length>0);
 discoverOnHit();
}
function clearHitFeedback(){
 $('hitLabels').textContent='';$('arena').classList.remove('weak-hit');
}
function renderBreakdown(report,burn=0){
 const container=$('breakdown');container.replaceChildren();
 const b=report.breakdown;
 const formLabel=report.hasSupport?'演奏・支援の補正':b.groove>0?'ノリ・攻撃形態の補正':report.factors.some(f=>f.id==='charge')?'重撃・溜め補正':report.factors.some(f=>f.id==='chain')?'攻撃形態の補正':'重さ・連環の補正';
 const rows=[['基本攻撃',b.base||0],[formLabel,b.form||0],[b.affinity>=0?'敵との相性':'相性による軽減',b.affinity||0]];
 if(burn)rows.push(['炎の余熱',burn]);
 for(const [i,[label,value]] of rows.entries()){
  const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=(i>0&&value>0?'+':'')+value;
  if(value<0)dd.className='negative';container.append(dt,dd);
 }
}
let damageCalculation=null;
function renderReport(report){
 damageCalculation=report.calculation??null;$('damageLabel').disabled=!damageCalculation;
 if(damageCalculation)$('damageLabel').textContent='DAMAGE · 計算詳細 ↗';
 const list=$('factors');list.replaceChildren();
 for(const factor of report.factors){const li=document.createElement('li');li.textContent=factor.text;li.className=factor.priority===1?'weak-factor':'';list.append(li);}
 if(!report.factors.length){const li=document.createElement('li');li.textContent='今回は入力なし。次は一音から。';list.append(li);}
 $('feedback').textContent='';$('reaction').textContent=report.hint;
 // Groove is one of the three selected causes, rather than an extra block of statistics.
 $('grooveSummary').textContent='';
 $('detailHint').textContent=(report.grooveText?report.grooveText+' ':'')+report.hint;
 $('summaryHint').textContent=report.hint;
 renderBreakdown(report);setResultPanel('summary');
}
function annotateSequence(a,report){
 const marks=CombatFeedback.marks(a,report.factors),container=$('causeTracks');container.replaceChildren();
 for(const mark of marks){
  const row=document.createElement('div'),label=document.createElement('span'),track=document.createElement('div');
  row.className='cause-row';label.textContent=mark.label;track.className='cause-grid';
  for(let q=0;q<a.slots;q++){
   const cell=document.createElement('i');
   if(mark.cells.some(n=>n.q===q))cell.className='marked';
   track.append(cell);
  }
  row.append(label,track);container.append(row);
  for(const note of mark.cells){
   const cell=$('sequence').querySelector(`[data-type="${note.type}"][data-q="${note.q}"]`);
   if(cell){cell.classList.add('cause-cell');cell.title+=' / '+mark.label;cell.setAttribute('aria-label',cell.title);}
  }
 }
}
function renderEnsemble(ensemble,tracks=new Map(),bpm=120){
 const list=$('ensembleList'),grid=$('ensembleSequence');list.replaceChildren();grid.replaceChildren();
 const selected=ensemble?.selected??[];
 $('ensembleTab').textContent=selected.length?'シナジー '+selected.length:'シナジー';
 if(!selected.length){const p=document.createElement('p');p.textContent=ensemble?'今回はシナジーなし。各パートの効果はそのまま。':'3パートが揃うと、噛み合わせを判定。';list.append(p);return;}
 for(const synergy of selected){
  const item=document.createElement('div'),name=document.createElement('b'),text=document.createElement('span');
  item.className='ensemble-item';name.textContent=synergy.name;text.textContent=synergy.reason+' → '+synergy.effect;item.append(name,text);list.append(item);
 }
 for(const voice of ['drums','bass','lead']){
  const row=document.createElement('div'),label=document.createElement('label');row.className='seq-row ensemble-row';label.textContent={drums:'DRUM',bass:'BASS',lead:'LEAD'}[voice];row.append(label);
  const played=tracks.get(voice)??[];
  for(let q=0;q<32;q++){
   const cell=document.createElement('span'),marks=selected.filter(s=>s.cells.some(n=>n.voice===voice&&n.q===q));
   cell.className='cell'+(played.some(n=>GridEffects.slot(n,bpm)===q)?' on':'')+(marks.length?' synergy-cell':'');
   cell.title=voice+' / '+(q+1)+'番'+(marks.length?' / '+marks.map(s=>s.name).join('・'):'');cell.setAttribute('aria-label',cell.title);row.append(cell);
  }grid.append(row);
 }
}
function setResultPanel(panel){
 $('result').dataset.panel=panel;
 $('summaryTab').setAttribute('aria-pressed',String(panel==='summary'));
 $('rhythmTab').setAttribute('aria-pressed',String(panel==='rhythm'));
 $('ensembleTab').setAttribute('aria-pressed',String(panel==='ensemble'));
 $('damageTab').setAttribute('aria-pressed',String(panel==='damage'));
}
document.getElementById('summaryTab').onclick=()=>setResultPanel('summary');
document.getElementById('rhythmTab').onclick=()=>setResultPanel('rhythm');
document.getElementById('damageTab').onclick=()=>setResultPanel('damage');
document.getElementById('openCodex').onclick=()=>{renderCodex();$('codexDialog').showModal();};
document.getElementById('closeCodex').onclick=()=>$('codexDialog').close();

document.getElementById('ensembleTab').onclick=()=>setResultPanel('ensemble');

function renderDamageCalculation(c){
 const container=$('damageCalculation');container.replaceChildren();
 const number=n=>Number(n).toFixed(2);
 const add=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;container.append(node);return node;};
 add('p',`合計 ${c.total} DAMAGE / ${c.hits}打撃（固定）。Drumsの入力 ${c.drums.count}音（Kick ${c.drums.kick} / Snare ${c.drums.snare}）。`);
 add('h3','威力が増えた順序');
 const steps=document.createElement('dl');steps.className='calculation-steps';container.append(steps);
 const row=(label,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;steps.append(dt,dd);};
 const d=c.drums,active=d.count>0;
 row('音数による基本威力',number(active?24+8*Math.min(1,d.count/8):0));
 row('重さ / 溜め / 交互入力 / ノリ', [d.weightBonus,d.chargeBonus,d.alternationBonus,d.grooveBonus].map(v=>number(active?v:0)).join(' / '));
 for(const [i,s] of c.powerSteps.entries())row(s.label,(i?'×'+number(s.multiplier)+' → ':'')+number(s.value));
 for(const s of c.affinitySteps)row(s.label,'×'+number(s.multiplier));
 row('最終的な敵相性倍率','×'+number(c.affinity));
 row('多段攻撃の1発あたり配分','÷'+number(c.divisor)+`（${c.hits}段）`);
 row('命中効率（固定倍率）','×'+number(c.accuracyMultiplier));
 row('演奏の安定度（固定倍率）','×'+number(c.stabilityMultiplier));
 row('リズム精度（規則性・反復）','×'+number(c.rhythmMultiplier??1));
 row('総合攻撃効率','×'+number(c.efficiency));
 add('p',`1発のダメージ＝${number(c.power)} ÷ ${number(c.divisor)} × 相性${number(c.affinity)} × 命中効率${number(c.accuracyMultiplier)} × リズム精度${number(c.rhythmMultiplier??1)}。四捨五入し、効率が0なら0、それ以外は最低1。`);
 add('h3','実際に発生した打撃');
 const table=document.createElement('table'),head=document.createElement('tr');
 for(const text of ['打撃','固定ダメージ']){const cell=document.createElement('th');cell.textContent=text;head.append(cell);}table.append(head);
 c.hitDetails.forEach((hit,i)=>{const tr=document.createElement('tr');for(const text of [i+1,hit.damage]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);});container.append(table);
 add('p','同じ演奏・敵・状態なら同じ結果になります。命中効率は固定倍率です。多段は1発の威力を減らしますが、合計は少し伸びます。表示値は丸めています。');
}
document.getElementById('damageLabel').onclick=()=>{if(!damageCalculation)return;renderDamageCalculation(damageCalculation);$('damageDialog').showModal();};
document.getElementById('closeDamage').onclick=()=>$('damageDialog').close();
