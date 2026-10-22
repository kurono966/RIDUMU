// Embed the original WAV bytes so file:// playback needs no server or fetch.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
// Add another entry here to expose a new sound in the matching drum selector.
const files={kick:{type:'kick',name:'1990s',file:'Clark Audio - Kick - 1990s.wav'},kickOriginal:{type:'kick',name:'Original',file:'Clark Audio - Kick - Original.wav'},snare:{type:'snare',name:'Cutoff',file:'Clark Audio - Snare - Cutoff.wav'},hat:{type:'hat',name:'Soft Dirt',file:'Clark Audio - HiHat - Soft Dirt .wav'}};
const samples=Object.fromEntries(Object.entries(files).map(([id,sample])=>[id,{...sample,base64:fs.readFileSync(path.join(root,'assets',sample.file)).toString('base64')}]));
fs.writeFileSync(path.join(root,'assets','drum-samples.js'),'/* Generated from assets WAV files by scripts/build-drum-samples.cjs. */\n(function(root){root.DrumSamples='+JSON.stringify(samples)+';})(typeof window!==\'undefined\'?window:globalThis);\n');
