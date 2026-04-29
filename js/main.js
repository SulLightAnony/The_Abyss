// 1. Import State (Pusat Data)
import { State, LEVEL_DATA, materialCache, loadingTips, lookSpeed, initDOMReferences } from './state.js';

// 2. Import Audio (Suara)
import { 
    unlockAudio, 
    playUIClickSound, 
    playPickupSound, 
    playFootstepSound, 
    playMonsterScreamSound 
} from './audio.js';

// 3. Import World (Arsitektur & Map)
import { 
    buildCurrentLevel, 
    setupLighting,
    initSharedMats, 
    getMaterialCache, 
    clearScene 
} from './world.js';

// 4. Import Entities (Monster & Item) - INI YANG TADI KURANG
import { 
    createMonster, 
    spawnItems, 
    createExitDoor, 
    placeMonsterFar, 
    getCurrentRespawnTime 
} from './entities.js';

// 5. Import Controls (Input)
import { setupControls } from './controls.js';

initDOMReferences();

// --- SETELAH IMPORT BARU MASUK KE FUNGSI-FUNGSI UTAMA (initGameEngine, animate, dll) ---
function initGameEngine() {
    document.getElementById('item-max').innerText = LEVEL_DATA[State.currentLevel].items; document.getElementById('item-count').innerText = "0";
    State.scene = new THREE.Scene(); State.scene.fog = new THREE.FogExp2(LEVEL_DATA[State.currentLevel].fogColor, LEVEL_DATA[State.currentLevel].fogDensity); State.scene.background = new THREE.Color(LEVEL_DATA[State.currentLevel].bg);
    State.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800); State.camera.position.set(0, State.player.height, 0); State.scene.add(State.camera); State.lookState.yaw = 0; State.lookState.pitch = 0;
    buildCurrentLevel(); setupLighting(); if(State.droneOsc) State.droneOsc.frequency.value = (State.currentLevel===0 ? 50 : (State.currentLevel===1 ? 80 : 30));
}

