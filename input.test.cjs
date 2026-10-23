const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const elements=new Map();
 const document={getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){},replaceChildren(){},dataset:{},setAttribute(){},querySelector(){return {}},style:{},classList:{add(){},remove(){},toggle(){}}});return elements.get(id);},querySelector(selector){return this.getElementById(selector)},addEventListener(){}};
 const sandbox=vm.createContext({URLSearchParams,document,performance:{now:()=>0},setTimeout(){},clearTimeout(){},clearInterval(){},Ensemble:require('./ensemble.js'),renderEnsemble(){},GridHazards:require('./grid-hazards.js'),BassAudio:require('./bass-audio.js'),GridEffects:require('./grid-effects.js'),PerformanceCombat:require('./performance-combat.js'),Rhythm:require('./rhythm.js'),Quantize:require('./quantize.js'),Groove:require('./groove.js'),CombatFeedback:require('./feedback.js'),showHitFeedback(){},clearHitFeedback(){},renderDiscoveries(){},activeReport:null});
 sandbox.window=sandbox;sandbox.addEventListener=()=>{};
 sandbox.PitchCombat=require('./pitch-combat.js');
 vm.runInContext(fs.readFileSync('synth.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('synth-audio.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('performance-filter.js','utf8'),sandbox);
 vm.runInContext(fs.readFileSync('game.js','utf8').split("const canvas=$('scope')")[0],sandbox);
 vm.runInContext("enemies[0].bpm=120;lastDuration=4;lastBpm=120;ctx={currentTime:10,state:'running'};recordAudioAt=10;state='countin';sound=()=>{};clickSound=()=>{};flash=()=>{};",sandbox);
 return {run:code=>vm.runInContext(code,sandbox)};
}

test('automatic damage input is restricted to debug mode and Drums ready state',()=>{
 const g=game();
 assert.equal(g.run("autoInputDamageChart('max')"),false);
 g.run("location={search:'?debug=1'};state='ready';turn=2");
 assert.equal(g.run("autoInputDamageChart('max')"),false);
 g.run("turn=1;EvaluationDebug={damageChart:()=>({parts:new Map([['drums',[]],['bass',[]],['lead',[]]]),hats:[]})};audio=()=>{};countIn=()=>{};");
 assert.equal(g.run("autoInputDamageChart('min')"),true);
 assert.equal(g.run('continuousRunning&&hatReady&&debugDamagePlan!==null'),true);
 g.run("stopContinuousInput()");assert.equal(g.run('debugDamagePlan'),null);
});

test('debug enemy jump is gated and resets encounter, recordings and hazards',()=>{
 const g=game();g.run('document.body={dataset:{}}');
 assert.equal(g.run("debugSelectEnemy('pulse')"),false);
 g.run("location={search:'?debug=1'};state='attack'");assert.equal(g.run("debugSelectEnemy('pulse')"),false);
 g.run("state='ready';hp=3;turn=8;shield=50;tracks.set('drums',[{type:'kick',t:0}]);hatReady=true;enemies[0].attack=999");
 assert.equal(g.run("debugSelectEnemy('missing')"),false);assert.equal(g.run('hp'),3);
 assert.equal(g.run("debugSelectEnemy('pulse')"),true);
 assert.equal(g.run('enemies[stage].kind'),'pulse');assert.equal(g.run('enemyHp'),390);assert.equal(g.run('hp'),100);
 assert.equal(g.run('timing().bpm'),78);assert.equal(g.run('timing().duration'),480/78);
 assert.equal(g.run('state'),'ready');assert.equal(g.run('turn'),1);assert.equal(g.run('tracks.size'),0);assert.equal(g.run('shield'),0);assert.equal(g.run('hatReady'),false);assert.equal(g.run('enemies[0].attack'),88);
 for(const kind of ['stone','fly','machine','plant','ghost','crystal','furnace','pulse','conductor'])assert.equal(g.run(`debugSelectEnemy('${kind}')`),true);
 g.run("state='recording';phase='parts';continuousRunning=true;run=20;notes=[{type:'kick',t:0}]");
 assert.equal(g.run("debugSelectEnemy('pulse')"),true);assert.equal(g.run('notes.length'),0);assert.ok(g.run('run')>20);assert.equal(g.run('continuousRunning'),false);
});

test('timbre results show the actual recorded contribution and remain independent of later edits',()=>{
 const g=game();g.run(`
 const testPatch=Synth.patch({attack:.003,release:.5},'bass');
 tracks.set('bass',[{type:'kick',t:0,duration:.1}]);synthTracks.set('bass',{version:1,patch:testPatch,events:[]});
 tracks.set('lead',[{type:'kick',t:0,duration:.8}]);synthTracks.set('lead',{version:1,patch:testPatch,events:[]});
 cycleBass={rawShield:40,shield:39};showToneResult(['bass','lead']);
 const recordedText=$('timbreResult').textContent;
 Synth.setPatch('bass',{attack:1,release:3,osc2Mix:1,drive:1});showToneResult(['bass','lead']);
 `);
 assert.equal(g.run("$('timbreResult').textContent"),g.run('recordedText'));
 assert.match(g.run('recordedText'),/BASS：攻撃への寄与/);assert.match(g.run('recordedText'),/LEAD：攻撃への寄与/);
 assert.match(g.run('recordedText'),/合算した攻撃音色倍率 ×1\./);assert.match(g.run('recordedText'),/Bass -1/);
 assert.doesNotMatch(g.run('recordedText'),/NaN|undefined/);
});
test('chord accompaniment is restricted to the live input window and never starts in idle or combat',()=>{
 const g=game();g.run("let musicStarts=[],musicStops=0;enemyMusic={start:at=>musicStarts.push(at),stop:()=>musicStops++,setEnemy(){},setMuted(){},state:{chord:'Cm7'}};EnemyMusic={progression:()=>({chords:['c']}),chords:{c:{name:'Cm7'}}};");
 for(const state of ['ready','countin','attack','enemyAttack','cleared','over'])g.run(`state='${state}';syncEnemyMusic()`);
 assert.equal(g.run('musicStarts.length'),0);
 g.run("state='recording';recordAudioAt=10;ctx.currentTime=10.1;syncEnemyMusic()");assert.equal(g.run('musicStarts[0]'),10);
 g.run('ctx.currentTime=9.9;syncEnemyMusic();ctx.currentTime=14;syncEnemyMusic()');assert.equal(g.run('musicStarts.length'),1);
 assert.equal(g.run('musicStops'),8);
});

