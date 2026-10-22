const {test}=require('node:test'),assert=require('node:assert/strict'),Music=require('./enemy-music.js');
function setup(){
 const starts=[],frequencies=[],timers=new Map();let serial=0;
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
 const ctx={currentTime:0,state:'running',destination:{},createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:param(),Q:param(),connect(){},disconnect(){}}),createOscillator(){const frequency=param();return {frequency,detune:param(),connect(){},disconnect(){},start(t){starts.push(t);frequencies.push(frequency.value)},stop(){}}}};
 const music=Music.create(ctx,ctx.destination,{setInterval(fn){timers.set(++serial,fn);return serial},clearInterval(id){timers.delete(id)}});
 return {ctx,music,starts,frequencies,timers,tick(time){ctx.currentTime=time;for(const fn of [...timers.values()])fn();}};
}
test('each enemy has a distinct two-bar progression in the player key',()=>{
 assert.equal(Object.keys(Music.progressions).length,9);
 assert.equal(new Set(Object.values(Music.progressions).map(p=>p.chords.join(','))).size,9);
 for(const p of Object.values(Music.progressions))for(const id of p.chords){assert(Music.chords[id]);for(const n of Music.chords[id].notes)assert([0,2,3,5,7,8,10].includes(n%12));}
});

test('all enemy progressions loop on the same eight-beat boundary as a recorded part',()=>{
 for(const kind of Object.keys(Music.progressions))for(const bpm of [72,82,100,120,138,150,240]){
  const f=setup();f.music.setEnemy(kind,bpm);f.music.start(.06);
  assert.equal(f.music.state.loopDuration,480/bpm);assert.equal(f.music.state.chordDuration,120/bpm);
  const expected=Music.timeline(Music.snapshot(kind,bpm),960/bpm);
  for(const n of expected)f.tick(.06+n.t-.03);
  for(const n of expected)assert(f.starts.some(t=>Math.abs(t-(.06+n.t))<1e-8),kind+' / '+bpm+' / '+n.t);
  const end=.06+480/bpm;
  f.tick(end+.001);assert.equal(f.music.state.chord,Music.chords[Music.progressions[kind].chords[0]].name);
 }
});

test('finite playback never schedules the first chord of the next loop, including delayed stop and unmute',()=>{
 for(const bpm of [82,120,240]){const f=setup(),start=.16,end=start+480/bpm;f.music.setEnemy('stone',bpm);f.music.start(start,end);f.tick(start);
  for(let i=1;i<4;i++)f.tick(start+i*120/bpm-.03);
  f.tick(end-.08);f.tick(end+.2);assert.equal(f.starts.length,16);assert(f.starts.every(t=>t<end));
  f.music.setMuted(true);f.music.setMuted(false);assert.equal(f.starts.length,16);
 }
});

test('enemy timbres differ in waveform, envelope or harmonic layer rather than only filter brightness',()=>{
 const tones=Object.values(Music.progressions).map(p=>JSON.stringify([p.wave,p.harmonic??0,p.attack,p.decay,p.sustain,p.release]));
 assert.equal(new Set(tones).size,9);
});
test('chords are polyphonic and scheduled from the audio clock at the enemy BPM',()=>{
 const f=setup();f.music.setEnemy('stone',120);f.music.start(.06);assert.equal(f.starts.length,4);
 assert(f.starts.every(t=>t===.06));assert.equal(new Set(f.frequencies).size,4);
 f.tick(1);assert.equal(f.starts.length,8);assert(f.starts.slice(4).every(t=>Math.abs(t-1.09)<1e-8));
 f.music.start();assert.equal(f.timers.size,1);f.tick(4.02);assert.equal(f.music.state.chord,'Gm7');f.tick(4.07);assert.equal(f.music.state.chord,'Cm7');
});
test('aligning a future input downbeat works even between the old chord boundaries',()=>{
 const f=setup();f.music.setEnemy('stone',120);f.music.start(.06);f.music.align(1);
 f.tick(.9);assert(f.starts.some(t=>t===1));assert.equal(f.music.state.origin,1);
 f.tick(1.01);assert.equal(f.music.state.chord,'Abmaj7','alignment advances the progression instead of repeating its first chord');
 f.tick(1.94);assert(f.starts.some(t=>Math.abs(t-2.03)<1e-8));assert.equal(f.timers.size,1);
});
test('mute prevents new voices and unmute resumes the current chord without resetting the clock',()=>{
 const f=setup();f.music.start(.06);f.music.setMuted(true);const count=f.starts.length,origin=f.music.state.origin;
 f.tick(3.2);assert.equal(f.starts.length,count);f.music.setMuted(false);assert(f.starts.length>count);assert.equal(f.music.state.origin,origin);
});
test('changing enemy replaces the progression and timer; stop and suspended contexts schedule nothing',()=>{
 const f=setup();f.music.start();f.music.setEnemy('fly',150);assert.equal(f.timers.size,1);assert.equal(f.music.state.chord,'Ebmaj7');
 f.ctx.state='suspended';const count=f.starts.length;f.tick(20);assert.equal(f.starts.length,count);
 f.music.stop();assert.equal(f.timers.size,0);assert.equal(f.music.state.playing,false);f.tick(30);assert.equal(f.starts.length,count);
});
test('a delayed timer skips stale chords instead of scheduling a backlog',()=>{
 const f=setup();f.music.setEnemy('stone',120);f.music.start(.06);const count=f.starts.length;f.tick(20.08);
 assert.equal(f.starts.length-count,4);assert(f.starts.slice(count).every(t=>t>=20.08));
});

