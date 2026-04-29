import * as State from './state.js';

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
        if (gameActive && !window.isHoldingAlt && !isJumpscaring && !tutorialPause) {
            document.body.requestPointerLock().catch(()=>{});
        }
    }
    window.lockPointer = lockPointer;

    // --- UNIFIED INTERACTION HANDLERS ---
    window.handleSmartBtnStart = (e) => {
        if(e && e.cancelable) e.preventDefault(); 
        if(!gameActive || isJumpscaring || tutorialPause || isIntroAnim) return;
        unlockAudio(); 
        if (smartBtnState === 'DOOR') { advanceLevel(); } 
        else if (smartBtnState === 'ITEM') { if(!isCameraLocked) { isHoldingInteract = true; interactProgress = 0; playUIClickSound(); } } 
        else {
            isBlinking = true; 
            document.getElementById('blink-overlay').style.opacity = 1; 
            
            let fatalSight = false; let caughtBy = null;
            let fatalMultiplier = (flashlightState === 'ON') ? 1.0 : 0.7;
            monsters.forEach(m => { 
                let dX = m.mesh.position.x - camera.position.x; let dZ = m.mesh.position.z - camera.position.z; let dist2D = Math.sqrt(dX*dX + dZ*dZ); 
                let fatalD = (m.type === 1 ? 15.0 : 6.0) * fatalMultiplier; 
                if (gamePhase === 2) fatalD /= 2.0; 
                if(m.active && m.visibleFrame && dist2D < fatalD) { fatalSight = true; caughtBy = m; } 
            });
            if(fatalSight) triggerJumpscareSequence("CORRUPTED");
        }
    };

    window.handleSmartBtnEnd = (e) => {
        if(e && e.cancelable) e.preventDefault(); 
        if (isBlinking) { 
            isBlinking = false; 
            if(!isBlackoutGlitch) document.getElementById('blink-overlay').style.opacity = 0; 
            if(whisperGain) whisperGain.gain.value = 0; 
        } 
        if (isHoldingInteract) { 
            isHoldingInteract = false; interactProgress = 0; 
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
        if(!gameActive || isJumpscaring || tutorialPause || isIntroAnim) return; 
        isHoldingFlashlightBtn = true;
        playUIClickSound(); 
        let flashBtnEl = document.getElementById('flashlight-btn');
        if (flashlightState === 'BROKEN') { 
            flashlightState = 'REPAIRING'; repairTimer = 0; flashBtnEl.classList.add('active'); flashBtnEl.style.borderColor = "#ffdd44"; 
        } else if (flashlightState === 'REPAIRING') { 
            // Do nothing
        } else if (flashlightState === 'ON') { 
            flashlightState = 'OFF'; 
        } else if (flashlightState === 'OFF') { 
            flashlightState = 'ON'; 
            flashlightDurability = Math.min(gamePhase === 2 ? 8.0 : (gamePhase === 1 ? 4.0 : 2.0), flashlightDurability + 0.02); 
        } 
    };

    window.handleFlashlightEnd = (e) => {
        if(e && e.cancelable) e.preventDefault();
        isHoldingFlashlightBtn = false;
    };

    window.handleJump = (e) => { 
        if(e && e.cancelable) e.preventDefault(); 
        if(!gameActive || isJumpscaring || tutorialPause || isIntroAnim) return; 
        unlockAudio(); 
        if (!isJumping) { velocityY = 15.0; isJumping = true; } 
    };


    // --- PC EVENT LISTENERS ---
    document.addEventListener('mousemove', (e) => {
        if (window.isPointerLocked && gameActive && !isCameraSnapping && !isJumpscaring && !isCameraLocked && !isIntroAnim) {
            lookState.yaw -= e.movementX * 0.002;
            lookState.pitch -= e.movementY * 0.002;
            lookState.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, lookState.pitch));
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (gameActive && e.button === 0 && window.isPointerLocked) {
            window.handleSmartBtnStart(e);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (gameActive && e.button === 0) {
            window.handleSmartBtnEnd(e);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!gameActive) return;
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
            if (gameActive) returnToMenu();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (!gameActive) return;
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
        if (gameActive && !window.isHoldingAlt && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
            window.lockPointer();
        }
    });

    // --- MOBILE MOBILE EVENT LISTENERS ---
    joyArea.addEventListener('touchstart', (e) => { e.preventDefault(); joyTouchId = e.changedTouches[0].identifier; updateJoystick(e.changedTouches[0]); }, {passive: false});
    joyArea.addEventListener('touchmove', (e) => { e.preventDefault(); for(let i=0; i<e.touches.length; i++) if(e.touches[i].identifier === joyTouchId) updateJoystick(e.touches[i]); }, {passive: false});
    const resetJoy = () => { joyTouchId = null; moveInput = {x: 0, y: 0}; stick.style.transform = `translate(-50%, -50%)`; isWalking = false; };
    joyArea.addEventListener('touchend', resetJoy); joyArea.addEventListener('touchcancel', resetJoy);

    function updateJoystick(touch) {
        const rect = joyArea.getBoundingClientRect(); const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
        let dx = touch.clientX - cx, dy = touch.clientY - cy; const maxD = 30; const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > maxD) { dx = (dx/dist)*maxD; dy = (dy/dist)*maxD; }
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; moveInput.x = dx/maxD; moveInput.y = dy/maxD; isWalking = (dist > 5);
    }

    rightZone.addEventListener('touchstart', (e) => { e.preventDefault(); if(rightTouchId===null) { rightTouchId = e.changedTouches[0].identifier; rightTouchStart = {x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY}; } }, {passive: false});
    rightZone.addEventListener('touchmove', (e) => { 
        e.preventDefault(); if (isCameraSnapping || isJumpscaring || isCameraLocked || isIntroAnim) return; 
        for(let i=0; i<e.touches.length; i++) if(e.touches[i].identifier === rightTouchId) {
            lookState.yaw -= (e.touches[i].clientX - rightTouchStart.x) * lookSpeed; lookState.pitch -= (e.touches[i].clientY - rightTouchStart.y) * lookSpeed;
            lookState.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, lookState.pitch)); rightTouchStart = {x: e.touches[i].clientX, y: e.touches[i].clientY};
        }
    }, {passive: false});
    const resetLook = (e) => { for(let i=0; i<e.changedTouches.length; i++) if(e.changedTouches[i].identifier === rightTouchId) rightTouchId = null; };
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