// --- MAIN LOOP ---
function animate() {
    if(!State.gameActive) return; 
    State.animationFrameId = requestAnimationFrame(animate);
    const time = performance.now(); 
    if (State.tutorialPause) { State.prevTime = time; State.renderer.render(State.scene, State.camera); return; }
    const delta = Math.min((time - State.prevTime)/1000, 0.1); State.prevTime = time;

    // Handle Intro Cinematic State.Camera
    if (State.isIntroAnim) {
        State.introAnimTimer += delta;
        let progress = Math.min(1.0, State.introAnimTimer / 1.5);
        let ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        State.lookState.pitch = -Math.PI/2 * (1 - ease);
        if (progress >= 1.0) State.isIntroAnim = false;
    }

    const camDir = new THREE.Vector3(); State.camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();

    if (State.currentLevel === 0 && State.gamePhase < 2) {
        State.phaseTimer -= delta;
        if (State.phaseTimer <= 0) {
            State.phaseTimer = 0;
            if (State.gamePhase === 0) triggerNightmareMode();
            else if (State.gamePhase === 1) triggerSlaughterMode();
        }
        if (State.gamePhase < 2) {
            let mins = Math.floor(State.phaseTimer / 60);
            let secs = Math.floor(State.phaseTimer % 60);
            document.getElementById('nightmare-hud').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    const debugNmBtn = document.getElementById('debug-nightmare-btn');
    if (State.gamePhase === 0) debugNmBtn.innerText = "TEST NIGHTMARE";
    else if (State.gamePhase === 1) debugNmBtn.innerText = "TEST SLAUGHTER";
    else debugNmBtn.style.display = 'none';

    if (State.gamePhase >= 1) {
        let targetFog = new THREE.Color(0x550000);
        let targetBg = new THREE.Color(0x110000);
        State.scene.fog.color.lerp(targetFog, delta * 0.2);
        State.scene.background.lerp(targetBg, delta * 0.2);
        
        State.flashlightDurability = (State.gamePhase === 2) ? 8.0 : 4.0;
        
        State.nightmareGlitchTick += delta;
        if (State.nightmareGlitchTick >= 1.0) {
            State.nightmareGlitchTick -= 1.0;
            let glitchChance = (State.gamePhase === 2) ? 0.40 : 0.10; 
            if (Math.random() < glitchChance) {
                if (State.gamePhase === 2 && Math.random() < 0.5) {
                    if (!State.isBlackoutGlitch && !State.isPreBlackoutShake) {
                        State.isPreBlackoutShake = true;
                        setTimeout(() => {
                            State.isPreBlackoutShake = false;
                            State.isBlackoutGlitch = true;
                            let bOvl = document.getElementById('blink-overlay');
                            bOvl.style.transition = 'opacity 0.1s';
                            bOvl.style.opacity = 1;
                            setTimeout(() => {
                                if(!State.isBlinking) bOvl.style.opacity = 0;
                                setTimeout(() => {
                                    bOvl.style.transition = 'opacity 0.15s ease-in-out';
                                    State.isBlackoutGlitch = false;
                                }, 100);
                            }, 200); 
                        }, 100); 
                    }
                } else {
                    State.isGlitching = true;
                    State.glitchTimer = 0.2;
                }
            }
        }
    }
    
    if (State.gamePhase === 2) {
        State.slaughterSpeedMultiplier = Math.min(1.75, State.slaughterSpeedMultiplier + 0.02 * delta);
    }

    let flashBtn = document.getElementById('flashlight-btn');
    let repairContainer = document.getElementById('repair-bar-container'); let repairFill = document.getElementById('repair-bar-fill'); let repairText = document.getElementById('repair-text');

    if (State.flashlightState === 'REPAIRING') {
        repairContainer.style.display = 'block'; repairText.style.display = 'block';
        repairContainer.style.opacity = 1; repairText.style.opacity = 1;
        
        if (!State.isHoldingFlashlightBtn) {
            State.flashlightState = 'BROKEN'; showMessage("REPAIR CANCELLED!", true); 
            flashBtn.innerHTML = "💥"; flashBtn.style.borderColor = "red"; 
            repairContainer.style.opacity = 0; repairText.style.opacity = 0;
            setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
        } 
        else if (State.isWalking && State.gamePhase === 0) { 
            State.flashlightState = 'BROKEN'; showMessage("REPAIR FAILED: STAY STILL!", true); 
            flashBtn.innerHTML = "💥"; flashBtn.style.borderColor = "red"; 
            repairContainer.style.opacity = 0; repairText.style.opacity = 0;
            setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
        } 
        else {
            State.repairTimer += delta; 
            let pct = Math.floor((State.repairTimer / 4.0) * 100);
            repairFill.style.width = pct + "%"; 
            if (State.repairTimer >= 4.0) { 
                State.flashlightState = 'ON'; flashBtn.innerHTML = "🔦"; flashBtn.style.borderColor = "#ffdd44"; 
                repairContainer.style.opacity = 0; repairText.style.opacity = 0;
                setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
                State.flashlightDurability = (State.gamePhase === 2) ? 8.0 : (State.gamePhase === 1 ? 4.0 : 1.0); 
                playPickupSound(); 
            } 
        }
        State.flashlight.intensity = 0;
    } else if (State.flashlightState === 'BROKEN' || State.flashlightState === 'OFF') {
        State.flashlight.intensity = 0; 
        repairContainer.style.opacity = 0; repairText.style.opacity = 0;
        setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
        if(State.flashlightState === 'BROKEN') { flashBtn.innerHTML = "💥"; flashBtn.style.borderColor = "red"; flashBtn.classList.remove('active'); } else { flashBtn.innerHTML = "🔦"; flashBtn.style.borderColor = "#555"; flashBtn.classList.remove('active'); }
    } else if (State.flashlightState === 'ON') { 
        let baseInt = (State.currentLevel===2 ? 0.5 : 2.5);
        
        if (State.flashlightDurability > 1.5) {
            let flickerRisk = (State.flashlightDurability - 1.5) / 0.5;
            if (Math.random() < flickerRisk * 0.1) {
                baseInt *= (Math.random() > 0.5 ? 0.3 : 0.7); 
            }
        }
        State.flashlight.intensity = baseInt; 
        flashBtn.innerHTML = "🔦"; flashBtn.style.borderColor = "#ffdd44"; flashBtn.classList.add('active'); 
        repairContainer.style.opacity = 0; repairText.style.opacity = 0;
        setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
    }

    if(State.currentLevel < 2) {
        let activeVirtuals = State.virtualLights.map(vl => ({vl: vl, id: vl.id, dist: State.camera.position.distanceToSquared(new THREE.Vector3(vl.x, vl.y, vl.z))})).filter(v => v.dist < 80000).sort((a, b) => a.dist - b.dist).slice(0, 8);
        State.lightPool.forEach(p => { p.keep = false; }); activeVirtuals.forEach(av => { let existing = State.lightPool.find(p => p.active && p.virtualIdx === av.id); if (existing) { existing.keep = true; av.handled = true; } });
        activeVirtuals.filter(av => !av.handled).forEach(av => { let available = State.lightPool.find(p => !p.active && p.fadeOpacity <= 0.01); if (available) { available.active = true; available.keep = true; available.virtualIdx = av.id; available.assignedMesh = av.vl.mesh; available.light.position.set(av.vl.x, av.vl.y - 1.0, av.vl.z); available.baseInt = av.vl.baseInt; available.isFlicker = av.vl.isFlicker; } });
        State.lightPool.forEach(p => { if (p.keep) { p.fadeOpacity = Math.min(1.0, p.fadeOpacity + delta * 1.5); } else { p.fadeOpacity = Math.max(0.0, p.fadeOpacity - delta * 1.5); if (p.fadeOpacity <= 0) { p.active = false; p.virtualIdx = -1; p.light.intensity = 0; if(p.assignedMesh) p.assignedMesh.material = State.sharedMats.neonOff; p.assignedMesh = null; } } if (p.active || p.fadeOpacity > 0) { let currentInt = p.baseInt * p.fadeOpacity; let isFlickeringOff = false; if (p.isFlicker && Math.random() > 0.85) { isFlickeringOff = Math.random() > 0.5; } if (isFlickeringOff) { p.light.intensity = 0; if(p.assignedMesh) p.assignedMesh.material = State.sharedMats.neonOff; } else { p.light.intensity = currentInt; if(p.assignedMesh) p.assignedMesh.material = (p.fadeOpacity > 0.2) ? State.sharedMats.neon : State.sharedMats.neonOff; } } });
    }

    let targetFov = 70; if (State.isCameraLocked) { targetFov = 25; } if (Math.abs(State.currentFov - targetFov) > 0.5) { State.currentFov += (targetFov - State.currentFov) * delta * 1.5; State.camera.fov = State.currentFov; State.camera.updateProjectionMatrix(); }
    State.camera.rotation.set(0, 0, 0); State.camera.rotateY(State.lookState.yaw); State.camera.rotateX(State.lookState.pitch);

    if (State.isPreBlackoutShake && !State.isJumpscaring) {
        State.camera.rotation.z += (Math.random() - 0.5) * 0.8;
        State.camera.rotation.x += (Math.random() - 0.5) * 0.8;
        State.camera.rotation.y += (Math.random() - 0.5) * 0.8;
    } else if (State.gamePhase === 2 && !State.isJumpscaring) {
        State.camera.rotation.z += (Math.random() - 0.5) * 0.02;
        State.camera.rotation.x += (Math.random() - 0.5) * 0.01;
    }

    let currentBaseSpeed = State.player.baseSpeed; 
    if (State.flashlightState !== 'ON') { currentBaseSpeed *= 0.6; } 
    
    if(State.currentLevel === 1) { if(State.camera.position.y - State.player.height < State.waterLevel + 1) { if(!State.isPlayerInWater) { State.isPlayerInWater = true; document.getElementById('water-overlay').style.opacity = 1; } State.player.speed = currentBaseSpeed * 0.3; } else { if(State.isPlayerInWater) { State.isPlayerInWater = false; document.getElementById('water-overlay').style.opacity = 0; } State.player.speed = currentBaseSpeed; } } else { State.player.speed = currentBaseSpeed; }
    
    // --- PC MOVEMENT INTEGRATION ---
    let pcMoveX = 0;
    let pcMoveY = 0;
    if (window.pcKeys && window.pcKeys.w) pcMoveY -= 1;
    if (window.pcKeys && window.pcKeys.s) pcMoveY += 1;
    if (window.pcKeys && window.pcKeys.a) pcMoveX -= 1;
    if (window.pcKeys && window.pcKeys.d) pcMoveX += 1;

    if (pcMoveX !== 0 && pcMoveY !== 0) {
        let len = Math.sqrt(pcMoveX*pcMoveX + pcMoveY*pcMoveY);
        pcMoveX /= len;
        pcMoveY /= len;
    }

    let finalMoveX = (State.moveInput.x !== 0) ? State.moveInput.x : pcMoveX;
    let finalMoveY = (State.moveInput.y !== 0) ? State.moveInput.y : pcMoveY;

    let pcWalking = (pcMoveX !== 0 || pcMoveY !== 0);
    let finalWalking = State.isWalking || pcWalking;

    const rightDir = new THREE.Vector3().crossVectors(camDir, State.camera.up).normalize(); const velocity = new THREE.Vector3(); let effSpeed = State.isCameraSnapping || State.isHoldingInteract || State.isIntroAnim ? 0 : State.player.speed; 
    velocity.addScaledVector(camDir, -finalMoveY * effSpeed * delta); 
    velocity.addScaledVector(rightDir, finalMoveX * effSpeed * delta);
    let nextPos = State.camera.position.clone(); nextPos.x += velocity.x; nextPos.z += velocity.z; State.velocityY -= 40.0 * delta; nextPos.y += State.velocityY * delta;
    
    let col = checkCollision(nextPos); if(!col.hit) { State.camera.position.x = nextPos.x; State.camera.position.z = nextPos.z; } else { let colX = checkCollision(new THREE.Vector3(nextPos.x, State.camera.position.y, State.camera.position.z)); let colZ = checkCollision(new THREE.Vector3(State.camera.position.x, State.camera.position.y, nextPos.z)); if(!colX.hit) State.camera.position.x = nextPos.x; if(!colZ.hit) State.camera.position.z = nextPos.z; }
    
    if(col.onGround && State.velocityY <= 0) { 
        let targetY = col.floorY + State.player.height; 
        
        if(finalWalking && !State.isCameraSnapping && !State.isHoldingInteract && !State.isIntroAnim) { 
            State.bobPhase += delta * 12.0 * (State.player.speed / State.player.baseSpeed); 
            State.bobAmt += (0.7 - State.bobAmt) * delta * 5.0; 
        } else {
            State.bobAmt += (0.0 - State.bobAmt) * delta * 8.0;  
        }
        
        let bobOffset = Math.sin(State.bobPhase) * State.bobAmt;
        targetY += bobOffset;

        State.camera.position.y += (targetY - State.camera.position.y) * 15.0 * delta;
        State.velocityY = 0; State.isJumping = false; 

        let currentStepPhase = Math.floor(State.bobPhase / Math.PI);
        if (currentStepPhase > State.lastStepPhase && State.bobAmt > 0.3) {
            playFootstepSound();
            State.lastStepPhase = currentStepPhase;
        }
    }
    if(State.camera.position.y < State.deathYLevel) { triggerJumpscareSequence("FALLEN"); return; }

    const smartBtn = document.getElementById('smart-action-btn');
    State.nearestItemObj = null; let minDistItem = 9999;
    for (let i = 0; i < State.items.length; i++) { State.items[i].rotation.y += delta; let d = State.camera.position.distanceTo(State.items[i].position); if (d < 12) { if (d < minDistItem) { minDistItem = d; State.nearestItemObj = State.items[i]; } } }
    let dDoor = State.exitDoor ? State.camera.position.distanceTo(State.exitDoor.position) : 9999;
    if (dDoor < 12) { State.smartBtnState = 'DOOR'; smartBtn.innerHTML = "EXIT"; smartBtn.style.backgroundColor = "rgba(255, 255, 255, 0.7)"; smartBtn.style.color = "black"; smartBtn.style.borderColor = "#fff"; } 
    else if (State.nearestItemObj) { State.smartBtnState = 'ITEM'; smartBtn.innerHTML = "TAKE"; smartBtn.style.backgroundColor = "rgba(255, 255, 255, 0.7)"; smartBtn.style.color = "black"; smartBtn.style.borderColor = "#fff"; } 
    else { State.smartBtnState = 'BLINK'; smartBtn.innerHTML = "CLOSE<br>EYES"; smartBtn.style.backgroundColor = "rgba(10, 10, 10, 0.6)"; smartBtn.style.color = "#ff9999"; smartBtn.style.borderColor = "rgba(150, 0, 0, 0.5)"; }

    let interactContainer = document.getElementById('interact-bar-container'); let interactFill = document.getElementById('interact-bar-fill'); let interactText = document.getElementById('interact-text');
    if (State.isHoldingInteract && State.smartBtnState === 'ITEM') {
        if (finalWalking || !State.nearestItemObj || State.isCameraLocked) { 
            State.isHoldingInteract = false; State.interactProgress = 0; showMessage("RETRIEVAL CANCELED!", true); 
            interactContainer.style.opacity = 0; interactText.style.opacity = 0;
            setTimeout(()=>{ interactContainer.style.display = 'none'; interactText.style.display = 'none'; }, 200);
        } else { 
            interactContainer.style.display = 'block'; interactText.style.display = 'block'; 
            interactContainer.style.opacity = 1; interactText.style.opacity = 1;
            State.interactProgress += delta; let pct = Math.min(100, (State.interactProgress / 5.0) * 100); interactFill.style.width = pct + "%"; 
            if (State.interactProgress >= 5.0) { 
                State.isHoldingInteract = false; 
                interactContainer.style.opacity = 0; interactText.style.opacity = 0;
                setTimeout(()=>{ interactContainer.style.display = 'none'; interactText.style.display = 'none'; }, 200);
                playPickupSound(); 
                
                let lastItemPos = State.nearestItemObj.position.clone(); let itemIdx = State.items.indexOf(State.nearestItemObj); 
                if (itemIdx > -1) { 
                    State.scene.remove(State.nearestItemObj); State.items.splice(itemIdx, 1); State.itemsCollected++; document.getElementById('item-count').innerText = State.itemsCollected; 
                    
                    State.phaseTimer = Math.max(0, State.phaseTimer - 15.0); 
                    
                    if(State.currentLevel === 0 && State.itemsCollected <= 3 && State.monsters[State.itemsCollected - 1] && State.gamePhase === 0) { 
                        let newM = State.monsters[State.itemsCollected - 1];
                        newM.respawnCooldown = 5.0; 
                        showMessage("Something has awakened in the dark..."); 
                    } 
                    
                    if (State.itemsCollected === LEVEL_DATA[State.currentLevel].items) { createExitDoor(lastItemPos); } 
                } 
            } 
        }
    } else { 
        interactContainer.style.opacity = 0; interactText.style.opacity = 0;
        setTimeout(()=>{ interactContainer.style.display = 'none'; interactText.style.display = 'none'; }, 200);
    }

    if(State.isBlinking && State.items.length > 0 && State.whisperGain && State.whisperOsc) { 
        let nearest = State.items[0]; 
        let minDist = State.camera.position.distanceTo(nearest.position); 
        for(let i=1; i<State.items.length; i++) { 
            let d = State.camera.position.distanceTo(State.items[i].position); 
            if(d < minDist) { minDist = d; nearest = State.items[i]; } 
        } 
        let dirToItem = new THREE.Vector3().subVectors(nearest.position, State.camera.position).normalize();
        let dot = camDir.dot(dirToItem);
        
        let targetVol = Math.max(0, dot) * 0.85; 
        State.whisperGain.gain.value += (targetVol - State.whisperGain.gain.value) * 0.2; 
        State.whisperOsc.frequency.value = 300 + (Math.max(0, dot) * 500); 
    }

    let globalNoiseInt = 0; let globalStareFreq = 0; let minUnseenDist = 9999; let closestVisibleMonster = null; let minVisDist = 9999; let isLookingAtAnyMonster = false;
    let fatalMultiplier = (State.flashlightState === 'ON') ? 1.0 : 0.7;
    
    let lockRadius = (State.flashlightState === 'ON') ? 45.0 : 45.0 * 0.7; 
    let escapeRadius = lockRadius + 10.0; 
    
    let minColDist = (State.gamePhase === 2) ? 0.0 : 35.0; 

    for(let i=0; i<State.monsters.length; i++) { if(!State.monsters[i].active) continue; for(let j=i+1; j<State.monsters.length; j++) { if(!State.monsters[j].active) continue; let dx = State.monsters[i].mesh.position.x - State.monsters[j].mesh.position.x; let dz = State.monsters[i].mesh.position.z - State.monsters[j].mesh.position.z; if(Math.sqrt(dx*dx + dz*dz) < minColDist) { State.monsters[j].active = false; State.monsters[j].despawnProgress = 0; State.monsters[j].respawnCooldown = getCurrentRespawnTime(); } } }

    State.monsters.forEach(m => {
        if(!m.active) { 
            m.mesh.position.y = -100; 
            if (m.respawnCooldown !== undefined && m.respawnCooldown >= 0) {
                m.respawnCooldown -= delta;
                if (m.respawnCooldown <= 0) { placeMonsterFar(m); }
            }
            return; 
        } 
        
        if(m.type === 2 && m.rings) { m.rings.forEach((r, idx) => { r.rotation.x += delta*(idx+1); r.rotation.y += delta; }); }
        if(m.type === 3) { m.mesh.children.forEach(c => { c.rotation.x += delta; c.rotation.y += delta; }); }
        if(m.type === 4) { m.mesh.rotation.y = Math.atan2(State.camera.position.x - m.mesh.position.x, State.camera.position.z - m.mesh.position.z); }
        let dX = m.mesh.position.x - State.camera.position.x; let dZ = m.mesh.position.z - State.camera.position.z; let dist2D = Math.sqrt(dX*dX + dZ*dZ); 
        let targetPos = m.mesh.position.clone(); targetPos.y += (m.type === 1 ? 0 : 5); const dirToMonster = new THREE.Vector3().subVectors(targetPos, State.camera.position).normalize();
        m.visibleFrame = false; let dotProd = camDir.dot(dirToMonster);
        if(dotProd > 0.4 && dist2D < 55) { const raycaster = new THREE.Raycaster(State.camera.position, dirToMonster); const intersects = raycaster.intersectObjects(State.wallMeshes, true); if(intersects.length === 0 || intersects[0].distance > dist2D) { m.visibleFrame = true; } }
        if(m.visibleFrame && !State.isBlinking) { if(dist2D < minVisDist) { minVisDist = dist2D; closestVisibleMonster = m; } } else { if(dist2D < minUnseenDist) minUnseenDist = dist2D; }
    });

    State.isCameraLocked = false; State.currentlySnapping = false; State.anyMonsterDespawningUI = false;
    if (State.lockedMonster) { if (!State.lockedMonster.active || !State.lockedMonster.visibleFrame) { State.lockedMonster = null; } }
    if (!State.lockedMonster && closestVisibleMonster && minVisDist < lockRadius) { State.lockedMonster = closestVisibleMonster; State.lockedMonster.isSnappingCam = true; }

    if (State.lockedMonster) {
        let dist2D = State.camera.position.distanceTo(State.lockedMonster.mesh.position);
        if (dist2D > escapeRadius) { 
            if (State.gamePhase !== 2) {
                State.lockedMonster.active = false; 
                State.lockedMonster.despawnProgress = 0; 
                State.lockedMonster.respawnCooldown = getCurrentRespawnTime(); 
            } else {
                State.lockedMonster.despawnProgress = 0;
            }
            State.lockedMonster = null; 
        } 
        else {
            isLookingAtAnyMonster = true; State.isCameraLocked = true;
            let targetYaw = Math.atan2(State.camera.position.x - State.lockedMonster.mesh.position.x, State.camera.position.z - State.lockedMonster.mesh.position.z);
            let diff = targetYaw - (State.lookState.yaw % (Math.PI * 2));
            while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
            if (State.lockedMonster.isSnappingCam) { State.currentlySnapping = true; if (Math.abs(diff) > 0.05) { State.lookState.yaw += diff * (delta * 10.0); State.lookState.pitch += (0 - State.lookState.pitch) * (delta * 10.0); } else { State.lockedMonster.isSnappingCam = false; State.lockedMonster.hasSnappedEncounter = true; playUIClickSound(); } } 
            else { State.lookState.yaw += diff * (delta * 5.0); State.lookState.pitch += (0 - State.lookState.pitch) * (delta * 5.0); }
            
            if (State.flashlightState === 'ON' && !State.isBlinking) { State.lockedMonster.despawnProgress += 33.33 * delta; } else { State.lockedMonster.despawnProgress = Math.max(0, State.lockedMonster.despawnProgress - 20.0 * delta); }
            if (State.lockedMonster.despawnProgress > 0) { 
                State.anyMonsterDespawningUI = true; 
                let dBarCont = document.getElementById('despawn-bar-container'); let dText = document.getElementById('despawn-text');
                dBarCont.style.display = 'block'; dText.style.display = 'block'; 
                dBarCont.style.opacity = 1; dText.style.opacity = 1;
                document.getElementById('despawn-bar-fill').style.width = Math.min(100, State.lockedMonster.despawnProgress) + '%'; 
            }
            if (State.lockedMonster.despawnProgress >= 100) { 
                State.lockedMonster.active = false; 
                State.lockedMonster.despawnProgress = 0; 
                State.lockedMonster.respawnCooldown = getCurrentRespawnTime(); 
                State.lockedMonster = null; 
            }
        }
    }

    State.monsters.forEach(m => {
        if(!m.active) return; if (m !== State.lockedMonster) m.despawnProgress = 0;
        let dX = m.mesh.position.x - State.camera.position.x; let dZ = m.mesh.position.z - State.camera.position.z; let dist2D = Math.sqrt(dX*dX + dZ*dZ); 
        
        let activeSpeedMult = (State.gamePhase === 2) ? State.slaughterSpeedMultiplier : 1.0;

        if (!m.visibleFrame && !State.isBlinking) { m.mesh.scale.set(1, 1, 1); let moveSpd = m.speed * activeSpeedMult; if(m.type===1) { m.mesh.position.y = -2; moveSpd *= (State.isPlayerInWater?2.5:0.2); } else if(m.type===2) { m.mesh.position.y += (State.camera.position.y - m.mesh.position.y)*0.05; } else if(m.type===3) { m.mesh.position.y = 3; } else if(m.type===4) { m.mesh.position.y = 5; } else { m.mesh.position.y = 0; } let moveDir = new THREE.Vector3().subVectors(m.mesh.position, State.camera.position).normalize(); m.mesh.position.addScaledVector(moveDir, -moveSpd * delta); if(m.type !== 4) m.mesh.rotation.y = Math.atan2(State.camera.position.x - m.mesh.position.x, State.camera.position.z - m.mesh.position.z); } 
        else if (m.visibleFrame) { if (State.flashlightState !== 'ON' || State.isBlinking) { let moveSpd = m.speed * activeSpeedMult; if(m.type===1) { m.mesh.position.y = -2; moveSpd *= (State.isPlayerInWater?2.5:0.2); } else if(m.type===2) { m.mesh.position.y += (State.camera.position.y - m.mesh.position.y)*0.05; } else if(m.type===3) { m.mesh.position.y = 3; } else if(m.type===4) { m.mesh.position.y = 5; } else { m.mesh.position.y = 0; } let moveDir = new THREE.Vector3().subVectors(m.mesh.position, State.camera.position).normalize(); m.mesh.position.addScaledVector(moveDir, -moveSpd * delta); if(m.type !== 4) m.mesh.rotation.y = Math.atan2(State.camera.position.x - m.mesh.position.x, State.camera.position.z - m.mesh.position.z); } else { m.mesh.scale.set(1+(Math.random()*0.5), 1+(Math.random()*-0.4), 1+(Math.random()*0.5)); m.mesh.position.x += (Math.random()-0.5)*1.0; m.mesh.rotation.z = (Math.random()-0.5)*0.2; } let intensity = Math.max(0, Math.min(1, 1.0 - (dist2D / 50.0))); if(intensity > globalNoiseInt) { globalNoiseInt = intensity; globalStareFreq = 50 + (Math.random()*300) + (intensity*600); } }
        
        let fatalD = (m.type === 1 ? 14.0 : 4.5) * fatalMultiplier; 
        if (State.gamePhase === 2) fatalD /= 2.0; 
        if(dist2D < fatalD && m.active && !State.isBlinking) triggerJumpscareSequence("CORRUPTED");
    });

    if (!State.anyMonsterDespawningUI) { 
        let dBarCont = document.getElementById('despawn-bar-container'); let dText = document.getElementById('despawn-text');
        dBarCont.style.opacity = 0; dText.style.opacity = 0;
        setTimeout(()=>{ dBarCont.style.display = 'none'; dText.style.display = 'none'; }, 200);
    }
    State.isCameraSnapping = State.currentlySnapping; 
    
    State.normalTick += delta;

    if (isLookingAtAnyMonster) { 
        State.sabotageTick += delta;
        if (State.gamePhase === 2) {
            if (State.sabotageTick >= 1.0) { 
                State.sabotageTick -= 1.0; 
                if (State.flashlightState === 'ON') { 
                    State.flashlightState = 'OFF'; playUIClickSound(); 
                } 
            }
        } else {
            if (State.sabotageTick >= 0.5) { 
                State.sabotageTick -= 0.5; 
                let saboChance = (State.gamePhase === 1) ? 0.35 : 0.25;
                if (State.flashlightState === 'ON' && Math.random() < saboChance) { 
                    State.flashlightState = 'OFF'; playUIClickSound(); 
                } 
            } 
        }
    } else { 
        State.sabotageTick = 0; 

        if (State.gamePhase >= 1 && State.flashlightState === 'ON') {
            State.nightmareTurnOffTick += delta;
            if (State.nightmareTurnOffTick >= 1.0) {
                State.nightmareTurnOffTick -= 1.0;
                let offChance = (State.gamePhase === 2) ? 0.30 : 0.15;
                if (Math.random() < offChance) {
                    State.flashlightState = 'OFF'; playUIClickSound();
                }
            }
        }

        if (State.flashlightState === 'ON') { 
            if (State.gamePhase === 0) {
                State.flashlightDurability = Math.min(2.0, State.flashlightDurability + (0.02 * delta));
            }
            
            if (State.normalTick >= 1.0) { 
                State.normalTick -= 1.0; 
                let breakChance = State.flashlightDurability / 100.0;
                if (Math.random() < breakChance) { 
                    State.flashlightState = 'BROKEN'; playUIClickSound(); showMessage("LIGHT FAILURE! REPAIRING...", true); 
                } 
            } 
        } else { 
            if (State.normalTick >= 1.0) State.normalTick = 0; 
            if (State.nightmareTurnOffTick >= 1.0) State.nightmareTurnOffTick = 0;
        } 
    }
    
    let durHUD = document.getElementById('durability-hud');
    if (durHUD) {
        durHUD.innerText = `💥 ${State.flashlightDurability.toFixed(2)}%`;
        if (State.flashlightDurability >= 2.0) durHUD.style.color = '#ff4444';
        else durHUD.style.color = '#ffffff';
    }

    let detectRadius = (State.flashlightState === 'ON') ? 40.0 : 40.0 * 0.7; 
    if (State.gamePhase === 2) detectRadius /= 2.0; 
    if (State.proxGain && State.proxOsc) { if (minUnseenDist < detectRadius) { let vol = Math.max(0, 1.0 - (minUnseenDist / detectRadius)); State.proxGain.gain.value = vol * 1.5; State.proxOsc.frequency.value = 100 + (vol * 150); } else { State.proxGain.gain.value = 0; } }
    
    const noiseOvl = document.getElementById('noise-overlay'); const vignetteOvl = document.getElementById('vignette-overlay');
    
    if (State.isGlitching) {
        State.glitchTimer -= delta;
        noiseOvl.style.opacity = 0.9;
        State.camera.rotation.z += (Math.random() - 0.5) * 0.2;
        if (State.glitchTimer <= 0) State.isGlitching = false;
    } else if(isLookingAtAnyMonster) { 
        State.globalStareTimer = Math.min(State.globalStareTimer + delta, 3.0); noiseOvl.style.opacity = globalNoiseInt; 
        if(State.stareGain && State.stareOsc) { State.stareGain.gain.value = globalNoiseInt * 0.4; State.stareOsc.frequency.value = globalStareFreq; } 
        if(State.droneGain) State.droneGain.gain.value = 0.05; 
    } else { 
        State.globalStareTimer = Math.max(State.globalStareTimer - delta * 2.0, 0.0); noiseOvl.style.opacity = 0; 
        if(State.stareGain) State.stareGain.gain.value = 0; if(State.droneGain) State.droneGain.gain.value = 0.3; 
    }
    
    let paranoiaIntensity = State.globalStareTimer / 3.0; vignetteOvl.style.opacity = paranoiaIntensity * 0.7; if(paranoiaIntensity > 0 && !State.isJumpscaring && !State.isGlitching && !State.isPreBlackoutShake) { State.camera.rotation.z += (Math.random() - 0.5) * paranoiaIntensity * 0.1; }
    State.renderer.render(State.scene, State.camera);
}

function initMenuParticles() {
    let dpr = window.devicePixelRatio || 1;
    State.menuCanvas.width = window.innerWidth * dpr;
    State.menuCanvas.height = window.innerHeight * dpr;
    State.particles = [];
    for(let i=0; i<15; i++) {
        State.particles.push({
            x: Math.random() * State.menuCanvas.width,
            y: Math.random() * State.menuCanvas.height,
            vx: ((Math.random() - 0.5) * 0.8) * dpr,
            vy: ((Math.random() - 0.5) * 0.8) * dpr,
            size: (Math.random() * 3 + 2.5) * dpr
        });
    }
}
function animateMenuParticles() {
    if (document.getElementById('start-screen').style.display !== 'none') {
        State.mctx.clearRect(0, 0, State.menuCanvas.width, State.menuCanvas.height);
        State.mctx.shadowBlur = 20;
        State.mctx.shadowColor = '#ffaaaa';
        State.mctx.fillStyle = 'rgba(255, 170, 170, 0.9)';
        State.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if(p.x < 0) p.x = State.menuCanvas.width; if(p.x > State.menuCanvas.width) p.x = 0;
            if(p.y < 0) p.y = State.menuCanvas.height; if(p.y > State.menuCanvas.height) p.y = 0;
            State.mctx.beginPath(); State.mctx.arc(p.x, p.y, p.size, 0, Math.PI*2); State.mctx.fill();
        });
        State.particleAnimId = requestAnimationFrame(animateMenuParticles);
    }
}
initMenuParticles(); animateMenuParticles();

