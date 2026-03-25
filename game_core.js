// ── CONFIG ───────────────────────────────────────────────────
const CFG = {
  W: 960, H: 540,
  laneY: [360, 410, 460],
  playerX: 130,
  playerH: 110,           // target height; width auto from aspect ratio
  switchCooldown: 140,
  invulnMs: 2400,
  bgSpeed: 0.8,
  objSpeed: 1.2,
  caseRate: 70,
  obstacleRate: 220,
  powerupRate: 1100,  // ~2-3 times in 60 seconds at 60fps
  casePoints: 50,
  organicPoints: 75,
  startKarma: 5,
  maxKarma: 5,
  targetScore: 999999, // no score cap — timer runs out instead
  gameDuration: 60,    // seconds
  jumpVelocity: -15,   // pixels per frame upward
  gravity: 1.1,        // high gravity = snappy arc
  jumpCooldown: 8,     // frames before you can jump again after landing
  // Difficulty ramp — medium: by 45s it's noticeably harder
  diffRampSpeed: 1.2,  // was 0.4 — speed increases much faster per second
  diffRampObstacle: 1.8, // was 0.7 — obstacles spawn much more frequently over time
  // target draw heights for objects (width calculated from aspect ratio)
  collectibleH: 70,
  obstacleH: 95,
  powerupH: 70,
  characters: [
    {name:"ASSASSIN",  still:"Banana_Badass_Assassin_Select.png",  run:"Banana_Badass_Assassin_Still.png"},
    {name:"BULLDOZER", still:"Banana_Badass_Bulldozer_Select.png", run:"Banana_Badass_Bulldozer_Still.png"},
    {name:"CURIOUS",   still:"Banana_Badass_Curious_Select.png",   run:"Banana_Badass_Curious_Still.png"},
    {name:"NERD", still:"Banana_Badass_Nerd_Select.png", run:"Banana_Badass_Nerd_Running.png",
     sheet:"Nerd_Sprite_Sheet.png",
     frames:[
       {x:13,  w:208},
       {x:263, w:194},
       {x:463, w:194},
       {x:680, w:213},
       {x:913, w:237},
     ], frameH:421},
  ],
  obstacles: [
    {img:"Bananasplain.png",   name:"Bananasplainer",                       penalty:30},
    {img:"Detractor_Lady.png", name:'"We\'ve always done\nit this way" lady', penalty:30, h:65},
    {img:"Money_Gun.png",      name:"80's Pricing\nStrategy",                penalty:35, h:60},
    {img:"Legal_Jail.png",     name:"Corporate Legal\nDept. Jail",            penalty:50},
    {img:"Apple_stand.png",    name:"Cheap Apple\nEndcap",                    penalty:30, h:100, hasFloatingCase:true, landable:true, level2img:"cruiser_table.png", level3img:"messy_desk.png"},
  ]
};

// ── CANVAS ───────────────────────────────────────────────────
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = CFG.W; canvas.height = CFG.H;
ctx.imageSmoothingEnabled = false;

// Fullscreen support
function goFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
}
// Auto-trigger fullscreen on first user interaction
let fsTriggered = false;
document.addEventListener("keydown", () => { if(!fsTriggered){fsTriggered=true;goFullscreen();} }, {once:false});
document.addEventListener("click",   () => { if(!fsTriggered){fsTriggered=true;goFullscreen();} }, {once:false});

// ── GAMEPAD / JOYSTICK SUPPORT ────────────────────────────────
const gpState = {};

// ── GAMEPAD NAME-ENTRY GRID ────────────────────────────────────
// Classic arcade-style letter picker used on the name entry screen.
// Row 0: A-M  |  Row 1: N-Z  |  Row 2: SPC / DEL / DONE
const GP_GRID = [
  ['A','B','C','D','E','F','G','H','I','J','K','L','M'],
  ['N','O','P','Q','R','S','T','U','V','W','X','Y','Z'],
  ['SPC','DEL','DONE']
];

function gpNameMove(dr, dc) {
  if (!S || S.screen !== "name") return;
  if (S.gpNameRow === undefined) { S.gpNameRow = 0; S.gpNameCol = 0; }
  const newRow = ((S.gpNameRow + dr) + GP_GRID.length) % GP_GRID.length;
  S.gpNameRow = newRow;
  // Clamp column to the new row's length, then apply left/right delta
  S.gpNameCol = Math.min(S.gpNameCol, GP_GRID[newRow].length - 1);
  if (dc !== 0) {
    const cols = GP_GRID[newRow].length;
    S.gpNameCol = ((S.gpNameCol + dc) + cols) % cols;
  }
}

function gpNamePick() {
  if (!S || S.screen !== "name") return;
  if (S.gpNameRow === undefined) { S.gpNameRow = 0; S.gpNameCol = 0; }
  const ch = GP_GRID[S.gpNameRow][S.gpNameCol];
  if      (ch === 'SPC')  { if (S.nameInput.length < 12) S.nameInput += ' '; }
  else if (ch === 'DEL')  { S.nameInput = S.nameInput.slice(0, -1); }
  else if (ch === 'DONE') { submitName(); }
  else if (S.nameInput.length < 12) { S.nameInput += ch; }
}

function pollGamepad() {
  try { if (!navigator.getGamepads) return; } catch(e) { return; }
  let gamepads;
  try { gamepads = navigator.getGamepads(); } catch(e) { return; }
  for (const gp of gamepads) {
    if (!gp || !gp.buttons || !gp.axes) continue;
    if (!gpState[gp.index]) gpState[gp.index] = { buttons: [], axes: [0,0,0,0] };
    const prev = gpState[gp.index];
    const onName = S && S.screen === "name";

    // ── Buttons ───────────────────────────────────────────────
    gp.buttons.forEach((btn, i) => {
      const pressed = !!(btn && (btn.pressed || btn.value > 0.5));
      const wasPressed = prev.buttons[i] || false;
      if (pressed && !wasPressed) {
        tryStartMusic(); // unlock audio context on first button press
        if (onName) {
          // Name-entry screen: D-pad navigates the letter grid
          if      (i === 12) gpNameMove(-1,  0);  // up
          else if (i === 13) gpNameMove( 1,  0);  // down
          else if (i === 14) gpNameMove( 0, -1);  // left
          else if (i === 15) gpNameMove( 0,  1);  // right
          else if (i === 0)  gpNamePick();         // A: select letter
          else if (i === 1)  { S.nameInput = S.nameInput.slice(0, -1); } // B: delete
          else if ([2,3,8,9,11].includes(i)) submitName(); // Start/Select: submit
        } else {
          // All other screens
          if (i === 0 || i === 1) {
            // Buttons 0 & 1 cover A and B across different NES USB controller mappings
            if (S && S.screen === "play") jp["Space"] = true;
            else jp["Enter"] = true;
          }
          if ([2,3,8,9,11].includes(i)) jp["Enter"] = true; // Select, Start, shoulders
          if (i === 12) jp["ArrowUp"]    = true; // D-pad up
          if (i === 13) jp["ArrowDown"]  = true; // D-pad down
          if (i === 14) jp["ArrowLeft"]  = true; // D-pad left
          if (i === 15) jp["ArrowRight"] = true; // D-pad right
        }
      }
      prev.buttons[i] = pressed;
    });

    // ── D-pad / analog stick via axes ─────────────────────────
    const dead = 0.4;
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    if (onName) {
      // Route axis input to letter-grid navigation on name screen
      if (ay < -dead && (prev.axes[1]||0) >= -dead) gpNameMove(-1,  0);
      if (ay >  dead && (prev.axes[1]||0) <=  dead) gpNameMove( 1,  0);
      if (ax < -dead && (prev.axes[0]||0) >= -dead) gpNameMove( 0, -1);
      if (ax >  dead && (prev.axes[0]||0) <=  dead) gpNameMove( 0,  1);
    } else {
      if (ay < -dead && (prev.axes[1]||0) >= -dead) jp["ArrowUp"]    = true;
      if (ay >  dead && (prev.axes[1]||0) <=  dead) jp["ArrowDown"]  = true;
      if (ax < -dead && (prev.axes[0]||0) >= -dead) jp["ArrowLeft"]  = true;
      if (ax >  dead && (prev.axes[0]||0) <=  dead) jp["ArrowRight"] = true;
    }
    prev.axes[0] = ax;
    prev.axes[1] = ay;
  }
}

window.addEventListener("gamepadconnected",    e => {
  console.log("Controller connected:", e.gamepad.id);
  if (S) S.popups.push({ txt: "🎮 CONTROLLER CONNECTED", life: 180, x: CFG.W/2, y: 60, col: "#FFE000" });
});
window.addEventListener("gamepaddisconnected", e => {
  console.log("Controller disconnected:", e.gamepad.id);
  if (S) S.popups.push({ txt: "🎮 CONTROLLER DISCONNECTED", life: 180, x: CFG.W/2, y: 60, col: "#FF4444" });
});

