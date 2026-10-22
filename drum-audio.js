/* Decode once before play; one BufferSource per hit preserves rapid overlaps. */
(function(root){
function create(samples,decoder,storage){
 const buffers=new Map(),levels={kick:.85,snare:.65,hat:.3};
 const types=['kick','snare','hat'],selected=Object.fromEntries(types.map(type=>[type,type]));
 const list=type=>Object.entries(samples).filter(([id,s])=>(s.type??id)===type).map(([id,s])=>({id,name:s.name??id}));
 function select(type,id){if(!types.includes(type)||!list(type).some(s=>s.id===id))return false;selected[type]=id;try{storage?.setItem('ridumu-drum-sounds-v1',JSON.stringify(selected));}catch{}return true;}
 try{const saved=JSON.parse(storage?.getItem('ridumu-drum-sounds-v1')??'null');for(const type of types)if(list(type).some(s=>s.id===saved?.[type]))selected[type]=saved[type];}catch{}
 let error=null;
 const ready=Promise.resolve().then(async()=>{
  if(!decoder)throw Error('Audio decoder unavailable');
  await Promise.all(Object.entries(samples).map(async ([id,sample])=>{
   const bytes=Uint8Array.from(atob(sample.base64),char=>char.charCodeAt(0));
   buffers.set(id,await decoder.decodeAudioData(bytes.buffer));
  }));
  return true;
 }).catch(reason=>{error=reason;return false;});
 function playVoice(ctx,type,when=ctx.currentTime,volume=1,output=ctx.destination){
  const buffer=buffers.get(selected[type]);if(!buffer||error)return false;
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;
  gain.gain.setValueAtTime((levels[type]??1)*volume,Math.max(ctx.currentTime,when));
  source.connect(gain);gain.connect(output);
  let ended=false;source.onended=()=>{ended=true;source.disconnect();gain.disconnect();};
  source.start(Math.max(ctx.currentTime,when));return {release(){if(ended)return;const at=ctx.currentTime;gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime((levels[type]??1)*volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.025);source.stop(at+.03);}};
 }
 const play=(...args)=>!!playVoice(...args);
 return {ready,play,playVoice,list,select,selected:type=>selected[type],duration:type=>buffers.get(selected[type])?.duration??0,get error(){return error;}};
}
if(typeof module!=='undefined')module.exports={create};
else{
 const Offline=root.OfflineAudioContext||root.webkitOfflineAudioContext;
 let storage;try{storage=root.localStorage;}catch{}
 root.DrumAudio=create(root.DrumSamples,Offline?new Offline(1,1,48000):null,storage);
}
})(typeof window!=='undefined'?window:globalThis);
