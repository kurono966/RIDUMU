(function(root){
 if(!root.GridEffects&&typeof require==='function')root.GridEffects=require('./grid-effects.js');
 if(!root.PitchCombat&&typeof require==='function')root.PitchCombat=require('./pitch-combat.js');
 if(!root.Rhythm&&typeof require==='function')root.Rhythm=require('./rhythm.js');
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const raw=n=>n.inputT??n.rawT??n.t;
 // Combat copies follow the monophonic voice and observe at most one onset
 // per sixteenth. Recording/audio retain the complete original performance.
 function phrase(notes,bpm,duration){
  const cells=new Map(),step=60/bpm/4;
  for(const n of [...notes].sort((a,b)=>raw(a)-raw(b))){const t=raw(n);if(Number.isFinite(t)&&t>=0&&t<duration)cells.set(Math.floor((t+1e-8)/step),{...n,t,rawT:t,inputT:t});}
  const out=[...cells.values()];
  return out.map((n,i)=>({...n,duration:Math.max(0,Math.min(Number.isFinite(n.duration)?n.duration:.12,(out[i+1]?.t??duration)-n.t))}));
 }
 function attackBeat(intent={}){return intent.strikeBeat??({heavy:8,pierce:6,special:7}[intent.id??intent.intentId]??7);}
 function bass(notes,kicks,bpm,duration,zones,intent={}){
  notes=phrase(notes,bpm,duration);
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
  const step=60/bpm/4,at=(attackBeat(intent)-1)*step*4;
  const anchor=['guard','heal','buff'].includes(intent.id??intent.intentId)?0:notes.reduce((best,n,i)=>{
   const onset=clamp(1-Math.abs(raw(n)-at)/step),held=raw(n)<=at&&raw(n)+n.duration>at?.7:0;
   const gap=raw(n)-(i?raw(notes[i-1])+notes[i-1].duration:0),breath=clamp(gap/(step*4));
   return Math.max(best,Math.max(onset,held)*(.7+.3*breath));
  },0);
  const shield=Math.round(4+8*Math.min(1,strong/4)+20*sustain+10*locked/Math.max(1,slots.size)+8*repetition+10*anchor);
  const pitch=root.PitchCombat?.analyze(notes,'bass',bpm,duration),pitchShield=Math.round(shield*(pitch?.effects.shield??0));
  return {shield:Math.min(72,shield+pitchShield),rhythmShield:shield,pitchShield,pitch,strong,sustain,repetition,locked,zone,prepared:anchor,strikeBeat:attackBeat(intent)};
 }
 function lead(notes,bpm,duration,zones){
  notes=phrase(notes,bpm,duration);
  const empty={attack:0,expose:0,accuracy:0,element:0,shieldEfficiency:0,weaken:0,zone:0,description:'Leadなし：支援効果なし。'};
  if(!notes.length)return empty;
  const sorted=[...notes].sort((a,b)=>raw(a)-raw(b));
  const held=clamp(sorted.reduce((s,n)=>s+(n.duration??.12),0)/duration);
  const off=sorted.filter(n=>root.GridEffects.slot(n,bpm)%4!==0).length/sorted.length;
  const zone=0;
  const form=root.Rhythm.structure(notes,duration,bpm),confidence=clamp((notes.length-1)/3);
  const strong=sorted.filter(n=>root.GridEffects.slot(n,bpm)%4===0).length/sorted.length;
  const result={attack:(.06*strong+.04*form.variation)*confidence,expose:.12*off*confidence,accuracy:.04*form.repetition*confidence,element:.06*form.development*confidence,shieldEfficiency:.2*held*confidence,weaken:.06*form.rest*confidence,pierce:.12*off*confidence,zone,pitch:root.PitchCombat?.analyze(notes,'lead',bpm,duration)};
  // Pitch effects are applied once, after timbre and ensemble modifiers.
  const placement=confidence?off>.5?'裏拍で弱点露出・貫通':strong>.5?'表拍で攻撃支援':held>.4?'長音で盾を支援':'フレーズの間で弱体化':'短い旋律：効果を探る';
  result.description=[placement,...(result.pitch?.causes.slice(0,1).map(c=>c.label)??[])].join(' / ');
  return result;
 }
 function enhance(a,drums,bpm,zones,support){
  // Ignore retired P/S/B zones even when supplied by an old debug snapshot.
  const powerHits=0,powerMultiplier=1;
  const supportMultiplier=1+support.attack+support.expose;
  const powerSteps=[{label:'Drums（重さ・溜め・ノリ込み）',value:a.power,multiplier:1},{label:'Leadの攻撃支援・弱点露出',value:a.power*supportMultiplier,multiplier:supportMultiplier}];
  return {...a,power:a.power*supportMultiplier,powerSteps,accuracy:clamp(a.accuracy+support.accuracy,0,.99),effect:clamp(a.effect*(1+support.element)),rhythmPierce:support.pierce??0,powerHits,powerMultiplier,breakPower:clamp(a.weight*.45+a.hits/16+support.expose)};
 }
 function tactics(a,bass,lead,intent={}){
  const s=a.structure??{},confidence=clamp((a.count??0)/4),safe=n=>clamp(Number.isFinite(n)?n:0);
  const guardBreak=safe(confidence*(.65*safe(a.syncopation)+.2*safe(a.offbeat)+.25*safe(s.variation))+.15*safe(lead?.expose));
  const stagger=Math.min(.45,confidence*(.2*safe(a.weight)+.15*safe(a.charged)+.1*safe(s.rest))+.15*safe(bass?.prepared));
  const disrupt=Math.min(.7,confidence*(.45*safe(a.snareBurst)+.25*safe(a.bursts)+.25*safe(s.variation)+.2*safe(s.dialogue)));
  const healBlock=safe(confidence*(1.25*safe(a.densityRise)+.35*safe(a.bursts)+.3*safe(s.tensionRelease)));
  const buffSuppress=safe(confidence*(.6*safe(a.syncopation)+.35*safe(s.variation)+.3*safe(s.dialogue)+.25*safe(s.tensionRelease)));
  const id=intent.id??intent.intentId;
  const values={guard:guardBreak,heavy:stagger,pierce:disrupt,heal:healBlock,buff:buffSuppress};
  const names={guard:'裏拍・変化でガード崩し',heavy:'重いKickとBassで強打を軽減',pierce:'Snare・掛け合いで貫通を妨害',heal:'後半加速で回復を阻止',buff:'変則アクセントで強化を抑制'};
  return {guardBreak,stagger,disrupt,healBlock,buffSuppress,value:values[id]??0,label:names[id]??''};
 }
 function enemyAction(enemy,hp,intent,tactic){
  if(intent.id==='guard')return {guard:clamp((enemy.guard??0)+.15-.3*tactic.guardBreak,0,.65)};
  if(intent.id==='heal'){const healed=Math.max(0,Math.min(enemy.hp-hp,Math.round(enemy.hp*.12*(1-tactic.healBlock))));return {hp:hp+healed,healed};}
  if(intent.id==='buff')return {attack:Math.min(enemy.attackCap??enemy.attack*1.6,enemy.attack+Math.round(enemy.attack*.15*(1-tactic.buffSuppress)))};
  return {};
 }
 function receive(hp,shield,attack,reduction=0){
  const incoming=Math.max(0,Math.round(attack*(1-clamp(reduction,0,.65))));
  const absorbed=Math.min(Math.max(0,shield),incoming),damage=Math.min(hp,incoming-absorbed);
  return {incoming,absorbed,damage,shield:Math.max(0,shield-absorbed),hp:Math.max(0,hp-damage)};
 }
 function counterAttack(hp,shield,attack,intent,reduction,tactic){
  const disruption=intent.id==='heavy'?tactic.stagger:intent.id==='pierce'?.25*tactic.disrupt:0;
  const incoming=Math.max(0,Math.round(attack*(1-disruption)*(1-clamp(reduction,0,.55))));
  const pierce=clamp(intent.pierce??0)*(intent.id==='pierce'?1-tactic.disrupt:1);
  const bypass=Math.round(incoming*pierce),absorbed=Math.min(Math.max(0,shield),incoming-bypass),damage=Math.min(hp,incoming-absorbed);
  return {incoming,pierce,absorbed,damage,shield:Math.max(0,shield-absorbed),hp:Math.max(0,hp-damage)};
 }
 function reduction(lead,bass,ensemble,a){
  const base=Math.min(.55,(lead?.weaken??0)+(ensemble?.bonus.resistance??0)+(a.count&&a.element==='earth'?.2*a.effect:0)+(a.timbreWeaken??0));
  const pitch=(lead?.pitch?.effects.weaken??0)+(bass?.pitch?.effects.resistance??0),total=Math.min(.55,base+pitch);
  return {base,total,pitch:total-base};
 }
 root.PerformanceCombat={bass,lead,enhance,receive,reduction,phrase,attackBeat,tactics,enemyAction,counterAttack};if(typeof module!=='undefined')module.exports=root.PerformanceCombat;
})(typeof window!=='undefined'?window:globalThis);
