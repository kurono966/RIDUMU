const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){},setAttribute(){},querySelector(){return {}},style:{},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);},querySelector(selector){return this.getElementById(selector)},addEventListener(){}};
 const sandbox=vm.createContext({document,performance:{now:()=>0},setTimeout(){},clearTimeout(){},Rhythm:require('./rhythm.js'),Quantize:require('./quantize.js'),Groove:require('./groove.js'),CombatFeedback:require('./feedback.js'),showHitFeedback(){},clearHitFeedback(){},renderDiscoveries(){}});
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
 const param={setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};
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
test('live input is immediate and keeps every raw press regardless of quantize mode',()=>{
 const g=game();
 g.run("phaseQuantizeMode='just';let played=[];sound=(type,at,voice)=>played.push({type,at,voice});ctx.currentTime=10.01;input('kick');ctx.currentTime=10.06;input('kick')");
 assert.equal(g.run('notes.length'),2);assert.equal(g.run('played.length'),2);
 assert.ok(Math.abs(g.run('notes[0].inputT')-.01)<1e-9);
 assert.ok(Math.abs(g.run('notes[0].rawT')-.01)<1e-9);
 assert.equal(g.run('notes[0].inputTimes.length'),1);
 assert.equal(g.run('played[0].at'),undefined);assert.equal(g.run('played[1].at'),undefined);
});
test('closing notes stay raw in storage and receive correction only in the playback copy',()=>{
 const g=game();g.run("phaseQuantizeMode='laidBack';ctx.currentTime=13.99;input('snare')");
 assert.equal(g.run('notes.length'),1);assert.ok(g.run('notes[0].rawT')<4);
 assert.ok(g.run('Quantize.render(notes,120,4)[0].rawT')>4);
});
test('live recording ends on the phrase boundary without waiting for quantization',async()=>{
 const g=game();
 g.run("quantizeMode='laidBack';ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let phaseTick;setInterval=fn=>{phaseTick=fn;return 1};clearInterval=()=>{};let finished=false;finish=()=>{finished=true;state='attack'};");
 await g.run("countIn('parts')");
 g.run("ctx.currentTime=recordAudioAt+3.99;phaseTick();input('snare');ctx.currentTime=recordAudioAt+4;phaseTick()");
 assert.equal(g.run('finished'),true);
});
test('the next phase hears quantized Hat while the saved Hat keeps its early input',async()=>{
 const g=game();
 g.run("hatNotes=[{type:'hat',t:.48,rawT:.48,inputT:.48,quantize:'just'}];ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let phaseTick;setInterval=fn=>{phaseTick=fn;return 1};clearInterval=()=>{};let played=[];sound=(type,at,voice)=>played.push({type,at,voice});");
 await g.run("countIn('parts')");
 g.run('ctx.currentTime=recordAudioAt+.41;phaseTick()');
 assert.equal(g.run('played.length'),1);
 assert.ok(Math.abs(g.run('played[0].at-recordAudioAt')-.5)<1e-9);
 assert.equal(g.run('hatNotes[0].rawT'),.48);
 assert.equal(g.run('phaseHatPlayback[0].rawT'),.5);
});
test('attack audio and damage follow the corrected copy while the live recording remains raw',async()=>{
 const g=game();
 g.run("phaseQuantizeMode='just';ctx.currentTime=10.48;input('kick');last=Quantize.render(notes,120,4);saveTrack('drums',notes);ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let scheduled=[];sound=(type,at)=>scheduled.push(at);let replayTick;setInterval=fn=>{replayTick=fn;return 1};clearInterval=()=>{};");
 const playback=g.run("playbackAttack({damages:[20]},'#fff')");await Promise.resolve();
 g.run('ctx.currentTime=.46;replayTick()');
 assert.ok(Math.abs(g.run('scheduled[0]')-.56)<1e-9);assert.equal(g.run('enemyHp'),150);
 g.run('ctx.currentTime=.57;replayTick()');assert.equal(g.run('enemyHp'),130);
 assert.ok(Math.abs(g.run("tracks.get('drums')[0].rawT")-.48)<1e-9);
 g.run('ctx.currentTime=4.07;replayTick()');await playback;
});
test('mode changes apply to the next recording and do not retime existing Hat',()=>{
 const g=game();
 g.run("hatNotes=[{type:'hat',t:.031,rawT:.031}];state='ready';$('quantizeMode').value='laidBack';$('quantizeMode').onchange()");
 assert.equal(g.run('quantizeMode'),'laidBack');assert.equal(g.run('hatNotes[0].rawT'),.031);
 g.run("state='recording';$('quantizeMode').value='drunk';$('quantizeMode').onchange()");
 assert.equal(g.run('quantizeMode'),'laidBack');assert.equal(g.run("$('quantizeMode').value"),'laidBack');
});

