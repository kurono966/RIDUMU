/* Analysis uses a 16th-note grid. Playback and sound retain raw timestamps. */
(function(root){
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
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
 const scores={earth:1.15*kRatio+.65*low+.45*regularity+.55*charged,wind:1.15*sRatio+.6*high+.3*bursts+.25*alternation,fire:1.65*rise+.65*bursts+.5*concentration+.2*high,lightning:.85*syncopation+.65*irregularity+.6*offbeat};
 const element=Object.keys(scores).reduce((a,b)=>scores[a]>=scores[b]?a:b);
 const weight=clamp(.5*kRatio+.3*low+.45*charged-.2*snareBurst),hits=Math.max(1,Math.min(8,Math.round(1+high*4+bursts*2+snareBurst*2-weight*2)));
 const power=count?24+18*weight+12*charged+7*alternation+8*clamp(count/8):0;
 const accuracy=clamp(.79+.12*regularity+.08*repetition-.12*irregularity,.6,.98),instability=.05+.3*irregularity;
 return {duration,bpm,step,count,kick,snare,density,meanInterval:mean,regularity,alternation,repetition,firstDensity:first/(duration/2),secondDensity:second/(duration/2),densityRise:rise,longestGap,hasLongGap:longestGap>=beat*1.5,bursts,snareBurst,offbeat,syncopation,charged,concentration,scores,element,weight,hits,power,accuracy,instability,effect:clamp(.3+.45*irregularity+.25*scores[element]/2.5),grid,masks,slots};
}
function resolve(a,enemy,rng=Math.random){
 let affinity=1,aim=a.accuracy;
 if(enemy.kind==='stone'){affinity=a.element==='earth'?1.35:1;affinity*=.8+.45*a.weight;}
 if(enemy.kind==='fly'){affinity=a.element==='wind'?1.4:1;affinity*=.9+.25*clamp(a.density/6);aim-=.24*a.weight*(1-(a.groove?.swing??0));}
 if(enemy.kind==='machine')affinity=a.element==='lightning'?1.45:1;
 if(enemy.kind==='stone'&&a.element==='fire')affinity*=1.12;
 if(enemy.kind==='plant')affinity=a.element==='fire'?1.5:a.element==='wind'?.85:1;
 if(enemy.kind==='ghost'){affinity=a.element==='lightning'?1.3:a.element==='earth'?.85:1;aim-=.14*(1-Math.max(a.groove?.laidBack??0,a.groove?.drunk??0,a.groove?.swing??0));}
 if(enemy.kind==='crystal'){affinity=a.element==='earth'?1.25:a.element==='lightning'?.85:1;affinity*=.9+.3*a.alternation;}
 if(a.groove){
  const choices=enemy.kind==='stone'?[['laidBack',.25],['pocket',.12]]:enemy.kind==='fly'?[['pushed',.25],['snarePushed',.2],['swing',.18]]:enemy.kind==='machine'?[['tight',.2],['drunk',.26]]:enemy.kind==='plant'?[['swing',.18],['laidBack',.12]]:enemy.kind==='ghost'?[['laidBack',.25],['drunk',.25]]:enemy.kind==='crystal'?[['pocket',.2],['tight',.15]]:[];
  for(const [id,strength] of choices)affinity*=1+strength*(a.groove[id]??0);
 }
 const breakdown={base:0,form:0,affinity:0,weight:0,charged:0,chain:0,groove:0};
 const damages=Array.from({length:a.count?a.hits:0},()=>{
  if(rng()>=aim)return 0;
  const variation=1+(rng()*2-1)*a.instability;
  const scale=variation/Math.pow(a.hits,.85);
  const base=Math.max(1,Math.round((24+8*clamp(a.count/8))*scale));
  const weighted=Math.max(1,Math.round((24+8*clamp(a.count/8)+18*a.weight)*scale));
  const charged=Math.max(1,Math.round((24+8*clamp(a.count/8)+18*a.weight+12*a.charged)*scale));
  const beforeAffinity=Math.max(1,Math.round(a.power*scale));
  const damage=Math.max(1,Math.round(a.power/Math.pow(a.hits,.85)*affinity*variation));
  breakdown.base+=base;breakdown.form+=beforeAffinity-base;breakdown.affinity+=damage-beforeAffinity;
  const chained=Math.max(1,Math.round((a.power-(a.groovePower??0))*scale));
  breakdown.weight+=weighted-base;breakdown.charged+=charged-weighted;breakdown.chain+=chained-charged;breakdown.groove+=beforeAffinity-chained;
  return damage;
 });
 return {damages,total:damages.reduce((x,y)=>x+y,0),affinity,accuracy:aim,breakdown};
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
root.Rhythm={analyze,resolve,attackTimeline,mixTimeline};if(typeof module!=='undefined')module.exports=root.Rhythm;
})(typeof window!=='undefined'?window:globalThis);
