/* Rendering consumes the same relative-note analysis as combat. */
(function(root){
 'use strict';
 const colors={up:'#d4f77d',down:'#8edcdd',same:'#efd88b',leap:'#c6b0ff'},icons={up:'↑',down:'↓',same:'＝',leap:'↯'},pct=n=>(n>=0?'+':'')+(n*100).toFixed(1)+'%';
 let selected=null,summary='',lastText='',lastUpdate=0;
 const el=id=>document.getElementById(id);
 function model(){
  let parts=new Map(tracks),bpm=lastBpm||timing().bpm,duration=lastDuration||timing().duration;
  if(replaying&&lastMix)parts=new Map(lastMix.map(t=>[t.voice,t.notes]));
  if(['recording','countin'].includes(state)){bpm=timing().bpm;duration=timing().duration;if(phase==='parts')parts.set(instrumentForTurn(turn).id,notes);}
  if(typeof historyPlaying!=='undefined'&&historyPlaying){const entry=sequenceStore.list().find(e=>e.id===historyPlaying);if(entry){parts=new Map(entry.tracks.map(t=>[t.voice,t.notes]));bpm=entry.bpm;duration=entry.duration;}}
  return {duration,rows:['bass','lead'].map(v=>PitchCombat.analyze(parts.get(v)??[],v,bpm,duration))};
 }
 function draw(p,w,h){
  const data=model(),rows=data.rows.filter(r=>r.points.length);el('scope').parentElement.classList.toggle('pitch-active',!!rows.length);
  if(!rows.length){el('melodyTrend').textContent='';lastText='';return;}
  rows.forEach((row,index)=>{
   const top=12+index*(h-15)/rows.length,height=(h-15)/rows.length-3,min=Math.min(...row.points.map(n=>n.midi)),max=Math.max(min+1,...row.points.map(n=>n.midi));
   const x=n=>22+(w-24)*Math.max(0,n.time)/data.duration,y=n=>top+height*.88-(n.register??(max===min+1&&row.points.every(p=>p.midi===min)?.5:(n.midi-min)/(max-min)))*height*.7;
   p.save();p.fillStyle='#10160fe8';p.fillRect(21,top,w-23,height);p.font='9px Arial';p.fillStyle=row.voice==='bass'?'#8edcdd':'#d4f77d';p.fillText(row.voice==='bass'?'B':'L',3,top+height/2+3);
   for(const e of row.edges){const a=row.points[e.from],b=row.points[e.to];p.strokeStyle=colors[e.kind];p.lineWidth=selected?.voice===row.voice&&selected.indices.includes(e.to)?3:1;p.beginPath();p.moveTo(x(a),y(a));p.lineTo(x(b),y(b));p.stroke();if(w>450){p.fillStyle=colors[e.kind];p.fillText(icons[e.kind],(x(a)+x(b))/2,y(b)-2);}}
   row.points.forEach((n,i)=>{const held=[...heldInputs.values()].find(v=>v.note?.rawT===n.rawT&&v.voice===row.voice),gate=n.duration??(held?Math.max(0,ctx.currentTime-held.at):.05);p.fillStyle=selected?.voice===row.voice&&selected.indices.includes(i)?'#fff':row.voice==='bass'?'#8edcdd':'#d4f77d';p.fillRect(x(n),y(n)-2,Math.max(4,Math.min(w-x(n),(w-24)*gate/data.duration)),4);});p.restore();
  });
  if(savedMusicWindow&&ctx){const x=22+(w-24)*Math.max(0,Math.min(data.duration,ctx.currentTime-savedMusicWindow.start))/data.duration;p.save();p.strokeStyle='#fff';p.lineWidth=1;p.beginPath();p.moveTo(x,0);p.lineTo(x,h);p.stroke();p.restore();}
  if(performance.now()-lastUpdate>150){lastUpdate=performance.now();const text=rows.map(r=>r.voice.toUpperCase()+' '+r.causes.filter(c=>c.value>0).slice(0,2).map(c=>c.label.split('（')[0]).join(' / ')).join(' · ');if(text!==lastText){el('melodyTrend').textContent=text;lastText=text;}}
 }
 function chart(row,duration){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 100');svg.setAttribute('role','img');svg.setAttribute('aria-label',row.voice+'の旋律。上ほど高い音、横幅は長押しの長さ。');
  const min=Math.min(...row.points.map(n=>n.midi)),max=Math.max(min+1,...row.points.map(n=>n.midi)),x=n=>28+565*Math.max(0,n.time)/duration,y=n=>82-(n.register??(max===min+1&&row.points.every(p=>p.midi===min)?.5:(n.midi-min)/(max-min)))*60;
  function shape(tag,attrs){const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);svg.append(node);return node;}
  shape('text',{x:2,y:22,fill:'#a4b99c','font-size':10}).textContent='高';shape('text',{x:2,y:84,fill:'#a4b99c','font-size':10}).textContent='低';
  for(const e of row.edges){const a=row.points[e.from],b=row.points[e.to];shape('line',{x1:x(a),x2:x(b),y1:y(a),y2:y(b),stroke:colors[e.kind],'stroke-width':2,'data-index':e.to});shape('text',{x:(x(a)+x(b))/2,y:(y(a)+y(b))/2-6,fill:colors[e.kind],'font-size':12}).textContent=icons[e.kind];}
  row.points.forEach((n,i)=>{const rect=shape('rect',{x:x(n),y:y(n)-3,width:Math.max(5,Math.min(595-x(n),565*(n.duration??.08)/duration)),height:6,fill:'#d4f77d','data-index':i});const title=document.createElementNS(ns,'title');title.textContent=`MIDI ${n.midi} / ${n.time.toFixed(2)}秒 / ${(n.duration??.08).toFixed(2)}秒`;rect.append(title);});return svg;
 }
 function result(bass,lead,a,resolved){
  selected=null;const container=el('pitchDetails');container.replaceChildren();const rows=[bass?.pitch,lead?.pitch].filter(r=>r?.points.length),lines=[];
  const names={attack:'攻撃',accuracy:'命中効率',element:'属性効果',pierce:'シールド貫通'};
  for(const row of rows){const section=document.createElement('section'),heading=document.createElement('h4');heading.textContent=row.voice.toUpperCase()+' / 音程の原因と効果';section.append(heading,chart(row,lastDuration));
   for(const c of row.causes){let text=c.label,score=Math.abs(c.value);
    if(c.field==='shield'){if(c!==row.causes.find(k=>k.field==='shield'))continue;text=row.causes.filter(k=>k.field==='shield').map(k=>k.label).join(' / ')+' → シールド '+(bass.pitchShieldApplied>=0?'+':'')+bass.pitchShieldApplied+'（音色・盾上限適用後）';score=Math.abs(bass.pitchShieldApplied)/100;}
    else if(c.field==='weaken'||c.field==='resistance'){const reduction=a?PerformanceCombat.reduction(lead,bass,cycleEnsemble,a):null,total=(lead?.pitch?.effects.weaken??0)+(bass?.pitch?.effects.resistance??0),value=reduction&&total?reduction.pitch*c.value/total:c.value;score=Math.abs(value);text+=' → 敵の次回攻撃 −'+(value*100).toFixed(1)+'%'+(a?'（全耐性上限適用後）':'（次のLead後、全耐性上限55%）');}
    else if(a){let value=a.pitchApplied.causes.find(k=>k.voice===row.voice&&k.id===c.id)?.value??c.value;if(c.field==='pierce'&&!resolved.calculation.guard.rate)value=0;score=Math.abs(value);text+=' → '+names[c.field]+' '+pct(value);if(c.field==='element')text+='（属性相性 ×'+(1+.25*value).toFixed(3)+'、土の耐性にも反映）';
     if(c.field==='pierce'){const g=resolved.calculation.guard;text+=g.rate?'（敵軽減 '+(g.rate*100).toFixed(0)+' → '+(g.rate*(1-g.pierce)*100).toFixed(1)+'%）':'（この敵は装甲なし。設定 '+pct(c.value)+'）';}}
    else text+=' → '+(names[c.field]??'耐性')+' '+pct(c.value)+'（次のLead後）';
    const button=document.createElement('button');button.type='button';button.className='pitch-cause';button.textContent=text;
    const highlight=()=>{selected={voice:row.voice,indices:c.field==='shield'?row.causes.filter(k=>k.field==='shield').flatMap(k=>k.indices):c.indices};container.querySelectorAll('[data-index]').forEach(n=>n.classList.toggle('pitch-highlight',n.closest('section')===section&&selected.indices.includes(Number(n.dataset.index))));};button.onmouseenter=button.onfocus=button.onclick=highlight;section.append(button);lines.push({text,score,highlight});
   }const tip=document.createElement('p');tip.textContent=row.voice==='bass'?'低音を多く使えば盾、高音を混ぜれば攻撃支援。上下に動かすと反撃への耐性になります。':row.effects.pierce?'跳躍でシールドを貫通。同じ音の反復を混ぜると、命中低下を補えます。':'上昇は攻撃、下降は反撃の弱体化。小さく動けば属性効果を伸ばせます。';section.append(tip);container.append(section);
  }
  lines.sort((a,b)=>b.score-a.score);const chosen=lines.slice(0,2);if(chosen.some(l=>l.text.includes('シールド貫通')||l.text.includes('狙いづらさ'))){const risk=lines.find(l=>l.text.includes('狙いづらさ')),pierce=lines.find(l=>l.text.includes('シールド貫通'));if(risk&&pierce){chosen[0]=pierce;chosen[1]=risk;}}
  const compact=text=>text.replace(/（[^）]*）/g,'').replace('↯ 大きな跳躍','↯跳躍').replace('↯ 跳躍の狙いづらさ → ','').replace('シールド貫通','貫通').replace('命中効率','命中').replace('シールド','盾').replace('上昇旋律','上昇').replace('下降旋律','下降').replace(/\.0%/g,'%');
  summary=chosen.map(l=>compact(l.text)).join(' / ');el('pitchAnalysis').hidden=!rows.length;el('pitchOutcome').textContent=summary;el('pitchOutcome').title=lines.map(l=>l.text).join('\n');el('pitchOutcome').hidden=!summary;lines[0]?.highlight();
  if(bass?.pitch&&!root.ExperienceUI)battleWaveform?.trigger('pitch',{low:Math.max(0,bass.pitch.effects.shield),high:bass.pitch.effects.attack});root.RidumuUI?.refresh();
 }
 root.PitchUI={draw,result,get summary(){return summary;},clearSelection(){selected=null;},clear(){summary='';selected=null;el('pitchAnalysis').hidden=true;el('pitchOutcome').hidden=true;}};
 try{el('pitchAnalysis').open=localStorage.getItem('ridumu-pitch-details')==='true';}catch{}
 el('pitchAnalysis').addEventListener('toggle',()=>{try{localStorage.setItem('ridumu-pitch-details',String(el('pitchAnalysis').open));}catch{}});
})(globalThis);
