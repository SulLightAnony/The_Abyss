// 1. Import State (Pusat Data)
import * as State from './state.js';

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


// --- SETELAH IMPORT BARU MASUK KE FUNGSI-FUNGSI UTAMA (initGameEngine, animate, dll) ---
function initGameEngine() {
    document.getElementById('item-max').innerText = LEVEL_DATA[currentLevel].items; document.getElementById('item-count').innerText = "0";
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(LEVEL_DATA[currentLevel].fogColor, LEVEL_DATA[currentLevel].fogDensity); scene.background = new THREE.Color(LEVEL_DATA[currentLevel].bg);
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800); camera.position.set(0, player.height, 0); scene.add(camera); lookState.yaw = 0; lookState.pitch = 0;
    buildCurrentLevel(); setupLighting(); if(droneOsc) droneOsc.frequency.value = (currentLevel===0 ? 50 : (currentLevel===1 ? 80 : 30));
}

// --- MAIN LOOP ---
function animate() {
    if(!gameActive) return; 
    animationFrameId = requestAnimationFrame(animate);
    const time = performance.now(); 
    if (tutorialPause) { prevTime = time; renderer.render(scene, camera); return; }
    const delta = Math.min((time - prevTime)/1000, 0.1); prevTime = time;

    // Handle Intro Cinematic Camera
    if (isIntroAnim) {
        introAnimTimer += delta;
        let progress = Math.min(1.0, introAnimTimer / 1.5);
        let ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        lookState.pitch = -Math.PI/2 * (1 - ease);
        if (progress >= 1.0) isIntroAnim = false;
    }

    const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();

    if (currentLevel === 0 && gamePhase < 2) {
        phaseTimer -= delta;
        if (phaseTimer <= 0) {
            phaseTimer = 0;
            if (gamePhase === 0) triggerNightmareMode();
            else if (gamePhase === 1) triggerSlaughterMode();
        }
        if (gamePhase < 2) {
            let mins = Math.floor(phaseTimer / 60);
            let secs = Math.floor(phaseTimer % 60);
            document.getElementById('nightmare-hud').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    const debugNmBtn = document.getElementById('debug-nightmare-btn');
    if (gamePhase === 0) debugNmBtn.innerText = "TEST NIGHTMARE";
    else if (gamePhase === 1) debugNmBtn.innerText = "TEST SLAUGHTER";
    else debugNmBtn.style.display = 'none';

    if (gamePhase >= 1) {
        let targetFog = new THREE.Color(0x550000);
        let targetBg = new THREE.Color(0x110000);
        scene.fog.color.lerp(targetFog, delta * 0.2);
        scene.background.lerp(targetBg, delta * 0.2);
        
        flashlightDurability = (gamePhase === 2) ? 8.0 : 4.0;
        
        nightmareGlitchTick += delta;
        if (nightmareGlitchTick >= 1.0) {
            nightmareGlitchTick -= 1.0;
            let glitchChance = (gamePhase === 2) ? 0.40 : 0.10; 
            if (Math.random() < glitchChance) {
                if (gamePhase === 2 && Math.random() < 0.5) {
                    if (!isBlackoutGlitch && !isPreBlackoutShake) {
                        isPreBlackoutShake = true;
                        setTimeout(() => {
                            isPreBlackoutShake = false;
                            isBlackoutGlitch = true;
                            let bOvl = document.getElementById('blink-overlay');
                            bOvl.style.transition = 'opacity 0.1s';
                            bOvl.style.opacity = 1;
                            setTimeout(() => {
                                if(!isBlinking) bOvl.style.opacity = 0;
                                setTimeout(() => {
                                    bOvl.style.transition = 'opacity 0.15s ease-in-out';
                                    isBlackoutGlitch = false;
                                }, 100);
                            }, 200); 
                        }, 100); 
                    }
                } else {
                    isGlitching = true;
                    glitchTimer = 0.2;
                }
            }
        }
    }
    
    if (gamePhase === 2) {
        slaughterSpeedMultiplier = Math.min(1.75, slaughterSpeedMultiplier + 0.02 * delta);
    }

    let flashBtn = document.getElementById('flashlight-btn');
    let repairContainer = document.getElementById('repair-bar-container'); let repairFill = document.getElementById('repair-bar-fill'); let repairText = document.getElementById('repair-text');

    if (flashlightState === 'REPAIRING') {
        repairContainer.style.display = 'block'; repairText.style.display = 'block';
        repairContainer.style.opacity = 1; repairText.style.opacity = 1;
        
        if (!isHoldingFlashlightBtn) {
            flashlightState = 'BROKEN'; showMessage("REPAIR CANCELLED!", true); 
            flashBtn.innerHTML = "💥"; flashBtn.style.borderColor = "red"; 
            repairContainer.style.opacity = 0; repairText.style.opacity = 0;
            setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
        } 
        else if (isWalking && gamePhase === 0) { 
            flashlightState = 'BROKEN'; showMessage("REPAIR FAILED: STAY STILL!", true); 
            flashBtn.innerHTML = "💥"; flashBtn.style.borderColor = "red"; 
            repairContainer.style.opacity = 0; repairText.style.opacity = 0;
            setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
        } 
        else {
            repairTimer += delta; 
            let pct = Math.floor((repairTimer / 4.0) * 100);
            repairFill.style.width = pct + "%"; 
            if (repairTimer >= 4.0) { 
                flashlightState = 'ON'; flashBtn.innerHTML = "🔦"; flashBtn.style.borderColor = "#ffdd44"; 
                repairContainer.style.opacity = 0; repairText.style.opacity = 0;
                setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
                flashlightDurability = (gamePhase === 2) ? 8.0 : (gamePhase === 1 ? 4.0 : 1.0); 
                playPickupSound(); 
            } 
        }
        flashlight.intensity = 0;
    } else if (flashlightState === 'BROKEN' || flashlightState === 'OFF') {
        flashlight.intensity = 0; 
        repairContainer.style.opacity = 0; repairText.style.opacity = 0;
        setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
        if(flashlightState === 'BROKEN') { flashBtn.innerHTML = "💥"; flashBtn.style.borderColor = "red"; flashBtn.classList.remove('active'); } else { flashBtn.innerHTML = "🔦"; flashBtn.style.borderColor = "#555"; flashBtn.classList.remove('active'); }
    } else if (flashlightState === 'ON') { 
        let baseInt = (currentLevel===2 ? 0.5 : 2.5);
        
        if (flashlightDurability > 1.5) {
            let flickerRisk = (flashlightDurability - 1.5) / 0.5;
            if (Math.random() < flickerRisk * 0.1) {
                baseInt *= (Math.random() > 0.5 ? 0.3 : 0.7); 
            }
        }
        flashlight.intensity = baseInt; 
        flashBtn.innerHTML = "🔦"; flashBtn.style.borderColor = "#ffdd44"; flashBtn.classList.add('active'); 
        repairContainer.style.opacity = 0; repairText.style.opacity = 0;
        setTimeout(()=>{ repairContainer.style.display = 'none'; repairText.style.display = 'none'; }, 200);
    }

    if(currentLevel < 2) {
        let activeVirtuals = virtualLights.map(vl => ({vl: vl, id: vl.id, dist: camera.position.distanceToSquared(new THREE.Vector3(vl.x, vl.y, vl.z))})).filter(v => v.dist < 80000).sort((a, b) => a.dist - b.dist).slice(0, 8);
        lightPool.forEach(p => { p.keep = false; }); activeVirtuals.forEach(av => { let existing = lightPool.find(p => p.active && p.virtualIdx === av.id); if (existing) { existing.keep = true; av.handled = true; } });
        activeVirtuals.filter(av => !av.handled).forEach(av => { let available = lightPool.find(p => !p.active && p.fadeOpacity <= 0.01); if (available) { available.active = true; available.keep = true; available.virtualIdx = av.id; available.assignedMesh = av.vl.mesh; available.light.position.set(av.vl.x, av.vl.y - 1.0, av.vl.z); available.baseInt = av.vl.baseInt; available.isFlicker = av.vl.isFlicker; } });
        lightPool.forEach(p => { if (p.keep) { p.fadeOpacity = Math.min(1.0, p.fadeOpacity + delta * 1.5); } else { p.fadeOpacity = Math.max(0.0, p.fadeOpacity - delta * 1.5); if (p.fadeOpacity <= 0) { p.active = false; p.virtualIdx = -1; p.light.intensity = 0; if(p.assignedMesh) p.assignedMesh.material = sharedMats.neonOff; p.assignedMesh = null; } } if (p.active || p.fadeOpacity > 0) { let currentInt = p.baseInt * p.fadeOpacity; let isFlickeringOff = false; if (p.isFlicker && Math.random() > 0.85) { isFlickeringOff = Math.random() > 0.5; } if (isFlickeringOff) { p.light.intensity = 0; if(p.assignedMesh) p.assignedMesh.material = sharedMats.neonOff; } else { p.light.intensity = currentInt; if(p.assignedMesh) p.assignedMesh.material = (p.fadeOpacity > 0.2) ? sharedMats.neon : sharedMats.neonOff; } } });
    }

    let targetFov = 70; if (isCameraLocked) { targetFov = 25; } if (Math.abs(currentFov - targetFov) > 0.5) { currentFov += (targetFov - currentFov) * delta * 1.5; camera.fov = currentFov; camera.updateProjectionMatrix(); }
    camera.rotation.set(0, 0, 0); camera.rotateY(lookState.yaw); camera.rotateX(lookState.pitch);

    if (isPreBlackoutShake && !isJumpscaring) {
        camera.rotation.z += (Math.random() - 0.5) * 0.8;
        camera.rotation.x += (Math.random() - 0.5) * 0.8;
        camera.rotation.y += (Math.random() - 0.5) * 0.8;
    } else if (gamePhase === 2 && !isJumpscaring) {
        camera.rotation.z += (Math.random() - 0.5) * 0.02;
        camera.rotation.x += (Math.random() - 0.5) * 0.01;
    }

    let currentBaseSpeed = player.baseSpeed; 
    if (flashlightState !== 'ON') { currentBaseSpeed *= 0.6; } 
    
    if(currentLevel === 1) { if(camera.position.y - player.height < waterLevel + 1) { if(!isPlayerInWater) { isPlayerInWater = true; document.getElementById('water-overlay').style.opacity = 1; } player.speed = currentBaseSpeed * 0.3; } else { if(isPlayerInWater) { isPlayerInWater = false; document.getElementById('water-overlay').style.opacity = 0; } player.speed = currentBaseSpeed; } } else { player.speed = currentBaseSpeed; }
    
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

    let finalMoveX = (moveInput.x !== 0) ? moveInput.x : pcMoveX;
    let finalMoveY = (moveInput.y !== 0) ? moveInput.y : pcMoveY;

    let pcWalking = (pcMoveX !== 0 || pcMoveY !== 0);
    let finalWalking = isWalking || pcWalking;

    const rightDir = new THREE.Vector3().crossVectors(camDir, camera.up).normalize(); const velocity = new THREE.Vector3(); let effSpeed = isCameraSnapping || isHoldingInteract || isIntroAnim ? 0 : player.speed; 
    velocity.addScaledVector(camDir, -finalMoveY * effSpeed * delta); 
    velocity.addScaledVector(rightDir, finalMoveX * effSpeed * delta);
    let nextPos = camera.position.clone(); nextPos.x += velocity.x; nextPos.z += velocity.z; velocityY -= 40.0 * delta; nextPos.y += velocityY * delta;
    
    let col = checkCollision(nextPos); if(!col.hit) { camera.position.x = nextPos.x; camera.position.z = nextPos.z; } else { let colX = checkCollision(new THREE.Vector3(nextPos.x, camera.position.y, camera.position.z)); let colZ = checkCollision(new THREE.Vector3(camera.position.x, camera.position.y, nextPos.z)); if(!colX.hit) camera.position.x = nextPos.x; if(!colZ.hit) camera.position.z = nextPos.z; }
    
    if(col.onGround && velocityY <= 0) { 
        let targetY = col.floorY + player.height; 
        
        if(finalWalking && !isCameraSnapping && !isHoldingInteract && !isIntroAnim) { 
            bobPhase += delta * 12.0 * (player.speed / player.baseSpeed); 
            bobAmt += (0.7 - bobAmt) * delta * 5.0; 
        } else {
            bobAmt += (0.0 - bobAmt) * delta * 8.0;  
        }
        
        let bobOffset = Math.sin(bobPhase) * bobAmt;
        targetY += bobOffset;

        camera.position.y += (targetY - camera.position.y) * 15.0 * delta;
        velocityY = 0; isJumping = false; 

        let currentStepPhase = Math.floor(bobPhase / Math.PI);
        if (currentStepPhase > lastStepPhase && bobAmt > 0.3) {
            playFootstepSound();
            lastStepPhase = currentStepPhase;
        }
    }
    if(camera.position.y < deathYLevel) { triggerJumpscareSequence("FALLEN"); return; }

    const smartBtn = document.getElementById('smart-action-btn');
    nearestItemObj = null; let minDistItem = 9999;
    for (let i = 0; i < items.length; i++) { items[i].rotation.y += delta; let d = camera.position.distanceTo(items[i].position); if (d < 12) { if (d < minDistItem) { minDistItem = d; nearestItemObj = items[i]; } } }
    let dDoor = exitDoor ? camera.position.distanceTo(exitDoor.position) : 9999;
    if (dDoor < 12) { smartBtnState = 'DOOR'; smartBtn.innerHTML = "EXIT"; smartBtn.style.backgroundColor = "rgba(255, 255, 255, 0.7)"; smartBtn.style.color = "black"; smartBtn.style.borderColor = "#fff"; } 
    else if (nearestItemObj) { smartBtnState = 'ITEM'; smartBtn.innerHTML = "TAKE"; smartBtn.style.backgroundColor = "rgba(255, 255, 255, 0.7)"; smartBtn.style.color = "black"; smartBtn.style.borderColor = "#fff"; } 
    else { smartBtnState = 'BLINK'; smartBtn.innerHTML = "CLOSE<br>EYES"; smartBtn.style.backgroundColor = "rgba(10, 10, 10, 0.6)"; smartBtn.style.color = "#ff9999"; smartBtn.style.borderColor = "rgba(150, 0, 0, 0.5)"; }

    let interactContainer = document.getElementById('interact-bar-container'); let interactFill = document.getElementById('interact-bar-fill'); let interactText = document.getElementById('interact-text');
    if (isHoldingInteract && smartBtnState === 'ITEM') {
        if (finalWalking || !nearestItemObj || isCameraLocked) { 
            isHoldingInteract = false; interactProgress = 0; showMessage("RETRIEVAL CANCELED!", true); 
            interactContainer.style.opacity = 0; interactText.style.opacity = 0;
            setTimeout(()=>{ interactContainer.style.display = 'none'; interactText.style.display = 'none'; }, 200);
        } else { 
            interactContainer.style.display = 'block'; interactText.style.display = 'block'; 
            interactContainer.style.opacity = 1; interactText.style.opacity = 1;
            interactProgress += delta; let pct = Math.min(100, (interactProgress / 5.0) * 100); interactFill.style.width = pct + "%"; 
            if (interactProgress >= 5.0) { 
                isHoldingInteract = false; 
                interactContainer.style.opacity = 0; interactText.style.opacity = 0;
                setTimeout(()=>{ interactContainer.style.display = 'none'; interactText.style.display = 'none'; }, 200);
                playPickupSound(); 
                
                let lastItemPos = nearestItemObj.position.clone(); let itemIdx = items.indexOf(nearestItemObj); 
                if (itemIdx > -1) { 
                    scene.remove(nearestItemObj); items.splice(itemIdx, 1); itemsCollected++; document.getElementById('item-count').innerText = itemsCollected; 
                    
                    phaseTimer = Math.max(0, phaseTimer - 15.0); 
                    
                    if(currentLevel === 0 && itemsCollected <= 3 && monsters[itemsCollected - 1] && gamePhase === 0) { 
                        let newM = monsters[itemsCollected - 1];
                        newM.respawnCooldown = 5.0; 
                        showMessage("Something has awakened in the dark..."); 
                    } 
                    
                    if (itemsCollected === LEVEL_DATA[currentLevel].items) { createExitDoor(lastItemPos); } 
                } 
            } 
        }
    } else { 
        interactContainer.style.opacity = 0; interactText.style.opacity = 0;
        setTimeout(()=>{ interactContainer.style.display = 'none'; interactText.style.display = 'none'; }, 200);
    }

    if(isBlinking && items.length > 0 && whisperGain && whisperOsc) { 
        let nearest = items[0]; 
        let minDist = camera.position.distanceTo(nearest.position); 
        for(let i=1; i<items.length; i++) { 
            let d = camera.position.distanceTo(items[i].position); 
            if(d < minDist) { minDist = d; nearest = items[i]; } 
        } 
        let dirToItem = new THREE.Vector3().subVectors(nearest.position, camera.position).normalize();
        let dot = camDir.dot(dirToItem);
        
        let targetVol = Math.max(0, dot) * 0.85; 
        whisperGain.gain.value += (targetVol - whisperGain.gain.value) * 0.2; 
        whisperOsc.frequency.value = 300 + (Math.max(0, dot) * 500); 
    }

    let globalNoiseInt = 0; let globalStareFreq = 0; let minUnseenDist = 9999; let closestVisibleMonster = null; let minVisDist = 9999; let isLookingAtAnyMonster = false;
    let fatalMultiplier = (flashlightState === 'ON') ? 1.0 : 0.7;
    
    let lockRadius = (flashlightState === 'ON') ? 45.0 : 45.0 * 0.7; 
    let escapeRadius = lockRadius + 10.0; 
    
    let minColDist = (gamePhase === 2) ? 0.0 : 35.0; 

    for(let i=0; i<monsters.length; i++) { if(!monsters[i].active) continue; for(let j=i+1; j<monsters.length; j++) { if(!monsters[j].active) continue; let dx = monsters[i].mesh.position.x - monsters[j].mesh.position.x; let dz = monsters[i].mesh.position.z - monsters[j].mesh.position.z; if(Math.sqrt(dx*dx + dz*dz) < minColDist) { monsters[j].active = false; monsters[j].despawnProgress = 0; monsters[j].respawnCooldown = getCurrentRespawnTime(); } } }

    monsters.forEach(m => {
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
        if(m.type === 4) { m.mesh.rotation.y = Math.atan2(camera.position.x - m.mesh.position.x, camera.position.z - m.mesh.position.z); }
        let dX = m.mesh.position.x - camera.position.x; let dZ = m.mesh.position.z - camera.position.z; let dist2D = Math.sqrt(dX*dX + dZ*dZ); 
        let targetPos = m.mesh.position.clone(); targetPos.y += (m.type === 1 ? 0 : 5); const dirToMonster = new THREE.Vector3().subVectors(targetPos, camera.position).normalize();
        m.visibleFrame = false; let dotProd = camDir.dot(dirToMonster);
        if(dotProd > 0.4 && dist2D < 55) { const raycaster = new THREE.Raycaster(camera.position, dirToMonster); const intersects = raycaster.intersectObjects(wallMeshes, true); if(intersects.length === 0 || intersects[0].distance > dist2D) { m.visibleFrame = true; } }
        if(m.visibleFrame && !isBlinking) { if(dist2D < minVisDist) { minVisDist = dist2D; closestVisibleMonster = m; } } else { if(dist2D < minUnseenDist) minUnseenDist = dist2D; }
    });

    isCameraLocked = false; currentlySnapping = false; anyMonsterDespawningUI = false;
    if (lockedMonster) { if (!lockedMonster.active || !lockedMonster.visibleFrame) { lockedMonster = null; } }
    if (!lockedMonster && closestVisibleMonster && minVisDist < lockRadius) { lockedMonster = closestVisibleMonster; lockedMonster.isSnappingCam = true; }

    if (lockedMonster) {
        let dist2D = camera.position.distanceTo(lockedMonster.mesh.position);
        if (dist2D > escapeRadius) { 
            if (gamePhase !== 2) {
                lockedMonster.active = false; 
                lockedMonster.despawnProgress = 0; 
                lockedMonster.respawnCooldown = getCurrentRespawnTime(); 
            } else {
                lockedMonster.despawnProgress = 0;
            }
            lockedMonster = null; 
        } 
        else {
            isLookingAtAnyMonster = true; isCameraLocked = true;
            let targetYaw = Math.atan2(camera.position.x - lockedMonster.mesh.position.x, camera.position.z - lockedMonster.mesh.position.z);
            let diff = targetYaw - (lookState.yaw % (Math.PI * 2));
            while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
            if (lockedMonster.isSnappingCam) { currentlySnapping = true; if (Math.abs(diff) > 0.05) { lookState.yaw += diff * (delta * 10.0); lookState.pitch += (0 - lookState.pitch) * (delta * 10.0); } else { lockedMonster.isSnappingCam = false; lockedMonster.hasSnappedEncounter = true; playUIClickSound(); } } 
            else { lookState.yaw += diff * (delta * 5.0); lookState.pitch += (0 - lookState.pitch) * (delta * 5.0); }
            
            if (flashlightState === 'ON' && !isBlinking) { lockedMonster.despawnProgress += 33.33 * delta; } else { lockedMonster.despawnProgress = Math.max(0, lockedMonster.despawnProgress - 20.0 * delta); }
            if (lockedMonster.despawnProgress > 0) { 
                anyMonsterDespawningUI = true; 
                let dBarCont = document.getElementById('despawn-bar-container'); let dText = document.getElementById('despawn-text');
                dBarCont.style.display = 'block'; dText.style.display = 'block'; 
                dBarCont.style.opacity = 1; dText.style.opacity = 1;
                document.getElementById('despawn-bar-fill').style.width = Math.min(100, lockedMonster.despawnProgress) + '%'; 
            }
            if (lockedMonster.despawnProgress >= 100) { 
                lockedMonster.active = false; 
                lockedMonster.despawnProgress = 0; 
                lockedMonster.respawnCooldown = getCurrentRespawnTime(); 
                lockedMonster = null; 
            }
        }
    }

    monsters.forEach(m => {
        if(!m.active) return; if (m !== lockedMonster) m.despawnProgress = 0;
        let dX = m.mesh.position.x - camera.position.x; let dZ = m.mesh.position.z - camera.position.z; let dist2D = Math.sqrt(dX*dX + dZ*dZ); 
        
        let activeSpeedMult = (gamePhase === 2) ? slaughterSpeedMultiplier : 1.0;

        if (!m.visibleFrame && !isBlinking) { m.mesh.scale.set(1, 1, 1); let moveSpd = m.speed * activeSpeedMult; if(m.type===1) { m.mesh.position.y = -2; moveSpd *= (isPlayerInWater?2.5:0.2); } else if(m.type===2) { m.mesh.position.y += (camera.position.y - m.mesh.position.y)*0.05; } else if(m.type===3) { m.mesh.position.y = 3; } else if(m.type===4) { m.mesh.position.y = 5; } else { m.mesh.position.y = 0; } let moveDir = new THREE.Vector3().subVectors(m.mesh.position, camera.position).normalize(); m.mesh.position.addScaledVector(moveDir, -moveSpd * delta); if(m.type !== 4) m.mesh.rotation.y = Math.atan2(camera.position.x - m.mesh.position.x, camera.position.z - m.mesh.position.z); } 
        else if (m.visibleFrame) { if (flashlightState !== 'ON' || isBlinking) { let moveSpd = m.speed * activeSpeedMult; if(m.type===1) { m.mesh.position.y = -2; moveSpd *= (isPlayerInWater?2.5:0.2); } else if(m.type===2) { m.mesh.position.y += (camera.position.y - m.mesh.position.y)*0.05; } else if(m.type===3) { m.mesh.position.y = 3; } else if(m.type===4) { m.mesh.position.y = 5; } else { m.mesh.position.y = 0; } let moveDir = new THREE.Vector3().subVectors(m.mesh.position, camera.position).normalize(); m.mesh.position.addScaledVector(moveDir, -moveSpd * delta); if(m.type !== 4) m.mesh.rotation.y = Math.atan2(camera.position.x - m.mesh.position.x, camera.position.z - m.mesh.position.z); } else { m.mesh.scale.set(1+(Math.random()*0.5), 1+(Math.random()*-0.4), 1+(Math.random()*0.5)); m.mesh.position.x += (Math.random()-0.5)*1.0; m.mesh.rotation.z = (Math.random()-0.5)*0.2; } let intensity = Math.max(0, Math.min(1, 1.0 - (dist2D / 50.0))); if(intensity > globalNoiseInt) { globalNoiseInt = intensity; globalStareFreq = 50 + (Math.random()*300) + (intensity*600); } }
        
        let fatalD = (m.type === 1 ? 14.0 : 4.5) * fatalMultiplier; 
        if (gamePhase === 2) fatalD /= 2.0; 
        if(dist2D < fatalD && m.active && !isBlinking) triggerJumpscareSequence("CORRUPTED");
    });

    if (!anyMonsterDespawningUI) { 
        let dBarCont = document.getElementById('despawn-bar-container'); let dText = document.getElementById('despawn-text');
        dBarCont.style.opacity = 0; dText.style.opacity = 0;
        setTimeout(()=>{ dBarCont.style.display = 'none'; dText.style.display = 'none'; }, 200);
    }
    isCameraSnapping = currentlySnapping; 
    
    normalTick += delta;

    if (isLookingAtAnyMonster) { 
        sabotageTick += delta;
        if (gamePhase === 2) {
            if (sabotageTick >= 1.0) { 
                sabotageTick -= 1.0; 
                if (flashlightState === 'ON') { 
                    flashlightState = 'OFF'; playUIClickSound(); 
                } 
            }
        } else {
            if (sabotageTick >= 0.5) { 
                sabotageTick -= 0.5; 
                let saboChance = (gamePhase === 1) ? 0.35 : 0.25;
                if (flashlightState === 'ON' && Math.random() < saboChance) { 
                    flashlightState = 'OFF'; playUIClickSound(); 
                } 
            } 
        }
    } else { 
        sabotageTick = 0; 

        if (gamePhase >= 1 && flashlightState === 'ON') {
            nightmareTurnOffTick += delta;
            if (nightmareTurnOffTick >= 1.0) {
                nightmareTurnOffTick -= 1.0;
                let offChance = (gamePhase === 2) ? 0.30 : 0.15;
                if (Math.random() < offChance) {
                    flashlightState = 'OFF'; playUIClickSound();
                }
            }
        }

        if (flashlightState === 'ON') { 
            if (gamePhase === 0) {
                flashlightDurability = Math.min(2.0, flashlightDurability + (0.02 * delta));
            }
            
            if (normalTick >= 1.0) { 
                normalTick -= 1.0; 
                let breakChance = flashlightDurability / 100.0;
                if (Math.random() < breakChance) { 
                    flashlightState = 'BROKEN'; playUIClickSound(); showMessage("LIGHT FAILURE! REPAIRING...", true); 
                } 
            } 
        } else { 
            if (normalTick >= 1.0) normalTick = 0; 
            if (nightmareTurnOffTick >= 1.0) nightmareTurnOffTick = 0;
        } 
    }
    
    let durHUD = document.getElementById('durability-hud');
    if (durHUD) {
        durHUD.innerText = `💥 ${flashlightDurability.toFixed(2)}%`;
        if (flashlightDurability >= 2.0) durHUD.style.color = '#ff4444';
        else durHUD.style.color = '#ffffff';
    }

    let detectRadius = (flashlightState === 'ON') ? 40.0 : 40.0 * 0.7; 
    if (gamePhase === 2) detectRadius /= 2.0; 
    if (proxGain && proxOsc) { if (minUnseenDist < detectRadius) { let vol = Math.max(0, 1.0 - (minUnseenDist / detectRadius)); proxGain.gain.value = vol * 1.5; proxOsc.frequency.value = 100 + (vol * 150); } else { proxGain.gain.value = 0; } }
    
    const noiseOvl = document.getElementById('noise-overlay'); const vignetteOvl = document.getElementById('vignette-overlay');
    
    if (isGlitching) {
        glitchTimer -= delta;
        noiseOvl.style.opacity = 0.9;
        camera.rotation.z += (Math.random() - 0.5) * 0.2;
        if (glitchTimer <= 0) isGlitching = false;
    } else if(isLookingAtAnyMonster) { 
        globalStareTimer = Math.min(globalStareTimer + delta, 3.0); noiseOvl.style.opacity = globalNoiseInt; 
        if(stareGain && stareOsc) { stareGain.gain.value = globalNoiseInt * 0.4; stareOsc.frequency.value = globalStareFreq; } 
        if(droneGain) droneGain.gain.value = 0.05; 
    } else { 
        globalStareTimer = Math.max(globalStareTimer - delta * 2.0, 0.0); noiseOvl.style.opacity = 0; 
        if(stareGain) stareGain.gain.value = 0; if(droneGain) droneGain.gain.value = 0.3; 
    }
    
    let paranoiaIntensity = globalStareTimer / 3.0; vignetteOvl.style.opacity = paranoiaIntensity * 0.7; if(paranoiaIntensity > 0 && !isJumpscaring && !isGlitching && !isPreBlackoutShake) { camera.rotation.z += (Math.random() - 0.5) * paranoiaIntensity * 0.1; }
    renderer.render(scene, camera);
}

function initMenuParticles() {
    let dpr = window.devicePixelRatio || 1;
    menuCanvas.width = window.innerWidth * dpr;
    menuCanvas.height = window.innerHeight * dpr;
    particles = [];
    for(let i=0; i<15; i++) {
        particles.push({
            x: Math.random() * menuCanvas.width,
            y: Math.random() * menuCanvas.height,
            vx: ((Math.random() - 0.5) * 0.8) * dpr,
            vy: ((Math.random() - 0.5) * 0.8) * dpr,
            size: (Math.random() * 3 + 2.5) * dpr
        });
    }
}
function animateMenuParticles() {
    if (document.getElementById('start-screen').style.display !== 'none') {
        mctx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
        mctx.shadowBlur = 20;
        mctx.shadowColor = '#ffaaaa';
        mctx.fillStyle = 'rgba(255, 170, 170, 0.9)';
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if(p.x < 0) p.x = menuCanvas.width; if(p.x > menuCanvas.width) p.x = 0;
            if(p.y < 0) p.y = menuCanvas.height; if(p.y > menuCanvas.height) p.y = 0;
            mctx.beginPath(); mctx.arc(p.x, p.y, p.size, 0, Math.PI*2); mctx.fill();
        });
        particleAnimId = requestAnimationFrame(animateMenuParticles);
    }
}
initMenuParticles(); animateMenuParticles();