test('continuous input keeps four opening rimshots and eight Hat guide beats without a gap before Drums',async()=>{
 const g=game();g.run("continuousInput=true;continuousRunning=true;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickContinuous,rims=0;setInterval=fn=>{tickContinuous=fn;return 1};clickSound=()=>rims++;");
 await g.run("countIn('hat')");
 const first=g.run('recordAudioAt'),duration=g.run('timing().duration');
 assert.equal(first,2.06);assert.equal(g.run('state'),'countin');
 for(let beat=1;beat<12;beat++){
  g.run(`ctx.currentTime=.06+${beat}*.5-.05;tickContinuous()`);
  if(beat===4)g.run("ctx.currentTime=recordAudioAt+.01;tickContinuous();input('hat')");
 }
 g.run('ctx.currentTime=recordAudioAt+timing().duration+.004;tickContinuous()');
 assert.equal(g.run('phase'),'parts');assert.equal(g.run('state'),'recording');
 assert.equal(g.run('recordAudioAt'),first+duration);assert.equal(g.run('rims'),12);
 assert.equal(g.run("$('start').disabled"),false);assert.match(g.run("$('start').textContent"),/停止/);
});

test('early Drums input is retained in the next track while final Hat hits stay in Hat',async()=>{
 const g=game();g.run("continuousRunning=true;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickEarly,heardEarly=[];setInterval=fn=>{tickEarly=fn;return 1};sound=(type,at,voice)=>heardEarly.push(voice);");
 await g.run("countIn('hat')");
 g.run("ctx.currentTime=recordAudioAt+.01;tickEarly();input('hat');ctx.currentTime=recordAudioAt+timing().duration-.1;input('kick');input('hat')");
 assert.equal(g.run('hatNotes.length'),2);assert.equal(g.run('notes.length'),0);assert.equal(g.run('pendingTrackInput.notes.length'),1);
 assert.equal(g.run('heardEarly.at(-2)'),'drums');
 g.run('ctx.currentTime=recordAudioAt+timing().duration+.001;tickEarly()');
 assert.equal(g.run('phase'),'parts');assert.equal(g.run('notes.length'),1);assert.equal(g.run('notes[0].t'),0);
 assert.ok(Math.abs(g.run('notes[0].rawT')+.1)<1e-9);assert.equal(g.run('pendingTrackInput'),null);
 assert.equal(g.run("heardEarly.filter(v=>v==='drums').length"),1,'adoption must not retrigger the note');
});

test('early Bass keeps its own pitch, snapshot and held duration across the boundary without modifying Drums',async()=>{
 const g=game();g.run("continuousRunning=true;turn=1;hatReady=true;noteMode='seven';ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickEarly,heardEarly=[];setInterval=fn=>{tickEarly=fn;return 1};renderReport=()=>{};sequence=()=>{};sound=(type,at,voice)=>{heardEarly.push(voice);return {release(){}}};");
 await g.run("countIn('parts')");
 g.run("ctx.currentTime=recordAudioAt+.01;tickEarly();input('kick');ctx.currentTime=recordAudioAt+timing().duration-.1;handleKeyDown({code:'KeyH',preventDefault(){}})");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run('pendingTrackInput.notes[0].midi'),44);assert.equal(g.run('heardEarly.at(-1)'),'bass');
 g.run("Synth.setPatch('bass',{cutoff:1800})");
 g.run('ctx.currentTime=recordAudioAt+timing().duration+.001;tickEarly()');
 assert.equal(g.run('turn'),2);assert.equal(g.run("tracks.get('drums').length"),1);assert.equal(g.run('notes.length'),1);
 assert.equal(g.run("heldInputs.has('key:KeyH')"),true);assert.ok(g.run('synthRecording.events[0].t')<0);
 assert.equal(g.run('synthRecording.events.some(e=>e.patch.cutoff===1800)'),true);
 g.run("ctx.currentTime=recordAudioAt+.4;releaseInput('key:KeyH')");assert.ok(Math.abs(g.run('notes[0].duration')-.5)<1e-9);
 assert.equal(g.run('heardEarly.filter(v=>v===\'bass\').length'),1);
});

test('early Lead is isolated from Bass and preserves multiple quick notes and destination pitches',async()=>{
 const g=game();g.run("continuousRunning=true;turn=2;hatReady=true;noteMode='four';ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickEarly;setInterval=fn=>{tickEarly=fn;return 1};renderReport=()=>{};sequence=()=>{};");
 await g.run("countIn('parts')");
 g.run("ctx.currentTime=recordAudioAt+.01;tickEarly();input('kick','key:KeyA',0);ctx.currentTime=recordAudioAt+timing().duration-.12;handleKeyDown({code:'KeyS',preventDefault(){}});releaseInput('key:KeyS');ctx.currentTime+=.06;handleKeyDown({code:'KeyL',preventDefault(){}});releaseInput('key:KeyL')");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run("pendingTrackInput.notes.map(n=>n.midi).join(',')"),'63,70');
 g.run('ctx.currentTime=recordAudioAt+timing().duration+.001;tickEarly()');
 assert.equal(g.run('turn'),3);assert.equal(g.run('notes.length'),2);assert.equal(g.run("tracks.get('bass').length"),1);
 assert.ok(Math.abs(g.run("tracks.get('bass')[0].duration")-3.99)<1e-9,'the previous held note must keep its full tail');
 assert.ok(Math.abs(g.run('notes[1].rawT-notes[0].rawT')-.06)<1e-9);
});

test('the anticipation window scales down to half a beat at fast tempos',()=>{
 const g=game();g.run("enemies[0].bpm=300;continuousRunning=true;state='recording';turn=1;phase='parts';recordAudioAt=10;ctx.currentTime=11.49");
 assert.equal(g.run('nextTrackGrace()'),.1);assert.equal(g.run('upcomingInputTrack()'),null);
 g.run('ctx.currentTime=11.51');assert.equal(g.run('upcomingInputTrack().voice'),'bass');
});

test('anticipated notes apply destination-turn hazards once when adopted',async()=>{
 const g=game();g.run("continuousRunning=true;hatReady=true;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickEarly;setInterval=fn=>{tickEarly=fn;return 1};renderReport=()=>{};sequence=()=>{};gridHazards.add({type:'poison',slots:[0],turns:2,power:3,fromTurn:2});");
 await g.run("countIn('parts')");
 g.run("ctx.currentTime=recordAudioAt+.01;tickEarly();ctx.currentTime=recordAudioAt+timing().duration-.03;input('kick')");
 assert.equal(g.run('hp'),100);
 g.run('ctx.currentTime=recordAudioAt+timing().duration+.001;tickEarly()');
 assert.equal(g.run('turn'),2);assert.equal(g.run('hp'),97);assert.equal(g.run('notes.length'),1);
 g.run('ctx.currentTime+=.05;tickEarly()');assert.equal(g.run('hp'),97);
});