function resize() {
  const s = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
  canvas.style.width  = (CFG.W * s) + "px";
  canvas.style.height = (CFG.H * s) + "px";
  // Re-disable smoothing after resize (some browsers reset it)
  ctx.imageSmoothingEnabled = false;
}
resize();
window.addEventListener("resize", resize);

// ── IMAGE LOADING ────────────────────────────────────────────
const imgs = {};
const bgCache = {}; // pre-scaled offscreen canvases for background images
let loaded = 0;
const total = Object.keys(ASSETS).length;
Object.entries(ASSETS).forEach(([name, src]) => {
  const img = new Image();
  img.onload = () => {
    loaded++;
    // Pre-render background images to an offscreen canvas at game resolution
    // so drawGameplay never has to scale a 6-8 MB PNG every frame
    if (name.includes('Background') || name.includes('Head_Office')) {
      const sc = CFG.H / img.naturalHeight;
      const bw = Math.ceil(img.naturalWidth * sc);
      const oc = document.createElement('canvas');
      oc.width = bw; oc.height = CFG.H;
      oc.getContext('2d').drawImage(img, 0, 0, bw, CFG.H);
      bgCache[name] = oc;
    }
  };
  img.onerror = () => { loaded++; };
  img.src = src;
  imgs[name] = img;
});

// ── AUDIO ────────────────────────────────────────────────────
let audioCtx = null;
const sfx = {};

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Unlock audio and start music on first user interaction
let musicStarted = false;
function tryStartMusic() {
  getAudioCtx();
  if (!musicStarted) { musicStarted = true; startMusic(); }
}
document.addEventListener("click",   tryStartMusic);
document.addEventListener("keydown", tryStartMusic);

function loadSfx(name, url) {
  fetch(url)
    .then(r => r.arrayBuffer())
    .then(buf => getAudioCtx().decodeAudioData(buf))
    .then(decoded => { sfx[name] = decoded; })
    .catch(() => {});
}

function playSfx(name, volume=0.7) {
  if (!sfx[name]) return;
  try {
    const ctx = getAudioCtx();
    const src = ctx.createBufferSource();
    src.buffer = sfx[name];
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  } catch(e) {}
}
loadSfx("collect", SFX_COLLECT);
loadSfx("powerup", SFX_POWERUP);
loadSfx("hit", SFX_HIT);
loadSfx("jump", SFX_JUMP);

// ── MUSIC ─────────────────────────────────────────────────────
let musicEl = null;

function startMusic() {
  if (musicEl) return; // already playing
  const audio = new Audio(MUSIC_SRC);
  audio.loop = false; // plays once start to finish
  audio.volume = 0.5;
  audio.play().catch(() => {});
  musicEl = audio;
}

function stopMusic() {
  if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; musicEl = null; }
}

function pauseMusic() {
  if (musicEl && !musicEl.paused) musicEl.pause();
}

function resumeMusic() {
  if (musicEl && musicEl.paused) musicEl.play().catch(() => {});
}


// Width is auto-calculated from the image's natural aspect ratio.
function drawImg(name, cx, cy, targetH, alpha) {
  const im = imgs[name];
  if (!im || !im.complete || !im.naturalWidth) {
    // fallback coloured rect
    ctx.fillStyle = "#FF00FF";
    ctx.fillRect(cx - 30, cy - targetH/2, 60, targetH);
    return {w:60, h:targetH};
  }
  const ratio = im.naturalWidth / im.naturalHeight;
  const dh = targetH;
  const dw = dh * ratio;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(im, cx - dw/2, cy - dh/2, dw, dh);
  if (alpha !== undefined) ctx.globalAlpha = 1;
  return {w:dw, h:dh};
}

// Draw image with BOTTOM of sprite at (cx, by)
function drawImgBottom(name, cx, by, targetH, alpha) {
  const im = imgs[name];
  if (!im || !im.complete || !im.naturalWidth) {
    ctx.fillStyle = "#FF00FF";
    ctx.fillRect(cx - 30, by - targetH, 60, targetH);
    return {w:60, h:targetH};
  }
  const ratio = im.naturalWidth / im.naturalHeight;
  const dh = targetH;
  const dw = dh * ratio;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(im, cx - dw/2, by - dh, dw, dh);
  if (alpha !== undefined) ctx.globalAlpha = 1;
  return {w:dw, h:dh};
}

// Draw image filling a box, maintaining aspect ratio with letterbox — NO background fill
function drawImgFit(name, bx, by, bw, bh) {
  const im = imgs[name];
  if (!im || !im.complete || !im.naturalWidth) {
    ctx.fillStyle = "#222"; ctx.fillRect(bx, by, bw, bh); return;
  }
  const ratio = im.naturalWidth / im.naturalHeight;
  let dw = bw, dh = bh;
  if (dw / dh > ratio) { dw = dh * ratio; }
  else { dh = dw / ratio; }
  ctx.drawImage(im, bx + (bw-dw)/2, by + (bh-dh)/2, dw, dh);
}

// Draw image stretching to fill exact box (for backgrounds only)
function drawImgStretch(name, x, y, w, h) {
  const im = imgs[name];
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x, y, w, h);
}

