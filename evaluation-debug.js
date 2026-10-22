/* Development-only, side-effect-free evaluation. Never writes combat state. */
(function(root){
 const dependency=name=>typeof module!=='undefined'?require('./'+name+'.js'):root[{rhythm:'Rhythm',groove:'Groove',quantize:'Quantize','performance-combat':'PerformanceCombat',ensemble:'Ensemble'}[name]];
 function compare(tracks,hats,bpm,duration,zones,enemy,preset='recorded',normalOnly=false){
  const R=dependency('rhythm'),G=dependency('groove'),Q=dependency('quantize'),C=dependency('performance-combat'),E=dependency('ensemble');
  const source=Object.fromEntries(['drums','bass','lead'].map(voice=>[voice,tracks.get(voice)??[]]));
  function render(notes){return Q.render(notes.map(n=>({...n,...(preset==='recorded'?{}:{quantize:preset})})),bpm,duration);}
  // Discard the provenance only on this disposable copy: all raw-based readers
  // must now observe the performed position, including merged quantized notes.
  const performed=notes=>render(notes).map(n=>({...n,inputT:n.rawT,inputTimes:[n.rawT]}));
  function evaluate(after){
   const parts=after?Object.fromEntries(Object.entries(source).map(([voice,notes])=>[voice,performed(notes)])):source;
   const hat=after?performed(hats):hats,drums=parts.drums;
   const ensemble=E.analyze(parts,bpm,duration),bass=C.bass(parts.bass,drums,bpm,duration,zones,enemy,{references:{hat}});
   const lead=E.support(C.lead(parts.lead,bpm,duration,zones,{references:{hat,drums,bass:parts.bass}}),ensemble);
   const groove=G.analyzeRelations(drums,hat,bpm,duration);
   let analysis=E.attack(C.enhance(G.enrich(R.analyze(after?drums:Q.render(drums,bpm,duration),duration,bpm),groove),drums,bpm,zones,lead),ensemble);
   const P=typeof module!=='undefined'?require('./pitch-combat.js'):root.PitchCombat;if(P)analysis=P.apply(analysis,bass.pitch,lead.pitch);
   analysis.tactics=C.tactics(analysis,bass,lead,enemy);
   const result=R.resolve(analysis,enemy);
   const shield=Math.min(90,bass.shield+Math.round(bass.shield*(lead.shieldEfficiency+ensemble.bonus.shieldEfficiency))+ensemble.bonus.shield);
   return {analysis,result,groove,ensemble,shield,parts,hat,bass,lead,tactics:analysis.tactics};
  }
  const normal=evaluate(false);
  return normalOnly?{normal}:{normal,quantized:evaluate(true)};
 }
 // Bounded, deterministic search. Where laid-back/drunk is effective, maximize
 // within playable candidates that audibly establish that groove.
 function damageChart(mode,bpm,duration,zones,enemy,options={}){
  const step=60/bpm/4;
  const G=dependency('groove');
  const preferredGrooves=['laidBack','drunk'].filter(id=>G.affinity({[id]:1},enemy.kind).some(b=>b.id===id&&b.multiplier>1));
  const hats=Array.from({length:16},(_,i)=>({type:'hat',t:i*step*2,rawT:i*step*2,quantize:'off'}));
  const empty={parts:new Map(['drums','bass','lead'].map(v=>[v,[]])),hats:[],total:0,candidates:1};
  if(mode==='min')return empty;
  // Voices belong to beat positions, never to the ordinal number of a hit.
  // Every phrase establishes its first downbeat and develops a voiced motif.
  const motifs=[
   ['backbeat',[0,8,10],[4,12]],['broken',[0,6,14],[4,10,12]],
   ['halfTime',[0,10],[8]],['drive',[0,4,8,12],[2,6,10]],
   ['syncopated',[0,2,10],[6,14]],['space',[0,12],[4]],
   ['air',[0,8],[2,4,6,10,12,14]],['answer',[0,7,12],[4,10]],
   ['offbeat',[0,6,10],[4,14]],['weight',[0,6,12],[4]]
  ];
  const voiced=(kicks,snares)=>[...kicks.map(q=>({q,type:'kick'})),...snares.map(q=>({q,type:'snare'}))].sort((a,b)=>a.q-b.q);
  const patterns=motifs.flatMap(([id,kicks,snares])=>{
   const first=voiced(kicks,snares),repeat=first.map(n=>({...n,q:n.q+16}));
   // Short fills answer a complete first bar, rather than replacing it with silence.
   const fill=[...repeat.filter(n=>n.q<28),...voiced([28],[29,30,31])];
   // On the answer bar Bass carries beat one; drums re-enter after that anchor.
   const answer=[...repeat.filter(n=>n.q<26&&n.q!==16),...voiced([27,30],[26,28,31])];
   return [{id:id+'-repeat',notes:[...first,...repeat]},{id:id+'-fill',notes:[...first,...fill]},{id:id+'-answer',notes:[...first,...answer]}];
  });
  // Fire develops a supported half-time call into a final-beat roll. The
  // first bar still has a kick, a backbeat and a second low accent.
  for(const [id,kicks,snares] of [['rise',[0,12],[4]],['release',[0,8],[12]],['build',[0,10],[8]]]){
   for(const tail of [voiced([16,24,28],[20,26,27,29,30,31]),voiced([16,22,28],[20,24,26,27,29,30,31])]){
    patterns.push({id:id+'-'+tail.length,notes:[...voiced(kicks,snares),...tail]});
   }
  }
  // Explicit note lengths and pitch contours give Bass a low anchor and Lead
  // a reply with breathing room and a final tonic. All pitches are scale indices.
  const melodic=phrase=>phrase.map(([q,pitch,length],i)=>{
   const t=q*step;return {type:pitch>=4?'snare':'kick',t,rawT:t,inputT:t,quantize:'off',pitch,duration:step*Math.min(length,(phrase[i+1]?.[0]??32)-q,32-q)};
  });
  const bassPhrases=[
   [[0,0,5.5],[6,0,1.5],[10,4,3],[16,0,5.5],[22,2,1.5],[26,4,1.5],[28,0,4]],
   [[0,0,7],[8,4,3],[12,2,2],[16,0,7],[24,4,2],[27,2,1],[28,0,4]],
   [[0,0,3],[6,4,3],[12,2,3],[16,0,3],[22,4,3],[27,2,1],[28,0,4]],
   [[0,0,9],[10,2,2],[12,4,3],[16,0,9],[26,2,1],[28,0,4]]
  ].map(melodic);
  const leadPhrases=[
   [[2,0,1.5],[5,2,2],[8,4,3],[18,2,1.5],[21,4,2],[24,2,2],[28,0,3]],
   [[3,4,2],[7,2,2],[10,0,3],[19,2,2],[23,4,1.5],[26,2,1],[28,0,3]],
   [[4,0,2],[7,2,1],[10,4,3],[20,4,2],[23,2,1],[26,1,1],[28,0,3]],
   [[2,0,3],[6,4,2],[11,2,2],[18,0,3],[22,4,2],[26,2,1],[28,0,3]],
   [[5,4,2],[9,6,2],[12,4,2],[21,2,2],[25,1,1],[28,0,3]]
  ].map(melodic);
  const feels=[
   {id:'straight',offset:()=>0},
   ...[.025,.045,.055].map(delay=>({id:'laidBack',offset:(q,type)=>type==='snare'?Math.min(delay,step*.44):0})),
   ...[[0,-.028,.035,-.012,-.025,.027,-.018,.04],[0,-.018,.012,.037,-.022,.006,.034,-.014],[0,.018,-.035,.03,.012,-.028,.04,-.012]].flatMap(pattern=>[0,.02].map(delay=>({id:'drunk',offset:(q,type)=>q%16===0?0:Math.max(-step*.44,Math.min(step*.44,pattern[q%pattern.length]+(type==='snare'?delay:0)))})))
  ];
  let best=empty,candidates=0;
  const leaders={};
  const grooveEligible=chart=>!preferredGrooves.length||preferredGrooves.includes(chart.feel)&&chart.groove[chart.feel]>=.55&&chart.groove.unstable<.35&&G.classify(chart.groove)===chart.feel;
  const eligible=chart=>(!options.element||options.element===chart.element)&&grooveEligible(chart);
  const evaluate=(drums,bass,lead,feel='straight',clock=hats,phrase=null)=>{
   const parts=new Map([['drums',drums],['bass',bass],['lead',lead]]);
   const evaluated=compare(parts,clock,bpm,duration,zones,enemy,'recorded',true).normal;
   const total=evaluated.result.total,element=evaluated.analysis.element;candidates++;
   const chart={parts,hats:clock,total,element,feel,groove:evaluated.groove,phrase};
   const key=element+':'+feel;
   if(grooveEligible(chart)&&(!leaders[key]||total>leaders[key].total))leaders[key]=chart;
   if(eligible(chart)&&total>best.total)best=chart;
  };
  const bass=bassPhrases[0],lead=leadPhrases[0];
  for(const pattern of patterns)for(const feel of feels){
   const drums=pattern.notes.map(({q,type})=>{
    const t=Math.max(0,Math.min(duration-step/8,q*step+feel.offset(q,type)));
    return {type,t,rawT:t,inputT:t,quantize:'off'};
   });
   if(new Set(drums.slice(1).map((n,i)=>Math.round((n.t-drums[i].t)*1000))).size<2)continue;
   evaluate(drums,bass,lead,feel.id,hats,pattern.id);
  }
  // Coordinate passes let Bass and Lead find useful relationships with the
  // chosen drums, rather than leaving Bass on a fixed high-note pulse.
  const seeds=Object.values(leaders).filter(eligible);
  const finalists=[];
  for(const seed of seeds){
   best=seed;const drums=seed.parts.get('drums');
   for(let pass=0;pass<2;pass++){
    for(const phrase of bassPhrases)evaluate(drums,phrase,best.parts.get('lead'),seed.feel,seed.hats,seed.phrase);
    for(const phrase of leadPhrases)evaluate(drums,best.parts.get('bass'),phrase,seed.feel,seed.hats,seed.phrase);
   }
   finalists.push(best);
  }
  best=finalists.reduce((a,b)=>a.total>=b.total?a:b,empty);
  return {...best,candidates,preferredGrooves,grooveStyle:preferredGrooves.includes(best.feel)?best.feel:null};
 }
 root.EvaluationDebug={compare,damageChart};if(typeof module!=='undefined')module.exports=root.EvaluationDebug;
})(typeof window!=='undefined'?window:globalThis);
