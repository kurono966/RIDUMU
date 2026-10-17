const $=id=>document.getElementById(id);
const enemies=[
 {name:'苔岩の番人',kind:'stone',bpm:82,hp:150,description:'地に根を張る、分厚い岩のからだ。',attack:28},
 {name:'宙を舞う翼獣',kind:'fly',bpm:150,hp:135,description:'風の流れに乗り、軽やかに身をかわす。',attack:32},
 {name:'忘却の自律機',kind:'machine',bpm:120,hp:175,description:'古びた装甲の奥で、回路が明滅する。',attack:36},
 {name:'棘冠の喰らい花',kind:'plant',bpm:100,hp:165,description:'開いた花冠の陰で、棘の蔓が脈打つ。',attack:34},
 {name:'薄明の残響',kind:'ghost',bpm:72,hp:155,description:'輪郭がほどけ、影だけが遅れて揺れる。',attack:32},
 {name:'晶殻の甲虫',kind:'crystal',bpm:138,hp:190,description:'透明な装甲が、二つの響きを返す。',attack:40}
];
const elements={earth:['土','重震','#d4f77d'],wind:['風','風裂','#9adfd5'],fire:['火','烈火','#ffa26d'],lightning:['雷','雷走','#c6b0ff']};
const instruments=[
 {id:'drums',name:'DRUMS',labels:['KICK','SNARE'],hints:['深く、響かせる。','鋭く、切り込む。'],lanes:['K','S']},
 {id:'bass',name:'BASS',labels:['BASS · C','BASS · G'],hints:['長押しで低音を伸ばす。','長押しで五度を伸ばす。'],lanes:['C','G']},
 {id:'lead',name:'SYNTH LEAD',labels:['LEAD · C','LEAD · E♭'],hints:['長押しで主旋律を伸ばす。','長押しで短三度を伸ばす。'],lanes:['C','E♭']}
];
const instrumentForTurn=number=>instruments[(Math.max(1,number)-1)%instruments.length];
const melodyScale=[0,2,3,5,7,8,10],melodyNames=['C','D','E♭','F','G','A♭','B♭'],melodyKeys=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ'];
const fourNotePitches=[0,2,4,6],fourNoteKeys=['KeyA','KeyS','KeyK','KeyL'];
let noteMode='two';
const pitchNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const pitchSettings={bass:{},lead:{}};
function midiName(midi){return pitchNames[midi%12]+(Math.floor(midi/12)-1);}
function pitchSlots(mode=noteMode){return mode==='four'?fourNotePitches:mode==='seven'?[0,1,2,3,4,5,6]:[0,1];}
function defaultPitches(voice,mode){const base=voice==='bass'?36:60;return mode==='two'?[base,base+(voice==='bass'?7:3)]:pitchSlots(mode).map(slot=>base+melodyScale[slot]);}
function pitchesFor(voice,mode=noteMode){return pitchSettings[voice]?.[mode]??defaultPitches(voice,mode);}
function setKeyPitch(voice,mode,index,midi){
 if(!['ready','cleared','over'].includes(state)||!['bass','lead'].includes(voice)||!['two','four','seven'].includes(mode)||!Number.isInteger(index)||index<0||index>=pitchSlots(mode).length||!Number.isInteger(midi)||midi<12||midi>107)return false;
 const values=[...pitchesFor(voice,mode)];values[index]=midi;pitchSettings[voice][mode]=values;
 try{globalThis.localStorage?.setItem('ridumu-pitches-v1',JSON.stringify(pitchSettings));}catch{}
 updateInstrument();return true;
}
function inputMidi(type,pitch,voice=instrumentForTurn(turn).id){
 if(!['bass','lead'].includes(voice))return undefined;
 const index=melodicNotes()?pitchSlots().indexOf(pitch):(type==='kick'?0:1);
 return pitchesFor(voice)[Math.max(0,index)];
}
try{
 const stored=JSON.parse(globalThis.localStorage?.getItem('ridumu-pitches-v1')??'null');
 for(const voice of ['bass','lead'])for(const mode of ['two','four','seven']){
  const values=stored?.[voice]?.[mode];
  if(Array.isArray(values)&&values.length===pitchSlots(mode).length&&values.every(n=>Number.isInteger(n)&&n>=12&&n<=107))pitchSettings[voice][mode]=[...values];
 }
}catch{}

