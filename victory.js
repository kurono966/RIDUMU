/* Encounter celebration. The battle engine owns progression and rewards. */
(function(root){
 'use strict';
 function fanfare(context,output,{muted=false,final=false}={}){
  if(muted||!context||!output)return ()=>{};
  const bus=context.createGain(),filter=context.createBiquadFilter(),delay=context.createDelay(.3),wet=context.createGain(),feedback=context.createGain();
  const sources=[],nodes=[bus,filter,delay,wet,feedback],at=context.currentTime+.01,end=at+1.82;
  bus.gain.value=.32;filter.type='lowpass';filter.frequency.value=4600;filter.Q.value=.3;
  delay.delayTime.value=.105;wet.gain.value=.16;feedback.gain.value=.14;
  filter.connect(bus);filter.connect(delay);delay.connect(wet);wet.connect(bus);delay.connect(feedback);feedback.connect(delay);bus.connect(output);
  let stopped=false;
  const cleanup=()=>{if(stopped)return;stopped=true;for(const node of nodes)node.disconnect();};
  function tone(midi,time,length,volume){
   const carrier=context.createOscillator(),modulator=context.createOscillator(),depth=context.createGain(),gain=context.createGain();
   const frequency=440*2**((midi-69)/12);
   carrier.type='sine';carrier.frequency.value=frequency;modulator.frequency.value=frequency*2;
   depth.gain.setValueAtTime(frequency*.65,time);depth.gain.exponentialRampToValueAtTime(frequency*.015,time+.25);
   gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,time+length);
   modulator.connect(depth);depth.connect(carrier.frequency);carrier.connect(gain);gain.connect(filter);
   carrier.start(time);modulator.start(time);carrier.stop(time+length+.02);modulator.stop(time+length+.02);
   carrier.onended=()=>{carrier.disconnect();modulator.disconnect();depth.disconnect();gain.disconnect();};sources.push(carrier,modulator);
  }
  function chord(notes,time,length,volume){notes.forEach((note,i)=>tone(note,at+time+i*.012,length,volume));}
  // Soft electric-piano voicings: a compact ii–V–I, with ninths and a quiet echo.
  chord([52,55,59,66],0,.43,.22);                 // Em9, root and upper colour
  chord([45,55,61,66],.21,.48,.21);              // A13
  chord(final?[38,50,57,61,64,66]:[50,57,61,64],.46,final?.95:.83,.23); // Dmaj9 / Dmaj9 without fifth
  if(final){tone(78,at+.78,.5,.15);tone(76,at+.94,.46,.12);}
  bus.gain.setValueAtTime(.32,end-.14);bus.gain.linearRampToValueAtTime(0,end-.01);
  // Keep the short echo alive after the last note, then release the whole graph.
  const tail=context.createConstantSource();tail.offset.value=0;tail.connect(bus);tail.start(at);tail.stop(end);tail.onended=()=>{tail.disconnect();cleanup();};sources.push(tail);
  return ()=>{if(stopped)return;for(const source of sources){try{source.stop();}catch{}}cleanup();};
 }
 const api={fanfare};root.VictoryUI=api;if(typeof module!=='undefined')module.exports=api;
 if(!root.document)return;
 const el=id=>document.getElementById(id),dialog=el('victoryDialog');
 let stopSound=()=>{},revealTimer;
 api.show=({enemy,round,hp,kind,final,rogue,context,output,muted})=>{
  if(dialog.open)return;
  el('victoryKicker').textContent=final?'ALL ENCOUNTERS CLEAR':'ENEMY DEFEATED';
  el('victoryTitle').textContent=final?'完全勝利！':'撃破！';
  el('victoryEnemy').textContent=enemy+' を倒した';
  el('victoryRound').textContent=round+' ROUND';
  el('victoryHp').textContent=hp+' / 100';
  el('victoryDamage').textContent=el('damage').textContent;
  el('victoryReview').textContent=[el('moveName').textContent,el('timingAccuracy').textContent,el('partTimingAccuracy').textContent,el('resultCause').textContent,el('resultFeedback').textContent].filter(Boolean).join('\n');
  dialog.querySelector('details').open=false;
  el('victoryContinue').textContent=final?'もう一度遊ぶ ↗':rogue?'機材と進路を選ぶ ↗':'次の敵へ ↗';
  stopSound();stopSound=fanfare(context,output,{muted,final});
  const delay=root.StageFX?.defeat(kind)??0;
  dialog.classList.toggle('cinematic-entry',delay>0);el('victoryContinue').disabled=delay>0;
  dialog.showModal();
  if(delay)revealTimer=setTimeout(()=>{el('victoryContinue').disabled=false;if(dialog.open)el('victoryContinue').focus();},delay);
  else el('victoryContinue').focus();
 };
 el('victoryContinue').onclick=()=>{dialog.close();el('start').click();};
 el('victoryDismiss').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{clearTimeout(revealTimer);el('victoryContinue').disabled=false;stopSound();el('start').focus();});
 el('sound').addEventListener('click',()=>{if(el('sound').getAttribute('aria-pressed')==='false')stopSound();});
})(globalThis);