function checkSaveData() {
    const btnContinue = document.getElementById('btn-continue'); const saveInfo = document.getElementById('save-info');
    if (currentLevel > 0 && currentLevel < 3) { btnContinue.style.display = 'inline-block'; saveInfo.innerText = `Data Found: ${LEVEL_DATA[currentLevel].name}`; }
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
        if(isNewGame) { currentLevel = 0; localStorage.setItem('batas_semu_level', 0); } 
        
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
    e.preventDefault(); tutorialPause = false; playUIClickSound();
    let pop = document.getElementById('tutorial-popup');
    pop.style.opacity = 0;
    if (window.lockPointer && !window.isHoldingAlt) window.lockPointer();
    setTimeout(() => { pop.style.display = 'none'; }, 200);
};
document.getElementById('btn-tutorial-ok').addEventListener('touchstart', tutHandler, {passive: false});
document.getElementById('btn-tutorial-ok').addEventListener('click', tutHandler);

function clearSaveAndRestart() { localStorage.setItem('batas_semu_level', 0); location.reload(); }

function returnToMenu() {
    gameActive = false; if(animationFrameId) cancelAnimationFrame(animationFrameId);
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
debugBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameActive && !isJumpscaring) advanceLevel(); }, {passive: false}); 
debugBtn.addEventListener('click', (e) => { e.preventDefault(); if(gameActive && !isJumpscaring) advanceLevel(); });

