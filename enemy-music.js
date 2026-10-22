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
  ghost:{chords:['Cm9','Abmaj7','Ebmaj7','Gm7'],wave:'sine',harmonic:.3,cutoff:2000,resonance:.4,detune:7,attack:.09,decay:.18,sustain:.9,release:.32,level:1.05},
  crystal:{chords:['Abmaj7','Bbsus2','Gm7','Cm9'],wave:'triangle',harmonic:.32,cutoff:3800,resonance:.6,detune:3,attack:.006,decay:.16,sustain:.62,release:.24,level:1.15},
  furnace:{chords:['Fm7','Abmaj7','Cmadd9','Gm7'],wave:'triangle',harmonic:.2,cutoff:1700,resonance:1,detune:2,attack:.02,decay:.12,sustain:.7,release:.18,level:1.05},
  conductor:{chords:['Cm9','Fm7','Bbsus2','Gm7'],wave:'sine',harmonic:.35,cutoff:2800,resonance:.5,detune:4,attack:.035,decay:.15,sustain:.8,release:.25,level:1.1}
 };
 function progression(kind){return progressions[kind]??progressions.stone;}
 const hits=(beats,gates,velocities,delays=[])=>beats.map((beat,i)=>({beat,duration:Array.isArray(gates)?gates[i]:gates,velocity:Array.isArray(velocities)?velocities[i]:velocities,delay:delays[i]??0}));
 const rhythms={
  stone:{name:'重い間と後ノリ',description:'長めの和音と休符。頭を残し、後続の和音を少し後ろに置く。',events:hits([0,2,4,6],[1.25,1,1.25,1],[1,.85,1,.85],[0,.03,0,.03])},
  fly:{name:'軽い一定の刻み',description:'一定の拍に軽い強弱を交互に置き、後半のアクセントを少し前へ。',events:hits([0,1,2,3,4,5,6,7],.32,[.85,.6,.85,.6,.85,.6,.85,.6],[0,-.018,0,-.018,0,-.018,0,-.018])},
  machine:{name:'裏拍の短い和音',description:'表拍を空け、裏拍で短く切るシンコペーション。',events:hits([.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5],.25,.9)},
  plant:{name:'跳ねと後半の加速',description:'前半は間を空け、後半は跳ねる刻みを増やす。',events:hits([0,2,4,5,6,6+2/3,7,7+2/3],[.5,.5,.35,.3,.25,.18,.22,.18],[.7,.7,.8,.85,.9,1,.95,1])},
  ghost:{name:'同じ揺れの再現',description:'同じ前後のズレを繰り返し、制御されたドランクの揺れを作る。',events:hits([0,1,2,3,4,5,6,7],.4,[.85,.7,.8,.75,.85,.7,.8,.75],[0,.025,-.018,.035,0,.025,-.018,.035])},
  crystal:{name:'一定の反復とポケット',description:'同じ強弱を繰り返し、交互の和音に小さな前後差を付ける。',events:hits([0,1,2,3,4,5,6,7],.4,[.85,.65,.85,.65,.85,.65,.85,.65],[0,.025,-.015,.025,0,.025,-.015,.025])},
  furnace:{name:'休符と跳ねる掛け合い',description:'短い呼び掛けと返答の間に休符を置き、裏の和音を跳ねさせる。',events:hits([0,2/3,2,3+2/3,4,4+2/3,6,7+2/3],.24,[.9,.65,.8,.65,.9,.65,.8,.65])},
  conductor:{name:'軸を残す変化と解放',description:'前半の軸を保ちながら後半を細かく変え、最後は休符で解放する。',events:hits([0,1,2,3,4,4.5,5,5.5,5.75,6],[.45,.4,.4,.35,.3,.25,.2,.15,.12,.35],[.65,.65,.7,.7,.75,.8,.85,.9,1,.8])}
 };
 function rhythm(kind){return rhythms[kind]??rhythms.stone;}
 const legacyRhythm=beats=>({name:'2拍ごとの持続和音',description:'保存された従来の伴奏。',events:hits([0,beats,beats*2,beats*3],beats,1)});
 function cleanSnapshot(value){
  const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
  if(!value||value.version!==1||!finite(value.bpm,40,240)||!finite(value.chordBeats,.25,8)||!Array.isArray(value.chords)||value.chords.length!==4)throw Error('コード伴奏の設定が不正です。');
  const savedChords=value.chords.map(c=>{if(!c||typeof c.name!=='string'||!Array.isArray(c.notes)||!c.notes.length||c.notes.length>12||!c.notes.every(n=>Number.isInteger(n)&&finite(n,12,107)))throw Error('コードの音高が不正です。');return {name:c.name.slice(0,32),notes:[...c.notes]};});
  const t=value.tone,tone={};if(!t||!['sine','triangle','sawtooth','square'].includes(t.wave))throw Error('コード音色が不正です。');tone.wave=t.wave;
  for(const [name,a,b] of [['cutoff',20,20000],['resonance',0,20],['detune',0,40],['attack',.001,5],['decay',.001,5],['sustain',0,1],['release',.01,5],['level',0,2],['harmonic',0,1]]){const n=name==='harmonic'?(t[name]??0):t[name];if(!finite(n,a,b))throw Error('コード音色の値が不正です。');tone[name]=n;}
  const result={version:1,bpm:value.bpm,chordBeats:value.chordBeats,chords:savedChords,tone};
  if(value.rhythm!==undefined){
   const r=value.rhythm,loop=value.chordBeats*4;
   if(!r||typeof r.name!=='string'||!Array.isArray(r.events)||!r.events.length||r.events.length>64)throw Error('コード伴奏のリズムが不正です。');
   let previous=-Infinity;
   const events=r.events.map(e=>{if(!e||!finite(e.beat,0,loop)||e.beat>=loop||!finite(e.duration,.01,loop)||!finite(e.velocity,.01,1)||!finite(e.delay,-.15,.15))throw Error('コード伴奏の発音が不正です。');
    const at=e.beat*60/value.bpm+e.delay;if(at<0||at>=loop*60/value.bpm||at<=previous)throw Error('コード伴奏の発音順序が不正です。');previous=at;return {beat:e.beat,duration:e.duration,velocity:e.velocity,delay:e.delay};});
   result.rhythm={name:r.name.slice(0,80),description:String(r.description??'').slice(0,240),events};
  }
  return result;
 }
 function snapshot(kind,bpm){const {chords:ids,...tone}=progression(kind);return cleanSnapshot({version:1,bpm,chordBeats,chords:ids.map(id=>chords[id]),tone,rhythm:rhythm(kind)});}
 function timeline(value,duration=value.chordBeats*4*60/value.bpm){
  if(!Number.isFinite(duration)||duration<=0||duration>120)throw Error('コード伴奏の長さが不正です。');
  const s=cleanSnapshot(value),beat=60/s.bpm,loop=s.chordBeats*4,events=s.rhythm?.events??legacyRhythm(s.chordBeats).events,notes=[];
  for(let cycle=0;cycle*loop*beat<duration;cycle++)for(const e of events){const t=(cycle*loop+e.beat)*beat+e.delay;if(t>=duration)continue;
   notes.push({type:'kick',t,rawT:t,duration:Math.min(e.duration*beat,duration-t),velocity:Math.max(1,Math.round(80*e.velocity)),pitches:[...s.chords[Math.floor(e.beat/s.chordBeats)%4].notes]});
  }return notes;
 }
 function create(ctx,output=ctx.destination,options={}){
  const every=options.setInterval??setInterval,cancel=options.clearInterval??clearInterval;
  const bus=ctx.createGain();bus.gain.value=1;bus.connect(output);
  const active=new Set();let kind='stone',bpm=82,playing=false,muted=false,timer=null,origin=0,next=0,anchor=null,shown=-1,rotation=0,saved=null,sequenceEnd=Infinity;
  const chordAt=index=>saved?saved.chords[(rotation+index)%4]:chords[progression(kind).chords[(rotation+index)%4]];
  const chordSeconds=()=>(saved?.chordBeats??chordBeats)*60/bpm,pattern=()=>saved?(saved.rhythm??legacyRhythm(saved.chordBeats)):rhythm(kind);
  const event=index=>pattern().events[index%pattern().events.length];
  const at=index=>origin+Math.floor(index/pattern().events.length)*4*chordSeconds()+event(index).beat*60/bpm+event(index).delay;
  const chordIndex=index=>Math.floor(event(index).beat/(saved?.chordBeats??chordBeats));
  function play(index,start,length,velocity=1){
   const spec=saved?.tone??progression(kind),chord=chordAt(chordIndex(index));
   const filter=ctx.createBiquadFilter(),amp=ctx.createGain(),sources=[],blends=[];
   filter.type='lowpass';filter.frequency.value=spec.cutoff;filter.Q.value=spec.resonance;filter.connect(amp);amp.connect(bus);
   // A stronger sustained level keeps the chords present beneath live playing.
   const legacy=saved&&!saved.rhythm,attack=legacy?spec.attack:Math.min(spec.attack,length*.3),decay=legacy?spec.decay:Math.min(spec.decay,length*.3),release=legacy?spec.release:Math.min(spec.release,length*.4);
   const peak=.105*spec.level*velocity/Math.sqrt(chord.notes.length),sustain=spec.sustain,attackEnd=start+attack,decayEnd=attackEnd+decay,hold=Math.max(decayEnd,start+length-(legacy ? .04 : release)),end=hold+release;
   amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(peak,attackEnd);
   amp.gain.linearRampToValueAtTime(peak*sustain,decayEnd);amp.gain.setValueAtTime(peak*sustain,hold);amp.gain.linearRampToValueAtTime(0,end);
   const naturalEnd=end+.02;
   for(const [i,midi] of chord.notes.entries()){
    const osc=ctx.createOscillator();osc.type=spec.wave;osc.frequency.value=440*2**((midi-69)/12);osc.detune.value=(i%2?1:-1)*spec.detune;
    osc.connect(filter);osc.start(start);osc.stop(naturalEnd);sources.push(osc);
    if(spec.harmonic){const overtone=ctx.createOscillator(),blend=ctx.createGain();overtone.type='sine';overtone.frequency.value=osc.frequency.value*2;overtone.detune.value=-osc.detune.value/2;blend.gain.value=spec.harmonic;overtone.connect(blend);blend.connect(filter);overtone.start(start);overtone.stop(naturalEnd);sources.push(overtone);blends.push(blend);}
   }
   function valueAt(time){if(time<=start)return 0;if(time<attackEnd)return peak*(time-start)/attack;if(time<decayEnd)return peak*(1+(sustain-1)*(time-attackEnd)/decay);if(time<hold)return peak*sustain;return peak*sustain*Math.max(0,(end-time)/release);}
   let cut=Infinity;
   const handle={stop(time=ctx.currentTime){if(time>=cut||time>=naturalEnd)return;cut=time;const t=Math.max(start,time);amp.gain.cancelScheduledValues(t);amp.gain.setValueAtTime(valueAt(time),t);amp.gain.linearRampToValueAtTime(0,t+.025);for(const osc of sources)osc.stop(Math.min(naturalEnd,t+.03));}};
   active.add(handle);sources[0].onended=()=>{active.delete(handle);for(const osc of sources)osc.disconnect();for(const blend of blends)blend.disconnect();filter.disconnect();amp.disconnect();};
   return handle;
  }
  function stopVoices(time=ctx.currentTime){for(const voice of active)voice.stop(time);}
  function tick(){
   if(!playing||ctx.state!=='running')return;
   const now=ctx.currentTime;
   // Skip missed articulations after a delayed tab timer instead of a burst.
   if(at(next)<now-.15){next=Math.max(next,Math.floor((now-origin)/(4*chordSeconds()))*pattern().events.length);while(at(next)<now-.15)next++;}
   while(Math.min(at(next),anchor??Infinity)<Math.min(now+.12,sequenceEnd)-1e-9){
    if(anchor!==null&&at(next)>=anchor-1e-9){rotation=(rotation+Math.max(0,Math.ceil((anchor-origin)/chordSeconds()-1e-9)))%4;origin=anchor;anchor=null;next=0;shown=-1;}
    const start=at(next),from=Math.max(now,start),end=Math.min(start+event(next).duration*60/bpm,sequenceEnd,anchor??Infinity),length=end-from;
    if(!muted&&start>=now-.15&&length>0){const voice=play(next,from,length,event(next).velocity);if(anchor!==null)voice.stop(anchor);}
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
    else if(playing&&ctx.state==='running'&&ctx.currentTime+.01<sequenceEnd){
     if(ctx.currentTime<origin){next=0;tick();return;}
     let index=Math.max(0,Math.floor((ctx.currentTime-origin)/(4*chordSeconds()))*pattern().events.length);while(at(index+1)<=ctx.currentTime)index++;
     const start=ctx.currentTime+.01,end=Math.min(at(index)+event(index).duration*60/bpm,sequenceEnd);
     next=at(index)>ctx.currentTime?index:index+1;if(at(index)<=ctx.currentTime&&end>start)play(index,start,end-start,event(index).velocity);tick();
    }
   },
   get state(){const index=Math.max(0,Math.floor((ctx.currentTime-origin)/chordSeconds()));return {kind,bpm,playing,muted,origin,next,anchor,chordDuration:chordSeconds(),loopDuration:4*chordSeconds(),voices:active.size,chord:chordAt(index).name,rhythm:pattern().name};}
  };
  return api;
 }
 const api={chords,progressions,rhythms,rhythm,chordBeats,loopBeats,progression,create,snapshot,cleanSnapshot,timeline};root.EnemyMusic=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
