const {test}=require('node:test'),assert=require('node:assert/strict'),Music=require('./enemy-music.js');
function setup(){
 const starts=[],frequencies=[],timers=new Map();let serial=0;
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
 const ctx={currentTime:0,state:'running',destination:{},createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:param(),Q:param(),connect(){},disconnect(){}}),createOscillator(){const frequency=param();return {frequency,detune:param(),connect(){},disconnect(){},start(t){starts.push(t);frequencies.push(frequency.value)},stop(){}}}};
 const music=Music.create(ctx,ctx.destination,{setInterval(fn){timers.set(++serial,fn);return serial},clearInterval(id){timers.delete(id)}});
 return {ctx,music,starts,frequencies,timers,tick(time){ctx.currentTime=time;for(const fn of [...timers.values()])fn();}};
}
test('each enemy has a distinct two-bar progression in the player key',()=>{
 assert.equal(Object.keys(Music.progressions).length,6);
 assert.equal(new Set(Object.values(Music.progressions).map(p=>p.chords.join(','))).size,6);
 for(const p of Object.values(Music.progressions))for(const id of p.chords){assert(Music.chords[id]);for(const n of Music.chords[id].notes)assert([0,2,3,5,7,8,10].includes(n%12));}
});

test('all enemy progressions loop on the same eight-beat boundary as a recorded part',()=>{
 for(const kind of Object.keys(Music.progressions))for(const bpm of [72,82,100,120,138,150,240]){
  const f=setup();f.music.setEnemy(kind,bpm);f.music.start(.06);
  assert.equal(f.music.state.loopDuration,480/bpm);assert.equal(f.music.state.chordDuration,120/bpm);
  for(let i=1;i<=4;i++)f.tick(.06+i*120/bpm-.03);
  const end=.06+480/bpm;assert(f.starts.some(t=>Math.abs(t-end)<1e-8));
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
 assert.equal(new Set(tones).size,6);
});
test('chords are polyphonic and scheduled from the audio clock at the enemy BPM',()=>{
 const f=setup();f.music.setEnemy('stone',120);f.music.start(.06);assert.equal(f.starts.length,4);
 assert(f.starts.every(t=>t===.06));assert.equal(new Set(f.frequencies).size,4);
 f.tick(.96);assert.equal(f.starts.length,8);assert(f.starts.slice(4).every(t=>t===1.06));
 f.music.start();assert.equal(f.timers.size,1);f.tick(4.02);assert.equal(f.music.state.chord,'Gm7');f.tick(4.07);assert.equal(f.music.state.chord,'Cm7');
});
test('aligning a future input downbeat works even between the old chord boundaries',()=>{
 const f=setup();f.music.setEnemy('stone',120);f.music.start(.06);f.music.align(1);
 f.tick(.9);assert(f.starts.some(t=>t===1));assert.equal(f.music.state.origin,1);
 f.tick(1.01);assert.equal(f.music.state.chord,'Abmaj7','alignment advances the progression instead of repeating its first chord');
 f.tick(1.9);assert(f.starts.some(t=>t===2));assert.equal(f.timers.size,1);
});
test('mute prevents new voices and unmute resumes the current chord without resetting the clock',()=>{
 const f=setup();f.music.start(.06);f.music.setMuted(true);const count=f.starts.length,origin=f.music.state.origin;
 f.tick(4);assert.equal(f.starts.length,count);f.music.setMuted(false);assert(f.starts.length>count);assert.equal(f.music.state.origin,origin);
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
