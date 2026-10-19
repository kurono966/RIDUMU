/* Title and mode selection; existing battle engine remains authoritative. */
(function(){
 'use strict';
 const screen=document.getElementById('titleScreen');
 const titleButton=document.getElementById('returnTitle');
 screen.querySelectorAll('[data-choose-mode]').forEach(button=>button.addEventListener('click',()=>{
  prepareMode(button.dataset.chooseMode);
  screen.hidden=true;
  document.getElementById('start').focus();
 }));
 titleButton.addEventListener('click',()=>{
  if(!['ready','cleared','over'].includes(state)){
   document.getElementById('hint').textContent='演奏中はタイトルへ戻れません。停止してから選択してください。';
   return;
  }
  stopReplay();
  enemyMusic?.stop();
  screen.hidden=false;
  screen.querySelector('[data-choose-mode="normal"]').focus();
 });
})();