test('bass holds record raw gate length and release on key up',()=>{
 const g=game();g.run("turn=2;state='recording';let gates=[];sound=(...args)=>{gates.push(args[4]);return {release(){gates.push('released')}}};input('kick','key:KeyA');ctx.currentTime=10.75;releaseInput('key:KeyA')");
 assert.equal(g.run('notes[0].duration'),.75);assert.equal(g.run('gates[0]'),Infinity);assert.equal(g.run('heldInputs.size'),0);assert.equal(g.run('gates[1]'),'released');
});
test('lead supports independent holds and caps gates at phrase end',()=>{
 const g=game();g.run("turn=3;input('kick','pointer:1');ctx.currentTime=10.5;input('snare','pointer:2');ctx.currentTime=11;releaseInput('pointer:1');ctx.currentTime=15;releaseAllInputs()");
 assert.equal(g.run('notes[0].duration'),1);assert.equal(g.run('notes[1].duration'),3.5);assert.equal(g.run('heldInputs.size'),0);
});
test('drums remain one shots and repeat keydown cannot retrigger a held lead',()=>{
 const g=game();g.run("input('kick','key:KeyA');releaseInput('key:KeyA');turn=3;input('snare','key:KeyL');input('snare','key:KeyL')");
 assert.equal(g.run('notes.length'),2);assert.equal(g.run('notes[0].duration'),undefined);
});
test('quantized playback preserves gate length without changing raw recording',()=>{
 const g=game();g.run("turn=2;phaseQuantizeMode='just';ctx.currentTime=10.08;input('kick','key:KeyA');ctx.currentTime=10.78;releaseInput('key:KeyA');saveTrack('bass',notes)");
 assert.ok(Math.abs(g.run('lastMix[0].notes[0].duration')-.7)<1e-9);assert.equal(g.run('lastMix[0].notes[0].rawT'),.125);assert.ok(Math.abs(g.run('notes[0].rawT')-.08)<1e-9);
});

test('sustained synth keeps oscillators running until release',()=>{
 const g=game();g.run(`let stops=[];const param={setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={currentTime:10,destination:{},createGain(){return {gain:{...param},connect(){},disconnect(){}}},createBiquadFilter(){return {frequency:param,Q:{},connect(){},disconnect(){}}},createOscillator(){return {frequency:param,connect(){},start(){},stop(t){stops.push(t)}}}};
 let voice=pitchedSound('kick',10,'bass',1,Infinity);`);
 assert.equal(g.run('stops.length'),0);g.run('voice.release(11.5)');assert.equal(g.run('stops.length'),2);assert.ok(Math.abs(g.run('stops[0]')-11.64)<1e-9);
});
test('mix playback waits for sustained note tails without adding strikes',()=>{
 const timeline=require('./rhythm.js').mixTimeline([{voice:'lead',notes:[{type:'kick',rawT:3.5,t:3.5,duration:1}]}],'lead',[23],4);
 assert.ok(Math.abs(timeline.duration-4.64)<1e-9);assert.deepEqual(timeline.events[0].damages,[23]);assert.equal(timeline.events.length,1);
});


test('seven-note keyboard records distinct pitches and sustained gates',()=>{
 const g=game();g.run("turn=2;noteMode='seven';let prevented=0;for(const code of melodyKeys){handleKeyDown({code,target:{},preventDefault(){prevented++}});ctx.currentTime+=.1;releaseInput('key:'+code)}");
 assert.equal(g.run('notes.map(n=>n.pitch).join()'),'0,1,2,3,4,5,6');assert.equal(g.run('prevented'),7);
 assert.ok(g.run('notes.every(n=>Math.abs(n.duration-.1)<1e-8)'));
});
test('seven-note selection leaves drums and Hat controls intact',()=>{
 const g=game();g.run("noteMode='seven';handleKeyDown({code:'KeyS',target:{},preventDefault(){}});input('kick','key:KeyA');phase='hat';input('hat')");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run('notes[0].pitch'),undefined);assert.equal(g.run('hatNotes.length'),1);
});
test('seven pitches survive quantization and mix snapshots including simultaneous notes',()=>{
 const g=game();g.run("turn=3;noteMode='seven';phaseQuantizeMode='just';input('kick','key:KeyA',0);input('kick','key:KeyS',1);ctx.currentTime=10.5;releaseAllInputs();saveTrack('lead',notes)");
 assert.equal(g.run('lastMix[0].notes.length'),2);assert.equal(g.run('lastMix[0].notes.map(n=>n.pitch).join()'),'0,1');assert.equal(g.run('lastMix[0].notes[1].duration'),.5);
});
test('seven-note synth uses the selected minor-scale pitch at each octave',()=>{
 const g=game();g.run(`let frequencies=[];const param={setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={currentTime:0,destination:{},createGain(){return {gain:{...param},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{},connect(){}}},createOscillator(){return {frequency:{setValueAtTime(f){frequencies.push(f)}},connect(){},start(){},stop(){}}}};
 pitchedSound('kick',0,'bass',1,.5,6);pitchedSound('kick',0,'lead',1,.5,6);`);
 assert.ok(Math.abs(g.run('frequencies[0]')-65.406*2**(10/12))<1e-8);
 assert.ok(Math.abs(g.run('frequencies[2]')-261.626*2**(10/12))<1e-8);
});
test('note mode cannot change during a recording',()=>{
 const g=game();g.run("noteMode='seven';state='recording';$('noteMode').value='two';$('noteMode').onchange()");
 assert.equal(g.run('noteMode'),'seven');assert.equal(g.run("$('noteMode').value"),'seven');
});

