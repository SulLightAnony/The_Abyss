import { State } from './state.js';
import { unlockAudio, playUIClickSound } from './audio.js';

function setupControls() {
    const joyArea = document.getElementById('joystick-area'); const stick = document.getElementById('joystick-stick');
    const rightZone = document.getElementById('right-zone'); 
    const smartBtn = document.getElementById('smart-action-btn');
    const flashBtn = document.getElementById('flashlight-btn');
    const jumpBtn = document.getElementById('jump-btn');
    
    // --- PC CONTROL GLOBALS ---
    let keys = { w: false, a: false, s: false, d: false };
    window.pcKeys = keys;
    window.isHoldingAlt = false;
    window.isPointerLocked = false;

    document.addEventListener('pointerlockchange', () => {
        window.isPointerLocked = (document.pointerLockElement === document.body);
    });

    function lockPointer() {
        if (State.gameActive && !window.isHoldingAlt && !State.isJumpscaring && !State.tutorialPause) {
            document.body.requestPointerLock().catch(()=>{});
        }
    }
    window.lockPointer = lockPointer;

    // --- UNIFIED INTERACTION HANDLERS ---
    window.handleSmartBtnStart = (e) => {
        if(e && e.cancelable) e.preventDefault(); 
        if(!State.gameActive || State.isJumpscaring || State.tutorialPause || State.isIntroAnim) return;
        unlockAudio(); 
        if (State.smartBtnState === 'DOOR') { window.advanceLevel(); } 
        else if (State.smartBtnState === 'ITEM') { if(!State.isCameraLocked) { State.isHoldingInteract = true; State.interactProgress = 0; playUIClickSound(); } } 
        else {
            State.isBlinking = true; 
            document.getElementById('blink-overlay').style.opacity = 1; 
            
            let fatalSight = false; let caughtBy = null;
            let fatalMultiplier = (State.flashlightState === 'ON') ? 1.0 : 0.7;
            State.monsters.forEach(m => { 
                let dX = m.mesh.position.x - State.camera.position.x; let dZ = m.mesh.position.z - State.camera.position.z; let dist2D = Math.sqrt(dX*dX + dZ*dZ); 
                let fatalD = (m.type === 1 ? 15.0 : 6.0) * fatalMultiplier; 
                if (State.gamePhase === 2) fatalD /= 2.0; 
                if(m.active && m.visibleFrame && dist2D < fatalD) { fatalSight = true; caughtBy = m; } 
            });
            if(fatalSight) window.triggerJumpscareSequence("CORRUPTED");
        }
    };

    window.handleSmartBtnEnd = (e) => {
        if(e && e.cancelable) e.preventDefault(); 
        if (State.isBlinking) { 
            State.isBlinking = false; 
            if(!State.isBlackoutGlitch) document.getElementById('blink-overlay').style.opacity = 0; 
            if(State.whisperGain) State.whisperGain.gain.value = 0; 
        } 
        if (State.isHoldingInteract) { 
            State.isHoldingInteract = false; State.interactProgress = 0; 
            document.getElementById('interact-bar-container').style.opacity = 0; 
            document.getElementById('interact-text').style.opacity = 0; 
            setTimeout(()=>{ 
                document.getElementById('interact-bar-container').style.display = 'none'; 
                document.getElementById('interact-text').style.display = 'none'; 
            }, 200);
        } 
    };

    window.handleFlashlightStart = (e) => {
        if(e && e.cancelable) e.preventDefault(); 
        if(!State.gameActive || State.isJumpscaring || State.tutorialPause || State.isIntroAnim) return; 
        State.isHoldingFlashlightBtn = true;
        playUIClickSound(); 
        let flashBtnEl = document.getElementById('flashlight-btn');
        if (State.flashlightState === 'BROKEN') { 
            State.flashlightState = 'REPAIRING'; State.repairTimer = 0; flashBtnEl.classList.add('active'); flashBtnEl.style.borderColor = "#ffdd44"; 
        } else if (State.flashlightState === 'REPAIRING') { 
            // Do nothing
        } else if (State.flashlightState === 'ON') { 
            State.flashlightState = 'OFF'; 
        } else if (State.flashlightState === 'OFF') { 
            State.flashlightState = 'ON'; 
            State.flashlightDurability = Math.min(State.gamePhase === 2 ? 8.0 : (State.gamePhase === 1 ? 4.0 : 2.0), State.flashlightDurability + 0.02); 
        } 
    };

    window.handleFlashlightEnd = (e) => {
        if(e && e.cancelable) e.preventDefault();
        State.isHoldingFlashlightBtn = false;
    };

    window.handleJump = (e) => { 
        if(e && e.cancelable) e.preventDefault(); 
        if(!State.gameActive || State.isJumpscaring || State.tutorialPause || State.isIntroAnim) return; 
        unlockAudio(); 
        if (!State.isJumping) { State.velocityY = 15.0; State.isJumping = true; } 
    };


    // --- PC EVENT LISTENERS ---
    document.addEventListener('mousemove', (e) => {
        if (window.isPointerLocked && State.gameActive && !State.isCameraSnapping && !State.isJumpscaring && !State.isCameraLocked && !State.isIntroAnim) {
            State.lookState.yaw -= e.movementX * 0.002;
            State.lookState.pitch -= e.movementY * 0.002;
            State.lookState.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, State.lookState.pitch));
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (State.gameActive && e.button === 0 && window.isPointerLocked) {
            window.handleSmartBtnStart(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (State.gameActive && e.button === 0) {
            window.handleSmartBtnEnd(e);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!State.gameActive) return;
        const k = e.key.toLowerCase();
        if (k === 'w') window.pcKeys.w = true;
        if (k === 'a') window.pcKeys.a = true;
        if (k === 's') window.pcKeys.s = true;
        if (k === 'd') window.pcKeys.d = true;
        
        if (k === ' ') {
            window.handleJump(e);
        }
        if (k === 'f' && !e.repeat) {
            window.handleFlashlightStart(e);
        }
        
        if (e.key === 'Alt') {
            e.preventDefault();
            window.isHoldingAlt = true;
            if(document.pointerLockElement) document.exitPointerLock();
        }
        
        if (e.key === 'Escape') {
            if (State.gameActive) returnToMenu();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (!State.gameActive) return;
        const k = e.key.toLowerCase();
        if (k === 'w') window.pcKeys.w = false;
        if (k === 'a') window.pcKeys.a = false;
        if (k === 's') window.pcKeys.s = false;
        if (k === 'd') window.pcKeys.d = false;
        
        if (k === 'f') {
            window.handleFlashlightEnd(e);
        }
        
        if (e.key === 'Alt') {
            e.preventDefault();
            window.isHoldingAlt = false;
            window.lockPointer();
        }
    });

    document.body.addEventListener('click', (e) => {
        if (State.gameActive && !window.isHoldingAlt && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
            window.lockPointer();
        }
    });

    // --- MOBILE MOBILE EVENT LISTENERS ---
    joyArea.addEventListener('touchstart', (e) => { e.preventDefault(); State.joyTouchId = e.changedTouches[0].identifier; updateJoystick(e.changedTouches[0]); }, {passive: false});
    joyArea.addEventListener('touchmove', (e) => { e.preventDefault(); for(let i=0; i<e.touches.length; i++) if(e.touches[i].identifier === State.joyTouchId) updateJoystick(e.touches[i]); }, {passive: false});
    const resetJoy = () => { State.joyTouchId = null; State.moveInput = {x: 0, y: 0}; stick.style.transform = `translate(-50%, -50%)`; State.isWalking = false; };
    joyArea.addEventListener('touchend', resetJoy); joyArea.addEventListener('touchcancel', resetJoy);

    function updateJoystick(touch) {
        const rect = joyArea.getBoundingClientRect(); const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
        let dx = touch.clientX - cx, dy = touch.clientY - cy; const maxD = 30; const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > maxD) { dx = (dx/dist)*maxD; dy = (dy/dist)*maxD; }
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; State.moveInput.x = dx/maxD; State.moveInput.y = dy/maxD; State.isWalking = (dist > 5);
    }

    rightZone.addEventListener('touchstart', (e) => { e.preventDefault(); if(State.rightTouchId===null) { State.rightTouchId = e.changedTouches[0].identifier; State.rightTouchStart = {x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY}; } }, {passive: false});
    rightZone.addEventListener('touchmove', (e) => { 
        e.preventDefault(); if (State.isCameraSnapping || State.isJumpscaring || State.isCameraLocked || State.isIntroAnim) return; 
        for(let i=0; i<e.touches.length; i++) if(e.touches[i].identifier === State.rightTouchId) {
            State.lookState.yaw -= (e.touches[i].clientX - State.rightTouchStart.x) * lookSpeed; State.lookState.pitch -= (e.touches[i].clientY - State.rightTouchStart.y) * lookSpeed;
            State.lookState.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, State.lookState.pitch)); State.rightTouchStart = {x: e.touches[i].clientX, y: e.touches[i].clientY};
        }
    }, {passive: false});
    const resetLook = (e) => { for(let i=0; i<e.changedTouches.length; i++) if(e.changedTouches[i].identifier === State.rightTouchId) State.rightTouchId = null; };
    rightZone.addEventListener('touchend', resetLook); rightZone.addEventListener('touchcancel', resetLook);

    smartBtn.addEventListener('touchstart', window.handleSmartBtnStart, {passive: false});
    smartBtn.addEventListener('touchend', window.handleSmartBtnEnd, {passive: false});
    smartBtn.addEventListener('touchcancel', window.handleSmartBtnEnd, {passive: false});

    flashBtn.addEventListener('touchstart', window.handleFlashlightStart, {passive: false});
    flashBtn.addEventListener('touchend', window.handleFlashlightEnd, {passive: false});
    flashBtn.addEventListener('touchcancel', window.handleFlashlightEnd, {passive: false});
    
    // Allow clicking buttons on screen with mouse if Alt is held
    flashBtn.addEventListener('mousedown', window.handleFlashlightStart, {passive: false});
    flashBtn.addEventListener('mouseup', window.handleFlashlightEnd, {passive: false});
    flashBtn.addEventListener('mouseleave', window.handleFlashlightEnd, {passive: false});
    
    smartBtn.addEventListener('mousedown', window.handleSmartBtnStart, {passive: false});
    smartBtn.addEventListener('mouseup', window.handleSmartBtnEnd, {passive: false});
    smartBtn.addEventListener('mouseleave', window.handleSmartBtnEnd, {passive: false});

    jumpBtn.addEventListener('touchstart', window.handleJump, {passive: false}); 
    jumpBtn.addEventListener('mousedown', window.handleJump);
}

export { setupControls };