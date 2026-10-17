(function(root){
 if(!root.GridEffects&&typeof require==='function')root.GridEffects=require('./grid-effects.js');
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
  const zone=root.GridEffects.inspect(notes,'bass',zones,bpm).shield??0;
  const shield=Math.round((8+Math.min(12,slots.size*1.5)+Math.min(12,strong*3)+18*sustain+Math.min(10,locked*2))*(1+.2*repetition)+Math.min(15,zone*5));
  return {shield,strong,sustain,repetition,locked,zone};
 }
 function lead(notes,bpm,duration,zones){
  const empty={attack:0,expose:0,accuracy:0,element:0,shieldEfficiency:0,weaken:0,zone:0,description:'Leadなし：支援効果なし。'};
  if(!notes.length)return empty;
  const sorted=[...notes].sort((a,b)=>raw(a)-raw(b)),pitches=sorted.map(n=>n.midi??(60+(n.pitch??0)*2));
  let rising=0,falling=0,same=0;for(let i=1;i<pitches.length;i++){if(pitches[i]>pitches[i-1])rising++;else if(pitches[i]<pitches[i-1])falling++;else same++;}
  const pairs=Math.max(1,pitches.length-1),unique=new Set(pitches.map(p=>p%12)).size;
  const held=clamp(sorted.reduce((s,n)=>s+(n.duration??.12),0)/duration);
  const off=sorted.filter(n=>root.GridEffects.slot(n,bpm)%4!==0).length/sorted.length;
  const zone=root.GridEffects.inspect(notes,'lead',zones,bpm).boost??0,mult=1+Math.min(.6,zone*.2);
  const result={attack:(.06+.16*rising/pairs)*mult,expose:(.04+.14*off)*mult,accuracy:(.025+.075*same/pairs)*mult,element:(.04+.1*clamp(unique/5))*mult,shieldEfficiency:(.05+.2*held)*mult,weaken:(.03+.15*falling/pairs)*mult,zone};
  result.description=rising>falling&&rising>same?'上昇フレーズ → 攻撃を後押し':falling>rising&&falling>same?'下降フレーズ → 敵の攻撃を弱めた':held>.45?'長い旋律 → シールド効率上昇':'繰り返す旋律 → 命中を支援';
  return result;
 }
 function enhance(a,drums,bpm,zones,support){
  const powerHits=root.GridEffects.inspect(drums,'drums',zones,bpm).power??0;
  const powerMultiplier=1+Math.min(.24,powerHits*.08);
  return {...a,power:a.power*powerMultiplier*(1+support.attack+support.expose),accuracy:clamp(a.accuracy+support.accuracy,0,.99),effect:clamp(a.effect*(1+support.element)),powerHits,powerMultiplier,breakPower:clamp(a.weight*.45+a.hits/16+support.expose)};
 }
 function receive(hp,shield,attack,reduction=0){
  const incoming=Math.max(0,Math.round(attack*(1-clamp(reduction,0,.65))));
  const absorbed=Math.min(Math.max(0,shield),incoming),damage=Math.min(hp,incoming-absorbed);
  return {incoming,absorbed,damage,shield:Math.max(0,shield-absorbed),hp:Math.max(0,hp-damage)};
 }
 root.PerformanceCombat={bass,lead,enhance,receive};if(typeof module!=='undefined')module.exports=root.PerformanceCombat;
})(typeof window!=='undefined'?window:globalThis);
