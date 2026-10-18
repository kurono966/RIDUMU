/* No audio, timing, combat or recording writes. Analyze only changed inputs. */
(function(root){
 const M=root.ElementMeter,el=id=>document.getElementById(id),keys=Object.keys(M.names),motion=matchMedia('(prefers-reduced-motion: reduce)');
 let frozen=null,model=null,stageKey=stage,signature=null,selected='earth',hintTimer=null;
 const busy=()=>['recording','countin','attack','enemyAttack'].includes(state);
 function reset(){frozen=null;signature=null;model=null;el('elementHint').hidden=true;}
 function draw(next){
  const previous=model;model=next;const meter=el('elementMeter');meter.hidden=false;meter.dataset.element=next.dominant??'';meter.dataset.certainty=next.final?'final':next.count?'prediction':'waiting';meter.classList.toggle('is-close',next.close&&!!next.dominant);
  el('elementStatus').textContent=next.final?(next.count?'確定':'無音'):next.count?(next.sufficient?'予測':'予測?'):'待機';
  meter.setAttribute('aria-label','ドラム属性：'+el('elementStatus').textContent+(next.dominant?'・'+M.names[next.dominant]+'が優勢':'')+(next.close&&next.dominant?'・僅差':''));
  el('elementStatus').title=next.count?(next.final?'確定属性：':'予測属性：')+M.names[next.actualElement]+(next.close?'・'+M.names[next.rank[1]]+'と僅差':'')+(next.sufficient?'':'・入力が少ないため情報は限定的です'):'ドラム入力待ち';
  for(const key of keys){const button=el('element-'+key);button.style.setProperty('--share',(next.shares[key]*100).toFixed(3)+'%');button.classList.toggle('dominant',next.dominant===key);button.classList.toggle('contending',next.close&&!!next.dominant&&next.rank.slice(0,2).includes(key));button.setAttribute('aria-label',M.names[key]+'：'+(next.count?next.scores[key].toFixed(3):'未入力')+'。'+M.tips[key]);button.title=M.names[key]+'：'+M.tips[key];}
  if(previous?.dominant&&next.dominant&&previous.dominant!==next.dominant&&!motion.matches&&root.ExperienceUI?.enabled!==false)el('element-'+next.dominant).animate([{transform:'translateY(-2px)'},{transform:'translateY(0)'}],{duration:240,easing:'ease-out'});
  if(el('elementDialog').open)renderDetails();root.RidumuUI?.refresh();
 }
 function finalize(drums,hats,bpm,duration){frozen={stage,model:M.analyze(drums,hats,bpm,duration,true)};signature=null;draw(frozen.model);}
 function observe(){
  if(stageKey!==stage){stageKey=stage;reset();}
  const live=instrumentForTurn(turn).id==='drums'&&phase==='parts'&&['recording','countin'].includes(state),source=live?notes:null;
  const next=[stage,live,source,source?.length,hatNotes,hatNotes.length,timing().bpm,frozen];if(signature&&next.every((v,i)=>v===signature[i]))return;signature=next;
  draw(live?M.analyze(notes,hatNotes,timing().bpm,timing().duration):frozen?.model??M.analyze([],[],timing().bpm,timing().duration));
 }
 function renderDetails(){
  const table=el('elementScores');table.replaceChildren();for(const key of keys){const row=document.createElement('tr'),name=document.createElement('th'),score=document.createElement('td'),share=document.createElement('td');name.scope='row';name.textContent=M.icons[key]+' '+M.names[key];score.textContent=(model?.scores[key]??0).toFixed(4);share.textContent=((model?.shares[key]??0)*100).toFixed(1)+'%';row.append(name,score,share);table.append(row);el('element-help-'+key).open=key===selected;}
  el('elementExplanation').textContent=(model?.reason??'ドラム入力待ち')+'。'+(model?.final?'グルーヴ補正込みの確定値です。':'2小節全体を基準にした途中予測です。入力の追加やグルーヴ解析で順位が変わります。')+(model?.close?' 僅差の属性が競り合っています。同点の扱いは戦闘判定と同じです。':'');
 }
 function select(key,detail=false){
  selected=key;observe();if(busy()){el('elementHint').textContent=detail?keys.map(k=>M.names[k]+' '+(model?.scores[k]??0).toFixed(2)).join(' / ')+'（'+(model?.final?'確定':'途中予測')+'）':M.names[key]+'：'+M.tips[key];el('elementHint').hidden=false;clearTimeout(hintTimer);hintTimer=setTimeout(()=>{el('elementHint').hidden=true;},2200);return;}
  renderDetails();el('elementDialog').showModal();
 }
 for(const key of keys)el('element-'+key).onclick=()=>select(key);
 el('elementMore').onclick=()=>select(model?.actualElement??selected,true);el('closeElementDialog').onclick=()=>el('elementDialog').close();
 root.ElementMeterUI={observe,finalize,reset,get model(){return model;},get instruction(){return state==='recording'&&phase==='parts'&&instrumentForTurn(turn).id==='drums'&&model?.count?model.reason+' · '+(model.sufficient?'予測':'まだ少数・予測'):null;}};
 observe();
})(globalThis);
