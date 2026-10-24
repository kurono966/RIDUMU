/* Dialog presentation is separate from the audio and battle model. */
(function(){
 const $=id=>document.getElementById(id),dialog=$('synthDialog'),inputs=new Map(),meters=new Map();
 let voice='bass',preview=null,previewTimer=null;
 const controls={cutoff:['Cutoff','Hz',true],resonance:['Resonance','',false],attack:['Attack','s',false],decay:['Decay','s',false],sustain:['Sustain','%',false],release:['Release','s',false],harmonic:['倍音（+1 octave）','%',false],sub:['Sub（−1 octave）','%',false],detune:['Detune / 厚み','cent',false],osc2Mix:['OSC 2 Mix','%',false],osc2Tune:['OSC 2 Tune','半音',false],osc2Fine:['OSC 2 Fine','cent',false],toneDecay:['Filter Decay','s',false],toneSustain:['Filter Sustain','%',false],lfoRate:['LFO Rate','Hz',false],lfoPitch:['Vibrato / ピッチ','cent',false],lfoFilter:['Wobble / フィルター','cent',false],drive:['Drive / 飽和感','%',false]};
 const sections={};
 for(const [id,title,help] of [
  ['osc','OSC 1 / 音の芯とレイヤー','基本波形、オクターブ上の倍音、下のSub、同じ波形のDetuneを重ねます。'],
  ['osc2','OSC 2 / 第2の発振器','別の波形を独立して重ねます。Tuneは半音、Fineは微細な音程差。Mix 0%で無効。'],
  ['filter','FILTER / 明るさと時間変化','Cutoffを起点に、Decayの時間でSustainの割合までフィルターが閉じます。'],
  ['amp','AMP / 音量エンベロープ','Attack＝立ち上がり、Decay＝減衰、Sustain＝保持音量、Release＝離した後の余韻。'],
  ['mod','LFO / 周期的な揺れ','音符ごとに始まる正弦波。Vibratoは音程、Wobbleは明るさを揺らします。各深さが0なら無効。'],
  ['fx','DRIVE / 質感','滑らかな飽和をブレンドします。0%で原音。高くすると倍音と密度が増します。']
 ]){const section=document.createElement('details'),summary=document.createElement('summary'),description=document.createElement('p'),body=document.createElement('div');section.id='synthGroup-'+id;section.className='synth-section';section.open=!['mod','fx'].includes(id);summary.textContent=title;description.textContent=help;description.className='synth-guide';body.className='synth-control-grid';section.append(summary,description,body);$('synthParameters').append(section);sections[id]=body;}
 const sectionFor=key=>key.startsWith('shape')?'shape':key.startsWith('osc2')?'osc2':key.startsWith('lfo')?'mod':['cutoff','resonance','toneDecay','toneSustain'].includes(key)?'filter':['attack','decay','sustain','release'].includes(key)?'amp':key==='drive'?'fx':'osc';
 const factoryPanel=document.createElement('div');factoryPanel.className='synth-factory-presets';
 const factoryLabel=document.createElement('label'),factoryList=document.createElement('select'),factoryHelp=document.createElement('p');
 factoryList.id='synthFactoryPreset';factoryLabel.append('おすすめプリセット ',factoryList);factoryHelp.className='synth-guide';factoryHelp.id='synthFactoryDescription';factoryHelp.setAttribute('role','status');
 factoryPanel.append(factoryLabel,factoryHelp);$('synthParameters').before(factoryPanel);
 function renderFactory(){
  factoryList.replaceChildren();const custom=document.createElement('option');custom.value='';custom.textContent='手動調整 / カスタム';factoryList.append(custom);
  const p=Synth.current(voice).patch,items=Synth.factoryPresets[voice],match=items.find(item=>Object.keys(p).every(k=>p[k]===item.patch[k]));
  for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;factoryList.append(option);}
  factoryList.value=match?.id??'';factoryHelp.textContent=match?.description??'プリセットを選ぶと、このパートに適用します。読み込んだ後も各項目を自由に調整できます。';
 }
 factoryList.onchange=()=>{if(factoryList.value){stopPreview();Synth.applyPreset(voice,factoryList.value);render();}};
 const waveLabel=document.createElement('label'),wave=document.createElement('select');wave.id='synth-wave';
 waveLabel.append('波形 ',wave);for(const [value,text] of [['sine','Sine'],['triangle','Triangle'],['sawtooth','Saw'],['square','Square']]){const option=document.createElement('option');option.value=value;option.textContent=text;wave.append(option);}
 wave.onchange=()=>Synth.setPatch(voice,{wave:wave.value});sections.osc.append(waveLabel);
 // Harmonic offsets change OSC 1 itself; the original base remains visible.
 const shapePanel=document.createElement('details'),shapeTitle=document.createElement('summary'),shapeHelp=document.createElement('p'),shapeBody=document.createElement('div');
 shapePanel.id='synthWaveEditor';shapePanel.className='synth-section synth-wave-editor';shapePanel.open=true;shapeTitle.textContent='基本波形を変形 / 倍音エディター';
 shapeHelp.className='synth-guide';shapeHelp.textContent='第2〜8倍音を足す・引くことで、基本波形を少し変えられます。まず第2・第3倍音を±10〜20%程度で試してください。破線が元の波形、実線が編集後です。';
 const svgNS='http://www.w3.org/2000/svg',shapeGraph=document.createElementNS(svgNS,'svg');shapeGraph.id='synthWaveGraph';shapeGraph.setAttribute('viewBox','0 0 360 100');shapeGraph.setAttribute('role','img');shapeGraph.setAttribute('aria-label','基本波形と編集後の1周期。フィルター前の形を表示');
 const guide=document.createElementNS(svgNS,'path');guide.setAttribute('d','M8 50 H352 M180 8 V92');guide.setAttribute('class','wave-guide');
 const basePath=document.createElementNS(svgNS,'path'),editPath=document.createElementNS(svgNS,'path');basePath.id='synthBaseWavePath';editPath.id='synthEditedWavePath';basePath.setAttribute('class','wave-base');editPath.setAttribute('class','wave-edited');shapeGraph.append(guide,basePath,editPath);
 const resetShape=document.createElement('button');resetShape.type='button';resetShape.id='synthWaveReset';resetShape.className='small';resetShape.textContent='波形の変形だけ元に戻す';resetShape.onclick=()=>Synth.setPatch(voice,Object.fromEntries(Synth.shapeKeys.map(k=>[k,0])));
 shapeBody.className='synth-control-grid';shapePanel.append(shapeTitle,shapeHelp,shapeGraph,shapeBody,resetShape);sections.osc.append(shapePanel);sections.shape=shapeBody;
 for(const key of Synth.shapeKeys)controls[key]=['第'+key.slice(5)+'倍音 / 加減','%',false];

 const osc2Label=document.createElement('label'),osc2Wave=document.createElement('select');osc2Wave.id='synth-osc2Wave';osc2Label.append('OSC 2 波形 ',osc2Wave);
 for(const value of Synth.waves){const option=document.createElement('option');option.value=value;option.textContent=value;osc2Wave.append(option);}osc2Wave.onchange=()=>Synth.setPatch(voice,{osc2Wave:osc2Wave.value});sections.osc2.append(osc2Label);
 const curveLabel=document.createElement('label'),curve=document.createElement('select');curve.id='synth-curve';curveLabel.append('音量カーブ ',curve);for(const [value,text] of [['linear','Linear / 直線'],['exponential','Exponential / 以前のリード']]){const option=document.createElement('option');option.value=value;option.textContent=text;curve.append(option);}curve.onchange=()=>Synth.setPatch(voice,{curve:curve.value});sections.amp.append(curveLabel);
 for(const [key,[name,unit,log]] of Object.entries(controls)){
  const label=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),input=document.createElement('input');
  input.type='range';input.id='synth-'+key;input.min=log?0:Synth.ranges[key][0];input.max=log?1:Synth.ranges[key][1];input.step=log?.001:['osc2Tune','lfoFilter'].includes(key)?1:['resonance','osc2Fine','lfoPitch'].includes(key)?.1:.001;input.setAttribute('aria-label',name);output.htmlFor=input.id;
  caption.append(name,output);label.append(caption,input);sections[sectionFor(key)].append(label);inputs.set(key,{input,output,unit,log});
  input.oninput=()=>Synth.setPatch(voice,{[key]:log?80*Math.pow(200,Number(input.value)):Number(input.value)});
 }
 function render(){
  const {patch:p,pad}=Synth.current(voice);wave.value=p.wave;osc2Wave.value=p.osc2Wave;curve.value=p.curve;$('synthReset').textContent=voice==='lead'?'以前のリードに戻す':'初期音色';
  renderFactory();
  const original={...p,...Object.fromEntries(Synth.shapeKeys.map(k=>[k,0]))},baseSamples=Array.from({length:193},(_,i)=>Synth.waveform(original,i/192)),editSamples=Array.from({length:193},(_,i)=>Synth.waveform(p,i/192));
  const scale=Math.max(1,...baseSamples.map(Math.abs),...editSamples.map(Math.abs));
  const plot=values=>values.map((v,i)=>(i?'L':'M')+(8+i/192*344).toFixed(2)+' '+(50-v/scale*39).toFixed(2)).join(' ');
  basePath.setAttribute('d',plot(baseSamples));editPath.setAttribute('d',plot(editSamples));
  for(const [key,{input,output,unit,log}] of inputs){input.value=log?Math.log(p[key]/80)/Math.log(200):p[key];output.textContent=(Synth.shapeKeys.includes(key)||['sustain','harmonic','sub','toneSustain','osc2Mix','drive'].includes(key))?Math.round(p[key]*100)+'%':key==='cutoff'?Math.round(p[key])+' Hz':p[key].toFixed(['resonance','detune','osc2Fine','lfoPitch'].includes(key)?1:key==='osc2Tune'||key==='lfoFilter'?0:3)+(unit?' '+unit:'');}
  const bpm=timing().bpm,rows=$('synthCombatRows');rows.replaceChildren();$('synthCombatContext').textContent=`BPM ${bpm}での目安。攻撃欄はこのパートの寄与（他パートは補正なしと仮定）。実際の補正は録音後の結果の内訳で確認できます。`;$('synthShieldHeading').textContent=voice==='bass'?'Bass盾生成':'Bass元盾への支援';
  for(const example of Synth.combatGuide(p,voice,bpm)){const row=document.createElement('tr');for(const text of [example.name,example.attack,example.shield]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}rows.append(row);}
  $('synthEffects').textContent=`OSC 1 + OSC 2 → Filter → Drive → AMP。Cutoff ${Math.round(Synth.effectiveCutoff(p,pad))} → ${Math.round(Synth.effectiveCutoff(p,pad,p.toneDecay))} Hz。`;
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
 const presetPanel=document.createElement('details'),presetTitle=document.createElement('summary');presetTitle.textContent='自分の音色 / 保存・読み込み';presetPanel.className='synth-user-presets';presetPanel.append(presetTitle,presetRow,presetMessage);
 $('synthParameters').before(presetPanel);
 function refreshPresets(){
  const selected=presetList.value;
  presetList.replaceChildren();
  const matching=presets.map((preset,index)=>({...preset,index})).filter(p=>p.voice===voice);
  if(matching.length)presetPanel.open=true;
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
  stopPreview();Synth.setPatch(voice,Synth.patch(preset.patch,voice));presetMessage.textContent='「'+preset.name+'」を読み込みました。';
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
