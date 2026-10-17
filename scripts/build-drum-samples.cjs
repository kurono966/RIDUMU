// Embed the original WAV bytes so file:// playback needs no server or fetch.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const files={kick:'Clark Audio - Kick - 1990s.wav',snare:'Clark Audio - Snare - Cutoff.wav',hat:'Clark Audio - HiHat - Soft Dirt .wav'};
const samples=Object.fromEntries(Object.entries(files).map(([id,file])=>[id,{file,base64:fs.readFileSync(path.join(root,'assets',file)).toString('base64')}]));
fs.writeFileSync(path.join(root,'assets','drum-samples.js'),'/* Generated from assets WAV files by scripts/build-drum-samples.cjs. */\n(function(root){root.DrumSamples='+JSON.stringify(samples)+';})(typeof window!==\'undefined\'?window:globalThis);\n');