const nightmareBtn = document.getElementById('debug-nightmare-btn');
nightmareBtn.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameActive && currentLevel === 0 && phaseTimer > 10.0) phaseTimer = 10.0; }, {passive: false});
nightmareBtn.addEventListener('click', (e) => { e.preventDefault(); if(gameActive && currentLevel === 0 && phaseTimer > 10.0) phaseTimer = 10.0; });

function updateProgress(percent, taskText) { document.getElementById('load-bar-fill').style.width = percent + '%'; document.getElementById('load-task').innerText = taskText; document.getElementById('load-task').style.color = '#888'; return new Promise(resolve => setTimeout(resolve, 50)); }
function startTips() { const tipEl = document.getElementById('tip-container'); let idx = Math.floor(Math.random() * loadingTips.length); tipEl.innerText = loadingTips[idx]; if(tipIntervalId) clearInterval(tipIntervalId); setTimeout(()=>{tipEl.style.opacity=1;}, 20); tipIntervalId = setInterval(() => { tipEl.style.opacity = 0; setTimeout(() => { idx = (idx + 1) % loadingTips.length; tipEl.innerText = loadingTips[idx]; tipEl.style.opacity = 1; }, 400); }, 3000); }

function updateLevelUI() {
    let modeText = gamePhase === 0 ? "(NORMAL)" : (gamePhase === 1 ? "(NIGHTMARE)" : "(SLAUGHTER)");
    let ind = document.getElementById('level-indicator');
    ind.innerText = LEVEL_DATA[currentLevel].name + " " + modeText;
    if (gamePhase > 0) ind.style.color = '#ff4444';
    else ind.style.color = '#88aa88';
}