test('outside the early window and before combat inputs still belong to the current track; stopping discards pending input',async()=>{
 const g=game();g.run("continuousRunning=true;turn=1;hatReady=true;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickEarly;setInterval=fn=>{tickEarly=fn;return 1};");
 await g.run("countIn('parts')");
 g.run("ctx.currentTime=recordAudioAt+.01;tickEarly();ctx.currentTime=recordAudioAt+timing().duration-.151;input('kick')");
 assert.equal(g.run('notes.length'),1);assert.equal(g.run('pendingTrackInput'),null);
 g.run("ctx.currentTime+=.051;input('snare','key:KeyL');stopContinuousInput()");
 assert.equal(g.run('pendingTrackInput'),null);assert.equal(g.run('heldInputs.size'),0);
 g.run("continuousRunning=true;turn=3;state='recording';recordAudioAt=10;ctx.currentTime=13.9;input('snare')");
 assert.equal(g.run('pendingTrackInput'),null);assert.equal(g.run('notes.length'),1);
});

test('auto Hat generates sixteen eighth notes and skips Hat entry in normal and continuous modes',async()=>{
 for(const continuous of [false,true]){
  const g=game();g.run(`autoHat=true;continuousRunning=${continuous};ctx.currentTime=0;ctx.resume=()=>Promise.resolve();setInterval=()=>1;`);
  assert.equal(g.run('needsHat()'),false);await g.run('startTurn()');
  assert.equal(g.run('phase'),'parts');assert.equal(g.run('state'),'countin');assert.equal(g.run('recordAudioAt'),2.06);
  assert.equal(g.run('hatReady'),true);assert.equal(g.run('hatNotes.length'),16);
  assert.equal(g.run('hatNotes.every((n,i)=>n.type===\'hat\'&&n.t===i*.25&&n.rawT===n.t)'),true);
  assert.equal(g.run("backingTimeline().events.filter(n=>n.voice==='hat').length"),16);
  g.run("notes=[{type:'kick',t:0}];saveTrack('drums',notes)");assert.equal(g.run("lastMix.find(t=>t.voice==='hat').notes.length"),16);
 }
});

test('auto Hat refreshes with each cycle tempo and leaves an existing manually recorded Hat intact',()=>{
 const g=game();g.run("autoHat=true;hatReady=true;hatNotes=[{type:'hat',t:.07,rawT:.07}];nextRecordingPhase()");
 assert.equal(g.run('hatNotes[0].t'),.07);
 g.run('enemies[0].bpm=150;prepareTracksForTurn();nextRecordingPhase()');
 assert.equal(g.run('hatNotes.length'),16);assert.equal(g.run('hatNotes[1].t'),.2);assert.equal(g.run('hatNotes[15].t'),3);
 g.run('autoHat=false;prepareTracksForTurn()');assert.equal(g.run('nextRecordingPhase()'),'hat');
});

test('continuous handoff retains backing downbeats and accepts a new part input before the timer fires',async()=>{
 const g=game();g.run("continuousRunning=true;turn=1;hatReady=true;hatNotes=[{type:'hat',t:0,rawT:0}];ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickContinuous,backingHits=[];setInterval=fn=>{tickContinuous=fn;return 1};sound=(type,at,voice)=>backingHits.push({type,at,voice});renderReport=()=>{};sequence=()=>{};");
 await g.run("countIn('parts')");
 const first=g.run('recordAudioAt'),duration=g.run('timing().duration');
 g.run("ctx.currentTime=recordAudioAt+.01;tickContinuous();input('kick','key:KeyA');releaseInput('key:KeyA');ctx.currentTime=recordAudioAt+timing().duration+.003;handleKeyDown({code:'KeyA',preventDefault(){}})");
 assert.equal(g.run('turn'),2);assert.equal(g.run('state'),'recording');assert.equal(g.run('recordAudioAt'),first+duration);
 assert.equal(g.run('notes.length'),1);assert.ok(Math.abs(g.run('notes[0].rawT')-.003)<1e-9);
 assert.equal(g.run("backingHits.some(n=>n.voice==='drums')"),true);
 assert.equal(g.run("tracks.get('drums').length"),1);
});

test('automatic damage chart fills three parts and stops after one combat',async()=>{
 const g=game();
 g.run("debugDamagePlan={parts:new Map(['drums','bass','lead'].map(v=>[v,[{type:'kick',t:0,rawT:0,quantize:'off'}]]))};hatReady=true;continuousRunning=true;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickAuto,autoAttacks=0;setInterval=fn=>{tickAuto=fn;return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{autoAttacks++};enemyCounter=async()=>{};");
 await g.run("countIn('parts')");
 for(let part=0;part<3;part++){
  assert.equal(g.run('notes.length'),1);
  g.run("ctx.currentTime=recordAudioAt+.01;tickAuto();input('snare');ctx.currentTime=recordAudioAt+timing().duration+.001;tickAuto()");
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
 }
 assert.equal(g.run('autoAttacks'),1);assert.equal(g.run('continuousRunning'),false);
 assert.equal(g.run('debugDamagePlan'),null);assert.equal(g.run('state'),'ready');
 assert.equal(g.run('tracks.size'),3);
});
test('continuous cycle records each part once, resolves combat once and starts the next Hat automatically',async()=>{
 const g=game();g.run("autoHat=false;continuousRunning=true;ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickContinuous,attacksContinuous=0,countersContinuous=0;setInterval=fn=>{tickContinuous=fn;return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{attacksContinuous++};enemyCounter=async()=>{countersContinuous++};");
 await g.run("countIn('hat')");
 for(let part=0;part<4;part++){
  g.run("ctx.currentTime=recordAudioAt+.01;tickContinuous();input(phase==='hat'?'hat':'kick');ctx.currentTime=recordAudioAt+timing().duration+.001;tickContinuous()");
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
 }
 assert.equal(g.run('turn'),4);assert.equal(g.run('attacksContinuous'),1);assert.equal(g.run('countersContinuous'),1);
 assert.equal(g.run('phase'),'hat');assert.equal(g.run('continuousRunning'),true);
});

