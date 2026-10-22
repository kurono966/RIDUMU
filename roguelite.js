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
 gear.push(
  {id:'masterDrive',name:'灼熱マスター',style:'全体・歪み',condition:'Drumsを4打以上演奏',effect:'攻撃 +8%',up:'攻撃 +12%',kind:'attack',values:[.08,.12],audio:{target:'master',type:'distortion',description:'全体に温かい歪みと密度。強化で歪みが深くなる。'}},
  {id:'masterRoom',name:'余白の大聖堂',style:'全体・リバーブ',condition:'Drumsを4打以上、休符の割合20%以上',effect:'盾 +4',up:'盾 +7',kind:'shield',values:[4,7],audio:{target:'master',type:'reverb',description:'全体に空間と残響。強化で残響が長く豊かになる。'}},
  {id:'leadChorus',name:'双影のコーラス',style:'Lead・コーラス',condition:'Drumsを2打以上、Leadを3音以上演奏',effect:'攻撃 +8%',up:'攻撃 +12%',kind:'attack',values:[.08,.12],audio:{target:'lead',type:'chorus',description:'Leadに柔らかく揺らぐ厚み。強化で重なりが増える。'}},
  {id:'bassChorus',name:'深海のコーラス',style:'Bass・コーラス',condition:'Drumsを2打以上、Bassで演奏時間の30%以上を伸ばす',effect:'盾 +4',up:'盾 +7',kind:'shield',values:[4,7],audio:{target:'bass',type:'chorus',description:'Bassにゆっくり揺らぐ厚み。強化で揺れが深くなる。'}},
  {id:'leadFlanger',name:'銀翼フランジャー',style:'Lead・フランジャー',condition:'Drumsを4打以上、展開またはシンコペーション25%以上',effect:'装甲貫通 +8%',up:'装甲貫通 +12%',kind:'pierce',values:[.08,.12],audio:{target:'lead',type:'flanger',description:'Leadに金属的なうねり。強化でフィードバックが深まる。'}},
  {id:'bassFlanger',name:'磁場フランジャー',style:'Bass・フランジャー',condition:'Drumsを4打以上、KickにBassを2回以上合わせるかGROOVE LOCK成立',effect:'攻撃 +8%',up:'攻撃 +12%',kind:'attack',values:[.08,.12],audio:{target:'bass',type:'flanger',description:'Bassに流れるようなうねり。強化で共鳴が強くなる。'}},
  {id:'leadDelay',name:'応答のダブディレイ',style:'Lead・付点8分ディレイ',condition:'Drumsを4打以上、反復40%以上または掛け合い成立',effect:'攻撃 +8%',up:'攻撃 +12%',kind:'attack',values:[.08,.12],audio:{target:'lead',type:'delay',description:'LeadがBPMに同期して呼応。強化で反復が長く残る。'}},
  {id:'bassWah',name:'裏路地オートワウ',style:'Bass・ワウ',condition:'Drumsを4打以上、裏拍またはシンコペーション30%以上',effect:'装甲貫通 +8%',up:'装甲貫通 +12%',kind:'pierce',values:[.08,.12],audio:{target:'bass',type:'wah',description:'Bassの明るさが半拍周期で開閉。強化で動きが深くなる。'}},
  {id:'masterPhaser',name:'幻流フェイザー',style:'全体・フェイザー',condition:'Drumsを6打以上、SwingまたはDrunk35%以上',effect:'攻撃 +8%',up:'攻撃 +12%',kind:'attack',values:[.08,.12],audio:{target:'master',type:'phaser',description:'全体をゆっくり巡る位相の揺れ。強化でうねりが深くなる。'}},
  {id:'leadTremolo',name:'瞬きのトレモロ',style:'Lead・トレモロ',condition:'Drumsを4打以上、Leadを4音以上、休符の割合10%以上',effect:'盾 +4',up:'盾 +7',kind:'shield',values:[4,7],audio:{target:'lead',type:'tremolo',description:'Leadの音量が8分音符で脈打つ。強化で刻みが深くなる。'}}
 );
 const challenges=[
  {id:'repeat',name:'反復のセッション',text:'6打以上で前半の配置の半分以上を後半も繰り返す'},
  {id:'space',name:'余白のセッション',text:'4打以上で音の間の4分の1以上に休符を置く（16分3〜8個分）'}
 ];
 const byId=id=>gear.find(item=>item.id===id);
 const validRank=rank=>Number.isSafeInteger(rank)&&rank>=1;
 function valueAt(item){const g=byId(item.id);return g&&validRank(item.rank)?g.values[0]+(item.rank-1)*(g.values[1]-g.values[0]):0;}
 function effectText(item){const g=byId(item.id),value=valueAt(item),label={attack:'攻撃',shield:'盾',heal:'HP',pierce:'貫通強度'}[g.kind];return label+' +'+(['attack','pierce'].includes(g.kind)?(Math.round(value*1000)/10)+'%':Math.round(value))+(g.kind==='shield'?'（所持中の盾容量 +'+Math.round(value)+'）':'');}
 const shieldCapacity=inventory=>90+Math.round((inventory??[]).filter(item=>byId(item.id)?.kind==='shield').reduce((sum,item)=>sum+valueAt(item),0));
 function shuffle(values,rng=Math.random){const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
 function encounter(enemy,kind='normal',floor=1){
  const out=copy(enemy),growth=Math.max(0,floor-1),hp=(kind==='elite'?1.2:kind==='session'?1.1:1)*(1+.1*growth),attack=(kind==='elite'?1.12:1)*(1+.035*growth);
  out.hp=Math.round(out.hp*hp);out.attack=Math.round(out.attack*attack);out.baseAttack=out.attack;out.attackCap=Math.round(out.attack*1.6);
  out.routeKind=kind;out.floor=floor;return out;
 }
 function create(roster,rng=Math.random){
  const first=shuffle(roster.filter(e=>['stone','plant','machine'].includes(e.kind)),rng)[0]??roster[0];
  return {version:1,floor:1,total:8,phase:'starter',gear:[],used:[first.kind],current:{kind:'normal',enemy:encounter(first)},offers:null,rewards:null,skipReward:false,challenge:null,bonusPending:false,lastEffects:[],log:[]};
 }
 function routes(run,roster,rng=Math.random){
  if(run.offers)return run.offers;
  if(run.floor===run.total-1){run.offers=[{id:'boss',kind:'boss',enemy:encounter(roster.find(e=>e.kind==='conductor'),'boss',run.floor+1)}];return run.offers;}
  const available=shuffle(roster.filter(e=>e.kind!=='conductor'&&!run.used.includes(e.kind)),rng);
  if(!available.length)throw Error('No encounter remains');
  run.offers=[{id:'normal',kind:'normal',enemy:encounter(available[0],'normal',run.floor+1)},{id:'elite',kind:'elite',enemy:encounter(available[1]??available[0],'elite',run.floor+1)}];
  if([2,5].includes(run.floor))run.offers.push({id:'rest',kind:'rest'});
  if([3,6].includes(run.floor))run.offers.push({id:'session',kind:'session',enemy:encounter(available[0],'session',run.floor+1)});
  return run.offers;
 }
 function rewardOffers(run,rng=Math.random){
  if(run.rewards)return run.rewards;
  const rank=run.current.kind==='elite'?2:1;
  const pool=shuffle(gear,rng),choices=pool.slice(0,3);
  // Keep both sound-changing and rhythm-only equipment discoverable.
  for(const audio of [true,false])if(!choices.some(g=>!!g.audio===audio)){const extra=pool.find(g=>!!g.audio===audio&&!choices.includes(g));if(extra)choices[choices.length-1]=extra;}
  run.rewards=choices.map(g=>({id:g.id,rank:(run.gear.find(item=>item.id===g.id)?.rank??0)+rank}));
  return run.rewards;
 }
 function equip(run,offer){
  if(!byId(offer.id)||!validRank(offer.rank))return false;
  const owned=run.gear.find(g=>g.id===offer.id);
  if(owned){if(offer.rank<=owned.rank)return false;owned.rank=offer.rank;return true;}
  run.gear.push({...offer});return true;
 }
 function claim(run,id){
  if(!['starter','reward'].includes(run.phase))return false;
  const offer=run.rewards?.find(g=>g.id===id);if(!offer||!equip(run,offer))return false;
  run.log.push({floor:run.floor,type:'gear',id,rank:run.gear.find(g=>g.id===id).rank});run.rewards=null;
  run.phase=run.phase==='starter'?'battle':'route';return true;
 }
 function skip(run){if(!['starter','reward'].includes(run.phase))return false;run.rewards=null;run.phase=run.phase==='starter'?'battle':'route';return true;}
 function upgrade(run,id){const item=run.gear.find(g=>g.id===id);if(!item||!validRank(item.rank+1))return false;item.rank++;return true;}
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
  const hasUpgrade=run.gear.length>0;
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
   sustain:count>=2&&(bass.sustain??0)>=.45,
   masterDrive:count>=4,
   masterRoom:count>=4&&(form.rest??0)>=.2,
   leadChorus:count>=2&&(lead.pitch?.points?.length??0)>=3,
   bassChorus:count>=2&&(bass.sustain??0)>=.3,
   leadFlanger:count>=4&&Math.max(form.development??0,a.syncopation??0)>=.25,
   bassFlanger:count>=4&&((bass.locked??0)>=2||selected.has('grooveLock')),
   leadDelay:count>=4&&((form.repetition??0)>=.4||selected.has('response')||selected.has('callResponse')),
   bassWah:count>=4&&Math.max(a.offbeat??0,a.syncopation??0)>=.3,
   masterPhaser:count>=6&&Math.max(a.groove?.swing??0,a.groove?.drunk??0)>=.35,
   leadTremolo:count>=4&&(lead.pitch?.points?.length??0)>=4&&(form.rest??0)>=.1
  };
 }
 function effects(inventory,a,bass,lead,ensemble){
  const active=conditions(a,bass,lead,ensemble),totals={attack:0,shield:0,heal:0,pierce:0},triggers=[];
  for(const item of inventory??[]){const g=byId(item.id);if(!g||!active[g.id])continue;
   const value=valueAt(item);
   totals[g.kind]+=value;triggers.push({id:g.id,name:g.name,kind:g.kind,value});
  }
  return {...totals,triggers};
 }
 function apply(a,effects){
  const multiplier=1+effects.attack,power=a.power*multiplier,base=clamp(a.pitchPierce??0,0,.3),pierce=effects.pierce>0?1-(1-base)/(1+effects.pierce):base;
  return {...a,power,pitchPierce:pierce,gearPierce:pierce-(a.pitchPierce??0),gearEffects:copy(effects),powerSteps:[...(a.powerSteps??[{label:'Drums',value:a.power,multiplier:1}]),...(effects.attack?[{label:'機材：'+effects.triggers.filter(t=>t.kind==='attack'&&t.value>0).map(t=>t.name).join('・'),value:power,multiplier}]:[])]};
 }
 function checkChallenge(run,a){
  if(!run?.challenge||run.phase!=='battle'||run.challenge.done)return false;
  const active=conditions(a);run.challenge.done=!!(run.challenge.id==='repeat'?active.echo:active.break);return run.challenge.done;
 }
 const api={gear,challenges,byId,validRank,valueAt,effectText,shieldCapacity,create,encounter,routes,rewardOffers,equip,claim,skip,upgrade,rest,enter,victory,bonus,conditions,effects,apply,checkChallenge};
 root.RogueRun=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
