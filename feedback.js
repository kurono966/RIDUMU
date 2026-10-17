/* Explanations use the same features and multipliers as combat; no extra damage rolls. */
(function(root){
const grooveEngine=typeof module!=='undefined'?require('./groove.js'):root.Groove;
const names={earth:'土',wind:'風',fire:'火',lightning:'雷'};
const discoveryNames={earth:'土属性が有効',heavy:'重い一撃が有効',chain:'交互の入力が有効',wind:'風属性が有効',dense:'高密度の攻撃が有効',lightning:'雷属性が有効',fire:'火属性が有効',laidBack:'レイドバックが有効',pocket:'ポケットが有効',pushed:'前ノリが有効',snarePushed:'前ノリスネアが有効',swing:'スウィングが有効',tight:'タイトな演奏が有効',drunk:'再現する揺れが有効'};
function matchups(a,enemy){
 const list=[];const add=(id,multiplier)=>{if(multiplier>1.015)list.push({id,multiplier,label:discoveryNames[id]});};
 if(enemy.kind==='stone'){if(a.element==='earth')add('earth',1.35);add('heavy',.8+.45*a.weight);if(a.element==='fire')add('fire',1.12);}
 if(enemy.kind==='fly'){if(a.element==='wind')add('wind',1.4);add('dense',.9+.25*Math.min(1,a.density/6));}
 if(enemy.kind==='machine'&&a.element==='lightning')add('lightning',1.45);
 if(enemy.kind==='plant'&&a.element==='fire')add('fire',1.5);
 if(enemy.kind==='ghost'&&a.element==='lightning')add('lightning',1.3);
 if(enemy.kind==='crystal'){if(a.element==='earth')add('earth',1.25);add('chain',.9+.3*a.alternation);}
 for(const bonus of grooveEngine.affinity(a.groove,enemy.kind))add(bonus.id,bonus.multiplier);
 return list;
}
function elementCause(a){
 const choices={
  earth:[[1.15*a.kick/Math.max(1,a.count),'低音側の入力が多い → 土属性','kick'],[.65*(1-Math.min(1,a.count/24)),'間を空けた演奏 → 土属性','heavy'],[.45*a.regularity,'規則的な刻み → 土属性','repeat']],
  wind:[[1.15*a.snare/Math.max(1,a.count),'高音側の入力が多い → 風属性','snare'],[.6*Math.min(1,a.count/24),'細かな刻み → 風属性','burst']],
  fire:[[1.65*a.densityRise,'後半に詰めた入力 → 火属性','acceleration'],[.65*a.bursts,'短い間隔の連打 → 火属性','burst'],[.5*a.concentration,'一か所に集めた入力 → 火属性','burst']],
  lightning:[[.85*a.syncopation+.6*a.offbeat,'裏拍の入力 → 雷属性','offbeat'],[.65*(1-a.regularity),'不規則な間隔 → 雷属性','irregular']]
 };
 const best=choices[a.element].sort((x,y)=>y[0]-x[0])[0];return {text:best[1],source:best[2],strength:best[0]};
}
function explain(a,result,enemy,voice='drums'){
 const hitCount=result.damages.filter(n=>n>0).length;
 const cause=elementCause(a),b=result.breakdown??{base:result.total,form:0,affinity:0};
 const effective=result.total>0?matchups(a,enemy).sort((x,y)=>y.multiplier-x.multiplier):[];
 const candidates=[];
 if(effective.length){
  const m=effective[0];
  const shown=effective.slice(0,2);
  candidates.push({id:'weak-'+m.id,priority:1,score:effective.reduce((s,w)=>s+result.total*(1-1/w.multiplier),0),text:shown.map(w=>w.label.replace('が有効','')).join('・')+'が有効 → ダメージ増加',source:a.groove&&m.id in a.groove?'groove-'+m.id:m.id==='heavy'?(a.charged>.3?'charge':'heavy'):m.id==='dense'?'burst':m.id==='chain'?'chain':cause.source,tag:'弱点！'});
 }
 if(a.groove&&a.groove.confidence>.15){
  const g=a.groove,id=['pocket','laidBack','pushed','snarePushed','swing','drunk','tight'].sort((x,y)=>(g[y]??0)-(g[x]??0))[0];
  const labels={pocket:'ポケット',laidBack:'レイドバック',pushed:'前ノリ',snarePushed:'前ノリスネア',swing:'スウィング',drunk:'再現する揺れ',tight:'タイト'};
  if(g[id]>.15)candidates.push({id:'groove',priority:2,score:(b.groove??0)+result.total*.18*g[id],text:labels[id]+(id==='tight'?' → 命中が安定':id==='laidBack'?' → 重撃を強化':id==='drunk'?' → 属性効果を強化':' → 攻撃を強化'),source:'groove-'+id,tag:labels[id]+'！'});
 }
 const low=voice==='drums'?'Kick':'低音';
 if(a.count&&a.charged>.2)candidates.push({id:'charge',priority:2,score:(b.charged??12*a.charged)+.6*(b.weight??0),text:`長い間の後の${low} → 溜めた重撃`,source:'charge',tag:'溜め！'});
 if(a.count&&a.weight>.55&&a.charged<=.6)candidates.push({id:'heavy',priority:2,score:(b.weight??18*a.weight),text:'間を空けた低音の入力 → 重い一撃',source:'heavy',tag:'重撃！'});
 if(a.hits>=3)candidates.push({id:'burst',priority:2,score:(result.total||a.power)*Math.min(.8,(a.hits-1)/8),text:a.snareBurst>.3?'高音側の短い連打 → 多段攻撃':`${a.density>3?'密な刻み':'短い間隔の入力'} → ${a.hits}回の連撃`,source:'burst',tag:'連撃！'});
 if(a.alternation>.65&&a.count>2)candidates.push({id:'chain',priority:2,score:b.chain??7*a.alternation,text:'低音・高音を交互に入力 → 連環撃',source:'chain',tag:'連環！'});
 if(a.count)candidates.push({id:'element',priority:3,score:cause.strength*6,text:cause.text,source:cause.source,tag:names[a.element]+'！'});
 if(a.regularity>.65&&a.count>3)candidates.push({id:'stable',priority:4,score:result.total*(.12*a.regularity+.08*a.repetition),text:a.repetition>.4?'安定した反復 → 命中しやすい':'一定の間隔 → 命中しやすい',source:'repeat',tag:'安定'});
 const sorted=candidates.sort((x,y)=>x.priority-y.priority||y.score-x.score);
 const factors=[];
 for(const f of sorted){if(factors.some(x=>x.priority===f.priority))continue;factors.push(f);if(factors.length===3)break;}
 const g=a.groove;
 if(g&&g.confidence>.15){
  const dominant=['pocket','laidBack','pushed','snarePushed','swing','drunk','tight'].sort((x,y)=>(g[y]??0)-(g[x]??0))[0];
  const id=g.unstable>.55?'unstable':dominant;
  if(g[id]>.15){
   const detail={id:'groove',priority:2,score:(b.groove??0),text:grooveEngine.describe(g),source:'groove-'+id,tag:{pocket:'ポケット！',laidBack:'後ノリ！',pushed:'前ノリ！',snarePushed:'前ノリスネア！',swing:'スウィング！',drunk:'揺れ！',tight:'タイト！',unstable:'揺らぎ'}[id]};
   const existing=factors.findIndex(f=>f.id==='groove');
   if(existing>=0)factors[existing]=detail;
   else if(factors.length<3)factors.push(detail);
   else factors[factors.length-1]=detail;
   factors.sort((x,y)=>x.priority-y.priority||y.score-x.score);
  }
 }
 let hint='属性相性は普通。刻み方を変えて比べてみよう。';
 if(!a.count)hint='今回は入力なし。一音から試してみよう。';
 else if(enemy.kind==='stone'&&a.weight<.45)hint='軽い連打は岩の体に通りにくい。間を空けた低音も試そう。';
 else if(enemy.kind==='fly'&&a.weight>.5)hint='重い一撃は飛行敵に当たりにくい。細かな刻みも試そう。';
 else if(enemy.kind==='plant'&&a.element==='wind')hint='風はしなる蔓に流されやすい。別の属性も試そう。';
 else if(enemy.kind==='ghost'&&(!hitCount||a.element==='earth'))hint='揺れる輪郭を捉えにくい。同じズレ方を繰り返すノリも試そう。';
 else if(enemy.kind==='crystal'&&a.alternation<.34)hint='同じ音だけでは晶殻に響きにくい。低音と高音を交互に試そう。';
 else if(!hitCount)hint='今回は命中なし。一定の間隔や反復で当てやすくなる。';
 else if(hitCount<result.damages.length)hint='一部が外れた。一定の間隔や反復で命中が安定する。';
 else if(effective.length)hint='この叩き方は敵に有効。違う刻みとも比べてみよう。';
 if(a.groove?.unstable>.55)hint='ズレ方が毎回変わっている。同じ置き方を繰り返すと安定する。';
 const main=factors.find(f=>f.priority===2);
 const labels=effective.length?['弱点！',...(main?[main.tag]:[])]:[...(main?[main.tag]:[]),...(a.count?[names[a.element]+'！']:[])];
 return {factors,labels:labels.slice(0,2),weaknesses:effective,hint,hitCount,breakdown:b,elementCause:cause,grooveText:a.groove?grooveEngine.describe(a.groove):'',groove:a.groove};
}
function marks(a,factors){
 const all=[];
 for(const f of factors){
  const source=f.source??'';
  const group=[];
  if(source.startsWith('groove-')){
   const id=source.slice(7),g=a.groove;
   for(const e of g?.events??[]){
    const yes=id==='laidBack'?e.offset>.008:id==='pushed'?e.type==='kick'&&e.offset<-.008:id==='snarePushed'?e.type==='snare'&&e.offset<-.008:id==='pocket'?(e.type==='kick'?e.offset<-.008:e.offset>.008):id==='tight'?Math.abs(e.offset)<.018:id==='swing'?e.q%4>=2:Math.abs(e.offset)>.008;
    if(yes)group.push({q:Math.max(0,Math.min(a.slots-1,e.q)),type:e.type});
   }
   if(g&&['laidBack','pushed','drunk','swing'].includes(id)&&g.hat[id]>.7*g[id]){
    for(const e of g.hat.events){
     const yes=id==='laidBack'?e.offset>.008:id==='pushed'?e.type==='kick'&&e.offset<-.008:id==='snarePushed'?e.type==='snare'&&e.offset<-.008:id==='swing'?e.q%4!==0:Math.abs(e.offset)>.008;
     if(yes)group.push({q:Math.max(0,Math.min(a.slots-1,e.q)),type:'hat'});
    }
   }
   const label={laidBack:'後ろ',pushed:'前',snarePushed:'スネア前',pocket:'前／後',tight:'同期',swing:'裏の揺れ',drunk:'再現',unstable:'揺らぎ'}[id];
   if(group.length)all.push({source,label,cells:group});
   continue;
  }
  a.grid.forEach((n,i)=>{
   const previous=a.grid[i-1],gap=n.t-(previous?.t??0);
   let matches=false;
   if(source==='power-zone')matches=(a.powerCells??[]).includes(n.q);
   if(source==='charge')matches=n.type==='kick'&&gap>(60/(a.bpm??120))*1.24;
   if(source==='heavy'||source==='kick')matches=n.type==='kick';
   if(source==='snare')matches=n.type==='snare';
   if(source==='burst'){const limit=(60/(a.bpm??120))*(a.count>12?.6:.36);matches=!!(previous&&gap<limit)||!!(a.grid[i+1]&&a.grid[i+1].t-n.t<limit);}
   if(source==='acceleration')matches=n.t>=(a.duration??4)/2;
   if(source==='offbeat')matches=n.q%4!==0;
   if(source==='chain')matches=!!previous&&n.type!==previous.type;
   if(source==='repeat')matches=n.q>=8&&a.masks[n.q]===a.masks[n.q-8];
   if(source==='irregular')matches=!!previous&&Math.abs(gap-a.meanInterval)>.12;
   if(matches)group.push({q:n.q,type:n.type});
  });
  const label={'power-zone':'POWER',charge:'溜め',heavy:'重撃',kick:'低音',snare:'高音',burst:'連撃',acceleration:'加速',offbeat:'裏',chain:'交互',repeat:'反復',irregular:'変化'}[source];
  if(group.length&&!all.some(m=>m.source===source))all.push({source,label,cells:group});
 }
 return all.slice(0,3);
}
function discover(known,kind,report){
 const next={...known,[kind]:Array.isArray(known[kind])?[...known[kind]]:[]},fresh=[];
 if(report.hitCount>0)for(const weak of report.weaknesses){if(!next[kind].includes(weak.id)){next[kind].push(weak.id);fresh.push(weak.id);}}
 return {known:next,fresh};
}
root.CombatFeedback={explain,marks,discover,discoveryNames};
if(typeof module!=='undefined')module.exports=root.CombatFeedback;
})(typeof window!=='undefined'?window:globalThis);