function checkSaveData() {
    const btnContinue = document.getElementById('btn-continue'); const saveInfo = document.getElementById('save-info');
    if (State.currentLevel > 0 && State.currentLevel < 3) { btnContinue.style.display = 'inline-block'; saveInfo.innerText = `Data Found: ${LEVEL_DATA[State.currentLevel].name}`; }
    setupMenuButtons('btn-new', true); setupMenuButtons('btn-continue', false);
    const noiseCanvas = document.createElement('canvas'); noiseCanvas.width = 128; noiseCanvas.height = 128; const nCtx = noiseCanvas.getContext('2d');
    for(let i=0; i<128*128; i++) { nCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'; nCtx.fillRect(i%128, Math.floor(i/128), 1, 1); }
    document.getElementById('noise-overlay').style.backgroundImage = `url(${noiseCanvas.toDataURL()})`;
}

function setupMenuButtons(btnId, isNewGame) {
    const btn = document.getElementById(btnId); if(!btn) return; let clicked = false;
    const handler = (e) => { 
        e.preventDefault(); if(clicked) return; clicked = true; 
        btn.classList.add('clicked'); playUIClickSound(); 
        if(isNewGame) { State.currentLevel = 0; localStorage.setItem('batas_semu_level', 0); } 
        
        document.getElementById('global-blackout').style.opacity = 1;
        
        setTimeout(() => { 
            document.getElementById('start-screen').style.display = 'none'; 
            document.getElementById('loading-screen').style.display = 'flex'; 
            setTimeout(() => { document.getElementById('loading-screen').style.opacity = 1; }, 20);
            startLoadingProcess(); 
            btn.classList.remove('clicked'); clicked=false; 
        }, 1000); 
    };
    btn.addEventListener('touchstart', handler, {passive: false}); btn.addEventListener('click', handler);
}

function setupGameOverButtons(btnId, action) {
    const btn = document.getElementById(btnId);
    let clicked = false;
    const handler = (e) => {
        e.preventDefault(); if(clicked) return; clicked = true;
        btn.classList.add('clicked'); playUIClickSound();
        setTimeout(() => {
            btn.classList.remove('clicked'); clicked = false;
            action();
        }, 150);
    };
    btn.addEventListener('touchstart', handler, {passive: false});
    btn.addEventListener('click', handler);
}

setupGameOverButtons('btn-menu-go', returnToMenu);
setupGameOverButtons('btn-retry-go', () => {
    document.getElementById('game-over-screen').style.opacity = 0;
    setTimeout(() => {
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'flex';
        setTimeout(() => { document.getElementById('loading-screen').style.opacity = 1; }, 20);
        startLoadingProcess();
    }, 200);
});

const tutHandler = (e) => { 
    e.preventDefault(); State.tutorialPause = false; playUIClickSound();
    let pop = document.getElementById('tutorial-popup');
    pop.style.opacity = 0;
    if (window.lockPointer && !window.isHoldingAlt) window.lockPointer();
    setTimeout(() => { pop.style.display = 'none'; }, 200);
};
document.getElementById('btn-tutorial-ok').addEventListener('touchstart', tutHandler, {passive: false});
document.getElementById('btn-tutorial-ok').addEventListener('click', tutHandler);

function clearSaveAndRestart() { localStorage.setItem('batas_semu_level', 0); location.reload(); }

function returnToMenu() {
    State.gameActive = false; if(State.animationFrameId) cancelAnimationFrame(State.animationFrameId);
    clearScene();
    if (document.pointerLockElement) document.exitPointerLock();
    
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('game-over-screen').style.opacity = 0;
    setTimeout(() => {
        document.getElementById('game-over-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        setTimeout(() => { document.getElementById('start-screen').style.opacity = 1; }, 20);
        checkSaveData(); 
        initMenuParticles(); animateMenuParticles();
    }, 200);
}

const homeBtn = document.getElementById('btn-home-icon');
homeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playUIClickSound(); returnToMenu(); }, {passive: false});
homeBtn.addEventListener('click', (e) => { e.preventDefault(); playUIClickSound(); returnToMenu(); });

