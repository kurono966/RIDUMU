const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('./ensemble'),C=require('./performance-combat'),Q=require('./quantize'),Review=require('./performance-review');
const ns=(bpm,lag=()=>0,type='kick',slots=[0,4,8,12,16,20,24,28])=>slots.map((q,i)=>{const t=q*15/bpm+lag(i,q);return {type,t,rawT:t,inputT:t,midi:36,duration:.15};});
test('Bass may sit behind an already laid-back Kick, including across a global grid boundary',()=>{
 for(const bpm of [82,120,150]){
  const drums=ns(bpm,()=>.04),bass=ns(bpm,()=>.07),p=E.bassPlacement(drums,bass,bpm,480/bpm);
  assert.equal(p.style,'behind');assert.ok(Math.abs(p.delayMs-30)<1e-8);assert.ok(p.score>.99);
  const ensemble=E.analyze({drums,bass},bpm,480/bpm);
  assert.ok(ensemble.selected.some(s=>s.id==='bassLaidBack'));assert.ok(!ensemble.selected.some(s=>s.id==='grooveLock'));
  assert.ok(ensemble.bonus.attack>0);assert.ok(ensemble.bonus.shield>0);
  const b=C.bass(bass,drums,bpm,480/bpm,[]);assert.equal(b.placement.style,'behind');assert.equal(b.timing.placement.style,'behind');
 }
});
test('a controlled trailing Bass has the same synergy budget as a synchronized Bass, with no double counting',()=>{
 const drums=ns(120),aligned=E.analyze({drums,bass:drums}),late=E.analyze({drums,bass:ns(120,()=>.03)});
 assert.ok(Math.abs(late.bonus.attack-aligned.bonus.attack)<1e-9);assert.equal(late.bonus.shield,aligned.bonus.shield);
 const further=E.analyze({drums,bass:ns(120,()=>.07)});
 assert.ok(Math.abs(further.bonus.attack-late.bonus.attack)<1e-9);assert.equal(further.bonus.shield,late.bonus.shield,'a larger controlled lag is not automatically stronger');
 const off=E.analyze({drums,bass:ns(120,()=>.03)},120,4,'bassLaidBack');assert.equal(off.bonus.attack,0);assert.equal(off.bonus.shield,0);
 const spam=E.analyze({drums:drums.flatMap(n=>[n,n,n]),bass:ns(120,()=>.03).flatMap(n=>[n,n,n])});assert.deepEqual(spam.bonus,late.bonus);
});
test('keeping some anchors while delaying other Bass notes is a valid controlled pattern',()=>{
 const p=E.bassPlacement(ns(120),ns(120,(_,q)=>q%8===0?0:.03),120,4);
 assert.equal(p.style,'behind');assert.equal(p.selective,true);assert.ok(p.score>.99);
 assert.ok(Math.abs(p.delayMs-30)<1e-8);
});
test('random lag, excessive lag, sparse data and matching the metronome instead of the Kick do not invent this style',()=>{
 const drums=ns(120),random=ns(120,i=>[.01,.06,.02,.055,.06,.01,.065,.015][i]);
 assert.notEqual(E.bassPlacement(drums,random,120,4).style,'behind');
 assert.notEqual(E.bassPlacement(drums,ns(120,()=>.09),120,4).style,'behind');
 assert.notEqual(E.bassPlacement(drums.slice(0,2),ns(120,()=>.03).slice(0,2),120,4).style,'behind');
 assert.notEqual(E.bassPlacement(ns(120,()=>.04),drums,120,4).style,'behind');
 assert.notEqual(E.bassPlacement([],ns(120,()=>.03),120,4).style,'behind');
});
test('placement benefits defense without treating a clean relative lag as an erroneous grid mismatch',()=>{
 const bpm=150,drums=ns(bpm,()=>.04),bass=ns(bpm,()=>.07),duration=480/bpm;
 const result=C.bass(bass,drums,bpm,duration,[]),unrelated=C.bass(bass,[],bpm,duration,[]);
 assert.equal(result.locked,0,'the global nearest grid misses these related notes');
 assert.equal(result.strong,8,'controlled relative placement retains the strong-beat role');
 assert.equal(result.placement.style,'behind');assert.ok(result.shield>unrelated.shield);
});
test('raw placement is immutable and cannot be repaired by playback quantization',()=>{
 const drums=ns(120),bass=ns(120,()=>.09).map(n=>({...n,quantize:'just'})),snapshot=JSON.stringify(bass);
 const before=E.bassPlacement(drums,bass,120,4),after=E.bassPlacement(drums,Q.render(bass,120,4),120,4);
 assert.deepEqual(after,before);assert.notEqual(after.style,'behind');assert.equal(JSON.stringify(bass),snapshot);
});
test('review explains and measures the real benefit of a trailing Bass',()=>{
 const drums=ns(120,()=>.025),bass=ns(120,()=>.055),p={enemy:{kind:'stone',hp:2000,attack:88},bpm:120,duration:4,tracks:[{voice:'drums',notes:drums},{voice:'bass',notes:bass}],hats:ns(120,()=>0,'hat')};
 const value=Review.evaluate(p),report=Review.factors(p);
 assert.equal(value.bass.placement.style,'behind');assert.ok(report.ensembleBenefits.includes('bassLaidBack'));
 assert.ok(report.all.some(f=>f.id==='bass'&&/後ろ/.test(f.cause)));assert.ok(report.all.some(f=>f.id==='ensemble'&&/後ろ/.test(f.cause)));
 const cues=Review.live(new Map(p.tracks.map(t=>[t.voice,t.notes])),p.hats,'bass',bass.at(-1),120,4);
 assert.ok(cues.some(c=>/BassはKickより後ろ/.test(c.label)));
});
