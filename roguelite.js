/* Run progression and equipment rules. No DOM, audio, or recording mutations. */
(function(root){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const gear=[
  {id:'sub',name:'重低音アンプ',style:'Kick・間',condition:'Kickが7割以上・2打以上で、1.5拍以上の間を作る',effect:'盾 +8',up:'盾 +12',kind:'shield',values:[8,12]},
  {id:'wind',name:'双風スティック',style:'交互',condition:'6打以上をほぼ一定に、4回中3回以上交互に打つ',effect:'盾 +6',up:'盾 +9',kind:'shield',values:[6,9]},
  {id:'echo',name:'残響ペダル',style:'反復',condition:'6打以上で、前半の配置の半分以上を後半も繰り返す',effect:'攻撃 +10%',up:'攻撃 +15%',kind:'attack',values:[.1,.15]},
  {id:'break',name:'ブレイクミキサー',style:'休符',condition:'4打以上で、音の間の4分の1以上を休符にする（16分3〜8個分）',effect:'装甲貫通 +12%',up:'装甲貫通 +18%',kind:'pierce',values:[.12,.18]},
  {id:'response',name:'掛け合いモニター',style:'応答',condition:'Drums→Leadの応答、またはCALL & RESPONSEを成立させる',effect:'HP +3',up:'HP +5',kind:'heal',values:[3,5]},
  {id:'lock',name:'同期ケーブル',style:'Drums＋Bass',condition:'KickとBassを合わせ、GROOVE LOCKを成立させる',effect:'攻撃 +12%',up:'攻撃 +18%',kind:'attack',values:[.12,.18]},
  {id:'rise',name:'メロディブースター',style:'Lead',condition:'Leadを4音以上弾き、上昇や中程度の音程移動で攻撃支援を作る',effect:'攻撃 +10%',up:'攻撃 +15%',kind:'attack',values:[.1,.15]},
  {id:'anchor',name:'着地コンプレッサー',style:'防御準備',condition:'予告された攻撃の拍をBassで支える（防御準備60%以上）',effect:'盾 +8',up:'盾 +12',kind:'shield',values:[8,12]},
  {id:'swing',name:'スウィングドライブ',style:'跳ねる',condition:'6打以上で、スウィングを50%以上成立させる',effect:'攻撃 +12%',up:'攻撃 +18%',kind:'attack',values:[.12,.18]},
  {id:'spark',name:'裏拍トランス',style:'裏拍',condition:'4打以上で、裏拍を打ち次の表拍を抜く配置を4割以上作る',effect:'装甲貫通 +12%',up:'装甲貫通 +18%',kind:'pierce',values:[.12,.18]},
  {id:'develop',name:'展開シーケンサー',style:'変化',condition:'モチーフ変化・緊張と解放・前後半の掛け合いのいずれかを30%以上成立',effect:'攻撃 +12%',up:'攻撃 +18%',kind:'attack',values:[.12,.18]},
  {id:'sustain',name:'サステイン電源',style:'Bass長音',condition:'Bassを合計で演奏時間の45%以上伸ばす',effect:'盾 +6',up:'盾 +9',kind:'shield',values:[6,9]}
 ];
 const challenges=[
  {id:'repeat',name:'反復のセッション',text:'6打以上で前半の配置の半分以上を後半も繰り返す'},
  {id:'space',name:'余白のセッション',text:'4打以上で音の間の4分の1以上に休符を置く（16分3〜8個分）'}
 ];
 const byId=id=>gear.find(item=>item.id===id);
 function shuffle(values,rng=Math.random){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function encounter(enemy,kind='normal'){
  const out=copy(enemy),hp=kind==='elite'?1.2:kind==='session'?1.1:1,attack=kind==='elite'?1.12:1;
  out.hp=Math.round(out.hp*hp);out.attack=Math.round(out.attack*attack);out.attackCap=Math.round(out.attack*1.6);
  out.routeKind=kind;return out;
 }
 function create(roster,rng=Math.random){
  const first=shuffle(roster.filter(e=>['stone','plant','machine'].includes(e.kind)),rng)[0]??roster[0];
  return {version:1,floor:1,total:8,phase:'starter',gear:[],used:[first.kind],current:{kind:'normal',enemy:encounter(first)},offers:null,rewards:null,skipReward:false,challenge:null,bonusPending:false,lastEffects:[],log:[]};
 }
 function routes(run,roster,rng=Math.random){
  if(run.offers)return run.offers;
  if(run.floor===run.total-1){run.offers=[{id:'boss',kind:'boss',enemy:encounter(roster.find(e=>e.kind==='conductor'),'boss')}];return run.offers;}
  const available=shuffle(roster.filter(e=>e.kind!=='conductor'&&!run.used.includes(e.kind)),rng);
  if(!available.length)throw Error('No encounter remains');
  run.offers=[{id:'normal',kind:'normal',enemy:encounter(available[0])},{id:'elite',kind:'elite',enemy:encounter(available[1]??available[0],'elite')}];
  if([2,5].includes(run.floor))run.offers.push({id:'rest',kind:'rest'});
  if([3,6].includes(run.floor))run.offers.push({id:'session',kind:'session',enemy:encounter(available[0],'session')});
  return run.offers;
 }
 function rewardOffers(run,rng=Math.random){
  if(run.rewards)return run.rewards;
  const rank=run.current.kind==='elite'?2:1;
  run.rewards=shuffle(gear.filter(g=>!run.gear.some(item=>item.id===g.id&&item.rank===2)),rng).slice(0,3).map(g=>({id:g.id,rank:run.gear.some(item=>item.id===g.id)?2:rank}));
  return run.rewards;
 }
 function equip(run,offer,replaceId=null){
  if(!byId(offer.id)||![1,2].includes(offer.rank))return false;
  const owned=run.gear.find(g=>g.id===offer.id);
  if(owned){if(owned.rank===2)return false;owned.rank=2;return true;}
  if(run.gear.length>=4){const index=run.gear.findIndex(g=>g.id===replaceId);if(index<0)return false;run.gear.splice(index,1);}
  run.gear.push({...offer});return true;
 }
 function claim(run,id,replaceId=null){
  if(!['starter','reward'].includes(run.phase))return false;
  const offer=run.rewards?.find(g=>g.id===id);if(!offer||!equip(run,offer,replaceId))return false;
  run.log.push({floor:run.floor,type:'gear',id,rank:run.gear.find(g=>g.id===id).rank});run.rewards=null;
  run.phase=run.phase==='starter'?'battle':'route';return true;
 }
 function skip(run){if(!['starter','reward'].includes(run.phase))return false;run.rewards=null;run.phase=run.phase==='starter'?'battle':'route';return true;}
 function upgrade(run,id){const item=run.gear.find(g=>g.id===id&&g.rank===1);if(!item)return false;item.rank=2;return true;}
 function rest(run,id){
  if(run.phase!=='route'||!run.offers?.some(o=>o.kind==='rest'))return null;
  if(id!=='heal'&&!upgrade(run,id))return null;
  run.skipReward=true;run.offers=run.offers.filter(o=>o.kind!=='rest');run.log.push({floor:run.floor,type:'rest',id});
  return {heal:id==='heal'?35:0};
 }
 function enter(run,id,challengeId=null){
  if(run.phase!=='route')return false;
  const choice=run.offers?.find(o=>o.id===id);if(!choice?.enemy)return false;
  if(choice.kind==='session'&&!challenges.some(c=>c.id===challengeId))return false;
  run.floor++;run.current=copy(choice);run.used.push(choice.enemy.kind);run.phase='battle';run.offers=null;run.rewards=null;run.lastEffects=[];delete run.lastSummary;
  run.challenge=choice.kind==='session'?{...challenges.find(c=>c.id===challengeId),done:false}:null;
  run.log.push({floor:run.floor,type:'route',kind:choice.kind,enemy:choice.enemy.kind});return true;
 }
 function victory(run){
  if(run.phase!=='battle')return false;
  run.bonusPending=!!run.challenge?.done;
  if(run.floor===run.total){run.phase='complete';return true;}
  run.phase=run.bonusPending?'bonus':run.skipReward?'route':'reward';if(!run.bonusPending)run.skipReward=false;return true;
 }
 function bonus(run,id){
  if(run.phase!=='bonus')return null;
  const hasUpgrade=run.gear.some(g=>g.rank===1);
  if(hasUpgrade&&!upgrade(run,id))return null;
  run.bonusPending=false;run.phase=run.skipReward?'route':'reward';run.skipReward=false;return {heal:hasUpgrade?0:15};
 }
 function conditions(a,bass={},lead={},ensemble={}){
  const count=a.count??0,form=a.structure??{},selected=new Set((ensemble.selected??[]).map(s=>s.id));
  return {
   sub:count>=2&&a.kick/count>=.7&&a.hasLongGap,
   wind:count>=6&&a.alternation>=.75&&a.regularity>=.7,
   echo:count>=6&&form.repetition>=.5,
   break:count>=4&&form.rest>=.25,
   response:count>=4&&(selected.has('response')||selected.has('callResponse')),
   lock:count>=4&&selected.has('grooveLock'),
   rise:count>=2&&(lead.pitch?.points?.length??0)>=4&&(lead.pitch?.effects?.attack??0)>=.06,
   anchor:count>=2&&(bass?.prepared??0)>=.6,
   swing:count>=6&&(a.groove?.swing??0)>=.5,
   spark:count>=4&&(a.syncopation??0)>=.4,
   develop:count>=4&&(form.development??0)>=.3,
   sustain:count>=2&&(bass.sustain??0)>=.45
  };
 }
 function effects(inventory,a,bass,lead,ensemble){
  const active=conditions(a,bass,lead,ensemble),totals={attack:0,shield:0,heal:0,pierce:0},caps={attack:.25,shield:18,heal:6,pierce:.24},triggers=[];
  for(const item of inventory??[]){const g=byId(item.id);if(!g||!active[g.id])continue;
   const value=Math.min(g.values[clamp(item.rank??1,1,2)-1],caps[g.kind]-totals[g.kind]);
   totals[g.kind]+=value;triggers.push({id:g.id,name:g.name,kind:g.kind,value});
  }
  return {...totals,triggers};
 }
 function apply(a,effects){
  const multiplier=1+effects.attack,power=a.power*multiplier,pierce=Math.min(.3,(a.pitchPierce??0)+effects.pierce);
  return {...a,power,pitchPierce:pierce,gearPierce:pierce-(a.pitchPierce??0),gearEffects:copy(effects),powerSteps:[...(a.powerSteps??[{label:'Drums',value:a.power,multiplier:1}]),...(effects.attack?[{label:'機材：'+effects.triggers.filter(t=>t.kind==='attack'&&t.value>0).map(t=>t.name).join('・'),value:power,multiplier}]:[])]};
 }
 function checkChallenge(run,a){
  if(!run?.challenge||run.phase!=='battle'||run.challenge.done)return false;
  const active=conditions(a);run.challenge.done=!!(run.challenge.id==='repeat'?active.echo:active.break);return run.challenge.done;
 }
 const api={gear,challenges,byId,create,encounter,routes,rewardOffers,equip,claim,skip,upgrade,rest,enter,victory,bonus,conditions,effects,apply,checkChallenge};
 root.RogueRun=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
