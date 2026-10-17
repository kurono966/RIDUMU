/* Playback-only quantization. Raw recordings are immutable and live audio is immediate. */
(function(root){
const modes=[
 {id:'off',name:'生演奏',description:'再生も叩いたタイミングのまま。'},
 {id:'just',name:'ジャスト',description:'再生時に最寄りの16分へ揃える。ライブ音はそのまま。'},
 {id:'laidBack',name:'レイドバック',description:'再生時に16分へ揃え、高音側を35ms後ろへ。'},
 {id:'snarePushed',name:'前ノリスネア',description:'再生時にSnareだけ16分へ揃え、テンポに合わせて少し前へ。KickとHatは生演奏のまま。'},
 {id:'drunk',name:'ドランク',description:'再生時に、小節ごとに同じ不均等な揺れを加える。'},
 {id:'swing',name:'スウィング',description:'再生時に8分裏拍を遅らせ、長短のノリを作る。'}
];
const pattern=[0,.018,.032,-.012,-.01,.024,.04,.012,.012,-.016,.028,.006,-.018,.032,.016,-.008];
const mod=(n,m)=>(n%m+m)%m;
function offset(type,slot,step,mode){
 if(mode==='snarePushed')return type==='snare'?-Math.min(.04,step*.24):0;
 if(mode==='laidBack')return type==='snare'?Math.min(.035,step*.4):0;
 if(mode==='swing')return mod(slot,4)===2?step*2/3:0;
 if(mode==='drunk')return Math.max(-step*.35,Math.min(step*.35,pattern[mod(slot,16)]+(type==='kick'?-.006:type==='snare'?.012:0)));
 return 0;
}
function apply(type,inputT,bpm=120,mode='off'){
 if(!modes.some(m=>m.id===mode))mode='off';
 const step=60/bpm/4;
 if(mode==='off'||(mode==='snarePushed'&&type!=='snare'))return {performedT:inputT,slot:Math.round(inputT/step),mode};
 const slot=Math.round(inputT/step);
 return {performedT:slot*step+offset(type,slot,step,mode),slot,mode};
}
function render(notes,bpm,duration){
 const rendered=[];
 for(const note of notes){
  const inputT=note.inputT??note.rawT??note.t;
  const adjusted=apply(note.type,inputT,bpm,note.quantize??'off');
  const inputTimes=[...(note.inputTimes??[inputT])];
  const duplicate=adjusted.mode!=='off'?rendered.find(n=>n.type===note.type&&n.pitch===note.pitch&&n.midi===note.midi&&Math.abs(n.rawT-adjusted.performedT)<1e-7):null;
  if(duplicate){duplicate.inputTimes.push(...inputTimes);if(note.duration!==undefined)duplicate.duration=Math.max(duplicate.duration??0,note.duration);continue;}
  rendered.push({...note,inputT,inputTimes,rawT:adjusted.performedT,t:Math.min(duration-1e-7,Math.max(0,adjusted.performedT)),quantize:adjusted.mode});
 }
 return rendered.sort((a,b)=>a.rawT-b.rawT);
}
root.Quantize={modes,apply,render};if(typeof module!=='undefined')module.exports=root.Quantize;
})(typeof window!=='undefined'?window:globalThis);
