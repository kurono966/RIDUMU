const {test}=require('node:test'),assert=require('node:assert/strict'),H=require('./sequence-history.js');
function entry(){return H.snapshot({bpm:120,duration:4,enemy:'テスト',title:'全パート',turn:3,tracks:[{voice:'drums',notes:[{type:'kick',t:0,rawT:-.03},{type:'snare',t:.5}]},{voice:'hat',notes:[{type:'hat',t:.25}]},{voice:'bass',notes:[{type:'kick',t:0,midi:36,duration:.75}]},{voice:'lead',notes:[{type:'snare',t:.5,midi:65,duration:.6}]},{voice:'chord',notes:[{type:'kick',t:2,duration:.32,pitches:[60,63,67,70]}]}],rawTracks:[{voice:'bass',notes:[{type:'kick',t:.012,inputT:.012,rawT:.012,midi:36,duration:.75,quantize:'just'}]}]});}
function parse(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tracks=[];assert.equal(Buffer.from(bytes.subarray(0,4)).toString(),'MThd');assert.equal(view.getUint16(8),1);const ppq=view.getUint16(12);let offset=14;
 while(offset<bytes.length){assert.equal(Buffer.from(bytes.subarray(offset,offset+4)).toString(),'MTrk');const end=offset+8+view.getUint32(offset+4);let i=offset+8,tick=0;const events=[];
  const vlq=()=>{let v=0,b;do{b=bytes[i++];v=v*128+(b&127)}while(b&128);return v;};
  while(i<end){tick+=vlq();const status=bytes[i++];if(status===255){const type=bytes[i++],len=vlq(),data=[...bytes.subarray(i,i+len)];i+=len;events.push({tick,status,type,data});}else{const size=(status&240)===192?1:2;events.push({tick,status,data:[...bytes.subarray(i,i+size)]});i+=size;}}
  assert.equal(i,end);assert.equal(events.at(-1).type,47);tracks.push(events);offset=end;
 }assert.equal(tracks.length,view.getUint16(10));return {ppq,tracks};
}
test('snapshots survive JSON and local storage while preserving raw input and copied pitches',()=>{
 const e=entry(),source=e.tracks;const saved=H.validate(JSON.parse(JSON.stringify(e)));source[2].notes[0].midi=90;assert.equal(saved.tracks[2].notes[0].midi,36);assert.equal(saved.rawTracks[0].notes[0].inputT,.012);
 let data;const storage={getItem:()=>data??null,setItem:(k,v)=>data=v};H.createStore(storage).add(saved);const reloaded=H.createStore(storage);assert.deepEqual(reloaded.list(),[saved]);assert.equal(reloaded.persistent,true);
});

test('recorded accompaniment survives JSON/storage without aliasing current enemy presets',()=>{
 const M=require('./enemy-music.js'),source=M.snapshot('stone',120),e=H.snapshot({...entry(),accompaniment:source});
 source.chords[0].notes[0]=90;source.tone.wave='square';
 const saved=H.validate(JSON.parse(JSON.stringify(e)));assert.equal(saved.accompaniment.chords[0].notes[0],48);assert.equal(saved.accompaniment.tone.wave,'triangle');
 let data;H.createStore({getItem:()=>null,setItem:(k,v)=>data=v}).add(saved);
 assert.deepEqual(H.createStore({getItem:()=>data,setItem(){}}).list()[0].accompaniment,saved.accompaniment);
 assert.equal(H.validate(entry()).accompaniment,undefined);
 assert.throws(()=>H.validate({...e,accompaniment:{...e.accompaniment,bpm:100}}));
 assert.throws(()=>H.validate({...e,accompaniment:{...e.accompaniment,tone:{...e.accompaniment.tone,level:Infinity}}}));
});

test('MIDI exports saved chord pitches on a dedicated channel at the original tempo',()=>{
 const M=require('./enemy-music.js'),e=H.snapshot({...entry(),accompaniment:M.snapshot('stone',120)}),parsed=parse(H.midi(e));
 assert.equal(parsed.tracks.length,7);const chords=parsed.tracks.at(-1).filter(n=>n.status===147);
 assert.deepEqual(chords.slice(0,4).map(n=>n.data[0]),[48,51,55,58]);assert.equal(chords[4].tick-chords[0].tick,1920);
});
test('history retains the latest 50 and removal persists without modifying returned snapshots',()=>{
 let data;const store=H.createStore({getItem:()=>null,setItem:(k,v)=>data=v});for(let i=0;i<55;i++)store.add({...entry(),id:String(i)});assert.equal(store.list().length,50);assert.equal(store.list()[0].id,'54');
 const copy=store.list();copy[0].tracks[0].notes[0].t=99;assert.equal(store.list()[0].tracks[0].notes[0].t,0);store.remove('54');assert.equal(JSON.parse(data)[0].id,'53');
});
test('storage failures retain usable in-memory history and bad imported timing is rejected',()=>{
 const store=H.createStore({getItem(){throw Error('denied')},setItem(){throw Error('full')}});store.add(entry());assert.equal(store.persistent,false);assert.equal(store.list().length,1);
 assert.throws(()=>H.validate({...entry(),bpm:0}));assert.throws(()=>H.validate({...entry(),tracks:[{voice:'bass',notes:[{type:'kick',t:Infinity}]}]}));
});
test('MIDI contains tempo and separate pitched and drum tracks with preserved timing and gates',()=>{
 const parsed=parse(H.midi(entry()));assert.equal(parsed.ppq,960);assert.equal(parsed.tracks.length,6);
 const tempo=parsed.tracks[0].find(e=>e.type===81);assert.deepEqual(tempo.data,[7,161,32]);
 const drum=parsed.tracks[1].filter(e=>e.status===153);assert.deepEqual(drum.map(n=>n.data[0]),[36,38]);assert.equal(drum[0].tick,0);assert.equal(drum[1].tick,1018);
 const bass=parsed.tracks[3],on=bass.find(n=>n.status===144),off=bass.find(n=>n.status===128);assert.equal(on.data[0],36);assert.equal(off.tick-on.tick,1440);
 const chord=parsed.tracks[5].filter(n=>n.status===146);assert.deepEqual(chord.map(n=>n.data[0]),[60,63,67,70]);
 assert.ok(parsed.tracks.every(t=>t.every(e=>Number.isInteger(e.tick)&&e.tick>=0)));
});
test('MIDI note-off precedes a repeated note-on and does not cut off later held notes',()=>{
 const e=entry();e.tracks=[{voice:'bass',notes:[{type:'kick',t:0,midi:36,duration:2},{type:'kick',t:.5,midi:36,duration:1}]}];const events=parse(H.midi(e)).tracks[1].filter(n=>(n.status&240)===128||(n.status&240)===144);
 assert.deepEqual(events.map(n=>[n.tick,n.status]),[[0,144],[960,128],[960,144],[2880,128]]);
});
