/* Real-time performance filter. No randomness, no external dependencies. */
(function(root){
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 let ctx=null,node=null,output=null,volumeNode=null;
 let amount=0,mode='lowpass',volume=1;
 function cutoff(){return mode==='lowpass'?16000*Math.pow(250/16000,amount):30*Math.pow(3500/30,amount);}
 function connect(context,destination){
  if(node&&ctx===context)return node;
  ctx=context;output=destination;node=ctx.createBiquadFilter();
  volumeNode=ctx.createGain();node.Q.value=.75;node.connect(volumeNode);volumeNode.connect(destination);update();return node;
 }
 function update(){if(!node)return;node.type=mode;node.frequency.setTargetAtTime(cutoff(),ctx.currentTime,.018);volumeNode.gain.setTargetAtTime(volume,ctx.currentTime,.018);}
 function set(value,type,level=volume){amount=clamp(Number(value)||0,0,1);volume=clamp(Number(level)||0,0,1);if(type==='lowpass'||type==='highpass')mode=type;update();}
 function combat(){
  // Low-pass: up to 8 extra shield. High-pass: up to 12% attack.
  return {shield:mode==='lowpass'?Math.round(amount*8):0,attack:mode==='highpass'?1+amount*.12:1};
 }
 const api={connect,set,combat,get state(){return {amount,mode,volume,cutoff:cutoff()}}};
 root.PerformanceFilter=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
