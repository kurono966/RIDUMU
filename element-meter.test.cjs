const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./element-meter.js'),R=require('./rhythm.js'),G=require('./groove.js'),Q=require('./quantize.js');
test('meter reuses combat scores for every prefix, quantization and groove',()=>{
 for(const mode of Q.modes){
  const drums=Array.from({length:32},(_,i)=>({type:i%3?'snare':'kick',t:i*.125+(i%2?.035:0),rawT:i*.125+(i%2?.035:0),quantize:mode.id}));
  const hats=Array.from({length:16},(_,i)=>({type:'hat',t:i*.25+(i%2?.03:0)}));
  for(let n=1;n<=drums.length;n++){
   const input=drums.slice(0,n),copy=JSON.stringify({input,hats});
   const expected=G.enrich(R.analyze(Q.render(input,120,4),4,120),G.analyzeRelations(input,hats,120,4));
   for(const final of [false,true]){const actual=M.analyze(input,hats,120,4,final);assert.deepEqual(actual.scores,expected.scores);assert.equal(actual.actualElement,expected.element);assert.equal(actual.dominant,final||n>=3?expected.element:null);assert(Math.abs(Object.values(actual.shares).reduce((s,v)=>s+v,0)-1)<1e-12);}
   assert.equal(JSON.stringify({input,hats}),copy);
  }
 }
});
test('silence never claims an element or shows phantom scores',()=>{
 for(const final of [false,true]){const a=M.analyze([],[],120,4,final);assert.equal(a.dominant,null);assert.equal(a.actualElement,null);assert(Object.values(a.scores).every(v=>v===0));assert(Object.values(a.shares).every(v=>v===0));}
});
test('meter handles old notes, anticipated inputs and simultaneous notes deterministically',()=>{
 const notes=[{type:'kick',t:-.04},{type:'snare',t:0},{type:'kick',t:0},{type:'snare',t:3.8}];
 const a=M.analyze(notes,[],120,4,true);assert.equal(a.count,4);assert.deepEqual(a,M.analyze(notes,[],120,4,true));assert.equal(a.actualElement,a.analysis.element);
});
test('close competition is a display threshold only',()=>{
 for(let mask=0;mask<256;mask++){
  const notes=Array.from({length:8},(_,i)=>({type:mask&(1<<i)?'kick':'snare',t:i*.5}));
  const a=M.analyze(notes,[],120,4,true),s=a.scores;
  assert.equal(a.close,(s[a.rank[0]]-s[a.rank[1]])/s[a.rank[0]]<=.08);
  assert.equal(a.dominant,a.analysis.element);
 }
});
test('a groove-driven leader change uses the final engine element and explains the groove',()=>{
 const hats=Array.from({length:16},(_,i)=>({type:'hat',t:i*.25+(i%2?1/12:0)}));
 const notes=Array.from({length:8},(_,i)=>({type:i<3?'kick':'snare',t:i*.25+(i%2?1/12:0)}));
 const a=M.analyze(notes,hats,120,4,true);assert.equal(a.baseElement,'lightning');assert.equal(a.actualElement,'wind');assert.equal(a.dominant,'wind');assert.equal(a.reason,'跳ねるノリ → 風');
});
