export let scene, camera, renderer;
export let currentLevel = parseInt(localStorage.getItem('batas_semu_level')) || 0;
export let gameActive = false;
export let player = { baseSpeed: 25.0, speed: 25.0, height: 6 };
export let menuCanvas, mctx;
export let particles = [];
export let particleAnimId;

// Tambahkan fungsi inisialisasi DOM di js    
export function initDOMReferences() {
    State.menuCanvas = document.getElementById('menu-particles');
    if (State.menuCanvas) mctx = State.menuCanvas.getContext('2d');
}

// --- GAME STATE & GLOBAL VARS ---

const LEVEL_DATA = [
    { id: 0, name: "LEVEL 0: RUSTED CORRIDOR", items: 4, fogColor: 0x2a2b20, fogDensity: 0.035, bg: 0x1a1a15 },
    { id: 1, name: "LEVEL 1: CHLORINE ECHOES", items: 5, fogColor: 0x88ccdd, fogDensity: 0.012, bg: 0xaaddff },
    { id: 2, name: "LEVEL 2: CELESTIAL CAGE", items: 3, fogColor: 0xddddff, fogDensity: 0.008, bg: 0xffffff }
];

const materialCache = {};
const loadingTips = [
    "Tip: If your flashlight dies, you'll slow down. You can't outrun the dark.",
    "Tip: Hold your flashlight on an entity for several seconds to banish it.",
    "Tip: Turning your flashlight on repeatedly damages it faster.",
    "Tip: Darkness hides your presence, making you 30% harder to detect from afar.",
    "Tip: Back away slowly if they lock your gaze to break free."
];
let tipIntervalId = null; let animationFrameId = null;

let moveInput = { x: 0, y: 0 }; let lookState = { pitch: 0, yaw: 0 };
const lookSpeed = 0.005;

let isJumping = false; let velocityY = 0;
let currentFov = 70;
let walkTime = 0; let isWalking = false;
let lastStepPhase = 0; 

// Bobbing Anim Variables
let bobPhase = 0;
let bobAmt = 0;

// Cinematic Intro Variables
let isIntroAnim = false;
let introAnimTimer = 0;

let rightTouchId = null; let rightTouchStart = { x: 0, y: 0 }; let joyTouchId = null;
let prevTime = performance.now(); let isBlinking = false;
let isBlackoutGlitch = false;
let isPreBlackoutShake = false; 

let tutorialPause = false;

let flashlightState = 'ON'; 
let isHoldingFlashlightBtn = false; 
let repairTimer = 0;
let normalTick = 0; let sabotageTick = 0;
let nightmareTurnOffTick = 0; 
let flashlightDurability = 1.0; 

let gamePhase = 0; 
let phaseTimer = 300.0; 
let slaughterSpeedMultiplier = 1.0; 
let nightmareGlitchTick = 0;
let isGlitching = false;
let glitchTimer = 0;

let isCameraSnapping = false; let isCameraLocked = false;
let globalStareTimer = 0.0;
let lockedMonster = null;

let smartBtnState = 'BLINK'; 
let isHoldingInteract = false; 
let nearestItemObj = null; let interactProgress = 0;
let isJumpscaring = false; let jumpscareTarget = null; let jumpscareMsg = ""; let jumpscareTimer = 0;

let colliders = []; let items = []; let itemsCollected = 0; let exitDoor = null;
let ambientLight; let flashlight; 
let virtualLights = []; let lightPool = []; window.validRooms = [];
let waterLevel = -100; let isPlayerInWater = false; let deathYLevel = -100;
let monsters = []; let wallMeshes = []; 

let audioCtx = null; let droneOsc = null, droneGain = null; let whisperOsc = null, whisperGain = null; 
let stareOsc = null, stareGain = null; let proxOsc = null, proxGain = null;
let nightmareNoiseSrc = null, nightmareNoiseGain = null; 

let baseBoxGeo = null, baseCylGeo = null, baseSphereGeo = null; let sharedMats = null;

// --- MENU PARTICLES ---
menuCanvas = document.getElementById('menu-particles');
mctx = menuCanvas.getContext('2d');