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
 const progressions={
  stone:{chords:['Cm7','Abmaj7','Fm7','Gm7'],cutoff:1000,detune:1},
  fly:{chords:['Ebmaj7','Bbadd9','Cm7','Abmaj7'],cutoff:2300,detune:3},
  machine:{chords:['Cmadd9','Gm7','Abmaj7','Bbsus2'],cutoff:1500,detune:0},
  plant:{chords:['Fm7','Cm7','Abmaj7','Gm7'],cutoff:1200,detune:2},
  ghost:{chords:['Cm9','Abmaj7','Ebmaj7','Gm7'],cutoff:850,detune:4},
  crystal:{chords:['Abmaj7','Bbsus2','Gm7','Cm9'],cutoff:2000,detune:2}
 };
 function progression(kind){return progressions[kind]??progressions.stone;}
 function create(ctx,output=ctx.destination,options={}){
  const every=options.setInterval??setInterval,cancel=options.clearInterval??clearInterval;
  const bus=ctx.createGain();bus.gain.value=1;bus.connect(output);
  const active=new Set();let kind='stone',bpm=82,playing=false,muted=false,timer=null,origin=0,next=0,anchor=null,shown=-1,rotation=0;
  const bar=()=>240/bpm,at=index=>origin+index*bar();
  function play(index,start,length){
   const spec=progression(kind),chord=chords[spec.chords[(rotation+index)%spec.chords.length]];
   const filter=ctx.createBiquadFilter(),amp=ctx.createGain(),sources=[];
   filter.type='lowpass';filter.frequency.value=spec.cutoff;filter.Q.value=.5;filter.connect(amp);amp.connect(bus);
   // A stronger sustained level keeps the chords present beneath live playing.
   const peak=.105/Math.sqrt(chord.notes.length),sustain=.82,hold=start+Math.max(.04,length-.08),end=hold+.2;
   amp.gain.setValueAtTime(0,start);amp.gain.linearRampToValueAtTime(peak,start+.035);
   amp.gain.linearRampToValueAtTime(peak*sustain,start+.09);amp.gain.setValueAtTime(peak*sustain,Math.max(start+.09,hold));amp.gain.linearRampToValueAtTime(0,Math.max(start+.1,end));
   const naturalEnd=Math.max(start+.12,end+.02);
   for(const midi of chord.notes){
    const osc=ctx.createOscillator();osc.type='triangle';osc.frequency.value=440*2**((midi-69)/12);osc.detune.value=(sources.length%2?1:-1)*spec.detune;
    osc.connect(filter);osc.start(start);osc.stop(naturalEnd);sources.push(osc);
   }
   let cut=Infinity;
   const handle={stop(time=ctx.currentTime){if(time>=cut||time>=naturalEnd)return;cut=time;const t=Math.max(start,time);amp.gain.cancelScheduledValues(t);amp.gain.setValueAtTime(time<=start?0:peak*sustain,t);amp.gain.linearRampToValueAtTime(0,t+.025);for(const osc of sources)osc.stop(Math.min(naturalEnd,t+.03));}};
   active.add(handle);sources[0].onended=()=>{active.delete(handle);for(const osc of sources)osc.disconnect();filter.disconnect();amp.disconnect();};
   return handle;
  }
  function stopVoices(time=ctx.currentTime){for(const voice of active)voice.stop(time);}
  function tick(){
   if(!playing||ctx.state!=='running')return;
   const now=ctx.currentTime;
   // Skip missed bars after a delayed tab timer instead of creating a burst.
   if(at(next)<now-.15)next=Math.max(next,Math.floor((now-origin)/bar()));
   while(Math.min(at(next),anchor??Infinity)<now+.12){
    if(anchor!==null&&at(next)>=anchor-1e-9){rotation=(rotation+Math.max(0,Math.ceil((anchor-origin)/bar()-1e-9)))%4;origin=anchor;anchor=null;next=0;shown=-1;}
    const start=at(next),length=anchor===null?bar():Math.min(bar(),anchor-start);
    if(!muted&&start>=now-.15&&length>0){const voice=play(next,Math.max(now,start),length);if(anchor!==null)voice.stop(anchor);}
    next++;
   }
   if(now>=origin){const index=Math.floor((now-origin)/bar());if(index!==shown){shown=index;options.onChord?.(chords[progression(kind).chords[(rotation+index)%4]].name);}}
  }
  const api={
   setEnemy(nextKind,nextBpm){
    if(!Number.isFinite(nextBpm)||nextBpm<=0)throw Error('Invalid accompaniment tempo');
    if(kind===nextKind&&bpm===nextBpm)return;
    const resume=playing;api.stop();kind=nextKind;bpm=nextBpm;shown=-1;
    options.onChord?.(chords[progression(kind).chords[0]].name);if(resume)api.start();
   },
   start(start=ctx.currentTime+.06){if(playing)return;playing=true;origin=start;next=0;anchor=null;shown=-1;rotation=0;timer=every(tick,25);tick();},
   align(start){if(!Number.isFinite(start)||start<ctx.currentTime-.15)return;if(!playing){api.start(start);return;}if(Math.abs(origin-start)<1e-6)return;anchor=start;stopVoices(start);tick();},
   stop(){playing=false;if(timer!==null)cancel(timer);timer=null;anchor=null;stopVoices();},
   setMuted(value){
    value=!!value;if(value===muted)return;muted=value;
    bus.gain.setTargetAtTime(value?0:1,ctx.currentTime,.015);
    if(value)stopVoices();
    else if(playing&&ctx.state==='running'&&ctx.currentTime>=origin){const index=Math.floor((ctx.currentTime-origin)/bar());next=index+1;play(index,ctx.currentTime+.01,Math.max(.04,at(next)-ctx.currentTime));tick();}
   },
   get state(){const index=Math.max(0,Math.floor((ctx.currentTime-origin)/bar()));return {kind,bpm,playing,muted,origin,next,anchor,voices:active.size,chord:chords[progression(kind).chords[(rotation+index)%4]].name};}
  };
  return api;
 }
 const api={chords,progressions,progression,create};root.EnemyMusic=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
