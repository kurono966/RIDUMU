/* Enemy-specific polyphonic accompaniment. No player notes or combat state. */
(function(root){
 'use strict';
 const chords={
  Cm7:{name:'Cm7',notes:[48,51,55,58]},Abmaj7:{name:'Abmaj7',notes:[48,51,55,56]},
  Fm7:{name:'Fm7',notes:[48,51,53,56]},Gm7:{name:'Gm7',notes:[50,53,55,58]},
  Ebmaj7:{name:'Ebmaj7',notes:[50,51,55,58]},Bbadd9:{name:'Bb(add9)',notes:[48,50,53,58]},
  Cmadd9:{name:'Cm(add9)',notes:[48,50,51,55]},Bbsus2:{name:'Bbsus2',notes:[48,53,58]},
  Cm9:{name:'Cm9',notes:[48,51,55,58,62]}
 };
 const chordBeats=2,loopBeats=8;
 const progressions={
  stone:{chords:['Cm7','Abmaj7','Fm7','Gm7'],wave:'triangle',cutoff:1100,resonance:.7,detune:1,attack:.025,decay:.08,sustain:.86,release:.16,level:1},
  fly:{chords:['Ebmaj7','Bbadd9','Cm7','Abmaj7'],wave:'sine',cutoff:3600,resonance:.5,detune:4,attack:.075,decay:.12,sustain:.82,release:.24,level:.85},
  machine:{chords:['Cmadd9','Gm7','Abmaj7','Bbsus2'],wave:'sawtooth',cutoff:1400,resonance:1.8,detune:0,attack:.008,decay:.055,sustain:.7,release:.09,level:1.3},
  plant:{chords:['Fm7','Cm7','Abmaj7','Gm7'],wave:'square',cutoff:950,resonance:1.2,detune:2,attack:.02,decay:.11,sustain:.73,release:.13,level:.72},
  ghost:{chords:['Cm9','Abmaj7','Ebmaj7','Gm7'],wave:'sine',cutoff:1400,resonance:.4,detune:7,attack:.15,decay:.18,sustain:.9,release:.32,level:.8},
  crystal:{chords:['Abmaj7','Bbsus2','Gm7','Cm9'],wave:'triangle',harmonic:.32,cutoff:3800,resonance:.6,detune:3,attack:.006,decay:.16,sustain:.62,release:.24,level:1.15}
 };
 function progression(kind){return progressions[kind]??progressions.stone;}
 function cleanSnapshot(value){
  const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  if(!value||value.version!==1||!finite(value.bpm,40,240)||!finite(value.chordBeats,.25,8)||!Array.isArray(value.chords)||value.chords.length!==4)throw Error('コード伴奏の設定が不正です。');
  const savedChords=value.chords.map(c=>{if(!c||typeof c.name!=='string'||!Array.isArray(c.notes)||!c.notes.length||c.notes.length>12||!c.notes.every(n=>Number.isInteger(n)&&finite(n,12,107)))throw Error('コードの音高が不正です。');return {name:c.name.slice(0,32),notes:[...c.notes]};});
  const t=value.tone,tone={};if(!t||!['sine','triangle','sawtooth','square'].includes(t.wave))throw Error('コード音色が不正です。');tone.wave=t.wave;
  for(const [name,a,b] of [['cutoff',20,20000],['resonance',0,20],['detune',0,40],['attack',.001,5],['decay',.001,5],['sustain',0,1],['release',.01,5],['level',0,2],['harmonic',0,1]]){const n=name==='harmonic'?(t[name]??0):t[name];if(!finite(n,a,b))throw Error('コード音色の値が不正です。');tone[name]=n;}
  return {version:1,bpm:value.bpm,chordBeats:value.chordBeats,chords:savedChords,tone};
 }
 function snapshot(kind,bpm){const {chords:ids,...tone}=progression(kind);return cleanSnapshot({version:1,bpm,chordBeats,chords:ids.map(id=>chords[id]),tone});}
 function create(ctx,output=ctx.destination,options={}){
  const every=options.setInterval??setInterval,cancel=options.clearInterval??clearInterval;
  const bus=ctx.createGain();bus.gain.value=1;bus.connect(output);
  const active=new Set();let kind='stone',bpm=82,playing=false,muted=false,timer=null,origin=0,next=0,anchor=null,shown=-1,rotation=0,saved=null,sequenceEnd=Infinity;
  const chordAt=index=>saved?saved.chords[(rotation+index)%4]:chords[progression(kind).chords[(rotation+index)%4]];
  const chordSeconds=()=>(saved?.chordBeats??chordBeats)*60/bpm,at=index=>origin+index*chordSeconds();
  function play(index,start,length){
   const spec=saved?.tone??progression(kind),chord=chordAt(index);
   const filter=ctx.createBiquadFilter(),amp=ctx.createGain(),sources=[],blends=[];
   filter.type='lowpass';filter.frequency.value=spec.cutoff;filter.Q.value=spec.resonance;filter.connect(amp);amp.connect(bus);
   // A stronger sustained level keeps the chords present beneath live playing.
   const peak=.105*spec.level/Math.sqrt(chord.notes.length),sustain=spec.sustain,attackEnd=start+spec.attack,decayEnd=attackEnd+spec.decay,hold=Math.max(decayEnd,start+length-.04),end=hold+spec.release;
   amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(peak,attackEnd);
   amp.gain.linearRampToValueAtTime(peak*sustain,decayEnd);amp.gain.setValueAtTime(peak*sustain,hold);amp.gain.linearRampToValueAtTime(0,end);
   const naturalEnd=end+.02;
   for(const [i,midi] of chord.notes.entries()){
    const osc=ctx.createOscillator();osc.type=spec.wave;osc.frequency.value=440*2**((midi-69)/12);osc.detune.value=(i%2?1:-1)*spec.detune;
    osc.connect(filter);osc.start(start);osc.stop(naturalEnd);sources.push(osc);
    if(spec.harmonic){const overtone=ctx.createOscillator(),blend=ctx.createGain();overtone.type='sine';overtone.frequency.value=osc.frequency.value*2;overtone.detune.value=-osc.detune.value/2;blend.gain.value=spec.harmonic;overtone.connect(blend);blend.connect(filter);overtone.start(start);overtone.stop(naturalEnd);sources.push(overtone);blends.push(blend);}
   }
   function valueAt(time){if(time<=start)return 0;if(time<attackEnd)return peak*(time-start)/spec.attack;if(time<decayEnd)return peak*(1+(sustain-1)*(time-attackEnd)/spec.decay);if(time<hold)return peak*sustain;return peak*sustain*Math.max(0,(end-time)/spec.release);}
   let cut=Infinity;
   const handle={stop(time=ctx.currentTime){if(time>=cut||time>=naturalEnd)return;cut=time;const t=Math.max(start,time);amp.gain.cancelScheduledValues(t);amp.gain.setValueAtTime(valueAt(time),t);amp.gain.linearRampToValueAtTime(0,t+.025);for(const osc of sources)osc.stop(Math.min(naturalEnd,t+.03));}};
   active.add(handle);sources[0].onended=()=>{active.delete(handle);for(const osc of sources)osc.disconnect();for(const blend of blends)blend.disconnect();filter.disconnect();amp.disconnect();};
   return handle;
  }
  function stopVoices(time=ctx.currentTime){for(const voice of active)voice.stop(time);}
  function tick(){
   if(!playing||ctx.state!=='running')return;
   const now=ctx.currentTime;
   // Skip missed chords after a delayed tab timer instead of creating a burst.
   if(at(next)<now-.15)next=Math.max(next,Math.floor((now-origin)/chordSeconds()));
   while(Math.min(at(next),anchor??Infinity)<now+.12&&at(next)<sequenceEnd-1e-9){
    if(anchor!==null&&at(next)>=anchor-1e-9){rotation=(rotation+Math.max(0,Math.ceil((anchor-origin)/chordSeconds()-1e-9)))%4;origin=anchor;anchor=null;next=0;shown=-1;}
    const start=at(next),length=anchor===null?chordSeconds():Math.min(chordSeconds(),anchor-start);
    if(!muted&&start>=now-.15&&length>0){const voice=play(next,Math.max(now,start),length);if(anchor!==null)voice.stop(anchor);}
    next++;
   }
   if(now>=origin){const index=Math.floor((now-origin)/chordSeconds());if(index!==shown){shown=index;options.onChord?.(chordAt(index).name);}}
  }
  const api={
   setEnemy(nextKind,nextBpm){
    if(!Number.isFinite(nextBpm)||nextBpm<=0)throw Error('Invalid accompaniment tempo');
    if(!saved&&kind===nextKind&&bpm===nextBpm)return;
    const resume=playing;api.stop();saved=null;kind=nextKind;bpm=nextBpm;shown=-1;
    options.onChord?.(chords[progression(kind).chords[0]].name);if(resume)api.start();
   },
   setSnapshot(value){const next=cleanSnapshot(value);api.stop();saved=next;kind='recorded';bpm=next.bpm;shown=-1;},
   start(start=ctx.currentTime+.06,end=Infinity){if(playing)return;playing=true;origin=start;sequenceEnd=end;next=0;anchor=null;shown=-1;rotation=0;timer=every(tick,25);tick();},
   align(start){if(!Number.isFinite(start)||start<ctx.currentTime-.15)return;if(!playing){api.start(start);return;}if(Math.abs(origin-start)<1e-6)return;anchor=start;stopVoices(start);tick();},
   stop(){playing=false;if(timer!==null)cancel(timer);timer=null;anchor=null;stopVoices();},
   setMuted(value){
    value=!!value;if(value===muted)return;muted=value;
    bus.gain.setTargetAtTime(value?0:1,ctx.currentTime,.015);
    if(value)stopVoices();
    else if(playing&&ctx.state==='running'&&ctx.currentTime>=origin&&ctx.currentTime+.01<sequenceEnd){const index=Math.floor((ctx.currentTime-origin)/chordSeconds());next=index+1;play(index,ctx.currentTime+.01,Math.max(.04,Math.min(at(next),sequenceEnd)-ctx.currentTime));tick();}
   },
   get state(){const index=Math.max(0,Math.floor((ctx.currentTime-origin)/chordSeconds()));return {kind,bpm,playing,muted,origin,next,anchor,chordDuration:chordSeconds(),loopDuration:4*chordSeconds(),voices:active.size,chord:chordAt(index).name};}
  };
  return api;
 }
 const api={chords,progressions,chordBeats,loopBeats,progression,create,snapshot,cleanSnapshot};root.EnemyMusic=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
