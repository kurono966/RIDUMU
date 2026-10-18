/* Relative monophonic melody analysis. No harmony or random rolls. */
(function(root){
 'use strict';
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const time=n=>n.inputT??n.rawT??n.t;
 const scale=[0,2,3,5,7,8,10,12,14];
 function midi(n,voice){return Number.isInteger(n.midi)?n.midi:(voice==='bass'?36:60)+(Number.isInteger(n.pitch)?scale[n.pitch]??0:n.type==='snare'?(voice==='bass'?7:3):0);}
 function register(m,palette){const keys=[...new Set(palette)].sort((a,b)=>a-b);return keys.length<2?.5:clamp(keys.filter(k=>k<m).length/(keys.length-1));}
 function analyze(notes,voice,bpm=120,duration=4){
  // Last note wins at a simultaneous onset, as in the monophonic audio engine.
  // At most one observation per sixteenth prevents trill/key-spam inflation.
  const cells=new Map(),step=60/bpm/4;
  for(const n of [...notes].sort((a,b)=>time(a)-time(b))){const t=time(n);if(!Number.isFinite(t)||t<-.2||t>=duration)continue;cells.set(clamp(Math.floor((Math.max(0,t)+1e-8)/step),0,31),{...n,midi:midi(n,voice),time:t});}
  const points=[...cells.values()].sort((a,b)=>a.time-b.time),palette=points.map(n=>n.midi),edges=[];
  let up=0,down=0,same=0,small=0,medium=0,leap=0,reversals=0,lastSign=0,total=0;
  for(let i=1;i<points.length;i++){const d=points[i].midi-points[i-1].midi,abs=Math.abs(d),sign=Math.sign(d),kind=!d?'same':abs>=7?'leap':d>0?'up':'down';
   if(d>0)up++;else if(d<0)down++;else same++;
   if(abs>0&&abs<=2)small++;else if(abs>=3&&abs<=6)medium++;else if(abs>=7)leap++;
   if(sign&&lastSign&&sign!==lastSign)reversals++;if(sign)lastSign=sign;total+=abs;
   edges.push({from:i-1,to:i,semitones:d,kind});
  }
  const pairs=edges.length,den=Math.max(1,pairs),confidence=Math.min(1,pairs/3),net=points.length?points.at(-1).midi-points[0].midi:0;
  const ratios={up:up/den,down:down/den,same:same/den,small:small/den,medium:medium/den,leap:leap/den};
  const effects={attack:0,accuracy:0,element:0,weaken:0,pierce:0,shield:0,resistance:0};
  const causes=[];const add=(id,label,field,value,indices)=>{if(Math.abs(value)<1e-9)return;effects[field]+=value;causes.push({id,label,field,value,indices});};
  const ids=test=>edges.filter(test).flatMap(e=>[e.from,e.to]);
  if(voice==='lead'){
   add('rise','↑ 上昇旋律','attack',.12*ratios.up*(.5+.5*Math.max(0,net)/Math.max(1,total))*confidence,ids(e=>e.semitones>0));
   add('fall','↓ 下降旋律','weaken',.16*ratios.down*(.5+.5*Math.max(0,-net)/Math.max(1,total))*confidence,ids(e=>e.semitones<0));
   add('repeat','＝ 同音反復','accuracy',.06*ratios.same*confidence,ids(e=>!e.semitones));
   add('small','· 小さな移動（1–2半音）','element',.18*ratios.small*confidence,ids(e=>Math.abs(e.semitones)>0&&Math.abs(e.semitones)<=2));
   add('medium','↗ 中程度の移動（3–6半音）','attack',.10*ratios.medium*confidence,ids(e=>Math.abs(e.semitones)>=3&&Math.abs(e.semitones)<=6));
   add('leap','↯ 大きな跳躍（7半音以上）','pierce',.30*ratios.leap*confidence,ids(e=>Math.abs(e.semitones)>=7));
   add('risk','↯ 跳躍の狙いづらさ','accuracy',-.05*ratios.leap*confidence,ids(e=>Math.abs(e.semitones)>=7));
  }else if(voice==='bass'&&points.length){
   const positions=points.map(n=>Number.isFinite(n.register)?clamp(n.register):register(n.midi,palette));
   const low=positions.reduce((s,r)=>s+Math.max(0,.5-r)*2,0)/points.length,high=positions.reduce((s,r)=>s+Math.max(0,r-.5)*2,0)/points.length;
   add('low','▰ 低音中心','shield',.16*low,positions.flatMap((r,i)=>r<.5?[i]:[]));
   add('highCost','↗ 高音の盾変換','shield',-.12*high,positions.flatMap((r,i)=>r>.5?[i]:[]));
   add('high','↗ 高音の攻撃支援','attack',.10*high,positions.flatMap((r,i)=>r>.5?[i]:[]));
   add('steady','＝ 同音の防壁','shield',.08*ratios.same*confidence,ids(e=>!e.semitones));
   add('wave','↕ 上下の旋律','resistance',.12*reversals/Math.max(1,up+down-1)*confidence,ids(e=>!!e.semitones));
  }
  return {version:1,voice,points,edges,ratios,confidence,effects,causes};
 }
 function apply(a,bass,lead){
  const b=bass?.effects??{},l=lead?.effects??{},attack=clamp((b.attack??0)+(l.attack??0),0,.32),effect=clamp(a.effect*(1+(l.element??0))),power=a.power*(1+attack),causes=[];
  let accuracy=a.accuracy;
  for(const row of [bass,lead])for(const c of row?.causes??[]){let value=c.value;if(c.field==='accuracy'){const next=clamp(accuracy+c.value,0,.99);value=next-accuracy;accuracy=next;}if(c.field==='element')value=a.effect?effect/a.effect-1:0;causes.push({...c,voice:row.voice,value});}
  return {...a,power,accuracy,effect,pitchElementBoost:a.effect?effect/a.effect-1:0,pitchPierce:clamp(l.pierce??0,0,.3),pitchApplied:{attack,accuracy:accuracy-a.accuracy,element:a.effect?effect/a.effect-1:0,pierce:clamp(l.pierce??0,0,.3),causes},powerSteps:[...(a.powerSteps??[]),{label:'音程：上昇・中音程・高音Bass',value:power,multiplier:1+attack}]};
 }
 const api={analyze,apply,register,midi};root.PitchCombat=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