async function startLoadingProcess() {
    if(particleAnimId) cancelAnimationFrame(particleAnimId);
    mctx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);
    
    startTips(); await updateProgress(10, "Initializing Engine..."); unlockAudio();
    if(!audioCtx) return;
    try {
        if(!droneOsc) { droneOsc = audioCtx.createOscillator(); droneGain = audioCtx.createGain(); droneOsc.type = 'sine'; droneOsc.frequency.value = 50; droneGain.gain.value = 0.2; droneOsc.connect(droneGain); droneGain.connect(audioCtx.destination); droneOsc.start(); }
        if(!whisperOsc) { whisperOsc = audioCtx.createOscillator(); whisperGain = audioCtx.createGain(); whisperOsc.type = 'triangle'; whisperOsc.frequency.value = 800; whisperGain.gain.value = 0; whisperOsc.connect(whisperGain); whisperGain.connect(audioCtx.destination); whisperOsc.start(); }
        if(!stareOsc) { stareOsc = audioCtx.createOscillator(); stareGain = audioCtx.createGain(); stareOsc.type = 'sawtooth'; stareGain.gain.value = 0; stareOsc.connect(stareGain); stareGain.connect(audioCtx.destination); stareOsc.start(); }
        if(!proxOsc) { proxOsc = audioCtx.createOscillator(); proxGain = audioCtx.createGain(); proxOsc.type = 'sawtooth'; proxOsc.frequency.value = 100; proxGain.gain.value = 0; proxOsc.connect(proxGain); proxGain.connect(audioCtx.destination); proxOsc.start(); }
        
        if(!nightmareNoiseSrc) {
            let bufferSize = audioCtx.sampleRate * 2;
            let noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            let output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) { output[i] = Math.random() * 2 - 1; }
            nightmareNoiseGain = audioCtx.createGain(); nightmareNoiseGain.gain.value = 0;
            nightmareNoiseSrc = audioCtx.createBufferSource(); nightmareNoiseSrc.buffer = noiseBuffer; nightmareNoiseSrc.loop = true;
            let noiseFilter = audioCtx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 800;
            nightmareNoiseSrc.connect(noiseFilter); noiseFilter.connect(nightmareNoiseGain); nightmareNoiseGain.connect(audioCtx.destination);
            nightmareNoiseSrc.start();
        }
    } catch(e) {}

    if(!renderer) { renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setSize(window.innerWidth, window.innerHeight); document.body.appendChild(renderer.domElement); window.addEventListener('resize', onWindowResize, false); setupControls(); }
    
    await updateProgress(40, "Generating Materials..."); initSharedMats(); 
    getMaterialCache('carpet'); getMaterialCache('wallpaper'); getMaterialCache('ceiling');
    if(currentLevel >= 1) getMaterialCache('pool_tile'); if(currentLevel >= 2) getMaterialCache('concrete');

    await updateProgress(70, "Building World..."); await new Promise(r => setTimeout(r, 50)); 
    try { clearScene(); initGameEngine(); } catch (e) { document.getElementById('load-task').innerText = "SYSTEM ERROR: " + e.message; document.getElementById('load-task').style.color = "#ff4444"; console.error("Map Generation Error:", e); return; }

    await updateProgress(95, "Calibrating Gaze Raycaster..."); await new Promise(r => setTimeout(r, 50)); 
    try { renderer.render(scene, camera); } catch(e) { console.error("Render", e); } await new Promise(r => setTimeout(r, 200)); 

    await updateProgress(100, "Ready..."); clearInterval(tipIntervalId); 
    
    document.getElementById('loading-screen').style.opacity = 0;
    
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none'; 
        document.getElementById('ui-layer').style.display = 'block';
        
        document.getElementById('debug-nightmare-btn').style.display = 'inline-block';
        document.getElementById('debug-nightmare-btn').innerText = "TEST NIGHTMARE";

        isCameraSnapping = false; isCameraLocked = false; isJumpscaring = false; globalStareTimer = 0; 
        camera.rotation.set(0,0,0);
        
        lookState.yaw = 0;
        lookState.pitch = -Math.PI / 2;
        
        isIntroAnim = true;
        introAnimTimer = 0;
        
        currentFov = 70; camera.fov = currentFov; camera.updateProjectionMatrix();
        
        flashlightState = 'ON'; repairTimer = 0; isHoldingFlashlightBtn = false;
        flashlightDurability = 1.0; 
        normalTick = 0; sabotageTick = 0; nightmareTurnOffTick = 0;
        tutorialPause = false;
        
        gamePhase = 0; phaseTimer = 300.0; slaughterSpeedMultiplier = 1.0;
        nightmareGlitchTick = 0; isGlitching = false; isBlackoutGlitch = false; isPreBlackoutShake = false;
        walkTime = 0; lastStepPhase = 0; bobPhase = 0; bobAmt = 0;
        
        updateLevelUI();
        
        let nmHud = document.getElementById('nightmare-hud');
        nmHud.style.display = (currentLevel === 0) ? 'block' : 'none';
        nmHud.style.color = '#ffffff'; nmHud.classList.remove('blinking-text');

        lockedMonster = null;
        isHoldingInteract = false; interactProgress = 0; smartBtnState = 'BLINK';
        monsters.forEach(m => { m.despawnProgress = 0; });
        
        gameActive = true; prevTime = performance.now();
        showMessage(currentLevel === 0 ? "Find 4 Reality Keys..." : (currentLevel === 1 ? "Deep water hinders your movement." : "Don't look down."));

        document.getElementById('global-blackout').style.opacity = 0;

        if (currentLevel === 0) {
            tutorialPause = true;
            let tutPop = document.getElementById('tutorial-popup');
            tutPop.style.display = 'flex';
            setTimeout(()=>{ tutPop.style.opacity = 1; }, 20);
        }

        if(animationFrameId) cancelAnimationFrame(animationFrameId); animate(); 
    }, 250);
}

