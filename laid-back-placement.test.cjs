const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('./groove'),R=require('./rhythm'),Q=require('./quantize'),F=require('./feedback');
const hats=bpm=>Array.from({length:16},(_,i)=>({type:'hat',t:i*30/bpm}));
function phrase(bpm,kick=()=>0,snare=()=>.035,kickSlots=[0,8,16,24]){
 return [...kickSlots.map(q=>({type:'kick',q})),...[4,12,20,28].map(q=>({type:'snare',q}))].map(n=>{const t=n.q*15/bpm+(n.type==='kick'?kick(n.q):snare(n.q));return {type:n.type,t,inputT:t,rawT:t};});
}
test('Snare-only, shared and later-Kick placement are all intentional laid-back options',()=>{
 for(const bpm of [82,120,150])for(const [variant,kick] of [['snare',()=>0],['shared',()=>.025],['selective',q=>q%16===0?0:.025]]){
  const g=G.analyzeRelations(phrase(bpm,kick),hats(bpm),bpm,480/bpm);
  assert.equal(G.classify(g),'laidBack');assert.equal(g.laidBackProfile.variant,variant);
  assert.ok(g.laidBack>.7);assert.ok(G.precision(g).score>99.9);assert.ok(g.unstable<.01);
  if(variant!=='snare')assert.match(G.describe(g),/Kick/);
 }
});
test('a Kick on beat two or a second Kick on beat three can both be delayed',()=>{
 for(const slots of [[0,4,16,20],[0,8,16,24]]){
  const g=G.analyzeRelations(phrase(120,q=>q%16===0?0:.025,undefined,slots),hats(120),120,4);
  assert.equal(g.laidBackProfile.variant,'selective');assert.ok(G.precision(g).score>99.9);
  assert.match(G.describe(g),new RegExp((slots[1]/4+1)+'拍目'));
 }
});
test('steady delayed Kick also works without a delayed Snare and random placement does not create coordination',()=>{
 const g=G.analyzeRelations(phrase(120,()=>.03,()=>0),hats(120),120,4);
 assert.equal(G.classify(g),'laidBack');assert.equal(g.laidBackProfile.variant,'kick');assert.match(G.describe(g),/Kick.*後ろ/);
 const uneven=G.analyzeRelations(phrase(120,q=>q===8?.04:q===24?-.02:0),hats(120),120,4);
 assert.equal(uneven.laidBackProfile.coordination,0);
 const sparse=G.analyzeRelations(phrase(120).filter(n=>n.inputT<2),hats(120),120,4);
 assert.equal(sparse.laidBackProfile.coordination,0);
});
test('controlled Kick and Snare placement has a bounded real benefit and correct marks',()=>{
 const single=phrase(120),together=phrase(120,q=>q%16===0?0:.025),analyze=ns=>G.enrich(R.analyze(ns),G.analyzeRelations(ns,hats(120),120,4));
 const a=analyze(single),b=analyze(together);
 assert.ok(b.groove.laidBackProfile.coordination>0);assert.ok(b.groovePower>a.groovePower);assert.ok(b.groovePower-a.groovePower<=1.5);
 const base=G.enrich(R.analyze(single),b.groove),without=G.enrich(R.analyze(single),{...b.groove,laidBackProfile:{...b.groove.laidBackProfile,coordination:0}});
 assert.ok(R.resolve(base,{kind:'stone'}).total>=R.resolve(without,{kind:'stone'}).total);
 const marks=F.marks(b,[{source:'groove-laidBack'}]).flatMap(m=>m.cells);
 assert.ok(marks.some(n=>n.type==='kick'&&n.q%16===8));assert.ok(!marks.some(n=>n.type==='kick'&&n.q%16===0));
});
test('new playback preset keeps heads and Hat anchored while raw timing remains authoritative',()=>{
 for(const bpm of [82,120,150]){
  const step=15/bpm;
  assert.equal(Q.apply('kick',0,bpm,'laidBackFlow').performedT,0);assert.equal(Q.apply('kick',16*step,bpm,'laidBackFlow').performedT,16*step);
  for(const q of [4,8,12]){assert.ok(Q.apply('kick',q*step,bpm,'laidBackFlow').performedT>q*step);assert.equal(Q.apply('hat',q*step,bpm,'laidBackFlow').performedT,q*step);}
  const raw=phrase(bpm,()=>0,()=>0).map(n=>({...n,quantize:'laidBackFlow'})),played=Q.render(raw,bpm,480/bpm),g=G.analyzeRelations(played,hats(bpm),bpm,480/bpm);
  assert.ok(g.laidBack<.01);assert.equal(g.laidBackProfile.coordination,0);
  const audible=G.analyzeRelations(played.map(({inputT,inputTimes,...n})=>n),hats(bpm),bpm,480/bpm);
  assert.equal(G.classify(audible),'laidBack');assert.equal(audible.laidBackProfile.variant,'selective');
 }
});