test('a saved progression and tone play independently of the current enemy preset',()=>{
 const saved=Music.snapshot('crystal',138),f=setup();f.music.setEnemy('fly',150);f.music.setSnapshot(saved);saved.chords[0].notes[0]=99;
 f.music.start(.06);assert.equal(f.music.state.bpm,138);assert.equal(f.music.state.chord,'Abmaj7');assert.equal(f.starts.length,8);
 assert.equal(f.frequencies[0],440*2**((48-69)/12));
 f.music.stop();f.music.setEnemy('stone',82);assert.equal(f.music.state.kind,'stone');assert.equal(f.music.state.chord,'Cm7');
});

test('rhythm patterns demonstrate enemy-specific placement, space and development',()=>{
 const r=Music.rhythms;
 assert.equal(new Set(Object.values(r).map(p=>JSON.stringify(p.events))).size,9);
 assert.ok(r.stone.events.some(e=>e.delay>0));assert.ok(r.stone.events.every(e=>e.duration>=1));
 assert.ok(r.machine.events.every(e=>e.beat%1===.5&&e.duration<.5));
 assert.ok(r.fly.events.every((e,i)=>e.beat===i));
 assert.ok(r.plant.events.filter(e=>e.beat>=4).length>r.plant.events.filter(e=>e.beat<4).length);
 assert.ok(r.plant.events.some(e=>Math.abs(e.beat%1-2/3)<1e-8));
 assert.deepEqual(r.ghost.events.slice(0,4).map(e=>e.delay),r.ghost.events.slice(4).map(e=>e.delay));
 assert.ok(r.ghost.events.some(e=>e.delay<0)&&r.ghost.events.some(e=>e.delay>0));
 assert.deepEqual(r.crystal.events.slice(0,4).map(e=>e.velocity),r.crystal.events.slice(4).map(e=>e.velocity));
 assert.ok(r.furnace.events.some((e,i)=>i&&e.beat-r.furnace.events[i-1].beat>1));
 assert.ok(r.conductor.events.at(-1).beat+r.conductor.events.at(-1).duration<7);
 assert.ok(r.conductor.events.filter(e=>e.beat>=4).length>r.conductor.events.filter(e=>e.beat<4).length);
});

test('unmuting inside a rest preserves the rest, and upcoming notes are not lost',()=>{
 const early=setup();early.music.setEnemy('stone',120);early.music.setMuted(true);early.music.start(.06);early.music.setMuted(false);assert(early.starts.some(t=>Math.abs(t-.06)<1e-8));
 const f=setup();f.music.setEnemy('stone',120);f.music.start(.06);f.music.setMuted(true);f.tick(.85);
 const count=f.starts.length;f.music.setMuted(false);assert.equal(f.starts.length,count);
 f.tick(1);assert(f.starts.some(t=>Math.abs(t-1.09)<1e-8));
 const m=setup();m.music.setEnemy('machine',120);m.music.start(.06);m.music.setMuted(true);m.tick(.1);m.music.setMuted(false);assert.equal(m.starts.length,0);m.tick(.25);assert(m.starts.some(t=>Math.abs(t-.31)<1e-8));
});

test('saved rhythm survives preset changes and malformed articulation is rejected',()=>{
 const saved=Music.snapshot('ghost',120),clean=Music.cleanSnapshot(JSON.parse(JSON.stringify(saved)));
 saved.rhythm.events[1].delay=.1;assert.equal(clean.rhythm.events[1].delay,.025);
 for(const event of [{beat:1,duration:1,velocity:2,delay:0},{beat:0,duration:1,velocity:1,delay:-.01},{beat:8,duration:1,velocity:1,delay:0}])assert.throws(()=>Music.cleanSnapshot({...clean,rhythm:{...clean.rhythm,events:[event]}}));
 assert.throws(()=>Music.cleanSnapshot({...clean,rhythm:{...clean.rhythm,events:[]}}));
 const legacy=Music.snapshot('stone',120);delete legacy.rhythm;const f=setup();f.music.setSnapshot(legacy);f.music.start(.06);f.tick(.96);assert(f.starts.slice(4).every(t=>t===1.06));assert.equal(Music.timeline(legacy,4).length,4);
});

test('sidechain snapshots are independent and validated; only the active pulse accompaniment accepts kicks',()=>{
 const original=Music.snapshot('pulse',124),saved=Music.cleanSnapshot(JSON.parse(JSON.stringify(original)));
 original.sidechain.depth=0;assert.equal(saved.sidechain.depth,.95);
 for(const sidechain of [null,{...saved.sidechain,depth:1},{...saved.sidechain,attack:NaN},{...saved.sidechain,releaseBeats:-1}])assert.throws(()=>Music.cleanSnapshot({...saved,sidechain}));
 const f=setup();f.music.setEnemy('pulse',124);assert.equal(f.music.duckForKick(.2),false);
 f.music.start(.06,4);assert.equal(f.music.duckForKick(.2),true);assert.equal(f.music.duckForKick(4),false);assert.equal(f.music.duckForKick(.3,0),false);
 f.music.setMuted(true);assert.equal(f.music.duckForKick(.3),false);f.music.setMuted(false);
 f.music.stop();assert.equal(f.music.duckForKick(.3),false);
 f.music.setEnemy('stone',124);f.music.start(.06,4);assert.equal(f.music.duckForKick(.3),false);
 f.music.setSnapshot(saved);f.music.start(.06,4);assert.equal(f.music.duckForKick(.3),true);
});