// ── INPUT ────────────────────────────────────────────────────
const keys = {}, jp = {};
window.addEventListener("keydown", e => {
  if (!keys[e.code]) jp[e.code] = true;
  keys[e.code] = true;
  if (S.screen === "name") {
    if (e.code === "Backspace") S.nameInput = S.nameInput.slice(0,-1);
    else if (e.code==="Enter"||e.code==="Space") submitName();
    else if (e.key.length===1 && S.nameInput.length<12) S.nameInput += e.key.toUpperCase();
    e.preventDefault();
  }
  if (["Space","ArrowUp","ArrowDown"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });
function clearJP() { for(const k in jp) delete jp[k]; }

// ── STATE ────────────────────────────────────────────────────
let S = {};
let LEADERBOARD = JSON.parse(localStorage.getItem("bb_leaderboard") || "[]");
function initState() {
  S = {
    screen:"title", charIdx:0, char:null,
    score:0, karma:CFG.startKarma, lane:1,
    switchTimer:0, invuln:0, bgX:0,
    objects:[], popups:[],
    caseT:0, obstT:0, powerT:0,
    frame:0, glow:0, hit:0,
    result:null, nameInput:"",
  };
}
initState();

function resetPlay() {
  S.score=0; S.karma=CFG.startKarma; S.lane=1;
  S.switchTimer=0; S.invuln=0; S.bgX=0;
  S.objects=[]; S.popups=[];
  S.caseT=0; S.obstT=0; S.powerT=0;
  S.frame=0; S.glow=0; S.hit=0;
  S.timeLeft=CFG.gameDuration;
  S.lastSecond=0;
  S.currentBgSpeed=CFG.bgSpeed;
  S.currentObjSpeed=CFG.objSpeed;
  S.currentObstRate=CFG.obstacleRate;
  S.currentCaseRate=CFG.caseRate;
  S.jumpY=0;
  S.jumpVel=0;
  S.isJumping=false;
  S.jumpCooldown=0;
  S.onPlatform=false;
  S.platformObj=null;
  S.level=1;
  S.bg="Level_1_Background_scroll.png";
}

function resetLevel2() {
  S.karma=CFG.startKarma; S.lane=1;
  S.switchTimer=0; S.invuln=0; S.bgX=0;
  S.objects=[]; S.popups=[];
  S.caseT=0; S.obstT=0; S.powerT=0;
  S.frame=0; S.glow=0; S.hit=0;
  S.timeLeft=CFG.gameDuration;
  S.lastSecond=0;
  // Level 2 — faster speed and more obstacles
  S.currentBgSpeed=CFG.bgSpeed * 1.3;
  S.currentObjSpeed=CFG.objSpeed * 1.3;
  S.currentObstRate=CFG.obstacleRate * 0.8;
  S.currentCaseRate=CFG.caseRate * 0.85;
  S.jumpY=0;
  S.jumpVel=0;
  S.isJumping=false;
  S.jumpCooldown=0;
  S.onPlatform=false;
  S.platformObj=null;
  S.level=2;
  S.bg="Level_2_Background_scroll.png";
}

function resetLevel3() {
  S.karma=CFG.startKarma; S.lane=1;
  S.switchTimer=0; S.invuln=0; S.bgX=0;
  S.objects=[]; S.popups=[];
  S.caseT=0; S.obstT=0; S.powerT=0;
  S.frame=0; S.glow=0; S.hit=0;
  S.timeLeft=CFG.gameDuration;
  S.lastSecond=0;
  // Level 3 — fastest, most obstacles
  S.currentBgSpeed=CFG.bgSpeed * 1.6;
  S.currentObjSpeed=CFG.objSpeed * 1.6;
  S.currentObstRate=CFG.obstacleRate * 0.65;
  S.currentCaseRate=CFG.caseRate * 0.75;
  S.jumpY=0;
  S.jumpVel=0;
  S.isJumping=false;
  S.jumpCooldown=0;
  S.onPlatform=false;
  S.platformObj=null;
  S.level=3;
  S.bg="Level_3_Head_Office.png";
}

function submitName() {
  const charName = S.char ? S.char.name : "BANANA";
  const name = S.nameInput.trim() || charName;
  LEADERBOARD.push({name, score: Math.floor(S.score)});
  LEADERBOARD.sort((a,b)=>b.score-a.score);
  if (LEADERBOARD.length>10) LEADERBOARD=LEADERBOARD.slice(0,10);
  localStorage.setItem("bb_leaderboard", JSON.stringify(LEADERBOARD));
  S.screen = "leaderboard";
  clearJP(); // prevent the Enter keypress from instantly skipping the leaderboard
}

// ── SPAWN ─────────────────────────────────────────────────────
function getImgAspect(name) {
  const im = imgs[name];
  if (!im || !im.naturalWidth) return 1;
  return im.naturalWidth / im.naturalHeight;
}

function spawn(type, opts={}) {
  const lane = opts.lane !== undefined ? opts.lane : Math.floor(Math.random()*3);

  // Don't spawn a regular case if an obstacle is already incoming in the same lane
  // (airOnly floating cases from orange stand are exempt — they're spawned deliberately)
  if (type === "case" && !opts.airOnly) {
    const tooClose = S.objects.some(o =>
      o.type === "obstacle" && o.lane === lane &&
      o.x > CFG.W * 0.5 && o.x < CFG.W + 300
    );
    if (tooClose) return;
  }
  let imgName, h, pts=0, pen=0, floatingCase=false, airOnly=false, landable=false;
  if (type==="case") {
    const org = Math.random()<0.35;
    imgName = org ? "Organic_Case.png" : "Conventional_Case.png";
    pts = org ? CFG.organicPoints : CFG.casePoints;
    h = CFG.collectibleH;
    if (opts.airOnly) airOnly = true;
  } else if (type==="obstacle") {
    const o = opts.obstacleDef || CFG.obstacles[Math.floor(Math.random()*CFG.obstacles.length)];
    imgName=(S.level===2 && o.level2img) ? o.level2img : (S.level===3 && o.level3img) ? o.level3img : o.img;
    pen=o.penalty; h=o.h||CFG.obstacleH;
    floatingCase = !!o.hasFloatingCase;
    landable = !!o.landable;
  } else {
    imgName="Claudia_Power_Up.png"; h=CFG.powerupH;
  }
  const aspect = getImgAspect(imgName);
  const w = h * aspect;
  const obj = {type,imgName,lane,x:CFG.W+100,w,h,pts,pen,done:false,airOnly,landable};
  S.objects.push(obj);

  // Spawn floating case above orange stand
  if (floatingCase) {
    const org = Math.random()<0.5;
    const caseImg = org ? "Organic_Case.png" : "Conventional_Case.png";
    const casePts = org ? CFG.organicPoints : CFG.casePoints;
    const caseH = CFG.collectibleH;
    const caseW = caseH * getImgAspect(caseImg);
    S.objects.push({
      type:"case", imgName:caseImg, lane, x:CFG.W+100,
      w:caseW, h:caseH, pts:casePts, pen:0, done:false,
      airOnly:true,        // must be jumping to collect
      floatOffset: h - 55  // sits just on top of the stand
    });
  }
}

// ── UPDATE ────────────────────────────────────────────────────
function update() {
  S.frame++;

  // ── DIFFICULTY RAMP ───────────────────────────────────
  // Smooth continuous ramp over 60s
  const elapsed = S.frame / 60;
  S.timeLeft = Math.max(0, CFG.gameDuration - elapsed);
  const rampT = elapsed / CFG.gameDuration; // 0 to 1 over 60s

  // Speed ramps up
  S.currentBgSpeed  = CFG.bgSpeed  + rampT * CFG.diffRampSpeed * 0.8;
  S.currentObjSpeed = CFG.objSpeed + rampT * CFG.diffRampSpeed * 1.0;

  // Obstacles spawn faster AND cases spawn slower = worse ratio over time
  // At start: obstacle every ~120 frames, case every ~75 frames (ratio ~1.6 cases per obstacle)
  // At end:   obstacle every ~40 frames, case every ~110 frames (ratio ~0.4 cases per obstacle)
  S.currentObstRate = Math.max(140, CFG.obstacleRate - rampT * 50);
  S.currentCaseRate = Math.min(100, CFG.caseRate + rampT * 15);

  // ── BACKGROUND SCROLL ─────────────────────────────────
  const bgI = imgs["Level_1_Background_scroll.png"];
  const bgW = bgI&&bgI.naturalWidth ? (bgI.naturalWidth*(CFG.H/bgI.naturalHeight)) : CFG.W;
  S.bgX -= S.currentBgSpeed;
  if (S.bgX <= -bgW) S.bgX += bgW;

  if (S.switchTimer>0) S.switchTimer-=16;
  if (S.switchTimer<=0) {
    if (jp["ArrowUp"]||jp["KeyW"]) { if(S.lane>0){S.lane--;S.switchTimer=CFG.switchCooldown;} }
    else if (jp["ArrowDown"]||jp["KeyS"]) { if(S.lane<2){S.lane++;S.switchTimer=CFG.switchCooldown;} }
  }

  // ── JUMP ─────────────────────────────────────────────────
  if (S.jumpCooldown>0) S.jumpCooldown--;
  const wantsJump = jp["Space"];
  if (wantsJump && !S.isJumping && !S.onPlatform && S.jumpCooldown===0) {
    playSfx("jump");
    S.jumpVel = CFG.jumpVelocity;
    S.isJumping = true;
  }

  // Apply physics when airborne
  if (S.isJumping) {
    S.jumpY += S.jumpVel;
    S.jumpVel += CFG.gravity;

    // Check landing on apple stand top surface
    if (S.jumpVel >= 0) {
      S.objects.forEach(o => {
        if (!o.landable || o.done || o.lane !== S.lane) return;
        const dx = Math.abs(CFG.playerX - o.x);
        if (dx > o.w/2 + 20) return;
        const standTop = CFG.laneY[o.lane] - o.h;  // top of stand (bottom-aligned)
        const playerBottom = CFG.laneY[S.lane] + S.jumpY; // bottom of player
        if (playerBottom >= standTop - 8 && playerBottom <= standTop + 30) {
          S.jumpY = standTop - CFG.laneY[S.lane]; // snap player bottom to stand top
          S.jumpVel = 0;
          S.isJumping = false;
          S.onPlatform = true;
          S.platformObj = o;
        }
      });
    }

    // Land on ground
    if (S.isJumping && S.jumpY >= 0) {
      S.jumpY = 0;
      S.jumpVel = 0;
      S.isJumping = false;
      S.onPlatform = false;
      S.jumpCooldown = CFG.jumpCooldown;
    }
  }

  // Ride platform — scroll with it, fall off when it passes
  if (S.onPlatform && S.platformObj) {
    if (S.platformObj.done || S.platformObj.x < CFG.playerX - S.platformObj.w/2 - 10) {
      S.onPlatform = false;
      S.platformObj = null;
      S.isJumping = true;
      S.jumpVel = 1;
    }
  }

  if (S.invuln>0) S.invuln-=16;
  if (S.glow>0) S.glow-=2;
  if (S.hit>0) S.hit--;

  S.caseT++; S.obstT++; S.powerT++;
  if (S.caseT>=S.currentCaseRate) { S.caseT=0; spawn("case"); }
  if (S.obstT>=S.currentObstRate) { S.obstT=Math.floor(Math.random()*25); spawn("obstacle"); }
  if (S.powerT>=CFG.powerupRate)  { S.powerT=0; spawn("powerup"); }

  // Update object widths in case images loaded after spawn
  S.objects.forEach(o => {
    const aspect = getImgAspect(o.imgName);
    o.w = o.h * aspect;
  });

  const py = CFG.laneY[S.lane] + S.jumpY; // player's bottom Y
  S.objects.forEach(o => {
    o.x -= S.currentObjSpeed;
    if (o.done) return;
    const oy = CFG.laneY[o.lane] - (o.floatOffset || 0);
    const dx = Math.abs(CFG.playerX - o.x);
    const dy = Math.abs(py - oy);
    const dyThresh = (o.airOnly) ? 80 : 45; // looser check for elevated cases
    if (dx < (o.w/2 + 25) && dy < dyThresh) {
      if (o.type==="case") {
        if (o.airOnly && !S.isJumping && !S.onPlatform) return; // must be jumping or on platform
        o.done = true;
        S.score += o.pts;
        playSfx("collect");
        const label = o.airOnly ? "✈ +"+o.pts : "+"+o.pts;
        addPop(label, o.x, oy-55, o.airOnly ? "#88FFDD" : "#FFE000");
      } else if (o.type==="powerup") {
        o.done = true;
        playSfx("powerup");
        if (S.karma<CFG.maxKarma) { S.karma++; S.glow=60; addPop("+KARMA!", o.x, oy-55, "#00FF88"); }
        else addPop("MAX KARMA!", o.x, oy-55, "#00FF88");
      } else {
        // Obstacle — never disappears, just hurts you if you're on the ground
        if (S.isJumping) return; // jumped over it — no effect
        if (S.invuln<=0) {
          playSfx("hit");
          S.karma--; S.score=Math.max(0,S.score-o.pen);
          S.invuln=CFG.invulnMs; S.hit=18;
          addPop("-"+o.pen+" pts", o.x, oy-55, "#FF4444");
          addPop("💥 -KARMA", CFG.playerX, py-70, "#FF0000");
        }
      }
    }
  });
  S.objects = S.objects.filter(o=>o.x>-200&&!o.done);
  S.score += 0.025;
  S.popups = S.popups.filter(p=>p.life>0);
  S.popups.forEach(p=>{p.y-=0.7;p.life--;});

  // ── END CONDITIONS ────────────────────────────────────
  if (S.karma<=0) { S.result="lose"; S.screen="name"; S.nameInput=""; S.nameFrame=undefined; stopMusic(); }
  else if (S.timeLeft<=0 && S.level===1) { S.result="win"; S.screen="level1complete"; }
  else if (S.timeLeft<=0 && S.level===2) { S.result="win"; S.screen="level2complete"; }
  else if (S.timeLeft<=0 && S.level===3) { S.result="win"; S.screen="level3complete"; }
}

function addPop(text,x,y,color) { S.popups.push({text,x,y,life:70,color}); }

// ── DRAW HELPERS ──────────────────────────────────────────────
function txt(t,x,y,font,color,align="left",shadow=true) {
  t = String(t).toUpperCase();
  ctx.font=font; ctx.textAlign=align;
  if(shadow){ctx.fillStyle="rgba(0,0,0,0.8)";ctx.fillText(t,x+2,y+2);}
  ctx.fillStyle=color; ctx.fillText(t,x,y);
  ctx.textAlign="left";
}

function heart(x,y,sz,filled) {
  const p=Math.max(2,Math.floor(sz/7));
  [[0,1,1,0,1,1,0],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0]]
  .forEach((row,ry)=>row.forEach((c,cx)=>{
    if(c){ctx.fillStyle=filled?"#FF2244":"#333";ctx.fillRect(x+cx*p,y+ry*p,p,p);}
  }));
}

function btn(label,x,y,w,h) {
  // Shadow
  ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(x+4,y+4,w,h);
  // Button body
  const gr=ctx.createLinearGradient(x,y,x,y+h);
  gr.addColorStop(0,"#FFE84D"); gr.addColorStop(1,"#FFB800");
  ctx.fillStyle=gr; ctx.fillRect(x,y,w,h);
  // Border
  ctx.strokeStyle="#CC8800"; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h);
  // Text
  ctx.font='bold 18px "ClaudiaShouter"';
  ctx.textAlign="center"; ctx.fillStyle="#000";
  ctx.fillText(label,x+w/2,y+h/2+6);
  ctx.textAlign="left";
}

