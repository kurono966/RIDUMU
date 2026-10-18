/* Display-only adapter. Scores and tie order belong to the existing engines. */
(function(root){
 const dependency=(file,name)=>typeof module!=='undefined'?require('./'+file+'.js'):root[name];
 const R=dependency('rhythm','Rhythm'),Q=dependency('quantize','Quantize'),G=dependency('groove','Groove'),F=dependency('feedback','CombatFeedback');
 const names={earth:'土',wind:'風',fire:'火',lightning:'雷'},icons={earth:'▰',wind:'≋',fire:'▲',lightning:'ϟ'};
 const tips={earth:'キック中心で、間を空ける',wind:'キックとスネアを交互に刻む',fire:'後半に向かって音を増やす',lightning:'裏拍やシンコペーションを使う'};
 function analyze(drums,hats,bpm,duration,final=false){
  const base=R.analyze(Q.render(drums,bpm,duration),duration,bpm),groove=G.analyzeRelations(drums,hats,bpm,duration),a=G.enrich(base,groove);
  const scores=Object.fromEntries(Object.keys(names).map(key=>[key,a.count?a.scores[key]:0])),sum=Object.values(scores).reduce((s,v)=>s+v,0),shares=Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,sum?v/sum:0]));
  const rank=Object.keys(scores).sort((x,y)=>scores[y]-scores[x]),close=!!a.count&&(scores[rank[0]]-scores[rank[1]])/Math.max(.000001,scores[rank[0]])<=.08;
  const sufficient=a.count>=3,dominant=a.count&&(final||sufficient)?a.element:null;
  let reason='ドラム入力を待っています';
  if(a.count){const cause=F.elementCause(a);reason=({kick:'キック中心 → 土',heavy:'間を空ける → 土',repeat:'規則的に刻む → 土',snare:a.alternation>.5&&a.kick?'交互＋スネア → 風':'スネア中心 → 風',acceleration:'後半に音を増やす → 火',offbeat:'裏拍のアクセント → 雷',irregular:'音の間隔の変化 → 雷',burst:a.element==='wind'?'細かい刻み → 風':'短い連打 → 火'})[cause.source]??cause.text.replace('属性','');
   if(base.element!==a.element)reason=a.element==='wind'?'跳ねるノリ → 風':a.element==='lightning'?'同じ揺れの再現 → 雷':reason;
  }
  return {scores,shares,rank,close,dominant,actualElement:a.count?a.element:null,count:a.count,final,sufficient,reason,analysis:a,baseElement:base.element,groove};
 }
 const api={analyze,names,icons,tips};root.ElementMeter=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
