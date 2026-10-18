(function(root){
 if(!root.GridEffects&&typeof require==='function')root.GridEffects=require('./grid-effects.js');
 if(!root.PitchCombat&&typeof require==='function')root.PitchCombat=require('./pitch-combat.js');
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const raw=n=>n.inputT??n.rawT??n.t;
 function bass(notes,kicks,bpm,duration,zones){
  if(!notes.length)return {shield:0,strong:0,sustain:0,repetition:0,locked:0,zone:0};
  const slots=new Set(notes.map(n=>root.GridEffects.slot(n,bpm)));
  const strong=[...slots].filter(q=>q%4===0).length;
  const locked=[...slots].filter(q=>kicks.some(n=>n.type==='kick'&&root.GridEffects.slot(n,bpm)===q)).length;
  // Union coverage rewards held notes without rewarding stacked key spam.
  const spans=notes.map(n=>[clamp(raw(n),0,duration),clamp(raw(n)+Math.max(0,n.duration??.12),0,duration)]).sort((a,b)=>a[0]-b[0]);
  let covered=0,end=0;for(const [a,b] of spans){covered+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
  const sustain=covered/duration;
  const repeated=[...slots].filter(q=>q<16&&slots.has(q+16)).length;
  const repetition=2*repeated/Math.max(1,slots.size);
  const zone=0;
  const shield=Math.round((8+Math.min(12,slots.size*1.5)+Math.min(12,strong*3)+18*sustain+Math.min(10,locked*2))*(1+.2*repetition));
  const pitch=root.PitchCombat?.analyze(notes,'bass',bpm,duration),pitchShield=Math.round(shield*(pitch?.effects.shield??0));
  return {shield:shield+pitchShield,rhythmShield:shield,pitchShield,pitch,strong,sustain,repetition,locked,zone};
 }
 function lead(notes,bpm,duration,zones){
  const empty={attack:0,expose:0,accuracy:0,element:0,shieldEfficiency:0,weaken:0,zone:0,description:'Leadなし：支援効果なし。'};
  if(!notes.length)return empty;
  const sorted=[...notes].sort((a,b)=>raw(a)-raw(b));
  const held=clamp(sorted.reduce((s,n)=>s+(n.duration??.12),0)/duration);
  const off=sorted.filter(n=>root.GridEffects.slot(n,bpm)%4!==0).length/sorted.length;
  const zone=0;
  const result={attack:.06,expose:(.04+.14*off),accuracy:.025,element:.04,shieldEfficiency:(.05+.2*held),weaken:.03,zone,pitch:root.PitchCombat?.analyze(notes,'lead',bpm,duration)};
  // Pitch effects are applied once, after timbre and ensemble modifiers.
  result.description=result.pitch?.causes.slice(0,2).map(c=>c.label).join(' / ')||'Leadのリズムと長押しで支援';
  return result;
 }
 function enhance(a,drums,bpm,zones,support){
  // Ignore retired P/S/B zones even when supplied by an old debug snapshot.
  const powerHits=0,powerMultiplier=1;
  const supportMultiplier=1+support.attack+support.expose;
  const powerSteps=[{label:'Drums（重さ・溜め・ノリ込み）',value:a.power,multiplier:1},{label:'Leadの攻撃支援・弱点露出',value:a.power*supportMultiplier,multiplier:supportMultiplier}];
  return {...a,power:a.power*supportMultiplier,powerSteps,accuracy:clamp(a.accuracy+support.accuracy,0,.99),effect:clamp(a.effect*(1+support.element)),powerHits,powerMultiplier,breakPower:clamp(a.weight*.45+a.hits/16+support.expose)};
 }
 function receive(hp,shield,attack,reduction=0){
  const incoming=Math.max(0,Math.round(attack*(1-clamp(reduction,0,.65))));
  const absorbed=Math.min(Math.max(0,shield),incoming),damage=Math.min(hp,incoming-absorbed);
  return {incoming,absorbed,damage,shield:Math.max(0,shield-absorbed),hp:Math.max(0,hp-damage)};
 }
 function reduction(lead,bass,ensemble,a){
  const base=Math.min(.55,(lead?.weaken??0)+(ensemble?.bonus.resistance??0)+(a.count&&a.element==='earth'?.2*a.effect:0)+(a.timbreWeaken??0));
  const pitch=(lead?.pitch?.effects.weaken??0)+(bass?.pitch?.effects.resistance??0),total=Math.min(.55,base+pitch);
  return {base,total,pitch:total-base};
 }
 root.PerformanceCombat={bass,lead,enhance,receive,reduction};if(typeof module!=='undefined')module.exports=root.PerformanceCombat;
})(typeof window!=='undefined'?window:globalThis);
