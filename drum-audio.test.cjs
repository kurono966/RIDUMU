const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {create}=require('./drum-audio.js');
function samples(){const sandbox=vm.createContext({});vm.runInContext(fs.readFileSync('assets/drum-samples.js','utf8'),sandbox);return sandbox.DrumSamples;}
test('embedded drum samples are byte-for-byte copies of the original WAV assets',()=>{
 const library=samples();assert.deepEqual(Object.keys(library).sort(),['hat','kick','kickOriginal','snare']);
 for(const sample of Object.values(library))assert.ok(Buffer.from(sample.base64,'base64').equals(fs.readFileSync(path.join('assets',sample.file))),sample.file+' changed: run node scripts/build-drum-samples.cjs');
});
test('samples decode once and rapid hits keep separate sources with exact scheduled times',async()=>{
 let decodes=0;const audio=create(samples(),{async decodeAudioData(bytes){decodes++;return {bytes};}});
 const starts=[],levels=[],sources=[],output={};
 const ctx={currentTime:1,destination:{},createGain(){return {gain:{setValueAtTime(level){levels.push(level)}},connect(target){assert.equal(target,output)},disconnect(){}}},createBufferSource(){const source={connect(){},disconnect(){},start(at){starts.push(at)}};sources.push(source);return source;}};
 assert.equal(audio.play(ctx,'kick',2,.5,output),false);assert.equal(await audio.ready,true);assert.equal(decodes,4);
 for(const [type,time] of [['kick',2],['kick',2.05],['snare',2.1],['hat',2.15]])assert.equal(audio.play(ctx,type,time,.5,output),true);
 assert.deepEqual(starts,[2,2.05,2.1,2.15]);assert.equal(new Set(sources).size,4);assert.equal(sources[0].buffer,sources[1].buffer);assert.notEqual(sources[0].buffer,sources[2].buffer);assert.equal(decodes,4);assert.deepEqual(levels,[.425,.425,.325,.15]);
});
test('a decoder error is captured without an unhandled rejected preload',async()=>{
 const audio=create(samples(),{async decodeAudioData(){throw Error('bad WAV')}});assert.equal(await audio.ready,false);assert.match(audio.error.message,/bad WAV/);assert.equal(audio.play({currentTime:0},'kick'),false);
});

test('sound selection swaps subsequent hits, preserves ringing hits and survives reload',async()=>{
 let stored=null,decodes=0;
 const storage={getItem:()=>stored,setItem:(key,value)=>{stored=value;}},library=samples();
 const decoder={async decodeAudioData(bytes){return {id:++decodes,bytes};}};
 const audio=create(library,decoder,storage);await audio.ready;
 const sources=[],ctx={currentTime:0,destination:{},createGain:()=>({gain:{setValueAtTime(){}},connect(){},disconnect(){}}),createBufferSource(){const source={connect(){},start(){},disconnect(){}};sources.push(source);return source;}};
 assert.deepEqual(audio.list('kick').map(s=>s.name),['1990s','Original']);
 audio.play(ctx,'kick');assert.equal(audio.select('kick','kickOriginal'),true);audio.play(ctx,'kick');
 assert.notEqual(sources[0].buffer,sources[1].buffer);assert.equal(sources[0].buffer.id,1);
 assert.equal(audio.select('snare','kickOriginal'),false);assert.equal(audio.select('kick','missing'),false);
 assert.equal(audio.selected('kick'),'kickOriginal');assert.equal(decodes,4);
 const reloaded=create(library,decoder,storage);await reloaded.ready;assert.equal(reloaded.selected('kick'),'kickOriginal');
 library.snareNew={...library.snare,name:'New Snare'};
 const expanded=create(library,decoder,{getItem:()=>'{"kick":"deleted"}'});await expanded.ready;
 assert.equal(expanded.selected('kick'),'kick');assert.equal(expanded.select('snare','snareNew'),true);
 assert.equal(expanded.list('snare').length,2);
});
