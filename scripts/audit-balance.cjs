// Verification only. No writes to any production source or balance value.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const R=require('../rhythm'),G=require('../groove'),C=require('../performance-combat'),E=require('../ensemble'),S=require('../synth'),Review=require('../performance-review');
const {create}=require('./audit-game.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,(process.env.RIDUMU_AUDIT_DIR||'balance-after'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const production=()=>Object.fromEntries(fs.readdirSync(root).filter(n=>/\.(js|css|html)$/.test(n)).map(n=>[n,hash(fs.readFileSync(path.join(root,n)))]));
const original=production(),game=create(),roster=game.roster(),intents=['guard','heavy','pierce','heal','buff','special'];
const clone=x=>JSON.parse(JSON.stringify(x));
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const patterns=[];
const add=(id,family,slots,mask='KS',extra={})=>patterns.push({id,family,slots,mask,...extra});
const seq=(n,step=1,start=0)=>Array.from({length:n},(_,i)=>start+i*step);
for(const [i,spacing] of [4,2,1].entries())add('alternate_'+spacing,'交互',seq(32/spacing,spacing),'KS');
for(const shift of [0,1,2]){add('kick_'+shift,'毎拍Kick',seq(8,4,shift),'K');add('snare_'+shift,'毎拍Snare',seq(8,4,shift),'S');}
for(const [i,mask] of ['K','S','KSS'].entries())add('sync_'+i,'裏拍・シンコペーション',[0,3,6,10,14,16,19,22,27,30],mask);
for(const [i,mask] of ['K','S','KS'].entries())add('offbeat_'+i,'裏拍・シンコペーション',seq(8,4,2),mask);
for(const [i,mask] of ['K','S','KS'].entries())add('late_'+i,'後半集中',[16,20,24,26,28,29,30,31],mask);
for(const [i,slots] of [[0,12,24],[0,8,20,28],[4,16,28]].entries())add('rest_'+i,'低密度・休符',slots,i===1?'KS':'K');
for(const mask of ['K','S','KSS'])add('dense_'+mask,'高密度',seq(32),mask);
for(const ms of [25,40,55])add('laid_'+ms,'レイドバック',seq(16,2),'KS',{offsetMs:ms});
for(const strength of [1/8,1/6,1/4])add('swing_'+strength,'スウィング',seq(16,2),'KS',{swing:strength});
for(const scale of [.6,1,1.4])add('drunk_'+scale,'ドランク',seq(16,2),'KSSK',{drunk:scale});
for(let seed=1;seed<=3;seed++)add('jitter_'+seed,'タイミングミス',seq(16,2),'KS',{jitter:seed});
for(const [i,slots] of [[0,4,7,10,12,16,20,23,27,30],[0,3,6,10,14,16,19,22,26,29,31],[0,6,8,10,12,14,16,18,19,20,22,23,28]].entries())add('complex_'+i,'構造的な変化',slots,'KKSS');
add('dialogue','掛け合い',seq(16,2),'KKKKKKKKSSSSSSSS');
for(let seed=1;seed<=9;seed++){
 const rand=rng(seed),n=[8,16,24][(seed-1)%3],shuffled=seq(32);
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const slots=shuffled.slice(0,n).sort((a,b)=>a-b),mask=slots.map(()=>rand()<.5?'K':'S').join('');
 add('random_'+seed,'ランダム',slots,mask,{jitter:seed+50});
}
add('cluster','無秩序な連打',seq(128).map(i=>i*.01),'KS',{stress:true});
add('spam_128','過密ストレス',seq(128,.25),'KS',{stress:true});
add('duplicates','重複ストレス',seq(8,4).flatMap(q=>Array(32).fill(q)),'KS',{stress:true});
add('silence','無音',[],'K');
function drums(p,bpm){const step=60/bpm/4,beat=60/bpm,rand=rng(p.jitter??1);return p.slots.map((q,i)=>{
 let t=q*step;if(p.offsetMs&&p.mask[i%p.mask.length]==='S')t+=p.offsetMs/1000;
 if(p.swing&&Math.round(q/2)%2)t+=beat*p.swing;
 if(p.drunk)t+=[.02,-.015,.04,-.01][i%4]*p.drunk;
 if(p.jitter)t+=(rand()-.5)*.09;
 t=Math.max(0,Math.min(beat*8-.001,t));return {type:p.mask[i%p.mask.length]==='K'?'kick':'snare',t,rawT:t,inputT:t,quantize:'off'};
}).sort((a,b)=>a.t-b.t);}
function pitched(slots,pitches,bpm,voice,gate=6){const step=60/bpm/4,base=voice==='bass'?36:60;return slots.map((q,i)=>{
 const midi=base+pitches[i%pitches.length],t=q*step;return {type:midi===base?'kick':'snare',t,rawT:t,inputT:t,quantize:'off',midi,register:pitches.length===1?0:(midi-base)/Math.max(...pitches),duration:Math.min(gate*step,32*step-t)};
});}
function hats(bpm){return seq(16,2).map(q=>({type:'hat',t:q*60/bpm/4,rawT:q*60/bpm/4,quantize:'off'}));}
const bundles=['balanced','long_low','short_repeat','offbeat_lead','descending','moving_bass'];
function parts(p,bpm,bundle='balanced',mode='two'){
 let bass=pitched([0,8,16,24],[0],bpm,'bass'),lead=pitched([2,10,18,26],[0,3,0,3],bpm,'lead',2);
 if(bundle==='long_low'){bass=pitched([0,8,16,24],[0],bpm,'bass',8);lead=pitched([0,8,16,24],[3,3,0,0],bpm,'lead',6);}
 if(bundle==='short_repeat'){bass=pitched(seq(8,4),[0],bpm,'bass',1);lead=pitched(seq(8,4),[0],bpm,'lead',1);}
 if(bundle==='offbeat_lead')lead=pitched([2,6,10,14,18,22,26,30],[0,3],bpm,'lead',2);
 if(bundle==='descending'){bass=pitched([0,8,16,28],[0],bpm,'bass',6);lead=pitched([0,8,16,24],[3,3,0,0],bpm,'lead',5);}
 if(bundle==='moving_bass'){bass=pitched([0,8,16,24],[0,7],bpm,'bass',6);lead=pitched([2,10,18,26],[0],bpm,'lead',3);}
 if(mode!=='two'){const pitches={four:[0,3,7,10],seven:[0,2,3,5,7,8,10],nine:[0,2,3,5,7,8,10,12,14]}[mode];lead=pitched(seq(8,4),pitches,bpm,'lead',2);}
 return {drums:drums(p,bpm),bass:S.monoNotes(bass),lead:S.monoNotes(lead)};
}
function packet(enemy,intent,pr,state={hp:100,shield:0,enemyHp:enemy.hp}){
 return {enemy:{...clone(enemy),intentId:intent.id,intent:clone(intent)},bpm:enemy.bpm,duration:480/enemy.bpm,conditions:{hp:state.hp,shield:state.shield,enemyHp:state.enemyHp},hats:hats(enemy.bpm),tracks:Object.entries(pr).map(([voice,notes])=>({voice,notes:clone(notes),...(voice==='drums'?{}:{synth:{version:1,patch:S.patch({},voice),events:[]}})}))};
}
function summary(v){return {damage:v.result.total,effectiveDamage:v.damage,shield:v.shield,received:v.received.damage,remainingShield:v.received.shield,element:v.analysis.element,quality:v.analysis.performanceQuality.multiplier,groove:Object.fromEntries(['tight','laidBack','swing','drunk','unstable','pocket'].map(k=>[k,v.groove[k]])),structure:v.analysis.structure,tactics:v.analysis.tactics,synergies:v.ensemble.selected.map(s=>({id:s.id,score:s.score})),bassShield:v.bass.shield,prepared:v.bass.prepared??0,lead:{...Object.fromEntries(['attack','expose','accuracy','element','shieldEfficiency','weaken','pierce'].map(k=>[k,v.lead[k]??0])),pitchEffects:v.lead.pitch?.effects}};}
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const matrix=[],validation=[],partRows=[],modeRows=[],synergyRows=[];
 for(let index=0;index<roster.length;index++){
  const enemy=roster[index];
  for(const id of intents){
   game.reset(index,100,1,id);const intent=game.state().intent;
   for(const p of patterns){
    const pr=parts(p,enemy.bpm),pk=packet(enemy,intent,pr),v=Review.evaluate(pk);
    const action=C.enemyAction({...enemy,attackCap:Math.round(enemy.attack*1.6)},Math.max(0,enemy.hp-v.result.total),intent,v.analysis.tactics);
    matrix.push({enemy:enemy.kind,intent:id,pattern:p.id,family:p.family,count:pr.drums.length,stress:!!p.stress,...summary(v),action});
    if(['alternate_4','sync_2','late_0','complex_1','drunk_1','duplicates'].includes(p.id)){
     game.reset(index,100,1,id);const actual=await game.cycle(pr,pk.hats);
     assert.equal(actual.damage,v.result.total,enemy.kind+'/'+id+'/'+p.id+' outgoing');
     assert.equal(actual.shieldAtAttack,v.shield,enemy.kind+'/'+id+'/'+p.id+' shield');
     assert.equal(100-actual.after.hp,v.received.damage,enemy.kind+'/'+id+'/'+p.id+' received');
     if(actual.after.enemyHp>0&&id==='heal')assert.equal(actual.after.enemyHp,action.hp);
     if(actual.after.enemyHp>0&&id==='guard')assert.equal(actual.after.enemy.guard,action.guard);
     if(actual.after.enemyHp>0&&id==='buff')assert.equal(actual.after.enemy.attack,action.attack);
     validation.push({enemy:enemy.kind,intent:id,pattern:p.id,matched:true});
    }
   }
   for(const p of patterns.filter(p=>['alternate_4','sync_2','late_0','complex_1'].includes(p.id))){
    const base=parts(p,enemy.bpm);
    for(const variant of ['all','no_drums','no_bass','no_lead','no_both','bass_dense','bass_duplicate','lead_dense','lead_duplicate','bass_single_hold','bass_high','bass_timed']){
     const pr=clone(base);
     if(variant.startsWith('no_')){if(variant==='no_both'){pr.bass=[];pr.lead=[];}else pr[variant.slice(3)]=[];}
     if(variant==='bass_dense')pr.bass=pitched(seq(32),[0],enemy.bpm,'bass',1);
     if(variant==='lead_dense')pr.lead=pitched(seq(32),[0,3],enemy.bpm,'lead',1);
     if(variant==='bass_duplicate')pr.bass=S.monoNotes(pr.bass.flatMap(n=>Array(32).fill(n)));
     if(variant==='lead_duplicate')pr.lead=S.monoNotes(pr.lead.flatMap(n=>Array(32).fill(n)));
     if(variant==='bass_single_hold')pr.bass=pitched([0],[0],enemy.bpm,'bass',32);
     if(variant==='bass_high')pr.bass=pitched([0,8,16,24],[7],enemy.bpm,'bass',6).map(n=>({...n,register:1}));
     if(variant==='bass_timed'){const q=(C.attackBeat(intent)-1)*4;pr.bass=pitched([...new Set([0,8,16,q])].sort((a,b)=>a-b),[0],enemy.bpm,'bass',6);}
     const pk=packet(enemy,intent,pr),v=Review.evaluate(pk);partRows.push({enemy:enemy.kind,intent:id,pattern:p.id,variant,...summary(v)});
    }
   }
   const p=patterns.find(p=>p.id==='complex_1');
   for(const mode of ['two','four','seven','nine']){
    const pr=parts(p,enemy.bpm),palette={two:[0,3],four:[0,3,7,10],seven:[0,2,3,5,7,8,10],nine:[0,2,3,5,7,8,10,12,14]}[mode];
    pr.lead=pitched([0,4,8,12,16,20,24,28,30],palette,enemy.bpm,'lead',2);
    modeRows.push({enemy:enemy.kind,intent:id,mode,noteCount:9,...summary(Review.evaluate(packet(enemy,intent,pr)))});
   }
   for(const p of patterns.filter(p=>['kick_0','sync_2','complex_1','alternate_4'].includes(p.id))){
    const pr=parts(p,enemy.bpm),pk=packet(enemy,intent,pr),full=Review.evaluate(pk),off=Review.evaluate(pk,{omit:'ensemble'});
    synergyRows.push({enemy:enemy.kind,intent:id,pattern:p.id,selected:full.ensemble.selected,damage:full.result.total,without:off.result.total,shield:full.shield,shieldWithout:off.shield,received:full.received.damage,receivedWithout:off.received.damage});
   }
  }
  console.log('matrix '+enemy.kind+' complete');
 }
 const replay=matrix.filter((_,i)=>i%53===0).map(row=>{const index=roster.findIndex(e=>e.kind===row.enemy);game.reset(index,100,1,row.intent);const p=patterns.find(p=>p.id===row.pattern);const again=summary(Review.evaluate(packet(roster[index],game.state().intent,parts(p,roster[index].bpm))));assert.equal(again.damage,row.damage);assert.equal(again.received,row.received);return true;});
 fs.writeFileSync(path.join(out,'single-turn.json'),JSON.stringify({matrix,validation,partRows,modeRows,synergyRows,repeatedChecks:replay.length}));
 console.log('single-turn results saved; starting actual game multi-turn battles');
 const representativeIds=['alternate_4','alternate_2','alternate_1','kick_0','snare_0','sync_2','offbeat_1','late_0','late_2','rest_0','dense_S','laid_40','swing_'+(1/6),'drunk_1','complex_1','complex_2','dialogue'];
 const pool=patterns.filter(p=>representativeIds.includes(p.id));
 const traces=[],runs=[];
 async function battle(index,startHp,p,bundle='balanced',policy='fixed',poison=true,reset=true){
  if(reset)game.reset(index,startHp);const trace=[];
  for(let round=1;round<=12;round++){
   const state=game.state();if(state.hp<=0||state.enemyHp<=0)break;
   let chosen=p,chosenBundle=bundle;
   if(policy!=='fixed'){
    let best=-Infinity;
    for(const candidate of pool)for(const candidateBundle of bundles){
     const pk=packet(state.enemy,state.intent,parts(candidate,state.enemy.bpm,candidateBundle),state),v=Review.evaluate(pk);
     const action=C.enemyAction({...state.enemy,attackCap:Math.round(roster[index].attack*1.6)},Math.max(0,state.enemyHp-v.result.total),state.intent,v.analysis.tactics);
     const isKill=v.result.total>=state.enemyHp;
     // Selection heuristic only; all resulting battle outcomes are computed by game.js.
     const score=policy==='damage_greedy'?v.damage-v.received.damage*.001:
      v.damage-(action.healed??0)-v.received.damage*(state.enemy.hp/100)-(isKill?0:Math.max(0,(action.guard??state.enemy.guard??0)-(state.enemy.guard??0))*state.enemy.hp+Math.max(0,(action.attack??state.enemy.attack)-state.enemy.attack));
     if(score>best){best=score;chosen=candidate;chosenBundle=candidateBundle;}
    }
   }
   const step=await game.cycle(parts(chosen,state.enemy.bpm,chosenBundle),hats(state.enemy.bpm),poison);
   trace.push({round,pattern:chosen.id,bundle:chosenBundle,intent:state.intent.id,damage:step.damage,effectiveDamage:state.enemyHp-Math.max(0,state.enemyHp-step.damage),received:state.hp-step.after.hp,poison:step.poison,shield:step.shieldAtAttack,hp:step.after.hp,enemyHp:step.after.enemyHp,guard:step.after.enemy.guard??0,attack:step.after.enemy.attack,tactics:step.analysis?.tactics});
  }
  const end=game.state(),won=end.enemyHp<=0&&end.hp>0;
  const row={enemy:roster[index].kind,startHp,pattern:p?.id??policy,family:p?.family??policy,bundle,policy,poison,won,rounds:trace.length,remainingHp:end.hp,remainingEnemyHp:end.enemyHp,totalReceived:startHp-end.hp,totalPoison:trace.reduce((s,r)=>s+r.poison,0),totalDamage:trace.reduce((s,r)=>s+r.damage,0),capped:end.hp>0&&end.enemyHp>0};
  return {row,trace};
 }
 for(let index=0;index<roster.length;index++){
  for(const startHp of [100,70]){
   for(const p of patterns.filter(p=>!p.stress&&p.id!=='silence')){const result=await battle(index,startHp,p);runs.push(result.row);traces.push({...result.row,trace:result.trace});}
   for(const p of pool)for(const bundle of bundles.filter(b=>b!=='balanced')){const result=await battle(index,startHp,p,bundle);runs.push(result.row);traces.push({...result.row,trace:result.trace});}
   for(const policy of ['damage_greedy','tactical_greedy']){const result=await battle(index,startHp,null,'adaptive',policy);runs.push(result.row);traces.push({...result.row,trace:result.trace});}
  }
  console.log('battles '+roster[index].kind+' complete');
 }
 const repeated=[];
 for(let index=0;index<roster.length;index++){
  const originalRun=traces.find(r=>r.enemy===roster[index].kind&&r.startHp===100&&r.pattern==='sync_2'&&r.bundle==='balanced');
  const repeat=await battle(index,100,patterns.find(p=>p.id==='sync_2'));assert.deepEqual(repeat.trace,originalRun.trace);repeated.push(roster[index].kind);
 }
 // Poison sensitivity: compare the same weak/slow strategies with input poison disabled, labelled as a counterfactual.
 const poisonSensitivity=[];
 for(const index of [0,3])for(const id of ['alternate_1','random_3','snare_2']){const result=await battle(index,100,patterns.find(p=>p.id===id),'balanced','fixed',false);poisonSensitivity.push(result.row);}
 const campaigns=[];
 const campaignStrategies=[...patterns.filter(p=>!p.stress&&p.id!=='silence').map(p=>({p,policy:'fixed'})),{policy:'damage_greedy'},{policy:'tactical_greedy'},{policy:'enemy_specific'}];
 for(const startHp of [100,70])for(const strategy of campaignStrategies){
  game.reset(0,startHp);const encounters=[];
  for(let index=0;index<roster.length;index++){
   let p=strategy.p,bundle='balanced',policy=strategy.policy;
   if(policy==='enemy_specific'){
    const best=runs.filter(r=>r.enemy===roster[index].kind&&r.startHp===100&&r.policy==='fixed'&&r.won).sort((a,b)=>a.rounds-b.rounds||b.remainingHp-a.remainingHp)[0];
    p=patterns.find(p=>p.id===best.pattern);bundle=best.bundle;policy='fixed';
   }
   const value=await battle(index,game.state().hp,p,bundle,policy,true,false);encounters.push(value);
   if(!value.row.won)break;
   if(index<roster.length-1)game.next();
  }
  campaigns.push({pattern:strategy.p?.id??strategy.policy,policy:strategy.policy,startHp,won:encounters.length===8&&encounters.every(v=>v.row.won),cleared:encounters.filter(v=>v.row.won).length,remainingHp:game.state().hp,totalRounds:encounters.reduce((s,v)=>s+v.row.rounds,0),encounters});
 }
 const metadata={branch:cp.execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),date:'2026-10-20',productionHashes:original,roster,patterns,bundles,representativeIds,maxRounds:12,mainModes:'two',defaultPatches:true,quantize:'off',manualHat:true,simulation:'Real game.js finish()/enemyCounter()/enemyIntent()/hazard callbacks; audio and DOM only stubbed',policy:'tactical score: effective damage - healing - incoming HP damage*(enemy maxHP/100) - armor increase*enemy maxHP - attack increase; full knowledge, one-step heuristic, no optimality claim'};
 assert.deepEqual(production(),original,'production source changed during audit');
 fs.writeFileSync(path.join(out,'battles.json'),JSON.stringify({runs,traces,repeated,poisonSensitivity,campaigns}));
 metadata.auditScripts=Object.fromEntries(['audit-balance.cjs','audit-game.cjs','audit-probes.cjs','audit-verify.cjs'].map(name=>[name,hash(fs.readFileSync(path.join(__dirname,name)))]));
 fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify(metadata,null,2));
 console.log(JSON.stringify({patterns:patterns.length,matrix:matrix.length,engineMatches:validation.length,partRows:partRows.length,modes:modeRows.length,synergies:synergyRows.length,runs:runs.length,campaigns:campaigns.length,reproducibleBattles:repeated.length,productionUnchanged:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={patterns,drums,parts,packet};
