/* Accent existing synth notes only: no extra note, oscillator or input timer. */
(function(root){
 let enabled=true;const recent=new Set();
 function setEnabled(value){enabled=!!value;if(!enabled){for(const h of recent)h.clearEmphasis?.();recent.clear();}}
 function apply(handle,cue,at){if(!enabled||!handle?.emphasize||!['lock','response'].includes(cue.kind))return false;recent.add(handle);if(recent.size>64)recent.delete(recent.values().next().value);return handle.emphasize(cue.kind,cue.strength,at);}
 const api={apply,setEnabled,get enabled(){return enabled;}};root.FeedbackAudio=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
