/* Local sequence snapshots and Standard MIDI File export; no audio data in storage. */
(function(root){
if(!root.Synth&&typeof require==='function')root.Synth=require('./synth.js');
if(!root.EnemyMusic&&typeof require==='function')root.EnemyMusic=require('./enemy-music.js');
const key='ridumu.sequence-history.v1',limit=50,voices=['drums','hat','bass','lead','chord'];
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
function cleanTracks(tracks){
 if(!Array.isArray(tracks)||tracks.length>8)throw Error('パート数が不正です。');
 let count=0;
 return tracks.map(track=>{
  if(!voices.includes(track.voice)||!Array.isArray(track.notes))throw Error('パートが不正です。');
  const notes=track.notes.map(note=>{
   if(++count>4096||!['kick','snare','hat'].includes(note.type)||!finite(note.t,0,120))throw Error('ノートが不正です。');
   if((track.voice==='hat')!==(note.type==='hat'))throw Error('音種とパートが一致しません。');
   const n={type:note.type,t:note.t};
   for(const name of ['rawT','inputT'])if(note[name]!==undefined){if(!finite(note[name],-30,120))throw Error('入力時刻が不正です。');n[name]=note[name];}
   if(note.duration!==undefined){if(!finite(note.duration,.001,60))throw Error('音の長さが不正です。');n.duration=note.duration;}
   for(const name of ['midi','pitch'])if(note[name]!==undefined){if(!Number.isInteger(note[name])||!finite(note[name],0,name==='midi'?127:8))throw Error('音高が不正です。');n[name]=note[name];}
   if(note.pitches!==undefined){if(!Array.isArray(note.pitches)||!note.pitches.length||note.pitches.length>12||!note.pitches.every(p=>Number.isInteger(p)&&finite(p,0,127)))throw Error('コードの音高が不正です。');n.pitches=[...note.pitches];}
   if(typeof note.quantize==='string')n.quantize=note.quantize.slice(0,24);
   if(note.register!==undefined){if(!finite(note.register,0,1))throw Error('音域の位置が不正です。');n.register=note.register;}
   return n;
  });const result={voice:track.voice,notes};if(track.synth!==undefined){if(!['bass','lead'].includes(track.voice)||!root.Synth)throw Error('シンセパートが不正です。');result.synth=root.Synth.cleanSnapshot(track.synth,track.voice);}if(track.effects!==undefined)result.effects=cleanEffects(track.effects);return result;
 });
}
function cleanEffects(events){
 if(!Array.isArray(events)||events.length>8192)throw Error('エフェクト履歴が不正です。');let previous=-1;
 return events.map(e=>{if(!e||!finite(e.t,0,120)||e.t<previous||!finite(e.amount,0,1)||!finite(e.volume,0,1)||!['lowpass','highpass'].includes(e.mode))throw Error('エフェクト履歴が不正です。');previous=e.t;return {t:e.t,amount:e.amount,volume:e.volume,mode:e.mode};});
}
function validate(value){
 if(!value||value.version!==1||!finite(value.bpm,40,240)||!finite(value.duration,.1,120))throw Error('RIDUMUのシーケンスJSONを選んでください。');
 const tracks=cleanTracks(value.tracks);if(!tracks.some(t=>t.notes.length))throw Error('ノートがありません。');
 const entry={version:1,id:typeof value.id==='string'?value.id.slice(0,100):makeId(),createdAt:typeof value.createdAt==='string'&&!Number.isNaN(Date.parse(value.createdAt))?new Date(value.createdAt).toISOString():new Date().toISOString(),title:String(value.title??'演奏シーケンス').slice(0,100),enemy:String(value.enemy??'').slice(0,80),bpm:value.bpm,duration:value.duration,turn:Number.isInteger(value.turn)?value.turn:1,kind:value.kind==='defense'?'defense':'attack',tracks,rawTracks:value.rawTracks?cleanTracks(value.rawTracks):[]};
 if(value.accompaniment!==undefined){entry.accompaniment=root.EnemyMusic.cleanSnapshot(value.accompaniment);if(entry.accompaniment.bpm!==entry.bpm)throw Error('伴奏と演奏のテンポが一致しません。');}
 return entry;
}
function makeId(){return root.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
function snapshot(info){return validate({...info,version:1,id:makeId(),createdAt:new Date().toISOString()});}
function createStore(storage){
 let entries=[],persistent=!!storage;
 try{const data=JSON.parse(storage?.getItem(key)??'[]');if(Array.isArray(data))for(const item of data.slice(0,limit)){try{entries.push(validate(item));}catch{}}}catch{persistent=false;}
 function persist(){try{if(!storage)throw Error('unavailable');storage.setItem(key,JSON.stringify(entries));persistent=true;}catch{persistent=false;}}
 return {list:()=>entries.map(e=>validate(e)),get persistent(){return persistent;},add(value){const entry=validate(value);entries=[entry,...entries.filter(e=>e.id!==entry.id)].slice(0,limit);persist();return entry;},remove(id){entries=entries.filter(e=>e.id!==id);persist();}};
}
const text=s=>Array.from(new TextEncoder().encode(s));
const number=(n,size)=>Array.from({length:size},(_,i)=>(n>>>((size-i-1)*8))&255);
function vlq(n){const bytes=[n&127];while((n>>>=7)>0)bytes.unshift((n&127)|128);return bytes;}
function chunk(id,data){return [...text(id),...number(data.length,4),...data];}
function midi(value){
 const entry=validate(value),ppq=960,ticks=ppq*entry.bpm/60;
 const offset=Math.min(0,...entry.tracks.flatMap(t=>t.notes.map(n=>n.rawT??n.t)));
 const tick=t=>Math.max(0,Math.round((t-offset)*ticks));
 const phraseEnd=tick(entry.duration),tempo=Math.round(60000000/entry.bpm);
 const conductor=[0,255,81,3,...number(tempo,3),0,255,88,4,4,2,24,8,...vlq(phraseEnd),255,47,0];
 const tracks=[chunk('MTrk',conductor)];
 const settings={drums:[9,null,100],hat:[9,null,58],bass:[0,33,90],lead:[1,80,80],chord:[2,4,70]},scale=[0,2,3,5,7,8,10,12,14];
 const exportTracks=[...entry.tracks];
 if(entry.accompaniment){const music=entry.accompaniment,step=music.chordBeats*60/entry.bpm,notes=[];for(let t=0,i=0;t<entry.duration;t+=step,i++)notes.push({type:'kick',t,rawT:t,duration:Math.min(step,entry.duration-t),pitches:music.chords[i%4].notes});exportTracks.push({voice:'chord',notes,accompaniment:true});}
 for(const track of exportTracks){
  if(!track.notes.length)continue;
  const [channel,program,velocity]=track.accompaniment?[3,89,80]:settings[track.voice],name=text(track.accompaniment?'ACCOMPANIMENT':track.voice.toUpperCase()),events=[];
  const merged=new Map();
  for(const note of track.notes){
   const at=note.rawT??note.t,start=tick(at),gate=note.duration??(track.voice==='bass'?.15:track.voice==='lead'?.17:track.voice==='chord'?.32:.07);
   const pitches=track.voice==='drums'?[note.type==='kick'?36:38]:track.voice==='hat'?[42]:track.voice==='chord'?(note.pitches??(note.type==='kick'?[60,63,67,70]:[65,68,72,75])):[note.midi??((track.voice==='bass'?36:60)+(note.pitch!==undefined?scale[note.pitch]:note.type==='kick'?0:track.voice==='bass'?7:3))];
   for(const pitch of pitches){const id=start+':'+pitch,end=Math.max(start+1,tick(at+gate)),old=merged.get(id);merged.set(id,{start,pitch,end:Math.max(end,old?.end??0)});}
  }
  const notes=[...merged.values()].sort((a,b)=>a.start-b.start);
  for(let i=0;i<notes.length;i++){
   const n=notes[i],next=notes.slice(i+1).find(other=>other.pitch===n.pitch);
   const end=next?Math.min(n.end,next.start):n.end;
   events.push({at:n.start,order:1,data:[144|channel,n.pitch,velocity]},{at:end,order:0,data:[128|channel,n.pitch,0]});
  }
  events.sort((a,b)=>a.at-b.at||a.order-b.order);
  const data=[0,255,3,...vlq(name.length),...name];if(program!==null)data.push(0,192|channel,program);
  let previous=0;for(const event of events){data.push(...vlq(event.at-previous),...event.data);previous=event.at;}
  data.push(...vlq(Math.max(phraseEnd,previous)-previous),255,47,0);tracks.push(chunk('MTrk',data));
 }
 return new Uint8Array([...chunk('MThd',[0,1,...number(tracks.length,2),...number(ppq,2)]),...tracks.flat()]);
}
const api={snapshot,validate,createStore,midi,limit};root.SequenceHistory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