const debugBtn = document.getElementById('debug-skip-btn'); 
debugBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if(State.gameActive && !State.isJumpscaring) advanceLevel(); }, {passive: false}); 
debugBtn.addEventListener('click', (e) => { e.preventDefault(); if(State.gameActive && !State.isJumpscaring) advanceLevel(); });

const nightmareBtn = document.getElementById('debug-nightmare-btn');
nightmareBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if(State.gameActive && State.currentLevel === 0 && State.phaseTimer > 10.0) State.phaseTimer = 10.0; }, {passive: false});
nightmareBtn.addEventListener('click', (e) => { e.preventDefault(); if(State.gameActive && State.currentLevel === 0 && State.phaseTimer > 10.0) State.phaseTimer = 10.0; });

function updateProgress(percent, taskText) { document.getElementById('load-bar-fill').style.width = percent + '%'; document.getElementById('load-task').innerText = taskText; document.getElementById('load-task').style.color = '#888'; return new Promise(resolve => setTimeout(resolve, 50)); }
function startTips() { const tipEl = document.getElementById('tip-container'); let idx = Math.floor(Math.random() * loadingTips.length); tipEl.innerText = loadingTips[idx]; if(State.tipIntervalId) clearInterval(State.tipIntervalId); setTimeout(()=>{tipEl.style.opacity=1;}, 20); State.tipIntervalId = setInterval(() => { tipEl.style.opacity = 0; setTimeout(() => { idx = (idx + 1) % loadingTips.length; tipEl.innerText = loadingTips[idx]; tipEl.style.opacity = 1; }, 400); }, 3000); }

