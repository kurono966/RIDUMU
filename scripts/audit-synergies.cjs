const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {create}=require('./audit-game.cjs'),{parts,packet}=require('./audit-balance.cjs'),Review=require('../performance-review');
const game=create(),roster=game.roster(),seq=(n,step=1)=>Array.from({length:n},(_,i)=>i*step);
const setups={
 grooveLock:{slots:seq(8,4),mask:'K',bass:[0,8,16,24],lead:[2,10,18,26]},
 response:{slots:seq(8,4),mask:'S',bass:[0,8,16,24],lead:[2,6,10,14,18,22,26,30]},
 interlock:{slots:[0,8,16,24],mask:'K',bass:[2,10,18,26],lead:[6,14,22,30]},
 unison:{slots:seq(8,4),mask:'KS',bass:[0,6,16,22],lead:[0,10,16,26]},
 callResponse:{slots:[0,2,6,16,18,22],mask:'KSS',bass:[0,16],lead:[8,10,14,24,26,30]}
};
function melody(slots,bpm,voice){const step=60/bpm/4;return slots.map((q,i)=>({type:voice==='bass'||i%2===0?'kick':'snare',midi:(voice==='bass'?36:60)+(voice==='bass'||i%2===0?0:3),register:0,t:q*step,rawT:q*step,inputT:q*step,quantize:'off',duration:Math.min(voice==='bass'?6*step:2*step,(32-q)*step)}));}
async function main(){
 const rows=[];
 for(let index=0;index<8;index++)for(const intentId of ['guard','heavy','pierce','heal','buff','special'])for(const [id,setup]of Object.entries(setups)){
  game.reset(index,100,1,intentId);const enemy=roster[index],intent=game.state().intent,pr=parts(setup,enemy.bpm);
  pr.bass=melody(setup.bass,enemy.bpm,'bass');pr.lead=melody(setup.lead,enemy.bpm,'lead');
  const pk=packet(enemy,intent,pr),full=Review.evaluate(pk),without=Review.evaluate(pk,{omitSynergy:id});
  assert.ok(full.ensemble.selected.some(s=>s.id===id),'Setup does not trigger '+id);
  const actual=await game.cycle(pr,pk.hats);assert.equal(actual.damage,full.result.total);assert.equal(actual.shieldAtAttack,full.shield);assert.equal(100-actual.after.hp,full.received.damage);
  rows.push({enemy:enemy.kind,intent:intentId,id,selected:full.ensemble.selected,damage:full.result.total,without:without.result.total,shield:full.shield,shieldWithout:without.shield,received:full.received.damage,receivedWithout:without.received.damage,matched:true});
 }
 fs.writeFileSync(path.join(__dirname,'..',process.env.RIDUMU_AUDIT_DIR||'balance-after','synergy-probes.json'),JSON.stringify({setups,rows}));
 console.log('Actual-game synergy matches: '+rows.length);
 for(const id of Object.keys(setups)){const a=rows.filter(r=>r.id===id);console.log(id,'meanDamageGain',a.reduce((s,r)=>s+r.damage-r.without,0)/a.length,'meanShieldGain',a.reduce((s,r)=>s+r.shield-r.shieldWithout,0)/a.length,'maxHPSaved',Math.max(...a.map(r=>r.receivedWithout-r.received)));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
