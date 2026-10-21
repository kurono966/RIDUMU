/* Analysis uses a 16th-note grid. Playback and sound retain raw timestamps. */
(function(root){
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
function structure(input,duration=4,bpm=120){
 const step=60/bpm/4,slots=Math.max(1,Math.round(duration/step)),masks=Array(slots).fill(0);
 for(const n of input)for(const t of n.inputTimes??[n.inputT??n.rawT??n.t]){if(Number.isFinite(t)&&t>=0&&t<duration&&['kick','snare'].includes(n.type))masks[Math.min(slots-1,Math.floor(t/step+1e-7))]|=n.type==='kick'?1:2;}
 const half=Math.floor(slots/2),occupied=masks.filter(Boolean).length,confidence=clamp((occupied-2)/4);
 let common=0,changed=0,union=0;
 for(let q=0;q<half;q++){if(masks[q]||masks[q+half]){union++;if(masks[q]&&masks[q]===masks[q+half])common++;else changed++;}}
 const repetition=common/Math.max(1,union),variation=clamp(4*repetition*changed/Math.max(1,union))*confidence;
 const positions=masks.flatMap((m,q)=>m?[q]:[]),gaps=positions.slice(1).map((q,i)=>q-positions[i]);
 const rest=clamp(gaps.filter(g=>g>=3&&g<=8).length/Math.max(1,gaps.length))*confidence;
 const windows=Array.from({length:4},(_,i)=>masks.slice(i*slots/4,(i+1)*slots/4).filter(Boolean).length);
 const tensionRelease=clamp((Math.max(windows[1],windows[2])-windows[0])/4)*clamp((windows[2]-windows[3])/3)*confidence;
 const lane=part=>{const k=part.filter(m=>m&1).length,s=part.filter(m=>m&2).length;return (k-s)/Math.max(1,k+s);};
 const dialogue=clamp(-lane(masks.slice(0,half))*lane(masks.slice(half)))*confidence;
 return {repetition,variation,rest,tensionRelease,dialogue,confidence,development:Math.max(variation,tensionRelease,dialogue)};
}
function performanceQuality(input,bpm,duration){
 const beat=60/bpm,step=beat/4;
 const events=input.flatMap(n=>(n.inputTimes??[n.inputT??n.rawT??n.t]).map(t=>({t,type:n.type}))).filter(n=>Number.isFinite(n.t)&&n.t>=-beat&&n.t<duration).sort((a,b)=>a.t-b.t);
 const mean=values=>values.reduce((s,n)=>s+n,0)/Math.max(1,values.length);
 // Simultaneous Kick/Snare is one onset for spacing, but two voices for motifs.
 const onsets=[],voices=new Set();for(const n of events){
  if(!onsets.length||n.t-onsets.at(-1)>beat*.035||voices.has(n.type)){onsets.push(n.t);voices.clear();}
  voices.add(n.type);
 }
 const intervals=onsets.slice(1).map((t,i)=>t-onsets[i]),average=mean(intervals);
 const deviation=Math.sqrt(mean(intervals.map(t=>(t-average)**2)));
 const regularity=intervals.length>=2?clamp(1-deviation/Math.max(.01,average))*clamp(average/(step*.25)):0;
 let repetition=0,timingConsistency=0;
 for(const period of [8,16]){
  const groups=new Map();
  for(const n of events){const q=Math.round(n.t/step),key=((q%period)+period)%period+':'+n.type,cycle=Math.floor(q/period);
   if(!groups.has(key))groups.set(key,new Map());const cycles=groups.get(key);
   if(!cycles.has(cycle))cycles.set(cycle,[]);cycles.get(cycle).push(n.t-q*step);
  }
  let matched=0;const errors=[];
  for(const cycles of groups.values())if(cycles.size>=2){const offsets=[...cycles.values()].map(mean),center=mean(offsets);matched+=offsets.length;errors.push(...offsets.map(t=>Math.abs(t-center)));}
  const consistency=errors.length?Math.exp(-mean(errors)/(beat*.045)):0,score=matched/Math.max(1,events.length)*consistency;
  if(score>repetition){repetition=score;timingConsistency=consistency;}
 }
 // A controlled acceleration is a phrase, even though its intervals are unequal.
 // Require enough evidence, a clear speed change and precise subdivision timing;
 // random spacing or merely adding notes cannot earn this alternative score.
 const precision=Math.exp(-mean(onsets.map(t=>Math.abs(t-Math.round(t/step)*step)))/(beat*.025));
 const orderly=intervals.slice(1).filter((gap,i)=>gap<=intervals[i]+beat*.025).length/Math.max(1,intervals.length-1);
 const accelerating=onsets.length>=6&&orderly>=.85&&mean(intervals.slice(-3))<.7*mean(intervals.slice(0,3))?.82*precision:0;
 const score=clamp(Math.max(regularity,repetition,accelerating)),confidence=clamp((onsets.length-3)/5);
 // Sparse heavy attacks stay neutral: too little evidence is not poor playing.
 // Add a rising reward only above solid consistency; chaotic input keeps its
 // existing penalty instead of receiving the same general damage increase.
 const skillBonus=.4*Math.pow(clamp((score-.65)/.35),2);
 const multiplier=clamp(1+confidence*(.4+.8*score+skillBonus-1),.4,2.2);
 return {count:events.length,regularity,repetition,timingConsistency,score,confidence,multiplier};
}
function analyze(input,duration=4,bpm=120){
 const notes=input.filter(n=>Number.isFinite(n.t)&&n.t>=0&&n.t<duration&&['kick','snare'].includes(n.type)).sort((a,b)=>a.t-b.t);
 const step=60/bpm/4, slots=Math.round(duration/step), grid=notes.map(n=>({...n,q:Math.min(slots-1,Math.round(n.t/step))}));
 const count=notes.length,kick=notes.filter(n=>n.type==='kick').length,snare=count-kick;
 const intervals=notes.slice(1).map((n,i)=>n.t-notes[i].t),mean=intervals.length?intervals.reduce((a,b)=>a+b,0)/intervals.length:duration;
 const deviation=intervals.length?Math.sqrt(intervals.reduce((s,x)=>s+(x-mean)**2,0)/intervals.length):0;
 const regularity=intervals.length>1?clamp(1-deviation/Math.max(mean,.04)):count>1?.5:0;
 const alternation=intervals.length?notes.slice(1).filter((n,i)=>n.type!==notes[i].type).length/intervals.length:0;
 const masks=Array(slots).fill(0);grid.forEach(n=>masks[n.q]|=n.type==='kick'?1:2);
 let equal=0,occupied=0;for(let i=8;i<slots;i++){if(masks[i]||masks[i-8]){occupied++;if(masks[i]===masks[i-8])equal++;}}
 const repetition=occupied?equal/occupied:0;
 const first=notes.filter(n=>n.t<duration/2).length,second=count-first,rise=clamp((second-first)/Math.max(3,count));
 const gaps=[notes[0]?.t??duration,...intervals,duration-(notes.at(-1)?.t??0)],longestGap=Math.max(...gaps);
 const beat=60/bpm;
 const bursts=intervals.filter(x=>x<beat*.36).length/Math.max(1,intervals.length);
 const snareBurst=notes.slice(1).filter((n,i)=>n.type==='snare'&&notes[i].type==='snare'&&n.t-notes[i].t<beat*.36).length/Math.max(1,snare);
 const offbeat=grid.filter(n=>n.q%4!==0).length/Math.max(1,count);
 const syncopation=grid.filter(n=>n.q%4!==0&&!masks[Math.min(slots-1,n.q+(4-n.q%4))]).length/Math.max(1,count);
 const charged=notes.reduce((best,n,i)=>n.type==='kick'?Math.max(best,clamp((n.t-(i?notes[i-1].t:0)-beat*.8)/(beat*2.2))):best,0);
 const density=count/duration,high=clamp(count/24),low=1-high,kRatio=kick/Math.max(1,count),sRatio=snare/Math.max(1,count),irregularity=count>2?1-regularity:0;
 const concentration=clamp(Math.max(...Array.from({length:8},(_,i)=>notes.filter(n=>n.t>=i*duration/8&&n.t<(i+1)*duration/8).length))/Math.max(1,count));
 // Intentional offbeat accents must compete with kick/snare identity rather
 // than being drowned out by the count of kicks (earth) or snares (wind).
 // Weak 16th subdivisions alone are not proof of syncopation: emphasize
 // offbeat eighths and the absence of the following downbeat.
 const offbeatEighths=grid.filter(n=>n.q%4===2).length/Math.max(1,count);
 const syncopatedEighths=grid.filter(n=>n.q%4===2&&!masks[Math.min(slots-1,n.q+2)]).length/Math.max(1,count);
 // Continuous subdivision is a steady pulse, not an intentional offbeat accent.
 // Keep lightning for broken beats and irregular phrases while preserving the
 // instrument identity of steady kicks and the handoff of alternating drums.
 const lightningIntent=1-.85*regularity*(1-syncopation);
 const lightningAccent=clamp(.55*offbeat+.8*syncopation+.65*offbeatEighths+.55*syncopatedEighths)*clamp((count-3)/5)*(1-.85*rise)*lightningIntent;
 const competingPenalty=.85*lightningAccent;
 const scores={earth:1.15*kRatio+.65*low+.45*regularity+.55*charged+.35*kRatio*regularity-competingPenalty,wind:1.15*sRatio+.6*high+.3*bursts+.25*alternation+.85*alternation*regularity-competingPenalty,fire:1.65*rise+.65*bursts+.5*concentration+.2*high,lightning:(.85*syncopation+.6*offbeat)*lightningIntent+.65*irregularity+1.25*lightningAccent};
 const element=Object.keys(scores).reduce((a,b)=>scores[a]>=scores[b]?a:b);
 const weight=clamp(.5*kRatio+.3*low+.45*charged-.2*snareBurst),hits=Math.max(1,Math.min(8,Math.round(1+high*4+bursts*2+snareBurst*2-weight*2)));
 const power=count?24+18*weight+12*charged+3*alternation+8*clamp(count/8):0;
 const accuracy=clamp(.79+.12*regularity+.08*repetition,.6,.98);
 return {duration,bpm,step,count,kick,snare,density,meanInterval:mean,regularity,alternation,repetition,performanceQuality:performanceQuality(notes,bpm,duration),structure:structure(notes,duration,bpm),firstDensity:first/(duration/2),secondDensity:second/(duration/2),densityRise:rise,longestGap,hasLongGap:longestGap>=beat*1.5,bursts,snareBurst,offbeat,syncopation,charged,concentration,scores,element,weight,hits,power,accuracy,effect:clamp(.3+.45*irregularity+.25*scores[element]/2.5),grid,masks,slots};
}
function resolve(a,enemy){
 let affinity=1,aim=a.accuracy;
 if(enemy.kind==='stone'){affinity=a.element==='earth'?1.35:1;affinity*=.8+.45*a.weight;}
 if(enemy.kind==='fly'){affinity=a.element==='wind'?1.4:1;affinity*=.9+.25*clamp(a.density/6);aim-=.24*a.weight*(1-(a.groove?.swing??0));}
 if(enemy.kind==='machine')affinity=a.element==='lightning'?1.45:1;
 if(enemy.kind==='stone'&&a.element==='fire')affinity*=1.12;
 if(enemy.kind==='plant')affinity=a.element==='fire'?1.5:a.element==='wind'?.85:1;
 if(enemy.kind==='ghost'){affinity=a.element==='lightning'?1.3:a.element==='earth'?.85:1;aim-=.14*(1-Math.max(a.groove?.laidBack??0,a.groove?.drunk??0,a.groove?.swing??0));}
 if(enemy.kind==='crystal'){affinity=a.element==='earth'?1.25:a.element==='lightning'?.85:1;affinity*=.9+.3*a.alternation;}
 if(enemy.kind==='furnace'){affinity=a.element==='wind'?1.55:a.element==='fire'?.8:a.element==='lightning'?.85:1;affinity*=.9+.3*(a.structure?.rest??0);}
 if(enemy.kind==='conductor'){affinity=a.element==='fire'?1.6:a.element==='lightning'?.65:1;affinity*=.9+.25*(a.structure?.variation??0)+.15*(a.structure?.tensionRelease??0);}
 // Lightning trades neutral coverage for its machine/ghost specialization.
 if(a.element==='lightning'&&['stone','fly','plant'].includes(enemy.kind))affinity*=.85;
 // A perfectly even Kick/Snare alternation is one viable style, not a universal
 // answer. Contrast rhythm motifs across enemies; do not punish all repetition.
 const straight=clamp(((a.alternation??0)-.65)/.35)*clamp(((a.regularity??0)-.65)/.35)*clamp(((a.repetition??0)-.35)/.65);
 const motifs={
  stone:{label:'岩への重いキック・間',fit:clamp(.65*(a.weight??0)+.35*(a.charged??0)),straightPenalty:.65},
  fly:{label:'翼獣への交互の刻み',fit:clamp(.7*(a.alternation??0)+.3*(a.regularity??0)),straightPenalty:0},
  machine:{label:'機械への裏拍・シンコペーション',fit:clamp(.65*(a.syncopation??0)+.35*(a.offbeat??0)),straightPenalty:.65},
  plant:{label:'植物への後半加速・連打',fit:clamp(.7*(a.densityRise??0)+.3*(a.bursts??0)),straightPenalty:.65},
  ghost:{label:'残響への揺れ・不規則な間',fit:clamp(.55*(a.groove?.drunk??0)+.25*(a.groove?.laidBack??0)+.2*(1-(a.regularity??1))),straightPenalty:.65},
  crystal:{label:'晶殻への交互の刻み',fit:clamp(.65*(a.alternation??0)+.35*(a.regularity??0)),straightPenalty:0},
  furnace:{label:'炉心への休符・掛け合い',fit:clamp(.55*(a.structure?.rest??0)+.45*(a.structure?.dialogue??0)),straightPenalty:0},
  conductor:{label:'終奏へのモチーフ変化・解放',fit:clamp(.6*(a.structure?.variation??0)+.4*(a.structure?.tensionRelease??0)),straightPenalty:0}
 };
 const motif=motifs[enemy.kind];
 const form=a.structure??{},development=enemy.kind==='plant'?form.tensionRelease:enemy.kind==='machine'?form.variation:enemy.kind==='ghost'?form.dialogue:enemy.kind==='stone'?form.rest:enemy.kind==='furnace'?form.dialogue:enemy.kind==='conductor'?Math.max(form.variation??0,form.tensionRelease??0):form.repetition;
 const motifMultiplier=motif?clamp(1+(enemy.kind==='conductor'?.8:.4)*motif.fit+.12*(development??0)-motif.straightPenalty*straight,.3,enemy.kind==='conductor'?1.9:1.5):1;
 // Defensive intent creates a reason to change the beat instead of repeating
 // the same alternating kick/snare loop every battle.
 const intent=enemy.intentId;
 let tactical=1,tacticalLabel='';
 if(intent==='guard'){
  tactical=1+.35*a.syncopation+.15*a.offbeat;
  tacticalLabel='防御態勢への裏拍・シンコペーション';
 }else if(intent==='heavy'){
  tactical=1+.35*a.weight+.25*a.charged;
  tacticalLabel='強打への重いキック';
 }else if(intent==='pierce'){
  tactical=1+.55*a.snareBurst+.2*a.bursts;
  tacticalLabel='貫通へのスネア連打';
 }else if(intent==='heal'){
  tactical=1+.4*a.densityRise+.15*a.bursts;
  tacticalLabel='回復への後半加速';
 }else if(intent==='buff'){
  tactical=1+.3*a.syncopation+.15*a.bursts;
  tacticalLabel='強化への変則リズム';
 }
 const affinitySteps=[{label:'属性・攻撃形態と敵の相性',multiplier:affinity}];
 if(a.groove){
  const choices=enemy.kind==='stone'?[['laidBack',.25],['pocket',.12]]:enemy.kind==='fly'?[['pushed',.25],['snarePushed',.2],['swing',.18]]:enemy.kind==='machine'?[['tight',.2],['drunk',.26]]:enemy.kind==='plant'?[['swing',.18],['laidBack',.12]]:enemy.kind==='ghost'?[['laidBack',.25],['drunk',.25]]:enemy.kind==='crystal'?[['pocket',.2],['tight',.15]]:enemy.kind==='furnace'?[['swing',.18],['pocket',.15]]:enemy.kind==='conductor'?[['tight',.15],['laidBack',.12]]:[];
  // Correlated feels share one affinity reward.
  const [id,strength]=choices.reduce((best,next)=>next[1]*(a.groove[next[0]]??0)>best[1]*(a.groove[best[0]]??0)?next:best,['tight',0]);
  const multiplier=1+strength*(a.groove[id]??0);affinity*=multiplier;if(multiplier!==1)affinitySteps.push({label:'敵とのグルーヴ相性：'+id,multiplier});
 }
 // Increase contrast around neutral (1x): rewarding a match and resisting a bad
 // matchup use the same continuous curve. Cap stacked weaknesses and grooves.
 const originalAffinity=affinity;
 affinity=clamp(Math.pow(originalAffinity,1.65),.4,3);
 affinitySteps.push({label:'相性メリハリ補正（有効↑・苦手↓）',multiplier:affinity/originalAffinity});
 // Intent rewards are linear: do not exponentiate the same syncopation that
 // already determines lightning's identity. Preserve the combined 3x ceiling.
 if(tactical!==1){const before=affinity;affinity=Math.min(3,affinity*tactical);affinitySteps.push({label:tacticalLabel,multiplier:affinity/before});}
 const pitchElementMultiplier=1+.25*clamp(a.pitchElementBoost??0,0,.18);
 if(pitchElementMultiplier!==1){affinity*=pitchElementMultiplier;affinitySteps.push({label:'音程：属性効果（効果増分の25%を相性へ）',multiplier:pitchElementMultiplier});}
 const guard=clamp(enemy.guard??0,0,.65),guardBreak=enemy.intentId==='guard'?clamp(a.tactics?.guardBreak??0):0,pierce=clamp(a.pitchPierce??0,0,.3),guardMultiplier=1-guard*(1-.7*guardBreak)*(1-pierce);
 if(guard)affinitySteps.push({label:'装甲軽減（ガード崩し・Lead貫通適用後）',multiplier:guardMultiplier});
 affinity*=guardMultiplier;
 const breakdown={base:0,form:0,affinity:0,weight:0,charged:0,chain:0,groove:0};
 // Accuracy is attack efficiency, not a chance to miss. Raw rhythmic quality
 // provides the performance multiplier without a second stability penalty.
 const accuracyMultiplier=clamp(aim),rawRhythmMultiplier=a.performanceQuality?.multiplier??1;
 // Keep timing-skill rewards, but make the enemy-specific rhythmic fit a
 // separate multiplier so elemental and pitch affinities remain consistent.
 const rhythmMultiplier=rawRhythmMultiplier*motifMultiplier,efficiency=accuracyMultiplier*rhythmMultiplier;
 const hitDetails=[];
 const rounded=value=>efficiency===0?0:Math.max(1,Math.round(value));
 const damages=Array.from({length:a.count?a.hits:0},(_,index)=>{
  const scale=efficiency/Math.pow(a.hits,.85);
  const base=rounded((24+8*clamp(a.count/8))*scale);
  const weighted=rounded((24+8*clamp(a.count/8)+18*a.weight)*scale);
  const charged=rounded((24+8*clamp(a.count/8)+18*a.weight+12*a.charged)*scale);
  const beforeAffinity=rounded(a.power*scale);
  const damage=rounded(a.power/Math.pow(a.hits,.85)*affinity*efficiency);
  hitDetails.push({index:index+1,damage});
  breakdown.base+=base;breakdown.form+=beforeAffinity-base;breakdown.affinity+=damage-beforeAffinity;
  const chained=rounded((a.power-(a.groovePower??0))*scale);
  breakdown.weight+=weighted-base;breakdown.charged+=charged-weighted;breakdown.chain+=chained-charged;breakdown.groove+=beforeAffinity-chained;
  return damage;
 });
 const total=damages.reduce((x,y)=>x+y,0);
 const calculation={powerSteps:a.powerSteps??[{label:'Drums（重さ・溜め・ノリ込み）',value:a.power,multiplier:1}],affinitySteps,power:a.power,affinity,accuracyMultiplier,rhythmMultiplier,efficiency,hits:a.count?a.hits:0,divisor:Math.pow(a.hits,.85),hitDetails,total,drums:{count:a.count,kick:a.kick,snare:a.snare,weightBonus:18*a.weight,chargeBonus:12*a.charged,alternationBonus:3*a.alternation,grooveBonus:a.groovePower??0}};
 calculation.guard={rate:guard,pierce,guardBreak,multiplier:guardMultiplier};
 calculation.rhythmStyle={label:motif?.label??'基本リズム',multiplier:motifMultiplier,straightAlternation:straight};
 return {damages,total,affinity,accuracy:accuracyMultiplier,accuracyMultiplier,efficiency,breakdown,calculation};
}
function attackTimeline(notes,damages,duration=4){
 const sorted=notes.map(n=>({...n,time:n.rawT??n.t})).sort((a,b)=>a.time-b.time);
 const offset=Math.min(0,...sorted.map(n=>n.time));
 const events=sorted.map(n=>({...n,at:n.time-offset,damages:[]}));
 // Keep combat balance: distribute the resolved strikes across the played notes.
 damages.forEach((damage,i)=>{
  if(!events.length)return;
  const index=damages.length===1?events.length-1:Math.round(i*(events.length-1)/(damages.length-1));
  events[index].damages.push(damage);
 });
 return {events,duration:Math.max(duration,...sorted.map(n=>n.time+(n.duration!==undefined?n.duration+.14:.06)))-offset,offset};
}
function mixTimeline(tracks,currentVoice,damages=[],duration=4){
 const all=tracks.flatMap(track=>attackTimeline(track.notes,track.voice===currentVoice?damages:[],duration).events.map(event=>({...event,voice:track.voice})));
 const offset=Math.min(0,...all.map(event=>event.time));
 return {events:all.map(event=>({...event,at:event.time-offset})).sort((a,b)=>a.at-b.at),duration:Math.max(duration,...all.map(event=>event.time+(event.duration!==undefined?event.duration+.14:.06)))-offset,offset};
}
root.Rhythm={analyze,structure,resolve,attackTimeline,mixTimeline};if(typeof module!=='undefined')module.exports=root.Rhythm;
})(typeof window!=='undefined'?window:globalThis);
