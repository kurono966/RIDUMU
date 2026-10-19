/* Development-only, side-effect-free evaluation. Never writes combat state. */
(function(root){
 const dependency=name=>typeof module!=='undefined'?require('./'+name+'.js'):root[{rhythm:'Rhythm',groove:'Groove',quantize:'Quantize','performance-combat':'PerformanceCombat',ensemble:'Ensemble'}[name]];
 function compare(tracks,hats,bpm,duration,zones,enemy,preset='recorded'){
  const R=dependency('rhythm'),G=dependency('groove'),Q=dependency('quantize'),C=dependency('performance-combat'),E=dependency('ensemble');
  const source=Object.fromEntries(['drums','bass','lead'].map(voice=>[voice,tracks.get(voice)??[]]));
  function render(notes){return Q.render(notes.map(n=>({...n,...(preset==='recorded'?{}:{quantize:preset})})),bpm,duration);}
  // Discard the provenance only on this disposable copy: all raw-based readers
  // must now observe the performed position, including merged quantized notes.
  const performed=notes=>render(notes).map(n=>({...n,inputT:n.rawT,inputTimes:[n.rawT]}));
  function evaluate(after){
   const parts=after?Object.fromEntries(Object.entries(source).map(([voice,notes])=>[voice,performed(notes)])):source;
   const hat=after?performed(hats):hats,drums=parts.drums;
   const ensemble=E.analyze(parts,bpm,duration),bass=C.bass(parts.bass,drums,bpm,duration,zones,enemy);
   const lead=E.support(C.lead(parts.lead,bpm,duration,zones),ensemble);
   const groove=G.analyzeRelations(drums,hat,bpm,duration);
   let analysis=E.attack(C.enhance(G.enrich(R.analyze(after?drums:Q.render(drums,bpm,duration),duration,bpm),groove),drums,bpm,zones,lead),ensemble);
   const P=typeof module!=='undefined'?require('./pitch-combat.js'):root.PitchCombat;if(P)analysis=P.apply(analysis,bass.pitch,lead.pitch);
   analysis.tactics=C.tactics(analysis,bass,lead,enemy);
   const result=R.resolve(analysis,enemy);
   const shield=Math.min(90,bass.shield+Math.round(bass.shield*(lead.shieldEfficiency+ensemble.bonus.shieldEfficiency))+ensemble.bonus.shield);
   return {analysis,result,groove,ensemble,shield,parts,hat,bass,lead,tactics:analysis.tactics};
  }
  return {normal:evaluate(false),quantized:evaluate(true)};
 }
 // Bounded, deterministic search: the maximum is among these playable candidates.
 function damageChart(mode,bpm,duration,zones,enemy,options={}){
  const step=60/bpm/4;
  const hats=Array.from({length:16},(_,i)=>({type:'hat',t:i*step*2,rawT:i*step*2,quantize:'off'}));
  const empty={parts:new Map(['drums','bass','lead'].map(v=>[v,[]])),hats:[],total:0,candidates:1};
  if(mode==='min')return empty;
  const make=(slots,voice,offset=0,pitches=[0])=>slots.map((q,i)=>{const t=Math.max(0,Math.min(duration-step/8,(q+offset)*step));return {type:i%2?'snare':'kick',t,rawT:t,inputT:t,quantize:'off',...(voice==='drums'?{}:{pitch:pitches[i%pitches.length],duration:step*Math.min((slots[i+1]??32)-q,[.8,1.6,2.8][i%3])})};});
  // Repeat a recognisable motif, then answer it with a fill. Uniform all-hit
  // grids are deliberately outside this musical candidate set.
  const motifs=[[0,4,7,10,12],[0,3,6,10,14],[0,6,12],[0,2,4,6,8,10,12],[2,6,10,14],[0,1,4,6,9,12],[0,4,8,11,14]];
  const patterns=motifs.flatMap(m=>[
   [...m,...m.filter(q=>q<12).map(q=>q+16),28,30,31],
   [...m,...m.filter(q=>q<10).map(q=>q+16),27,29,30]
  ]);
  patterns.push([0,12,24,28,29,30,31],[16,20,24,26,28,29,30,31],[0,7,10,17,22,27,30]);
  let best=empty,candidates=0;
  const leaders={};
  const evaluate=(drums,bass,lead)=>{
   const parts=new Map([['drums',drums],['bass',bass],['lead',lead]]);
   const evaluated=compare(parts,hats,bpm,duration,zones,enemy).normal;
   const total=evaluated.result.total,element=evaluated.analysis.element;candidates++;
   const chart={parts,hats,total,element};
   if(!leaders[element]||total>leaders[element].total)leaders[element]=chart;
   if((!options.element||options.element===element)&&total>best.total)best=chart;
  };
  const bass=make([0,4,7,12,16,20,23,28,30],'bass',0,[0,4,7,4,8]);
  const lead=make([1,5,8,13,17,21,24,27,30],'lead',0,[0,2,4,3,6,4,7,6,8]);
  for(const slots of patterns)for(const offset of [0,.15,-.15])for(const mask of ['KKSK','KSSS','KSKS','KKSS']){
   const drums=make(slots,'drums',offset).map((n,i)=>({...n,type:mask[i%mask.length]==='K'?'kick':'snare'}));
   evaluate(drums,bass,lead);
  }
  const melodicPatterns=[[0,4,7,12,16,20,23,28,30],[1,5,8,13,17,21,24,27,30],[0,6,12,16,22,27,30],[2,5,10,14,18,21,26,29]];
  // Coordinate passes let Bass and Lead find useful relationships with the
  // chosen drums, rather than leaving Bass on a fixed high-note pulse.
  const seeds=options.element?[leaders[options.element]].filter(Boolean):Object.values(leaders);
  const finalists=[];
  for(const seed of seeds){
   best=seed;const drums=seed.parts.get('drums');
   for(let pass=0;pass<2;pass++){
    for(const slots of melodicPatterns)for(const pitches of [[4,6,8,6],[0,4,7,4,8],[8,7,4,6]])evaluate(drums,make(slots,'bass',0,pitches),best.parts.get('lead'));
    for(const slots of melodicPatterns)for(const pitches of [[0,2,4,3,6,4,7,6,8],[0,4,8,6,4],[0,2,4,6,8],[0,8,4,7]])evaluate(drums,best.parts.get('bass'),make(slots,'lead',0,pitches));
   }
   finalists.push(best);
  }
  best=finalists.reduce((a,b)=>a.total>=b.total?a:b,empty);
  return {...best,candidates};
 }
 root.EvaluationDebug={compare,damageChart};if(typeof module!=='undefined')module.exports=root.EvaluationDebug;
})(typeof window!=='undefined'?window:globalThis);
