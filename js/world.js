import * as State from './state.js';
import { spawnItems, createMonster } from './entities.js';

function initSharedMats() {
    if(!sharedMats) {
        sharedMats = {
            table: new THREE.MeshPhongMaterial({color: 0x3d2314}), plant: new THREE.MeshPhongMaterial({color: 0x224422}),
            sofa: new THREE.MeshPhongMaterial({color: 0x5c2b29}), paint1: new THREE.MeshPhongMaterial({color: 0x331111}), paint2: new THREE.MeshPhongMaterial({color: 0x113333}),
            neon: new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 1 }),
            neonOff: new THREE.MeshPhongMaterial({ color: 0x555555, emissive: 0x000000 }),
            m0: new THREE.MeshPhongMaterial({ color: 0x882222 }), m1: new THREE.MeshBasicMaterial({ color: 0x050505 }),
            m1Eye: new THREE.MeshBasicMaterial({color:0xff0000}), m2Core: new THREE.MeshBasicMaterial({ color: 0xffffff }),
            m2Ring: new THREE.MeshBasicMaterial({ color: 0xffdd44, wireframe: true }), m3: new THREE.MeshBasicMaterial({ color: 0x222222 }),
            m4Eye: new THREE.MeshBasicMaterial({ color: 0xffffff }), m4Pupil: new THREE.MeshBasicMaterial({ color: 0x880000 }),
            item0: new THREE.MeshBasicMaterial({ color: 0xffdd44, wireframe: true }), item1: new THREE.MeshBasicMaterial({ color: 0x111111 }), item2: new THREE.MeshBasicMaterial({ color: 0xaa22ff, wireframe: true })
        };
    }
}

function getMaterialCache(type) {
    if (!materialCache[type]) {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256; const ctx = canvas.getContext('2d');
        if (type === 'carpet') { ctx.fillStyle = '#6b4d3a'; ctx.fillRect(0, 0, 256, 256); for(let i=0; i<1000; i++) { ctx.fillStyle = (Math.random()>0.5)? '#8a654c' : '#4d3323'; ctx.fillRect(Math.random()*256, Math.random()*256, 3, 3); } } 
        else if (type === 'wallpaper') { ctx.fillStyle = '#d1c794'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#b8ad78'; ctx.lineWidth = 1; for(let i=0; i<256; i+=16) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); } } 
        else if (type === 'pool_tile') { ctx.fillStyle = '#f0ffff'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#88cccc'; ctx.lineWidth = 4; for(let i=0; i<=256; i+=32) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(256,i); ctx.stroke(); } } 
        else if (type === 'concrete') { ctx.fillStyle = '#cccccc'; ctx.fillRect(0, 0, 256, 256); for(let i=0; i<2000; i++) { ctx.fillStyle = Math.random()>0.5?'#bbbbbb':'#dddddd'; ctx.fillRect(Math.random()*256, Math.random()*256, 2, 2); } } 
        else if (type === 'ceiling') { ctx.fillStyle = '#d5d0c8'; ctx.fillRect(0, 0, 256, 256); ctx.strokeStyle = '#b0aba0'; ctx.lineWidth = 2; for(let i=0; i<=256; i+=64) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(256,i); ctx.stroke(); } }
        const tex = new THREE.CanvasTexture(canvas); tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; 
        if(type === 'carpet' || type === 'ceiling') tex.repeat.set(40, 40); else if(type === 'pool_tile') tex.repeat.set(20, 20); else if(type === 'concrete') tex.repeat.set(20, 20); else tex.repeat.set(8, 2); 
        materialCache[type] = new THREE.MeshPhongMaterial({ map: tex });
    } return materialCache[type];
}

function addWall(x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(getBaseBox(), mat); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); scene.add(mesh); mesh.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(mesh); colliders.push(box); wallMeshes.push(mesh); 
    if (currentLevel === 0 && Math.random() > 0.6) { 
        if (w >= 20 || d >= 20) { let pW = w > d ? 8 : 0.5; let pD = d > w ? 8 : 0.5; let pMat = Math.random() > 0.5 ? sharedMats.paint1 : sharedMats.paint2; let canvas = new THREE.Mesh(getBaseBox(), pMat); canvas.scale.set(pW, 4, pD); canvas.position.set(x, y, z); if (w > d) { canvas.position.z += (Math.random()>0.5 ? d/2 + 0.1 : -d/2 - 0.1); } else { canvas.position.x += (Math.random()>0.5 ? w/2 + 0.1 : -w/2 - 0.1); } scene.add(canvas); }
    }
}

