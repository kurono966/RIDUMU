const $=id=>document.getElementById(id);
const enemies=[
 {name:'苔岩の番人',kind:'stone',bpm:82,hp:260,guard:.20,description:'地に根を張る、分厚い岩のからだ。',attack:88,gridSkill:{type:'poison',cells:3,turns:4,power:3}},
 {name:'宙を舞う翼獣',kind:'fly',bpm:150,hp:240,description:'風の流れに乗り、軽やかに身をかわす。',attack:96},
 {name:'忘却の自律機',kind:'machine',bpm:120,hp:300,guard:.25,description:'古びた装甲の奥で、回路が明滅する。',attack:104},
 {name:'棘冠の喰らい花',kind:'plant',bpm:100,hp:280,description:'開いた花冠の陰で、棘の蔓が脈打つ。',attack:96,gridSkill:{type:'poison',cells:5,turns:5,power:4}},
 {name:'薄明の残響',kind:'ghost',bpm:72,hp:270,description:'輪郭がほどけ、影だけが遅れて揺れる。',attack:100},
 {name:'晶殻の甲虫',kind:'crystal',bpm:138,hp:340,guard:.30,description:'透明な装甲が、二つの響きを返す。',attack:116}
];
const elements={earth:['土','重震','#d4f77d'],wind:['風','風裂','#9adfd5'],fire:['火','烈火','#ffa26d'],lightning:['雷','雷走','#c6b0ff']};
const instruments=[
 {id:'drums',name:'DRUMS',labels:['KICK','SNARE'],hints:['深く、響かせる。','鋭く、切り込む。'],lanes:['K','S']},
 {id:'bass',name:'BASS',labels:['BASS · C','BASS · G'],hints:['長押しで低音を伸ばす。','長押しで五度を伸ばす。'],lanes:['C','G']},
 {id:'lead',name:'SYNTH LEAD',labels:['LEAD · C','LEAD · E♭'],hints:['長押しで主旋律を伸ばす。','長押しで短三度を伸ばす。'],lanes:['C','E♭']}
];
const instrumentForTurn=number=>instruments[(Math.max(1,number)-1)%instruments.length];
const melodyScale=[0,2,3,5,7,8,10,12,14],melodyNames=['C','D','E♭','F','G','A♭','B♭','C↑','D↑'],melodyKeys=['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL'];
const fourNotePitches=[0,2,4,6],fourNoteKeys=['KeyA','KeyS','KeyK','KeyL'];
let noteMode='two';
const pitchNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const pitchSettings={bass:{},lead:{}};
function midiName(midi){return pitchNames[midi%12]+(Math.floor(midi/12)-1);}
function pitchSlots(mode=noteMode){return mode==='four'?fourNotePitches:mode==='nine'?[0,1,2,3,4,5,6,7,8]:mode==='seven'?[0,1,2,3,4,5,6]:[0,1];}
function defaultPitches(voice,mode){const base=voice==='bass'?36:60;return mode==='two'?[base,base+(voice==='bass'?7:3)]:pitchSlots(mode).map(slot=>base+melodyScale[slot]);}
function pitchesFor(voice,mode=noteMode){return pitchSettings[voice]?.[mode]??defaultPitches(voice,mode);}
function setKeyPitch(voice,mode,index,midi){
 if(!['ready','cleared','over'].includes(state)||!['bass','lead'].includes(voice)||!['two','four','seven','nine'].includes(mode)||!Number.isInteger(index)||index<0||index>=pitchSlots(mode).length||!Number.isInteger(midi)||midi<12||midi>107)return false;
 const values=[...pitchesFor(voice,mode)];values[index]=midi;pitchSettings[voice][mode]=values;
 try{globalThis.localStorage?.setItem('ridumu-pitches-v1',JSON.stringify(pitchSettings));}catch{}
 updateInstrument();return true;
}
function inputMidi(type,pitch,voice=instrumentForTurn(turn).id){
 if(!['bass','lead'].includes(voice))return undefined;
 const index=melodicNotes(voice)?pitchSlots().indexOf(pitch):(type==='kick'?0:1);
 return pitchesFor(voice)[Math.max(0,index)];
}
try{
 const stored=JSON.parse(globalThis.localStorage?.getItem('ridumu-pitches-v1')??'null');
 for(const voice of ['bass','lead'])for(const mode of ['two','four','seven','nine']){
  const values=stored?.[voice]?.[mode];
  if(Array.isArray(values)&&values.length===pitchSlots(mode).length&&values.every(n=>Number.isInteger(n)&&n>=12&&n<=107))pitchSettings[voice][mode]=[...values];
 }
}catch{}

