/* A shared, gently compressed sampler-style bass bus, before the existing master. */
(function(root){
const engines=new WeakMap();
function saturationCurve(){
 const curve=new Float32Array(4096);
 for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*1.5);}
 return curve;
}
function hold(param,at,fallback){
 if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(at);
 else{param.cancelScheduledValues(at);param.setValueAtTime(fallback,at);}
}
function get(ctx,output=ctx.destination){
 if(engines.has(ctx))return engines.get(ctx);
 const dc=ctx.createBiquadFilter(),drive=ctx.createWaveShaper(),tone=ctx.createBiquadFilter(),compressor=ctx.createDynamicsCompressor(),trim=ctx.createGain(),duck=ctx.createGain();
 dc.type='highpass';dc.frequency.value=22;dc.Q.value=.7;
 drive.curve=saturationCurve();drive.oversample='2x';
 tone.type='lowpass';tone.frequency.value=950;tone.Q.value=.55;
 compressor.threshold.value=-18;compressor.knee.value=10;compressor.ratio.value=2.8;
 compressor.attack.value=.022;compressor.release.value=.14;
 // Offset the compressor's automatic makeup gain rather than boosting loudness.
 trim.gain.value=.34;duck.gain.value=1;
 dc.connect(drive);drive.connect(tone);tone.connect(compressor);compressor.connect(trim);trim.connect(duck);duck.connect(output);
 function play(frequency,t,volume=1,duration){
  const envelope=ctx.createGain(),filter=ctx.createBiquadFilter(),peak=.24*volume,sustain=peak*.78;
  envelope.gain.setValueAtTime(.0001,t);envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,peak),t+.009);
  envelope.gain.exponentialRampToValueAtTime(Math.max(.0001,sustain),t+.085);
  filter.type='lowpass';filter.Q.value=.65;
  const ceiling=(ctx.sampleRate??48000)*.4;
  // Keep audible upper harmonics through the sustain, even when a phone cannot
  // reproduce the fundamental. A soft cutoff still avoids a bright synth buzz.
  filter.frequency.setValueAtTime(Math.min(ceiling,Math.max(650,frequency*6)),t);
  filter.frequency.exponentialRampToValueAtTime(Math.min(ceiling,Math.max(480,frequency*4.5)),t+.095);
  envelope.connect(filter);filter.connect(dc);
  const nodes=[],oscillators=[];
  // Redistribution, not a volume boost: the oscillator blend still sums to 1.
  // Quiet sine harmonics make the missing low fundamental perceptible on small
  // speakers; all share the same gate, so long holds retain their body.
  const partials=[['sine',.58,1],['triangle',.22,1],['sawtooth',.02,1],['sine',.085,2],['sine',.05,3],['sine',.03,4],['sine',.015,6]];
  for(const [type,amount,harmonic] of partials){
   const oscillator=ctx.createOscillator(),blend=ctx.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(Math.min(ceiling,frequency*harmonic),t);
   blend.gain.value=amount;oscillator.connect(blend);blend.connect(envelope);oscillator.start(t);nodes.push(blend);oscillators.push(oscillator);
  }
  let releasedAt=Infinity;
  const handle={release(at=ctx.currentTime){
   at=Math.max(t+.01,at);if(at>=releasedAt)return;releasedAt=at;
   const elapsed=at-t;
   const value=elapsed<.009?.0001*(Math.max(.0001,peak)/.0001)**(elapsed/.009):elapsed<.085?Math.max(.0001,peak)*(Math.max(.0001,sustain)/Math.max(.0001,peak))**((elapsed-.009)/.076):Math.max(.0001,sustain);
   hold(envelope.gain,at,value);envelope.gain.setValueAtTime(value,at);envelope.gain.exponentialRampToValueAtTime(.0001,at+.085);
   oscillators.forEach(oscillator=>oscillator.stop(at+.105));
  }};
  oscillators[0].onended=()=>{envelope.disconnect();filter.disconnect();nodes.forEach(node=>node.disconnect());oscillators.forEach(node=>node.disconnect());handle.onended?.();};
  if(duration!==Infinity)handle.release(t+Math.max(.025,duration??.15));
  return handle;
 }
 let previousKick=null;
 function duckForKick(at,volume=1){
  if(volume<=0)return;
  at=Math.max(ctx.currentTime,at);
  let from=1;
  if(previousKick&&at<previousKick.at+.11){const dt=Math.max(0,at-previousKick.at);from=dt<.006?previousKick.from+(previousKick.low-previousKick.from)*dt/.006:previousKick.low*(1/previousKick.low)**((dt-.006)/.104);}
  hold(duck.gain,at,from);duck.gain.setValueAtTime(from,at);
  previousKick={at,from,low:1-.22*Math.min(1,volume)};
  // Only a short, shallow dip for the kick transient; no long 808-style pumping.
  duck.gain.linearRampToValueAtTime(1-.22*Math.min(1,volume),at+.006);
  duck.gain.exponentialRampToValueAtTime(1,at+.11);
 }
 const engine={play,duckForKick};engines.set(ctx,engine);return engine;
}
const api={get};root.BassAudio=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