test('stopping continuous input cancels stale handoffs and leaves earlier completed parts intact',async()=>{
 const g=game();g.run("continuousInput=true;continuousRunning=true;turn=2;hatReady=true;tracks.set('drums',[{type:'kick',t:0}]);ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let tickContinuous;setInterval=fn=>{tickContinuous=fn;return 1};");
 await g.run("countIn('parts')");
 g.run("ctx.currentTime=recordAudioAt+.1;tickContinuous();input('kick');handleKeyDown({code:'Escape',preventDefault(){}});ctx.currentTime=100;tickContinuous()");
 assert.equal(g.run('state'),'ready');assert.equal(g.run('continuousRunning'),false);assert.equal(g.run('continuousInput'),true);
 assert.equal(g.run('notes.length'),0);assert.equal(g.run('tracks.size'),1);assert.equal(g.run('clockTimer'),null);
});

test('stop during combat prevents the next recording without interrupting combat resolution',async()=>{
 const g=game();g.run("continuousRunning=true;turn=3;state='recording';notes=[{type:'kick',t:0,rawT:0,midi:60}];renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};let endAttack,countersContinuous=0;playbackAttack=()=>new Promise(resolve=>{endAttack=resolve});enemyCounter=async()=>{countersContinuous++};");
 const done=g.run('finish(14)');g.run("$('start').onclick()");
 assert.equal(g.run('state'),'attack');assert.equal(g.run('continuousRunning'),false);
 g.run('endAttack()');await done;
 assert.equal(g.run('state'),'ready');assert.equal(g.run('turn'),4);assert.equal(g.run('countersContinuous'),1);
});

test('restarting stopped Drums keeps the already recorded Hat instead of resetting the cycle',async()=>{
 const g=game();g.run("continuousRunning=true;turn=1;hatReady=true;hatNotes=[{type:'hat',t:0,rawT:0}];ctx.currentTime=0;ctx.resume=()=>Promise.resolve();setInterval=()=>1;");
 await g.run("countIn('parts')");g.run('stopContinuousInput()');assert.equal(g.run('needsHat()'),false);
 await g.run('startTurn()');assert.equal(g.run('phase'),'parts');assert.equal(g.run('hatNotes.length'),1);
});

test('audio uses peak protection without a broad compression knee and inserts the analyser once',()=>{
 const g=game();g.run(`ctx=null;let waveformConnections=0,voices=[];
 window={AudioContext:class{constructor(){this.state='running';this.destination={};this.currentTime=0;}createBiquadFilter(){return {Q:{},frequency:{setTargetAtTime(){}},connect(){}}}createGain(){return {gain:{setTargetAtTime(){}},connect(){}}}createDynamicsCompressor(){return {threshold:{},ratio:{},knee:{},attack:{},release:{},connect(){throw Error('direct output must be replaced by analyser route')}}}}};
 BattleWaveform={connect:(context,master,canvas)=>{waveformConnections++;return {setVoice:v=>voices.push(v)}}};audio();audio();`);
 assert.equal(g.run('waveformConnections'),1);assert.equal(g.run('masterOutput.threshold.value'),-3);assert.equal(g.run('masterOutput.ratio.value'),12);assert.equal(g.run('masterOutput.knee.value'),0);assert.equal(g.run('voices[0]'),'drums');
});
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
 assert.equal(g.run('enemyHp'),260);
 g.run('ctx.currentTime=.55;playbackTick()');assert.equal(g.run('enemyHp'),260);
 g.run('ctx.currentTime=.57;playbackTick()');assert.equal(g.run('enemyHp'),250);
 g.run('ctx.currentTime=2.07;playbackTick()');assert.equal(g.run('enemyHp'),230);
 let ended=false;playback.then(()=>ended=true);await Promise.resolve();assert.equal(ended,false);
 g.run('ctx.currentTime=4.07;playbackTick()');await playback;
 assert.equal(g.run('attackPlayhead'),null);
 assert.equal(g.run("playedVoices.join(',')"),'bass,bass');
});

