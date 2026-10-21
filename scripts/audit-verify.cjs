const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,(process.env.RIDUMU_AUDIT_DIR||'balance-after'),n+'.json'),'utf8'));
const meta=read('metadata'),single=read('single-turn'),battle=read('battles'),probes=read('probes');
for(const [name,expected] of Object.entries(meta.productionHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),expected,'Production changed since audit: '+name);
for(const [name,expected] of Object.entries(meta.auditScripts))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex'),expected,'Audit script changed since run: '+name);
assert.equal(single.matrix.length,meta.patterns.length*meta.roster.length*6);
assert.ok(single.validation.every(r=>r.matched));assert.equal(battle.repeated.length,8);
for(const row of [...single.matrix,...single.partRows,...single.modeRows]){
 assert.ok(Number.isInteger(row.damage)&&row.damage>=0);assert.ok(Number.isFinite(row.shield)&&row.shield>=0&&row.shield<=90);
 assert.ok(Number.isFinite(row.received)&&row.received>=0&&row.received<=100);
}
for(const variant of ['bass_duplicate','lead_duplicate'])for(const row of single.partRows.filter(r=>r.variant===variant)){
 const base=single.partRows.find(r=>r.enemy===row.enemy&&r.intent===row.intent&&r.pattern===row.pattern&&r.variant==='all');
 assert.equal(row.damage,base.damage);assert.equal(row.shield,base.shield);assert.equal(row.received,base.received);
}
for(const row of single.modeRows)assert.equal(row.noteCount,9);
for(const run of battle.runs){assert.ok(run.remainingHp>=0&&run.remainingHp<=run.startHp);assert.ok(run.rounds<=12);}
for(const row of probes.tone){const base=probes.tone.find(r=>r.enemy===row.enemy&&r.intent===row.intent&&r.pattern===row.pattern&&r.profile==='default');assert.equal(row.element,base.element);assert.deepEqual(row.tactics,base.tactics);}
assert.ok(probes.matches.every(r=>r.matched));
assert.equal(probes.repeatedRows,single.matrix.length);
console.log(JSON.stringify({productionUnchanged:true,matrix:single.matrix.length,realEngineMatches:single.validation.length+probes.matches.length,partRows:single.partRows.length,runs:battle.runs.length,campaigns:battle.campaigns.length,repeatedSingleChecks:probes.repeatedRows,repeatedBattles:battle.repeated.length,duplicatesInvariant:true,timbreTacticsInvariant:true}));
