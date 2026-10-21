const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('./groove.js'),R=require('./rhythm.js'),F=require('./feedback.js');
function hats(bpm,offset=()=>0){const step=60/bpm/2;return Array.from({length:16},(_,i)=>({type:'hat',t:i*step+offset(i),rawT:i*step+offset(i)}));}
function parts(bpm,kick=-.018,snare=.035){const beat=60/bpm;return Array.from({length:8},(_,i)=>{const rawT=i*beat+(i%2?snare:kick);return {type:i%2?'snare':'kick',t:Math.max(0,rawT),rawT};});}
test('enemy tempo determines two-bar duration and the analysis grid',()=>{
 for(const bpm of [82,120,150]){
  const duration=480/bpm,a=R.analyze(parts(bpm,0,0),duration,bpm);
  assert.equal(a.slots,32);assert.equal(a.step,60/bpm/4);
  assert.equal(a.grid[1].q,4);assert.equal(a.grid[7].q,28);
  const replay=R.mixTimeline([{voice:'hat',notes:hats(bpm)}],null,[],duration);
  assert.equal(replay.duration,duration);
  assert.equal(replay.events[1].time,30/bpm);
 }
});
test('stable Snare delay and leading Kick create pocket without random instability',()=>{
 for(const bpm of [82,120,150]){
  const g=G.analyzeRelations(parts(bpm),hats(bpm),bpm,480/bpm);
  assert.ok(Math.abs(g.kickMean+.018)<1e-9);assert.ok(Math.abs(g.snareMean-.035)<1e-9);
  assert.ok(g.laidBack>.7);assert.ok(g.pushed>.45);assert.ok(g.pocket>.6);
  assert.ok(g.unstable<.01);assert.ok(g.drunk<.01);
  assert.match(G.describe(g),/18ms前.*35ms後ろ/);
 }
});
test('a consistent offset is intentional, not poor timing',()=>{
 const a=G.analyzeHat(hats(120,()=>.03),120,4);
 assert.ok(a.laidBack>.6);assert.ok(a.barReproducibility>.95);
 assert.ok(a.unstable<.01);assert.ok(a.tight<.3);
});
test('repeating unequal offsets distinguish drunk from random timing',()=>{
 const intentional=G.analyzeHat(hats(120,i=>[0,.025,-.02,.035][i%4]),120,4);
 const random=G.analyzeHat(hats(120,i=>[.043,-.032,.01,-.041,.034,.004,-.028,.046,-.01,.031,-.046,.015,.041,-.005,-.033,.008][i]),120,4);
 assert.ok(intentional.drunk>.8);assert.ok(intentional.unstable<.05);
 assert.ok(random.unstable>.5);assert.ok(random.drunk<.2);
 assert.ok(intentional.barReproducibility>random.barReproducibility);
});
test('swing is recognized from alternating long and short eighths',()=>{
 for(const bpm of [82,120,150]){
  const a=G.analyzeHat(hats(bpm,i=>i%2?60/bpm/6:0),bpm,480/bpm);
  assert.ok(a.swing>.8);assert.ok(a.unstable<.01);
 }
});
test('tight, laid-back, and pushed grooves have different enemy affinities',()=>{
 const laid={laidBack:1,pocket:0,pushed:0,swing:0,tight:0,drunk:0};
 const pushed={...laid,laidBack:0,pushed:1},tight={...laid,laidBack:0,tight:1};
 const factor=(g,kind)=>G.affinity(g,kind).reduce((s,a)=>s*a.multiplier,1);
 assert.ok(factor(laid,'stone')>factor(laid,'fly'));
 assert.ok(factor(pushed,'fly')>factor(pushed,'stone'));
 assert.ok(factor(tight,'machine')>factor(tight,'stone'));
});
test('groove modifies combat while breakdown still sums to actual damage',()=>{
 const g=G.analyzeRelations(parts(120),hats(120),120,4);
 const a=G.enrich(R.analyze(parts(120)),g),r=R.resolve(a,{kind:'stone'},()=>0);
 assert.equal(r.breakdown.base+r.breakdown.form+r.breakdown.affinity,r.total);
 assert.ok(r.breakdown.groove>0);
 assert.equal(r.breakdown.weight+r.breakdown.charged+r.breakdown.chain+r.breakdown.groove,r.breakdown.form);
 const f=F.explain(a,r,{kind:'stone'});
 assert.ok(f.weaknesses.some(w=>w.id==='laidBack'));assert.match(f.grooveText,/ポケット/);
});
test('empty or insufficient Hat input gives no invented groove and no NaN',()=>{
 const g=G.analyzeRelations(parts(120),[],120,4);
 assert.equal(g.confidence,0);assert.equal(g.matched,0);
 for(const key of ['pocket','laidBack','pushed','swing','drunk','tight','unstable'])assert.equal(g[key],0);
 const sparse=G.analyzeHat([{t:1}],120,4);assert.equal(sparse.drunk,0);assert.equal(sparse.confidence,0);
 const duplicated=G.analyzeHat(Array.from({length:20},()=>({t:1})),120,4);assert.equal(duplicated.microTimingRepetition,0);
});
test('random offsets relative to steady Hat are not rewarded as reproducible drunk timing',()=>{
 const offsets=[.043,-.032,.01,-.041,.034,.004,-.028,.046,-.01,.031,-.046,.015,.041,-.005,-.033,.008];
 const input=hats(120).map((n,i)=>({type:i%2?'snare':'kick',t:Math.max(0,n.t+offsets[i]),rawT:n.t+offsets[i]}));
 const g=G.analyzeRelations(input,hats(120),120,4);
 assert.ok(g.unstable>.5);assert.ok(g.drunk<.25);
});

