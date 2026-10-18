/* Dialog presentation is separate from the audio and battle model. */
(function(){
 const $=id=>document.getElementById(id),dialog=$('synthDialog'),inputs=new Map(),meters=new Map();
 let voice='bass',preview=null,previewTimer=null;
 const liveMeters=new Map();
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
 const colors={fire:'#ffa26d',water:'#86cee8',wind:'#9adfd5',earth:'#d4f77d'};
 for(const key of Object.keys(colors)){const live=document.createElement('label'),bar=document.createElement('meter');bar.min=0;bar.max=1;bar.style.setProperty('--tone-color',colors[key]);bar.setAttribute('aria-label',Synth.labels[key]+'の強さ');live.append(Synth.labels[key],bar);$('liveToneGauges').append(live);liveMeters.set(key,bar);const row=document.createElement('label'),name=document.createElement('span'),meter=document.createElement('meter'),output=document.createElement('output');name.textContent=Synth.labels[key];meter.min=0;meter.max=1;meter.setAttribute('aria-label',Synth.labels[key]+'の強さ');meter.style.setProperty('--tone-color',colors[key]);row.append(name,meter,output);$('synthGauges').append(row);meters.set(key,{meter,output});}
 function renderLive(){const part=instrumentForTurn(turn).id;const enabled=Synth.voices.includes(part);$('liveToneGauges').hidden=!enabled;if(!enabled)return;const point=Synth.current(part),s=Synth.traits(point.patch,point.pad);for(const [key,bar] of liveMeters){bar.value=s[key];bar.title=Synth.labels[key]+Math.round(s[key]*100)+'%';}}
 function render(){
  const {patch:p,pad}=Synth.current(voice),scores=Synth.traits(p,pad);wave.value=p.wave;curve.value=p.curve;$('synthReset').textContent=voice==='lead'?'以前のリードに戻す':'初期音色';
  for(const [key,{input,output,unit,log}] of inputs){input.value=log?Math.log(p[key]/80)/Math.log(200):p[key];output.textContent=['sustain','harmonic','toneSustain'].includes(key)?Math.round(p[key]*100)+'%':key==='cutoff'?Math.round(p[key])+' Hz':p[key].toFixed(key==='resonance'?1:3)+(unit?' '+unit:'');}
  for(const [key,{meter,output}] of meters){meter.value=scores[key];output.textContent=Math.round(scores[key]*100)+'%';}
  const m=Synth.modifiers(scores);$('synthEffects').textContent=`Cutoff ${Math.round(Synth.effectiveCutoff(p,pad))} → ${Math.round(Synth.effectiveCutoff(p,pad,p.toneDecay))} Hz / 攻撃 ×${m.attack.toFixed(2)}・盾 ×${m.shield.toFixed(2)}・命中 ${m.accuracy>=0?'+':''}${(m.accuracy*100).toFixed(1)}pt・湿潤 敵攻撃 −${(m.weaken*100).toFixed(1)}%`;
  const total=p.attack+p.decay+p.release+.6,x1=10+280*p.attack/total,x2=x1+280*p.decay/total,x3=x2+280*.6/total,y=80-65*p.sustain;
  $('synthEnvelopePath').setAttribute('d',p.curve==='exponential'?`M10 80 Q${x1} 80 ${x1} 15 Q${x1} ${y} ${x2} ${y} L${x3} ${y} Q${x3} 80 290 80`:`M10 80 L${x1} 15 L${x2} ${y} L${x3} ${y} L290 80`);
  $('synthStorage').textContent=Synth.persistent?'BASS / LEADの音色をこのブラウザに保存。録音にはその時の音色と操作を保存します。':'ブラウザへの音色保存ができません。このプレイ中は使用できます。';
 }
 function stopPreview(){clearTimeout(previewTimer);previewTimer=null;preview?.release();preview=null;$('synthPreview').textContent='▶ 試聴';}
 $('synthPreview').onclick=()=>{if(preview){stopPreview();return;}audio();preview=Synth.engine(ctx,masterOutput??ctx.destination).play(voice,voice==='bass'?110:440,ctx.currentTime, .8,Infinity);$('synthPreview').textContent='■ 試聴を停止';previewTimer=setTimeout(stopPreview,3000);};
 $('synthVoice').onchange=()=>{stopPreview();voice=$('synthVoice').value;render();};
 $('synthReset').onclick=()=>Synth.setPatch(voice,Synth.defaults[voice]);
 $('openSynth').onclick=()=>{releaseAllInputs();if(['ready','cleared','over'].includes(state))stopReplay();resetFilterPad();voice=instrumentForTurn(turn).id==='lead'?'lead':'bass';$('synthVoice').value=voice;render();dialog.showModal();};
 $('closeSynth').onclick=()=>dialog.close();dialog.addEventListener('close',stopPreview);window.addEventListener('blur',stopPreview);
 Synth.subscribe(changed=>{renderLive();if(changed===voice&&dialog.open)render();});render();renderLive();
})();
