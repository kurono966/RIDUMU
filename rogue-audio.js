/* Run equipment DSP. Stable buses, deterministic tails, bounded feedback. */
(function(root){
 'use strict';
 const R=root.RogueRun??(typeof require==='function'?require('./roguelite.js'):null);
 function snapshot(items=[]){return items.filter(item=>R.byId(item.id)?.audio).map(item=>({id:item.id,rank:item.rank}));}
 function cleanInventory(items){
  if(!Array.isArray(items)||items.length>4)throw Error('音響機材の設定が不正です。');
  const seen=new Set();return items.map(item=>{if(!item||!R.byId(item.id)?.audio||![1,2].includes(item.rank)||seen.has(item.id))throw Error('音響機材が不正です。');seen.add(item.id);return {id:item.id,rank:item.rank};});
 }
 function tailSeconds(items=[],bpm=120){return Math.min(6,items.reduce((sum,item)=>{const type=R.byId(item.id)?.audio?.type;return sum+(type==='reverb'?(item.rank===2?2.8:2):type==='delay'?60/bpm*.75*5:['chorus','flanger'].includes(type)?.08:0);},0));}
 function create(ctx,partsOutput){
  const masterInput=ctx.createGain(),output=ctx.createGain(),parts={bass:ctx.createGain(),lead:ctx.createGain()};
  const inputs={master:masterInput,...parts};let nodes=[],lfos=[],key=null,inventory=[],tempo=120,isMuted=false;
  function gain(value=1){const n=ctx.createGain();n.gain.value=value;nodes.push(n);return n;}
  function track(n){nodes.push(n);return n;}
  function oscillator(rate,depth,param,at){const osc=ctx.createOscillator(),amount=gain(depth);osc.type='sine';osc.frequency.value=rate;osc.connect(amount);amount.connect(param);osc.start(at);lfos.push(osc);return osc;}
  function effect(input,item,bpm,at){
   const {type}=R.byId(item.id).audio,strong=item.rank===2,exit=gain(),wet=gain(),dry=gain();input.connect(dry);dry.connect(exit);wet.connect(exit);
   let mix=0;
   if(type==='distortion'){
    mix=strong?.3:.2;const shape=track(ctx.createWaveShaper()),drive=strong?5:3;
    shape.curve=Float32Array.from({length:4096},(_,i)=>Math.tanh(drive*(2*i/4095-1))/Math.tanh(drive));shape.oversample='2x';input.connect(shape);shape.connect(wet);wet.gain.value=mix*.65;
   }else if(type==='reverb'){
    mix=strong?.22:.14;const convolver=track(ctx.createConvolver()),seconds=strong?2.8:2,buffer=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*seconds),ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);let seed=9187+ch*3761;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=((seed/4294967296)*2-1)*Math.exp(-7*i/data.length);}}
    convolver.buffer=buffer;const low=track(ctx.createBiquadFilter()),high=track(ctx.createBiquadFilter());low.type='lowpass';low.frequency.value=5500;high.type='highpass';high.frequency.value=180;input.connect(high);high.connect(low);low.connect(convolver);convolver.connect(wet);
   }else if(['chorus','flanger','delay'].includes(type)){
    const delay=track(ctx.createDelay(2)),feedback=gain(type==='delay'?(strong?.36:.28):type==='flanger'?(strong?.38:.25):0);
    mix=type==='delay'?(strong?.24:.18):type==='chorus'?(strong?.32:.24):(strong?.38:.3);
    delay.delayTime.value=type==='delay'?60/bpm*.75:type==='chorus'?.02:.004;
    input.connect(delay);delay.connect(wet);delay.connect(feedback);feedback.connect(delay);
    if(type!=='delay')oscillator(type==='chorus'?(strong?.45:.3):.19,type==='chorus'?(strong?.006:.004):(strong?.003:.002),delay.delayTime,at);
   }else if(type==='wah'){
    mix=strong?.55:.4;const filter=track(ctx.createBiquadFilter());filter.type='bandpass';filter.frequency.value=600;filter.Q.value=strong?2.2:1.5;input.connect(filter);filter.connect(wet);oscillator(bpm/60*2,strong?1600:1100,filter.detune,at);
   }else if(type==='phaser'){
    mix=strong?.46:.33;let from=input;for(const frequency of [350,900,1600]){const filter=track(ctx.createBiquadFilter());filter.type='allpass';filter.frequency.value=frequency;filter.Q.value=.7;from.connect(filter);from=filter;oscillator(.16,strong?1000:650,filter.detune,at);}from.connect(wet);
   }else if(type==='tremolo'){
    mix=1;const amp=gain(1-(strong?.65:.45)/2);input.connect(amp);amp.connect(wet);oscillator(bpm/60*2,(strong?.65:.45)/2,amp.gain,at);
   }
   dry.gain.value=1-mix;if(type!=='distortion')wet.gain.value=mix;return exit;
  }
  function configure(items=[],bpm=120,resetAt=null){
   const next=cleanInventory(snapshot(items));if(!Number.isFinite(bpm)||bpm<40||bpm>240)throw Error('音響機材のBPMが不正です。');
   const nextKey=JSON.stringify([next,bpm]);if(nextKey===key&&resetAt===null)return false;
   for(const input of Object.values(inputs))input.disconnect();for(const osc of lfos){osc.stop();osc.disconnect();}for(const node of nodes)node.disconnect();nodes=[];lfos=[];
   key=nextKey;inventory=next;tempo=bpm;const at=Math.max(ctx.currentTime,resetAt??ctx.currentTime);
   for(const target of ['bass','lead','master']){let from=inputs[target];for(const item of next.filter(item=>R.byId(item.id).audio.target===target))from=effect(from,item,bpm,at);
    if(target==='master'&&next.some(item=>R.byId(item.id).audio.target==='master')){const limiter=track(ctx.createDynamicsCompressor());limiter.threshold.value=-4;limiter.knee.value=0;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.12;from.connect(limiter);from=limiter;}
    from.connect(target==='master'?output:partsOutput);
   }return true;
  }
  configure();return {masterInput,output,parts,configure,setMuted(value){isMuted=!!value;output.gain.setTargetAtTime(value?0:1,ctx.currentTime,.005);},get state(){return {gear:inventory.map(item=>({...item})),bpm:tempo,muted:isMuted,oscillators:lfos.length,tail:tailSeconds(inventory,tempo)};}};
 }
 const api={snapshot,cleanInventory,tailSeconds,create};root.RogueAudio=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