function sevenNotes(voice=instrumentForTurn(turn).id){return ['seven','nine'].includes(noteMode)&&voice!=='drums';}
function melodicNotes(voice=instrumentForTurn(turn).id){return ['four','seven','nine'].includes(noteMode)&&voice!=='drums';}
function melodyGuide(){const voice=instrumentForTurn(turn).id,keys=noteMode==='four'?'4音：A S K L':noteMode==='nine'?'9音：A S D F G H J K L':'7音：A S D F G H J';return keys+(voice==='drums'?'':' / '+pitchesFor(voice).map(midiName).join(' '));}
function syncNoteMode(){
 const enabled=melodicNotes();
 document.querySelector('.console').classList.toggle('seven-notes',enabled);
 document.querySelector('.console').classList.toggle('four-notes',enabled&&noteMode==='four');
 document.querySelector('.console').classList.toggle('nine-notes',enabled&&noteMode==='nine');
 $('melodyPads').setAttribute('aria-label',(noteMode==='nine'?9:noteMode==='four'?4:7)+'音キーボード');
 for(let pitch=0;pitch<melodyKeys.length;pitch++){
  const index=fourNotePitches.indexOf(pitch),pad=$('note'+pitch);
  pad.hidden=noteMode==='four'?index<0:noteMode!=='nine'&&pitch>=7;
  const voice=instrumentForTurn(turn).id;if(voice!=='drums'&&noteMode!=='two'&&!pad.hidden)pad.querySelector('b').textContent=midiName(pitchesFor(voice)[pitchSlots().indexOf(pitch)]);
  pad.querySelector('span').textContent=noteMode==='four'?(fourNoteKeys[index]?.slice(3)??''):melodyKeys[pitch].slice(3);
 }
 $('noteMode').disabled=!['ready','cleared','over'].includes(state);
 $('pitchSetup').disabled=$('noteMode').disabled;
 $('openHistory').disabled=$('noteMode').disabled;
 $('openDebug').disabled=$('noteMode').disabled;
 $('noteMode').title='ベース・リードの音数。4音：ASKL / 7音：ASDFGHJ / 9音：ASDFGHJKL / 長押し対応';
 $('melodyPads').setAttribute('aria-label',instrumentForTurn(turn).name+' / '+melodyGuide()+'、長押しで持続');
}
let lastInstrument='drums';
const tracks=new Map();
let lastMix=null;
let masterOutput=null,drumOutput=null,battleWaveform=null;
let enemyMusic=null;
let attackMusicWindow=null;
let savedMusicWindow=null,musicSnapshot=null,recordingAccompaniment=null,lastAccompaniment=null;
function startSavedMusic(accompaniment,start,end,owner){
 if(!accompaniment)return;savedMusicWindow={accompaniment,start,end,owner};enemyMusic?.stop();syncEnemyMusic();
}
function stopSavedMusic(owner){if(savedMusicWindow?.owner===owner){savedMusicWindow=null;enemyMusic?.stop();syncEnemyMusic();}}
function syncEnemyMusic(){
 if(!ctx||!globalThis.EnemyMusic)return;
 if(!enemyMusic)enemyMusic=EnemyMusic.create(ctx,masterOutput??ctx.destination,{onChord:name=>{$('enemyBpm').textContent='BPM '+(musicSnapshot?.bpm??timing().bpm)+' · '+name;}});
 const performing=state==='recording'&&recordAudioAt!==null&&ctx.currentTime>=recordAudioAt&&ctx.currentTime<recordAudioAt+timing().duration;
 const attackReplay=state==='attack'&&attackMusicWindow&&ctx.currentTime<attackMusicWindow.end;
 const replay=attackReplay?attackMusicWindow:savedMusicWindow&&ctx.currentTime<savedMusicWindow.end?savedMusicWindow:null;
 const snapshot=replay?.accompaniment;
 if(snapshot){if(musicSnapshot!==snapshot){enemyMusic.setSnapshot(snapshot);musicSnapshot=snapshot;}}
 else{enemyMusic.setEnemy(enemies[stage].kind,timing().bpm);musicSnapshot=null;}
 enemyMusic.setMuted(muted);
 if(document.hidden||(!performing&&!replay))enemyMusic.stop();else enemyMusic.start(replay?replay.start:recordAudioAt,replay?replay.end:recordAudioAt+timing().duration);
 $('enemyBpm').textContent='BPM '+(snapshot?.bpm??timing().bpm)+' · '+enemyMusic.state.chord;
 $('enemyBpm').title=snapshot?snapshot.chords.map(c=>c.name).join(' → '):EnemyMusic.progression(enemies[stage].kind).chords.map(id=>EnemyMusic.chords[id].name).join(' → ');
}
const performanceFilter=globalThis.PerformanceFilter;
let filterAutomation=[],filterTracks=new Map(),filterLastMix=[];
let filterPlaybackTimers=[];
const synthTracks=new Map();
let synthRecording=null;
function beginSynthRecording(){const voice=instrumentForTurn(turn).id;if(!globalThis.Synth||!Synth.voices.includes(voice)||phase!=='parts'){synthRecording=null;return;}const point=Synth.current(voice);synthRecording={version:1,patch:point.patch,events:[{t:ctx&&recordAudioAt!==null?Math.min(0,ctx.currentTime-recordAudioAt):0,...point}]};}
function captureSynth(voice){
 if(pendingTrackInput?.voice===voice&&pendingTrackInput.synth)appendSynthPoint(pendingTrackInput.synth,voice,pendingTrackInput.recordAt);
 if(!synthRecording||voice!==instrumentForTurn(turn).id||!ctx||recordAudioAt===null||!['countin','recording'].includes(state))return;
 appendSynthPoint(synthRecording,voice,recordAudioAt);
}
function appendSynthPoint(snapshot,voice,recordAt){const t=ctx.currentTime-recordAt;if(t<-30||t>timing().duration)return;const point={t:+t.toFixed(6),...Synth.current(voice)},events=snapshot.events,prev=events.at(-1);if(prev&&point.t===prev.t)events[events.length-1]=point;else events.push(point);}
function recordedSynth(voice,noteTime,mix=lastMix){const snapshot=mix?.find(t=>t.voice===voice)?.synth;return snapshot?{snapshot,noteTime}:undefined;}
function soundTimeline(mix,voice,damages,duration){
 const playable=mix.map(track=>Synth.voices.includes(track.voice)?{...track,notes:Synth.monoNotes(track.notes)}:track);
 const timeline=Rhythm.mixTimeline(playable,voice,damages,duration);
 for(let i=0;i<timeline.events.length;i++){
  const e=timeline.events[i],snapshot=mix.find(t=>t.voice===e.voice)?.synth;if(!snapshot)continue;
  const next=timeline.events.slice(i+1).find(n=>n.voice===e.voice);
  const tail=e.at+(e.duration??.17)+Synth.at(snapshot,e.time+(e.duration??.17)).patch.release+.025;
  timeline.duration=Math.max(timeline.duration,Math.min(tail,next?.at??Infinity));
 }
 return timeline;
}
function toneProfile(voice){const snap=synthTracks.get(voice);return globalThis.Synth&&snap?Synth.profile(snap,Quantize.render(tracks.get(voice)??[],lastBpm,lastDuration),lastDuration):{fire:0,water:0,wind:0,earth:0};}
function toneResult(voice){if(!globalThis.Synth)return '';const p=toneProfile(voice);if(!Object.values(p).some(Boolean))return voice.toUpperCase()+'：無音・音色補正なし';return voice.toUpperCase()+' 音色：'+Synth.describe(p);}
function showToneResult(voices){const el=$('timbreResult');if(el)el.textContent=voices.length?'音色は属性を変えません。短音・長音の演奏との相性が戦闘スタイルに影響します。':'';}
if(globalThis.Synth)Synth.subscribe(captureSynth);
function filterCapture(){if(!ctx||!recordAudioAt||!['countin','recording'].includes(state))return;const t=ctx.currentTime-recordAudioAt;if(t<0||t>timing().duration)return;const point={t:+t.toFixed(3),amount:performanceFilter.state.amount,mode:performanceFilter.state.mode,volume:performanceFilter.state.volume};const prev=filterAutomation.at(-1);if(!prev||t-prev.t>.045||prev.mode!==point.mode)filterAutomation.push(point);else filterAutomation[filterAutomation.length-1]=point;}
function clearFilterPlayback(){filterPlaybackTimers.forEach(clearTimeout);filterPlaybackTimers=[];}
function playFilterAutomation(tracks,offset=0){clearFilterPlayback();const events=tracks.filter(t=>t.voice==='drums').flatMap(t=>t.events??[]).sort((a,b)=>a.t-b.t);for(const event of events){const delay=(event.t-offset)*1000;if(delay<0)continue;filterPlaybackTimers.push(setTimeout(()=>{performanceFilter.set(event.amount,event.mode,event.volume??1);renderFilterPad();},delay));}}

