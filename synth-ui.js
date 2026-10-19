/* Dialog presentation is separate from the audio and battle model. */
(function(){
 const $=id=>document.getElementById(id),dialog=$('synthDialog'),inputs=new Map(),meters=new Map();
 let voice='bass',preview=null,previewTimer=null;
 const controls={cutoff:['Cutoff','Hz',true],resonance:['Resonance','',false],attack:['Attack','s',false],decay:['Decay','s',false],sustain:['Sustain','%',false],release:['Release','s',false],harmonic:['倍音（+1 octave）','%',false],toneDecay:['Filter Decay','s',false],toneSustain:['Filter Sustain','%',false]};
 const waveLabel=document.createElement('label'),wave=document.createElement('select');wave.id='synth-wave';
 waveLabel.append('波形 ',wave);for(const [value,text] of [['sine','Sine'],['triangle','Triangle'],['sawtooth','Saw'],['square','Square']]){const option=document.createElement('option');option.value=value;option.textContent=text;wave.append(option);}
 wave.onchange=()=>Synth.setPatch(voice,{wave:wave.value});$('synthParameters').append(waveLabel);
 const curveLabel=document.createElement('label'),curve=document.createElement('select');curve.id='synth-curve';curveLabel.append('音量カーブ ',curve);for(const [value,text] of [['linear','Linear / 直線'],['exponential','Exponential / 以前のリード']]){const option=document.createElement('option');option.value=value;option.textContent=text;curve.append(option);}curve.onchange=()=>Synth.setPatch(voice,{curve:curve.value});$('synthParameters').append(curveLabel);
 for(const [key,[name,unit,log]] of Object.entries(controls)){
  const label=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');
  input.type='range';input.id='synth-'+key;input.min=log?0:Synth.ranges[key][0];input.max=log?1:Synth.ranges[key][1];input.step=log?.001:key==='resonance'?.1:.001;input.setAttribute('aria-label',name);output.htmlFor=input.id;
  caption.append(name,output);label.append(caption,input);$('synthParameters').append(label);inputs.set(key,{input,output,unit,log});
  input.oninput=()=>Synth.setPatch(voice,{[key]:log?80*Math.pow(200,Number(input.value)):Number(input.value)});
 }
 function render(){
  const {patch:p,pad}=Synth.current(voice);wave.value=p.wave;curve.value=p.curve;$('synthReset').textContent=voice==='lead'?'以前のリードに戻す':'初期音色';
  for(const [key,{input,output,unit,log}] of inputs){input.value=log?Math.log(p[key]/80)/Math.log(200):p[key];output.textContent=['sustain','harmonic','toneSustain'].includes(key)?Math.round(p[key]*100)+'%':key==='cutoff'?Math.round(p[key])+' Hz':p[key].toFixed(key==='resonance'?1:3)+(unit?' '+unit:'');}
  $('synthEffects').textContent=`Cutoff ${Math.round(Synth.effectiveCutoff(p,pad))} → ${Math.round(Synth.effectiveCutoff(p,pad,p.toneDecay))} Hz / 音色は自由に調整できます。短音・長音の演奏との相性が戦闘スタイルに影響します。`;
  const total=p.attack+p.decay+p.release+.6,x1=10+280*p.attack/total,x2=x1+280*p.decay/total,x3=x2+280*.6/total,y=80-65*p.sustain;
  $('synthEnvelopePath').setAttribute('d',p.curve==='exponential'?`M10 80 Q${x1} 80 ${x1} 15 Q${x1} ${y} ${x2} ${y} L${x3} ${y} Q${x3} 80 290 80`:`M10 80 L${x1} 15 L${x2} ${y} L${x3} ${y} L290 80`);
  $('synthStorage').textContent=Synth.persistent?'BASS / LEADの音色をこのブラウザに保存。録音にはその時の音色と操作を保存します。':'ブラウザへの音色保存ができません。このプレイ中は使用できます。';
 }
 // Named presets are separate from the current automatically saved BASS / LEAD patches.
 const presetKey='ridumu.synth.presets.v1',presetLimit=40;
 let presets=[];
 try{
  const stored=JSON.parse(localStorage.getItem(presetKey)||'[]');
  if(Array.isArray(stored))presets=stored.filter(p=>p&&['bass','lead'].includes(p.voice)&&typeof p.name==='string'&&p.name.length<=40&&p.patch&&typeof p.patch==='object').slice(0,presetLimit);
 }catch{}
 const presetRow=document.createElement('div');
 presetRow.className='synth-preset-row';
 const presetName=document.createElement('input');presetName.type='text';presetName.maxLength=40;presetName.placeholder='音色の名前（例：柔らかいベース）';presetName.setAttribute('aria-label','保存する音色の名前');
 const presetList=document.createElement('select');presetList.setAttribute('aria-label','保存済み音色');presetList.id='synthPresetList';
 const savePreset=document.createElement('button');savePreset.type='button';savePreset.textContent='音色を保存';
 const loadPreset=document.createElement('button');loadPreset.type='button';loadPreset.textContent='読み込む';
 const deletePreset=document.createElement('button');deletePreset.type='button';deletePreset.textContent='削除';
 const presetMessage=document.createElement('p');presetMessage.className='synth-guide';presetMessage.setAttribute('role','status');
 presetRow.append(presetName,savePreset,presetList,loadPreset,deletePreset);
 const presetPanel=document.createElement('div');presetPanel.append(presetRow,presetMessage);
 $('synthParameters').before(presetPanel);
 function refreshPresets(){
  const selected=presetList.value;
  presetList.replaceChildren();
  const matching=presets.map((preset,index)=>({...preset,index})).filter(p=>p.voice===voice);
  for(const item of matching){const option=document.createElement('option');option.value=String(item.index);option.textContent=item.name;presetList.append(option);}
  if(matching.some(p=>String(p.index)===selected))presetList.value=selected;
  loadPreset.disabled=deletePreset.disabled=!matching.length;
 }
 function persistPresets(){
  try{localStorage.setItem(presetKey,JSON.stringify(presets));return true;}
  catch{presetMessage.textContent='保存できませんでした。ブラウザの保存領域を確認してください。';return false;}
 }
 savePreset.onclick=()=>{
  const name=presetName.value.trim();
  if(!name){presetMessage.textContent='音色の名前を入力してください。';return;}
  const previous=presets.findIndex(p=>p.voice===voice&&p.name===name);
  if(previous<0&&presets.length>=presetLimit){presetMessage.textContent='保存上限は40件です。不要な音色を削除してください。';return;}
  const entry={voice,name,patch:Synth.current(voice).patch};
  const updated=presets.slice();
  if(previous>=0)updated[previous]=entry;else updated.push(entry);
  const original=presets;presets=updated;
  if(!persistPresets()){presets=original;return;}
  refreshPresets();presetList.value=String(previous>=0?previous:presets.length-1);
  presetMessage.textContent='「'+name+'」を保存しました。';
 };
 loadPreset.onclick=()=>{
  const preset=presets[Number(presetList.value)];
  if(!preset||preset.voice!==voice)return;
  stopPreview();Synth.setPatch(voice,preset.patch);presetMessage.textContent='「'+preset.name+'」を読み込みました。';
 };
 deletePreset.onclick=()=>{
  const index=Number(presetList.value),preset=presets[index];
  if(!preset||preset.voice!==voice)return;
  const old=presets;presets=presets.filter((_,i)=>i!==index);
  if(!persistPresets()){presets=old;return;}
  refreshPresets();presetMessage.textContent='「'+preset.name+'」を削除しました。';
 };
 function stopPreview(){clearTimeout(previewTimer);previewTimer=null;preview?.release();preview=null;$('synthPreview').textContent='▶ 試聴';}
 $('synthPreview').onclick=()=>{if(preview){stopPreview();return;}audio();preview=Synth.engine(ctx,masterOutput??ctx.destination).play(voice,voice==='bass'?110:440,ctx.currentTime, .8,Infinity);$('synthPreview').textContent='■ 試聴を停止';previewTimer=setTimeout(stopPreview,3000);};
 $('synthVoice').onchange=()=>{stopPreview();voice=$('synthVoice').value;refreshPresets();render();};
 $('synthReset').onclick=()=>Synth.setPatch(voice,Synth.defaults[voice]);
 $('openSynth').onclick=()=>{releaseAllInputs();if(['ready','cleared','over'].includes(state))stopReplay();resetFilterPad();voice=instrumentForTurn(turn).id==='lead'?'lead':'bass';$('synthVoice').value=voice;refreshPresets();render();dialog.showModal();};
 $('closeSynth').onclick=()=>dialog.close();dialog.addEventListener('close',stopPreview);window.addEventListener('blur',stopPreview);
 Synth.subscribe(changed=>{if(changed===voice&&dialog.open)render();});refreshPresets();render();
})();