function buildCurrentLevel() { if (currentLevel === 0) buildLevel0(); else if (currentLevel === 1) buildLevel1(); else if (currentLevel === 2) buildLevel2(); }

function buildLevel0() {
    const matFloor = getMaterialCache('carpet'); const matWall = getMaterialCache('wallpaper');
    const floor = new THREE.Mesh(getBaseBox(), matFloor); floor.scale.set(800, 2, 800); floor.position.y = -1; scene.add(floor); floor.updateMatrixWorld(true); colliders.push(new THREE.Box3().setFromObject(floor)); wallMeshes.push(floor);
    
    const matCeiling = getMaterialCache('ceiling'); const ceiling = new THREE.Mesh(getBaseBox(), matCeiling); ceiling.scale.set(800, 2, 800); ceiling.position.y = 21; scene.add(ceiling); ceiling.updateMatrixWorld(true); colliders.push(new THREE.Box3().setFromObject(ceiling)); wallMeshes.push(ceiling);
    
    let mainDesk = new THREE.Mesh(getBaseBox(), sharedMats.table); mainDesk.scale.set(20, 5, 4); mainDesk.position.set(0, 2.5, -20); scene.add(mainDesk); mainDesk.updateMatrixWorld(true); colliders.push(new THREE.Box3().setFromObject(mainDesk));
    let pillar1 = new THREE.Mesh(getBaseBox(), sharedMats.table); pillar1.scale.set(2, 20, 2); pillar1.position.set(-10, 10, -20); scene.add(pillar1);
    let pillar2 = new THREE.Mesh(getBaseBox(), sharedMats.table); pillar2.scale.set(2, 20, 2); pillar2.position.set(10, 10, -20); scene.add(pillar2);
    
    let mapSet = new Set();
    for(let sx=-20; sx<=20; sx+=20) { for(let sz=-20; sz<=20; sz+=20) { mapSet.add(`${sx},${sz}`); } }
    let cx=0, cz=0; 
    for(let i=0; i<200; i++){ let r = Math.floor(Math.random()*4); if(r===0) cx+=20; else if(r===1) cx-=20; else if(r===2) cz+=20; else cz-=20; mapSet.add(`${cx},${cz}`); }
    const tiles = Array.from(mapSet);

    window.validRooms = tiles.map(t => { let [x,z] = t.split(','); return {x: Number(x), z: Number(z), y: 19.5}; });

    for (let tile of tiles) {
        let [tx, tz] = tile.split(',').map(Number);
        if(Math.random() > 0.75 && (tx!==0 || tz!==0)) { 
            let propType = Math.floor(Math.random() * 3); let propMesh;
            if (propType === 0) { propMesh = new THREE.Mesh(getBaseBox(), sharedMats.table); propMesh.scale.set(8, 4, 5); } else if (propType === 1) { propMesh = new THREE.Mesh(getBaseCyl(), sharedMats.plant); propMesh.scale.set(2, 6, 2); } else { propMesh = new THREE.Mesh(getBaseBox(), sharedMats.sofa); propMesh.scale.set(10, 4, 4); }
            propMesh.position.set(tx + (Math.random()-0.5)*5, 2, tz + (Math.random()-0.5)*5); scene.add(propMesh); propMesh.updateMatrixWorld(true); colliders.push(new THREE.Box3().setFromObject(propMesh)); 
        }
        const neighbors = [[tx+20,tz], [tx-20,tz], [tx,tz+20], [tx,tz-20]]; for(let [nx, nz] of neighbors) { if(!mapSet.has(`${nx},${nz}`)) { addWall(nx, 10, nz, 20, 20, 20, matWall); mapSet.add(`${nx},${nz}`); } }
    }
    addWall(0, 10, -400, 800, 20, 10, matWall); addWall(0, 10, 400, 800, 20, 10, matWall); addWall(-400, 10, 0, 10, 20, 800, matWall); addWall(400, 10, 0, 10, 20, 800, matWall);
    
    const finalItemLocs = []; 
    let shuffledTiles = [...tiles].sort(() => Math.random() - 0.5);
    let targetDist = 150;
    
    while(finalItemLocs.length < LEVEL_DATA[0].items && targetDist >= 0) {
        for(let i=0; i<shuffledTiles.length && finalItemLocs.length < LEVEL_DATA[0].items; i++) {
            let [nx, nz] = shuffledTiles[i].split(',').map(Number);
            if (Math.hypot(nx, nz) < 80) continue; 
            
            let valid = true;
            for (let fl of finalItemLocs) {
                if (Math.hypot(nx - fl.x, nz - fl.z) < targetDist) { valid = false; break; }
            }
            if(valid) { finalItemLocs.push({x: nx, z: nz}); shuffledTiles.splice(i, 1); i--; }
        }
        targetDist -= 30; 
    }
    while(finalItemLocs.length < LEVEL_DATA[0].items && shuffledTiles.length > 0) { let [nx, nz] = shuffledTiles.pop().split(',').map(Number); finalItemLocs.push({x: nx, z: nz}); }
    
    spawnItems(finalItemLocs, 0); 
    
    createMonster(0, {x: 100, y: 0, z: -100}); 
    createMonster(3, {x: -100, y: 3, z: 100}); 
    createMonster(4, {x: 150, y: 5, z: 150}); 
}