function advanceLevel() {
    gameActive = false; if(animationFrameId) cancelAnimationFrame(animationFrameId); 
    if (document.pointerLockElement) document.exitPointerLock();
    
    const fade = document.getElementById('fade-transition'); fade.style.display = 'block'; setTimeout(() => { fade.style.opacity = 1; }, 50);
    setTimeout(() => {
        currentLevel++;
        if(currentLevel > 2) { 
            document.getElementById('ui-layer').style.display = 'none'; 
            document.getElementById('end-screen').style.display = 'flex'; 
            setTimeout(()=>{ document.getElementById('end-screen').style.opacity = 1; }, 20);
            fade.style.opacity = 0; if(audioCtx) audioCtx.close(); 
        } 
        else { 
            localStorage.setItem('batas_semu_level', currentLevel); clearScene(); fade.style.opacity = 0; fade.style.display = 'none'; document.getElementById('ui-layer').style.display = 'none'; 
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
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight; 
        camera.updateProjectionMatrix(); 
        renderer.setSize(window.innerWidth, window.innerHeight); 
    }
    if(menuCanvas) { 
        let dpr = window.devicePixelRatio || 1;
        menuCanvas.width = window.innerWidth * dpr; 
        menuCanvas.height = window.innerHeight * dpr; 
    }
}
window.addEventListener('resize', onWindowResize, false);

function showMessage(text, isRed = false) { let msgBox = document.getElementById('message-box'); msgBox.innerText = text; msgBox.style.color = isRed ? "#ff0000" : "#ddd"; msgBox.style.borderColor = isRed ? "#ff0000" : "#555"; msgBox.style.opacity = 1; setTimeout(() => { msgBox.style.opacity = 0; }, 4000); }
function checkCollision(pos) { const radius = 1.5; const playerBox = new THREE.Box3( new THREE.Vector3(pos.x - radius, pos.y - player.height + 0.1, pos.z - radius), new THREE.Vector3(pos.x + radius, pos.y, pos.z + radius) ); let onGround = false; let highestFloorY = -999; for(let i=0; i<colliders.length; i++) { if(playerBox.intersectsBox(colliders[i])) { if(colliders[i].max.y <= pos.y - player.height + 2.5) { onGround = true; if(colliders[i].max.y > highestFloorY) highestFloorY = colliders[i].max.y; } else return { hit: true, onGround: onGround, floorY: highestFloorY }; } } return { hit: false, onGround: onGround, floorY: highestFloorY }; }

function triggerNightmareMode() {
    gamePhase = 1;
    phaseTimer = 150.0; 
    updateLevelUI();
    document.getElementById('nightmare-hud').style.color = '#ff4444';
    showMessage("This place wants you to leave. Escape NOW.", true);
    if(nightmareNoiseGain) nightmareNoiseGain.gain.value = 0.15; 
    if(droneOsc) { droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 35; } 
    
    if (currentLevel === 0) {
        for(let i=0; i<3; i++) {
            if (monsters[i] && !monsters[i].active) {
                placeMonsterFar(monsters[i]);
            }
        }
    }
}

function triggerSlaughterMode() {
    gamePhase = 2;
    phaseTimer = 0.0;
    updateLevelUI();
    let nmHud = document.getElementById('nightmare-hud');
    nmHud.innerText = "00:00";
    nmHud.classList.add('blinking-text');
    showMessage("This place wants you to die.", true);
    if(nightmareNoiseGain) nightmareNoiseGain.gain.value = 0.3; 
}

function showGameOverScreen() {
    clearScene();
    if(document.pointerLockElement) document.exitPointerLock();
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'flex';
    setTimeout(()=>{ document.getElementById('game-over-screen').style.opacity = 1; }, 20);
}

function triggerJumpscareSequence(msg) {
    if (isJumpscaring) return;
    isJumpscaring = true;
    gameActive = false; 
    if(animationFrameId) cancelAnimationFrame(animationFrameId); 
    if(document.pointerLockElement) document.exitPointerLock();
    
    if(proxGain) proxGain.gain.value = 0; if(stareGain) stareGain.gain.value = 0; if(whisperGain) whisperGain.gain.value = 0; if(droneGain) droneGain.gain.value = 0.2; if(nightmareNoiseGain) nightmareNoiseGain.gain.value = 0; 
    
    playMonsterScreamSound(); 
    
    if(audioCtx) {
        try {
            let t = audioCtx.currentTime;
            let highOsc = audioCtx.createOscillator();
            let highGain = audioCtx.createGain();
            highOsc.type = 'sine';
            highOsc.frequency.setValueAtTime(400, t);
            highOsc.frequency.exponentialRampToValueAtTime(2000, t + 0.1); 
            highGain.gain.setValueAtTime(1.0, t);
            highGain.gain.exponentialRampToValueAtTime(0.01, t + 3.0); 
            highOsc.connect(highGain);
            highGain.connect(audioCtx.destination);
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
    let basePos = camera.position.clone();
    let baseRot = camera.rotation.clone();
    
    let flashInterval = setInterval(() => {
        let pattern = flashCount % 4;
        if (pattern === 0) { flashOvl.style.display = 'block'; flashOvl.style.backgroundColor = 'white'; }
        else if (pattern === 1) { flashOvl.style.display = 'none'; }
        else if (pattern === 2) { flashOvl.style.display = 'block'; flashOvl.style.backgroundColor = '#aa8888'; } 
        else if (pattern === 3) { flashOvl.style.display = 'none'; }

        camera.position.set(basePos.x + (Math.random()-0.5)*3.0, basePos.y + (Math.random()-0.5)*3.0, basePos.z + (Math.random()-0.5)*3.0);
        camera.rotation.set(baseRot.x + (Math.random()-0.5)*0.5, baseRot.y + (Math.random()-0.5)*0.5, baseRot.z + (Math.random()-0.5)*0.5);
        renderer.render(scene, camera);

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




window.onload = checkSaveData;