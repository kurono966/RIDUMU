/* Decode once before play; one BufferSource per hit preserves rapid overlaps. */
(function(root){
function create(samples,decoder){
 const buffers=new Map(),levels={kick:.85,snare:.65,hat:.3};
 let error=null;
 const ready=Promise.resolve().then(async()=>{
  if(!decoder)throw Error('Audio decoder unavailable');
  await Promise.all(['kick','snare','hat'].map(async type=>{
   const bytes=Uint8Array.from(atob(samples[type].base64),char=>char.charCodeAt(0));
   buffers.set(type,await decoder.decodeAudioData(bytes.buffer));
  }));
  return true;
 }).catch(reason=>{error=reason;return false;});
 function playVoice(ctx,type,when=ctx.currentTime,volume=1,output=ctx.destination){
  const buffer=buffers.get(type);if(!buffer||error)return false;
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
  gain.gain.setValueAtTime((levels[type]??1)*volume,Math.max(ctx.currentTime,when));
  source.connect(gain);gain.connect(output);
  let ended=false;source.onended=()=>{ended=true;source.disconnect();gain.disconnect();};
  source.start(Math.max(ctx.currentTime,when));return {release(){if(ended)return;const at=ctx.currentTime;gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime((levels[type]??1)*volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.025);source.stop(at+.03);}};
 }
 const play=(...args)=>!!playVoice(...args);
 return {ready,play,playVoice,duration:type=>buffers.get(type)?.duration??0,get error(){return error;}};
}
if(typeof module!=='undefined')module.exports={create};
else{
 const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;
 root.DrumAudio=create(root.DrumSamples,Offline?new Offline(1,1,48000):null);
}
})(typeof window!=='undefined'?window:globalThis);