function updateLevelUI() {
    let modeText = State.gamePhase === 0 ? "(NORMAL)" : (State.gamePhase === 1 ? "(NIGHTMARE)" : "(SLAUGHTER)");
    let ind = document.getElementById('level-indicator');
    ind.innerText = LEVEL_DATA[State.currentLevel].name + " " + modeText;
    if (State.gamePhase > 0) ind.style.color = '#ff4444';
    else ind.style.color = '#88aa88';
}

async function startLoadingProcess() {
    if(State.particleAnimId) cancelAnimationFrame(State.particleAnimId);
    State.mctx.clearRect(0, 0, State.menuCanvas.width, State.menuCanvas.height);
    
    startTips(); await updateProgress(10, "Initializing Engine..."); unlockAudio();
    if(!State.audioCtx) return;
    try {
        if(!State.droneOsc) { State.droneOsc = State.audioCtx.createOscillator(); State.droneGain = State.audioCtx.createGain(); State.droneOsc.type = 'sine'; State.droneOsc.frequency.value = 50; State.droneGain.gain.value = 0.2; State.droneOsc.connect(State.droneGain); State.droneGain.connect(State.audioCtx.destination); State.droneOsc.start(); }
        if(!State.whisperOsc) { State.whisperOsc = State.audioCtx.createOscillator(); State.whisperGain = State.audioCtx.createGain(); State.whisperOsc.type = 'triangle'; State.whisperOsc.frequency.value = 800; State.whisperGain.gain.value = 0; State.whisperOsc.connect(State.whisperGain); State.whisperGain.connect(State.audioCtx.destination); State.whisperOsc.start(); }
        if(!State.stareOsc) { State.stareOsc = State.audioCtx.createOscillator(); State.stareGain = State.audioCtx.createGain(); State.stareOsc.type = 'sawtooth'; State.stareGain.gain.value = 0; State.stareOsc.connect(State.stareGain); State.stareGain.connect(State.audioCtx.destination); State.stareOsc.start(); }
        if(!State.proxOsc) { State.proxOsc = State.audioCtx.createOscillator(); State.proxGain = State.audioCtx.createGain(); State.proxOsc.type = 'sawtooth'; State.proxOsc.frequency.value = 100; State.proxGain.gain.value = 0; State.proxOsc.connect(State.proxGain); State.proxGain.connect(State.audioCtx.destination); State.proxOsc.start(); }
        
        if(!State.nightmareNoiseSrc) {
            let bufferSize = State.audioCtx.sampleRate * 2;
            let noiseBuffer = State.audioCtx.createBuffer(1, bufferSize, State.audioCtx.sampleRate);
            let output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
            State.nightmareNoiseGain = State.audioCtx.createGain(); State.nightmareNoiseGain.gain.value = 0;
            State.nightmareNoiseSrc = State.audioCtx.createBufferSource(); State.nightmareNoiseSrc.buffer = noiseBuffer; State.nightmareNoiseSrc.loop = true;
            let noiseFilter = State.audioCtx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 800;
            State.nightmareNoiseSrc.connect(noiseFilter); noiseFilter.connect(State.nightmareNoiseGain); State.nightmareNoiseGain.connect(State.audioCtx.destination);
            State.nightmareNoiseSrc.start();
        }
    } catch(e) {}

    if(!State.renderer) { State.renderer = new THREE.WebGLRenderer({ antialias: false }); State.renderer.setSize(window.innerWidth, window.innerHeight); document.body.appendChild(State.renderer.domElement); window.addEventListener('resize', onWindowResize, false); setupControls(); }
    
    await updateProgress(40, "Generating Materials..."); initSharedMats(); 
    getMaterialCache('carpet'); getMaterialCache('wallpaper'); getMaterialCache('ceiling');
    if(State.currentLevel >= 1) getMaterialCache('pool_tile'); if(State.currentLevel >= 2) getMaterialCache('concrete');

    await updateProgress(70, "Building World..."); await new Promise(r => setTimeout(r, 50)); 
    try { clearScene(); initGameEngine(); } catch (e) { document.getElementById('load-task').innerText = "SYSTEM ERROR: " + e.message; document.getElementById('load-task').style.color = "#ff4444"; console.error("Map Generation Error:", e); return; }

    await updateProgress(95, "Calibrating Gaze Raycaster..."); await new Promise(r => setTimeout(r, 50)); 
    try { State.renderer.render(State.scene, State.camera); } catch(e) { console.error("Render", e); } await new Promise(r => setTimeout(r, 200)); 

    await updateProgress(100, "Ready..."); clearInterval(State.tipIntervalId); 
    
    document.getElementById('loading-screen').style.opacity = 0;
    
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none'; 
        document.getElementById('ui-layer').style.display = 'block';
        
        document.getElementById('debug-nightmare-btn').style.display = 'inline-block';
        document.getElementById('debug-nightmare-btn').innerText = "TEST NIGHTMARE";

        State.isCameraSnapping = false; State.isCameraLocked = false; State.isJumpscaring = false; State.globalStareTimer = 0; 
        State.camera.rotation.set(0,0,0);
        
        State.lookState.yaw = 0;
        State.lookState.pitch = -Math.PI / 2;
        
        State.isIntroAnim = true;
        State.introAnimTimer = 0;
        
        State.currentFov = 70; State.camera.fov = State.currentFov; State.camera.updateProjectionMatrix();
        
        State.flashlightState = 'ON'; State.repairTimer = 0; State.isHoldingFlashlightBtn = false;
        State.flashlightDurability = 1.0; 
        State.normalTick = 0; State.sabotageTick = 0; State.nightmareTurnOffTick = 0;
        State.tutorialPause = false;
        
        State.gamePhase = 0; State.phaseTimer = 300.0; State.slaughterSpeedMultiplier = 1.0;
        State.nightmareGlitchTick = 0; State.isGlitching = false; State.isBlackoutGlitch = false; State.isPreBlackoutShake = false;
        State.walkTime = 0; State.lastStepPhase = 0; State.bobPhase = 0; State.bobAmt = 0;
        
        updateLevelUI();
        
        let nmHud = document.getElementById('nightmare-hud');
        nmHud.style.display = (State.currentLevel === 0) ? 'block' : 'none';
        nmHud.style.color = '#ffffff'; nmHud.classList.remove('blinking-text');

        State.lockedMonster = null;
        State.isHoldingInteract = false; State.interactProgress = 0; State.smartBtnState = 'BLINK';
        State.monsters.forEach(m => { m.despawnProgress = 0; });
        
        State.gameActive = true; State.prevTime = performance.now();
        showMessage(State.currentLevel === 0 ? "Find 4 Reality Keys..." : (State.currentLevel === 1 ? "Deep water hinders your movement." : "Don't look down."));

        document.getElementById('global-blackout').style.opacity = 0;

        if (State.currentLevel === 0) {
            State.tutorialPause = true;
            let tutPop = document.getElementById('tutorial-popup');
            tutPop.style.display = 'flex';
            setTimeout(()=>{ tutPop.style.opacity = 1; }, 20);
        }

        if(State.animationFrameId) cancelAnimationFrame(State.animationFrameId); animate(); 
    }, 250);
}

