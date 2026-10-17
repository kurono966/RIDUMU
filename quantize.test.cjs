const {test}=require('node:test'),assert=require('node:assert/strict');
const Q=require('./quantize.js'),G=require('./groove.js'),R=require('./rhythm.js');
const note=(type,inputT,bpm,mode)=>{const {performedT}=Q.apply(type,inputT,bpm,mode);return {type,t:Math.max(0,performedT),rawT:performedT,inputT};};
test('raw mode preserves timestamps exactly',()=>{
 for(const t of [-.5,-.018,0,.035,1.492,3.999])assert.equal(Q.apply('hat',t,120,'off').performedT,t);
});
test('all playback modes stay close to the original note at every enemy BPM',()=>{
 for(const bpm of [82,120,150])for(const mode of Q.modes)for(const type of ['hat','kick','snare'])for(let i=-40;i<800;i++){
  const t=i*.0093,out=Q.apply(type,t,bpm,mode.id);
  assert.ok(Math.abs(out.performedT-t)<60/bpm/4*1.25+.001);
 }
});
test('just produces exact sixteenth positions',()=>{
 const q=Q.apply('kick',.132,120,'just');assert.equal(q.performedT,.125);
 assert.equal(Q.apply('kick',.125,120,'just').performedT,.125);
 assert.equal(Q.apply('hat',-.01,120,'just').performedT,0);
});
test('both early and late notes move to the same nearest beat',()=>{
 assert.equal(Q.apply('kick',.48,120,'just').performedT,.5);
 assert.equal(Q.apply('kick',.52,120,'just').performedT,.5);
 assert.equal(Q.apply('snare',.48,120,'laidBack').performedT,.535);
 assert.equal(Q.apply('snare',.52,120,'laidBack').performedT,.535);
});
test('rendering merges playback notes without mutating the complete raw recording',()=>{
 const raw=[{type:'kick',t:.49,rawT:.49,quantize:'just'},{type:'kick',t:.51,rawT:.51,quantize:'just'}];
 const before=JSON.stringify(raw),rendered=Q.render(raw,120,4);
 assert.equal(JSON.stringify(raw),before);assert.equal(raw.length,2);assert.equal(rendered.length,1);
 assert.equal(rendered[0].rawT,.5);assert.deepEqual(rendered[0].inputTimes,[.49,.51]);
 assert.deepEqual(Q.render(rendered,120,4),rendered);
});
test('laid-back keeps Hat aligned and places Snare behind it',()=>{
 const hats=Array.from({length:16},(_,i)=>note('hat',i*.25-.01,120,'laidBack'));
 const parts=Array.from({length:8},(_,i)=>note(i%2?'snare':'kick',i*.5-.01,120,'laidBack'));
 assert.ok(Math.abs(parts[1].rawT-hats[2].rawT-.035)<1e-9);
 const g=G.analyzeRelations(parts,hats,120,4);
 assert.ok(Math.abs(g.snareMean)<1e-9);assert.ok(Math.abs(g.kickMean)<1e-9);
 assert.ok(g.laidBack<.01);assert.ok(g.unstable<.01);
});
test('drunk repeats the same shifted pattern every bar instead of randomizing each note',()=>{
 const a=Q.apply('hat',.2,120,'drunk').performedT;
 const b=Q.apply('hat',2.2,120,'drunk').performedT;
 assert.ok(Math.abs(b-a-2)<1e-9);
 const hats=Array.from({length:16},(_,i)=>note('hat',i*.25-.05,120,'drunk'));
 const playbackHats=hats.map(({inputT,...n})=>n),g=G.analyzeHat(playbackHats,120,4);
 assert.ok(G.analyzeHat(hats,120,4).drunk<.01);
 assert.ok(g.drunk>.5);assert.ok(g.barReproducibility>.95);assert.ok(g.unstable<.01);
 const parts=Array.from({length:8},(_,i)=>note(i%2?'snare':'kick',i*.5-.04,120,'drunk'));
 assert.match(G.describe(G.analyzeRelations(parts.map(({inputT,...n})=>n),playbackHats,120,4)),/ドランク/);
});
test('swing produces repeating long-short eighths',()=>{
 const hats=Array.from({length:16},(_,i)=>note('hat',i*.25-.02,120,'swing'));
 const g=G.analyzeHat(hats.map(({inputT,...n})=>n),120,4);assert.ok(g.swing>.8);assert.ok(G.analyzeHat(hats,120,4).swing<.01);
});
test('a quantized closing note is not lost from replay or damage timing',()=>{
 const end=Q.apply('snare',3.99,120,'laidBack').performedT;
 assert.ok(end>4);
 const n={type:'snare',t:4-1e-7,rawT:end,inputT:3.99};
 const timeline=R.attackTimeline([n],[20],4);
 assert.ok(timeline.duration>timeline.events[0].at);
 assert.equal(timeline.events[0].damages[0],20);
 assert.equal(R.analyze([n]).count,1);
});

test('leading Snare playback preset scales with tempo and leaves Kick and Hat raw',()=>{
 const offsets=[];
 for(const bpm of [82,120,150]){
  const beat=60/bpm,grid=beat*2;
  const out=Q.apply('snare',grid+.01,bpm,'snarePushed');
  assert.ok(out.performedT<grid);offsets.push(grid-out.performedT);
  for(const type of ['kick','hat'])for(const t of [-.03,.013,.49,3.99])assert.equal(Q.apply(type,t,bpm,'snarePushed').performedT,t);
 }
 assert.ok(offsets[0]>offsets[1]&&offsets[1]>offsets[2]);
 assert.ok(offsets.every(n=>n>=.02-1e-9&&n<=.04+1e-9));
 const raw=[{type:'snare',t:0,rawT:0,inputT:0,quantize:'snarePushed',duration:.4,midi:60}];
 const before=JSON.stringify(raw),rendered=Q.render(raw,120,4);assert.equal(JSON.stringify(raw),before);assert.ok(rendered[0].rawT<0);assert.equal(rendered[0].duration,.4);
 const timeline=R.attackTimeline(rendered,[12],4);assert.equal(timeline.events[0].at,0);assert.deepEqual(timeline.events[0].damages,[12]);
});
