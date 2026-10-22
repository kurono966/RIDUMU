/* Build selectors from the sample catalog so added sounds need no UI edits. */
(function(){
 const sounds=globalThis.DrumAudio,container=document.getElementById('drumSoundSettings');
 if(!sounds||!container)return;
 const status=document.createElement('p');status.className='setting-help';status.setAttribute('role','status');
 for(const [type,name] of [['kick','Kick'],['snare','Snare'],['hat','Hi-hat']]){
  const row=document.createElement('div');row.className='settings-actions';
  const label=document.createElement('label');label.className='quantize-control';
  const caption=document.createElement('span');caption.textContent=name;
  const select=document.createElement('select');select.id='drumSound-'+type;select.setAttribute('aria-label',name+'の音色');
  for(const sound of sounds.list(type)){const option=document.createElement('option');option.value=sound.id;option.textContent=sound.name;select.append(option);}
  select.value=sounds.selected(type);select.onchange=()=>sounds.select(type,select.value);
  label.append(caption,select);
  const preview=document.createElement('button');preview.type='button';preview.className='small';preview.textContent='試聴';preview.setAttribute('aria-label',name+'の音色を試聴');
  preview.onclick=async()=>{
   audio();await ctx.resume();
   if(!await sounds.ready){status.textContent='ドラム音色を読み込めませんでした。';return;}
   if(muted){status.textContent='試聴するにはミュートを解除してください。';return;}
   sampleSound(type,ctx.currentTime);
   status.textContent=name+' / '+select.selectedOptions[0].textContent;
  };
  row.append(label,preview);container.append(row);
 }
 container.append(status);
})();
