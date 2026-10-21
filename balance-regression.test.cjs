const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('./groove'),R=require('./rhythm'),C=require('./performance-combat');
const {create}=require('./scripts/audit-game.cjs');
const {patterns,parts,packet}=require('./scripts/audit-balance.cjs');
const Review=require('./performance-review');
const hats=bpm=>Array.from({length:16},(_,i)=>({t:i*30/bpm}));

test('straight subdivisions never turn into expressive timing at Hat midpoints',()=>{
 for(const bpm of [72,82,100,108,120,126,138,150,180])for(const type of ['kick','snare']){
  const results=[];
  for(const epsilon of [-1e-10,0,1e-10]){
   const notes=Array.from({length:32},(_,q)=>({type,t:Math.max(0,q*15/bpm+epsilon)}));
   const g=G.analyzeRelations(notes,hats(bpm),bpm,480/bpm),a=G.enrich(R.analyze(notes,480/bpm,bpm),g);
   assert.ok(g.laidBack<1e-8);assert.ok(g.drunk<1e-8);assert.ok(g.swing<1e-8);
   assert.ok(Number.isFinite(a.instability));
   results.push([a.element,R.resolve(a,{kind:'machine'}).total]);
  }
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
 }
});

test('swung eighths remain intentional while subdivision aliasing is removed',()=>{
 for(const bpm of [82,120,150]){
  const notes=Array.from({length:16},(_,i)=>({type:i%2?'snare':'kick',t:i*30/bpm+(i%2?10/bpm:0)}));
  const g=G.analyzeRelations(notes,hats(bpm),bpm,480/bpm);
  assert.ok(g.swing>.8);assert.ok(g.unstable<.01);
 }
});

test('correlated groove descriptions share one enemy affinity reward and explanation',()=>{
 const g={tight:.8,drunk:.6,laidBack:.9,pocket:.8,pushed:.4,snarePushed:.5,swing:1};
 for(const kind of ['stone','fly','machine','plant','ghost','crystal','furnace','conductor']){
  const a={...R.analyze([{type:'kick',t:0}]),groove:g};
  const bonuses=G.affinity(g,kind),result=R.resolve(a,{kind});
  assert.equal(bonuses.length,1);
  const steps=result.calculation.affinitySteps.filter(s=>s.label.startsWith('敵とのグルーヴ相性'));
  assert.equal(steps.length,1);assert.equal(steps[0].multiplier,bonuses[0].multiplier);
 }
});

test('equal-length Bass phrases gain defense by preparing at the announced strike',()=>{
 const notes=q=>[0,8,16,q].map(s=>({type:'kick',midi:36,t:s*.125,duration:.25}));
 for(const [id,q] of [['heavy',28],['pierce',20],['special',24]]){
  const prepared=C.bass(notes(q),[],120,4,[],{id});
  const away=C.bass(notes(30),[],120,4,[],{id});
  assert.ok(prepared.prepared>away.prepared);assert.ok(prepared.shield>away.shield);
 }
});

test('a small motif change has a meaningful niche against the conductor',()=>{
 const analyze=slots=>R.analyze(slots.map((q,i)=>({type:i%2?'snare':'kick',t:q*.125})));
 const repeat=analyze([0,4,8,12,16,20,24,28]),changed=analyze([0,4,8,12,16,20,24,27,30]);
 assert.ok(R.resolve(changed,{kind:'conductor'}).total>R.resolve(repeat,{kind:'conductor'}).total);
 const kick=R.analyze(Array.from({length:8},(_,i)=>({type:'kick',t:i*.5})));
 assert.ok(R.resolve(kick,{kind:'stone'}).total>R.resolve(changed,{kind:'stone'}).total);
});

test('controlled acceleration earns consistency without overtaking a steady beat',()=>{
 const analyze=slots=>R.analyze(slots.map(q=>({type:'kick',t:q*.125})));
 const accelerating=analyze([16,20,24,26,28,29,30,31]);
 const steady=analyze([0,4,8,12,16,20,24,28]);
 const disorder=analyze([0,1,8,9,20,21,22,31]);
 assert.ok(accelerating.performanceQuality.multiplier>1);
 assert.ok(accelerating.performanceQuality.multiplier<steady.performanceQuality.multiplier);
 assert.ok(disorder.performanceQuality.multiplier<accelerating.performanceQuality.multiplier);
});

test('new opening actions and bounded defense agree with real game execution',async()=>{
 const game=create(),roster=game.roster();
 for(const index of [1,2,4]){
  game.reset(index);const enemy=roster[index],intent=game.state().intent;
  assert.notEqual(intent.id,'guard');
  const p=patterns.find(p=>p.id==='swing_0.16666666666666666'),pr=parts(p,enemy.bpm);
  const pk=packet(enemy,intent,pr),expected=Review.evaluate(pk),actual=await game.cycle(pr,pk.hats);
  assert.equal(actual.damage,expected.result.total);assert.equal(actual.shieldAtAttack,expected.shield);
  assert.ok(actual.after.enemyHp>0,enemy.kind+' must get an opening action against the former swing winner');
  assert.ok(actual.after.shield<=90);
 }
});
