/* Enable explicitly with ?debug=1. Not persisted to normal play. */
(function(){
 const enabled=new URLSearchParams(location.search).get('debug')==='1'||location.hash==='#debug';
 const button=document.getElementById('openDebug');button.hidden=!enabled;
 if(!enabled)return;
 for(const [id,mode] of [['debugMaxDamage','max'],['debugMinDamage','min']])$(id).onclick=()=>{
  if(globalThis.autoInputDamageChart?.(mode)){$('debugDialog').close();$('debugAutoStatus').textContent='';}
  else $('debugAutoStatus').textContent='Drumsの演奏開始前（READY）に実行してください。';
 };
 let snapshot=null;
 globalThis.captureEvaluationDebug=value=>{snapshot=JSON.parse(JSON.stringify(value));};
 function refresh(){
  const container=$('debugResults');container.replaceChildren();
  if(!snapshot){container.textContent='演奏を記録してから開いてください。録音済みのパートで比較できます。';return;}
  const {parts,hats,bpm,duration,zones,enemy}=snapshot;
  const {normal,quantized}=EvaluationDebug.compare(new Map(parts),hats,bpm,duration,zones,enemy,$('debugPreset').value);
  const context=document.createElement('p');context.textContent=enemy.name+' / BPM '+bpm+' / 録音終了時のゾーンで比較';container.append(context);
  const table=document.createElement('table'),row=(label,a,b)=>{const tr=document.createElement('tr');for(const text of [label,a,b]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);};
  row('評価項目','通常評価','補正後の位置を評価');
  row('合計ダメージ',normal.result.total,quantized.result.total);
  row('HIT別ダメージ',normal.result.damages.join(' / ')||'0',quantized.result.damages.join(' / ')||'0');
  row('Drumsの評価音数',normal.analysis.count,quantized.analysis.count);
  row('精度評価の元入力数',normal.analysis.performanceQuality.count,quantized.analysis.performanceQuality.count);
  row('リズム精度倍率',normal.analysis.performanceQuality.multiplier.toFixed(3),quantized.analysis.performanceQuality.multiplier.toFixed(3));
  row('規則性',normal.analysis.performanceQuality.regularity.toFixed(3),quantized.analysis.performanceQuality.regularity.toFixed(3));
  row('反復性',normal.analysis.performanceQuality.repetition.toFixed(3),quantized.analysis.performanceQuality.repetition.toFixed(3));
  row('属性',elements[normal.analysis.element][0],elements[quantized.analysis.element][0]);
  row('敵相性倍率',normal.result.affinity.toFixed(3),quantized.result.affinity.toFixed(3));
  row('新規生成する盾',normal.shield,quantized.shield);
  row('予告への対応',normal.tactics.label||'なし',quantized.tactics.label||'なし');
  row('行動への干渉',Math.round(normal.tactics.value*100)+'%',Math.round(quantized.tactics.value*100)+'%');
  row('Bassの防御準備',Math.round((normal.bass.prepared??0)*100)+'%',Math.round((quantized.bass.prepared??0)*100)+'%');
  row('シナジー',normal.ensemble.selected.map(s=>s.name).join(' / ')||'なし',quantized.ensemble.selected.map(s=>s.name).join(' / ')||'なし');
  for(const id of ['tight','laidBack','pushed','snarePushed','pocket','swing','drunk','unstable'])row(id,normal.groove[id].toFixed(3),quantized.groove[id].toFixed(3));
  container.append(table);
  const heading=document.createElement('h3');heading.textContent='補正後の32ステップ（評価対象）';container.append(heading);
  for(const [voice,notes] of Object.entries({...quantized.parts,hat:quantized.hat})){
   const line=document.createElement('p');line.className='debug-sequence';
   const slots=new Set(notes.map(n=>GridEffects.slot(n,bpm)));
   line.textContent=voice.toUpperCase()+'\n'+Array.from({length:32},(_,q)=>(q%4===0?' ': '')+(slots.has(q)?'●':'·')).join('');container.append(line);
  }
 }
 button.onclick=()=>{refresh();$('debugDialog').showModal();};
 $('closeDebug').onclick=()=>$('debugDialog').close();$('debugPreset').onchange=refresh;
})();
