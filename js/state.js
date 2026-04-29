// js/state.js

// --- KONSTANTA & DATA STATIS (Tidak berubah) ---
export const LEVEL_DATA = [
    { id: 0, name: "LEVEL 0: RUSTED CORRIDOR", items: 4, fogColor: 0x2a2b20, fogDensity: 0.035, bg: 0x1a1a15 },
    { id: 1, name: "LEVEL 1: CHLORINE ECHOES", items: 5, fogColor: 0x88ccdd, fogDensity: 0.012, bg: 0xaaddff },
    { id: 2, name: "LEVEL 2: CELESTIAL CAGE", items: 3, fogColor: 0xddddff, fogDensity: 0.008, bg: 0xffffff }
];

export const materialCache = {};

export const loadingTips = [
    "Tip: If your flashlight dies, you'll slow down. You can't outrun the dark.",
    "Tip: Hold your flashlight on an entity for several seconds to banish it.",
    "Tip: Turning your flashlight on repeatedly damages it faster.",
    "Tip: Darkness hides your presence, making you 30% harder to detect from afar.",
    "Tip: Back away slowly if they lock your gaze to break free."
];

export const lookSpeed = 0.005;

// --- PUSAT DATA / STATE OBJECT (Bisa diubah/di-update dari file manapun) ---
export const State = {
    // Engine & Three.js
    scene: null,
    camera: null,
    renderer: null,
    
    // Core Game State
    currentLevel: parseInt(localStorage.getItem('batas_semu_level')) || 0,
    gameActive: false,
    player: { baseSpeed: 25.0, speed: 25.0, height: 6 },
    
    // Menu & UI Particles
    menuCanvas: null,
    mctx: null,
    particles: [],
    particleAnimId: null,
    tipIntervalId: null,
    animationFrameId: null,

    // Movement & Camera
    moveInput: { x: 0, y: 0 },
    lookState: { pitch: 0, yaw: 0 },
    isJumping: false,
    velocityY: 0,
    currentFov: 70,
    walkTime: 0,
    isWalking: false,
    lastStepPhase: 0,
    bobPhase: 0,
    bobAmt: 0,
    
    // Controls & Touch
    rightTouchId: null,
    rightTouchStart: { x: 0, y: 0 },
    joyTouchId: null,
    
    // Game Flow & Timing
    prevTime: performance.now(),
    isIntroAnim: false,
    introAnimTimer: 0,
    tutorialPause: false,
    gamePhase: 0, 
    phaseTimer: 300.0, 
    slaughterSpeedMultiplier: 1.0, 
    
    // Flashlight Mechanics
    flashlightState: 'ON', 
    isHoldingFlashlightBtn: false, 
    repairTimer: 0,
    normalTick: 0, 
    sabotageTick: 0,
    nightmareTurnOffTick: 0, 
    flashlightDurability: 1.0, 
    
    // Glitches & Effects
    isBlinking: false,
    isBlackoutGlitch: false,
    isPreBlackoutShake: false, 
    nightmareGlitchTick: 0,
    isGlitching: false,
    glitchTimer: 0,
    
    // Interaction & Combat
    isCameraSnapping: false, 
    isCameraLocked: false,
    globalStareTimer: 0.0,
    lockedMonster: null,
    smartBtnState: 'BLINK', 
    isHoldingInteract: false, 
    nearestItemObj: null, 
    interactProgress: 0,
    
    // Jumpscare
    isJumpscaring: false, 
    jumpscareTarget: null, 
    jumpscareMsg: "", 
    jumpscareTimer: 0,

    // World Arrays & Objects
    colliders: [], 
    items: [], 
    itemsCollected: 0, 
    exitDoor: null,
    ambientLight: null, 
    flashlight: null, 
    virtualLights: [], 
    lightPool: [], 
    validRooms: [],
    waterLevel: -100, 
    isPlayerInWater: false, 
    deathYLevel: -100,
    monsters: [], 
    wallMeshes: [], 
    
    // Audio Context & Nodes
    audioCtx: null, 
    droneOsc: null, droneGain: null, 
    whisperOsc: null, whisperGain: null, 
    stareOsc: null, stareGain: null, 
    proxOsc: null, proxGain: null,
    nightmareNoiseSrc: null, nightmareNoiseGain: null, 
    
    // Geometry Caches
    baseBoxGeo: null, 
    baseCylGeo: null, 
    baseSphereGeo: null, 
    sharedMats: null
};

// --- FUNGSI INISIALISASI DOM ---
// Panggil fungsi ini dari main.js setelah DOM siap
export function initDOMReferences() {
    State.menuCanvas = document.getElementById('menu-particles');
    if (State.menuCanvas) {
        State.mctx = State.menuCanvas.getContext('2d');
    }
}