import * as State from './state.js';
import { getMaterialCache } from './world.js';
import { playMonsterScreamSound } from './audio.js';

function createMonster(type, pos) {
    let group = new THREE.Group(); let mObj = { mesh: group, type: type, active: false, speed: type===1?25.0:12.0, lookTimer: 0, despawnProgress: 0, visibleFrame: false, hasSnappedEncounter: false, isSnappingCam: false, respawnCooldown: -1 };
    if (type === 0) { const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 6), State.sharedMats.m0); t1.position.y = 5; group.add(t1); const h1 = new THREE.Mesh(getBaseSphere(), State.sharedMats.m0); h1.scale.set(1.2, 1.2, 1.2); h1.position.y = 9; group.add(h1); } 
    else if (type === 1) { for(let i=0; i<8; i++) { const seg = new THREE.Mesh(getBaseCyl(), State.sharedMats.m1); let sc = 4 - (i*0.4); seg.scale.set(sc, 10, sc); seg.rotation.x = Math.PI/2; seg.position.z = i * 8; group.add(seg); } const eyes = new THREE.Mesh(getBaseBox(), State.sharedMats.m1Eye); eyes.scale.set(5, 1.5, 1); eyes.position.set(0, 1.5, -5); group.add(eyes); }
    else if (type === 2) { group.add(new THREE.Mesh(getBaseSphere(), State.sharedMats.m2Core)); mObj.rings = []; for(let i=0; i<4; i++) { let r = new THREE.Mesh(new THREE.TorusGeometry(6+i, 0.5, 8, 20), State.sharedMats.m2Ring); r.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0); group.add(r); mObj.rings.push(r); } }
    else if (type === 3) { for(let i=0; i<20; i++) { const c = new THREE.Mesh(getBaseBox(), State.sharedMats.m3); c.scale.set(2, 2, 2); c.position.set((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8); group.add(c); } }
    else if (type === 4) { const eye = new THREE.Mesh(getBaseSphere(), State.sharedMats.m4Eye); eye.scale.set(3,3,3); const pupil = new THREE.Mesh(getBaseCyl(), State.sharedMats.m4Pupil); pupil.scale.set(1, 6, 1); pupil.rotation.x = Math.PI/2; group.add(eye); group.add(pupil); }
    group.position.set(pos.x, pos.y, pos.z); State.scene.add(group); group.updateMatrixWorld(true); State.monsters.push(mObj);
}

function spawnItems(locations, levelType) {
    let geo, mat; if(levelType === 0) { geo = new THREE.OctahedronGeometry(1.5); mat = State.sharedMats.item0; } else if (levelType === 1) { geo = new THREE.TorusGeometry(1.5, 0.5, 8, 12); mat = State.sharedMats.item1; } else { geo = new THREE.IcosahedronGeometry(1.5); mat = State.sharedMats.item2; }
    locations.forEach(pos => { const yPos = pos.y !== undefined ? pos.y + 4 : (levelType===1 ? 2 : 6); const item = new THREE.Mesh(geo, mat); item.position.set(pos.x, yPos, pos.z); const light = new THREE.PointLight(mat.color, 1, 15); item.add(light); State.scene.add(item); State.items.push(item); });
}

function createExitDoor(lastItemPos) {
    const mat = new THREE.MeshPhongMaterial({ color: 0x880000, emissive: 0xff0000 }); exitDoor = new THREE.Mesh(getBaseBox(), mat); exitDoor.scale.set(10, 16, 2);
    if(State.currentLevel === 0) { exitDoor.position.set(0, 8, 0); } else if (State.currentLevel === 1) { exitDoor.position.set(0, 8, -450); } else { exitDoor.position.set(lastItemPos.x, lastItemPos.y + 6, lastItemPos.z - 20); addWall(exitDoor.position.x, exitDoor.position.y-8, exitDoor.position.z, 20, 2, 20, State.sharedMats.neonOff); }
    const light = new THREE.PointLight(0xff0000, 3, 50); light.position.z = 3; exitDoor.add(light); State.scene.add(exitDoor); exitDoor.updateMatrixWorld(true);
    
    showMessage("All keys collected. Return to the starting point and enter the RED DOOR."); 
    State.monsters.forEach(m => m.speed *= 1.5); 
}

function placeMonsterFar(m) {
    let angle = Math.random() * Math.PI * 2;
    let dist = 100 + Math.random() * 50; 
    m.mesh.position.set(State.camera.position.x + Math.cos(angle)*dist, m.mesh.position.y, State.camera.position.z + Math.sin(angle)*dist);
    m.active = true;
    m.respawnCooldown = -1;
}

function getCurrentRespawnTime() {
    if (State.gamePhase === 2) return 0.0;
    if (State.gamePhase === 1) return 7.0;
    if (itemsCollected >= LEVEL_DATA[State.currentLevel].State.items) return 15.0;
    return 25.0;
}

export { 
    createMonster, 
    spawnItems, 
    createExitDoor, 
    placeMonsterFar, 
    getCurrentRespawnTime 
};