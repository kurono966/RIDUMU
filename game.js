const $=id=>document.getElementById(id);
const enemies=[
 {name:'苔岩の番人',kind:'stone',bpm:82,hp:260,description:'地に根を張る、分厚い岩のからだ。',attack:88,gridSkill:{type:'poison',cells:3,turns:4,power:3}},
 {name:'宙を舞う翼獣',kind:'fly',bpm:150,hp:240,description:'風の流れに乗り、軽やかに身をかわす。',attack:96},
 {name:'忘却の自律機',kind:'machine',bpm:120,hp:300,description:'古びた装甲の奥で、回路が明滅する。',attack:104},
 {name:'棘冠の喰らい花',kind:'plant',bpm:100,hp:280,description:'開いた花冠の陰で、棘の蔓が脈打つ。',attack:96,gridSkill:{type:'poison',cells:5,turns:5,power:4}},
 {name:'薄明の残響',kind:'ghost',bpm:72,hp:270,description:'輪郭がほどけ、影だけが遅れて揺れる。',attack:100},
 {name:'晶殻の甲虫',kind:'crystal',bpm:138,hp:340,description:'透明な装甲が、二つの響きを返す。',attack:116}
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
 if(instrumentForTurn(turn).id==='drums'){tracks.clear();hatNotes=[];hatReady=false;cycleBass=null;cycleLead=null;cycleEnsemble=null;}
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
let state='ready',stage=0,hp=100,enemyHp=enemies[0].hp,turn=1,notes=[],last=[],started=0,ctx,muted=false,replayTimers=[],replaying=false,run=0;
const gridHazards=GridHazards.create(32);
let poisonFlashTimer,poisonToastTimer,gridSkillWave=0;
function renderGridHazards(){
 const hazards=gridHazards.active(turn).filter(h=>h.type==='poison');
 $('hazardBar').hidden=!hazards.length;
 const ended=['over','cleared'].includes(state)||enemyHp<=0||hp<=0;
 $('enemyIntent').hidden=ended;
 renderBattlePlan();
 const powers=[...new Set(hazards.map(h=>h.power))].sort((a,b)=>a-b);
 $('hazardStatus').textContent=hazards.length?`毒 −${powers.join('〜')} / 打 · 残${hazards.map(h=>h.remainingTurns).join('/')}T`:'';

}
function resetGridHazards(){gridHazards.reset();gridSkillWave=0;clearTimeout(poisonToastTimer);$('hazardToast').classList.remove('visible');renderGridHazards();}
function advanceGridHazards(){if(turn<gridHazards.turn)gridHazards.reset();gridHazards.advanceToTurn(turn);renderGridHazards();}
function castGridSkill(){
 const skill=enemies[stage].gridSkill;if(!skill||enemyHp<=0||hp<=0)return;
 const wave=gridSkillWave++,bases=[4,12,23,7,28];
 const cells=bases.slice(0,skill.cells).map(slot=>(slot+wave*5)%32);
 gridHazards.add({type:skill.type,slots:cells,turns:skill.turns,power:skill.power,fromTurn:turn+1,radiusSlots:.75,source:enemies[stage].name});
 $('hazardToast').textContent=`毒汚染！ ${cells.length}マス / 次の演奏から${skill.turns}ターン`;
 $('hazardToast').classList.add('visible');clearTimeout(poisonToastTimer);poisonToastTimer=setTimeout(()=>$('hazardToast').classList.remove('visible'),2400);
 reactEnemy('poison');renderGridHazards();
}
function poisonDefeat(){
 shield=0;cycleBass=null;cycleLead=null;cycleEnsemble=null;
 clearInterval(clockTimer);clockTimer=null;run++;releaseAllInputs();recordAudioAt=null;visualBeat=-1;state='over';
 document.querySelector('.console').classList.remove('recording');$('status').textContent='POISON / 演奏中断';$('hint').textContent='毒汚染で力尽きた。危険な位置を変えるか、ダメージを承知で次の一撃を狙おう。';
 $('start').disabled=false;$('start').textContent='再挑戦 ↗';syncQuantizeControl();resetGridHazards();
}
function applyInputHazards(result){
 const damage=result.effects.filter(effect=>effect.kind==='damage').reduce((sum,effect)=>sum+effect.amount,0);
 if(!damage)return;
 hp=Math.max(0,hp-damage);$('playerHp').textContent=hp+' / 100';$('playerBar').style.width=hp+'%';$('poisonDamage').textContent='毒 −'+damage+' HP';
 $('arena').classList.remove('poison-hit');void $('arena').offsetWidth;$('arena').classList.add('poison-hit');
 clearTimeout(poisonFlashTimer);poisonFlashTimer=setTimeout(()=>{$('arena').classList.remove('poison-hit');$('poisonDamage').textContent='';},350);
 if(hp<=0)poisonDefeat();
}
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
 $('phaseLabel').textContent=isHat?'1 / 2 · HI-HAT':instrumentForTurn(turn).name+' / '+({drums:'攻撃',bass:'シールド',lead:'支援'}[instrumentForTurn(turn).id]);
 $('hat').disabled=!isHat;
}
async function countIn(nextPhase='hat'){
 releaseAllInputs();
 phase=nextPhase;phaseQuantizeMode=quantizeMode;updatePhaseUI();
 phaseHatPlayback=phase==='parts'?Quantize.render(hatNotes,timing().bpm,timing().duration):[];
 state='countin';recordAudioAt=null;notes=[];renderGridHazards();
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
   $('status').textContent=phase==='hat'?'HI-HAT / 自分の基準を刻む':instrumentForTurn(turn).name+' · Hatに重ねる';
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
// Legacy saved performances can still replay their soft FM seventh chords.
const legacyChords={kick:{name:'Cm7',notes:[60,63,67,70]},snare:{name:'Fm7',notes:[65,68,72,75]}};
function chordSound(type,t,volume=1,pitches){
 const chord=pitches?{notes:pitches}:legacyChords[type];if(!chord)return;
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
 // Resolve interventions before dispatch, leaving room for future note-transform effects.
 const hazards=gridHazards.onInput({type,rawT,bpm:timing().bpm,voice:type==='hat'?'hat':instrumentForTurn(turn).id,note:{...event}});
 target.push(event);
 playInput(type,source,event);
 applyInputHazards(hazards);
}
function handleKeyDown(e){
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
 if($('codexDialog').open||$('pitchDialog').open||$('historyDialog').open||$('damageDialog').open)return;
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
document.addEventListener('keyup',e=>{releaseInput('key:'+e.code);});
['hat','kick','snare'].forEach(type=>{
 const pad=$(type);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture?.(e.pointerId);input(type,'pointer:'+e.pointerId);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{releaseInput('pointer:'+e.pointerId);});
});
for(let pitch=0;pitch<7;pitch++){
 const pad=$('note'+pitch);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();if(!melodicNotes()||(noteMode==='four'&&!fourNotePitches.includes(pitch)))return;pad.setPointerCapture?.(e.pointerId);input(pitch<4?'kick':'snare','pointer:'+e.pointerId,pitch);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{releaseInput('pointer:'+e.pointerId);});
}
$('noteMode').onchange=()=>{
 if(!['ready','cleared','over'].includes(state)){$('noteMode').value=noteMode;return;}
 releaseAllInputs();noteMode=['four','seven'].includes($('noteMode').value)?$('noteMode').value:'two';updateInstrument();
 $('hint').textContent=melodicNotes()?melodyGuide()+'。長押しで伸ばす。':'ベース・リードの音数を選択。ドラムはA / L。';
};
globalThis.addEventListener?.('blur',()=>{releaseAllInputs();});
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
function update(){updateInstrument();renderDiscoveries();$('enemyBpm').textContent='BPM '+timing().bpm;$('bpmValue').textContent=timing().bpm;$('timer').textContent=timing().duration.toFixed(2);const enemy=enemies[stage];$('enemyName').textContent=enemy.name;$('enemyDesc').textContent=enemy.description;$('enemyHp').textContent=`${enemyHp} / ${enemy.hp}`;$('enemyBar').style.width=`${enemyHp/enemy.hp*100}%`;$('playerHp').textContent=`${hp} / 100`;$('playerBar').style.width=`${hp}%`;$('turn').textContent=`TURN ${String(battleRound()).padStart(2,'0')}`;$('stage').textContent=`ENCOUNTER ${String(stage+1).padStart(2,'0')} / ${String(enemies.length).padStart(2,'0')}`;$('sector').textContent=stage+1;$('enemy').className=`creature ${enemy.kind}`;renderGridHazards();}
function needsHat(){return !hatReady||instrumentForTurn(turn).id==='drums';}
function ready(label='演奏開始 ↗'){
 state='ready';advanceGridHazards();$('start').disabled=false;syncQuantizeControl();$('start').textContent=label;$('status').textContent='READY TO PLAY';
 const createHat=needsHat();
 $('phaseLabel').textContent=(createHat?'HAT → ':'録ったHAT → ')+instrumentForTurn(turn).name+(instrumentForTurn(turn).id==='lead'?' → 戦闘':'');
 $('hint').textContent=melodicNotes()&&!createHat?'SPACEで開始 · '+melodyGuide()+'、長押しで伸ばす。':createHat?'SPACEで開始 → Hatを刻む → A / Lを重ねる。':'SPACEで開始 · 録ったHatにA / Lを重ねる。';
 $('hint').textContent+=' · '+({drums:'攻撃を構築',bass:'低音で盾を作る',lead:'旋律で支援 → 戦闘'}[instrumentForTurn(turn).id]);
 if(gridHazards.active().length)$('hint').textContent='SPACEで開始 · 紫の帯は毒。入力は可能。';
}
function startTurn(){advanceGridHazards();prepareTracksForTurn();return countIn(hatReady?'parts':'hat');}
$('start').onclick=()=>{
 audio();stopReplay();
 if(['over','cleared'].includes(state)){shield=0;cycleBass=null;cycleLead=null;cycleEnsemble=null;}
 if(state==='over'){resetGridHazards();tracks.clear();lastMix=null;hatNotes=[];hatReady=false;lastHat=[];stage=0;hp=100;turn=1;enemyHp=enemies[0].hp;$('result').hidden=true;update();}
 else if(state==='cleared'){resetGridHazards();stage++;enemyHp=enemies[stage].hp;hp=Math.min(100,hp+28);turn=1;update();}
 else if(state!=='ready')return;
 startTurn();
};
function sequence(a){$('sequence').replaceChildren();
 const hatRow=document.createElement('div');hatRow.className='seq-row hat-sequence';const hatLabel=document.createElement('label');hatLabel.textContent='H';hatRow.append(hatLabel);
 for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(lastHat.some(n=>Math.min(a.slots-1,Math.max(0,Math.round(n.t/a.step)))===i)?' on':'');cell.title=(i*a.step).toFixed(3)+'秒 / Hat';cell.dataset.type='hat';cell.dataset.q=i;hatRow.append(cell);}$('sequence').append(hatRow);
 ['kick','snare'].forEach(type=>{const row=document.createElement('div');row.className='seq-row';const label=document.createElement('label');label.textContent=last.some(n=>n.pitch!==undefined)?(type==='kick'?'LOW':'HIGH'):instruments.find(i=>i.id===lastInstrument).lanes[type==='kick'?0:1];row.append(label);for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(a.grid.some(n=>n.type===type&&n.q===i)?' on':'');if(last.some(n=>n.type===type&&n.duration>0&&i*a.step>n.t&&i*a.step<n.t+n.duration))cell.classList.add('sustain');cell.dataset.type=type;cell.dataset.q=i;const pitches=a.grid.filter(n=>n.type===type&&n.q===i&&n.pitch!==undefined).map(n=>n.midi!==undefined?midiName(n.midi):melodyNames[n.pitch]);cell.title=`${(i*a.step).toFixed(3)}秒${pitches.length?' / '+pitches.join('・'):''}`;if(pitches.length)cell.textContent=pitches.join('·');row.append(cell);}$('sequence').append(row);});}
