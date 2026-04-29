import * as State from './state.js';

function unlockAudio() { if (!State.audioCtx) { try { State.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} } if (State.audioCtx && State.audioCtx.state === 'suspended') State.audioCtx.resume(); }
        
function playUIClickSound() { unlockAudio(); if(!State.audioCtx) return; let t = State.audioCtx.currentTime; let osc = State.audioCtx.createOscillator(); let gain = State.audioCtx.createGain(); osc.type = 'square'; osc.frequency.setValueAtTime(800, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.1); gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1); osc.connect(gain); gain.connect(State.audioCtx.destination); osc.start(t); osc.stop(t + 0.1); }

function playMonsterScreamSound() { unlockAudio(); if(!State.audioCtx) return; let t = State.audioCtx.currentTime; let osc = State.audioCtx.createOscillator(); let gain = State.audioCtx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(1200, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.5); let lfo = State.audioCtx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 60; let lfoGain = State.audioCtx.createGain(); lfoGain.gain.value = 600; lfo.connect(lfoGain); lfoGain.connect(osc.frequency); lfo.start(t); lfo.stop(t + 0.5); gain.gain.setValueAtTime(1.5, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5); osc.connect(gain); gain.connect(State.audioCtx.destination); osc.start(t); osc.stop(t + 0.5); }

function playPickupSound() {
    unlockAudio(); if(!State.audioCtx) return;
    let t = State.audioCtx.currentTime; let osc = State.audioCtx.createOscillator(); let gain = State.audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, t); osc.frequency.setValueAtTime(1108.73, t + 0.1); osc.frequency.setValueAtTime(1318.51, t + 0.2); 
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.5, t + 0.05); gain.gain.linearRampToValueAtTime(0, t + 0.5);
    osc.connect(gain); gain.connect(State.audioCtx.destination); osc.start(t); osc.stop(t + 0.5);
}

function playFootstepSound() {
    if(!State.audioCtx) return;
    let t = State.audioCtx.currentTime;
    
    let osc = State.audioCtx.createOscillator();
    let gain = State.audioCtx.createGain();
    let filter = State.audioCtx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(120, t); 
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);

    filter.type = 'lowpass';
    filter.frequency.value = 600;

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(filter); filter.connect(gain); gain.connect(State.audioCtx.destination);
    osc.start(t); osc.stop(t + 0.15);
}

export {
    unlockAudio,
    playUIClickSound,
    playMonsterScreamSound,
    playPickupSound,
    playFootstepSound
};