function sevenNotes(){return noteMode==='seven'&&instrumentForTurn(turn).id!=='drums';}
function melodicNotes(){return ['four','seven'].includes(noteMode)&&instrumentForTurn(turn).id!=='drums';}
function melodyGuide(){const voice=instrumentForTurn(turn).id,keys=noteMode==='four'?'4音：A S K L':'7音：A S D F G H J';return keys+(voice==='drums'?'':' / '+pitchesFor(voice).map(midiName).join(' '));}
function syncNoteMode(){
 const enabled=melodicNotes();
 document.querySelector('.console').classList.toggle('seven-notes',enabled);
 document.querySelector('.console').classList.toggle('four-notes',enabled&&noteMode==='four');
 for(let pitch=0;pitch<7;pitch++){
  const index=fourNotePitches.indexOf(pitch),pad=$('note'+pitch);
  pad.hidden=noteMode==='four'&&index<0;
  const voice=instrumentForTurn(turn).id;if(voice!=='drums'&&noteMode!=='two'&&!pad.hidden)pad.querySelector('b').textContent=midiName(pitchesFor(voice)[pitchSlots().indexOf(pitch)]);
  pad.querySelector('span').textContent=noteMode==='four'?(fourNoteKeys[index]?.slice(3)??''):melodyKeys[pitch].slice(3);
 }
 $('noteMode').disabled=!['ready','cleared','over'].includes(state);
 $('pitchSetup').disabled=$('noteMode').disabled;
 $('openHistory').disabled=$('noteMode').disabled;
 $('noteMode').title='ベース・リードの音数。4音：ASKL / 7音：ASDFGHJ / 長押し対応';
 $('melodyPads').setAttribute('aria-label',instrumentForTurn(turn).name+' / '+melodyGuide()+'、長押しで持続');
}
let lastInstrument='drums';
const tracks=new Map();
let lastMix=null;
let masterOutput=null;
let phase='parts',hatNotes=[],hatReady=false,lastHat=[],lastDuration=480/enemies[0].bpm,lastBpm=enemies[0].bpm,visualBeat=-1;
let quantizeMode='off',phaseQuantizeMode='off',phaseHatPlayback=[];
function syncQuantizeControl(){
 syncNoteMode();
 $('quantizeMode').disabled=!['ready','cleared','over'].includes(state);
 const mode=Quantize.modes.find(m=>m.id===quantizeMode);
 $('quantizeMode').title=mode.description;
}
function timing(){const bpm=enemies[stage].bpm,beat=60/bpm;return {bpm,beat,duration:beat*8,step:beat/4,slots:32};}
function prepareTracksForTurn(){
 // A new drum turn starts a fresh three-part phrase.
 if(instrumentForTurn(turn).id==='drums'){tracks.clear();hatNotes=[];hatReady=false;}
}
function saveTrack(voice,played){
 if(played.length)tracks.set(voice,played.map(n=>({...n})));
 else tracks.delete(voice);
 lastMix=Array.from(tracks,([voice,notes])=>({voice,notes:Quantize.render(notes,timing().bpm,timing().duration)}));
 if(hatNotes.length)lastMix.push({voice:'hat',notes:Quantize.render(hatNotes,timing().bpm,timing().duration)});
}
function backingTimeline(){
 const backing=Array.from(tracks,([voice,notes])=>({voice,notes})).filter(track=>track.voice!==instrumentForTurn(turn).id);
 if(hatNotes.length)backing.push({voice:'hat',notes:hatNotes});
 return Rhythm.mixTimeline(backing.map(track=>({...track,notes:Quantize.render(track.notes,timing().bpm,timing().duration)})),null,[],timing().duration);
}
function updateInstrument(){
 syncNoteMode();
 const instrument=instrumentForTurn(turn);
 $('instrument').textContent=instrument.name;
 ['kick','snare'].forEach((type,i)=>{
  const label=instrument.id==='drums'?instrument.labels[i]:instrument.name.replace('SYNTH ','')+' · '+midiName(pitchesFor(instrument.id,'two')[i]);
  $(type).querySelector('b').textContent=label;
  $(type).querySelector('small').textContent=instrument.id==='drums'?instrument.hints[i]:'長押しで音を伸ばす。';
  $(type).setAttribute('aria-label',`${i?'L':'A'}：${label}`);
 });
 document.querySelector('.kick-label').textContent=melodicNotes()?'LOW':instrument.id==='drums'?instrument.lanes[0]:midiName(pitchesFor(instrument.id,'two')[0]);
 document.querySelector('.snare-label').textContent=melodicNotes()?'HIGH':instrument.id==='drums'?instrument.lanes[1]:midiName(pitchesFor(instrument.id,'two')[1]);
}
let state='ready',stage=0,hp=100,enemyHp=150,turn=1,notes=[],last=[],started=0,ctx,muted=false,replayTimers=[],replaying=false,run=0;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const beatSeconds=()=>timing().beat;
let clockTimer=null;
let recordAudioAt=null;
// Accept the entire final count-in beat, including its rimshot.
const earlyInputGrace=()=>beatSeconds();
function clickSound(type,when,accent=false,volume=1){
 if(muted||!ctx)return;
 if(type==='hat'){sampleSound('hat',when,volume);return;}
 const gain=ctx.createGain(),filter=ctx.createBiquadFilter(),oscillator=ctx.createOscillator();
 gain.connect(masterOutput??ctx.destination);gain.gain.setValueAtTime((accent?.25:.18)*volume,when);
 gain.gain.exponentialRampToValueAtTime(.001,when+.055);
 oscillator.type='triangle';oscillator.frequency.setValueAtTime(accent?1850:1550,when);
 filter.type='bandpass';filter.frequency.value=1800;filter.Q.value=2;
 oscillator.connect(filter);filter.connect(gain);oscillator.start(when);oscillator.stop(when+.055);
}
function updatePhaseUI(){
 const isHat=phase==='hat';document.querySelector('.console').classList.toggle('hat-phase',isHat);
 $('phaseLabel').textContent=isHat?'1 / 2 · HI-HAT':'2 / 2 · '+instrumentForTurn(turn).name;
 $('hat').disabled=!isHat;
}
async function countIn(nextPhase='hat'){
 releaseAllInputs();
 phase=nextPhase;phaseQuantizeMode=quantizeMode;updatePhaseUI();
 phaseHatPlayback=phase==='parts'?Quantize.render(hatNotes,timing().bpm,timing().duration):[];
 state='countin';recordAudioAt=null;notes=[];
 syncQuantizeControl();
 $('start').disabled=true;$('replay').disabled=true;
 $('start').textContent='カウントイン…';$('timer').textContent=timing().duration.toFixed(2);
 $('hint').textContent=phase==='hat'?'最後のリムショットから、SPACE / HでHatを刻もう。':'自分のHatを聴いて、A / Lを重ねよう。';
 $('status').textContent='COUNT IN / 1 · 2 · 3 · 4';
 const token=++run;await ctx.resume();if(globalThis.DrumAudio)await globalThis.DrumAudio.ready;if(token!==run)return;
 const {beat,duration,bpm}=timing(),origin=ctx.currentTime+.06,recordAt=origin+4*beat;
 recordAudioAt=recordAt;started=performance.now()+(recordAt-ctx.currentTime)*1000;
 const backing=phase==='parts'?backingTimeline().events:[];
 const endAt=recordAt+Math.max(duration,...backing.map(event=>event.time+(event.duration??0)+.14));
 let backingIndex=0,countBeat=0;
 clearInterval(clockTimer);
 function tick(){
  if(token!==run){clearInterval(timer);return;}
  const now=ctx.currentTime;
  if(now>=recordAt+duration)releaseAllInputs(recordAt+duration);
  while(backingIndex<backing.length&&recordAt+backing[backingIndex].time<now+.1){
   const event=backing[backingIndex++],at=recordAt+event.time;
   if(at>=now)sound(event.type,at,event.voice,event.voice==='hat'?.85:.6,event.duration,event.pitch,event.midi);
  }
  const countLength=phase==='hat'?12:4;
  while(countBeat<countLength&&origin+countBeat*beat<now+.1){
   const at=origin+countBeat*beat;
   if(at>=now)clickSound('rim',at,countBeat%4===0);
   countBeat++;
  }
  visualBeat=((Math.floor((now-origin)/beat)%4)+4)%4;
  if(now<recordAt){$('status').textContent=`COUNT IN / ${Math.min(4,Math.max(1,Math.floor((now-origin)/beat)+1))} — 4`;}
  else if(state==='countin'){
   state='recording';$('start').textContent=phase==='hat'?'Hatを録音中…':'重ねて録音中…';
   $('status').textContent=phase==='hat'?'HI-HAT / 自分の基準を刻む':'KICK / SNARE · Hatに重ねる';
   $('hint').textContent=phase==='hat'?'SPACE / H またはHatパッド。少しずらしても、繰り返せばあなたのノリ。':(melodicNotes()?melodyGuide()+'。長押しで伸ばそう。':'A / L またはパッド。Hatの前・同時・後ろ、自由に重ねよう。');
   document.querySelector('.console').classList.add('recording');
  }
  if(now>=endAt){
   clearInterval(timer);clockTimer=null;visualBeat=-1;
   if(state==='recording'){
    if(phase==='hat'){hatReady=true;document.querySelector('.console').classList.remove('recording');countIn('parts');}
    else finish();
   }
  }
 }
 const timer=setInterval(tick,20);clockTimer=timer;tick();
}
function audio(){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();masterOutput=ctx.createDynamicsCompressor();masterOutput.threshold.value=-12;masterOutput.ratio.value=6;masterOutput.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume();}
const heldInputs=new Map(), pitchedVoices=new Set();
function pitchedSound(type,t,voice,volume=1,duration,pitch,midi){
 const bass=voice==='bass',frequency=Number.isInteger(midi)?440*2**((midi-69)/12):Number.isInteger(pitch)&&pitch>=0&&pitch<7?(bass?65.406:261.626)*2**(melodyScale[pitch]/12):bass?(type==='kick'?65.406:97.999):(type==='kick'?261.626:311.127);
 if(bass){const handle=BassAudio.get(ctx,masterOutput??ctx.destination).play(frequency,t,volume,duration);pitchedVoices.add(handle);handle.onended=()=>pitchedVoices.delete(handle);return handle;}
 const gain=ctx.createGain(),filter=ctx.createBiquadFilter(),level=.12*volume;
 gain.gain.setValueAtTime(.001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.001,level),t+.008);
 gain.gain.exponentialRampToValueAtTime(Math.max(.001,level*.65),t+.08);
 filter.type='lowpass';filter.Q.value=.8;
 filter.frequency.setValueAtTime(3600,t);
 filter.frequency.exponentialRampToValueAtTime(1800,t+.12);
 filter.connect(gain);gain.connect(masterOutput??ctx.destination);
 const oscillator=ctx.createOscillator(),harmony=ctx.createOscillator(),blend=ctx.createGain();
 oscillator.type='triangle';oscillator.frequency.setValueAtTime(frequency,t);oscillator.connect(filter);
 harmony.type='sine';harmony.frequency.setValueAtTime(frequency*2,t);blend.gain.value=.18;
 harmony.connect(blend);blend.connect(filter);oscillator.start(t);harmony.start(t);
 let releasedAt=Infinity;
 const handle={release(at=ctx.currentTime){
  at=Math.max(t+.009,at);if(at>=releasedAt)return;releasedAt=at;
  gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(Math.max(.001,level*.65),at);
  gain.gain.exponentialRampToValueAtTime(.001,at+.12);
  oscillator.stop(at+.14);harmony.stop(at+.14);
 }};
 oscillator.onended=()=>{pitchedVoices.delete(handle);gain.disconnect();filter.disconnect();};
 pitchedVoices.add(handle);
 if(duration!==Infinity)handle.release(t+Math.max(.025,duration??.17));
 return handle;
}
function releaseInput(source,at=ctx?.currentTime??0){
 const held=heldInputs.get(source);if(!held)return;
 if(held.note)held.note.duration=Math.max(.025,Math.min(at,recordAudioAt+timing().duration)-held.at);
 held.handle?.release(at);heldInputs.delete(source);
 if(held.pitch!==undefined&&![...heldInputs.values()].some(h=>h.pitch===held.pitch))$('note'+held.pitch).classList.remove('held');
 if(![...heldInputs.values()].some(h=>h.type===held.type))$(held.type).classList.remove('held');
}
function releaseAllInputs(at=ctx?.currentTime??0){for(const source of [...heldInputs.keys()])releaseInput(source,at);}
function playInput(type,source,note,pitch=note?.pitch){
 const voice=type==='hat'?'hat':instrumentForTurn(turn).id;
 const sustain=source!==undefined&&voice!=='hat'&&voice!=='drums';
 const midi=note?.midi??inputMidi(type,pitch,voice);
 const handle=sound(type,undefined,voice,1,sustain?Infinity:undefined,pitch,midi);
 if(sustain){heldInputs.set(source,{type,note,handle,pitch,at:ctx.currentTime});$(type).classList.add('held');if(pitch!==undefined)$('note'+pitch).classList.add('held');}
 flash(type);
}
// A separate, soft FM keyboard sound for the two defensive seventh chords.
const defenseChords={kick:{name:'Cm7',notes:[60,63,67,70]},snare:{name:'Fm7',notes:[65,68,72,75]}};
function chordSound(type,t,volume=1,pitches){
 const chord=pitches?{notes:pitches}:defenseChords[type];if(!chord)return;
 const gain=ctx.createGain(),peak=.085*volume;
 gain.connect(masterOutput??ctx.destination);gain.gain.setValueAtTime(.001,t);
 gain.gain.exponentialRampToValueAtTime(Math.max(.001,peak),t+.012);
 gain.gain.exponentialRampToValueAtTime(Math.max(.001,peak*.55),t+.12);
 const sources=[];
 for(const midi of chord.notes){
  const frequency=440*2**((midi-69)/12),carrier=ctx.createOscillator(),modulator=ctx.createOscillator(),depth=ctx.createGain();
  carrier.type='sine';carrier.frequency.setValueAtTime(frequency,t);
  modulator.type='sine';modulator.frequency.setValueAtTime(frequency*2,t);
  depth.gain.setValueAtTime(frequency*.55,t);depth.gain.exponentialRampToValueAtTime(1,t+.28);
  modulator.connect(depth);depth.connect(carrier.frequency);carrier.connect(gain);carrier.start(t);modulator.start(t);sources.push(carrier,modulator);
 }
 let releasedAt=Infinity;
 const handle={release(at=ctx.currentTime){at=Math.max(t+.013,at);if(at>=releasedAt)return;releasedAt=at;gain.gain.cancelScheduledValues(at);gain.gain.setValueAtTime(Math.max(.001,peak*.55),at);gain.gain.exponentialRampToValueAtTime(.001,at+.22);sources.forEach(source=>source.stop(at+.24));}};
 sources[0].onended=()=>{pitchedVoices.delete(handle);gain.disconnect();};pitchedVoices.add(handle);handle.release(t+.32);return handle;
}
function sampleSound(type,when,volume=1){
 const samples=globalThis.DrumAudio;if(!samples||muted)return;
 const play=()=>{
  if(muted)return false;
  const at=Math.max(ctx.currentTime,when??ctx.currentTime);
  const played=(samples.playVoice??samples.play)(ctx,type,at,volume,masterOutput??ctx.destination);
  if(played&&type==='kick')BassAudio.get(ctx,masterOutput??ctx.destination).duckForKick(at,volume);
  return played;
 };
 const played=play();if(!played)samples.ready.then(play);return played;
}
function sound(type,when,voice=instrumentForTurn(turn).id,volume=1,duration,pitch,midi,pitches){
 if(muted||!ctx)return;const t=when??ctx.currentTime;
 if(voice==='chord')return chordSound(type,t,volume,pitches);
 if(voice==='hat')return sampleSound('hat',t,volume);
 if(voice==='drums')return sampleSound(type,t,volume);
 return pitchedSound(type,t,voice,volume,duration,pitch,midi);
}
function flash(type){$(type).classList.add('active');setTimeout(()=>$(type).classList.remove('active'),90);}
function stopReplay(){globalThis.stopHistoryPlayback?.();if(replaying)for(const voice of pitchedVoices)voice.release();replayTimers.forEach(clearTimeout);replayTimers=[];replaying=false;$('replay').textContent='▶ リズムを再生';}
function input(type,source,pitch){
 if(state==='defense'){defenseInput(type,source);return;}
 if(source!==undefined&&heldInputs.has(source))return;
 audio();
 if(state==='ready'){playInput(type,source,undefined,pitch);return;}
 if((state!=='countin'&&state!=='recording')||recordAudioAt===null)return;
 if((phase==='hat')!==(type==='hat'))return;
 const rawT=ctx.currentTime-recordAudioAt;
 if(rawT < -earlyInputGrace()-1e-9 || rawT>=timing().duration)return;
 const target=type==='hat'?hatNotes:notes;
 // Every press is heard and stored unchanged; only playback copies are quantized.
 const event={type,t:Math.max(0,rawT),rawT,inputT:rawT,inputTimes:[rawT],quantize:phaseQuantizeMode};
 if(pitch!==undefined)event.pitch=pitch;
 const midi=inputMidi(type,pitch);if(midi!==undefined&&type!=='hat')event.midi=midi;
 target.push(event);
 playInput(type,source,event);
}
function handleKeyDown(e){
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
 if($('codexDialog').open||$('pitchDialog').open||$('historyDialog').open)return;
 if(state==='defense'){const type=e.code==='KeyA'?'kick':e.code==='KeyL'?'snare':null;if(type){e.preventDefault();input(type,'key:'+e.code);}return;}
 if(e.code==='Space'&&e.target?.tagName==='BUTTON'&&e.target.id!=='start'&&!(e.target.id==='hat'&&phase==='hat'))return;
 if((e.code==='KeyH'&&!(sevenNotes()&&(state==='ready'||phase==='parts')))||(e.code==='Space'&&phase==='hat'&&['countin','recording'].includes(state))){e.preventDefault();input('hat');return;}
 if(e.code==='Space'){
  e.preventDefault();
  if(['ready','cleared','over'].includes(state)&&!$('start').disabled)$('start').click();
  return;
 }
 const keyIndex=(noteMode==='four'?fourNoteKeys:melodyKeys).indexOf(e.code);
 const pitch=noteMode==='four'?fourNotePitches[keyIndex]:keyIndex;
 if(melodicNotes()&&keyIndex>=0){e.preventDefault();input(pitch<4?'kick':'snare','key:'+e.code,pitch);return;}
 if(melodicNotes())return;
 const type=e.code==='KeyA'?'kick':e.code==='KeyL'?'snare':null;
 if(type){e.preventDefault();input(type,'key:'+e.code);}
}
document.addEventListener('keydown',handleKeyDown);
document.addEventListener('keyup',e=>{defenseHeld.delete('key:'+e.code);releaseInput('key:'+e.code);});
['hat','kick','snare'].forEach(type=>{
 const pad=$(type);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture?.(e.pointerId);input(type,'pointer:'+e.pointerId);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{defenseHeld.delete('pointer:'+e.pointerId);releaseInput('pointer:'+e.pointerId);});
});
for(let pitch=0;pitch<7;pitch++){
 const pad=$('note'+pitch);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();if(!melodicNotes()||(noteMode==='four'&&!fourNotePitches.includes(pitch)))return;pad.setPointerCapture?.(e.pointerId);input(pitch<4?'kick':'snare','pointer:'+e.pointerId,pitch);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{defenseHeld.delete('pointer:'+e.pointerId);releaseInput('pointer:'+e.pointerId);});
}
$('noteMode').onchange=()=>{
 if(!['ready','cleared','over'].includes(state)){$('noteMode').value=noteMode;return;}
 releaseAllInputs();noteMode=['four','seven'].includes($('noteMode').value)?$('noteMode').value:'two';updateInstrument();
 $('hint').textContent=melodicNotes()?melodyGuide()+'。長押しで伸ばす。':'ベース・リードの音数を選択。ドラムはA / L。';
};
globalThis.addEventListener?.('blur',()=>{defenseHeld.clear();releaseAllInputs();});
function renderPitchEditor(){
 const voice=$('pitchVoice').value,mode=$('pitchMode').value,keys=mode==='two'?['A','L']:mode==='four'?['A','S','K','L']:['A','S','D','F','G','H','J'];
 $('pitchRows').replaceChildren();
 pitchesFor(voice,mode).forEach((midi,index)=>{
  const row=document.createElement('div');row.className='pitch-row';
  const label=document.createElement('label'),select=document.createElement('select'),preview=document.createElement('button');
  label.textContent=keys[index];select.id='pitch-choice-'+index;label.htmlFor=select.id;
  for(let value=12;value<=107;value++){const option=document.createElement('option');option.value=value;option.textContent=midiName(value);select.append(option);}
  select.value=midi;select.onchange=()=>setKeyPitch(voice,mode,index,Number(select.value));
  preview.type='button';preview.textContent='試聴';preview.onclick=()=>{audio();sound(index<keys.length/2?'kick':'snare',undefined,voice,.8,.35,undefined,pitchesFor(voice,mode)[index]);};
  row.append(label,select,preview);$('pitchRows').append(row);
 });
}
$('pitchSetup').onclick=()=>{
 if(!['ready','cleared','over'].includes(state))return;
 releaseAllInputs();stopReplay();$('pitchVoice').value=instrumentForTurn(turn).id==='lead'?'lead':'bass';$('pitchMode').value=noteMode;renderPitchEditor();$('pitchDialog').showModal();
};
$('pitchVoice').onchange=renderPitchEditor;$('pitchMode').onchange=renderPitchEditor;
$('closePitch').onclick=()=>{$('pitchDialog').close();};
$('resetPitch').onclick=()=>{const voice=$('pitchVoice').value,mode=$('pitchMode').value;defaultPitches(voice,mode).forEach((midi,index)=>setKeyPitch(voice,mode,index,midi));renderPitchEditor();};
$('sound').onclick=()=>{releaseAllInputs();for(const voice of pitchedVoices)voice.release();muted=!muted;$('sound').textContent=muted?'音 OFF':'音 ON';$('sound').setAttribute('aria-pressed',String(!muted));};
$('quantizeMode').onchange=()=>{
 if(!['ready','cleared','over'].includes(state)){$('quantizeMode').value=quantizeMode;return;}
 quantizeMode=$('quantizeMode').value;
 syncQuantizeControl();$('hint').textContent=Quantize.modes.find(m=>m.id===quantizeMode).description;
};
function update(){updateInstrument();renderDiscoveries();$('enemyBpm').textContent='BPM '+timing().bpm;$('bpmValue').textContent=timing().bpm;$('timer').textContent=timing().duration.toFixed(2);const enemy=enemies[stage];$('enemyName').textContent=enemy.name;$('enemyDesc').textContent=enemy.description;$('enemyHp').textContent=`${enemyHp} / ${enemy.hp}`;$('enemyBar').style.width=`${enemyHp/enemy.hp*100}%`;$('playerHp').textContent=`${hp} / 100`;$('playerBar').style.width=`${hp}%`;$('turn').textContent=`TURN ${String(turn).padStart(2,'0')}`;$('stage').textContent=`ENCOUNTER ${String(stage+1).padStart(2,'0')} / ${String(enemies.length).padStart(2,'0')}`;$('sector').textContent=stage+1;$('enemy').className=`creature ${enemy.kind}`;}
function needsHat(){return !hatReady||instrumentForTurn(turn).id==='drums';}
function ready(label='演奏開始 ↗'){
 state='ready';$('start').disabled=false;syncQuantizeControl();$('start').textContent=label;$('status').textContent='READY TO PLAY';
 const createHat=needsHat();
 $('phaseLabel').textContent=(createHat?'HAT → ':'録ったHAT → ')+instrumentForTurn(turn).name+(instrumentForTurn(turn).id==='lead'?' → コード防御':'');
 $('hint').textContent=melodicNotes()&&!createHat?'SPACEで開始 · '+melodyGuide()+'、長押しで伸ばす。':createHat?'SPACEで開始 → Hatを刻む → A / Lを重ねる。':'SPACEで開始 · 録ったHatにA / Lを重ねる。';
}
function startTurn(){prepareTracksForTurn();return countIn(hatReady?'parts':'hat');}
$('start').onclick=()=>{
 audio();stopReplay();
 if(state==='over'){tracks.clear();lastMix=null;hatNotes=[];hatReady=false;lastHat=[];stage=0;hp=100;turn=1;enemyHp=enemies[0].hp;$('result').hidden=true;update();}
 else if(state==='cleared'){stage++;enemyHp=enemies[stage].hp;hp=Math.min(100,hp+28);turn=1;update();}
 else if(state!=='ready')return;
 startTurn();
};
function sequence(a){$('sequence').replaceChildren();
 const hatRow=document.createElement('div');hatRow.className='seq-row hat-sequence';const hatLabel=document.createElement('label');hatLabel.textContent='H';hatRow.append(hatLabel);
 for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(lastHat.some(n=>Math.min(a.slots-1,Math.max(0,Math.round(n.t/a.step)))===i)?' on':'');cell.title=(i*a.step).toFixed(3)+'秒 / Hat';cell.dataset.type='hat';cell.dataset.q=i;hatRow.append(cell);}$('sequence').append(hatRow);
 ['kick','snare'].forEach(type=>{const row=document.createElement('div');row.className='seq-row';const label=document.createElement('label');label.textContent=last.some(n=>n.pitch!==undefined)?(type==='kick'?'LOW':'HIGH'):instruments.find(i=>i.id===lastInstrument).lanes[type==='kick'?0:1];row.append(label);for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(a.grid.some(n=>n.type===type&&n.q===i)?' on':'');if(last.some(n=>n.type===type&&n.duration>0&&i*a.step>n.t&&i*a.step<n.t+n.duration))cell.classList.add('sustain');cell.dataset.type=type;cell.dataset.q=i;const pitches=a.grid.filter(n=>n.type===type&&n.q===i&&n.pitch!==undefined).map(n=>n.midi!==undefined?midiName(n.midi):melodyNames[n.pitch]);cell.title=`${(i*a.step).toFixed(3)}秒${pitches.length?' / '+pitches.join('・'):''}`;if(pitches.length)cell.textContent=pitches.join('·');row.append(cell);}$('sequence').append(row);});}
