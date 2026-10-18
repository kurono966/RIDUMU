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
   const ensemble=E.analyze(parts,bpm,duration),bass=C.bass(parts.bass,drums,bpm,duration,zones);
   const lead=E.support(C.lead(parts.lead,bpm,duration,zones),ensemble);
   const groove=G.analyzeRelations(drums,hat,bpm,duration);
   let analysis=E.attack(C.enhance(G.enrich(R.analyze(after?drums:Q.render(drums,bpm,duration),duration,bpm),groove),drums,bpm,zones,lead),ensemble);
   const P=typeof module!=='undefined'?require('./pitch-combat.js'):root.PitchCombat;if(P)analysis=P.apply(analysis,bass.pitch,lead.pitch);
   const result=R.resolve(analysis,enemy);
   const shield=Math.min(90,bass.shield+Math.round(bass.shield*(lead.shieldEfficiency+ensemble.bonus.shieldEfficiency))+ensemble.bonus.shield);
   return {analysis,result,groove,ensemble,shield,parts,hat};
  }
  return {normal:evaluate(false),quantized:evaluate(true)};
 }
 root.EvaluationDebug={compare};if(typeof module!=='undefined')module.exports=root.EvaluationDebug;
})(typeof window!=='undefined'?window:globalThis);
