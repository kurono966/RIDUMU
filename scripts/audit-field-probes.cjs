const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {create}=require('./audit-game.cjs'),{patterns,parts}=require('./audit-balance.cjs');
const root=path.resolve(__dirname,'..'),game=create(),roster=game.roster();
const seq=(n,step=1)=>Array.from({length:n},(_,i)=>i*step);
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function support(seed,voice,bpm){const random=rng(seed),base=voice==='bass'?36:60,high=voice==='bass'?7:3,step=60/bpm/4;return seq(4).map(()=>{const q=random()*31,key=random()<.5?0:1,t=q*step;return {type:key?'snare':'kick',midi:base+key*high,register:key,t,rawT:t,inputT:t,quantize:'off',duration:Math.min((voice==='bass'?6:2)*step,32*step-t)};}).sort((a,b)=>a.t-b.t);}
async function battle(index,hp,p,variant,seed=1){
 game.reset(index,hp);const trace=[];
 for(let round=1;round<=12;round++){
  const before=game.state();if(before.hp<=0||before.enemyHp<=0)break;
  const pr=parts(p,before.enemy.bpm);
  if(variant==='random_all'){pr.bass=support(seed*137,'bass',before.enemy.bpm);pr.lead=support(seed*491,'lead',before.enemy.bpm);}
  if(variant==='no_bass'||variant==='no_both')pr.bass=[];
  if(variant==='no_lead'||variant==='no_both')pr.lead=[];
  const hats=seq(16,2).map(q=>({type:'hat',t:q*60/before.enemy.bpm/4,rawT:q*60/before.enemy.bpm/4}));
  const value=await game.cycle(pr,hats);trace.push({round,intent:before.intent.id,hp:value.after.hp,enemyHp:value.after.enemyHp,damage:value.damage,shield:value.shieldAtAttack,poison:value.poison});
 }
 const end=game.state();return {enemy:roster[index].kind,startHp:hp,pattern:p.id,variant,seed,won:end.hp>0&&end.enemyHp<=0,rounds:trace.length,hp:end.hp,enemyHp:end.enemyHp,capped:end.hp>0&&end.enemyHp>0,trace};
}
async function main(){
 const randomAll=[],roleBattles=[];
 for(let index=0;index<8;index++){
  for(const hp of [100,70])for(let seed=1;seed<=9;seed++)randomAll.push(await battle(index,hp,patterns.find(p=>p.id==='random_'+seed),'random_all',seed));
  for(const id of ['kick_0','sync_2','late_2','complex_1'])for(const variant of ['all','no_bass','no_lead','no_both'])roleBattles.push(await battle(index,100,patterns.find(p=>p.id===id),variant));
 }
 const hash=crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
 fs.writeFileSync(path.join(root,(process.env.RIDUMU_AUDIT_DIR||'balance-after'),'field-probes.json'),JSON.stringify({randomAll,roleBattles,scriptHash:hash}));
 console.log(JSON.stringify({randomAll:randomAll.length,randomAllWins:randomAll.filter(r=>r.won).length,roleBattles:roleBattles.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