window.advanceLevel = advanceLevel;
function advanceLevel() {
    State.gameActive = false; if(State.animationFrameId) cancelAnimationFrame(State.animationFrameId); 
    if (document.pointerLockElement) document.exitPointerLock();
    
    const fade = document.getElementById('fade-transition'); fade.style.display = 'block'; setTimeout(() => { fade.style.opacity = 1; }, 50);
    setTimeout(() => {
        State.currentLevel++;
        if(State.currentLevel > 2) { 
            document.getElementById('ui-layer').style.display = 'none'; 
            document.getElementById('end-screen').style.display = 'flex'; 
            setTimeout(()=>{ document.getElementById('end-screen').style.opacity = 1; }, 20);
            fade.style.opacity = 0; if(State.audioCtx) State.audioCtx.close(); 
        } 
        else { 
            localStorage.setItem('batas_semu_level', State.currentLevel); clearScene(); fade.style.opacity = 0; fade.style.display = 'none'; document.getElementById('ui-layer').style.display = 'none'; 
            document.getElementById('global-blackout').style.opacity = 1; 
            setTimeout(()=> {
                document.getElementById('loading-screen').style.display = 'flex'; 
                setTimeout(()=>{ document.getElementById('loading-screen').style.opacity = 1; }, 20);
                document.getElementById('load-bar-fill').style.width = '0%'; startLoadingProcess(); 
            }, 1000);
        }
    }, 2000);
}