function buildLevel1() {
    const matTile = getMaterialCache('pool_tile'); const floor = new THREE.Mesh(getBaseBox(), matTile); floor.scale.set(1200, 2, 1200); floor.position.y = -11; scene.add(floor); floor.updateMatrixWorld(true); colliders.push(new THREE.Box3().setFromObject(floor)); wallMeshes.push(floor);
    waterLevel = 0; const water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshPhongMaterial({ color: 0x00aaff, transparent: true, opacity: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.y = waterLevel; scene.add(water);
    addWall(0, 10, -500, 1000, 40, 10, matTile); addWall(0, 10, 500, 1000, 40, 10, matTile); addWall(-500, 10, 0, 10, 40, 1000, matTile); addWall(500, 10, 0, 10, 40, 1000, matTile);
    
    window.validRooms = [];
    for(let x=-400; x<=400; x+=80) { 
        for(let z=-400; z<=400; z+=80) { 
            addWall(x, 10, z, 15, 40, 15, matTile); 
            if(Math.random() > 0.6 && z < 400) addWall(x, -2.5, z+40, 8, 4, 80, matTile); 
            if(Math.random() > 0.6 && x < 400) addWall(x+40, -2.5, z, 80, 4, 8, matTile); 
            window.validRooms.push({x: x, z: z, y: 24.5});
        } 
    }
    addWall(0, -1, 0, 20, 2, 20, matTile); 
    let gridCells = []; for(let x=-360; x<=360; x+=80) { for(let z=-360; z<=360; z+=80) { if (Math.hypot(x, z) > 80) gridCells.push({x: x, z: z}); } }
    gridCells.sort(() => Math.random() - 0.5); let finalItemLocs = []; for(let i=0; i<LEVEL_DATA[1].items && i<gridCells.length; i++) { finalItemLocs.push(gridCells[i]); }
    spawnItems(finalItemLocs, 1); createMonster(1, {x: 0, y: -5, z: -200}); monsters[0].active = true;
}

function buildLevel2() {
    deathYLevel = -30; const matConcrete = getMaterialCache('concrete'); addWall(0, 0, 0, 30, 2, 30, matConcrete); 
    window.validRooms = [];
    let curX = 0, curZ = -20; const itemLocs = [];
    for(let i=0; i<80; i++) { curZ -= (15 + Math.random()*20); curX += (Math.random()*60 - 30); let w = 15 + Math.random()*15; let d = 15 + Math.random()*15; let yOffset = (Math.random()*20 - 10); addWall(curX, yOffset, curZ, w, 2, d, matConcrete); if(Math.random()>0.7) addWall(curX, yOffset+20, curZ, 4, 40, 4, matConcrete); if(i===20 || i===50 || i===79) itemLocs.push({x: curX, y: yOffset+2, z: curZ}); }
    spawnItems(itemLocs, 2); createMonster(2, {x: 0, y: 20, z: -50}); monsters[0].active = true;
}

function setupLighting() {
    ambientLight = new THREE.AmbientLight(0xffffff, currentLevel===2 ? 0.8 : 0.1); scene.add(ambientLight);
    flashlight = new THREE.SpotLight(0xffffee, currentLevel===2? 0.5 : 2.5, 220, Math.PI / 4, 0.6, 1); flashlight.position.set(0, 0, 4); flashlight.target.position.set(0, 0, -10); camera.add(flashlight); camera.add(flashlight.target);
    if(currentLevel < 2) {
        for(let i=0; i<8; i++) { let l = new THREE.PointLight(0xffffff, 0, 150); scene.add(l); lightPool.push({ light: l, active: false, virtualIdx: -1, fadeOpacity: 0, keep: false, baseInt: 0, isFlicker: false, assignedMesh: null }); }
        let idCount = 0; window.validRooms.forEach(pos => { if (Math.random() > 0.4) return; let isDeadAccessory = Math.random() > 0.3; let tubeMesh = new THREE.Mesh(getBaseBox(), sharedMats.neonOff); tubeMesh.scale.set(6, 0.4, 0.4); tubeMesh.position.set(pos.x + (Math.random()*10-5), pos.y, pos.z + (Math.random()*10-5)); scene.add(tubeMesh); if (!isDeadAccessory) { virtualLights.push({ id: idCount++, x: tubeMesh.position.x, y: tubeMesh.position.y, z: tubeMesh.position.z, baseInt: currentLevel===1 ? 0.8 : 0.5, isFlicker: Math.random() > 0.4, mesh: tubeMesh }); } });
    } else { const dirLight = new THREE.DirectionalLight(0xffffff, 1); dirLight.position.set(50, 100, 50); scene.add(dirLight); }
}

function getBaseBox() { if(!baseBoxGeo) baseBoxGeo = new THREE.BoxGeometry(1, 1, 1); return baseBoxGeo; }
function getBaseCyl() { if(!baseCylGeo) baseCylGeo = new THREE.CylinderGeometry(1, 1, 1, 16); return baseCylGeo; }
function getBaseSphere() { if(!baseSphereGeo) baseSphereGeo = new THREE.SphereGeometry(1, 16, 16); return baseSphereGeo; }

function clearScene() {
    if(scene) { while(scene.children.length > 0){ scene.remove(scene.children[0]); } }
    colliders = []; items = []; monsters = []; wallMeshes = []; virtualLights = []; lightPool = []; window.validRooms = []; itemsCollected = 0; exitDoor = null; 
    document.getElementById('noise-overlay').style.opacity = 0; document.getElementById('vignette-overlay').style.opacity = 0;
    document.getElementById('blink-overlay').style.opacity = 0;
    
    document.querySelectorAll('.progress-container, .progress-label').forEach(el => { el.style.opacity = 0; setTimeout(()=> { el.style.display = 'none'; }, 200); });
    
    if(stareGain) stareGain.gain.value = 0; if(proxGain) proxGain.gain.value = 0;
    if(nightmareNoiseGain) nightmareNoiseGain.gain.value = 0;
    if(whisperGain) whisperGain.gain.value = 0;
    if(droneOsc) { droneOsc.type = 'sine'; droneOsc.frequency.value = 50; }
}

export { 
    initSharedMats, 
    getMaterialCache, 
    addWall, 
    buildCurrentLevel, 
    setupLighting,
    getBaseBox,
    getBaseCyl,
    getBaseSphere,
    clearScene 
};