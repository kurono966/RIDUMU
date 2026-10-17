/* All offsets are measured from raw audio-clock timestamps, never quantized playback. */
(function(root){
const clamp=v=>Math.max(0,Math.min(1,v));
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const sd=a=>Math.sqrt(mean(a.map(x=>(x-mean(a))**2)));
const raw=n=>typeof n==='number'?n:(n.rawT??n.t);
const mod=(n,m)=>(n%m+m)%m;
function repeated(events,period,tolerance){
 const groups=new Map();
 for(const e of events){if(e.q<0)continue;const key=mod(e.q,period)+':'+(e.type??'hat');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 const differences=[],pattern=[];let repeats=0;
 for(const values of groups.values()){
  // Multiple hits in one grid cell are not evidence of repeating across cycles.
  const cycles=new Map();for(const e of values){const cycle=Math.floor(e.q/period);if(!cycles.has(cycle))cycles.set(cycle,[]);cycles.get(cycle).push(e.offset);}
  const averages=Array.from(cycles.values(),mean);
  if(averages.length<2)continue;
  const center=mean(averages);averages.forEach(x=>differences.push(Math.abs(x-center)));
  pattern.push(center);repeats=Math.max(repeats,averages.length);
 }
 const evidence=clamp(differences.length/6);
 return {score:clamp(1-mean(differences)/tolerance)*evidence,evidence,noise:mean(differences),spread:sd(pattern),repeats};
}
function analyzeHat(input,bpm=120,duration=8*60/bpm){
 const beat=60/bpm,step=beat/4;
 const times=input.map(raw).filter(t=>Number.isFinite(t)&&t>=-beat&&t<duration).sort((a,b)=>a-b);
 const events=times.map(t=>{const q=Math.round(t/step);return {t,q,offset:t-q*step};});
 const intervals=times.slice(1).map((t,i)=>t-times[i]);
 const offsets=events.map(e=>e.offset),averageOffset=mean(offsets),tolerance=Math.max(.012,Math.min(.026,beat*.05));
 const micro=repeated(events,8,tolerance),bars=repeated(events,16,tolerance);
 const repetition=Math.max(micro.score,bars.score);
 const confidence=clamp(times.length/8)*Math.max(micro.evidence,bars.evidence);
 const uniformity=intervals.length>1?clamp(1-sd(intervals)/Math.max(.01,mean(intervals))):0;
 const odd=[],even=[];
 for(const t of times){const eighth=Math.round(t/(beat/2)),offset=t-eighth*beat/2;(mod(eighth,2)?odd:even).push(offset);}
 const swingOffset=mean(odd)-mean(even);
 const swingPurity=Math.exp(-(sd(odd)+sd(even))/.008);
 const swing=odd.length>=2&&even.length>=2?clamp(swingOffset/(beat*.18))*repetition*swingPurity:0;
 const meanConsistency=clamp(1-sd(offsets)/Math.max(.018,step*.45));
 const laidBack=clamp(averageOffset/.045)*Math.max(meanConsistency,repetition)*confidence;
 const pushed=clamp(-averageOffset/.035)*Math.max(meanConsistency,repetition)*confidence;
 const bestPattern=micro.score>=bars.score?micro:bars;
 const unstable=clamp(bestPattern.noise/tolerance)*clamp(sd(offsets)/.018)*confidence;
 // Repeating nonuniform offsets count as drunk; residual noise does not.
 const drunk=clamp(Math.max(micro.spread,bars.spread)/.018)*repetition*(1-unstable)*confidence*(1-.75*swing);
 const tight=Math.exp(-Math.sqrt(mean(offsets.map(x=>x*x)))/.018)*confidence;
 return {count:times.length,meanInterval:mean(intervals),meanOffset:averageOffset,ahead:mean(offsets.filter(x=>x<0)),behind:mean(offsets.filter(x=>x>0)),offbeatOffset:mean(events.filter(e=>mod(e.q,4)!==0).map(e=>e.offset)),uniformity,swingOffset,microTimingRepetition:micro.score,barReproducibility:bars.score,repetitions:Math.max(micro.repeats,bars.repeats),randomInstability:unstable,confidence,tight,laidBack,pushed,swing,drunk,unstable,events,bpm,duration};
}
function analyzeRelations(input,hats,bpm=120,duration=8*60/bpm){
 const hat=analyzeHat(hats,bpm,duration),beat=60/bpm,step=beat/4;
 const hatTimes=hat.events.map(e=>e.t),events=[];
 for(const n of input){
  const t=raw(n);if(!hatTimes.length||!Number.isFinite(t))continue;
  const nearest=hatTimes.reduce((a,b)=>Math.abs(a-t)<=Math.abs(b-t)?a:b);
  const offset=t-nearest;
  if(Math.abs(offset)>beat*.45)continue;
  events.push({t,type:n.type,hatT:nearest,offset,q:Math.round(t/step)});
 }
 const kicks=events.filter(e=>e.type==='kick').map(e=>e.offset),snares=events.filter(e=>e.type==='snare').map(e=>e.offset);
 const consistency=values=>values.length<2?0:Math.exp(-sd(values)/.018)*clamp(values.length/3);
 const kickMean=mean(kicks),snareMean=mean(snares),kickConsistency=consistency(kicks),snareConsistency=consistency(snares);
 const micro=repeated(events,8,.023),bars=repeated(events,16,.023),repeat=Math.max(micro.score,bars.score);
 const confidence=clamp(events.length/6)*clamp(hatTimes.length/4);
 const tightRelative=Math.exp(-Math.sqrt(mean(events.map(e=>e.offset**2)))/.018)*confidence;
 const laidBack=Math.max(clamp(snareMean/.045)*snareConsistency,hat.laidBack*.65)*confidence;
 const pushed=Math.max(clamp(-kickMean/.035)*kickConsistency,hat.pushed*.65)*confidence;
 const pocket=Math.sqrt(clamp(-kickMean/.03)*clamp(snareMean/.045)*kickConsistency*snareConsistency)*confidence;
 const bestPattern=micro.score>=bars.score?micro:bars;
 const relativeNoise=clamp(bestPattern.noise/.023)*clamp(sd(events.map(e=>e.offset))/.022)*confidence;
 const unstable=Math.max(hat.unstable,relativeNoise);
 const centered=events.map(e=>({...e,offset:e.offset-(e.type==='kick'?kickMean:snareMean)}));
 const residualMicro=repeated(centered,8,.023),residualBars=repeated(centered,16,.023);
 const drunk=Math.max(hat.drunk,clamp(Math.max(residualMicro.spread,residualBars.spread)/.02)*repeat*(1-unstable)*confidence);
 const offbeats=events.filter(e=>mod(e.q,4)>=2).map(e=>e.offset);
 const swing=Math.max(hat.swing,clamp(mean(offbeats)/.05)*consistency(offbeats)*repeat);
 const tight=Math.sqrt(hat.tight*tightRelative);
 return {pocket,laidBack,pushed,swing,drunk,tight,unstable,confidence,hat,kickMean,snareMean,kickConsistency,snareConsistency,barReproducibility:bars.score,microTimingRepetition:micro.score,repetitions:Math.max(hat.repetitions,micro.repeats,bars.repeats),matched:events.length,events};
}
function enrich(analysis,groove){
 const a={...analysis,scores:{...analysis.scores},groove};
 if(!groove||groove.confidence===0)return a;
 const oldWeight=a.weight;
 const intentional=Math.max(groove.laidBack,groove.drunk,groove.pocket,groove.swing);
 a.weight=clamp(a.weight+.12*groove.laidBack);
 a.groovePower=6*groove.laidBack+4*groove.pocket+3*groove.pushed;
 a.power+=18*(a.weight-oldWeight)+a.groovePower;
 a.hits=Math.min(8,Math.max(1,a.hits+Math.round(groove.pushed)));
 a.accuracy=Math.min(.98,Math.max(.5,a.accuracy+.12*groove.tight+.08*groove.pocket+.08*intentional-.16*groove.unstable));
 a.instability=Math.min(.55,Math.max(.04,a.instability*(1-.7*intentional)+.2*groove.unstable));
 a.scores.lightning+=.7*groove.drunk;a.scores.wind+=.35*groove.swing;
 a.element=Object.keys(a.scores).reduce((x,y)=>a.scores[x]>=a.scores[y]?x:y);
 a.effect=clamp(a.effect+.25*groove.drunk);
 return a;
}
function affinity(g,kind){
 if(!g)return [];
 const choices=kind==='stone'?[['laidBack',.25],['pocket',.12]]:kind==='fly'?[['pushed',.25],['swing',.18]]:kind==='machine'?[['tight',.2],['drunk',.26]]:[];
 return choices.map(([id,strength])=>({id,multiplier:1+strength*g[id]}));
}
function describe(g){
 if(!g||!g.matched)return 'Hatとの対応が少ないため、今回は音の特徴から攻撃。';
 const millis=n=>Math.round(Math.abs(n)*1000);
 if(g.unstable>.55)return 'ズレ方が毎回変わっている → 不安定。';
 if(g.drunk>.35&&g.drunk>Math.max(g.laidBack,g.pushed,g.pocket,g.swing)*1.15)return `同じズレ方を${Math.max(2,g.repetitions)}回再現 → ドランク。`;
 if(g.swing>.6&&g.swing>=Math.max(g.laidBack,g.pushed,g.pocket,g.drunk)*.9)return '裏拍を繰り返し遅らせた → スウィング。';
 if(g.pocket>.25)return `KickがHatより${millis(g.kickMean)}ms前、Snareが${millis(g.snareMean)}ms後ろ → ポケット。`;
 if(g.laidBack>.2&&g.snareMean>.008)return `SnareがHatより平均${millis(g.snareMean)}ms後ろ → レイドバック。`;
 if(g.pushed>.2&&g.kickMean<-.008)return `KickがHatより平均${millis(g.kickMean)}ms前 → 前ノリ。`;
 if(g.swing>.6)return '裏拍を繰り返し遅らせた → スウィング。';
 if(g.drunk>.2)return `同じズレ方を${Math.max(2,g.repetitions)}回再現 → ドランク。`;
 if(g.swing>.2)return '裏拍を繰り返し遅らせた → スウィング。';
 if(g.hat.laidBack>.2)return `Hatを平均${millis(g.hat.meanOffset)}ms後ろに配置 → レイドバック。`;
 if(g.hat.pushed>.2)return `Hatを平均${millis(g.hat.meanOffset)}ms前に配置 → 前ノリ。`;
 if(g.tight>.35)return 'Hatと低音・高音がほぼ同時 → タイト。';
 return 'Hatとの間隔を変えて、自分のノリを試そう。';
}
root.Groove={analyzeHat,analyzeRelations,enrich,affinity,describe};
if(typeof module!=='undefined')module.exports=root.Groove;
})(typeof window!=='undefined'?window:globalThis);