let defenseBattle=null,defenseOrigin=0,defenseMessageAt=-Infinity,defenseChordNotes=[];
function rememberSequence(kind,mix=lastMix){
 const rawTracks=Array.from(tracks,([voice,notes])=>({voice,notes}));if(hatNotes.length)rawTracks.push({voice:'hat',notes:hatNotes});
 if(kind==='defense'&&defenseChordNotes.length)rawTracks.push({voice:'chord',notes:defenseChordNotes});
 globalThis.captureHistory?.({tracks:mix??[],rawTracks,bpm:lastBpm,duration:lastDuration,enemy:enemies[stage].name,turn,kind,title:kind==='defense'?'全パート＋コード防御':instruments.find(i=>i.id===lastInstrument).name+' / '+$('moveName').textContent});
}
const defenseHeld=new Set();
function defenseInput(type,source){
 if(!defenseBattle||!['kick','snare'].includes(type)||source!==undefined&&defenseHeld.has(source))return;
 if(source!==undefined)defenseHeld.add(source);
 const judged=Defense.press(defenseBattle,type,ctx.currentTime-defenseOrigin);
 const rawT=ctx.currentTime-defenseOrigin;defenseChordNotes.push({type,t:Math.max(0,rawT),rawT,duration:.32,pitches:[...defenseChords[type].notes]});
 sound(type,undefined,'chord',.9);flash(type);
 if(!judged)return;
 defenseMessageAt=ctx.currentTime;
 $('phaseLabel').textContent=judged.grade==='EMPTY'?'ノーツが判定ラインに来たら A / L':judged.grade+(judged.grade==='PERFECT'?' / 完全防御':judged.grade==='GOOD'?' / 大きく軽減':' / 軽減');
 if(judged.grade!=='EMPTY'){
  $('impact').style.color=judged.grade==='PERFECT'?'#d4f77d':'#9adfd5';$('impact').textContent=judged.grade;
  $('arena').classList.add('guard-flash');setTimeout(()=>$('arena').classList.remove('guard-flash'),160);
 }
}
async function defensePhase(damage){
 releaseAllInputs();stopReplay();defenseChordNotes=[];state='defense';syncQuantizeControl();$('replay').disabled=true;$('start').disabled=true;
 const consolePanel=document.querySelector('.console');consolePanel.classList.add('defending');
 $('instrument').textContent='CHORDS';$('status').textContent='CHORD DEFENSE / コードで防御';$('start').textContent='防御中…';
 $('hint').textContent='全パートにコードを重ねる。縦線で A＝Cm7 / L＝Fm7。';
 $('phaseLabel').textContent='4拍後に敵の攻撃 / A・Lで防御';
 $('scope').setAttribute('aria-label','敵の攻撃ノーツ。左の判定ラインに重なる時にAまたはLで防御');
 document.querySelector('.kick-label').textContent='A';document.querySelector('.snare-label').textContent='L';
 for(const [type,key] of [['kick','A'],['snare','L']]){$(type).querySelector('b').textContent=defenseChords[type].name+' 防御';$(type).querySelector('small').textContent='ノーツが縦線に重なったら押す';$(type).setAttribute('aria-label',key+'：'+defenseChords[type].name+'で防御');}
 await ctx.resume();
 defenseBattle=Defense.create(enemies[stage].kind,timing().bpm,turn,damage);
 const backing=Rhythm.mixTimeline(lastMix??[],null,[],lastDuration);
 // Keep the phrase's downbeat aligned with defense while preserving anticipated notes.
 defenseOrigin=ctx.currentTime+.06-backing.offset;defenseMessageAt=-Infinity;defenseHeld.clear();
 defenseBattle.duration=Math.max(defenseBattle.duration,...backing.events.map(event=>event.time+(event.duration??0)+.14));
 let backingIndex=0;
 return await new Promise(resolve=>{
  function tick(){
   const battle=defenseBattle,elapsed=ctx.currentTime-defenseOrigin;
   while(backingIndex<backing.events.length&&backing.events[backingIndex].time<=elapsed+.1){
    const event=backing.events[backingIndex++],at=defenseOrigin+event.time;
    if(at>=ctx.currentTime)sound(event.type,at,event.voice,event.voice==='hat'?.45:.5,event.duration,event.pitch,event.midi);
   }
   visualBeat=elapsed<0?-1:Math.floor(elapsed/battle.beat)%4;
   $('timer').textContent=Math.max(0,battle.duration-elapsed).toFixed(2);
   if(elapsed<battle.leadIn&&ctx.currentTime-defenseMessageAt>.4)$('phaseLabel').textContent='防御まで '+Math.min(4,Math.max(1,Math.ceil((battle.leadIn-elapsed)/battle.beat)))+'拍 / A・L';
   else if(ctx.currentTime-defenseMessageAt>.55){$('phaseLabel').textContent='CHORD DEFENSE / A＝Cm7・L＝Fm7';$('impact').textContent='';}
   for(const hit of Defense.advance(battle,elapsed)){
    hp=Math.max(0,hp-hit.damage);$('playerHp').textContent=hp+' / 100';$('playerBar').style.width=hp+'%';
    reactEnemy(hit.damage?'strike':'guard');
    if(hit.damage){$('impact').style.color='#efa568';$('impact').textContent='−'+hit.damage;defenseMessageAt=ctx.currentTime;}
    if(hit.event.grade==='MISS'){$('phaseLabel').textContent='MISS / 次のノーツを狙おう';defenseMessageAt=ctx.currentTime;}
   }
   if(elapsed>=battle.duration){
    clearInterval(timer);const report=Defense.summary(battle);rememberSequence('defense',[...(lastMix??[]),...(defenseChordNotes.length?[{voice:'chord',notes:defenseChordNotes}]:[])]);defenseBattle=null;defenseHeld.clear();visualBeat=-1;state='attack';consolePanel.classList.remove('defending');$('arena').classList.remove('guard-flash');$('impact').textContent='';
    updateInstrument();$('scope').setAttribute('aria-label','入力したリズムのタイムライン');$('replay').disabled=!lastMix?.length;
    resolve(report);
   }
  }
  const timer=setInterval(tick,16);tick();
 });
}
async function enemyCounter(a,report,result){
 $('status').textContent='ENEMY COUNTER';$('replay').disabled=true;await wait(450);
 let damage=enemies[stage].attack,effect='',reaction='strike';
 if(a.count&&a.element==='earth'){damage=Math.round(damage*(1-.35*a.effect));effect='岩の余韻で敵の攻撃を軽減。';}
 if(a.count&&a.element==='wind'&&Math.random()<.2+.35*a.effect){damage=0;effect='風に乗って反撃をかわした。';reaction='evaded';}
 if(a.count&&a.element==='lightning'&&Math.random()<.15+.35*a.effect){damage=0;effect='帯電した敵の反撃が止まった。';reaction='stun';}
 if(a.count&&a.element==='fire'){const burn=Math.round(3+7*a.effect);enemyHp=Math.max(0,enemyHp-burn);$('damage').textContent=result.total+burn;renderBreakdown(report,burn);reaction='burn';}
 update();reactEnemy(reaction,a.element);
 if(enemyHp>0&&damage>0){
  const guard=await defensePhase(damage),counts=guard.counts;
  const text=`防御：PERFECT ${counts.PERFECT} / GOOD ${counts.GOOD} / GUARD ${counts.GUARD} / MISS ${counts.MISS} — 被ダメージ ${guard.total} → ${guard.damage}`;
  $('summaryHint').textContent=text;$('detailHint').textContent=text;$('hint').textContent=effect||`${guard.prevented}ダメージを防いだ。次の演奏へ。`;
 }else{$('hint').textContent=effect||'炎の余熱で撃破。';$('summaryHint').textContent=effect||'炎の余熱で敵を倒した。';}
 $('replay').disabled=!lastMix?.length;
}
let enemyReactionTimer;
function reactEnemy(kind,element='earth'){
 const enemy=$('enemy');
 for(const name of ['hit','weak','dodge','stun','burn','strike','evaded','guard'])enemy.classList.remove('react-'+name);
 clearTimeout(enemyReactionTimer);void enemy.offsetWidth;
 enemy.style.setProperty?.('--impact-color',elements[element]?.[2]??'#d4f77d');enemy.classList.add('react-'+kind);
 enemyReactionTimer=setTimeout(()=>enemy.classList.remove('react-'+kind),kind==='stun'?750:kind==='burn'?650:380);
}
let attackPlayhead=null;
async function playbackAttack(result,color){
 const timeline=Rhythm.mixTimeline(lastMix??[{voice:lastInstrument,notes:last}],lastInstrument,result.damages,lastDuration);
 if(!timeline.events.length)return;
 await ctx.resume();
 $('status').textContent='RHYTHM ATTACK / 演奏を再生';
 $('hint').textContent='重ねたリズムを再生。今回のパートが攻撃になる。';
 $('damage').textContent='0';
 const origin=ctx.currentTime+.06;
 let scheduled=0,shown=0,total=0,flashTimer;
 await new Promise(resolve=>{
  function tick(){
   const elapsed=ctx.currentTime-origin;
   attackPlayhead=Math.max(0,elapsed+timeline.offset);visualBeat=Math.floor(attackPlayhead/(60/lastBpm))%4;
   while(scheduled<timeline.events.length&&timeline.events[scheduled].at<=elapsed+.1){
    const event=timeline.events[scheduled++];
    sound(event.type,Math.max(ctx.currentTime,origin+event.at),event.voice,event.voice===lastInstrument?1:.65,event.duration,event.pitch,event.midi);
   }
   while(shown<timeline.events.length&&timeline.events[shown].at<=elapsed){
    const event=timeline.events[shown++];
    if(event.voice!==lastInstrument)continue;
    flash(event.type);
    const damage=event.damages.reduce((a,b)=>a+b,0);
    if(event.damages.length){
     total+=damage;enemyHp=Math.max(0,enemyHp-damage);showHitFeedback(damage);
     $('damage').textContent=total;
     $('impact').style.color=color;$('impact').textContent=damage||'MISS';
     $('enemyHp').textContent=`${enemyHp} / ${enemies[stage].hp}`;
     $('enemyBar').style.width=`${enemyHp/enemies[stage].hp*100}%`;
    }
    clearTimeout(flashTimer);
    $('enemy').classList.remove('shake');void $('enemy').offsetWidth;
    if(event.damages.length)reactEnemy(damage?(activeReport?.weaknesses.length?'weak':'hit'):'dodge',Object.keys(elements).find(key=>elements[key][2]===color));
    $('arena').classList.add('hit-field');
    flashTimer=setTimeout(()=>{$('enemy').classList.remove('shake');$('arena').classList.remove('hit-field');$('impact').textContent='';clearHitFeedback();},240);
   }
   if(elapsed>=timeline.duration){
    clearInterval(timer);clearTimeout(flashTimer);attackPlayhead=null;visualBeat=-1;
    $('enemy').classList.remove('shake');$('arena').classList.remove('hit-field');
    $('impact').textContent='';clearHitFeedback();resolve();
   }
  }
  const timer=setInterval(tick,16);tick();
 });
}
async function finish(){
 releaseAllInputs();
 state='attack';document.querySelector('.console').classList.remove('recording');
 $('timer').textContent='0.00';lastDuration=timing().duration;lastBpm=timing().bpm;
 last=Quantize.render(notes,lastBpm,lastDuration);lastHat=Quantize.render(hatNotes,lastBpm,lastDuration);
 lastInstrument=instrumentForTurn(turn).id;saveTrack(lastInstrument,notes);
 $('lastInstrument').textContent=lastMix.map(track=>track.voice==='hat'?'HAT':instruments.find(i=>i.id===track.voice).name.replace('SYNTH ','')).join(' + ')||'SILENCE';
 const groove=Groove.analyzeRelations(notes,hatNotes,lastBpm,lastDuration);
 const a=Groove.enrich(Rhythm.analyze(last,lastDuration,lastBpm),groove),result=Rhythm.resolve(a,enemies[stage]);
 const report=CombatFeedback.explain(a,result,enemies[stage],lastInstrument);activeReport=report;
 $('lastQuantize').textContent='再生：'+Quantize.modes.find(m=>m.id===phaseQuantizeMode).name;
 const [name,prefix,color]=elements[a.element];
 $('result').hidden=false;$('element').textContent=a.count?`${name} / ${a.hits>1?'連撃':'一撃'}`:'静寂';$('element').style.color=color;
 $('moveName').textContent=a.count?prefix+(a.alternation>.7?'連環撃':a.hits>=4?'連打':a.weight>.65?'重撃':'撃'):'無音の余韻';
 $('damage').textContent='0';$('hitInfo').textContent=`${report.hitCount} HIT / ${a.count?a.hits:0} STRIKE`;
 renderReport(report);sequence(a);annotateSequence(a,report);rememberSequence('attack');
 $('replay').disabled=true;$('status').textContent='ATTACK';
 await playbackAttack(result,color);$('replay').disabled=!lastMix.length;
 await wait(250);$('impact').textContent='';if(enemyHp<=0){if(stage===enemies.length-1){state='over';$('status').textContent='ALL ENCOUNTERS CLEAR';$('hint').textContent=`${enemies.length}体の敵を撃破。あなたのリズムが道を開いた。`;$('start').textContent='もう一度遊ぶ ↗';}else{state='cleared';$('status').textContent='ENEMY DEFEATED';$('hint').textContent='撃破。次の敵へ進むとHPが28回復。';$('start').textContent='次の敵へ ↗';}$('start').disabled=false;syncQuantizeControl();return;}
 if(lastInstrument==='lead'){await enemyCounter(a,report,result);await wait(650);}else{$('hint').textContent=lastInstrument==='drums'?'次はベース。リードの後にコードで防御。':'次はリード。全パートを重ねた後にコードで防御。';await wait(200);}$('impact').textContent='';turn++;if(hp<=0){state='over';$('status').textContent='TRY ANOTHER RHYTHM';$('hint').textContent='力尽きた。リズムを変えて、もう一度。';$('start').disabled=false;syncQuantizeControl();$('start').textContent='再挑戦 ↗';}else if(enemyHp<=0){state=stage===enemies.length-1?'over':'cleared';$('status').textContent=stage===enemies.length-1?'ALL ENCOUNTERS CLEAR':'ENEMY DEFEATED';$('hint').textContent='炎の余熱で撃破。';$('start').disabled=false;syncQuantizeControl();$('start').textContent=stage===enemies.length-1?'もう一度遊ぶ ↗':'次の敵へ ↗';}else{update();ready();}}
