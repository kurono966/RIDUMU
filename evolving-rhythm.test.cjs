const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('./rhythm'),Q=require('./quantize'),F=require('./feedback'),Review=require('./performance-review');
function phrase(kicks,snares=[4,12,20,28],bpm=120,offset=()=>0){return [...kicks.map(q=>({type:'kick',q})),...snares.map(q=>({type:'snare',q}))].map((n,i)=>({type:n.type,t:n.q*15/bpm+offset(i,n),inputT:n.q*15/bpm+offset(i,n)}));}
const steady=()=>phrase([0,8,16,24]),hiphop=()=>phrase([0,8,10,16,24,26]),changed=()=>phrase([0,8,16,22,24]);
test('a steady Snare anchors changing Kicks inside a repeated bar and between bars',()=>{
 for(const bpm of [82,120,150])for(const kicks of [[0,8,10,16,24,26],[0,8,16,22,24],[0,8,16,22],[0,6,8,16,24]]){
  const a=R.analyze(phrase(kicks,undefined,bpm),480/bpm,bpm),plain=R.analyze(phrase([0,8,16,24],undefined,bpm),480/bpm,bpm);
  assert.equal(a.structure.lanes.snare.repeat,1);assert.ok(a.structure.kickVariation>.9);assert.equal(a.structure.snareVariation,0);
  assert.ok(a.performanceQuality.multiplier>=plain.performanceQuality.multiplier-1e-9,'a precise new Kick is not a failed repetition');
 }
 assert.equal(R.analyze(hiphop()).structure.variation,0,'the full bar repeats exactly');
 assert.equal(R.analyze(hiphop()).structure.anchoredVariation,1,'its two-beat halves still develop');
 const opposite=R.analyze(phrase([0,8,16,24],[4,12,20,26,28]));
 assert.equal(opposite.structure.snareVariation,1);assert.equal(opposite.structure.kickVariation,0);
});
test('controlled development is a separate benefit, while flying enemies retain straight-beat preference',()=>{
 const plain=R.analyze(steady()),developed=R.analyze(hiphop());
 const controlled=s=>({...plain,power:60,hits:3,accuracy:.9,structure:{...plain.structure,anchoredVariation:s.anchoredVariation,phrasePrecision:s.phrasePrecision}});
 for(const kind of ['stone','machine','plant','ghost','furnace','conductor']){
  const a=R.resolve(controlled(plain.structure),{kind}),b=R.resolve(controlled(developed.structure),{kind});
  assert.ok(b.total>a.total,kind);assert.ok(b.calculation.rhythmStyle.evolutionBonus>0);
 }
 assert.ok(R.resolve(plain,{kind:'fly'}).total>R.resolve(developed,{kind:'fly'}).total);
 assert.equal(R.resolve(developed,{kind:'fly'}).calculation.rhythmStyle.evolutionBonus,0);
 assert.equal(R.resolve(developed,{kind:'crystal'}).calculation.rhythmStyle.evolutionBonus,0);
});
test('flooding notes, losing the anchor and random timing cannot earn the same development bonus',()=>{
 const clean=R.analyze(changed()),flood=R.analyze(phrase([0,8,...Array.from({length:16},(_,i)=>i+16)]));
 const unanchored=R.analyze(phrase([0,8,17,23],[4,12,19,29]));
 const jitter=R.analyze(phrase([0,8,16,22,24],undefined,120,i=>[.025,-.025,.035,-.035,.015,-.02,.03,-.015,.025][i]));
 assert.equal(flood.structure.anchoredVariation,0);assert.equal(unanchored.structure.anchoredVariation,0);
 assert.ok(jitter.performanceQuality.evolving<clean.performanceQuality.evolving);
 assert.ok(jitter.performanceQuality.multiplier<clean.performanceQuality.multiplier);
 assert.deepEqual(R.structure(changed().flatMap(n=>[n,n,n])),clean.structure);
});
test('consistent intentional offsets remain precise and playback correction cannot repair changing timing',()=>{
 const shifted=phrase([0,8,16,22,24],undefined,120,(_,n)=>n.type==='snare'?.03:.015);
 assert.ok(R.analyze(shifted).performanceQuality.evolving>.99);
 const raw=phrase([0,8,16,22,24],undefined,120,i=>i===0?0:i%2?.025:-.015).map(n=>({...n,quantize:'just'}));
 assert.deepEqual(R.analyze(Q.render(raw,120,4)).performanceQuality,R.analyze(raw).performanceQuality);
});
test('feedback identifies the anchored change and complete review applies its combat calculation',()=>{
 const a=R.analyze(changed()),report=F.explain(a,R.resolve(a,{kind:'conductor'}),{kind:'conductor'});
 assert.ok(report.factors.some(f=>/Snareを軸にKickを変化/.test(f.text)));
 const p={enemy:{kind:'conductor',hp:2000,attack:88},bpm:120,duration:4,tracks:[{voice:'drums',notes:changed()}],hats:Array.from({length:16},(_,i)=>({type:'hat',t:i*.25}))};
 const value=Review.evaluate(p);assert.ok(value.result.calculation.rhythmStyle.evolutionBonus>0);
 assert.match(Review.factors(p).all.find(f=>f.id==='rhythm').cause,/Snareを軸にKick/);
});