function panel(x,y,w,h,color="rgba(0,0,0,0.88)") {
  ctx.fillStyle=color; ctx.fillRect(x,y,w,h);
  ctx.strokeStyle="#FFE000"; ctx.lineWidth=3; ctx.strokeRect(x,y,w,h);
}

// ── SCREENS ───────────────────────────────────────────────────
function drawTitle() {
  // Full cover image — no text overlay, title is in the image
  drawImgStretch("Cover_Image.png",0,0,CFG.W,CFG.H);

  // Black drop shadow — multiple offsets for thick shadow
  ctx.fillStyle="rgba(0,0,0,1)";
  ctx.font='bold 20px "ClaudiaShouter"';
  ctx.textAlign="center";
  ctx.fillText("PRESS ENTER OR SPACE TO START", CFG.W/2+3, CFG.H-87);
  ctx.fillText("PRESS ENTER OR SPACE TO START", CFG.W/2+3, CFG.H-90);
  ctx.fillText("PRESS ENTER OR SPACE TO START", CFG.W/2-3, CFG.H-87);
  ctx.fillText("PRESS ENTER OR SPACE TO START", CFG.W/2,   CFG.H-87);
  // Bright white text on top
  ctx.fillStyle="#eae3da";
  ctx.fillText("PRESS ENTER OR SPACE TO START", CFG.W/2, CFG.H-90);
  ctx.textAlign="left";
  btn("LET'S GO!",CFG.W/2-90,CFG.H-72,180,44);

  // Fullscreen hint
  ctx.fillStyle="rgba(0,0,0,0.5)";
  ctx.fillRect(CFG.W-130, CFG.H-36, 120, 28);
  txt("⛶ FULLSCREEN", CFG.W-70, CFG.H-16, '11px "ClaudiaShouter"', "#888", "center", false);
}

function drawCharSelect() {
  // Pure black background so character black backgrounds blend perfectly
  ctx.fillStyle="#2e2624";
  ctx.fillRect(0,0,CFG.W,CFG.H);

  txt("CHOOSE YOUR BANANA BADASS",CFG.W/2,52,'bold 38px "ClaudiaShouter"',"#f08050","center");
  txt("◄ ► ARROW KEYS  |  ENTER TO CONFIRM",CFG.W/2,84,'16px "ClaudiaShouter"',"#94cde9","center",false);

  const cW=190, cH=250, gap=16;
  const totalW = CFG.characters.length*(cW+gap)-gap;
  const sx = (CFG.W-totalW)/2;

  CFG.characters.forEach((ch,i)=>{
    const cx=sx+i*(cW+gap), cy=102;
    const sel=i===S.charIdx;

    // Card bg is black — blends with image black background
    if(sel){
      ctx.shadowColor="#FFE000"; ctx.shadowBlur=20;
    }
    ctx.fillStyle="#FFF";
    ctx.fillRect(cx,cy,cW,cH);
    if(sel){
      ctx.strokeStyle="#FFE000";
      ctx.lineWidth=3;
      ctx.strokeRect(cx,cy,cW,cH);
    }
    ctx.shadowBlur=0;

    // Draw character image — aspect ratio correct, fit inside card
    drawImgFit(ch.still, cx+8, cy+8, cW-16, cH-46);

    // Name
    ctx.font='bold 16px "ClaudiaShouter"'; ctx.textAlign="center";
    ctx.fillStyle="#2e2624";
    ctx.fillText(ch.name.toUpperCase(), cx+cW/2, cy+cH-14);
    ctx.textAlign="left";

    if(sel){
      ctx.fillStyle="#FFE000";
      ctx.beginPath();ctx.moveTo(cx+cW/2-12,cy-24);ctx.lineTo(cx+cW/2+12,cy-24);ctx.lineTo(cx+cW/2,cy-6);ctx.fill();
    }
  });

  btn("CONFIRM →",CFG.W/2-80,388,160,46);
}

function drawInstrCollect() {
  ctx.fillStyle="#2e2624"; ctx.fillRect(0,0,CFG.W,CFG.H);
  ctx.fillStyle="rgba(0,0,0,0)"; ctx.fillRect(24,14,CFG.W-48,CFG.H-28);
  ctx.strokeStyle="#fbbb30"; ctx.lineWidth=3; ctx.strokeRect(24,14,CFG.W-48,CFG.H-28);
  txt("✦  COLLECT THESE  ✦",CFG.W/2,68,'bold 38px "ClaudiaShouter"',"#fbbb30","center");

  const items=[
    {i:"Conventional_Case.png", label:"Conventional Case",  pts:"+50 PTS",  color:"#9ac9b5", border:"#9ac9b5"},
    {i:"Organic_Case.png",       label:"Organic Case",       pts:"+75 PTS",  color:"#94cde9", border:"#94cde9"},
    {i:"Claudia_Power_Up.png",   label:"Power-Up Banana",    pts:"+1 KARMA", color:"#d8c7e0", border:"#d8c7e0"},
  ];
  const boxW=220, boxH=300, gap=30;  // taller box to fit bigger image + text
  const imgH=165;  // 50% bigger than before (~110px worth of space)
  const totalW=items.length*(boxW+gap)-gap;
  const sx=(CFG.W-totalW)/2;

  items.forEach((it,i)=>{
    const bx=sx+i*(boxW+gap), by=85;
    ctx.strokeStyle=it.border; ctx.lineWidth=2;
    ctx.fillStyle="rgba(255,255,255,0.03)"; ctx.fillRect(bx,by,boxW,boxH);
    ctx.strokeRect(bx,by,boxW,boxH);
    // Image on top — bigger
    drawImgFit(it.i, bx+10, by+8, boxW-20, imgH);
    // Text below image
    txt(it.label, bx+boxW/2, by+imgH+30, 'bold 15px "ClaudiaShouter"', "#DDD","center",false);
    txt(it.pts,   bx+boxW/2, by+imgH+54, 'bold 20px "ClaudiaShouter"', it.color,"center");
  });

  txt("RUN THROUGH LANES TO COLLECT!",CFG.W/2,410,'bold 15px "ClaudiaShouter"',"#eae3da","center",false);
  btn("NEXT: AVOID THESE →",CFG.W/2-130,435,260,46);
}