function onWindowResize() { 
    if (State.camera && State.renderer) {
        State.camera.aspect = window.innerWidth / window.innerHeight; 
        State.camera.updateProjectionMatrix(); 
        State.renderer.setSize(window.innerWidth, window.innerHeight); 
    }
    if(State.menuCanvas) { 
        let dpr = window.devicePixelRatio || 1;
        State.menuCanvas.width = window.innerWidth * dpr; 
        State.menuCanvas.height = window.innerHeight * dpr; 
    }
}
window.addEventListener('resize', onWindowResize, false);

function showMessage(text, isRed = false) { let msgBox = document.getElementById('message-box'); msgBox.innerText = text; msgBox.style.color = isRed ? "#ff0000" : "#ddd"; msgBox.style.borderColor = isRed ? "#ff0000" : "#555"; msgBox.style.opacity = 1; setTimeout(() => { msgBox.style.opacity = 0; }, 4000); }
function checkCollision(pos) { const radius = 1.5; const playerBox = new THREE.Box3( new THREE.Vector3(pos.x - radius, pos.y - State.player.height + 0.1, pos.z - radius), new THREE.Vector3(pos.x + radius, pos.y, pos.z + radius) ); let onGround = false; let highestFloorY = -999; for(let i=0; i<State.colliders.length; i++) { if(playerBox.intersectsBox(State.colliders[i])) { if(State.colliders[i].max.y <= pos.y - State.player.height + 2.5) { onGround = true; if(State.colliders[i].max.y > highestFloorY) highestFloorY = State.colliders[i].max.y; } else return { hit: true, onGround: onGround, floorY: highestFloorY }; } } return { hit: false, onGround: onGround, floorY: highestFloorY }; }