let phase='parts',hatNotes=[],hatReady=false,lastHat=[],lastDuration=480/enemies[0].bpm,lastBpm=enemies[0].bpm,visualBeat=-1;
let quantizeMode='off',phaseQuantizeMode='off',phaseHatPlayback=[];
let continuousInput=false,continuousRunning=false,continuousResume=false,recordingAdvance=null;
let pendingTrackInput=null;
// The overlap is short enough to leave the preceding part's final subdivision
// playable; at fast tempos it is capped at half a beat.
const nextTrackGrace=()=>Math.min(.15,timing().beat/2);
function upcomingInputTrack(){
 if(!continuousRunning||state!=='recording'||recordAudioAt===null||!ctx)return null;
 const recordAt=recordAudioAt+timing().duration,remaining=recordAt-ctx.currentTime;
 if(remaining<=0||remaining>nextTrackGrace()+1e-9)return null;
 const nextTurn=phase==='hat'?turn:turn+1;
 if(phase!=='hat'&&instrumentForTurn(turn).id==='lead')return null;
 return {voice:instrumentForTurn(nextTurn).id,turn:nextTurn,recordAt};
}
function anticipateTrackInput(type,source,pitch){
 const target=upcomingInputTrack();if(type==='hat'||!target)return false;
 if(!pendingTrackInput){
  const point=Synth.voices.includes(target.voice)?Synth.current(target.voice):null;
  pendingTrackInput={...target,notes:[],synth:point?{version:1,patch:point.patch,events:[{t:ctx.currentTime-target.recordAt,...point}]}:null};
 }
 if(pitch===undefined&&melodicNotes(target.voice))pitch=pitchSlots().at(type==='kick'?0:-1);
 const rawT=ctx.currentTime-target.recordAt,event={type,t:0,rawT,inputT:rawT,inputTimes:[rawT],quantize:quantizeMode};
 if(pitch!==undefined)event.pitch=pitch;
 const midi=inputMidi(type,pitch,target.voice);if(midi!==undefined){event.midi=midi;if(globalThis.PitchCombat)event.register=PitchCombat.register(midi,pitchesFor(target.voice));}
 pendingTrackInput.notes.push(event);
 playInput(type,source,event,pitch,target.voice,target.recordAt+timing().duration);
 return true;
}
let autoHat=false;
try{autoHat=localStorage.getItem('ridumu-auto-hat')==='true';}catch{}
const autoHatControl=$('autoHat');
if(autoHatControl){
 autoHatControl.checked=autoHat;
 autoHatControl.onchange=()=>{
  if(!['ready','cleared','over'].includes(state)){autoHatControl.checked=autoHat;return;}
  autoHat=autoHatControl.checked;
  try{localStorage.setItem('ridumu-auto-hat',String(autoHat));}catch{}
  if(state==='ready')ready();
 };
}
try{continuousInput=localStorage.getItem('ridumu-continuous-input')==='true';}catch{}
const continuousControl=$('continuousInput');
if(continuousControl){
 continuousControl.checked=continuousInput;
 continuousControl.onchange=()=>{
  if(!['ready','cleared','over'].includes(state)){continuousControl.checked=continuousInput;return;}
  continuousInput=continuousControl.checked;
  try{localStorage.setItem('ridumu-continuous-input',String(continuousInput));}catch{}
 };
}
function syncQuantizeControl(){
 syncNoteMode();
 if(continuousControl)continuousControl.disabled=!['ready','cleared','over'].includes(state);
 if(autoHatControl)autoHatControl.disabled=!['ready','cleared','over'].includes(state);
 $('quantizeMode').disabled=!['ready','cleared','over'].includes(state);
 const mode=Quantize.modes.find(m=>m.id===quantizeMode);
 $('quantizeMode').title=mode.description;
}
function timing(){const bpm=enemies[stage].bpm,beat=60/bpm;return {bpm,beat,duration:beat*8,step:beat/4,slots:32};}
function prepareTracksForTurn(){
 // A new drum turn starts a fresh three-part phrase.
 if(instrumentForTurn(turn).id==='drums'){filterTracks.clear();filterLastMix=[];synthTracks.clear();tracks.clear();hatNotes=[];hatReady=false;cycleBass=null;cycleLead=null;cycleEnsemble=null;}
}
function nextRecordingPhase(){
 // The generated Hat uses the same event format as a manual performance, so
 // backing playback, groove analysis and saved sequences share one path.
 if(!hatReady&&autoHat){
  const {beat}=timing();
  hatNotes=Array.from({length:16},(_,i)=>({type:'hat',t:i*beat/2,rawT:i*beat/2,quantize:'off'}));
  hatReady=true;
 }
 return hatReady?'parts':'hat';
}
function saveTrack(voice,played){
 if(played.length)tracks.set(voice,played.map(n=>({...n})));
 else tracks.delete(voice);
 lastMix=Array.from(tracks,([voice,notes])=>({voice,notes:Quantize.render(notes,timing().bpm,timing().duration),...(synthTracks.has(voice)?{synth:synthTracks.get(voice)}:{}),...(filterTracks.has(voice)?{effects:filterTracks.get(voice).map(e=>({...e}))}:{})}));
 if(hatNotes.length)lastMix.push({voice:'hat',notes:Quantize.render(hatNotes,timing().bpm,timing().duration)});
}
function backingTimeline(){
 const backing=Array.from(tracks,([voice,notes])=>({voice,notes})).filter(track=>track.voice!==instrumentForTurn(turn).id);
 if(hatNotes.length)backing.push({voice:'hat',notes:hatNotes});
 return Rhythm.mixTimeline(backing.map(track=>({...track,notes:Quantize.render(track.notes,timing().bpm,timing().duration)})),null,[],timing().duration);
}
function updateInstrument(){
 syncNoteMode();
 if(globalThis.Synth)for(const voice of Synth.voices)Synth.setPad(voice,{amount:0,volume:1});
 const instrument=instrumentForTurn(turn);
 $('instrument').textContent=instrument.name;battleWaveform?.setVoice(instrument.id);
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
 reactEnemy('poison');battleWaveform?.trigger('poison');renderGridHazards();
}
function poisonDefeat(){
 globalThis.PitchUI?.clear();
 attackMusicWindow=null;
 enemyMusic?.stop();
 continuousRunning=false;continuousResume=false;recordingAdvance=null;
 shield=0;cycleBass=null;cycleLead=null;cycleEnsemble=null;
 clearInterval(clockTimer);clockTimer=null;run++;releaseAllInputs();pendingTrackInput=null;recordAudioAt=null;visualBeat=-1;state='over';
 document.querySelector('.console').classList.remove('recording');$('status').textContent='POISON / 演奏中断';$('hint').textContent='毒汚染で力尽きた。危険な位置を変えるか、ダメージを承知で次の一撃を狙おう。';
 $('start').disabled=false;$('start').textContent='再挑戦 ↗';syncQuantizeControl();resetGridHazards();
}
function applyInputHazards(result){
 const damage=result.effects.filter(effect=>effect.kind==='damage').reduce((sum,effect)=>sum+effect.amount,0);
 if(!damage)return;
 battleWaveform?.trigger('poison');
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
async function countIn(nextPhase='hat',continuationAt=null){
 globalThis.ExperienceUI?.reset();
 globalThis.PitchUI?.clearSelection();
 const anticipated=continuationAt!==null&&pendingTrackInput?.turn===turn&&pendingTrackInput.recordAt===continuationAt?pendingTrackInput:null;
 releaseAllInputs(undefined,anticipated);
 pendingTrackInput=null;
 phase=nextPhase;phaseQuantizeMode=quantizeMode;updatePhaseUI();
 phaseHatPlayback=phase==='parts'?Quantize.render(hatNotes,timing().bpm,timing().duration):[];
 state='countin';recordAudioAt=null;notes=anticipated?.notes??[];filterAutomation=[];renderGridHazards();
 syncQuantizeControl();
 $('start').disabled=true;$('replay').disabled=true;
 $('start').textContent='カウントイン…';$('timer').textContent=timing().duration.toFixed(2);
 $('hint').textContent=phase==='hat'?'最後のリムショットから、SPACE / HでHatを刻もう。':'自分のHatを聴いて、A / Lを重ねよう。';
 $('status').textContent='COUNT IN / 1 · 2 · 3 · 4';
 const token=++run;
 // A running session hands off on the same audio-clock boundary, without awaiting
 // a new count-in or the previous backing track's release tail.
 if(continuationAt===null){await ctx.resume();if(globalThis.DrumAudio)await globalThis.DrumAudio.ready;}
 if(token!==run)return;
 const {beat,duration,bpm}=timing(),hasCountIn=!continuousRunning||continuationAt===null;
 const recordAt=hasCountIn?ctx.currentTime+.06+4*beat:continuationAt,origin=hasCountIn?recordAt-4*beat:recordAt;
 recordAudioAt=recordAt;filterAutomation=[{t:0,amount:performanceFilter.state.amount,mode:performanceFilter.state.mode,volume:performanceFilter.state.volume}];beginSynthRecording();started=performance.now()+(recordAt-ctx.currentTime)*1000;
 recordingAccompaniment=globalThis.EnemyMusic?.snapshot?.(enemies[stage].kind,bpm)??null;
 if(anticipated?.synth){synthRecording=anticipated.synth;appendSynthPoint(synthRecording,anticipated.voice,recordAt);}
 // Apply grid effects once, in the destination turn, just like count-in input.
 for(const note of anticipated?.notes??[])applyInputHazards(gridHazards.onInput({type:note.type,rawT:note.rawT,bpm,voice:anticipated.voice,note:{...note}}));
 if(token!==run)return;
 syncEnemyMusic();
 const backing=phase==='parts'?backingTimeline().events:[];
 const endAt=recordAt+(continuousRunning?duration:Math.max(duration,...backing.map(event=>event.time+(event.duration??0)+.14)));
 let backingIndex=0,countBeat=0;
 clearInterval(clockTimer);
 function tick(){
  if(token!==run){clearInterval(timer);return;}
  const now=ctx.currentTime;
  if(now>=recordAt+duration){enemyMusic?.stop();releaseAllInputs(recordAt+duration,pendingTrackInput);}
  while(backingIndex<backing.length&&recordAt+backing[backingIndex].time<now+.1){
   const event=backing[backingIndex++],at=recordAt+event.time;
   if(at>=now||(continuousRunning&&at>=now-.1))sound(event.type,Math.max(at,now),event.voice,event.voice==='hat'?.85:.6,event.duration,event.pitch,event.midi,undefined,recordedSynth(event.voice,event.time));
  }
  // Keep the opening four beats and a beat guide throughout manual Hat input.
  // Continuous part-to-part handoffs still have no added count-in.
  const countLength=(hasCountIn?4:0)+(phase==='hat'?8:0);
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
   syncEnemyMusic();
   if(continuousRunning){$('start').disabled=false;$('start').textContent='■ 連続入力を停止';}
  }
  if(now>=endAt){
   clearInterval(timer);clockTimer=null;visualBeat=-1;
   if(state==='recording'){
    recordingAdvance=null;
    if(phase==='hat'){hatReady=true;document.querySelector('.console').classList.remove('recording');countIn('parts',continuousRunning?recordAt+duration:null);}
    else finish(continuousRunning?recordAt+duration:null);
   }
  }
 }
 const timer=setInterval(tick,20);clockTimer=timer;
 recordingAdvance=()=>{if(continuousRunning&&state==='recording'&&ctx.currentTime>=recordAt+duration)tick();};tick();
}
function stopContinuousInput(){
 if(['attack','enemyAttack'].includes(state)){
  continuousRunning=false;recordingAdvance=null;$('start').disabled=true;$('start').textContent='戦闘後に停止';return;
 }
 continuousRunning=false;recordingAdvance=null;run++;clearInterval(clockTimer);clockTimer=null;
 continuousResume=phase==='parts';
 releaseAllInputs();for(const voice of pitchedVoices)voice.release();
 pendingTrackInput=null;
 if(phase==='hat'){hatNotes=[];hatReady=false;}
 notes=[];synthRecording=null;filterAutomation=[];recordAudioAt=null;visualBeat=-1;
 document.querySelector('.console').classList.remove('recording');ready();
}
function audio(){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();masterOutput=ctx.createDynamicsCompressor();masterOutput.threshold.value=-12;masterOutput.ratio.value=6;drumOutput=performanceFilter.connect(ctx,masterOutput);if(globalThis.BattleWaveform){battleWaveform=BattleWaveform.connect(ctx,masterOutput,$('battleWaveform'),{output:ctx.destination});battleWaveform.setVoice(instrumentForTurn(turn).id);}else masterOutput.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume();syncEnemyMusic();}
const heldInputs=new Map(), pitchedVoices=new Set();
function pitchedSound(type,t,voice,volume=1,duration,pitch,midi,recorded){
 const bass=voice==='bass',frequency=Number.isInteger(midi)?440*2**((midi-69)/12):Number.isInteger(pitch)&&pitch>=0&&pitch<melodyScale.length?(bass?65.406:261.626)*2**(melodyScale[pitch]/12):bass?(type==='kick'?65.406:97.999):(type==='kick'?261.626:311.127);
 const handle=Synth.engine(ctx,masterOutput??ctx.destination).play(voice,frequency,t,volume,duration??.17,recorded);pitchedVoices.add(handle);handle.onended=()=>pitchedVoices.delete(handle);return handle;
}
function releaseInput(source,at=ctx?.currentTime??0){
 const held=heldInputs.get(source);if(!held)return;
 if(held.note&&!held.interrupted)held.note.duration=Math.max(.025,Math.min(at,held.endAt??recordAudioAt+timing().duration)-held.at);
 held.handle?.release(at);heldInputs.delete(source);
 if(held.pitch!==undefined&&![...heldInputs.values()].some(h=>h.pitch===held.pitch))$('note'+held.pitch).classList.remove('held');
 if(![...heldInputs.values()].some(h=>h.type===held.type))$(held.type).classList.remove('held');
}
function releaseAllInputs(at=ctx?.currentTime??0,preserve=null){for(const [source,held] of heldInputs)if(!preserve?.notes.includes(held.note))releaseInput(source,at);}
function playInput(type,source,note,pitch=note?.pitch,voice=type==='hat'?'hat':instrumentForTurn(turn).id,endAt=recordAudioAt+timing().duration){
 const sustain=source!==undefined&&voice!=='hat'&&voice!=='drums';
 if(Synth.voices.includes(voice))for(const held of heldInputs.values()){if(held.voice!==voice||held.interrupted)continue;if(held.note)held.note.duration=Math.max(.025,Math.min(ctx.currentTime,held.endAt??recordAudioAt+timing().duration)-held.at);held.interrupted=true;}
 const midi=note?.midi??inputMidi(type,pitch,voice);
 const handle=sound(type,undefined,voice,1,sustain?Infinity:undefined,pitch,midi);
 if(sustain){heldInputs.set(source,{type,voice,note,handle,pitch,at:ctx.currentTime,endAt});$(type).classList.add('held');if(pitch!==undefined)$('note'+pitch).classList.add('held');}
 flash(type);
 if(voice===instrumentForTurn(turn).id)globalThis.ExperienceUI?.input(note,voice,handle);
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
  const played=(samples.playVoice??samples.play)(ctx,type,at,volume,drumOutput??masterOutput??ctx.destination);
  if(played&&type==='kick')Synth.engine(ctx,masterOutput??ctx.destination).duckForKick(at,volume);
  return played;
 };
 const played=play();if(!played)samples.ready.then(play);return played;
}
function sound(type,when,voice=instrumentForTurn(turn).id,volume=1,duration,pitch,midi,pitches,recorded){
 if(muted||!ctx)return;const t=when??ctx.currentTime;
 battleWaveform?.note(type,voice,t);
 if(voice==='chord')return chordSound(type,t,volume,pitches);
 if(voice==='hat')return sampleSound('hat',t,volume);
 if(voice==='drums')return sampleSound(type,t,volume);
 return pitchedSound(type,t,voice,volume,duration,pitch,midi,recorded);
}
function flash(type){$(type).classList.add('active');setTimeout(()=>$(type).classList.remove('active'),90);}
function stopReplay(){stopSavedMusic('result');clearFilterPlayback();globalThis.stopHistoryPlayback?.();if(replaying)for(const voice of pitchedVoices)voice.release();replayTimers.forEach(clearTimeout);replayTimers=[];replaying=false;$('replay').textContent='▶ リズムを再生';}
function input(type,source,pitch){
 recordingAdvance?.();
 if(source!==undefined&&heldInputs.has(source))return;
 audio();
 if(state==='ready'){playInput(type,source,undefined,pitch);return;}
 if(anticipateTrackInput(type,source,pitch))return;
 if((state!=='countin'&&state!=='recording')||recordAudioAt===null)return;
 if((phase==='hat')!==(type==='hat'))return;
 const rawT=ctx.currentTime-recordAudioAt;
 if(rawT < -earlyInputGrace()-1e-9 || rawT>=timing().duration)return;
 const target=type==='hat'?hatNotes:notes;
 // Every press is heard and stored unchanged; only playback copies are quantized.
 const event={type,t:Math.max(0,rawT),rawT,inputT:rawT,inputTimes:[rawT],quantize:phaseQuantizeMode};
 if(pitch!==undefined)event.pitch=pitch;
 const midi=inputMidi(type,pitch);if(midi!==undefined&&type!=='hat'){event.midi=midi;if(globalThis.PitchCombat)event.register=PitchCombat.register(midi,pitchesFor(instrumentForTurn(turn).id));}
 // Resolve interventions before dispatch, leaving room for future note-transform effects.
 const hazards=gridHazards.onInput({type,rawT,bpm:timing().bpm,voice:type==='hat'?'hat':instrumentForTurn(turn).id,note:{...event}});
 target.push(event);
 playInput(type,source,event);
 applyInputHazards(hazards);
}
function handleKeyDown(e){
 if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
 if(globalThis.RidumuUI?.isModalOpen()||$('synthDialog')?.open||$('codexDialog').open||$('pitchDialog').open||$('historyDialog').open||$('damageDialog').open||$('debugDialog').open)return;
 if(e.code==='Escape'&&continuousRunning&&['countin','recording','attack','enemyAttack'].includes(state)){e.preventDefault();stopContinuousInput();return;}
 recordingAdvance?.();
 const keyboardVoice=upcomingInputTrack()?.voice??instrumentForTurn(turn).id;
 if(e.code==='Space'&&e.target?.tagName==='BUTTON'&&e.target.id!=='start'&&!(e.target.id==='hat'&&phase==='hat'))return;
 if((e.code==='KeyH'&&!(sevenNotes(keyboardVoice)&&(state==='ready'||phase==='parts')))||(e.code==='Space'&&phase==='hat'&&['countin','recording'].includes(state))){e.preventDefault();input('hat');return;}
 if(e.code==='Space'){
  e.preventDefault();
  if(['ready','cleared','over'].includes(state)&&!$('start').disabled)$('start').click();
  return;
 }
 const keyIndex=(noteMode==='four'?fourNoteKeys:melodyKeys).indexOf(e.code);
 const pitch=noteMode==='four'?fourNotePitches[keyIndex]:keyIndex;
 if(melodicNotes(keyboardVoice)&&keyIndex>=0&&pitchSlots().includes(pitch)){e.preventDefault();input(pitch<4?'kick':'snare','key:'+e.code,pitch);return;}
 if(melodicNotes(keyboardVoice))return;
 const type=e.code==='KeyA'?'kick':['KeyL','KeyD'].includes(e.code)?'snare':null;
 if(type){e.preventDefault();input(type,'key:'+e.code);}
}
const togglePads=$('togglePads');
function setPadsVisible(visible){document.querySelector('.console').classList.toggle('pads-collapsed',!visible);togglePads.textContent=visible?'演奏パッド ON':'演奏パッド OFF';togglePads.setAttribute('aria-pressed',String(visible));try{localStorage.setItem('ridumu-pads-visible',String(visible));}catch{}}
let padsVisible=true;try{padsVisible=localStorage.getItem('ridumu-pads-visible')!=='false';}catch{}
setPadsVisible(padsVisible);
togglePads.addEventListener('click',()=>setPadsVisible(document.querySelector('.console').classList.contains('pads-collapsed')));
const filterMode=$('filterMode');
const filterPad=$('filterPad'),filterCursor=$('filterCursor');
function renderFilterPad(){const {amount,mode,volume}=performanceFilter.state;filterCursor.style.left=(amount*100)+'%';filterCursor.style.bottom=(volume*100)+'%';filterPad.setAttribute('aria-valuenow',String(Math.round(amount*100)));filterPad.setAttribute('aria-valuetext',`音量 ${Math.round(volume*100)}%、フィルター ${Math.round(amount*100)}%`);$('filterValue').textContent=`VOL ${Math.round(volume*100)}% / FX ${Math.round(amount*100)}%`;filterMode.value=mode;}
function syncSynthPad(){if(!globalThis.Synth)return;const voice=instrumentForTurn(turn).id;if(Synth.voices.includes(voice))Synth.setPad(voice,performanceFilter.state);}
function resetFilterPad(){performanceFilter.set(0,filterMode.value,1);renderFilterPad();filterCapture();syncSynthPad();}
function setFilterFromPointer(e){const box=filterPad.getBoundingClientRect();if(!box.width||!box.height)return;if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom){resetFilterPad();return;}performanceFilter.set((e.clientX-box.left)/box.width,filterMode.value,(box.bottom-e.clientY)/box.height);renderFilterPad();filterCapture();syncSynthPad();}
filterPad.addEventListener('pointerdown',e=>{e.preventDefault();filterPad.setPointerCapture(e.pointerId);setFilterFromPointer(e);});
filterPad.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')setFilterFromPointer(e);});
filterPad.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||filterPad.hasPointerCapture(e.pointerId))setFilterFromPointer(e);});
filterPad.addEventListener('pointerleave',resetFilterPad);
filterPad.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')resetFilterPad();else setFilterFromPointer(e);});
filterPad.addEventListener('pointercancel',resetFilterPad);
filterPad.addEventListener('lostpointercapture',e=>{if(e.pointerType!=='mouse')resetFilterPad();});
filterPad.addEventListener('blur',resetFilterPad);
window.addEventListener('blur',resetFilterPad);
filterPad.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let {amount,volume}=performanceFilter.state;if(e.key==='Home'){amount=0;volume=1;}else if(e.key==='End'){amount=1;volume=1;}else if(e.key==='ArrowUp'||e.key==='ArrowDown')volume+=e.key==='ArrowUp'?.05:-.05;else amount+=e.key==='ArrowRight'?.05:-.05;performanceFilter.set(amount,filterMode.value,volume);renderFilterPad();filterCapture();syncSynthPad();});
filterMode.addEventListener('change',()=>{performanceFilter.set(performanceFilter.state.amount,filterMode.value);renderFilterPad();filterCapture();syncSynthPad();});renderFilterPad();
document.addEventListener('keydown',handleKeyDown);
document.addEventListener('keyup',e=>{releaseInput('key:'+e.code);});
['hat','kick','snare'].forEach(type=>{
 const pad=$(type);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture?.(e.pointerId);input(type,'pointer:'+e.pointerId);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{releaseInput('pointer:'+e.pointerId);});
});
for(let pitch=0;pitch<melodyKeys.length;pitch++){
 const pad=$('note'+pitch);
 pad.addEventListener('pointerdown',e=>{e.preventDefault();if(!melodicNotes(upcomingInputTrack()?.voice)||!pitchSlots().includes(pitch))return;pad.setPointerCapture?.(e.pointerId);input(pitch<4?'kick':'snare','pointer:'+e.pointerId,pitch);});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{releaseInput('pointer:'+e.pointerId);});
}
$('noteMode').onchange=()=>{
 if(!['ready','cleared','over'].includes(state)){$('noteMode').value=noteMode;return;}
 releaseAllInputs();noteMode=['four','seven','nine'].includes($('noteMode').value)?$('noteMode').value:'two';updateInstrument();
 $('hint').textContent=melodicNotes()?melodyGuide()+'。長押しで伸ばす。':'ベース・リードの音数を選択。ドラムはA / L。';
};
globalThis.addEventListener?.('blur',()=>{releaseAllInputs();});
function renderPitchEditor(){
 const voice=$('pitchVoice').value,mode=$('pitchMode').value,keys=mode==='two'?['A','L']:mode==='four'?['A','S','K','L']:melodyKeys.slice(0,mode==='nine'?9:7).map(k=>k.slice(3));
 $('pitchRows').replaceChildren();
 pitchesFor(voice,mode).forEach((midi,index)=>{
  const row=document.createElement('div');row.className='pitch-row';
  const label=document.createElement('label'),select=document.createElement('select'),preview=document.createElement('button');
  label.textContent=keys[index];select.id='pitch-choice-'+index;label.htmlFor=select.id;
  for(let value=107;value>=12;value--){const option=document.createElement('option');option.value=value;option.textContent=midiName(value);select.append(option);}
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
$('sound').onclick=()=>{releaseAllInputs();for(const voice of pitchedVoices)voice.release();muted=!muted;if(!ctx)audio();enemyMusic?.setMuted(muted);$('sound').textContent=muted?'音 OFF':'音 ON';$('sound').setAttribute('aria-pressed',String(!muted));};
$('quantizeMode').onchange=()=>{
 if(!['ready','cleared','over'].includes(state)){$('quantizeMode').value=quantizeMode;return;}
 quantizeMode=$('quantizeMode').value;
 syncQuantizeControl();$('hint').textContent=Quantize.modes.find(m=>m.id===quantizeMode).description;
};
function update(){updateInstrument();renderDiscoveries();$('enemyBpm').textContent='BPM '+timing().bpm;$('bpmValue').textContent=timing().bpm;$('timer').textContent=timing().duration.toFixed(2);const enemy=enemies[stage];$('enemyName').textContent=enemy.name;$('enemyDesc').textContent=enemy.description;$('enemyHp').textContent=`${enemyHp} / ${enemy.hp}`;$('enemyBar').style.width=`${enemyHp/enemy.hp*100}%`;$('playerHp').textContent=`${hp} / 100`;$('playerBar').style.width=`${hp}%`;$('turn').textContent=`TURN ${String(battleRound()).padStart(2,'0')}`;$('stage').textContent=`ENCOUNTER ${String(stage+1).padStart(2,'0')} / ${String(enemies.length).padStart(2,'0')}`;$('sector').textContent=stage+1;$('enemy').className=`creature ${enemy.kind}`;renderGridHazards();syncEnemyMusic();}
function needsHat(){return !autoHat&&(!hatReady||(instrumentForTurn(turn).id==='drums'&&!continuousResume));}
function ready(label='演奏開始 ↗'){
 attackMusicWindow=null;
 enemyMusic?.stop();
 state='ready';advanceGridHazards();$('start').disabled=false;syncQuantizeControl();$('start').textContent=label;$('status').textContent='READY TO PLAY';
 const createHat=needsHat();
 $('phaseLabel').textContent=(createHat?'HAT → ':'録ったHAT → ')+instrumentForTurn(turn).name+(instrumentForTurn(turn).id==='lead'?' → 戦闘':'');
 $('hint').textContent=melodicNotes()&&!createHat?'SPACEで開始 · '+melodyGuide()+'、長押しで伸ばす。':createHat?'SPACEで開始 → Hatを刻む → A / Lを重ねる。':'SPACEで開始 · 録ったHatにA / Lを重ねる。';
 $('hint').textContent+=' · '+({drums:'攻撃を構築',bass:'低音で盾を作る',lead:'旋律で支援 → 戦闘'}[instrumentForTurn(turn).id]);
 if(gridHazards.active().length)$('hint').textContent='SPACEで開始 · 紫の帯は毒。入力は可能。';
}
function startTurn(){advanceGridHazards();if(!continuousResume)prepareTracksForTurn();continuousResume=false;return countIn(nextRecordingPhase());}
$('start').onclick=()=>{
 if(continuousRunning&&['countin','recording','attack','enemyAttack'].includes(state)){stopContinuousInput();return;}
 audio();stopReplay();
 if(['over','cleared'].includes(state)){shield=0;cycleBass=null;cycleLead=null;cycleEnsemble=null;}
 if(state==='over'){resetGridHazards();tracks.clear();lastMix=null;hatNotes=[];hatReady=false;lastHat=[];stage=0;hp=100;turn=1;enemyHp=enemies[0].hp;$('result').hidden=true;update();}
 else if(state==='cleared'){resetGridHazards();stage++;enemyHp=enemies[stage].hp;hp=Math.min(100,hp+28);turn=1;update();}
 else if(state!=='ready')return;
 continuousRunning=continuousInput;startTurn();
};
function sequence(a){$('sequence').replaceChildren();
 const hatRow=document.createElement('div');hatRow.className='seq-row hat-sequence';const hatLabel=document.createElement('label');hatLabel.textContent='H';hatRow.append(hatLabel);
 for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(lastHat.some(n=>Math.min(a.slots-1,Math.max(0,Math.round(n.t/a.step)))===i)?' on':'');cell.title=(i*a.step).toFixed(3)+'秒 / Hat';cell.dataset.type='hat';cell.dataset.q=i;hatRow.append(cell);}$('sequence').append(hatRow);
 ['kick','snare'].forEach(type=>{const row=document.createElement('div');row.className='seq-row';const label=document.createElement('label');label.textContent=last.some(n=>n.pitch!==undefined)?(type==='kick'?'LOW':'HIGH'):instruments.find(i=>i.id===lastInstrument).lanes[type==='kick'?0:1];row.append(label);for(let i=0;i<a.slots;i++){const cell=document.createElement('span');cell.className='cell'+(i%4===0?' beat':'')+(a.grid.some(n=>n.type===type&&n.q===i)?' on':'');if(last.some(n=>n.type===type&&n.duration>0&&i*a.step>n.t&&i*a.step<n.t+n.duration))cell.classList.add('sustain');cell.dataset.type=type;cell.dataset.q=i;const pitches=a.grid.filter(n=>n.type===type&&n.q===i&&n.pitch!==undefined).map(n=>n.midi!==undefined?midiName(n.midi):melodyNames[n.pitch]);cell.title=`${(i*a.step).toFixed(3)}秒${pitches.length?' / '+pitches.join('・'):''}`;if(pitches.length)cell.textContent=pitches.join('·');row.append(cell);}$('sequence').append(row);});}
let shield=0,cycleBass=null,cycleLead=null,cycleEnsemble=null;
let feedbackCarryShield=0;
const battleRound=()=>Math.floor((turn-1)/3)+1;
const currentZones=()=>GridEffects.create(battleRound(),stage);
const attackNames={stone:'岩腕の叩きつけ',fly:'翼の突進',machine:'電撃放射',plant:'毒棘の噴射',ghost:'残響の衝撃波',crystal:'晶殻の衝撃波'};
function renderBattlePlan(){
 $('shieldValue').textContent='盾 '+shield;
 const ended=['over','cleared'].includes(state)||enemyHp<=0||hp<=0;
 $('enemyIntent').hidden=ended;
 $('enemyIntent').textContent=ended?'':`予告：${attackNames[enemies[stage].kind]} / 威力 ${enemies[stage].attack}${enemies[stage].guard?' · 装甲軽減 '+Math.round(enemies[stage].guard*100)+'%':''}${enemies[stage].gridSkill?' ＋ 毒汚染':''} · LEAD後`;
 const names=[];
 const hazards=gridHazards.active(turn).filter(h=>h.type==='poison');
 if(hazards.length)names.push(...hazards.map(h=>`毒：${h.slots.map(q=>q+1).join('・')}番 / −${h.power}HP / 残${h.remainingTurns}パート`));
 $('scope').title=names.join('\n');$('scope').setAttribute('aria-label','演奏シーケンサー。紫の帯は毒。'+names.join('。'));

}
function rememberSequence(kind,mix=lastMix){
 globalThis.captureEvaluationDebug?.({parts:Array.from(tracks),hats:hatNotes,bpm:lastBpm,duration:lastDuration,zones:currentZones(),enemy:enemies[stage]});
 const rawTracks=Array.from(tracks,([voice,notes])=>({voice,notes}));if(hatNotes.length)rawTracks.push({voice:'hat',notes:hatNotes});
 globalThis.captureHistory?.({tracks:mix??[],rawTracks,...(lastAccompaniment?{accompaniment:lastAccompaniment}:{}),bpm:lastBpm,duration:lastDuration,enemy:enemies[stage].name,turn:battleRound(),kind:'attack',title:instruments.find(i=>i.id===lastInstrument).name+' / '+$('moveName').textContent});
}
function enemyAttackSound(kind){
 if(muted||!ctx)return;
 const at=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
 osc.type=kind==='machine'?'sawtooth':'triangle';osc.frequency.setValueAtTime(kind==='fly'?480:kind==='machine'?740:160,at);osc.frequency.exponentialRampToValueAtTime(35,at+.38);
 filter.type='lowpass';filter.frequency.value=kind==='machine'?1500:700;gain.gain.setValueAtTime(.2,at);gain.gain.exponentialRampToValueAtTime(.001,at+.42);
 osc.connect(filter);filter.connect(gain);gain.connect(masterOutput??ctx.destination);osc.start(at);osc.stop(at+.45);
}
async function enemyCounter(a,report,result){
 attackMusicWindow=null;enemyMusic?.stop();
 state='enemyAttack';releaseAllInputs();$('replay').disabled=true;
 $('status').textContent='ENEMY / '+attackNames[enemies[stage].kind];$('hint').textContent='BassのシールドとLeadの支援で迎え撃つ。';
 $('enemy').classList.add('enemy-charge');await wait(550);$('enemy').classList.remove('enemy-charge');
 reactEnemy('strike');battleWaveform?.trigger('enemy');$('arena').dataset.attack=enemies[stage].kind;$('arena').classList.add('enemy-impact');enemyAttackSound(enemies[stage].kind);
 await wait(180);
 const beforeTimbre=Math.min(.55,(cycleLead?.weaken??0)+(cycleEnsemble?.bonus.resistance??0)+(a.count&&a.element==='earth'?.2*a.effect:0));
 const reduction=PerformanceCombat.reduction(cycleLead,cycleBass,cycleEnsemble,a).total;
 const received=PerformanceCombat.receive(hp,shield,enemies[stage].attack,reduction);
 shield=received.shield;renderBattlePlan();
 $('impact').style.color='#8edcdd';$('impact').textContent=received.absorbed?'SHIELD −'+received.absorbed:'';
 if(received.absorbed){$('arena').classList.add('guard-flash');await wait(260);}
 hp=received.hp;update();$('impact').style.color='#ffa26d';$('impact').textContent=received.damage?'−'+received.damage+' HP':'BLOCK';
 const pitchReduction=PerformanceCombat.reduction(cycleLead,cycleBass,cycleEnsemble,a).pitch;
 const text=(a.timbreWeaken?`湿潤：敵攻撃 −${((Math.min(.55,beforeTimbre+a.timbreWeaken)-beforeTimbre)*100).toFixed(1)}% / `:'')+(pitchReduction?`音程耐性：敵攻撃 −${(pitchReduction*100).toFixed(1)}% / `:'')+`敵の攻撃 ${received.incoming} → 盾で${received.absorbed}吸収 / HP −${received.damage}`;
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
 const timeline=soundTimeline(lastMix??[{voice:lastInstrument,notes:last}],attackVoice,result.damages,lastDuration);
 if(!timeline.events.length)return;
 await ctx.resume();
 $('status').textContent='RHYTHM ATTACK / 演奏を再生';
 $('hint').textContent='重ねたリズムを再生。Drumsが攻撃、Bassが盾、Leadが支援になる。';
 $('damage').textContent='0';
 const origin=ctx.currentTime+.06;
 enemyMusic?.stop();attackMusicWindow={start:origin-timeline.offset,end:origin-timeline.offset+lastDuration,accompaniment:lastAccompaniment??globalThis.EnemyMusic?.snapshot?.(enemies[stage].kind,lastBpm)};syncEnemyMusic();
 playFilterAutomation(filterLastMix);
 let scheduled=0,shown=0,total=0,flashTimer;
 await new Promise(resolve=>{
  function tick(){
   const elapsed=ctx.currentTime-origin;
   attackPlayhead=Math.max(0,elapsed+timeline.offset);visualBeat=Math.floor(attackPlayhead/(60/lastBpm))%4;
   while(scheduled<timeline.events.length&&timeline.events[scheduled].at<=elapsed+.1){
    const event=timeline.events[scheduled++];
    const handle=sound(event.type,Math.max(ctx.currentTime,origin+event.at),event.voice,event.voice===lastInstrument?1:.65,event.duration,event.pitch,event.midi,undefined,recordedSynth(event.voice,event.time));
    globalThis.ExperienceUI?.playback(event,handle,Math.max(ctx.currentTime,origin+event.at));
   }
   while(shown<timeline.events.length&&timeline.events[shown].at<=elapsed){
    const event=timeline.events[shown++];
    if(event.voice!==attackVoice)continue;
    flash(event.type);
    const damage=event.damages.reduce((a,b)=>a+b,0);
    const element=Object.keys(elements).find(key=>elements[key][2]===color);
    if(event.damages.length){
     total+=damage;enemyHp=Math.max(0,enemyHp-damage);showHitFeedback(damage);
     if(damage>0){
      battleWaveform?.trigger('hit',{element,groove:activeReport?.groove,amount:Math.min(1,.35+damage/100)});
      globalThis.ExperienceUI?.hit(damage);
     }
     $('damage').textContent=total;
     $('impact').style.color=color;$('impact').textContent=damage;
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
 }).finally(()=>{attackMusicWindow=null;enemyMusic?.stop();});
}
function completeBattle(){
 if(hp>0&&enemyHp>0)return false;
 attackMusicWindow=null;
 enemyMusic?.stop();
 releaseAllInputs();pendingTrackInput=null;
 continuousRunning=false;continuousResume=false;recordingAdvance=null;
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
async function finish(continuationAt=null){
 globalThis.PitchUI?.clear();
 enemyMusic?.stop();
 releaseAllInputs(undefined,pendingTrackInput);if(Synth.voices.includes(instrumentForTurn(turn).id))notes=Synth.monoNotes(notes);state='attack';document.querySelector('.console').classList.remove('recording');
 $('timer').textContent='0.00';lastDuration=timing().duration;lastBpm=timing().bpm;
 lastAccompaniment=recordingAccompaniment??globalThis.EnemyMusic?.snapshot?.(enemies[stage].kind,lastBpm)??null;
 last=Quantize.render(notes,lastBpm,lastDuration);lastHat=Quantize.render(hatNotes,lastBpm,lastDuration);
 lastInstrument=instrumentForTurn(turn).id;if(synthRecording)synthTracks.set(lastInstrument,Synth.cleanSnapshot(synthRecording,lastInstrument));synthRecording=null;filterTracks.set(lastInstrument,filterAutomation.slice());filterLastMix=Array.from(filterTracks,([voice,events])=>({voice,events:events.map(e=>({...e}))}));$('filterRecordStatus').textContent=filterAutomation.length?`エフェクト操作 ${filterAutomation.length}点を記録`:'エフェクト操作なし';saveTrack(lastInstrument,notes);
 $('lastInstrument').textContent=lastMix.map(track=>track.voice.toUpperCase()).join(' + ')||'SILENCE';
 $('lastQuantize').textContent='再生：'+Quantize.modes.find(m=>m.id===phaseQuantizeMode).name;
 const zones=currentZones(),preview=Rhythm.analyze(last,lastDuration,lastBpm);
 if(lastInstrument==='bass'){
  feedbackCarryShield=shield;
  cycleBass=PerformanceCombat.bass(notes,tracks.get('drums')??[],lastBpm,lastDuration,zones);
  cycleBass.rawShield=cycleBass.shield;const tone=Synth.style(synthTracks.get('bass'),tracks.get('bass')??[],lastDuration);cycleBass.shield=Math.round(cycleBass.shield*tone.shield);const before=shield;shield=Math.min(90,shield+cycleBass.shield);cycleBass.pitchShieldApplied=shield-Math.min(90,before+Math.round((cycleBass.rhythmShield??cycleBass.rawShield)*tone.shield));if(shield>before)battleWaveform?.trigger('shield');renderBattlePlan();
  const causes=[`Bassの配置と長さ → シールド +${shield-before}`];
  if(cycleBass.locked)causes.push('KickとBassが重なった → シールド増加');
  if(cycleBass.repetition>.3)causes.push('同じBassの反復 → シールド効率上昇');
  showRoleResult('低音の防壁',causes,shield,'SHIELD',preview);showToneResult(['bass']);globalThis.PitchUI?.result(cycleBass,null,null,null);globalThis.ExperienceUI?.shield(shield-before);rememberSequence('attack');
 }else if(lastInstrument==='drums'){
  feedbackCarryShield=shield;
  showRoleResult('攻撃パターンを構築',[`${preview.count}音のDrums → ${preview.count?preview.hits:0}段の攻撃を準備`,'自由なリズムを記録。次はBassで盾を作ろう。'],0,'ATTACK READY',preview);showToneResult([]);rememberSequence('attack');
 }else{
  cycleEnsemble=Ensemble.analyze(tracks,lastBpm,lastDuration);
  cycleLead=Ensemble.support(PerformanceCombat.lead(notes,lastBpm,lastDuration,zones),cycleEnsemble);
  const toneShield=Math.round((cycleBass?.rawShield??0)*(Synth.style(synthTracks.get('lead'),tracks.get('lead')??[],lastDuration).shield-1)*.5);
  const bonus=toneShield+Math.round((cycleBass?.shield??0)*(cycleLead.shieldEfficiency+cycleEnsemble.bonus.shieldEfficiency))+cycleEnsemble.bonus.shield;
  const beforeLeadShield=shield;shield=Math.max(0,Math.min(90,shield+bonus));if(shield>beforeLeadShield){battleWaveform?.trigger('shield');globalThis.ExperienceUI?.shield(shield-beforeLeadShield,'lead');}renderBattlePlan();
  const drums=tracks.get('drums')??[],rendered=Quantize.render(drums,lastBpm,lastDuration);
  const groove=Groove.analyzeRelations(drums,hatNotes,lastBpm,lastDuration);
  const a=Ensemble.attack(PerformanceCombat.enhance(Groove.enrich(Rhythm.analyze(rendered,lastDuration,lastBpm),groove),drums,lastBpm,zones,cycleLead),cycleEnsemble);
  const bassStyle=Synth.style(synthTracks.get('bass'),tracks.get('bass')??[],lastDuration),leadStyle=Synth.style(synthTracks.get('lead'),tracks.get('lead')??[],lastDuration);const tone={attack:1+((bassStyle.attack-1)+(leadStyle.attack-1))*.5,accuracy:0,weaken:0};
  a.power*=tone.attack;a.accuracy=Math.max(0,Math.min(.99,a.accuracy+tone.accuracy));a.timbreWeaken=tone.weaken;
  a.powerSteps=[...(a.powerSteps??[]),{label:'Bass / Lead音色と演奏の相性（各1/2）',value:a.power,multiplier:tone.attack}];
  if(globalThis.PitchCombat)Object.assign(a,PitchCombat.apply(a,cycleBass?.pitch,cycleLead?.pitch));
   const result=Rhythm.resolve(a,enemies[stage]),report=CombatFeedback.explain(a,result,enemies[stage],'drums');activeReport=report;
  const [name,prefix,color]=elements[a.element];$('result').hidden=false;$('element').textContent=a.count?name+' / DRUMS':'静寂';$('element').style.color=color;
  $('moveName').textContent=a.count?prefix+(a.hits>=4?'連打':a.weight>.65?'重撃':'撃'):'静寂の防陣';$('damage').textContent='0';$('damageLabel').textContent='TOTAL DAMAGE';$('hitInfo').textContent=`${report.hitCount} HIT / ${a.count?a.hits:0} STRIKE`;
  // Retain weak-point priority, then show the strongest chosen performance bonuses.
  const extras=[];
  if(notes.length)extras.push({id:'leadSupport',source:'lead-support',tag:'支援！',text:cycleLead.description,priority:3});
  report.factors=[...report.factors.filter(f=>f.priority===1),...report.factors.filter(f=>f.id==='rhythm-quality'),...extras,...report.factors.filter(f=>f.priority!==1&&f.id!=='rhythm-quality')].slice(0,3);
  report.hasSupport=notes.length>0;renderReport(report);showToneResult(['bass','lead']);renderEnsemble(cycleEnsemble,tracks,lastBpm);$('detailHint').textContent+=` / ${cycleLead.description} / Bassの盾 ${shield}（Lead追加 ${bonus>=0?'+':''}${bonus}、音色分 ${toneShield>=0?'+':''}${toneShield}）`;
  if(lastInstrument==='drums'){
    const pq=a.performanceQuality??{multiplier:1};
    $('performanceSummary').textContent=`PERFORMANCE 再現性 ${Math.round(pq.multiplier*100)}%`;
    if(groove&&groove.confidence>.15){
      const g=groove;
      const id=['pocket','laidBack','pushed','snarePushed','swing','drunk','tight'].sort((x,y)=>(g[y]??0)-(g[x]??0))[0];
      const labels={pocket:'ポケット',laidBack:'レイドバック',pushed:'前ノリ',snarePushed:'前ノリスネア',swing:'スウィング',drunk:'再現する揺れ',tight:'タイト'};
      if(g[id]>.15)$('grooveSummary').textContent=`GROOVE ${labels[id]}`;
      else $('grooveSummary').textContent='';
    } else {
      $('grooveSummary').textContent='';
    }
  }
  // Show the actual attacking drum cells, while keeping all three recorded voices for replay.
  const leadLast=last;last=rendered;lastInstrument='drums';sequence(a);annotateSequence(a,report);last=leadLast;lastInstrument='lead';
  globalThis.PitchUI?.result(cycleBass,cycleLead,a,result);
  globalThis.ExperienceUI?.begin({enemy:enemies[stage],bpm:lastBpm,duration:lastDuration,tracks:Array.from(tracks,([voice,notes])=>({voice,notes,synth:synthTracks.get(voice)})),hats:hatNotes,conditions:{hp,shield:feedbackCarryShield,enemyHp}},{analysis:a,result,shield});
  if(globalThis.ExperienceUI)ExperienceUI.waveform=battleWaveform;
  rememberSequence('attack');$('replay').disabled=true;await playbackAttack(result,color,'drums');
  if(hp<=0||enemyHp<=0){globalThis.ExperienceUI?.complete(hp,enemyHp,false);if(completeBattle())return;}
  await enemyCounter(a,report,result);globalThis.ExperienceUI?.complete(hp,enemyHp,true);if(completeBattle())return;
 }
 if(completeBattle())return;
 $('replay').disabled=!lastMix.length;turn++;advanceGridHazards();update();
 if(continuousRunning){
  // Combat still resolves normally after Lead. The next cycle starts itself;
  // only Drums -> Bass -> Lead share the previous exact recording boundary.
  prepareTracksForTurn();
  return countIn(nextRecordingPhase(),lastInstrument==='lead'?null:continuationAt);
 }
 ready();
}
$('replay').onclick=()=>{
 if(!['ready','cleared','over'].includes(state)||!lastMix?.length)return;
 audio();if(replaying){stopReplay();return;}globalThis.stopHistoryPlayback?.();
 replaying=true;$('replay').textContent='■ 再生を停止';playFilterAutomation(filterLastMix);
 const timeline=soundTimeline(lastMix,null,[],lastDuration);
 startSavedMusic(lastAccompaniment,ctx.currentTime-timeline.offset,ctx.currentTime-timeline.offset+lastDuration,'result');
 timeline.events.forEach(event=>replayTimers.push(setTimeout(()=>{
  sound(event.type,undefined,event.voice,.8,event.duration,event.pitch,event.midi,undefined,recordedSynth(event.voice,event.time));
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
 globalThis.PitchUI?.draw(paint,w,h);
 if(state==='recording'||attackPlayhead!==null){
  const elapsed=attackPlayhead!==null?Math.min(duration,attackPlayhead):Math.max(0,Math.min(duration,ctx.currentTime-recordAudioAt));
  $('timer').textContent=Math.max(0,duration-elapsed).toFixed(2);paint.strokeStyle='#eff1e9';const x=22+(w-24)*elapsed/duration;paint.beginPath();paint.moveTo(x,0);paint.lineTo(x,h);paint.stroke();
 }
 document.querySelectorAll('#beatLights i').forEach((light,i)=>light.classList.toggle('on',i===visualBeat));
 requestAnimationFrame(draw);
}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){enemyMusic?.stop();releaseAllInputs();stopReplay();if(state==='recording')$('hint').textContent='演奏時間はタブを離れても進みます。';}else if(ctx){ctx.resume();syncEnemyMusic();}});update();draw();