$('replay').onclick=()=>{
 if(!['ready','cleared','over'].includes(state)||!lastMix?.length)return;
 audio();if(replaying){stopReplay();return;}
 replaying=true;$('replay').textContent='■ 再生を停止';
 const timeline=Rhythm.mixTimeline(lastMix,null,[],lastDuration);
 timeline.events.forEach(event=>replayTimers.push(setTimeout(()=>{
  sound(event.type,undefined,event.voice,.8,event.duration,event.pitch,event.midi);
  if(event.voice===lastInstrument)flash(event.type);
 },event.at*1000)));
 replayTimers.push(setTimeout(stopReplay,timeline.duration*1000));
};
function drawDefense(w,h){
 const battle=defenseBattle,elapsed=ctx.currentTime-defenseOrigin,line=24+(w-30)*.16,travel=Math.max(1,battle.beat*4),speed=(w-line-10)/travel;
 const laneY=type=>h*(type==='kick'?.3:.76);
 paint.strokeStyle='#444d3b';for(const type of ['kick','snare']){paint.beginPath();paint.moveTo(23,laneY(type));paint.lineTo(w,laneY(type));paint.stroke();}
 paint.fillStyle='#d4f77d22';paint.fillRect(line-Defense.windows.guard*speed,0,Defense.windows.guard*speed*2,h);
 paint.strokeStyle='#eff1e9';paint.lineWidth=2;paint.beginPath();paint.moveTo(line,0);paint.lineTo(line,h);paint.stroke();paint.lineWidth=1;
 for(const event of battle.events){
  if(event.settled)continue;const x=line+(event.at-elapsed)*speed;if(x<15||x>w+8)continue;
  paint.fillStyle=event.grade?'#eff1e9':event.type==='kick'?'#d4f77d':'#efa568';
  paint.beginPath();paint.arc(x,laneY(event.type),Math.min(6,h*.18),0,Math.PI*2);paint.fill();
 }
 document.querySelectorAll('#beatLights i').forEach((light,i)=>light.classList.toggle('on',i===visualBeat));
}
const canvas=$('scope'),paint=canvas.getContext('2d');
function draw(){
 const box=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
 if(canvas.width!==Math.round(box.width*ratio)||canvas.height!==Math.round(box.height*ratio)){canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);}
 paint.setTransform(ratio,0,0,ratio,0,0);const w=box.width,h=box.height;
 const duration=attackPlayhead!==null?lastDuration:timing().duration;
 paint.clearRect(0,0,w,h);
 if(state==='defense'&&defenseBattle){drawDefense(w,h);requestAnimationFrame(draw);return;}
 for(let i=0;i<=32;i++){const x=22+(w-24)*i/32;paint.strokeStyle=i%4===0?'#454e3a':'#2b3327';paint.beginPath();paint.moveTo(x,2);paint.lineTo(x,h-2);paint.stroke();}
 const displayNotes=['countin','recording'].includes(state)?(phase==='hat'?hatNotes:[...phaseHatPlayback,...notes]):[...lastHat,...last];
 for(const n of displayNotes){const x=22+(w-24)*n.t/duration;paint.fillStyle=n.type==='hat'?'#e5cb82':n.type==='kick'?'#d4f77d':'#efa568';const held=[...heldInputs.values()].find(v=>v.note===n);const gate=n.duration??(held?Math.min(ctx.currentTime,recordAudioAt+duration)-held.at:0);if(gate>0){paint.fillRect(x,h*(n.type==='hat'?.15:n.type==='kick'?.48:.8)-2,Math.min(w-x,(w-24)*gate/duration),4);}paint.beginPath();paint.arc(x,h*(n.type==='hat'?.15:n.type==='kick'?.48:.8),3,0,Math.PI*2);paint.fill();}
 if(state==='recording'||attackPlayhead!==null){
  const elapsed=attackPlayhead!==null?Math.min(duration,attackPlayhead):Math.max(0,Math.min(duration,ctx.currentTime-recordAudioAt));
  $('timer').textContent=Math.max(0,duration-elapsed).toFixed(2);paint.strokeStyle='#eff1e9';const x=22+(w-24)*elapsed/duration;paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,h);paint.stroke();
 }
 document.querySelectorAll('#beatLights i').forEach((light,i)=>light.classList.toggle('on',i===visualBeat));
 requestAnimationFrame(draw);
}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){defenseHeld.clear();releaseAllInputs();stopReplay();if(state==='recording')$('hint').textContent='演奏時間はタブを離れても進みます。';}});update();draw();