let shield=0,cycleBass=null,cycleLead=null,cycleEnsemble=null;
const battleRound=()=>Math.floor((turn-1)/3)+1;
const currentZones=()=>GridEffects.create(battleRound(),stage);
const attackNames={stone:'岩腕の叩きつけ',fly:'翼の突進',machine:'電撃放射',plant:'毒棘の噴射',ghost:'残響の衝撃波',crystal:'晶殻の衝撃波'};
function renderBattlePlan(){
 $('shieldValue').textContent='盾 '+shield;
 const ended=['over','cleared'].includes(state)||enemyHp<=0||hp<=0;
 $('enemyIntent').hidden=ended;
 $('enemyIntent').textContent=ended?'':`予告：${attackNames[enemies[stage].kind]} / 威力 ${enemies[stage].attack}${enemies[stage].gridSkill?' ＋ 毒汚染':''} · LEAD後`;
 const names=currentZones().map(zone=>GridEffects.definitions.get(zone.type).label+'：'+zone.slots.map(q=>q+1).join('・')+'番');
 const hazards=gridHazards.active(turn).filter(h=>h.type==='poison');
 if(hazards.length)names.push(...hazards.map(h=>`毒：${h.slots.map(q=>q+1).join('・')}番 / −${h.power}HP / 残${h.remainingTurns}パート`));
 $('scope').title=names.join('\n');$('scope').setAttribute('aria-label','演奏シーケンサー。P＝攻撃、S＝盾、B＝支援。紫の帯は毒。'+names.join('。'));

}
function rememberSequence(kind,mix=lastMix){
 const rawTracks=Array.from(tracks,([voice,notes])=>({voice,notes}));if(hatNotes.length)rawTracks.push({voice:'hat',notes:hatNotes});
 globalThis.captureHistory?.({tracks:mix??[],rawTracks,bpm:lastBpm,duration:lastDuration,enemy:enemies[stage].name,turn:battleRound(),kind:'attack',title:instruments.find(i=>i.id===lastInstrument).name+' / '+$('moveName').textContent});
}
function enemyAttackSound(kind){
 if(muted||!ctx)return;
 const at=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
 osc.type=kind==='machine'?'sawtooth':'triangle';osc.frequency.setValueAtTime(kind==='fly'?480:kind==='machine'?740:160,at);osc.frequency.exponentialRampToValueAtTime(35,at+.38);
 filter.type='lowpass';filter.frequency.value=kind==='machine'?1500:700;gain.gain.setValueAtTime(.2,at);gain.gain.exponentialRampToValueAtTime(.001,at+.42);
 osc.connect(filter);filter.connect(gain);gain.connect(masterOutput??ctx.destination);osc.start(at);osc.stop(at+.45);
}
async function enemyCounter(a,report,result){
 state='enemyAttack';releaseAllInputs();$('replay').disabled=true;
 $('status').textContent='ENEMY / '+attackNames[enemies[stage].kind];$('hint').textContent='BassのシールドとLeadの支援で迎え撃つ。';
 $('enemy').classList.add('enemy-charge');await wait(550);$('enemy').classList.remove('enemy-charge');
 reactEnemy('strike');$('arena').dataset.attack=enemies[stage].kind;$('arena').classList.add('enemy-impact');enemyAttackSound(enemies[stage].kind);
 await wait(180);
 const reduction=Math.min(.55,(cycleLead?.weaken??0)+(cycleEnsemble?.bonus.resistance??0)+(a.count&&a.element==='earth'?.2*a.effect:0));
 const received=PerformanceCombat.receive(hp,shield,enemies[stage].attack,reduction);
 shield=received.shield;renderBattlePlan();
 $('impact').style.color='#8edcdd';$('impact').textContent=received.absorbed?'SHIELD −'+received.absorbed:'';
 if(received.absorbed){$('arena').classList.add('guard-flash');await wait(260);}
 hp=received.hp;update();$('impact').style.color='#ffa26d';$('impact').textContent=received.damage?'−'+received.damage+' HP':'BLOCK';
 const text=`敵の攻撃 ${received.incoming} → 盾で${received.absorbed}吸収 / HP −${received.damage}`;
 $('summaryHint').textContent=text;$('detailHint').textContent+=' / '+text;
 await wait(400);$('arena').classList.remove('enemy-impact','guard-flash');$('impact').textContent='';
 if(hp>0)castGridSkill();$('replay').disabled=!lastMix?.length;
}
let enemyReactionTimer;
function reactEnemy(kind,element='earth'){
 const enemy=$('enemy');
 for(const name of ['hit','weak','dodge','stun','burn','strike','evaded','guard','poison'])enemy.classList.remove('react-'+name);
 clearTimeout(enemyReactionTimer);void enemy.offsetWidth;
 enemy.style.setProperty?.('--impact-color',elements[element]?.[2]??'#d4f77d');enemy.classList.add('react-'+kind);
 enemyReactionTimer=setTimeout(()=>enemy.classList.remove('react-'+kind),kind==='stun'?750:kind==='burn'?650:380);
}
let attackPlayhead=null;
async function playbackAttack(result,color,attackVoice=lastInstrument){
 const timeline=Rhythm.mixTimeline(lastMix??[{voice:lastInstrument,notes:last}],attackVoice,result.damages,lastDuration);
 if(!timeline.events.length)return;
 await ctx.resume();
 $('status').textContent='RHYTHM ATTACK / 演奏を再生';
 $('hint').textContent='重ねたリズムを再生。Drumsが攻撃、Bassが盾、Leadが支援になる。';
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
    if(event.voice!==attackVoice)continue;
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
function completeBattle(){
 if(hp>0&&enemyHp>0)return false;
 resetGridHazards();shield=0;cycleBass=null;cycleLead=null;cycleEnsemble=null;
 state=hp<=0||stage===enemies.length-1?'over':'cleared';
 $('status').textContent=hp<=0?'TRY ANOTHER RHYTHM':state==='cleared'?'ENEMY DEFEATED':'ALL ENCOUNTERS CLEAR';
 $('hint').textContent=hp<=0?'力尽きた。次はBassの置き方や長さも変えてみよう。':'撃破。あなたの演奏が道を開いた。';
 $('start').textContent=hp<=0?'再挑戦 ↗':state==='cleared'?'次の敵へ ↗':'もう一度遊ぶ ↗';$('start').disabled=false;syncQuantizeControl();renderBattlePlan();return true;
}
function showRoleResult(title,factors,amount,label,a){
 renderEnsemble(null);activeReport=null;$('result').hidden=false;$('moveName').textContent=title;$('element').textContent=label;$('element').style.color='#8edcdd';
 $('damage').textContent=amount;$('damageLabel').textContent=label;$('hitInfo').textContent='';
 const report={factors:factors.slice(0,3).map(text=>({text})),hint:'3パートの演奏後、Drumsの攻撃と敵の反撃をまとめて再生。',breakdown:{},grooveText:''};
 renderReport(report);sequence(a);$('causeTracks').replaceChildren();$('breakdown').replaceChildren();
}
async function finish(){
 releaseAllInputs();state='attack';document.querySelector('.console').classList.remove('recording');
 $('timer').textContent='0.00';lastDuration=timing().duration;lastBpm=timing().bpm;
 last=Quantize.render(notes,lastBpm,lastDuration);lastHat=Quantize.render(hatNotes,lastBpm,lastDuration);
 lastInstrument=instrumentForTurn(turn).id;saveTrack(lastInstrument,notes);
 $('lastInstrument').textContent=lastMix.map(track=>track.voice.toUpperCase()).join(' + ')||'SILENCE';
 $('lastQuantize').textContent='再生：'+Quantize.modes.find(m=>m.id===phaseQuantizeMode).name;
 const zones=currentZones(),preview=Rhythm.analyze(last,lastDuration,lastBpm);
 if(lastInstrument==='bass'){
  cycleBass=PerformanceCombat.bass(notes,tracks.get('drums')??[],lastBpm,lastDuration,zones);
  const before=shield;shield=Math.min(90,shield+cycleBass.shield);renderBattlePlan();
  const causes=[`Bassの配置と長さ → シールド +${shield-before}`];
  if(cycleBass.locked)causes.push('KickとBassが重なった → シールド増加');
  if(cycleBass.zone)causes.push(`SHIELDゾーン ${cycleBass.zone}か所 → 追加シールド`);
  else if(cycleBass.repetition>.3)causes.push('同じBassの反復 → シールド効率上昇');
  showRoleResult('低音の防壁',causes,shield,'SHIELD',preview);rememberSequence('attack');
 }else if(lastInstrument==='drums'){
  const power=GridEffects.inspect(notes,'drums',zones,lastBpm).power??0;
  showRoleResult('攻撃パターンを構築',[`${preview.count}音のDrums → ${preview.count?preview.hits:0}段の攻撃を準備`,power?`POWERゾーン ${power}か所 → 攻撃強化`:'自由なリズムを記録。次はBassで盾を作ろう。'],0,'ATTACK READY',preview);rememberSequence('attack');
 }else{
  cycleEnsemble=Ensemble.analyze(tracks,lastBpm,lastDuration);
  cycleLead=Ensemble.support(PerformanceCombat.lead(notes,lastBpm,lastDuration,zones),cycleEnsemble);
  const bonus=Math.round((cycleBass?.shield??0)*(cycleLead.shieldEfficiency+cycleEnsemble.bonus.shieldEfficiency))+cycleEnsemble.bonus.shield;
  shield=Math.min(90,shield+bonus);renderBattlePlan();
  const drums=tracks.get('drums')??[],rendered=Quantize.render(drums,lastBpm,lastDuration);
  const groove=Groove.analyzeRelations(drums,hatNotes,lastBpm,lastDuration);
  const a=Ensemble.attack(PerformanceCombat.enhance(Groove.enrich(Rhythm.analyze(rendered,lastDuration,lastBpm),groove),drums,lastBpm,zones,cycleLead),cycleEnsemble);
  a.powerCells=zones.find(z=>z.type==='power').slots;
  const result=Rhythm.resolve(a,enemies[stage]),report=CombatFeedback.explain(a,result,enemies[stage],'drums');activeReport=report;
  const [name,prefix,color]=elements[a.element];$('result').hidden=false;$('element').textContent=a.count?name+' / DRUMS':'静寂';$('element').style.color=color;
  $('moveName').textContent=a.count?prefix+(a.hits>=4?'連打':a.weight>.65?'重撃':'撃'):'静寂の防陣';$('damage').textContent='0';$('damageLabel').textContent='TOTAL DAMAGE';$('hitInfo').textContent=`${report.hitCount} HIT / ${a.count?a.hits:0} STRIKE`;
  // Retain weak-point priority, then show the strongest chosen performance bonuses.
  const extras=[];if(a.powerHits)extras.push({id:'powerZone',source:'power-zone',tag:'POWER！',text:`POWER ${a.powerHits}か所 → Drumsの攻撃強化`,priority:2});
  if(notes.length)extras.push({id:'leadSupport',source:'lead-support',tag:'支援！',text:cycleLead.description+(cycleLead.zone?' / BOOSTで支援強化':''),priority:3});
  report.factors=[...report.factors.filter(f=>f.priority===1),...extras,...report.factors.filter(f=>f.priority!==1)].slice(0,3);
  report.hasSupport=notes.length>0;renderReport(report);renderEnsemble(cycleEnsemble,tracks,lastBpm);$('detailHint').textContent+=` / ${cycleLead.description} / Bassの盾 ${shield}（Lead追加 +${bonus}）`;
  // Show the actual attacking drum cells, while keeping all three recorded voices for replay.
  const leadLast=last;last=rendered;lastInstrument='drums';sequence(a);annotateSequence(a,report);last=leadLast;lastInstrument='lead';
  rememberSequence('attack');$('replay').disabled=true;await playbackAttack(result,color,'drums');
  if(completeBattle())return;
  await enemyCounter(a,report,result);if(completeBattle())return;
 }
 if(completeBattle())return;
 $('replay').disabled=!lastMix.length;turn++;advanceGridHazards();update();ready();
}
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
function drawGridHazards(w,h){
 for(const hazard of gridHazards.active(turn)){
  if(hazard.type!=='poison')continue;
  for(const slot of hazard.slots){
   const left=22+(w-24)*Math.max(0,slot-hazard.radiusSlots)/32,right=22+(w-24)*Math.min(32,slot+hazard.radiusSlots)/32;
   paint.fillStyle='#ae64d947';paint.fillRect(left,0,right-left,h);
   paint.strokeStyle='#d394ef';paint.beginPath();paint.moveTo(22+(w-24)*slot/32,0);paint.lineTo(22+(w-24)*slot/32,h);paint.stroke();
  }
 }
}
const canvas=$('scope'),paint=canvas.getContext('2d');
function draw(){
 const box=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio||1;
 if(canvas.width!==Math.round(box.width*ratio)||canvas.height!==Math.round(box.height*ratio)){canvas.width=Math.round(box.width*ratio);canvas.height=Math.round(box.height*ratio);}
 paint.setTransform(ratio,0,0,ratio,0,0);const w=box.width,h=box.height;
 const duration=attackPlayhead!==null?lastDuration:timing().duration;
 paint.clearRect(0,0,w,h);
 if(['ready','countin','recording'].includes(state)){
  for(const zone of currentZones()){
   const definition=GridEffects.definitions.get(zone.type),active=definition.role===instrumentForTurn(turn).id;
   for(const q of zone.slots){const x=22+(w-24)*q/32,cell=(w-24)/32;
    paint.fillStyle=definition.color+(active?'35':'14');paint.fillRect(x,0,cell,h);
    paint.fillStyle=definition.color;paint.fillRect(x,h-2,cell,2);
    if(active&&cell>=7){paint.font='8px Arial';paint.textAlign='center';paint.fillText(definition.label[0],x+cell/2,h-5);paint.textAlign='start';}
   }
  }
  drawGridHazards(w,h);
 }
 // Neutral line weights separate sixteenths, beats and bars from colored effects.
 for(let i=0;i<=32;i++){
  const x=22+(w-24)*i/32,bar=i%16===0,beat=i%4===0;
  paint.lineWidth=bar?3:beat?2:1;
  paint.strokeStyle=bar?'#d0d2cb':beat?'#90958b':'#363c32';
  paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,h);paint.stroke();
 }
 paint.lineWidth=1;
 const displayNotes=['countin','recording'].includes(state)?(phase==='hat'?hatNotes:[...phaseHatPlayback,...notes]):attackPlayhead!==null?(lastMix??[]).flatMap(track=>track.notes):[...lastHat,...last];
 for(const n of displayNotes){const x=22+(w-24)*n.t/duration;paint.fillStyle=n.type==='hat'?'#e5cb82':n.type==='kick'?'#d4f77d':'#efa568';const held=[...heldInputs.values()].find(v=>v.note===n);const gate=n.duration??(held?Math.min(ctx.currentTime,recordAudioAt+duration)-held.at:0);if(gate>0){paint.fillRect(x,h*(n.type==='hat'?.15:n.type==='kick'?.48:.8)-2,Math.min(w-x,(w-24)*gate/duration),4);}paint.beginPath();paint.arc(x,h*(n.type==='hat'?.15:n.type==='kick'?.48:.8),3,0,Math.PI*2);paint.fill();}
 if(state==='recording'||attackPlayhead!==null){
  const elapsed=attackPlayhead!==null?Math.min(duration,attackPlayhead):Math.max(0,Math.min(duration,ctx.currentTime-recordAudioAt));
  $('timer').textContent=Math.max(0,duration-elapsed).toFixed(2);paint.strokeStyle='#eff1e9';const x=22+(w-24)*elapsed/duration;paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,h);paint.stroke();
 }
 document.querySelectorAll('#beatLights i').forEach((light,i)=>light.classList.toggle('on',i===visualBeat));
 requestAnimationFrame(draw);
}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseAllInputs();stopReplay();if(state==='recording')$('hint').textContent='演奏時間はタブを離れても進みます。';}});update();draw();
