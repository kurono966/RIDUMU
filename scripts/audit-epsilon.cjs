const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {create}=require('./audit-game.cjs'),{patterns,parts,packet}=require('./audit-balance.cjs');
const Review=require('../performance-review');
async function main(){
 const game=create(),enemy=game.roster()[2],rows=[];
 for(const epsilon of [-1e-10,0,1e-10]){
  game.reset(2,100,1,'guard');const pr=parts(patterns.find(p=>p.id==='alternate_1'),120);
  pr.drums=pr.drums.map(n=>{const t=Math.max(0,n.t+epsilon);return {...n,t,rawT:t,inputT:t};});
  const pk=packet(enemy,game.state().intent,pr),v=Review.evaluate(pk),actual=await game.cycle(pr,pk.hats);
  assert.equal(v.result.total,actual.damage);assert.equal(v.shield,actual.shieldAtAttack);assert.equal(v.received.damage,100-actual.after.hp);
  rows.push({epsilon,element:v.analysis.element,damage:v.result.total,quality:v.analysis.performanceQuality.multiplier,laidBack:v.groove.laidBack,drunk:v.groove.drunk,snarePushed:v.groove.snarePushed,actualMatch:true});
 }
 assert.equal(rows[1].element,'wind');assert.equal(rows[2].element,'wind');assert.equal(rows[0].damage,rows[2].damage);assert.ok(rows.every(r=>r.drunk===0&&r.laidBack===0));
 fs.writeFileSync(path.join(__dirname,'..',process.env.RIDUMU_AUDIT_DIR||'balance-after','epsilon.json'),JSON.stringify(rows,null,2));
 console.table(rows);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