test('consistent leading Snare is independent of pushed Kick, drunk and instability at all enemy tempos',()=>{
 for(const bpm of [82,120,150]){
  const g=G.analyzeRelations(parts(bpm,0,-.03),hats(bpm),bpm,480/bpm);
  assert.ok(g.snarePushed>.5);assert.ok(g.pushed<.01);assert.ok(g.laidBack<.01);assert.ok(g.pocket<.01);assert.ok(g.drunk<.01);assert.ok(g.unstable<.01);
  assert.match(G.describe(g),/SnareがHatより平均30ms前 → 前ノリスネア/);
 }
});
test('raw input governs groove even when playback copies were quantized',()=>{
 const Q=require('./quantize.js');
 const raw=parts(120,0,-.03).map(n=>({...n,inputT:n.rawT,quantize:'just'}));
 const hat=hats(120).map(n=>({...n,inputT:n.rawT,quantize:'just'}));
 const played=Q.render(raw,120,4),g=G.analyzeRelations(played,Q.render(hat,120,4),120,4);
 assert.ok(played.filter(n=>n.type==='snare').every(n=>n.rawT===Math.round(n.rawT/.125)*.125));
 assert.ok(Math.abs(g.snareMean+.03)<1e-9);assert.ok(g.snarePushed>.5);
 const straight=parts(120,0,0).map(n=>({...n,inputT:n.rawT,quantize:'snarePushed'}));
 assert.ok(G.analyzeRelations(Q.render(straight,120,4),hat,120,4).snarePushed<.01);
});
test('random or insufficient Snare anticipation is not rewarded as a stable leading Snare',()=>{
 const offsets=[-.06,.02,-.01,.055,-.04,.03,-.055,.01];
 const random=Array.from({length:8},(_,i)=>({type:'snare',rawT:i*.5+offsets[i]}));
 const g=G.analyzeRelations(random,hats(120),120,4);
 assert.ok(g.snarePushed<.15);assert.ok(g.unstable>.4);
 assert.equal(G.analyzeRelations([{type:'snare',rawT:.47}],hats(120),120,4).snarePushed,0);
});
test('leading Snare has real matching combat affinity, feedback and note-specific cause marks',()=>{
 const notes=parts(120,0,-.03),g=G.analyzeRelations(notes,hats(120),120,4);
 const a=G.enrich(R.analyze(notes),g),enemy={kind:'fly'},result=R.resolve(a,enemy,()=>0);
 const without=R.resolve({...a,groove:{...g,snarePushed:0}},enemy,()=>0);
 assert.ok(result.affinity>without.affinity);assert.ok(a.groovePower>0);
 const report=F.explain(a,result,enemy);assert.ok(report.weaknesses.some(w=>w.id==='snarePushed'));
 assert.ok(report.factors.some(f=>/30ms前 → 前ノリスネア/.test(f.text)));
 // Wind can lead the matchup explanation; verify Snare marking independently
 // from whichever affinity or groove wins the compact report's display budget.
 const marks=F.marks(a,[{source:'groove-snarePushed'}]).find(m=>m.source==='groove-snarePushed');assert.ok(marks.cells.length);assert.ok(marks.cells.every(n=>n.type==='snare'));
 const discovered=F.discover({},'fly',report);assert.ok(discovered.fresh.includes('snarePushed'));
 const factors=G.affinity(g,'fly').reduce((p,b)=>p*b.multiplier,1);
 assert.ok(Math.abs(result.affinity/without.affinity-Math.pow(1+.2*g.snarePushed,1.65))<1e-9);
 assert.ok(Number.isFinite(factors));
});

test('new enemy elemental and groove affinities match feedback and real combat',()=>{
 const groove=G.analyzeRelations(parts(120),hats(120),120,4);
 const base=G.enrich(R.analyze(parts(120)),groove);
 for(const [kind,element,id] of [['plant','fire','fire'],['ghost','lightning','lightning'],['crystal','earth','earth']]){
  const a={...base,element,alternation:1},enemy={kind},r=R.resolve(a,enemy,()=>0),f=F.explain(a,r,enemy);
  assert.ok(r.total>0);assert.ok(f.weaknesses.some(w=>w.id===id));
  const expected=(kind==='plant'?1.5:kind==='ghost'?1.3:1.25*1.2)*G.affinity(groove,kind).reduce((s,b)=>s*b.multiplier,1);
  assert.ok(Math.abs(r.affinity-Math.max(.4,Math.min(3,Math.pow(expected,1.65))))<1e-9);
  assert.equal(r.breakdown.base+r.breakdown.form+r.breakdown.affinity,r.total);
 }
 const a={...base,element:'wind',alternation:1},enemy={kind:'crystal'},r=R.resolve(a,enemy,()=>0),f=F.explain(a,r,enemy);
 assert.ok(f.weaknesses.some(w=>w.id==='chain'));assert.ok(F.discover({},'crystal',f).fresh.includes('chain'));
});