function triggerNightmareMode() {
    State.gamePhase = 1;
    State.phaseTimer = 150.0; 
    updateLevelUI();
    document.getElementById('nightmare-hud').style.color = '#ff4444';
    showMessage("This place wants you to leave. Escape NOW.", true);
    if(State.nightmareNoiseGain) State.nightmareNoiseGain.gain.value = 0.15; 
    if(State.droneOsc) { State.droneOsc.type = 'sawtooth'; State.droneOsc.frequency.value = 35; } 
    
    if (State.currentLevel === 0) {
        for(let i=0; i<3; i++) {
            if (State.monsters[i] && !State.monsters[i].active) {
                placeMonsterFar(State.monsters[i]);
            }
        }
    }
}

function triggerSlaughterMode() {
    State.gamePhase = 2;
    State.phaseTimer = 0.0;
    updateLevelUI();
    let nmHud = document.getElementById('nightmare-hud');
    nmHud.innerText = "00:00";
    nmHud.classList.add('blinking-text');
    showMessage("This place wants you to die.", true);
    if(State.nightmareNoiseGain) State.nightmareNoiseGain.gain.value = 0.3; 
}

function showGameOverScreen() {
    clearScene();
    if(document.pointerLockElement) document.exitPointerLock();
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'flex';
    setTimeout(()=>{ document.getElementById('game-over-screen').style.opacity = 1; }, 20);
}

window.triggerJumpscareSequence = triggerJumpscareSequence;
function triggerJumpscareSequence(msg) {
    if (State.isJumpscaring) return;
    State.isJumpscaring = true;
    State.gameActive = false; 
    if(State.animationFrameId) cancelAnimationFrame(State.animationFrameId); 
    if(document.pointerLockElement) document.exitPointerLock();
    
    if(State.proxGain) State.proxGain.gain.value = 0; if(State.stareGain) State.stareGain.gain.value = 0; if(State.whisperGain) State.whisperGain.gain.value = 0; if(State.droneGain) State.droneGain.gain.value = 0.2; if(State.nightmareNoiseGain) State.nightmareNoiseGain.gain.value = 0; 
    
    playMonsterScreamSound(); 
    
    if(State.audioCtx) {
        try {
            let t = State.audioCtx.currentTime;
            let highOsc = State.audioCtx.createOscillator();
            let highGain = State.audioCtx.createGain();
            highOsc.type = 'sine';
            highOsc.frequency.setValueAtTime(400, t);
            highOsc.frequency.exponentialRampToValueAtTime(2000, t + 0.1); 
            highGain.gain.setValueAtTime(1.0, t);
            highGain.gain.exponentialRampToValueAtTime(0.01, t + 3.0); 
            highOsc.connect(highGain);
            highGain.connect(State.audioCtx.destination);
            highOsc.start(t);
            highOsc.stop(t + 3.0);
        } catch(e) {}
    }
    
    document.getElementById('blink-overlay').style.opacity = 0;
    document.getElementById('noise-overlay').style.opacity = 0; 
    document.getElementById('vignette-overlay').style.opacity = 0; 
    document.getElementById('ui-layer').style.display = 'none'; 

    const flashOvl = document.getElementById('flash-overlay');
    let flashCount = 0;
    let basePos = State.camera.position.clone();
    let baseRot = State.camera.rotation.clone();
    
    let flashInterval = setInterval(() => {
        let pattern = flashCount % 4;
        if (pattern === 0) { flashOvl.style.display = 'block'; flashOvl.style.backgroundColor = 'white'; }
        else if (pattern === 1) { flashOvl.style.display = 'none'; }
        else if (pattern === 2) { flashOvl.style.display = 'block'; flashOvl.style.backgroundColor = '#aa8888'; } 
        else if (pattern === 3) { flashOvl.style.display = 'none'; }

        State.camera.position.set(basePos.x + (Math.random()-0.5)*3.0, basePos.y + (Math.random()-0.5)*3.0, basePos.z + (Math.random()-0.5)*3.0);
        State.camera.rotation.set(baseRot.x + (Math.random()-0.5)*0.5, baseRot.y + (Math.random()-0.5)*0.5, baseRot.z + (Math.random()-0.5)*0.5);
        State.renderer.render(State.scene, State.camera);

        flashCount++;
        if (flashCount > 15) { 
            clearInterval(flashInterval);
            flashOvl.style.display = 'none';
            
            const js = document.getElementById('jumpscare'); 
            const jsText = document.getElementById('jumpscare-text');
            jsText.innerText = msg;
            jsText.classList.add('glitch-text');
            js.style.display = 'flex'; 
            
            setTimeout(() => { 
                js.style.display = 'none'; 
                jsText.classList.remove('glitch-text');
                showGameOverScreen(); 
            }, 2500);
        }
    }, 50); 
}

window.onload = checkSaveData();
window.showMessage = showMessage;
window.advanceLevel = advanceLevel;
window.triggerJumpscareSequence = triggerJumpscareSequence;
window.returnToMenu = returnToMenu;