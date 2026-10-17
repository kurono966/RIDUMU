const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){},setAttribute(){},querySelector(){return {}},style:{},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);},querySelector(selector){return this.getElementById(selector)},addEventListener(){}};
 const sandbox=vm.createContext({document,performance:{now:()=>0},setTimeout(){},clearTimeout(){},Rhythm:require('./rhythm.js'),Groove:require('./groove.js'),CombatFeedback:require('./feedback.js'),showHitFeedback(){},clearHitFeedback(){},renderDiscoveries(){}});
 vm.runInContext(fs.readFileSync('game.js','utf8').split("const canvas=$('scope')")[0],sandbox);
 vm.runInContext("enemies[0].bpm=120;lastDuration=4;lastBpm=120;ctx={currentTime:10,state:'running'};recordAudioAt=10;state='countin';sound=()=>{};clickSound=()=>{};flash=()=>{};",sandbox);
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
test('attack replay plays recorded hats at raw times without automatic hats',async()=>{
 const g=game();
 g.run("ctx.currentTime=0;ctx.resume=()=>Promise.resolve();last=[{type:'kick',t:0,rawT:-.5}];lastMix=[{voice:'drums',notes:last},{voice:'hat',notes:[{type:'hat',t:.03,rawT:.03},{type:'hat',t:.61,rawT:.61}]}];let hats=[];sound=(type,at,voice)=>{if(voice==='hat')hats.push({type,at})};let playbackTick;setInterval=fn=>{playbackTick=fn;return 1};clearInterval=()=>{};");
 const playback=g.run("playbackAttack({damages:[10]},'#fff')");
 await Promise.resolve();
 g.run('for(let i=0;i<=9;i++){ctx.currentTime=i*.5;playbackTick()}ctx.currentTime=4.57;playbackTick()');
 await playback;
 assert.equal(g.run('hats.length'),2);
 assert.equal(g.run("hats.every(h=>h.type==='hat')"),true);
 assert.ok(g.run('hats[0].at')>=.59);
 assert.ok(g.run('hats[1].at')>=1.17);
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
test('Hat phase accepts only Hat, then replays its raw offsets in the parts phase',async()=>{
 const g=game();
 g.run("enemies[0].bpm=82;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let phaseTick;setInterval=fn=>{phaseTick=fn;return 1};clearInterval=()=>{};let played=[];sound=(type,at,voice)=>played.push({type,at,voice});");
 await g.run("countIn('hat')");
 assert.equal(g.run('phase'),'hat');
 const hatStart=g.run('recordAudioAt'),duration=g.run('timing().duration');
 g.run("ctx.currentTime=recordAudioAt+.03;phaseTick();input('hat');input('kick');ctx.currentTime=recordAudioAt+.4;input('hat')");
 assert.equal(g.run('hatNotes.length'),2);assert.equal(g.run('notes.length'),0);
 assert.ok(Math.abs(g.run('hatNotes[0].rawT')-.03)<1e-9);
 g.run('ctx.currentTime=recordAudioAt+timing().duration;phaseTick()');await Promise.resolve();
 assert.equal(g.run('phase'),'parts');assert.equal(g.run('state'),'countin');
 assert.equal(g.run('hatReady'),true);
 assert.ok(g.run('recordAudioAt')>hatStart+duration);
 g.run("played=[];ctx.currentTime=recordAudioAt-.05;phaseTick()");
 assert.equal(g.run('played.length'),1);assert.equal(g.run('played[0].voice'),'hat');
 assert.ok(Math.abs(g.run('played[0].at-recordAudioAt')-.03)<1e-9);
 g.run("ctx.currentTime=recordAudioAt+.01;phaseTick();input('hat');input('snare')");
 assert.equal(g.run('hatNotes.length'),2);assert.equal(g.run('notes.length'),1);
});
test('hat space input works without restarting the turn or invoking the browser default',()=>{
 const g=game();
 g.run("phase='hat';state='recording';ctx.currentTime=10.03;let starts=0,prevented=0;$('start').click=()=>starts++;handleKeyDown({code:'Space',target:{tagName:'BUTTON',id:'hat'},preventDefault(){prevented++}})");
 assert.equal(g.run('hatNotes.length'),1);assert.equal(g.run('starts'),0);assert.equal(g.run('prevented'),1);
});
test('Hat is recorded once, reused for bass and lead, then reset at the next drum turn',async()=>{
 const g=game();
 g.run("let launched=[];countIn=async next=>{launched.push(next)};turn=1;");
 await g.run('startTurn()');
 assert.equal(g.run('hatReady'),false);
 g.run("hatNotes=[{type:'hat',t:.035,rawT:.035}];hatReady=true;turn=2");
 await g.run('startTurn()');
 assert.equal(g.run('hatNotes[0].rawT'),.035);assert.equal(g.run('needsHat()'),false);
 g.run('turn=3');await g.run('startTurn()');
 assert.equal(g.run('hatNotes.length'),1);assert.equal(g.run('hatReady'),true);
 g.run('turn=4');await g.run('startTurn()');
 assert.equal(g.run('hatNotes.length'),0);assert.equal(g.run('hatReady'),false);
 assert.equal(g.run("launched.join(',')"),'hat,parts,parts,hat');
});
test('a silent completed Hat phase is reused rather than requesting another Hat recording',async()=>{
 const g=game();
 g.run("hatReady=true;hatNotes=[];turn=2;let launched;countIn=async next=>{launched=next}");
 await g.run('startTurn()');assert.equal(g.run('launched'),'parts');
});
