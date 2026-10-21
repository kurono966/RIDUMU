/* Per-part Web Audio voices; parameter and battle models live in synth.js. */
(function(root){
 const Synth=root.Synth??(typeof require==='function'?require('./synth.js'):null);
 const {waves,current,effectiveCutoff,envelopeChanged,at}=Synth;
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n)),engines=new WeakMap();
 function get(ctx,output=ctx.destination){
  if(engines.has(ctx))return engines.get(ctx);
  const bus=ctx.createDynamicsCompressor();bus.threshold.value=-18;bus.ratio.value=4;bus.knee.value=12;bus.connect(output);
  const bassDuck=ctx.createGain();bassDuck.gain.value=1;bassDuck.connect(bus);
  const active=new Set();
  const instance={play(voice,frequency,t,velocity=1,duration=.17,recorded){
   // Latest note wins within each part, at its scheduled audio time.
   let nextStart=Infinity;for(const previous of active){if(previous.voice!==voice)continue;if(previous.start<=t)previous.silenceAt(t);else nextStart=Math.min(nextStart,previous.start);}
   const initial=recorded?at(recorded.snapshot,recorded.noteTime):current(voice),filter=ctx.createBiquadFilter(),highpass=ctx.createBiquadFilter(),amp=ctx.createGain(),level=ctx.createGain(),monoGate=ctx.createGain();
   let p=initial.patch,released=Infinity,mutedAt=Infinity,stopAt=Infinity,segments=[];
   const peak=(voice==='bass'?.15:.12)*clamp(velocity,0,1),sources=[...waves,'harmonic'].map(wave=>{const osc=ctx.createOscillator(),blend=ctx.createGain();osc.type=wave==='harmonic'?'sine':wave;osc.frequency.setValueAtTime(frequency*(wave==='harmonic'?2:1),t);blend.gain.setValueAtTime(wave==='harmonic'?p.harmonic:wave===p.wave?1:0,t);osc.connect(blend);blend.connect(filter);osc.start(t);return {osc,blend,wave};});
   const expression=ctx.createGain(),body=ctx.createBiquadFilter();expression.gain.setValueAtTime(1,t);body.type='lowshelf';body.frequency.setValueAtTime(180,t);body.gain?.setValueAtTime(0,t);
   filter.type='lowpass';highpass.type='highpass';highpass.Q.value=.5;filter.connect(highpass);highpass.connect(amp);amp.connect(level);level.connect(monoGate);monoGate.connect(body);body.connect(expression);expression.connect(voice==='bass'?bassDuck:output);monoGate.gain.setValueAtTime(1,t);
   function envelopeValue(time){let prev={t,v:0};for(const point of segments){if(time<point.t){const span=point.t-prev.t;if(!span)return point.v;const f=clamp((time-prev.t)/span);return point.curve==='exponential'&&prev.v>0&&point.v>0?prev.v*Math.pow(point.v/prev.v,f):prev.v+(point.v-prev.v)*f;}prev=point;}return prev.v;}
   function point(time,value){const curve=p.curve==='exponential'&&value>0&&(segments.at(-1)?.v??0)>0?'exponential':'linear';segments.push({t:time,v:value,curve});if(curve==='exponential')amp.gain.exponentialRampToValueAtTime(value,time);else amp.gain.linearRampToValueAtTime(value,time);}
   const floor=p.curve==='exponential'?.001:0;amp.gain.setValueAtTime(floor,t);segments.push({t,v:floor});point(t+p.attack,peak);point(t+p.attack+p.decay,peak*p.sustain);
   function scheduleTone(e,time,age,initial=false){
    if(filter.frequency.cancelAndHoldAtTime)filter.frequency.cancelAndHoldAtTime(time);else filter.frequency.cancelScheduledValues(time);const value=effectiveCutoff(e.patch,e.pad,age);if(initial)filter.frequency.setValueAtTime(value,time);else filter.frequency.setTargetAtTime(value,time,.018);
    if(e.patch.toneDecay>age)filter.frequency.exponentialRampToValueAtTime(effectiveCutoff(e.patch,e.pad,e.patch.toneDecay),time+e.patch.toneDecay-age);
   }
   function apply(e,time){
    highpass.frequency.setTargetAtTime(e.pad.mode==='highpass'?30*Math.pow(Math.max(100,e.patch.cutoff)/30,e.pad.amount):0,time,.018);
    scheduleTone(e,time,time-t);filter.Q.setTargetAtTime(e.patch.resonance,time,.018);level.gain.setTargetAtTime(e.pad.volume,time,.018);
    for(const {blend,wave} of sources)blend.gain.setTargetAtTime(wave==='harmonic'?e.patch.harmonic:wave===e.patch.wave?1:0,time,.008);
    if(envelopeChanged(p,e.patch)){
     const value=envelopeValue(time);if(amp.gain.cancelAndHoldAtTime)amp.gain.cancelAndHoldAtTime(time);else amp.gain.cancelScheduledValues(time);amp.gain.setValueAtTime(value,time);segments=segments.filter(v=>v.t<time);segments.push({t:time,v:value});
     p=e.patch;const remaining=Math.max(0,e.patch.attack-(time-t));if(remaining)point(time+remaining,peak);point(time+remaining+e.patch.decay,peak*e.patch.sustain);
    }
    p=e.patch;
   }
   highpass.frequency.setValueAtTime(initial.pad.mode==='highpass'?30*Math.pow(Math.max(100,p.cutoff)/30,initial.pad.amount):0,t);
   scheduleTone(initial,t,0,true);filter.Q.setValueAtTime(p.resonance,t);level.gain.setValueAtTime(initial.pad.volume,t);
   const handle={voice,start:t,silenceAt(time){if(time>=mutedAt)return;mutedAt=time;monoGate.gain.cancelScheduledValues(time);monoGate.gain.setValueAtTime(1,Math.max(t,time-.003));monoGate.gain.linearRampToValueAtTime(0,time);stopAt=Math.min(stopAt,time+.025);sources.forEach(({osc})=>osc.stop(stopAt));},recorded:!!recorded,update(){if(released===Infinity&&ctx.currentTime<mutedAt&&!recorded)apply(current(voice),ctx.currentTime);},release(time=ctx.currentTime){time=Math.max(t+.003,time);if(time>=released)return;released=time;const value=envelopeValue(time);const releaseTime=p.release; if(amp.gain.cancelAndHoldAtTime)amp.gain.cancelAndHoldAtTime(time);else amp.gain.cancelScheduledValues(time);amp.gain.setValueAtTime(value,time);segments=segments.filter(v=>v.t<time);segments.push({t:time,v:value});point(time+releaseTime,p.curve==='exponential'?Math.min(.001,value):0);if(p.curve==='exponential')point(time+releaseTime+.02,0);stopAt=Math.min(stopAt,time+releaseTime+.025);sources.forEach(({osc})=>osc.stop(stopAt));}};
   handle.emphasize=(kind,strength,at=ctx.currentTime)=>{if(at>=mutedAt||at>=stopAt)return false;const start=Math.max(t,at),amount=clamp(strength);expression.gain.cancelScheduledValues(start);expression.gain.setValueAtTime(1,start);expression.gain.linearRampToValueAtTime(1+.06*amount,start+.008);expression.gain.linearRampToValueAtTime(1,start+.12);if(body.gain){body.gain.cancelScheduledValues(start);body.gain.setValueAtTime(0,start);body.gain.linearRampToValueAtTime(kind==='lock'?amount:0,start+.008);body.gain.linearRampToValueAtTime(0,start+.12);}return true;};
   handle.clearEmphasis=(at=ctx.currentTime)=>{expression.gain.cancelScheduledValues(at);expression.gain.setValueAtTime(1,at);body.gain?.cancelScheduledValues(at);body.gain?.setValueAtTime(0,at);};
   active.add(handle);sources[0].osc.onended=()=>{active.delete(handle);sources.forEach(({osc,blend})=>{osc.disconnect();blend.disconnect();});filter.disconnect();highpass.disconnect();amp.disconnect();level.disconnect();monoGate.disconnect();body.disconnect();expression.disconnect();handle.onended?.();};
   if(recorded){for(const e of recorded.snapshot.events){if(e.t<=recorded.noteTime)continue;const time=t+e.t-recorded.noteTime;if(duration!==Infinity&&time>t+duration)break;apply(e,time);}}
   if(duration!==Infinity)handle.release(t+Math.max(.025,duration??.17));if(nextStart!==Infinity)handle.silenceAt(nextStart);return handle;
  },duckForKick(time,volume=1){const at=Math.max(ctx.currentTime,time);if(bassDuck.gain.cancelAndHoldAtTime)bassDuck.gain.cancelAndHoldAtTime(at);else{bassDuck.gain.cancelScheduledValues(at);bassDuck.gain.setValueAtTime(1,at);}bassDuck.gain.linearRampToValueAtTime(1-.22*clamp(volume),at+.006);bassDuck.gain.linearRampToValueAtTime(1,at+.11);},update(voice){for(const h of active)if(h.voice===voice)h.update();}};
  Synth.subscribe(voice=>instance.update(voice));engines.set(ctx,instance);return instance;
 }
 const api={get};root.SynthAudio=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
