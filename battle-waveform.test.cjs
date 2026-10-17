const {test}=require('node:test'),assert=require('node:assert/strict'),W=require('./battle-waveform.js');
function fixture(signal=true){
 const callbacks=new Map(),listeners=new Map(),frames=[];let serial=0,reads=0;
 const signalData=new Float32Array(2048);if(signal)for(let i=0;i<2048;i++)signalData[i]=Math.sin(i*.04)*.15;
 const analyser={connect(to){this.output=to},disconnect(){this.disconnected=true},getFloatTimeDomainData(buffer){reads++;buffer.set(signalData);this.lastBuffer=buffer}};
 const ctx={currentTime:0,destination:{},createAnalyser:()=>analyser},master={connections:[],connect(to){this.connections.push(to)},disconnect(to){this.connections=this.connections.filter(n=>n!==to)}};
 const paint={setTransform(){},clearRect(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},ellipse(){}};
 const canvas={width:0,height:0,getContext:()=>paint,getBoundingClientRect:()=>({width:320,height:180})};
 const doc={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const engine=W.connect(ctx,master,canvas,{document:doc,pixelRatio:3,requestFrame:fn=>{callbacks.set(++serial,fn);return serial},cancelFrame:id=>callbacks.delete(id)});
 const name='test-'+Math.random();W.registerRenderer(name,(_p,frame)=>frames.push(frame));engine.setRenderer(name);
 function tick(t){ctx.currentTime=t;const first=callbacks.entries().next().value;assert.ok(first);callbacks.delete(first[0]);first[1](t*1000);}
 return {ctx,master,analyser,canvas,doc,engine,signalData,frames,callbacks,listeners,tick,get reads(){return reads}};
}
test('analyser is the only master output route and cleanup restores direct audio once',()=>{
 const f=fixture();assert.deepEqual(f.master.connections,[f.analyser]);assert.equal(f.analyser.output,f.ctx.destination);assert.equal(f.analyser.fftSize,2048);
 f.engine.dispose();f.engine.dispose();assert.deepEqual(f.master.connections,[f.ctx.destination]);assert.equal(f.callbacks.size,0);assert.equal(f.analyser.disconnected,true);
});
test('visualization reads the actual audio buffer without changing its samples',()=>{
 const f=fixture();f.tick(.1);assert.equal(f.reads,1);assert.deepEqual(f.frames[0].samples,f.signalData);
 assert.equal(f.frames[0].analyser,f.analyser);assert.ok(f.frames[0].energy>.05);assert.ok(f.frames[0].points<=320);
 assert.equal(f.canvas.width,480);assert.equal(f.canvas.height,270);f.engine.dispose();
});
test('note effects follow the audio clock and element emphasis expires',()=>{
 const f=fixture();f.engine.note('kick','drums',1);f.tick(.1);assert.equal(f.frames.at(-1).effects.strength,0);
 f.tick(1);assert.equal(f.frames.at(-1).effects.strength,.8);
 f.engine.trigger('hit',{element:'fire',groove:{laidBack:.7},amount:1});f.tick(1.05);
 assert.equal(f.frames.at(-1).color,'#ffa26d');assert.equal(f.frames.at(-1).effects.groove.laidBack,.7);
 f.tick(2);assert.equal(f.frames.at(-1).color,'#a4b99c');assert.equal(f.frames.at(-1).effects.strength,0);f.engine.dispose();
});
test('hidden documents pause and resume a single animation loop',()=>{
 const f=fixture();f.doc.hidden=true;f.listeners.get('visibilitychange')();assert.equal(f.callbacks.size,0);
 f.doc.hidden=false;f.listeners.get('visibilitychange')();f.listeners.get('visibilitychange')();assert.equal(f.callbacks.size,1);
 f.tick(.2);assert.equal(f.reads,1);f.engine.dispose();assert.equal(f.listeners.size,0);
});
test('silence has no artificial waveform while shields can emit a short pulse',()=>{
 const f=fixture(false);f.tick(.1);assert.equal(f.frames.length,0);
 f.engine.trigger('shield');f.tick(.2);assert.ok(f.frames.at(-1).effects.shield>0);
 const count=f.frames.length;f.tick(2);assert.equal(f.frames.length,count);f.engine.dispose();
});
test('waveform metrics are finite for silence and use real amplitude',()=>{
 assert.deepEqual(W.metrics(new Float32Array(8)),{rms:0,peak:0});
 assert.deepEqual(W.metrics(new Float32Array([1,-1,1,-1])),{rms:1,peak:1});
});
test('the standard renderer preserves audio samples with overlapping combat effects',()=>{
 const f=fixture();f.engine.setRenderer('horizontal');
 for(const kind of ['shield','power','boost','enemy','poison','synergy'])f.engine.trigger(kind,{element:'lightning',groove:{laidBack:.8,swing:.6,drunk:.5,unstable:.2},amount:1});
 f.engine.setVoice('bass');f.tick(.1);assert.deepEqual(f.analyser.lastBuffer,f.signalData);f.engine.dispose();
});