test('damage replay plays chords on its musical downbeat including early-input pre-roll, then stops them',async()=>{
 const g=game();g.run("ctx.currentTime=0;ctx.resume=()=>Promise.resolve();state='attack';lastInstrument='drums';last=[{type:'kick',t:0,rawT:-.1},{type:'snare',t:.5,rawT:.5}];let replayTick,musicStarts=[],musicPlaying=false;setInterval=fn=>{replayTick=fn;return 1};enemyMusic={start(at){if(!musicPlaying)musicStarts.push(at);musicPlaying=true},stop(){musicPlaying=false},setEnemy(){},setMuted(){},state:{chord:'Cm7'}};EnemyMusic={progression:()=>({chords:['c']}),chords:{c:{name:'Cm7'}}};");
 const done=g.run("playbackAttack({damages:[10,20]},'#fff')");await Promise.resolve();
 assert.ok(Math.abs(g.run('musicStarts[0]')-.16)<1e-9);assert.equal(g.run('musicPlaying'),true);
 g.run('ctx.currentTime=.07;replayTick()');assert.equal(g.run('enemyHp'),250);
 g.run('ctx.currentTime=4.17;replayTick()');await done;
 assert.equal(g.run('enemyHp'),230);assert.equal(g.run('musicPlaying'),false);assert.equal(g.run('attackMusicWindow'),null);
 g.run("state='enemyAttack';audio()");assert.equal(g.run('musicPlaying'),false);
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
 assert.equal(g.run('enemyHp'),250);
});
test('space starts only when ready and blocks scrolling and repeat',()=>{
 const g=game();
 g.run("let starts=0,prevented=0;$('start').disabled=false;$('start').click=()=>starts++;let space={code:'Space',preventDefault(){prevented++}};state='ready';handleKeyDown(space);state='recording';handleKeyDown(space);state='countin';handleKeyDown(space);state='attack';handleKeyDown(space);state='cleared';handleKeyDown(space);state='over';handleKeyDown(space);handleKeyDown({...space,repeat:true});");
 assert.equal(g.run('starts'),3);assert.equal(g.run('prevented'),6);
});
test('bass and lead synthesize separate pitches at the requested audio time',()=>{
 const g=game();
 g.run(`let frequencies=[],starts=[];
 const param={setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={destination:{},createGain(){return {gain:{...param},connect(){}}},createWaveShaper(){return {connect(){}}},createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{...param},connect(){}}},createOscillator(){return {frequency:{setValueAtTime(f,t){frequencies.push(f)}},connect(){},start(t){starts.push(t)},stop(){}}}};
 pitchedSound('kick',5,'bass');pitchedSound('snare',6,'lead');`);
 assert.equal(g.run('frequencies[0]'),65.406);assert.equal(g.run('frequencies[15]'),311.127);
 assert.equal(g.run("starts.join(',')"),[...Array(15).fill(5),...Array(15).fill(6)].join());
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
 g.run("autoHat=false;let launched=[];countIn=async next=>{launched.push(next)};turn=1;");
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
 assert.ok(Math.abs(g.run('scheduled[0]')-.56)<1e-9);assert.equal(g.run('enemyHp'),260);
 g.run('ctx.currentTime=.57;replayTick()');assert.equal(g.run('enemyHp'),240);
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
test('lead replaces the previous hold and caps the final gate at phrase end',()=>{
 const g=game();g.run("turn=3;input('kick','pointer:1');ctx.currentTime=10.5;input('snare','pointer:2');ctx.currentTime=11;releaseInput('pointer:1');ctx.currentTime=15;releaseAllInputs()");
 assert.equal(g.run('notes[0].duration'),.5);assert.equal(g.run('notes[1].duration'),3.5);assert.equal(g.run('heldInputs.size'),0);
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
 const g=game();g.run(`let stops=[];const param={setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={currentTime:10,destination:{},createGain(){return {gain:{...param},connect(){},disconnect(){}}},createWaveShaper(){return {connect(){}}},createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{...param},connect(){},disconnect(){}}},createOscillator(){return {frequency:param,connect(){},start(){},stop(t){stops.push(t)}}}};
 let voice=pitchedSound('kick',10,'bass',1,Infinity);`);
 assert.equal(g.run('stops.length'),0);g.run('voice.release(11.5)');assert.equal(g.run('stops.length'),15);assert.ok(Math.abs(g.run('stops[0]')-11.645)<1e-9);
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

test('nine-note mode records ASDFGHJKL with upper C and D, including H and long holds',()=>{
 const g=game();g.run("turn=3;noteMode='nine';for(const code of melodyKeys){handleKeyDown({code,target:{},preventDefault(){}});ctx.currentTime+=.1;releaseInput('key:'+code)};saveTrack('lead',notes)");
 assert.equal(g.run('notes.map(n=>n.midi).join()'),'60,62,63,65,67,68,70,72,74');assert.equal(g.run('notes.map(n=>n.pitch).join()'),'0,1,2,3,4,5,6,7,8');assert(g.run('notes.every(n=>Math.abs(n.duration-.1)<1e-8)'));assert.equal(g.run('hatNotes.length'),0);
 g.run("state='ready';setKeyPitch('lead','nine',8,77);state='recording';phase='hat';handleKeyDown({code:'KeyH',target:{},preventDefault(){}})");assert.equal(g.run("pitchesFor('lead','nine')[8]"),77);assert.equal(g.run('lastMix[0].notes.at(-1).midi'),74);assert.equal(g.run('hatNotes.length'),1);
});

test('seven-note mode ignores the two added keys and nine mode keeps drums unchanged',()=>{
 const g=game();g.run("turn=2;noteMode='seven';for(const code of ['KeyK','KeyL'])handleKeyDown({code,target:{},preventDefault(){}})");assert.equal(g.run('notes.length'),0);
 g.run("turn=1;noteMode='nine';handleKeyDown({code:'KeyL',target:{},preventDefault(){}})");assert.equal(g.run('notes.length'),1);assert.equal(g.run('notes[0].type'),'snare');assert.equal(g.run('notes[0].midi'),undefined);
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
 const g=game();g.run(`let frequencies=[];const param={setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={currentTime:0,destination:{},createGain(){return {gain:{...param},connect(){}}},createWaveShaper(){return {connect(){}}},createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{...param},connect(){}}},createOscillator(){return {frequency:{setValueAtTime(f){frequencies.push(f)}},connect(){},start(){},stop(){}}}};
 pitchedSound('kick',0,'bass',1,.5,6);pitchedSound('kick',0,'lead',1,.5,6);`);
 assert.ok(Math.abs(g.run('frequencies[0]')-65.406*2**(10/12))<1e-8);
 assert.ok(Math.abs(g.run('frequencies[15]')-261.626*2**(10/12))<1e-8);
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
 const g=game();g.run(`let frequencies=[];const param={setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}};
 ctx={currentTime:0,destination:{},createGain(){return {gain:{...param},connect(){}}},createWaveShaper(){return {connect(){}}},createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},attack:{},release:{},connect(){}}},createBiquadFilter(){return {frequency:param,Q:{...param},connect(){}}},createOscillator(){return {frequency:{setValueAtTime(f){frequencies.push(f)}},connect(){},start(){},stop(){}}}};
 pitchedSound('kick',0,'lead',1,.3,0,69);`);assert.equal(g.run('frequencies[0]'),440);
});

test('attack reactions distinguish actual weakness damage from an evaded strike at note timing',async()=>{
 const g=game();g.run("ctx.currentTime=0;ctx.resume=()=>Promise.resolve();last=[{type:'kick',t:.5},{type:'snare',t:2}];lastInstrument='drums';activeReport={weaknesses:[{id:'earth'}]};let reactions=[];reactEnemy=(kind,element)=>reactions.push({kind,element});let playbackTick;setInterval=fn=>{playbackTick=fn;return 1};clearInterval=()=>{};state='attack';");
 const playback=g.run("playbackAttack({damages:[10,0]},'#d4f77d')");await Promise.resolve();
 assert.equal(g.run('reactions.length'),0);g.run('ctx.currentTime=.57;playbackTick()');assert.equal(g.run('reactions[0].kind'),'weak');assert.equal(g.run('reactions[0].element'),'earth');
 g.run('ctx.currentTime=2.07;playbackTick()');assert.equal(g.run('reactions[1].kind'),'dodge');g.run('ctx.currentTime=4.07;playbackTick()');await playback;
});
test('roster contains nine distinct enemies with stronger counterattacks',()=>{
 const g=game();assert.equal(g.run('enemies.length'),9);assert.equal(g.run('new Set(enemies.map(e=>e.kind)).size'),9);
 assert.equal(g.run('enemies.slice(0,3).map(e=>e.attack).join()'),'88,96,104');
 g.run('stage=8;update()');assert.equal(g.run("$('stage').textContent"),'ENCOUNTER 09 / 09');
});
test('late enemies lead onward and only the ninth completes the run',async()=>{
 for(const [stage,expected] of [[2,'cleared'],[5,'cleared'],[6,'cleared'],[7,'cleared'],[8,'over']]){
  const g=game();g.run(`stage=${stage};enemyHp=0;notes=[];hatNotes=[];setTimeout=fn=>{fn();return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{};`);
  await g.run('finish()');assert.equal(g.run('state'),expected);
 }
});

test('roguelite completes at its eighth boss independently of the nine-enemy standard roster',()=>{
 const g=game();g.run(`RogueRun={victory(run){run.phase='complete';return true;}};rogueRun={floor:8,total:8,phase:'battle'};stage=7;hp=80;enemyHp=0;completeBattle();`);
 assert.equal(g.run('state'),'over');assert.equal(g.run('rogueRun.phase'),'complete');assert.equal(g.run("$('start').textContent"),'もう一度遊ぶ ↗');
});

test('late enemies have stable distinct forecasts across all three recording parts and restore cleanly',()=>{
 const g=game();
 for(const [stage,order] of [[6,['heavy','guard','pierce','heal','guard','special']],[7,['heavy','guard','buff','pierce','heal','special']],[8,['buff','pierce','guard','heavy','heal','special']]]){
  for(let round=0;round<6;round++)for(let part=0;part<3;part++){
   g.run(`stage=${stage};turn=${round*3+part+1}`);
   assert.equal(g.run('enemyIntent().id'),order[round]);assert.doesNotMatch(g.run('enemyIntent().name'),/undefined/);
  }
 }
 g.run("enemies[6].intentOrder[0]='buff'");assert.equal(g.run('standardEnemies[6].intentOrder[0]'),'heavy');
 g.run("document.body={dataset:{}};prepareMode('normal')");assert.equal(g.run('enemies[6].intentOrder[0]'),'heavy');assert.equal(g.run('enemies.length'),9);
});

test('both late enemies resolve complete two-note battles with their own counters and music',async()=>{
 for(const nextStage of [6,7,8]){
  const g=game();g.run(`stage=${nextStage};enemyHp=enemies[stage].hp;muted=true;setTimeout=fn=>{fn();return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async r=>{enemyHp=Math.max(0,enemyHp-r.total)};notes=[0,4,8,12,16,20,24,28].map((q,i)=>({t:q*timing().step,rawT:q*timing().step,type:i%2?'snare':'kick'}));`);
  await g.run('finish()');
  g.run("notes=[0,8,16,28].map(q=>({t:q*timing().step,rawT:q*timing().step,type:'kick',midi:36,duration:timing().beat}))");await g.run('finish()');
  g.run("notes=[2,10,18,26].map((q,i)=>({t:q*timing().step,rawT:q*timing().step,type:i%2?'snare':'kick',midi:i%2?63:60,duration:.25}))");await g.run('finish()');
  assert.equal(g.run('turn'),4);assert.equal(g.run('state'),'ready');assert.ok(g.run('enemyHp')<g.run('enemies[stage].hp'));assert.ok(g.run('hp')>0);
 }
});

test('only successfully played Kick samples duck the bass at their actual scheduled time',()=>{
 const g=game();g.run("let dips=[];Synth.engine=()=>({duckForKick:(...args)=>dips.push(args)});globalThis.DrumAudio={play:()=>true,ready:Promise.resolve(true)};sampleSound('kick',11,.5);sampleSound('snare',11,.5);sampleSound('hat',11,.5);muted=true;sampleSound('kick',11,1)");
 assert.equal(g.run('dips.length'),1);assert.equal(g.run('dips[0][0]'),11);assert.equal(g.run('dips[0][1]'),.5);
});

test('attack completion captures an accumulated mix plus the unquantized source tracks',async()=>{
 const g=game();g.run("turn=2;tracks.set('drums',[{type:'kick',t:0,rawT:0}]);notes=[{type:'kick',t:.48,rawT:.48,inputT:.48,midi:36,duration:.6,quantize:'just'}];hatNotes=[{type:'hat',t:0,rawT:0}];enemyHp=0;let captured=[];globalThis.captureHistory=entry=>captured.push(entry);setTimeout=fn=>{fn();return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{};");
 await g.run('finish()');assert.equal(g.run('captured.length'),1);assert.equal(g.run('captured[0].kind'),'attack');assert.equal(g.run('captured[0].tracks.map(t=>t.voice).join()'),'drums,bass,hat');assert.equal(g.run("captured[0].rawTracks.find(t=>t.voice==='bass').notes[0].rawT"),.48);assert.equal(g.run("captured[0].tracks.find(t=>t.voice==='bass').notes[0].rawT"),.5);
});
test('hazardous Kick Snare and Hat inputs all sound and record while dealing per-input poison',()=>{
 const g=game();g.run("gridHazards.add({type:'poison',slots:[4],turns:4,power:3});let heard=[];sound=(...args)=>heard.push(args);ctx.currentTime=10.5;input('kick');input('kick');input('snare');phase='hat';input('hat')");
 assert.equal(g.run('hp'),88);assert.equal(g.run('heard.length'),4);assert.equal(g.run('notes.length'),3);assert.equal(g.run('hatNotes.length'),1);assert.equal(g.run('notes[0].rawT'),.5);
});
test('poison evaluates raw position rather than the quantized replay position',()=>{
 const g=game();g.run("gridHazards.add({type:'poison',slots:[4],turns:4,power:3});phaseQuantizeMode='laidBack';ctx.currentTime=10.39;input('snare')");assert.equal(g.run('hp'),100);assert.ok(Math.abs(g.run('Quantize.render(notes,120,4)[0].rawT')-.41)<1e-9);
 g.run("phaseQuantizeMode='snarePushed';ctx.currentTime=10.41;input('snare')");assert.equal(g.run('hp'),97);assert.ok(g.run('notes[1].rawT')>.4);
});
test('a held bass note takes poison once, while release and preview replay do not',()=>{
 const g=game();g.run("turn=2;gridHazards.add({type:'poison',slots:[4],turns:4,power:3});ctx.currentTime=10.5;input('kick','key:KeyA');input('kick','key:KeyA');ctx.currentTime=10.7;releaseInput('key:KeyA');state='ready';input('kick');sound('kick');");assert.equal(g.run('hp'),97);assert.equal(g.run('notes.length'),1);assert.ok(Math.abs(g.run('notes[0].duration')-.2)<1e-9);
});
test('enemy skill is forecast, starts next turn, and new waves coexist',()=>{
 const g=game();g.run("turn=3;gridHazards.advanceToTurn(3);renderGridHazards();castGridSkill()");assert.match(g.run("$('enemyIntent').textContent"),/防御態勢/);g.run('turn=18;renderBattlePlan()');assert.match(g.run("$('enemyIntent').textContent"),/毒汚染/);assert.equal(g.run('gridHazards.active().length'),0);
 g.run('turn=4;ready();ready()');assert.equal(g.run('gridHazards.active()[0].remainingTurns'),4);assert.equal(g.run("$('hazardBar').hidden"),false);
 g.run('turn=6;advanceGridHazards();castGridSkill();turn=7;ready()');assert.equal(g.run('gridHazards.active().length'),2);assert.equal(g.run('gridHazards.active()[0].remainingTurns'),1);
});
test('poison defeat cancels the recording clock and resets contamination without rejecting the fatal note',async()=>{
 const g=game();g.run("ctx.currentTime=0;ctx.resume=()=>Promise.resolve();let recordingTick;setInterval=fn=>{recordingTick=fn;return 1};hp=2;gridHazards.add({type:'poison',slots:[0],turns:4,power:3});");
 await g.run("countIn('hat')");g.run("ctx.currentTime=recordAudioAt+.001;input('hat');recordingTick()");assert.equal(g.run('hp'),0);assert.equal(g.run('hatNotes.length'),1);assert.equal(g.run('state'),'over');assert.equal(g.run('clockTimer'),null);assert.equal(g.run('gridHazards.active().length'),0);
});
test('victory clears active and pending grid hazards',async()=>{
 const g=game();g.run("gridHazards.add({type:'poison',slots:[4],turns:4,power:3});gridHazards.add({type:'poison',slots:[8],turns:4,power:3,fromTurn:4});enemyHp=0;notes=[];setTimeout=fn=>{fn();return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{};");await g.run('finish()');assert.equal(g.run('state'),'cleared');assert.equal(g.run('gridHazards.active(4).length'),0);
});
test('changing enemies clears the previous enemy contamination',()=>{
 const g=game();g.run("gridHazards.add({type:'poison',slots:[4],turns:4,power:3});state='cleared';enemyHp=0;startTurn=()=>{};$('start').onclick()");assert.equal(g.run('stage'),1);assert.equal(g.run('gridHazards.active().length'),0);assert.equal(g.run('gridHazards.turn'),1);
});

test('death during a later enemy counter resets contamination',async()=>{
 const g=game();g.run("turn=3;gridHazards.advanceToTurn(3);gridHazards.add({type:'poison',slots:[4],turns:4,power:3});enemyHp=150;notes=[];setTimeout=fn=>{fn();return 1};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{};enemyCounter=async()=>{hp=0};");await g.run('finish()');assert.equal(g.run('state'),'over');assert.equal(g.run('gridHazards.active(4).length'),0);
});


test('a complete three-part cycle applies Bass shield and Lead support then counters automatically',async()=>{
 const g=game();g.run("state='ready';let attacks=[],counters=0;notes=[{type:'kick',t:0,rawT:0},{type:'snare',t:1,rawT:1}];hatNotes=[{type:'hat',t:0,rawT:0},{type:'hat',t:1,rawT:1}];renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async(result,color,voice)=>{attacks.push({result,voice})};enemyCounter=async()=>{counters++;const hit=PerformanceCombat.receive(hp,shield,40);hp=hit.hp;shield=hit.shield};");
 await g.run('finish()');assert.equal(g.run('turn'),2);assert.equal(g.run('attacks.length'),0);assert.equal(g.run('counters'),0);
 g.run("notes=[{type:'kick',t:0,rawT:0,duration:1,midi:36},{type:'snare',t:2,rawT:2,duration:1,midi:43}]");
 await g.run('finish()');assert.equal(g.run('turn'),3);assert.ok(g.run('shield')>0);assert.equal(g.run('counters'),0);
 g.run("notes=[{type:'kick',t:0,rawT:0,duration:.3,midi:60},{type:'snare',t:1,rawT:1,duration:.3,midi:67}]");
 await g.run('finish()');assert.equal(g.run('turn'),4);assert.equal(g.run('counters'),1);assert.equal(g.run('attacks.length'),1);assert.equal(g.run('attacks[0].voice'),'drums');assert.ok(g.run('cycleLead.attack')>0);assert.equal(g.run('state'),'ready');
});
test('all note modes resolve the real three-part battle pipeline with pitch and tactical effects',async()=>{
 for(const mode of ['two','four','seven','nine']){
  const g=game();g.run(`noteMode='${mode}';state='ready';enemyHp=10000;let modeResults=[];renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async r=>modeResults.push(r);enemyCounter=async()=>{};notes=[0,3,6,10,16,19,22,27].map((q,i)=>({type:i%2?'snare':'kick',t:q*.125,rawT:q*.125}));`);
  await g.run('finish()');
  g.run("notes=[0,8,16,28].map((q,i)=>({type:i%2?'snare':'kick',t:q*.125,rawT:q*.125,duration:.4,midi:i%2?43:36}))");await g.run('finish()');
  g.run("notes=[2,10,18,26].map((q,i)=>({type:i%2?'snare':'kick',t:q*.125,rawT:q*.125,duration:.3,midi:i%2?63:60}))");await g.run('finish()');
  assert.equal(g.run('turn'),4);assert.equal(g.run('modeResults.length'),1);assert.ok(g.run('modeResults[0].total')>0);assert.ok(g.run('shield')>0);assert.ok(g.run('modeResults[0].calculation.guard.guardBreak')>0);assert.equal(g.run('tracks.size'),3);
 }
});
test('actual enemy actions apply rhythm interference to armor, healing and attack growth',async()=>{
 for(const [part,stageIndex,id] of [[3,0,'guard'],[9,0,'heal'],[9,1,'buff']]){
  const g=game();
  g.run(`turn=${part};stage=${stageIndex};enemyHp=100;muted=true;setTimeout=fn=>{fn();return 1};let rhythmAction=Rhythm.analyze([0,16,20,24,26,28,29,30,31].map(q=>({t:q*.125,type:'kick'})));rhythmAction.tactics={guardBreak:.8,healBlock:1,buffSuppress:1,value:1,label:'テスト'};const beforeGuard=enemies[stage].guard??0,beforeAttack=enemies[stage].attack;`);
  await g.run('enemyCounter(rhythmAction,{},{total:20})');
  if(id==='guard')assert.ok(g.run('enemies[stage].guard')<=g.run('beforeGuard'));
  if(id==='heal')assert.equal(g.run('enemyHp'),100);
  if(id==='buff')assert.equal(g.run('enemies[stage].attack'),g.run('beforeAttack'));
  assert.match(g.run("$('summaryHint').textContent"),/テスト/);
 }
});
test('automatic enemy attack consumes shields without recording or requesting inputs',async()=>{
 const g=game();g.run("state='attack';muted=true;shield=12;cycleLead={weaken:0};setTimeout=fn=>{fn();return 1};turn=6;castGridSkill=()=>{};");
 await g.run("enemyCounter({count:4,element:'wind',effect:.5},{},{total:20})");
 assert.equal(g.run('shield'),0);assert.equal(g.run('hp'),6);assert.equal(g.run('notes.length'),0);assert.equal(g.run('state'),'enemyAttack');
});
test('raw Drums and Hat remain the source of groove classification after all three parts',async()=>{
 const g=game();g.run("turn=3;notes=[];tracks.set('drums',[{type:'snare',t:.47,rawT:.47,inputT:.47,quantize:'just'}]);hatNotes=[{type:'hat',t:.5,rawT:.5}];let seen;Groove={...Groove,analyzeRelations:(raw,hat)=>{seen={raw,hat};return {}}};renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{};enemyCounter=async()=>{};");
 await g.run('finish()');assert.equal(g.run('seen.raw[0].rawT'),.47);assert.equal(g.run('seen.hat[0].rawT'),.5);
});


test('final battle resolution applies ensemble attack and shield bonuses once',async()=>{
 const g=game();g.run("turn=3;shield=20;cycleBass={shield:20};notes=[0,1,2].map(t=>({type:'kick',t,rawT:t,midi:60,duration:.2}));tracks.set('drums',[0,1,2].map(t=>({type:'kick',t,rawT:t})));tracks.set('bass',[0,1,2].map(t=>({type:'kick',t,rawT:t,midi:36,duration:.2})));renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};let resolved;playbackAttack=async result=>{resolved=result};enemyCounter=async()=>{};");
 await g.run('finish()');assert.ok(g.run('cycleEnsemble.scores.grooveLock')>.9);assert.ok(g.run('cycleEnsemble.bonus.shield')>0);assert.equal(g.run('shield'),g.run('20+Math.round(20*(cycleLead.shieldEfficiency+cycleEnsemble.bonus.shieldEfficiency))+cycleEnsemble.bonus.shield'));assert.ok(g.run('resolved.total')>=0);
});

test('articulation style applies once after groove/ensemble without replacing the drum element',async()=>{
 const g=game();g.run(`state='ready';turn=1;notes=[{type:'kick',t:0,rawT:0},{type:'snare',t:1,rawT:1}];hatNotes=[{type:'hat',t:0,rawT:0}];renderReport=()=>{};sequence=()=>{};annotateSequence=()=>{};playbackAttack=async()=>{};enemyCounter=async()=>{};`);
 await g.run('finish()');
 g.run(`const bassPatch=Synth.patch({wave:'square',cutoff:12000,sustain:.6});synthTracks.set('bass',{version:1,patch:bassPatch,events:[{t:0,patch:bassPatch,pad:Synth.pad()}]});notes=[{type:'kick',t:0,rawT:0,midi:36,duration:1}];`);
 await g.run('finish()');
 assert.equal(g.run('cycleBass.shield'),g.run("Math.round(cycleBass.rawShield*Synth.style(synthTracks.get('bass'),tracks.get('bass'),lastDuration).shield)"));
 g.run(`const leadPatch=Synth.patch({wave:'sine',cutoff:400,release:2});synthTracks.set('lead',{version:1,patch:leadPatch,events:[{t:0,patch:leadPatch,pad:Synth.pad()}]});notes=[{type:'kick',t:.5,rawT:.5,midi:60,duration:1}];let capturedTimbre;const baseExplain=CombatFeedback.explain;CombatFeedback={...CombatFeedback,explain:(a,...args)=>{capturedTimbre=a;return baseExplain(a,...args)}};`);
 await g.run('finish()');
 g.run(`const drumNotes=tracks.get('drums'),zonesForTest=currentZones(),baseAttack=Ensemble.attack(PerformanceCombat.enhance(Groove.enrich(Rhythm.analyze(Quantize.render(drumNotes,lastBpm,lastDuration),lastDuration,lastBpm),Groove.analyzeRelations(drumNotes,hatNotes,lastBpm,lastDuration)),drumNotes,lastBpm,zonesForTest,cycleLead),cycleEnsemble),bassStyle=Synth.style(synthTracks.get('bass'),tracks.get('bass'),lastDuration),leadStyle=Synth.style(synthTracks.get('lead'),tracks.get('lead'),lastDuration),appliedTone={attack:1+((bassStyle.attack-1)+(leadStyle.attack-1))*.5,weaken:0};`);
 assert.equal(g.run('capturedTimbre.power'),g.run('baseAttack.power*appliedTone.attack'));
 assert.equal(g.run('capturedTimbre.element'),g.run('baseAttack.element'));
 assert.equal(g.run('capturedTimbre.timbreWeaken'),g.run('appliedTone.weaken'));
 assert.equal(g.run("capturedTimbre.powerSteps.filter(s=>s.label.includes('音色')).length"),1);
 assert.equal(g.run('turn'),4);
});
test('synth recording retains count-in changes and fast XY movements as independent immutable events',()=>{
 const g=game();g.run(`turn=2;phase='parts';state='countin';recordAudioAt=12;ctx.currentTime=10;beginSynthRecording();Synth.setPatch('bass',{wave:'square'});ctx.currentTime=11;Synth.setPad('bass',{amount:.4,volume:.8});ctx.currentTime=12.1;Synth.setPatch('bass',{cutoff:2000});ctx.currentTime=12.11;Synth.setPad('bass',{amount:.6,volume:.7});synthTracks.set('bass',Synth.cleanSnapshot(synthRecording,'bass'));saveTrack('bass',[{type:'kick',t:0,rawT:-.1,midi:36,duration:1}]);const originalSnapshot=JSON.stringify(lastMix[0].synth);state='ready';Synth.setPatch('bass',{wave:'sine',cutoff:9000});`);
 assert.equal(g.run('synthRecording.events.length'),4);
 assert.equal(g.run('synthRecording.events[0].t'),-2);
 assert.equal(g.run('synthRecording.events[3].t'),.11);
 assert.equal(g.run('JSON.stringify(lastMix[0].synth)'),g.run('originalSnapshot'));
 assert.equal(g.run("Synth.at(lastMix[0].synth,-.5).patch.wave"),'square');
 assert.equal(g.run("Synth.at(lastMix[0].synth,-.5).pad.volume"),.8);
});