test('H plays the sixth melody note in parts and Hat in the Hat phase',()=>{
 const g=game();g.run("turn=2;noteMode='seven';handleKeyDown({code:'KeyH',target:{},preventDefault(){}});ctx.currentTime=10.25;releaseInput('key:KeyH');phase='hat';handleKeyDown({code:'KeyH',target:{},preventDefault(){}})");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run('notes[0].pitch'),5);assert.equal(g.run('notes[0].duration'),.25);assert.equal(g.run('hatNotes.length'),1);
});

test('four-note mode maps ASKL to C Eb G Bb with independent sustained gates',()=>{
 const g=game();g.run("turn=2;noteMode='four';for(const code of ['KeyA','KeyS','KeyK','KeyL']){handleKeyDown({code,target:{},preventDefault(){}});ctx.currentTime+=.2;releaseInput('key:'+code)};saveTrack('bass',notes)");
 assert.equal(g.run('notes.map(n=>n.pitch).join()'),'0,2,4,6');
 assert.equal(g.run('notes.map(n=>n.type).join()'),'kick,kick,snare,snare');
 assert.ok(g.run('lastMix[0].notes.every(n=>Math.abs(n.duration-.2)<1e-8)'));
});
test('four-note mode exposes four pads, ignores extra melody keys, and preserves Hat H',()=>{
 const g=game();g.run("turn=3;noteMode='four';syncNoteMode();handleKeyDown({code:'KeyD',target:{},preventDefault(){}});phase='hat';handleKeyDown({code:'KeyH',target:{},preventDefault(){}})");
 assert.equal(g.run("[0,1,2,3,4,5,6].filter(i=>!$('note'+i).hidden).join()"),'0,2,4,6');
 assert.equal(g.run('notes.length'),0);assert.equal(g.run('hatNotes.length'),1);
});

test('pitch settings are independent by voice and mode and are locked while recording',()=>{
 const g=game();g.run("state='ready';turn=2;setKeyPitch('bass','four',1,42)");
 assert.equal(g.run("pitchesFor('bass','four')[1]"),42);assert.equal(g.run("pitchesFor('lead','four')[1]"),63);assert.equal(g.run("pitchesFor('bass','seven')[2]"),39);
 g.run("state='recording'");assert.equal(g.run("setKeyPitch('bass','four',1,50)"),false);assert.equal(g.run("pitchesFor('bass','four')[1]"),42);
 assert.equal(g.run("setKeyPitch('bass','four',1,NaN)"),false);
});
test('custom pitches sound live, are recorded and remain immutable after settings change',()=>{
 const g=game();g.run("state='ready';turn=2;noteMode='four';setKeyPitch('bass','four',1,46);state='recording';let played=[];sound=(...args)=>{played.push(args)};input('kick','key:KeyS',2);ctx.currentTime=10.4;releaseAllInputs();saveTrack('bass',notes);state='ready';setKeyPitch('bass','four',1,51)");
 assert.equal(g.run('played[0][6]'),46);assert.equal(g.run('notes[0].midi'),46);assert.equal(g.run('lastMix[0].notes[0].midi'),46);assert.equal(g.run("pitchesFor('bass','four')[1]"),51);
});
test('two-note mode also records custom absolute pitches',()=>{
 const g=game();g.run("state='ready';turn=3;setKeyPitch('lead','two',1,74);state='recording';input('snare','key:KeyL')");assert.equal(g.run('notes[0].midi'),74);assert.equal(g.run('notes[0].pitch'),undefined);
});
test('absolute MIDI pitch controls replay synthesis independently of slot and settings',()=>{
 const g=game();g.run(`let frequencies=[];const param={setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={currentTime:0,destination:{},createGain(){return {gain:{...param},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{},connect(){}}},createOscillator(){return {frequency:{setValueAtTime(f){frequencies.push(f)}},connect(){},start(){},stop(){}}}};
 pitchedSound('kick',0,'lead',1,.3,0,69);`);assert.equal(g.run('frequencies[0]'),440);
});
