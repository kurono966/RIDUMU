const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){},style:{},classList:{add(){},remove(){}}});return elements.get(id);},addEventListener(){}};
 const sandbox=vm.createContext({document,setTimeout(){},clearTimeout(){},Rhythm:require('./rhythm.js')});
 vm.runInContext(fs.readFileSync('game.js','utf8').split("const canvas=$('scope')")[0],sandbox);
 vm.runInContext("ctx={currentTime:10,state:'running'};recordAudioAt=10;state='countin';sound=()=>{};clickSound=()=>{};flash=()=>{};",sandbox);
 return {run:code=>vm.runInContext(code,sandbox)};
}
test('anticipated downbeat is recorded during count-in with raw timing preserved',()=>{
 const g=game();g.run("ctx.currentTime=9.9;input('kick')");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run('notes[0].t'),0);
 assert.ok(Math.abs(g.run('notes[0].rawT')+.1)<1e-9);
});
test('first beat is accepted even before the UI timer changes state',()=>{
 const g=game();g.run("ctx.currentTime=10.001;input('snare')");
 assert.equal(g.run('notes.length'),1);assert.ok(g.run('notes[0].t')>0);
});
test('final count-in rimshot and the rest of that beat are accepted',()=>{
 const g=game();g.run("ctx.currentTime=9.5;input('kick');ctx.currentTime=9.7;input('snare')");
 assert.equal(g.run('notes.length'),2);
 assert.equal(g.run('notes[0].rawT'),-.5);
});
test('earlier count-in beats and inputs at the end are excluded',()=>{
 const g=game();g.run("ctx.currentTime=9.499;input('kick');ctx.currentTime=14;input('snare')");
 assert.equal(g.run('notes.length'),0);
});
test('rapid opening notes are all retained and preserve their spacing',()=>{
 const g=game();g.run("[9.89,9.96,10.03,10.1].forEach(t=>{ctx.currentTime=t;input('snare')})");
 assert.equal(g.run('notes.length'),4);
 assert.ok(Math.abs(g.run('notes[1].rawT-notes[0].rawT')-.07)<1e-9);
});
test('enemy HP changes on replayed note times and playback waits for the full phrase',async()=>{
 const g=game();
 g.run("ctx.currentTime=0;ctx.resume=()=>Promise.resolve();last=[{type:'kick',t:.5},{type:'snare',t:2}];lastInstrument='bass';turn=3;let playedVoices=[];sound=(type,at,voice)=>playedVoices.push(voice);let playbackTick;setInterval=fn=>{playbackTick=fn;return 1};clearInterval=()=>{};state='attack';");
 const playback=g.run("playbackAttack({damages:[10,20]},'#fff')");
 await Promise.resolve();
 assert.equal(g.run('enemyHp'),150);
 g.run('ctx.currentTime=.55;playbackTick()');assert.equal(g.run('enemyHp'),150);
 g.run('ctx.currentTime=.57;playbackTick()');assert.equal(g.run('enemyHp'),140);
 g.run('ctx.currentTime=2.07;playbackTick()');assert.equal(g.run('enemyHp'),120);
 let ended=false;playback.then(()=>ended=true);await Promise.resolve();assert.equal(ended,false);
 g.run('ctx.currentTime=4.07;playbackTick()');await playback;
 assert.equal(g.run('attackPlayhead'),null);
 assert.equal(g.run("playedVoices.join(',')"),'bass,bass');
});
test('instruments cycle every three turns',()=>{
 const g=game();
 assert.equal(g.run("[1,2,3,4,5,6].map(t=>instrumentForTurn(t).id).join(',')"),'drums,bass,lead,drums,bass,lead');
});
test('parts accumulate, update the same instrument, and snapshot the last mix',()=>{
 const g=game();
 g.run("saveTrack('drums',[{type:'kick',t:0}]);saveTrack('bass',[{type:'snare',t:1}]);saveTrack('lead',[{type:'kick',t:2}]);saveTrack('drums',[{type:'snare',t:3}]);");
 assert.equal(g.run('tracks.size'),3);
 assert.equal(g.run("tracks.get('drums')[0].t"),3);
 g.run("tracks.get('drums')[0].t=2.5");
 assert.equal(g.run("lastMix.find(t=>t.voice==='drums').notes[0].t"),3);
 g.run('turn=2');
 assert.equal(g.run("backingTimeline().events.map(e=>e.voice).sort().join(',')"),'drums,lead');
 g.run("saveTrack('bass',[])");assert.equal(g.run("tracks.has('bass')"),false);
});
test('returning to drums resets every saved part before accompaniment starts',()=>{
 const g=game();
 g.run("saveTrack('drums',[{type:'kick',t:0}]);saveTrack('bass',[{type:'snare',t:1}]);saveTrack('lead',[{type:'kick',t:2}]);turn=3;prepareTracksForTurn();");
 assert.equal(g.run('tracks.size'),3);
 g.run('turn=4;prepareTracksForTurn()');
 assert.equal(g.run('tracks.size'),0);assert.equal(g.run('backingTimeline().events.length'),0);
 g.run("saveTrack('drums',[{type:'kick',t:0}])");
 assert.equal(g.run("lastMix.map(track=>track.voice).join(',')"),'drums');
});
test('attack replay adds eight quarter-note hats aligned after the pickup',async()=>{
 const g=game();
 g.run("ctx.currentTime=0;ctx.resume=()=>Promise.resolve();last=[{type:'kick',t:0,rawT:-.5}];let hats=[];clickSound=(type,at)=>hats.push({type,at});let playbackTick;setInterval=fn=>{playbackTick=fn;return 1};clearInterval=()=>{};");
 const playback=g.run("playbackAttack({damages:[10]},'#fff')");
 await Promise.resolve();
 g.run('for(let i=0;i<=9;i++){ctx.currentTime=i*.5;playbackTick()}ctx.currentTime=4.57;playbackTick()');
 await playback;
 assert.equal(g.run('hats.length'),8);
 assert.equal(g.run("hats.every(h=>h.type==='hat')"),true);
 assert.ok(Math.abs(g.run('hats[0].at')-.56)<1e-9);
 assert.ok(Math.abs(g.run('hats[7].at')-4.06)<1e-9);
 assert.equal(g.run('enemyHp'),140);
});
test('space starts only when ready and blocks scrolling and repeat',()=>{
 const g=game();
 g.run("let starts=0,prevented=0;$('start').disabled=false;$('start').click=()=>starts++;let space={code:'Space',preventDefault(){prevented++}};state='ready';handleKeyDown(space);state='recording';handleKeyDown(space);state='countin';handleKeyDown(space);state='attack';handleKeyDown(space);state='cleared';handleKeyDown(space);state='over';handleKeyDown(space);handleKeyDown({...space,repeat:true});");
 assert.equal(g.run('starts'),3);assert.equal(g.run('prevented'),6);
});
test('bass and lead synthesize separate pitches at the requested audio time',()=>{
 const g=game();
 g.run(`let frequencies=[],starts=[];
 const param={setValueAtTime(){},exponentialRampToValueAtTime(){}};
 ctx={destination:{},createGain(){return {gain:{...param},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{},connect(){}}},createOscillator(){return {frequency:{setValueAtTime(f,t){frequencies.push(f)}},connect(){},start(t){starts.push(t)},stop(){}}}};
 pitchedSound('kick',5,'bass');pitchedSound('snare',6,'lead');`);
 assert.equal(g.run('frequencies[0]'),65.406);assert.equal(g.run('frequencies[2]'),311.127);
 assert.equal(g.run("starts.join(',')"),'5,5,6,6');
});
