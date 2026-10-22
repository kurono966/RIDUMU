/* Read-only reconstruction and counterfactuals. Never writes combat or recordings. */
(function(root){
 'use strict';
 const get=(file,name)=>typeof module!=='undefined'?require('./'+file+'.js'):root[name];
 const R=get('rhythm','Rhythm'),Q=get('quantize','Quantize'),G=get('groove','Groove'),C=get('performance-combat','PerformanceCombat'),E=get('ensemble','Ensemble'),P=get('pitch-combat','PitchCombat'),S=get('synth','Synth');
 const Gear=get('roguelite','RogueRun');
 const copy=value=>JSON.parse(JSON.stringify(value)),raw=n=>n.inputT??n.rawT??n.t;
 const labels={drums:'● Drumsの刻み',bass:'▰ Bassの配置・長押し',lead:'↗ Leadの支援',affinity:'◇ 属性・敵との相性',rhythm:'＝ タイミングの再現',groove:'～ グルーヴ',ensemble:'◎ パートの掛け合い',pitch:'↕ 音程の使い分け',timbre:'◇ 音色の性格'};
 labels.gear='◈ 機材';
 labels.timing='＝ Bass・Leadのリズム精度とパート間の間隔';
 const grooveNames={pocket:'ポケット',laidBack:'後ろに置くノリ',pushed:'前に押すノリ',snarePushed:'スネアの前ノリ',swing:'跳ねるリズム',drunk:'同じ揺れの再現',tight:'タイトな重なり'};
 function evaluate(packet,options={}){
  const omit=options.omit,bpm=packet.bpm,duration=packet.duration,enemy=options.enemy??packet.enemy,parts=new Map(packet.tracks.map(t=>[t.voice,t.notes])),hats=packet.hats??[];
  const drums=omit==='drums'?[]:parts.get('drums')??[],bassNotes=parts.get('bass')??[],leadNotes=parts.get('lead')??[];
  let ensemble=E.analyze(parts,bpm,duration,options.omitSynergy);if(omit==='ensemble')ensemble={...ensemble,selected:[],bonus:Object.fromEntries(Object.keys(ensemble.bonus).map(k=>[k,0]))};
  const intent=enemy.intent??(enemy.intentId?{id:enemy.intentId,power:['guard','heal','buff'].includes(enemy.intentId)?0:enemy.intentId==='heavy'?1.2:enemy.intentId==='pierce'?.86:1.06,pierce:enemy.intentId==='pierce'?.4:0}:null);
  const timingEnabled=omit!=='timing';
  let bass=C.bass(bassNotes,drums,bpm,duration,[],intent??{},{enabled:timingEnabled,references:{hat:hats}}),lead=E.support(C.lead(leadNotes,bpm,duration,[],{enabled:timingEnabled,references:{hat:hats,drums,bass:bassNotes}}),ensemble);
  if(omit==='bass')bass={...bass,shield:0,rhythmShield:0,pitchShield:0,prepared:0};
  if(omit==='pitch'){bass={...bass,shield:bass.rhythmShield??bass.shield,pitch:null};lead={...lead,pitch:null};}
  if(omit==='lead')lead={...lead,...C.lead([],bpm,duration,[]),pitch:lead.pitch};
  const profile=voice=>{const track=packet.tracks.find(t=>t.voice===voice);return omit!=='timbre'&&track?.synth?S.profile(track.synth,Q.render(track.notes,bpm,duration),duration):{fire:0,water:0,wind:0,earth:0};};
  const bassProfile=profile('bass'),leadProfile=profile('lead');
  const style=voice=>{const track=packet.tracks.find(t=>t.voice===voice);return omit==='timbre'?{attack:1,shield:1}:S.style(track?.synth,track?.notes??[],duration);};
  const bassStyle=style('bass'),leadStyle=style('lead'),tone={attack:1+((bassStyle.attack-1)+(leadStyle.attack-1))*.5,accuracy:0,weaken:0};
  const carry=options.neutral?{hp:100,shield:0,enemyHp:enemy.hp}:packet.conditions??{hp:100,shield:0,enemyHp:enemy.hp};
  const initialShield=carry.shield??0,bassRaw=bass.shield,bassShield=Math.round(bassRaw*bassStyle.shield),afterBass=Math.min(90,initialShield+bassShield);
  const toneShield=Math.round(bassRaw*(leadStyle.shield-1)*.5),bonus=toneShield+Math.round(bassShield*(lead.shieldEfficiency+ensemble.bonus.shieldEfficiency))+ensemble.bonus.shield;
  let shield=Math.max(0,Math.min(90,afterBass+bonus));
  const groove=G.analyzeRelations(drums,hats,bpm,duration);
  let a=R.analyze(Q.render(drums,bpm,duration),duration,bpm);if(omit==='rhythm')a={...a,performanceQuality:{...a.performanceQuality,multiplier:1}};
  a=omit==='groove'?a:G.enrich(a,groove);
  a=E.attack(C.enhance(a,drums,bpm,[],lead),ensemble);
  a.power*=tone.attack;a.accuracy=Math.max(0,Math.min(.99,a.accuracy+tone.accuracy));a.timbreWeaken=tone.weaken;
  a=P.apply(a,bass.pitch,lead.pitch);
  const inventory=options.gear??packet.gear??[],gearEffects=Gear.effects(omit==='gear'?[]:inventory,a,bass,lead,ensemble);
  if(inventory.length){a=Gear.apply(a,gearEffects);shield=Math.min(90,shield+gearEffects.shield);}
  const healedHp=Math.min(100,(carry.hp??100)+gearEffects.heal);
  a.tactics=C.tactics(a,bass,lead,intent??{});
  const result=R.resolve(a,omit==='affinity'?{...enemy,kind:'neutral'}:enemy),reduction=C.reduction(lead,bass,ensemble,a),counter=!!options.neutral||(carry.enemyHp??enemy.hp)>result.total;
  const special=intent?.id==='special'&&!intent.poison&&(lead.pitch?.effects.weaken??0)>=.05?.25:0;
  const received=!counter||intent?.power===0?{incoming:0,damage:0,absorbed:0,shield,hp:healedHp}:intent?C.counterAttack(healedHp,shield,Math.max(1,Math.round(enemy.attack*intent.power))*(1-special),intent,reduction.total,a.tactics):C.receive(healedHp,shield,enemy.attack,reduction.total);
  return {analysis:a,result,bass,lead,ensemble,groove,profiles:{bass:bassProfile,lead:leadProfile},shield,shieldGenerated:shield-initialShield,healed:healedHp-(carry.hp??100),damage:options.neutral?result.total:Math.min(carry.enemyHp??enemy.hp,result.total),received,counter,reduction,conditions:{...carry}};
 }
 function description(id,value){const a=value.analysis,b=value.bass,l=value.lead;
  if(id==='timing')return 'Bass・Leadのリズムと他パートからの間隔を再現';
  if(id==='gear')return (a.gearEffects?.triggers??[]).filter(t=>t.value>0).map(t=>t.name).join('・')+'の演奏条件を達成';
  if(id==='drums')return a.charged>.3?'間の後のKickで重い一撃':a.alternation>.5?'KickとSnareの交互打ちで攻撃':'Drumsのリズムで攻撃';
  if(id==='bass')return b.locked?'Kickに重ねたBassで盾':b.sustain>.35?'Bassの長押しで厚い盾':'Bassの配置で盾';
  if(id==='lead')return l.shieldEfficiency>.15?'Leadの長音で盾を支援':'Leadの裏拍と配置で攻撃を支援';
  if(id==='pitch')return [b.pitch,l.pitch].flatMap(r=>r?.causes??[]).filter(c=>c.value>0).sort((x,y)=>y.value-x.value).slice(0,2).map(c=>c.label.split('（')[0]).join('・')||'音程の動きで支援';
  if(id==='ensemble')return value.ensemble.selected.map(s=>s.id==='grooveLock'?'KickとBassの同期':s.id==='response'?'DrumsにLeadが応答':s.reason).join('・')||'複数パートの支援が重なった';
  if(id==='groove'){const id=Object.keys(grooveNames).sort((x,y)=>(value.groove[y]??0)-(value.groove[x]??0))[0];return grooveNames[id]+'が敵に作用';}
  if(id==='rhythm')return a.performanceQuality?.evolving>.45?(a.structure.kickVariation>=a.structure.snareVariation?'Snareを軸にKickを変化させた':'Kickを軸にSnareを変化させた'):'狙ったタイミングを繰り返せた';
  if(id==='affinity')return ({earth:'土',wind:'風',fire:'炎',lightning:'雷'})[a.element]+'属性・攻撃の形が敵に合った';
  return '短音・長音に合う音色の輪郭';
 }
 function factors(packet,options={}){
  const actual=evaluate(packet,options),list=[],ensembleBenefits=actual.ensemble.selected.filter(s=>{const off=evaluate(packet,{...options,omitSynergy:s.id});return actual.damage>off.damage||(actual.counter&&actual.shieldGenerated>off.shieldGenerated)||actual.received.damage<off.received.damage;}).map(s=>s.id);
  for(const id of Object.keys(labels)){const without=evaluate(packet,{...options,omit:id}),damage=actual.damage-without.damage,shield=actual.counter?actual.shieldGenerated-without.shieldGenerated:0,saved=without.received.damage-actual.received.damage;
   const healing=actual.healed-without.healed,score=Math.max(0,damage)+.6*Math.max(0,shield)+1.3*Math.max(0,saved)+Math.max(0,healing);if(score<.5)continue;
   const effects=[damage>0?'攻撃を強化':null,shield>0?'盾を強化':null,saved>0?'HPを守った':null,healing>0?'HPを回復':null].filter(Boolean);
   const described=id==='ensemble'?{...actual,ensemble:{...actual.ensemble,selected:actual.ensemble.selected.filter(s=>ensembleBenefits.includes(s.id))}}:actual;
   list.push({id,label:labels[id],cause:description(id,described),text:description(id,described)+' → '+effects.join('・'),damage,shield,saved,score});
  }return {actual,ensembleBenefits,all:list.sort((a,b)=>b.score-a.score),top:list.sort((a,b)=>b.score-a.score).slice(0,3)};
 }
 function compare(previous,current){
  if(!previous||previous.enemy.kind!==current.enemy.kind)return null;
  const options={neutral:true,enemy:current.enemy,gear:current.gear??[]},before=factors(previous,options),after=factors(current,options),a=before.actual,b=after.actual;
  const changes=Object.keys(labels).map(id=>{const x=before.all.find(f=>f.id===id),y=after.all.find(f=>f.id===id);return {id,label:labels[id],delta:(y?.score??0)-(x?.score??0),cause:y?.cause??x?.cause,observation:changeDescription(id,a,b)};}).filter(c=>Math.abs(c.delta)>=.5).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta));
  return {before:a,after:b,damage:b.damage-a.damage,shield:b.shieldGenerated-a.shieldGenerated,received:b.received.damage-a.received.damage,changes,conditions:'今回の敵性能・HP100・持ち越し盾0で再計算。敵が生存し反撃する想定。実戦の撃破・オーバーキル・残HPの影響は除外。'};
 }
 function changeDescription(id,a,b){
  if(id==='timing')return 'Bass・Leadのリズム精度とパート間の間隔の再現性が変わった';
  if(id==='gear')return '同じ機材で、演奏条件の成立と発動効果が変わった';
  if(id==='drums')return b.analysis.count<a.analysis.count?'Drumsの音を減らし、間が広がった':b.analysis.count>a.analysis.count?'Drumsを細かく刻むようになった':'Drumsの間隔やアクセントが変わった';
  if(id==='rhythm')return (b.analysis.performanceQuality.evolving??0)>(a.analysis.performanceQuality.evolving??0)+.1?'軸を保ちながら、リズムに小さな変化を入れられた':b.analysis.performanceQuality.multiplier>a.analysis.performanceQuality.multiplier?'狙ったタイミングを前回より正確に演奏できた':'タイミングの形が前回より揺れた';
  if(id==='bass')return b.bass.sustain>a.bass.sustain?'Bassを前回より長く伸ばした':b.bass.locked>a.bass.locked?'Kickに重なるBassが増えた':'Bassの長さ・Kickとの重なりが変わった';
  if(id==='lead')return b.lead.shieldEfficiency>a.lead.shieldEfficiency?'Leadを長く伸ばし、盾の支援が増えた':'Leadの長さや裏拍の使い方が変わった';
  if(id==='pitch'){
   const old=a.lead.pitch?.effects??{},now=b.lead.pitch?.effects??{},choices=[['pierce','Leadの大きな跳躍'],['attack','Leadの上昇・中音程'],['accuracy','Leadの同音反復'],['weaken','Leadの下降']].sort((x,y)=>Math.abs((now[y[0]]??0)-(old[y[0]]??0))-Math.abs((now[x[0]]??0)-(old[x[0]]??0)));
   if(Math.abs((b.bass.pitch?.effects.attack??0)-(a.bass.pitch?.effects.attack??0))>.04)return (b.bass.pitch?.effects.attack??0)>(a.bass.pitch?.effects.attack??0)?'Bassを高音寄りにして、盾から攻撃支援へ寄せた':'Bassを低音寄りにして、防壁へ寄せた';
   const [field,label]=choices[0];return label+((now[field]??0)>(old[field]??0)?'が増えた':'が減った');
  }
  if(id==='ensemble'){const old=new Set(a.ensemble.selected.map(s=>s.id)),added=b.ensemble.selected.filter(s=>!old.has(s.id));return added.length?added.map(s=>s.id==='grooveLock'?'KickとBassの同期':s.id==='response'?'DrumsへのLeadの応答':s.reason).join('・')+'が成立した':'パート同士の掛け合いの成立度が変わった';}
  if(id==='affinity')return a.analysis.element!==b.analysis.element?'Drumsの使い方が変わり、攻撃属性が変わった':'同じ属性でも、重さや連打の形が変わった';
  if(id==='timbre')return '波形・フィルター・音の長さによる音色の性格が変わった';
  const fields=Object.keys(grooveNames).sort((x,y)=>Math.abs((b.groove[y]??0)-(a.groove[y]??0))-Math.abs((b.groove[x]??0)-(a.groove[x]??0))),field=fields[0];return grooveNames[field]+((b.groove[field]??0)>(a.groove[field]??0)?'が強まった':'が弱まった');
 }
 function hint(value,enemy,recent=[]){
  if(!value.analysis.count)return recent.includes('firstKick')?{id:'firstSnare',text:'まずSnareを拍に合わせて入力し、攻撃の土台を作ろう。'}:{id:'firstKick',text:'まずKickを拍に合わせて入力し、攻撃の土台を作ろう。'};
  const selected=new Set(value.ensemble.selected.map(s=>s.id)),p=value.lead.pitch?.effects??{},candidates=[];
  const add=(id,when,text,priority=1)=>{if(when)candidates.push({id,text,priority});};
  add('armor',(enemy.guard??0)>0&&(p.pierce??0)<.08,'Leadで大きく跳躍して、敵の装甲シールド貫通を試そう。',3);
  add('lock',!selected.has('grooveLock')&&value.bass.shield>0&&value.shield<90,'KickとBassを重ね、同期による攻撃と盾の強化を狙おう。',2);
  add('response',!selected.has('response'),'Drumsのアクセントの少し後にLeadを返し、掛け合いを試そう。');
  add('rise',(p.attack??0)<.07,'Leadを少しずつ上げ、攻撃支援を試そう。');
  add('fall',value.received.damage>0&&(p.weaken??0)<.06&&value.reduction.total<.55,'Leadを下降させ、次の反撃を弱めてみよう。',2);
  add('repeat',(p.accuracy??0)<0,'Leadに同じ音の反復を混ぜ、跳躍の命中低下を補ってみよう。',2);
  add('quality',value.analysis.performanceQuality?.multiplier<1.05,'Snareなどの軸を安定させ、Kickの配置を少し変える演奏も試そう。');
  add('kickVariation',!['fly','crystal'].includes(enemy.kind)&&(value.analysis.structure?.anchoredVariation??0)<.35,'Snareを一定に保ち、後半のKickを一音足す・動かす変化を試そう。',2);
  const target={stone:'laidBack',fly:'snarePushed',machine:'tight',plant:'swing',ghost:'drunk',crystal:'pocket',furnace:'swing',conductor:'tight'}[enemy.kind];
  add('groove-'+target,(value.groove[target]??0)<.35,({laidBack:'少し後ろに置くリズム',snarePushed:'スネアの前ノリ',tight:'Hatとそろえたタイトな刻み',swing:'跳ねるリズム',drunk:'同じ揺れ方の繰り返し',pocket:'KickとSnareの間を生かすノリ'})[target]+'を、この敵に試してみよう。',2);
  return candidates.sort((a,b)=>(recent.includes(a.id)?1:0)-(recent.includes(b.id)?1:0)||b.priority-a.priority||a.id.localeCompare(b.id))[0]??{id:'space',text:'音を少し減らし、音の間を生かす演奏も試してみよう。'};
 }
 function live(tracks,hats,voice,note,bpm,duration,enemy=null){
  const now=raw(note),source=new Map(['drums','bass','lead'].map(v=>[v,(tracks.get(v)??[]).filter(n=>raw(n)<=now+1e-7)])),ensemble=E.analyze(source,bpm,duration),q=Math.max(0,Math.min(31,Math.round(now/(60/bpm/4))));
  const events=[];
  for(const s of ensemble.selected)if(['grooveLock','response'].includes(s.id)&&s.cells.some(c=>c.voice===voice&&c.q===q))events.push({kind:s.id==='grooveLock'?'lock':'response',strength:s.score,label:s.id==='grooveLock'?'◎ Kick + Bass 同期':'↔ Drums → Lead 応答',provisional:true,q});
  const pitch=P.analyze(source.get(voice)??[],voice,bpm,duration),edge=pitch.edges.at(-1);
  if(voice==='lead'&&edge){const field=edge.kind==='up'?'attack':edge.kind==='down'?'weaken':edge.kind==='same'?'accuracy':'pierce',strength=pitch.effects[field];if(strength>0)events.push({kind:edge.kind,strength:Math.min(1,strength*4),label:({up:'↑ 上昇 → 攻撃の形',down:'↓ 下降 → 弱体化の形',same:'＝ 反復 → 安定の形',leap:enemy&&!enemy.guard?'↯ 跳躍：この敵は装甲なし':'↯ 跳躍 → 貫通の形'})[edge.kind],provisional:true,q});}
  if(voice==='bass'){if(pitch.effects.shield>0)events.push({kind:'low',strength:Math.min(1,pitch.effects.shield*4),label:'▰ '+(pitch.causes.some(c=>c.id==='low'&&c.value>0)?'低音':'反復')+' → 盾の形',provisional:true,q});if(pitch.effects.attack>0)events.push({kind:'high',strength:Math.min(1,pitch.effects.attack*6),label:'↗ 高音 → 攻撃の形',provisional:true,q});}
  const drums=source.get('drums'),groove=G.analyzeRelations(drums,hats.filter(n=>raw(n)<=now),bpm,duration),quality=R.analyze(Q.render(drums,bpm,duration),duration,bpm).performanceQuality;
  if(events.length===0&&quality.confidence>.4&&quality.multiplier>1.08)events.push({kind:'quality',strength:Math.min(1,(quality.multiplier-1)*2),label:'＝ タイミングの再現',provisional:true,q});
  if(events.length===0&&groove.confidence>.2){const top=Object.keys(grooveNames).sort((a,b)=>(groove[b]??0)-(groove[a]??0))[0];if(groove[top]>.35)events.push({kind:'groove',strength:groove[top],label:'～ '+grooveNames[top],provisional:true,q});}
  return events.slice(0,2);
 }
 root.PerformanceReview={evaluate,factors,compare,hint,live,copy,labels};if(typeof module!=='undefined')module.exports=root.PerformanceReview;
})(globalThis);