function drawInstrAvoid() {
  ctx.fillStyle="#2e2624"; ctx.fillRect(0,0,CFG.W,CFG.H);
  ctx.strokeStyle="#FFE000"; ctx.lineWidth=3; ctx.strokeRect(24,14,CFG.W-48,CFG.H-28);
  txt("✦  AVOID BORING BANANAS  ✦",CFG.W/2,64,'bold 50px "ClaudiaShouter"',"#9ac9b5","center");
  txt("EACH HIT = -1 KARMA + POINT PENALTY",CFG.W/2,96,'20px "ClaudiaShouter"',"#f08050","center",false);

  const cols=2;
  const cellW=220, cellH=160, imgH=95;
  const gapX=40, rowGap=24;
  const totalW=cols*cellW+(cols-1)*gapX;
  const startX=(CFG.W-totalW)/2;
  const startY=108;

  CFG.obstacles.filter(o => !o.landable).slice(0,4).forEach((o,i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const bx=startX+col*(cellW+gapX), by=startY+row*(cellH+rowGap);

    // Image on top, centered in cell
    drawImgFit(o.img, bx, by, cellW, imgH);

    // Text below image
    const nameLines = o.name.split('\n');
    nameLines.forEach((line, li) => {
      txt(line, bx+cellW/2, by+imgH+22+(li*20), 'bold 18px "ClaudiaShouter"', "#f08050","center");
    });
    txt("-"+o.penalty+" pts + -1 ❤", bx+cellW/2, by+imgH+22+(nameLines.length*20)+4, 'bold 16px "ClaudiaShouter"', "#fbbb30","center",false);
  });

  // Button sits below the grid: startY + 2 rows + content height + padding
  const gridBottom = startY + (cellH+rowGap) + imgH + 22 + (2*20) + 4; // ~468
  btn("START GAME →",CFG.W/2-90, gridBottom+16, 180,46);
}

