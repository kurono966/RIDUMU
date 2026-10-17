const {test}=require('node:test'),assert=require('node:assert/strict'),Bass=require('./bass-audio.js');
function fixture(){
 const nodes=[];
 const param=(value=0)=>({value,events:[],setValueAtTime(v,t){this.events.push(['set',v,t])},exponentialRampToValueAtTime(v,t){this.events.push(['exp',v,t])},linearRampToValueAtTime(v,t){this.events.push(['linear',v,t])},cancelScheduledValues(t){this.events.push(['cancel',t])}});
 function node(kind){const n={kind,connections:[],connect(to){this.connections.push(to)},disconnect(){this.disconnected=true}};nodes.push(n);return n;}
 const ctx={currentTime:0,sampleRate:48000,destination:{},createGain(){return Object.assign(node('gain'),{gain:param(1)})},createBiquadFilter(){return Object.assign(node('filter'),{frequency:param(),Q:param()})},createWaveShaper(){return node('shaper')},createDynamicsCompressor(){return Object.assign(node('compressor'),{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()})},createOscillator(){return Object.assign(node('oscillator'),{frequency:param(),starts:[],stops:[],start(t){this.starts.push(t)},stop(t){this.stops.push(t)}})}};
 return {ctx,nodes};
}
test('bass shares a dedicated filtered saturated compressor bus before the existing master',()=>{
 const {ctx,nodes}=fixture(),master={threshold:{value:-12},ratio:{value:6}};
 const engine=Bass.get(ctx,master);assert.equal(Bass.get(ctx,master),engine);
 const compressor=nodes.find(n=>n.kind==='compressor'),shaper=nodes.find(n=>n.kind==='shaper');
 assert.equal(nodes.filter(n=>n.kind==='compressor').length,1);assert.ok(compressor.attack.value>=.02);assert.ok(compressor.ratio.value<4);assert.ok(compressor.release.value<.2);
 assert.equal(shaper.oversample,'2x');assert.ok(shaper.curve.every(Number.isFinite));assert.ok(Math.abs(shaper.curve[0]+shaper.curve.at(-1))<1e-6);assert.ok(Math.max(...shaper.curve)<=1);
 assert.equal(nodes.at(-1).connections[0],master);assert.equal(master.ratio.value,6);assert.equal(master.threshold.value,-12);
});
test('bass retains its round fundamental and adds quiet pitch-aligned harmonics for small speakers',()=>{
 const {ctx,nodes}=fixture();Bass.get(ctx).play(65.406,1,1,Infinity);
 const oscillators=nodes.filter(n=>n.kind==='oscillator');assert.deepEqual(oscillators.map(n=>n.type),['sine','triangle','sawtooth','sine','sine','sine','sine']);
 assert.deepEqual(oscillators.map(n=>n.frequency.events[0][1]),[1,1,1,2,3,4,6].map(r=>65.406*r));
 const gains=oscillators.map(n=>n.connections[0].gain.value);
 assert.ok(Math.abs(gains.reduce((a,b)=>a+b,0)-1)<1e-9);assert.ok(gains[0]+gains[1]>=.8-1e-9);assert.ok(gains[2]<=.025);
 assert.ok(oscillators.slice(3).every(n=>n.frequency.events[0][1]>=130));
 const filter=nodes.filter(n=>n.kind==='filter').at(-1);assert.equal(filter.type,'lowpass');assert.equal(filter.frequency.events[0][1],650);assert.equal(filter.frequency.events[1][1],480);
 assert.ok(filter.frequency.events[1][1]>65.406*6,'the phone-audible harmonics remain during sustained notes');
});
test('a tap is short while a held note sustains until release and cleans up its voice',()=>{
 const {ctx,nodes}=fixture(),engine=Bass.get(ctx),voice=engine.play(98,0,1,Infinity);
 const oscillators=nodes.filter(n=>n.kind==='oscillator');assert.ok(oscillators.every(n=>!n.stops.length));
 const envelope=oscillators[0].connections[0].connections[0];assert.ok(envelope.gain.events.some(e=>e[0]==='exp'&&e[1]>.18&&e[2]===.085));
 voice.release(2);assert.ok(oscillators.every(n=>Math.abs(n.stops[0]-2.105)<1e-9));
 let ended=false;voice.onended=()=>ended=true;oscillators[0].onended();assert.equal(ended,true);assert.ok(envelope.disconnected);
 const start=nodes.length;engine.play(98,3);const tap=nodes.slice(start).find(n=>n.kind==='oscillator');assert.ok(Math.abs(tap.stops[0]-3.255)<1e-9);
});
test('Kick only applies a shallow short dip to the bass bus at the scheduled hit',()=>{
 const {ctx,nodes}=fixture(),engine=Bass.get(ctx),duck=nodes.at(-1).gain;
 engine.duckForKick(2,1);assert.ok(duck.events.some(e=>e[0]==='linear'&&e[1]===.78&&e[2]===2.006));assert.ok(duck.events.some(e=>e[0]==='exp'&&e[1]===1&&e[2]===2.11));
 const count=duck.events.length;engine.duckForKick(3,0);assert.equal(duck.events.length,count);
});

test('native cancelAndHold retains the sustain until the recorded gate ends',()=>{
 const {ctx,nodes}=fixture(),createGain=ctx.createGain;
 ctx.createGain=()=>{const node=createGain();node.gain.cancelAndHoldAtTime=t=>node.gain.events.push(['hold',t]);return node;};
 Bass.get(ctx).play(65.406,.05,1,1.2);
 const envelope=nodes.find(n=>n.kind==='oscillator').connections[0].connections[0];
 assert.ok(envelope.gain.events.some(e=>e[0]==='set'&&Math.abs(e[1]-.1872)<1e-9&&e[2]===1.25));
});
