let historyStorage;
try{historyStorage=localStorage;}catch{}
const sequenceStore=SequenceHistory.createStore(historyStorage);
let historyPlaying=null,historyClock=null,historyHandles=[];
function historyStorageNote(){
 $('historyStorage').textContent=sequenceStore.persistent?'直近50件をこのブラウザに自動保存します。':'ブラウザへ保存できないため、このプレイ中の履歴です。JSONで保存できます。';
}
globalThis.captureHistory=info=>{
 if(!info.tracks.some(track=>track.notes.length))return;
 try{sequenceStore.add(SequenceHistory.snapshot(info));historyStorageNote();}
 catch{$('historyMessage').textContent='この演奏は履歴に記録できませんでした。';}
};
globalThis.stopHistoryPlayback=()=>{
 clearInterval(historyClock);historyClock=null;
 historyHandles.forEach(handle=>handle?.release?.());historyHandles=[];
 const wasPlaying=historyPlaying;historyPlaying=null;if(wasPlaying&&$('historyDialog').open)renderHistory();
};
async function playHistory(entry){
 if(historyPlaying===entry.id){stopHistoryPlayback();return;}
 stopReplay();audio();historyPlaying=entry.id;renderHistory();
 await ctx.resume();if(globalThis.DrumAudio)await DrumAudio.ready;
 if(historyPlaying!==entry.id)return;
 const timeline=Rhythm.mixTimeline(entry.tracks,null,[],entry.duration),origin=ctx.currentTime+.06;
 const end=Math.max(timeline.duration,...timeline.events.map(event=>event.at+(event.voice==='drums'||event.voice==='hat'?(DrumAudio.duration(event.voice==='hat'?'hat':event.type)||.2):(event.duration??(event.voice==='bass'?.15:event.voice==='chord'?.32:.17))+.25)));
 let index=0;
 function tick(){
  const elapsed=ctx.currentTime-origin;
  while(index<timeline.events.length&&timeline.events[index].at<=elapsed+.1){
   const event=timeline.events[index++];
   const handle=sound(event.type,Math.max(ctx.currentTime,origin+event.at),event.voice,event.voice==='chord'?.9:.8,event.duration,event.pitch,event.midi,event.pitches);
   if(handle?.release)historyHandles.push(handle);
  }
  if(elapsed>=end)stopHistoryPlayback();
 }
 historyClock=setInterval(tick,20);tick();
}
function downloadSequence(entry,format){
 const midi=format==='mid',data=midi?SequenceHistory.midi(entry):JSON.stringify(entry,null,2);
 const url=URL.createObjectURL(new Blob([data],{type:midi?'audio/midi':'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='RIDUMU-'+entry.createdAt.replace(/[:.]/g,'-')+'-'+entry.kind+'.'+format;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderHistory(){
 historyStorageNote();const list=$('historyList');list.replaceChildren();
 const entries=sequenceStore.list();
 if(!entries.length){const empty=document.createElement('p');empty.textContent='演奏すると自動で履歴に残ります。';list.append(empty);return;}
 for(const entry of entries){
  const card=document.createElement('article'),title=document.createElement('h3'),meta=document.createElement('p'),actions=document.createElement('div');
  card.className='history-entry';actions.className='history-actions';title.textContent=entry.title;
  const when=new Date(entry.createdAt).toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const names={hat:'Hat',drums:'Drums',bass:'Bass',lead:'Lead',chord:'Chords'};
  meta.textContent=`${when} · ${entry.enemy} · ${entry.bpm} BPM · TURN ${entry.turn} / `+entry.tracks.filter(t=>t.notes.length).map(t=>names[t.voice]).join(' + ');
  for(const [label,action] of [[historyPlaying===entry.id?'■ 停止':'▶ 再生',()=>playHistory(entry)],['MIDI保存',()=>downloadSequence(entry,'mid')],['JSON保存',()=>downloadSequence(entry,'json')],['削除',()=>{if(historyPlaying===entry.id)stopHistoryPlayback();sequenceStore.remove(entry.id);renderHistory();}]]){
   const button=document.createElement('button');button.type='button';button.className='small';button.textContent=label;button.onclick=action;actions.append(button);
  }
  card.append(title,meta,actions);list.append(card);
 }
}
$('openHistory').onclick=()=>{
 if(!['ready','cleared','over'].includes(state))return;
 releaseAllInputs();stopReplay();$('historyMessage').textContent='';renderHistory();$('historyDialog').showModal();
};
$('closeHistory').onclick=()=>$('historyDialog').close();
$('historyDialog').addEventListener('close',()=>stopHistoryPlayback());
$('importHistory').onclick=()=>$('historyImport').click();
$('historyImport').onchange=async()=>{
 const file=$('historyImport').files?.[0];if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('5MB以下のシーケンスJSONを選んでください。');
  const entry=SequenceHistory.validate(JSON.parse(await file.text()));sequenceStore.add(entry);renderHistory();$('historyMessage').textContent='読み込みました。再生できます。';
 }catch(error){$('historyMessage').textContent=error instanceof SyntaxError?'JSONを読み取れませんでした。':error.message;}
 $('historyImport').value='';
};
historyStorageNote();
