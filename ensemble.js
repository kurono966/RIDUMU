/* Cross-part relationships use raw input; playback quantization never creates synergy. */
(function(root){
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 const raw=n=>n.inputT??n.rawT??n.t;
 function analyze(tracks,bpm=120,duration=480/bpm){
  const step=60/bpm/4,slots=Math.round(duration/step),tolerance=Math.min(.055,step*.4);
  const source=tracks&&typeof tracks.get==='function'?{drums:tracks.get('drums'),bass:tracks.get('bass'),lead:tracks.get('lead')}:Array.isArray(tracks)?Object.fromEntries(tracks.map(t=>[t.voice,t.notes])):tracks;
  function clean(voice){
   const cells=new Map();
   for(const n of [...(source?.[voice]??[])].filter(n=>Number.isFinite(raw(n))&&raw(n)>=-step*4&&raw(n)<duration).sort((a,b)=>raw(a)-raw(b))){
    const q=clamp(Math.round(raw(n)/step),0,slots-1),key=voice==='drums'?q+':'+n.type:q;
    if(!cells.has(key))cells.set(key,{...n,voice,time:raw(n),q});
   }return [...cells.values()];
  }
  const drums=clean('drums'),bass=clean('bass'),lead=clean('lead'),kick=drums.filter(n=>n.type==='kick');
  const density=notes=>new Set(notes.map(n=>n.q)).size/slots;
  const restraint=clamp((.9-Math.max(density(drums),density(bass),density(lead)))/.55);
  const pairs=(a,b,match)=>{const used=new Set(),out=[];for(const x of a){const y=b.filter(n=>!used.has(n)&&match(x,n)).sort((p,q)=>Math.abs(p.time-x.time)-Math.abs(q.time-x.time))[0];if(y){used.add(y);out.push([x,y]);}}return out;};
  const candidates=[];
  function add(id,name,score,groups,reason){score=clamp(score*restraint);if(score<.32)return;
   const cells=[...new Map(groups.flat().map(n=>[n.voice+':'+n.q,n])).values()].map(n=>({voice:n.voice,type:n.type,q:n.q}));
   candidates.push({id,name,score,count:groups.length,cells,reason});
  }
  const locked=pairs(kick,bass,(a,b)=>Math.abs(a.time-b.time)<=tolerance);
  add('grooveLock','GROOVE LOCK',Math.min(1,locked.length/3)*locked.length/Math.max(1,kick.length,bass.length),locked,`Kick + Bassが${locked.length}か所で同期`);
  const accents=drums.filter(n=>n.type==='snare'||n.q%4===0);
  const responses=pairs(accents,lead,(a,b)=>b.time-a.time>=step*.6&&b.time-a.time<=step*2.5);
  add('response','RESPONSE',Math.min(1,responses.length/3)*responses.length/Math.max(1,lead.length),responses,'Drumsのアクセントの後にLeadが応答');
  const gaps=[...bass,...lead].filter(n=>drums.length&&drums.every(d=>Math.abs(d.time-n.time)>step*.8)&&drums.some(d=>Math.abs(d.time-n.time)<=step*3));
  const gapSlots=new Set(gaps.map(n=>n.q)),combined=new Set([...drums,...bass,...lead].map(n=>n.q));
  const gapScore=Math.min(1,gapSlots.size/4)*gaps.length/Math.max(1,bass.length+lead.length)*clamp((.85-combined.size/slots)/.35);
  add('interlock','INTERLOCK',gapScore,gaps.map(n=>[n]),`Drumsの空白${gapSlots.size}か所を補完`);
  const unions=[];
  for(const d of drums.filter(n=>n.q%8===0&&Math.abs(n.time-n.q*step)<=tolerance)){
   if(unions.some(group=>group[0].q===d.q))continue;
   const b=bass.find(n=>Math.abs(n.time-d.time)<=tolerance),l=lead.find(n=>Math.abs(n.time-d.time)<=tolerance);
   if(b&&l)unions.push([d,b,l]);
  }
  add('unison','UNISON',Math.min(1,unions.length/2)*clamp(1-(unions.length-2)*.3),unions.slice(0,2),'重要なアクセントで3パートが合流');
  // Match short non-uniform motifs after the call ends; compare relative intervals,
  // not pitch, absolute grid coordinates or the number of notes played.
  const calls=[...new Map(drums.map(n=>[n.q,n])).values()].sort((a,b)=>a.time-b.time),motifs=[];
  for(const part of [bass,lead])for(let i=0;i<calls.length-2;i++){
   const call=calls.slice(i,i+3),x=call[1].time-call[0].time,y=call[2].time-call[1].time;
   if(Math.min(x,y)<step*.7||Math.max(x,y)>step*6||Math.abs(x-y)<step*.6)continue;
   for(let j=0;j<part.length-2;j++){
    const answer=part.slice(j,j+3),lag=answer[0].time-call[2].time;
    if(lag<step*.5||lag>step*8)continue;
    const u=answer[1].time-answer[0].time,v=answer[2].time-answer[1].time,scale=(u+v)/(x+y);
    if(scale<.8||scale>1.2||Math.abs(u-x*scale)>step*.35||Math.abs(v-y*scale)>step*.35)continue;
    if(!motifs.some(g=>g.some(n=>n.voice===answer[0].voice&&n.q===answer[0].q)))motifs.push([...call,...answer]);
   }
  }
  add('callResponse','CALL & RESPONSE',Math.min(1,.6+motifs.length*.15)*(motifs.length?1:0),motifs.slice(0,2),'短いリズムの形を別パートが返した');
  const selected=candidates.sort((a,b)=>b.score-a.score).slice(0,2);
  const bonus={attack:0,shield:0,support:0,accuracy:0,shieldEfficiency:0,element:0,resistance:0,break:0};
  selected.forEach((s,i)=>{const strength=s.score*(i?.6:1),pct=n=>Math.round(n*100);
   if(s.id==='grooveLock'){const attack=.1*strength,shield=4*strength;bonus.attack+=attack;bonus.shield+=shield;s.effect=`攻撃 +${pct(attack)}% / 盾 +${Math.round(shield)}`;}
   if(s.id==='response'){bonus.support+=.18*strength;s.effect=`Lead支援 +${pct(.18*strength)}%`;}
   if(s.id==='interlock'){bonus.accuracy+=.05*strength;bonus.shieldEfficiency+=.1*strength;s.effect=`命中効率 +${pct(.05*strength)}% / 盾効率 +${pct(.1*strength)}%`;}
   if(s.id==='unison'){bonus.attack+=.12*strength;bonus.break+=.08*strength;s.effect=`攻撃 +${pct(.12*strength)}% / ブレイク強化`;}
   if(s.id==='callResponse'){bonus.element+=.12*strength;bonus.resistance+=.08*strength;s.effect=`属性効果 +${pct(.12*strength)}% / 敵攻撃 −${pct(.08*strength)}%`;}
  });
  bonus.attack=Math.min(.18,bonus.attack);bonus.shield=Math.min(6,Math.round(bonus.shield));
  return {scores:{grooveLock:0,response:0,interlock:0,unison:0,callResponse:0,...Object.fromEntries(candidates.map(s=>[s.id,s.score]))},selected,bonus};
 }
 function support(base,ensemble){const next={...base},b=ensemble.bonus;for(const k of ['attack','expose','accuracy','element','shieldEfficiency','weaken'])next[k]=(base[k]??0)*(1+b.support);return next;}
 function attack(base,ensemble){const b=ensemble.bonus,multiplier=1+Math.min(.2,b.attack+b.break*.25),power=base.power*multiplier;return {...base,power,powerSteps:[...(base.powerSteps??[{label:'Drums',value:base.power,multiplier:1}]),{label:'シナジー（ブレイク込み）',value:power,multiplier}],accuracy:clamp(base.accuracy+b.accuracy,0,.99),effect:clamp(base.effect*(1+b.element)),breakPower:clamp((base.breakPower??0)+b.break)};}
 const api={analyze,support,attack};root.Ensemble=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