function drawGameplay() {
  // Scrolling background — use pre-scaled offscreen canvas if available
  const bgName = S.bg||"Level_1_Background_scroll.png";
  const bgSrc = bgCache[bgName];
  const bgI = imgs[bgName];
  if(bgSrc){
    const bw = bgSrc.width;
    let bx = Math.round(S.bgX);
    while(bx<CFG.W){ctx.drawImage(bgSrc,bx,0,bw,CFG.H);bx+=bw;}
    if(S.bgX<=-bw) S.bgX+=bw;
  } else if(bgI&&bgI.naturalWidth>0){
    const sc=CFG.H/bgI.naturalHeight;
    const bw=bgI.naturalWidth*sc;
    let bx=Math.round(S.bgX);
    ctx.imageSmoothingEnabled=false;
    while(bx<CFG.W){ctx.drawImage(bgI,bx,0,bw,CFG.H);bx+=bw;}
    ctx.imageSmoothingEnabled=true;
    if(S.bgX<=-bw) S.bgX+=bw;
  } else {
    ctx.fillStyle="#8B4513"; ctx.fillRect(0,0,CFG.W,CFG.H);
  }

  // Subtle lane dashes
  CFG.laneY.forEach(ly=>{
    ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1;
    ctx.setLineDash([16,28]);
    ctx.beginPath();ctx.moveTo(0,ly);ctx.lineTo(CFG.W,ly);ctx.stroke();
  });
  ctx.setLineDash([]);

  // Draw objects and player in depth order: lane 0 (top/back) → lane 2 (bottom/front)
  const ch = S.char || CFG.characters[0];
  const visible = S.invuln<=0 || Math.floor(S.frame/4)%2===0;
  const bobSpeed = 0.28 + (S.currentObjSpeed - CFG.objSpeed) * 0.04;
  const bobAmt = S.isJumping ? 0 : 4;
  const bob = Math.sin(S.frame * bobSpeed) * bobAmt;
  const playerBottomY = CFG.laneY[S.lane] + S.jumpY + bob;

  for (let layer = 0; layer < 3; layer++) {
    // Objects in this lane — plain for loop avoids per-frame array allocation
    for (let i = 0; i < S.objects.length; i++) {
      const o = S.objects[i];
      if (o.lane !== layer) continue;
      const bottomY = CFG.laneY[o.lane] - (o.floatOffset || 0);
      drawImgBottom(o.imgName, o.x, bottomY, o.h);
      if (o.airOnly && !o.done) {
        const aspect = getImgAspect(o.imgName);
        const w = o.h * aspect;
        ctx.strokeStyle = `rgba(100,255,220,${0.5+0.4*Math.sin(S.frame*0.15)})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x - w/2, bottomY - o.h, w, o.h);
      }
    }

    // Player drawn within their lane so depth is correct
    if (S.lane === layer && visible) {
      if(S.glow>0){ctx.shadowColor="#00FF88";ctx.shadowBlur=12;}
      if(S.hit>0){ctx.shadowColor="#FF0000";ctx.shadowBlur=14;}
      if(ch.sheet && imgs[ch.sheet] && imgs[ch.sheet].complete) {
        const frameRate = 12;
        const frameIdx = Math.floor(S.frame / frameRate) % ch.frames.length;
        const f = ch.frames[frameIdx];
        const im = imgs[ch.sheet];
        const scale = CFG.playerH / ch.frameH;
        const dw = f.w * scale;
        const dh = CFG.playerH;
        ctx.drawImage(im, f.x, 0, f.w, ch.frameH, CFG.playerX - dw/2, playerBottomY - dh, dw, dh);
      } else {
        drawImgBottom(ch.run, CFG.playerX, playerBottomY, CFG.playerH);
      }
      ctx.shadowBlur=0; ctx.shadowColor="transparent";
    }
  }

  // Popups
  S.popups.forEach(p=>{
    ctx.globalAlpha=Math.min(1,p.life/18);
    txt(p.text,p.x,p.y,'bold 17px "ClaudiaShouter"',p.color,"center");
    ctx.globalAlpha=1;
  });

  drawHUD();
}

function drawHUD() {
  ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,CFG.W,50);
  txt("SCORE: "+Math.floor(S.score),14,33,'bold 22px "ClaudiaShouter"',"#FFE000","left",false);
  txt("LEVEL "+(S.level||1),CFG.W/2,33,'bold 20px "ClaudiaShouter"',"#FFF","center",false);

  // Countdown timer — turns red in last 15 seconds
  const t = Math.ceil(S.timeLeft||0);
  const timerColor = t<=15 ? (Math.floor(S.frame/8)%2===0?"#FF2244":"#FF8800") : "#FFF";
  const mins = Math.floor(t/60);
  const secs = String(t%60).padStart(2,'0');
  txt(`${mins}:${secs}`, CFG.W/2+80, 33, 'bold 22px "ClaudiaShouter"', timerColor, "left", false);

  // Hearts
  for(let i=0;i<CFG.maxKarma;i++) heart(CFG.W-36-i*30,9,25,i<S.karma);

  // Jump indicator - shows SPACE / A button hint briefly at start, then just shows if airborne
  if (S.isJumping) {
    txt("✈ JUMP!", CFG.W/2-40, CFG.H-18, 'bold 14px "ClaudiaShouter"', "#88FFDD", "left", false);
  } else if (S.frame < 300) {
    const alpha = Math.max(0, 1 - S.frame/300);
    ctx.globalAlpha = alpha;
    txt("↑↓ = LANE  |  SPACE = JUMP  |  A BUTTON = JUMP", CFG.W/2, CFG.H-18, '13px "ClaudiaShouter"', "#AAA", "center", false);
    ctx.globalAlpha = 1;
  }
}

function drawGameOver() {
  drawImgStretch("Game_snapshot.png",0,0,CFG.W,CFG.H);
  ctx.fillStyle="rgba(0,0,0,0.75)"; ctx.fillRect(0,0,CFG.W,CFG.H);
  txt("GAME OVER",CFG.W/2,168,'bold 72px "ClaudiaShouter"',"#FF2244","center");
  txt("FINAL SCORE: "+Math.floor(S.score),CFG.W/2,258,'bold 28px "ClaudiaShouter"',"#FFE000","center");
  txt("EVEN BANANAS HAVE BAD DAYS.",CFG.W/2,308,'18px "ClaudiaShouter"',"#AAA","center");
  btn("ENTER NAME",CFG.W/2-95,368,190,50);
}

function drawWin() {
  const bgI=imgs["Level_1_Background_scroll.png"];
  if(bgI&&bgI.naturalWidth>0) ctx.drawImage(bgI,0,0,CFG.W,CFG.H);
  ctx.fillStyle="rgba(0,0,0,0.68)"; ctx.fillRect(0,0,CFG.W,CFG.H);
  txt("YOU WIN! 🍌",CFG.W/2,155,'bold 64px "ClaudiaShouter"',"#FFE000","center");
  txt("SCORE: "+Math.floor(S.score),CFG.W/2,242,'bold 30px "ClaudiaShouter"',"#FFF","center");
  txt("THE ENDCAP IS BUILT. FARMERS ARE PAID.",CFG.W/2,295,'bold 17px "ClaudiaShouter"',"#88FF88","center");
  txt("LEVEL 2 COMING SOON!",CFG.W/2,338,'bold 22px "ClaudiaShouter"',"#FF8800","center");
  btn("ENTER NAME",CFG.W/2-95,390,190,50);
}

function drawName() {
  if (S.nameFrame === undefined) S.nameFrame = 0;
  S.nameFrame++;
  if (!S.nameInput) S.nameInput = "";
  if (S.gpNameRow === undefined) { S.gpNameRow = 0; S.gpNameCol = 0; }

  // Background
  const gr = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 50, CFG.W/2, CFG.H/2, 450);
  gr.addColorStop(0, S.result === "win" ? "#1a1a00" : "#1a0000");
  gr.addColorStop(1, "#000");
  ctx.fillStyle = gr; ctx.fillRect(0, 0, CFG.W, CFG.H);

  // Title & score
  txt(S.result === "win" ? "🏆 YOU WIN!" : "💀 GAME OVER", CFG.W/2, 72,
      'bold 52px "ClaudiaShouter"', S.result === "win" ? "#FFE000" : "#FF2244", "center");
  txt("SCORE: " + Math.floor(S.score), CFG.W/2, 122, 'bold 26px "ClaudiaShouter"', "#FFF", "center");
  txt("ENTER YOUR NAME:", CFG.W/2, 160, 'bold 20px "ClaudiaShouter"', "#FFE000", "center");

  // Name input box
  const bx = CFG.W/2 - 155, by = 172;
  ctx.fillStyle = "#111"; ctx.fillRect(bx, by, 310, 46);
  ctx.strokeStyle = "#FFE000"; ctx.lineWidth = 3; ctx.strokeRect(bx, by, 310, 46);
  const cursor = Math.floor(S.nameFrame / 18) % 2 === 0 ? "_" : "";
  txt(S.nameInput + cursor, CFG.W/2, by + 32, 'bold 26px "ClaudiaShouter"', "#FFE000", "center", false);

  // ── On-screen letter grid ──────────────────────────────────
  // Row 0 & 1: 13 letters each  (cell 36×34, gap 3)
  // Row 2:     SPC / DEL / DONE (wider cells)
  const CW = 36, CH = 34, GAP = 3;
  const rowY = [238, 276, 318]; // top-y of each row

  GP_GRID.forEach((row, ri) => {
    // Work out the total row pixel width so we can centre it
    const cellWidths = row.map(ch => ri === 2 ? (ch === 'DONE' ? 116 : 92) : CW);
    const rowW = cellWidths.reduce((s, w) => s + w, 0) + (row.length - 1) * GAP;
    let cx = Math.floor((CFG.W - rowW) / 2);
    const cellH = ri === 2 ? 38 : CH;

    row.forEach((ch, ci) => {
      const cellW = cellWidths[ci];
      const isSel = S.gpNameRow === ri && S.gpNameCol === ci;

      // Cell fill — pulse the selected cell slightly
      const pulse = isSel ? 0.08 * Math.sin(S.nameFrame * 0.18) : 0;
      ctx.fillStyle = isSel ? "#FFE000" : "#1e1e1e";
      ctx.globalAlpha = 1 + pulse;
      ctx.fillRect(cx, rowY[ri], cellW, cellH);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = isSel ? "#FFFFFF" : "#444";
      ctx.lineWidth   = isSel ? 2 : 1;
      ctx.strokeRect(cx, rowY[ri], cellW, cellH);

      // Label (txt() uppercases automatically)
      const label    = ch === 'SPC' ? 'SPC' : ch === 'DEL' ? 'DEL' : ch === 'DONE' ? 'DONE' : ch;
      const fontSize = ri === 2 ? '13px' : '15px';
      txt(label, cx + cellW/2, rowY[ri] + cellH - 9,
          `bold ${fontSize} "ClaudiaShouter"`, isSel ? "#000" : "#CCC", "center", false);

      cx += cellW + GAP;
    });
  });

  // Controller hint
  txt("GAMEPAD:  D-PAD=MOVE   A=SELECT   B=DELETE   START=SUBMIT",
      CFG.W/2, 372, '12px "ClaudiaShouter"', "#888", "center", false);
  txt("KEYBOARD: TYPE NAME + PRESS ENTER",
      CFG.W/2, 390, '12px "ClaudiaShouter"', "#555", "center", false);

  // Auto-submit countdown & submit button
  const secsLeft = Math.max(0, 60 - Math.floor(S.nameFrame / 60));
  txt("AUTO-SUBMIT IN " + secsLeft + "S", CFG.W/2, 416, '12px "ClaudiaShouter"', "#444", "center", false);
  btn("SUBMIT", CFG.W/2 - 60, 426, 120, 40);

  if (S.nameFrame >= 3600) submitName();
}

function drawLeaderboard() {
  const gr=ctx.createLinearGradient(0,0,0,CFG.H);
  gr.addColorStop(0,"#0a0820"); gr.addColorStop(1,"#000");
  ctx.fillStyle=gr; ctx.fillRect(0,0,CFG.W,CFG.H);
  for(let y=0;y<CFG.H;y+=4){ctx.fillStyle="rgba(0,0,0,0.06)";ctx.fillRect(0,y,CFG.W,2);}

  txt("🏆  HALL OF BANANA BADASSES  🏆",CFG.W/2,56,'bold 30px "ClaudiaShouter"',"#FFE000","center");

  const px=CFG.W/2-240, pw=480;
  panel(px,72,pw,378);

  ctx.font='bold 15px "ClaudiaShouter"'; ctx.textAlign="left"; ctx.fillStyle="#666";
  ctx.fillText("RANK",px+16,108); ctx.fillText("NAME",px+100,108);
  ctx.textAlign="right"; ctx.fillText("SCORE",px+pw-16,108); ctx.textAlign="left";
  ctx.strokeStyle="#444"; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(px+10,115);ctx.lineTo(px+pw-10,115);ctx.stroke();

  LEADERBOARD.forEach((e,i)=>{
    const ey=142+i*30;
    const col=i===0?"#FFE000":i<3?"#FFA040":"#CCC";
    const medal=i===0?"🥇 ":i===1?"🥈 ":i===2?"🥉 ":" "+(i+1)+".";
    ctx.font='bold 15px "ClaudiaShouter"'; ctx.fillStyle=col; ctx.textAlign="left";
    ctx.fillText(medal, px+16, ey);
    ctx.fillText(e.name, px+100, ey);
    ctx.textAlign="right"; ctx.fillText(e.score, px+pw-16, ey); ctx.textAlign="left";
  });
  if(!LEADERBOARD.length){txt("NO SCORES YET — BE THE FIRST!",CFG.W/2,270,'bold 17px "ClaudiaShouter"',"#444","center",false);}

  btn("PLAY AGAIN",CFG.W/2-85,470,170,46);
}

// ── INTRO VIDEO ───────────────────────────────────────────────
let introVideo = null;

function startIntroVideo() {
  if (introVideo) { introVideo.pause(); introVideo.remove(); }

  const vid = document.createElement("video");
  vid.src = INTRO_VIDEO_SRC;
  vid.playsInline = true;

  const r = canvas.getBoundingClientRect();
  vid.style.position = "fixed";
  vid.style.left   = r.left + "px";
  vid.style.top    = r.top + "px";
  vid.style.width  = r.width + "px";
  vid.style.height = r.height + "px";
  vid.style.objectFit = "fill";
  vid.style.zIndex = "10";
  document.body.appendChild(vid);
  introVideo = vid;

  // Auto-advance to charselect when video ends or errors
  const advance = () => { stopIntroVideo(); S.screen = "charselect"; };
  vid.addEventListener("ended", advance);
  vid.addEventListener("error", advance);

  vid.play().catch(() => advance());
}

function stopIntroVideo() {
  if (introVideo) { introVideo.pause(); introVideo.remove(); introVideo = null; }
}

function drawIntro() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CFG.W, CFG.H);
}

// ── LEVEL 1 COMPLETE ──────────────────────────────────────────
function drawLevel1Complete() {
  ctx.fillStyle="#000"; ctx.fillRect(0,0,CFG.W,CFG.H);
  for(let y=0;y<CFG.H;y+=4){ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(0,y,CFG.W,2);}

  const pulse = 0.7 + 0.3*Math.sin(Date.now()*0.004);
  ctx.shadowColor="#00FF88"; ctx.shadowBlur=16*pulse;
  txt("LEVEL 1", CFG.W/2, CFG.H/2-50, 'bold 80px "ClaudiaShouter"', "#FFE000", "center");
  ctx.shadowBlur=0; ctx.shadowColor="transparent";
  txt("COMPLETE!", CFG.W/2, CFG.H/2+30, 'bold 64px "ClaudiaShouter"', "#00FF88", "center");

  txt("SCORE: "+Math.floor(S.score), CFG.W/2, CFG.H/2+90, 'bold 24px "ClaudiaShouter"', "#FFF", "center");
  btn("CONTINUE", CFG.W/2-90, CFG.H/2+120, 180, 44);
}

// ── LEVEL 2 COMPLETE ──────────────────────────────────────────
function drawLevel2Complete() {
  ctx.fillStyle="#000"; ctx.fillRect(0,0,CFG.W,CFG.H);
  for(let y=0;y<CFG.H;y+=4){ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(0,y,CFG.W,2);}

  const pulse = 0.7 + 0.3*Math.sin(Date.now()*0.004);
  ctx.shadowColor="#FFE000"; ctx.shadowBlur=16*pulse;
  txt("LEVEL 2", CFG.W/2, CFG.H/2-50, 'bold 80px "ClaudiaShouter"', "#FFE000", "center");
  ctx.shadowBlur=0; ctx.shadowColor="transparent";
  txt("COMPLETE!", CFG.W/2, CFG.H/2+30, 'bold 64px "ClaudiaShouter"', "#00FF88", "center");

  txt("SCORE: "+Math.floor(S.score), CFG.W/2, CFG.H/2+90, 'bold 24px "ClaudiaShouter"', "#FFF", "center");
  btn("CONTINUE", CFG.W/2-90, CFG.H/2+120, 180, 44);
}


function drawLevel2Splash() {
  // Dark background with level 2 bg peek
  const bgI = imgs["Level_2_Background_scroll.png"];
  if (bgI && bgI.naturalWidth>0) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bgI, 0, 0, CFG.W, CFG.H);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle="#000"; ctx.fillRect(0,0,CFG.W,CFG.H);
  }
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,CFG.W,CFG.H);

  // Pulsing glow
  const pulse = 0.7 + 0.3 * Math.sin(Date.now()*0.004);
  ctx.shadowColor="#FFE000"; ctx.shadowBlur=16*pulse;
  txt("LEVEL 2", CFG.W/2, CFG.H/2-20, 'bold 96px "ClaudiaShouter"', "#FFE000", "center");
  ctx.shadowBlur=0; ctx.shadowColor="transparent";

  txt("BANANITY FAIR", CFG.W/2, CFG.H/2+55, 'bold 28px "ClaudiaShouter"', "#FFF", "center");
  btn("LET'S GO!", CFG.W/2-90, CFG.H/2+100, 180, 44);
}

// ── LEVEL 3 SPLASH ────────────────────────────────────────────
function drawLevel3Splash() {
  const bgI = imgs["Level_3_Head_Office.png"];
  if (bgI && bgI.naturalWidth>0) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bgI, 0, 0, CFG.W, CFG.H);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle="#000"; ctx.fillRect(0,0,CFG.W,CFG.H);
  }
  ctx.fillStyle="rgba(0,0,0,0.6)"; ctx.fillRect(0,0,CFG.W,CFG.H);

  const pulse = 0.7 + 0.3*Math.sin(Date.now()*0.004);
  ctx.shadowColor="#FF4444"; ctx.shadowBlur=16*pulse;
  txt("LEVEL 3", CFG.W/2, CFG.H/2-20, 'bold 96px "ClaudiaShouter"', "#FFE000", "center");
  ctx.shadowBlur=0; ctx.shadowColor="transparent";
  txt("GROCERY HEAD OFFICE", CFG.W/2, CFG.H/2+55, 'bold 24px "ClaudiaShouter"', "#FFF", "center");
  btn("LET'S GO!", CFG.W/2-90, CFG.H/2+100, 180, 44);
}

// ── LEVEL 3 COMPLETE ──────────────────────────────────────────
function drawLevel3Complete() {
  ctx.fillStyle="#000"; ctx.fillRect(0,0,CFG.W,CFG.H);
  for(let y=0;y<CFG.H;y+=4){ctx.fillStyle="rgba(0,0,0,0.15)";ctx.fillRect(0,y,CFG.W,2);}

  const pulse = 0.7 + 0.3*Math.sin(Date.now()*0.004);
  ctx.shadowColor="#FFE000"; ctx.shadowBlur=16*pulse;
  txt("LEVEL 3", CFG.W/2, CFG.H/2-50, 'bold 80px "ClaudiaShouter"', "#FFE000", "center");
  ctx.shadowBlur=0; ctx.shadowColor="transparent";
  txt("COMPLETE!", CFG.W/2, CFG.H/2+30, 'bold 64px "ClaudiaShouter"', "#00FF88", "center");
  txt("SCORE: "+Math.floor(S.score), CFG.W/2, CFG.H/2+90, 'bold 24px "ClaudiaShouter"', "#FFF", "center");
  btn("CONTINUE", CFG.W/2-90, CFG.H/2+120, 180, 44);
}



let cutsceneVideo = null;

function startCutscene() {
  if (cutsceneVideo) {
    cutsceneVideo.pause();
    cutsceneVideo.remove();
  }
  pauseMusic();

  // Pick cutscene based on selected character
  const charName = (S.char ? S.char.name : "NERD").toLowerCase();
  const cutsceneMap = {
    assassin: CUTSCENE_ASSASSIN_SRC,
    bulldozer: CUTSCENE_BULLDOZER_SRC,
    curious:   CUTSCENE_CURIOUS_SRC,
    nerd:      CUTSCENE_NERD_SRC,
  };
  const src = cutsceneMap[charName] || CUTSCENE_NERD_SRC;

  const vid = document.createElement("video");
  vid.src = src;
  vid.style.display = "none";
  vid.preload = "auto";
  document.body.appendChild(vid);
  cutsceneVideo = vid;
  vid.play().catch(() => {});
  vid.onended = () => {
    S.screen = "level2splash";
    vid.remove();
    cutsceneVideo = null;
    resumeMusic();
  };
}
function startCutscene3() {
  if (cutsceneVideo) { cutsceneVideo.pause(); cutsceneVideo.remove(); }
  pauseMusic();
  const charName = (S.char ? S.char.name : "NERD").toLowerCase();
  const cutsceneMap = {
    assassin:  CUTSCENE3_ASSASSIN_SRC,
    bulldozer: CUTSCENE3_BULLDOZER_SRC,
    curious:   CUTSCENE3_CURIOUS_SRC,
    nerd:      CUTSCENE3_NERD_SRC,
  };
  const src = cutsceneMap[charName] || CUTSCENE3_NERD_SRC;
  const vid = document.createElement("video");
  vid.src = src;
  vid.style.display = "none";
  vid.preload = "auto";
  document.body.appendChild(vid);
  cutsceneVideo = vid;
  const advance3 = () => { vid.remove(); cutsceneVideo = null; S.screen = "ending"; startEndingVideo(); };
  vid.play().catch(() => advance3());
  vid.onended = advance3;
  vid.onerror = advance3;
}

function startEndingVideo() {
  if (cutsceneVideo) { cutsceneVideo.pause(); cutsceneVideo.remove(); }
  const charName = (S.char ? S.char.name : "NERD").toLowerCase();
  const endingMap = {
    assassin:  ENDING_ASSASSIN_SRC,
    bulldozer: ENDING_BULLDOZER_SRC,
    curious:   ENDING_CURIOUS_SRC,
    nerd:      ENDING_NERD_SRC,
  };
  const src = endingMap[charName] || ENDING_NERD_SRC;
  const vid = document.createElement("video");
  vid.src = src;
  vid.style.display = "none";
  vid.preload = "auto";
  document.body.appendChild(vid);
  cutsceneVideo = vid;
  vid.play().catch(() => {});
  vid.onended = () => {
    vid.remove();
    cutsceneVideo = null;
    stopMusic();
    S.screen = "name";
    S.nameInput = "";
    S.nameFrame = undefined;
  };
}

function drawCutscene() {
  if (cutsceneVideo && cutsceneVideo.readyState >= 2) {
    ctx.drawImage(cutsceneVideo, 0, 0, CFG.W, CFG.H);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    txt("LOADING...", CFG.W/2, CFG.H/2, '24px "ClaudiaShouter"', "#FFE000", "center", false);
  }
  txt("PRESS ENTER TO SKIP", CFG.W - 20, CFG.H - 16, '11px "ClaudiaShouter"', "rgba(255,255,255,0.4)", "right", false);
}

function startCutscene2() {
  if (cutsceneVideo) { cutsceneVideo.pause(); cutsceneVideo.remove(); }
  pauseMusic();
  const charName = (S.char ? S.char.name : "NERD").toLowerCase();
  const cutsceneMap = {
    assassin:  CUTSCENE2_ASSASSIN_SRC,
    bulldozer: CUTSCENE2_BULLDOZER_SRC,
    curious:   CUTSCENE2_CURIOUS_SRC,
    nerd:      CUTSCENE2_NERD_SRC,
  };
  const src = cutsceneMap[charName] || CUTSCENE2_NERD_SRC;
  const vid = document.createElement("video");
  vid.src = src;
  vid.style.display = "none";
  vid.preload = "auto";
  document.body.appendChild(vid);
  cutsceneVideo = vid;
  vid.play().catch(() => {});
  vid.onended = () => {
    S.screen = "level3splash";
    vid.remove();
    cutsceneVideo = null;
    resumeMusic();
  };
}

// ── INPUT ROUTING ─────────────────────────────────────────────
function handleInput() {
  const ok = jp["Enter"] || (S.screen !== "play" && jp["Space"]);
  const L=jp["ArrowLeft"], R=jp["ArrowRight"];
  switch(S.screen){
    case"title":       if(ok) { S.screen="intro"; startIntroVideo(); } break;
    case"charselect":
      if(L) S.charIdx=(S.charIdx-1+4)%4;
      if(R) S.charIdx=(S.charIdx+1)%4;
      if(ok){S.char=CFG.characters[S.charIdx];S.screen="instrcollect";} break;
    case"intro":
      if(ok) { stopIntroVideo(); S.screen = "charselect"; clearJP(); }
      break;
    case"instrcollect": if(ok) S.screen="instravoid"; break;
    case"instravoid":   if(ok){resetPlay();S.screen="play"; startMusic();} break;
    case"level1complete": if(ok){ S.screen="cutscene"; startCutscene(); clearJP(); } break;
    case"level2complete": if(ok){ S.screen="cutscene2"; startCutscene2(); clearJP(); } break;
    case"level2splash":   if(ok){ resetLevel2(); S.screen="play"; clearJP(); } break;
    case"level3splash":   if(ok){ resetLevel3(); S.screen="play"; clearJP(); } break;
    case"level3complete": if(ok){ S.screen="cutscene3"; startCutscene3(); clearJP(); } break;
    case"cutscene":     if(ok){ if(cutsceneVideo){cutsceneVideo.onended=null;cutsceneVideo.pause();cutsceneVideo.remove();cutsceneVideo=null;} resumeMusic(); S.screen="level2splash"; clearJP(); } break;
    case"cutscene2":    if(ok){ if(cutsceneVideo){cutsceneVideo.onended=null;cutsceneVideo.pause();cutsceneVideo.remove();cutsceneVideo=null;} resumeMusic(); S.screen="level3splash"; clearJP(); } break;
    case"cutscene3":    if(ok){ if(cutsceneVideo){cutsceneVideo.onended=null;cutsceneVideo.pause();cutsceneVideo.remove();cutsceneVideo=null;} S.screen="ending"; startEndingVideo(); clearJP(); } break;
    case"ending":       if(ok){ if(cutsceneVideo){cutsceneVideo.onended=null;cutsceneVideo.pause();cutsceneVideo.remove();cutsceneVideo=null;} stopMusic(); S.screen="name"; S.nameInput=""; S.nameFrame=undefined; clearJP(); } break;
    case"win":          if(ok){S.screen="name";S.nameInput="";} break;
    case"leaderboard":  if(ok) S.screen="title"; break;
  }
}

// ── CLICK HANDLING ────────────────────────────────────────────
canvas.addEventListener("click",e=>{
  const r=canvas.getBoundingClientRect();
  const sx=CFG.W/r.width, sy=CFG.H/r.height;
  const mx=(e.clientX-r.left)*sx, my=(e.clientY-r.top)*sy;
  function hit(x,y,w,h){return mx>=x&&mx<=x+w&&my>=y&&my<=y+h;}
  switch(S.screen){
    case"title": if(hit(CFG.W/2-90,378,180,50)) { S.screen="intro"; startIntroVideo(); }
                 if(hit(CFG.W-130, CFG.H-36, 120, 28)) goFullscreen();
                 break;
    case"charselect":{
      const cW=190,gap=16,tw=4*(cW+gap)-gap,sx2=(CFG.W-tw)/2;
      CFG.characters.forEach((_,i)=>{if(hit(sx2+i*(cW+gap),102,cW,250)) S.charIdx=i;});
      if(hit(CFG.W/2-80,388,160,46)){S.char=CFG.characters[S.charIdx];S.screen="instrcollect";}
      break;}
    case"instrcollect": if(hit(CFG.W/2-130,410,260,46)) S.screen="instravoid"; break;
    case"instravoid":   if(hit(CFG.W/2-90,458,180,46)){resetPlay();S.screen="play";} break;
    case"level1complete": if(hit(CFG.W/2-90,CFG.H/2+120,180,44)){ S.screen="cutscene"; startCutscene(); clearJP(); } break;
    case"level2complete": if(hit(CFG.W/2-90,CFG.H/2+120,180,44)){ S.screen="cutscene2"; startCutscene2(); clearJP(); } break;
    case"cutscene2":      if(ok){ if(cutsceneVideo){cutsceneVideo.onended=null;cutsceneVideo.pause();cutsceneVideo.remove();cutsceneVideo=null;} resumeMusic(); S.screen="level3splash"; clearJP(); } break;
    case"level3splash":   if(hit(CFG.W/2-90,CFG.H/2+100,180,44)){ resetLevel3(); S.screen="play"; clearJP(); } break;
    case"level3complete": if(hit(CFG.W/2-90,CFG.H/2+120,180,44)){ S.screen="cutscene3"; startCutscene3(); clearJP(); } break;
    case"level2splash": if(hit(CFG.W/2-90,CFG.H/2+100,180,44)){ resetLevel2(); S.screen="play"; clearJP(); } break;
    case"gameover":     if(hit(CFG.W/2-95,368,190,50)){S.screen="name";S.nameInput="";} break;
    case"win":          if(hit(CFG.W/2-95,390,190,50)){S.screen="name";S.nameInput="";} break;
    case"name":         if(hit(CFG.W/2-60,404,120,44)) submitName(); break;
    case"leaderboard":  if(hit(CFG.W/2-85,470,170,46)) S.screen="title"; break;
  }
});

// ── MAIN LOOP ─────────────────────────────────────────────────
let _lastFrameTime = 0;
const _FRAME_MS = 1000 / 60; // cap at 60fps

function loop(now = 0){
  if (now - _lastFrameTime < _FRAME_MS - 1) { requestAnimationFrame(loop); return; }
  _lastFrameTime = now;
  pollGamepad();
  handleInput();
  if(S.screen==="play") update();
  ctx.clearRect(0,0,CFG.W,CFG.H);

  if(loaded<total){
    ctx.fillStyle="#000"; ctx.fillRect(0,0,CFG.W,CFG.H);
    const p=loaded/total;
    const gr=ctx.createLinearGradient(CFG.W/2-200,0,CFG.W/2+200,0);
    gr.addColorStop(0,"#FFE000"); gr.addColorStop(1,"#FF8800");
    ctx.fillStyle=gr; ctx.fillRect(CFG.W/2-200,CFG.H/2-15,400*p,30);
    ctx.strokeStyle="#FFE000"; ctx.lineWidth=2; ctx.strokeRect(CFG.W/2-200,CFG.H/2-15,400,30);
    ctx.font='bold 22px "ClaudiaShouter"'; ctx.textAlign="center";
    ctx.fillStyle="#FFF"; ctx.fillText("LOADING... "+Math.floor(p*100)+"%",CFG.W/2,CFG.H/2-28);
    ctx.textAlign="left";
  } else {
    switch(S.screen){
      case"title":       drawTitle(); break;
      case"intro":       drawIntro(); break;
      case"charselect":  drawCharSelect(); break;
      case"instrcollect":drawInstrCollect(); break;
      case"instravoid":  drawInstrAvoid(); break;
      case"play":        drawGameplay(); break;
      case"gameover":    drawGameOver(); break;
      case"win":         drawWin(); break;
      case"level1complete":drawLevel1Complete(); break;
      case"level2complete":drawLevel2Complete(); break;
      case"level3complete":drawLevel3Complete(); break;
      case"cutscene":    drawCutscene(); break;
      case"cutscene2":   drawCutscene(); break;
      case"cutscene3":   drawCutscene(); break;
      case"ending":      drawCutscene(); break;
      case"level2splash":drawLevel2Splash(); break;
      case"level3splash":drawLevel3Splash(); break;
      case"name":        drawName(); break;
      case"leaderboard": drawLeaderboard(); break;
    }
  }
  clearJP();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);