const {test}=require('node:test');const assert=require('node:assert/strict');
const R=require('./rhythm.js'),F=require('./feedback.js');
const notes=(times,type='kick')=>times.map(t=>({t,type}));
const report=(input,kind='stone',rng=()=>0)=>{const a=R.analyze(input),r=R.resolve(a,{kind},rng);return {a,r,f:F.explain(a,r,{kind})};};
test('breakdown exactly sums to damage for every enemy with fixed hit efficiency',()=>{
 let seed=931;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(const kind of ['stone','fly','machine'])for(let i=0;i<120;i++){
  const a=R.analyze(Array.from({length:Math.floor(random()*40)},()=>({t:random()*4,type:random()<.5?'kick':'snare'})));
  const r=R.resolve(a,{kind},random),b=r.breakdown;
  assert.equal(b.base+b.form+b.affinity,r.total);
  assert.equal(b.weight+b.charged+b.chain,b.form);
 }
});
test('fixed efficiency formula reproduces all resolved damages',()=>{
 for(const kind of ['stone','fly','machine']){
  const a=R.analyze(notes([.1,.23,.4,.7,1.1,1.9,3.1,3.7])),actual=R.resolve(a,{kind});
  const expected=Array.from({length:a.hits},()=>Math.max(1,Math.round(a.power/Math.pow(a.hits,.85)*actual.affinity*actual.efficiency)));
  assert.deepEqual(actual.damages,expected);
 }
});

test('heavy kick feedback gives matchup priority and marks the actual charged notes',()=>{
 const {a,f}=report(notes([1.3,3.2]));
 assert.ok(f.factors.length<=3);assert.equal(f.factors[0].priority,1);
 assert.ok(f.factors.some(x=>x.id==='charge'));assert.ok(f.labels.includes('弱点！'));assert.ok(f.labels.length<=2);
 const charge=F.marks(a,f.factors).find(m=>m.source==='charge');
 assert.ok(charge);assert.ok(charge.cells.every(n=>n.type==='kick'));assert.equal(charge.cells.length,2);
});
test('late acceleration causes fire and marks only the second half',()=>{
 const {a,f}=report(notes([.1,2.1,2.25,2.4,2.55,2.7,2.85,3,3.15,3.3,3.45,3.6,3.75]));
 assert.equal(a.element,'fire');assert.equal(f.elementCause.source,'acceleration');
 assert.ok(f.factors.some(f=>f.id==='element'));
 const mark=F.marks(a,f.factors).find(m=>m.source==='acceleration');assert.ok(mark.cells.every(n=>n.q>=16));
});
test('machine lightning explains its rhythm and yields offbeat markers',()=>{
 const {a,f}=report([.125,.38,1.12,1.36,2.87,3.13].map((t,i)=>({t,type:i%2?'snare':'kick'})),'machine');
 assert.equal(a.element,'lightning');assert.equal(f.factors[0].id,'weak-lightning');
 assert.ok(f.factors.some(x=>x.source==='offbeat'));assert.ok(F.marks(a,f.factors).some(m=>m.source==='offbeat'));
});
test('discovery is earned on hit, idempotent, and separate for each enemy',()=>{
 const {f}=report(notes([1.3,3.2]));
 const first=F.discover({},'stone',f);assert.ok(first.fresh.includes('heavy'));assert.ok(first.fresh.includes('earth'));
 assert.equal(F.discover(first.known,'stone',f).fresh.length,0);
 assert.equal(first.known.machine,undefined);
 const missed=report([],'stone').f;
 assert.equal(F.discover({},'stone',missed).fresh.length,0);
 assert.equal(missed.weaknesses.length,0);
});
test('gentle hints explain light hits on rock and reduced heavy attack efficiency on flyers',()=>{
 assert.match(report(notes(Array.from({length:28},(_,i)=>i*.14),'snare')).f.hint,/岩の体に通りにくい/);
 assert.match(report(notes([1.3,3.2]),'fly').f.hint,/飛行敵への攻撃効率が下がる/);
 const {f,r}=report([]);assert.equal(f.factors.length,0);assert.equal(r.total,0);assert.match(f.hint,/一音/);
});
