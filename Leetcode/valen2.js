// ============================================================
// ONE-FILE MERGE EXAMPLE
// - Keeps your global-style setup
// - Adds SceneManager click routing (one-shot)
// - Entities can register themselves as clickables each frame
// - Clickables win by z, then by registration order
// - Tools only run if click was not consumed
// ============================================================

// ------------------ globals ------------------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const imgCat = new Image();
imgCat.src = "cat.jpg";

const entities = new Set();

const camera = { x: -window.innerWidth / 2, y: -window.innerHeight / 2 };
const blockSize = 10;
const chunkSize = 16;
const visibleChunks = 3;

const mouse = { sx: 0, sy: 0, down: false, clicked: false };
function mouseWorld() {
  return { wx: mouse.sx + camera.x, wy: mouse.sy + camera.y };
}

// ------------------ input ------------------
canvas.addEventListener("mousedown", () => { mouse.down = true; mouse.clicked = true; });
window.addEventListener("mouseup", () => { mouse.down = false; });
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.sx = e.clientX - r.left;
  mouse.sy = e.clientY - r.top;
});

const Input = {
  down: Object.create(null),
  pressed: Object.create(null),
  released: Object.create(null),
  beginFrame() {
    this.pressed = Object.create(null);
    this.released = Object.create(null);
  },
  isDown(k) { return !!this.down[k]; },
  wasPressed(k) { return !!this.pressed[k]; },
  wasReleased(k) { return !!this.released[k]; },
};

window.addEventListener("keydown", (e) => {
  if (!Input.down[e.key]) Input.pressed[e.key] = true;
  Input.down[e.key] = true;
});
window.addEventListener("keyup", (e) => {
  Input.down[e.key] = false;
  Input.released[e.key] = true;
});

// ------------------ resize ------------------
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ============================================================
// SceneManager with click routing
// ============================================================
class SceneManager {
  constructor(defs, startId) {
    this.defs = defs;
    this.id = null;
    this.scene = null;
    this.t = 0;
    this.state = {};
    this._events = [];

    this.clickables = [];
    this._orderCounter = 0;

    this.set(startId);
  }

  set(id, payload = {}) {
    if (this.scene?.onExit) this.scene.onExit(this, payload);
    this.id = id;
    this.scene = this.defs[id];
    this.t = 0;
    this.state = {};
    this._events = [];
    this.clearClickables();
    if (!this.scene) throw new Error(`Unknown scene: ${id}`);
    if (this.scene.onEnter) this.scene.onEnter(this, payload);
  }

  at(timeSec, fn) {
    this._events.push({ t: timeSec, fn, fired: false });
    this._events.sort((a, b) => a.t - b.t);
  }

  update(dt) {
    this.t += dt;
    for (const ev of this._events) {
      if (!ev.fired && this.t >= ev.t) {
        ev.fired = true;
        ev.fn(this);
      }
    }
    if (this.scene?.update) this.scene.update(this, dt);
  }

  drawWorld(ctx, camera) {
    if (this.scene?.drawWorld) this.scene.drawWorld(this, ctx, camera);
  }
  drawOverlay(ctx) {
    if (this.scene?.drawOverlay) this.scene.drawOverlay(this, ctx);
  }
  goto(id, payload) { this.set(id, payload); }

  // ---- click system ----
  clearClickables() {
    this.clickables.length = 0;
    this._orderCounter = 0;
  }

  registerClickable(c) {
    // contract:
    // c.z number
    // c.space "world" | "screen" (default "world")
    // c.hitTest(pt) => boolean where pt = {x,y}
    // c.onClick(ctx) => returns false to NOT consume
    if (c._order == null) c._order = ++this._orderCounter;
    if (c.space == null) c.space = "world";
    if (c.z == null) c.z = 0;
    this.clickables.push(c);
  }

  handleClick() {
    if (!mouse.clicked) return false;

    const ptScreen = { x: mouse.sx, y: mouse.sy };
    const mw = mouseWorld();
    const ptWorld = { x: mw.wx, y: mw.wy };

    const list = this.clickables
      .slice()
      .sort((a, b) => (b.z - a.z) || ((b._order ?? 0) - (a._order ?? 0)));

    for (const c of list) {
      const pt = (c.space === "screen") ? ptScreen : ptWorld;
      if (c.hitTest && c.hitTest(pt)) {
        const consumed = (c.onClick?.({
          sm: this,
          ptWorld,
          ptScreen,
          mouse,
          camera,
          world,
          entities,
          inventory,
          Toolbelt
        }) !== false);
        if (consumed) return true;
      }
    }
    return false;
  }
}

// ============================================================
// Base Entity with optional registration
// ============================================================
class Entity {
  constructor(wx, wy) {
    this.wx = wx;
    this.wy = wy;

    this.vx = 0;
    this.vy = 0;

    this.rotation = 0;
    this.scale = 1;

    this.alive = true;

    // click metadata (optional)
    this.z = 0;
    this.space = "world";
  }

  update(dt) {
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
  }

  draw(ctx, camera) {}

  // If subclass implements hitTest+onClick, it becomes clickable automatically
  register(sm) {
    if (this.hitTest && this.onClick) sm.registerClickable(this);
  }
}

// ============================================================
// World + helpers (keep your existing implementations)
// ============================================================

// --- stubs here; paste your real functions/classes ---
function worldToTile(wx, wy) { return { tx: Math.floor(wx / blockSize), ty: Math.floor(wy / blockSize) }; }
function tileToChunk(tx, ty) { return { cx: Math.floor(tx / chunkSize), cy: Math.floor(ty / chunkSize) }; }
function localInChunk(tx, ty, cx, cy) { return { lx: tx - cx * chunkSize, ly: ty - cy * chunkSize }; }

function hash2i(x, y, seed = 1337) {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 1442695041);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
function noise2D(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

class Chunk {
  constructor(cx, cy, size) {
    this.cx = cx;
    this.cy = cy;
    this.size = size;
    this.tiles = [];
    this.decorated = false;
  }
  generateProcedural() {
    // paste your procedural gen here
    this.tiles = Array.from({ length: this.size }, () => Array(this.size).fill(0));
  }
}

class World {
  constructor() {
    this.generatedChunks = new Map();
    this.visibleChunkKeys = new Set();
    this.edits = new Map();
  }
  chunkKey(cx, cy) { return `${cx},${cy}`; }
  tileKey(tx, ty) { return `${tx},${ty}`; }

  getOrCreateChunk(cx, cy) {
    const key = this.chunkKey(cx, cy);
    let chunk = this.generatedChunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cy, chunkSize);
      chunk.generateProcedural();
      this.generatedChunks.set(key, chunk);
      // if you decorate via tiles or entities, do it here
      // decorateChunk(chunk);
    }
    return chunk;
  }

  getTile(tx, ty) {
    const editKey = this.tileKey(tx, ty);
    if (this.edits.has(editKey)) return this.edits.get(editKey);

    const { cx, cy } = tileToChunk(tx, ty);
    const chunk = this.getOrCreateChunk(cx, cy);
    const { lx, ly } = localInChunk(tx, ty, cx, cy);
    const row = chunk.tiles[ly];
    return row ? row[lx] ?? 0 : 0;
  }

  setTile(tx, ty, type) {
    this.edits.set(this.tileKey(tx, ty), type);
  }

  manageVisibleChunks(centerWorldX, centerWorldY) {
    const { tx, ty } = worldToTile(centerWorldX, centerWorldY);
    const { cx: centerCX, cy: centerCY } = tileToChunk(tx, ty);

    const newVisible = new Set();
    for (let cy = centerCY - visibleChunks; cy <= centerCY + visibleChunks; cy++) {
      for (let cx = centerCX - visibleChunks; cx <= centerCX + visibleChunks; cx++) {
        const key = this.chunkKey(cx, cy);
        newVisible.add(key);
        this.getOrCreateChunk(cx, cy);
      }
    }
    this.visibleChunkKeys = newVisible;
  }
}

const world = new World();

// paste your drawVisibleWorld(), backgroundArt(), tileColor(), etc.
// For this merged example we keep them as placeholders:
function backgroundArt(now) {
  ctx.fillStyle = "#0b3b3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function drawVisibleWorld() {
  // paste your tile drawing
}

// ============================================================
// Inventory + Toolbelt (keep your real tools; only loop order changes)
// ============================================================
const inventory = {
  toolIndex: 0,
  placeIndex: 0,
  flowers: [],
  blocks: new Map(),
};

const PLACEABLE_TYPES = [1,2,3];

function invGet(type){ return inventory.blocks.get(type) ?? 0; }
function invAdd(type, n=1){ inventory.blocks.set(type, invGet(type) + n); }
function invSpend(type, n=1){
  const have = invGet(type);
  if (have < n) return false;
  inventory.blocks.set(type, have - n);
  return true;
}

const Toolbelt = {
  tools: [],
  get active(){ return this.tools[inventory.toolIndex]; },
  next(){ inventory.toolIndex = (inventory.toolIndex + 1) % this.tools.length; },
  prev(){ inventory.toolIndex = (inventory.toolIndex - 1 + this.tools.length) % this.tools.length; },

  update(dt){
    const t = this.active;
    if (!t) return;
    // click and hold can coexist; click is one-shot (mouse.clicked)
    if (mouse.clicked && t.onClick) t.onClick(dt);
    if (mouse.down && t.onHold) t.onHold(dt);
  },

  drawOverlay(ctx){
    const t = this.active;
    if (t?.drawOverlay) t.drawOverlay(ctx);
  }
};

// paste your real tool definitions here; these are minimal stubs:
const ShovelTool = { id:"shovel", label:"Shovel", onClick(){} };
const BlockPlacerTool = { id:"placer", label:"Place", onClick(){}, cycleNext(){} };
const FlowerBouquetTool = { id:"flowers", label:"Flowers", onClick(){}, drawOverlay(){} };
const HeartWandTool = { id:"hearts", label:"Hearts", onClick(){} };

Toolbelt.tools = [ShovelTool, BlockPlacerTool, FlowerBouquetTool, HeartWandTool];

// ============================================================
// Clickable entities: Flower + BigFlower
// (these show the “concept merge”)
// ============================================================

const pickedFlowers = new Set();
const flowerKey = (tx, ty) => `${tx},${ty}`;

function tileCenterWorld(tx, ty) {
  return { wx: tx * blockSize + blockSize / 2, wy: ty * blockSize + blockSize / 2 };
}

function findSurfaceTYAtTX(tx, startTY, maxScan = 200) {
  for (let ty = startTY; ty < startTY + maxScan; ty++) {
    if (world.getTile(tx, ty) !== 0) return ty;
  }
  return null;
}
function snapWorldYToGround(wx, wy) {
  const { tx, ty } = worldToTile(wx, wy);
  const surfaceTY = findSurfaceTYAtTX(tx, ty);
  if (surfaceTY == null) return wy;
  return surfaceTY * blockSize;
}

// minimal flower “stamp data”
const flowerLimits = {
  petalCount: { min: 3, max: 8 },
  leafCount: { min: 2, max: 5 },
  stemHeight: { min: 1, max: 3 },
};

class Flower extends Entity {
  constructor(tx, ty) {
    const wx = tx * blockSize + blockSize / 2;
    const wy = ty * blockSize;
    super(wx, wy);

    this.tx = tx;
    this.ty = ty;

    this.z = 5;

    this.seed = hash2i(tx, ty, 4242);
    this.petalCount = this.randomRange(flowerLimits.petalCount.min, flowerLimits.petalCount.max);
    this.leafCount  = this.randomRange(flowerLimits.leafCount.min,  flowerLimits.leafCount.max);
    this.stemHeight = this.randomRange(flowerLimits.stemHeight.min, flowerLimits.stemHeight.max);
    this.color = this.randomColor();
  }

  rand() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967295;
  }
  randomRange(min, max) {
    return Math.floor(this.rand() * (max - min + 1)) + min;
  }
  randomColor() {
    const r = 150 + Math.floor(this.rand() * 100);
    const g = 50 + Math.floor(this.rand() * 150);
    const b = 150 + Math.floor(this.rand() * 100);
    return `rgb(${r},${g},${b})`;
  }

  exportDrawData() {
    return {
      type: "flower",
      tx: this.tx,
      ty: this.ty,
      petalCount: this.petalCount,
      leafCount: this.leafCount,
      stemHeight: this.stemHeight,
      color: this.color
    };
  }

  // clickable
  hitTest(pt) {
    const r = blockSize * 0.9;
    const dx = pt.x - this.wx;
    const dy = pt.y - (this.wy - this.stemHeight * blockSize * 0.6);
    return (dx*dx + dy*dy) <= r*r;
  }

  onClick() {
    // only pick when flower tool active (keeps your semantics)
    if (Toolbelt.active !== FlowerBouquetTool) return false;

    this.alive = false;
    pickedFlowers.add(flowerKey(this.tx, this.ty));
    inventory.flowers.push(this.exportDrawData());
    return true;
  }

  draw(ctx, camera) {
    const x = this.wx - camera.x;
    const y = this.wy - camera.y;
    ctx.save();
    ctx.strokeStyle = "#2e8b57";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - this.stemHeight * blockSize);
    ctx.stroke();

    const topY = y - this.stemHeight * blockSize;
    ctx.fillStyle = this.color;
    const radius = blockSize * 0.6;
    for (let i = 0; i < this.petalCount; i++) {
      const a = (Math.PI * 2 * i) / this.petalCount;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a)*radius, topY + Math.sin(a)*radius, blockSize*0.3, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(x, topY, blockSize*0.25, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// v2 utility used by BigFlower
const v2 = {
  add: (a,b)=>({x:a.x+b.x,y:a.y+b.y}),
  mul: (a,s)=>({x:a.x*s,y:a.y*s}),
};

class FlowerParticle extends Entity {
  constructor(wx, wy, opts = {}) {
    super(wx, wy);
    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? -200;
    this.life = opts.life ?? 1.2;
    this.rot = opts.rot ?? 0;
    this.vrot = opts.vrot ?? (Math.random() - 0.5) * 8;
    this.size = opts.size ?? 6;
    this.color = opts.color ?? "pink";
    this.drag = opts.drag ?? 0.9;
    this.gravity = opts.gravity ?? 520;
    this.shape = opts.shape ?? "circle";
    this.z = 2; // under flowers/bigflower
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.vy += this.gravity * dt;
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
    const damp = Math.pow(this.drag, dt * 60);
    this.vx *= damp;
    this.vy *= damp;
    this.rot += this.vrot * dt;
  }

  draw(ctx, camera) {
    const x = this.wx - camera.x;
    const y = this.wy - camera.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = Math.max(0, Math.min(1, this.life / 1.2));
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class BigFlower extends Entity {
  constructor(wx, wy, seed = 91234) {
    wy = snapWorldYToGround(wx, wy);
    super(wx, wy);

    this.z = 10; // top priority clickable

    this.seed = seed >>> 0;
    this.nodes = [];
    this.attachments = [];
    this.grow = 0;
    this.growRate = 0.35;
    this.delay = 0;

    this.mode = "growing";
    this.explodeT = 0;
    this.explodeDur = 0.9;

    this.maxDepth = 5;
    this.maxSegmentsPerBranch = 10;
    this.baseLen = 3;
    this.lenJitter = 0.25;
    this.branchProb = 0.35;
    this.branchSpread = Math.PI * 0.35;
    this.trunkUpAngle = -Math.PI / 2;

    this.generate();
  }

  rand() {
    let s = this.seed | 0;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.seed = s >>> 0;
    return (this.seed >>> 0) / 4294967295;
  }
  rrange(a, b) { return a + (b - a) * this.rand(); }
  rint(a, b) { return Math.floor(this.rrange(a, b + 1)); }

  generate() {
    this.nodes.length = 0;
    this.attachments.length = 0;
    const root = this.addNode(this.wx, this.wy, 6, -1);
    this.growBranch(root, this.trunkUpAngle, 0);
  }
  addNode(x, y, r, parent) {
    const idx = this.nodes.length;
    this.nodes.push({ x, y, r, parent });
    return idx;
  }

  growBranch(parentIdx, parentAngle, depth) {
    let current = parentIdx;
    let angle = parentAngle;

    const segCount = this.rint(5, this.maxSegmentsPerBranch);
    for (let i = 0; i < segCount; i++) {
      angle += this.rrange(-0.12, 0.12);

      const len = this.baseLen * this.rrange(1 - this.lenJitter, 1 + this.lenJitter);
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };

      const from = this.nodes[current];
      const toPos = v2.add(from, v2.mul(dir, len));

      const taper = 1 - (depth * 0.18) - (i / segCount) * 0.35;
      const radius = Math.max(1.5, from.r * taper);

      const next = this.addNode(toPos.x, toPos.y, radius, current);
      current = next;
    }
  }

  _currentTipNodeIndex() {
    const segCountTotal = Math.max(0, this.nodes.length - 1);
    const segsToDraw = Math.min(segCountTotal, Math.floor(this.grow * segCountTotal));
    return Math.max(0, segsToDraw);
  }

  // clickable
  hitTest(pt) {
    const tipIdx = this._currentTipNodeIndex();
    const tip = this.nodes[tipIdx] ?? this.nodes[0];
    const dx = pt.x - tip.x;
    const dy = pt.y - tip.y;
    const r = 38;
    return (dx*dx + dy*dy) <= r*r;
  }

  onClick() {
    this.explode();
    return true;
  }

  explode() {
    if (this.mode !== "growing") return;
    this.mode = "exploding";
    this.explodeT = 0;

    const tipIdx = this._currentTipNodeIndex();
    const tip = this.nodes[tipIdx] ?? this.nodes[0];

    for (let i = 0; i < 18; i++) {
      const ang = (Math.PI * 2 * i) / 18;
      entities.add(new FlowerParticle(tip.x, tip.y, {
        vx: Math.cos(ang) * (120 + Math.random() * 160),
        vy: -180 + Math.sin(ang) * (80 + Math.random() * 120),
        life: 0.7 + Math.random() * 0.6,
        size: 6 + Math.random() * 8,
        color: "rgba(255,160,200,1)",
        gravity: 720,
        drag: 0.86
      }));
    }
  }

  update(dt) {
    if (this.delay > 0) { this.delay -= dt; return; }

    if (this.mode === "growing") {
      this.grow = Math.min(1, this.grow + this.growRate * dt);
    } else if (this.mode === "exploding") {
      this.explodeT += dt;
      if (this.explodeT >= this.explodeDur) this.alive = false;
    }
  }

  draw(ctx, camera) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2e8b57";

    const segCountTotal = Math.max(0, this.nodes.length - 1);
    let segsToDraw = Math.min(segCountTotal, Math.floor(this.grow * segCountTotal));

    if (this.mode === "exploding") {
      const t = Math.min(1, this.explodeT / this.explodeDur);
      segsToDraw = Math.floor(segsToDraw * (1 - t));
      ctx.globalAlpha = 1 - t * 0.9;
    }

    for (let i = 1; i <= segsToDraw; i++) {
      const n = this.nodes[i];
      const p = this.nodes[n.parent];
      const x1 = p.x - camera.x, y1 = p.y - camera.y;
      const x2 = n.x - camera.x, y2 = n.y - camera.y;
      ctx.lineWidth = Math.max(1, n.r * 0.6);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ============================================================
// Entities update/draw (add z-sort if you want)
// ============================================================
function updateEntities(dt) {
  for (const e of entities) e.update(dt);
  for (const e of entities) if (!e.alive) entities.delete(e);
}
function drawEntities() {
  // you can sort by wy for nice layering; click is handled separately by z
  const sorted = [...entities].sort((a, b) => a.wy - b.wy);
  for (const e of sorted) e.draw(ctx, camera);
}

// ============================================================
// HUD / extra art (paste your real versions)
// ============================================================
function drawHUD() {
  const t = Toolbelt.active;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(10, 10, 220, 40);
  ctx.fillStyle = "white";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`Tool: ${t?.label ?? "none"} (Q/E)`, 18, 32);
  ctx.restore();
}
function drawExtra(now) {
  if (!imgCat.complete) return;
  ctx.drawImage(imgCat, 150, canvas.height / 2, 128, 180);
}

// ============================================================
// Scene example (keep yours; this is minimal)
// ============================================================
const scenes = {
  valentine: {
    onEnter(sm) {
      camera.x = -canvas.width / 2;
      camera.y = -canvas.height / 2;

      // spawn big flowers
      const centerWX = camera.x + canvas.width / 2;
      const baseWY = camera.y + canvas.height * 0.78;
      const spots = [-220, -80, 80, 220];
      spots.forEach((dx, i) => {
        const bf = new BigFlower(centerWX + dx, baseWY, 9000 + i * 123);
        bf.delay = i * 0.45;
        bf.growRate = 0.28 + i * 0.04;
        entities.add(bf);
      });

      // spawn a couple click-pick flowers as demo
      for (let i = 0; i < 12; i++) {
        const tx = (hash2i(i, 7, 11) % 80) - 40;
        const ty = 35;
        entities.add(new Flower(tx, ty));
      }
    },
    update(sm, dt) {},
    drawWorld(sm, ctx, camera) {},
    drawOverlay(sm, ctx) {}
  }
};

const SM = new SceneManager(scenes, "valentine");

// ============================================================
// main loop (the important part)
// ============================================================
const camSpeed = 300;

function loop(now) {
  if (!loop.last) loop.last = now;
  const dt = Math.min(0.05, (now - loop.last) / 1000);
  loop.last = now;

  // camera movement (unless scene locks it)
  const lockCam = !!SM.scene?.lockCamera;
  if (!lockCam) {
    if (Input.isDown("a") || Input.isDown("ArrowLeft"))  camera.x -= camSpeed * dt;
    if (Input.isDown("d") || Input.isDown("ArrowRight")) camera.x += camSpeed * dt;
    if (Input.isDown("w") || Input.isDown("ArrowUp"))    camera.y -= camSpeed * dt;
    if (Input.isDown("s") || Input.isDown("ArrowDown"))  camera.y += camSpeed * dt;
  }

  // tool hotkeys
  if (Input.wasPressed("q")) Toolbelt.prev();
  if (Input.wasPressed("e")) Toolbelt.next();
  if (Input.wasPressed("r") && Toolbelt.active === BlockPlacerTool) BlockPlacerTool.cycleNext?.();

  // update scene + world streaming
  SM.update(dt);
  world.manageVisibleChunks(camera.x + canvas.width / 2, camera.y + canvas.height / 2);

  // draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  backgroundArt(now);
  drawVisibleWorld();
  SM.drawWorld(ctx, camera);

  // ---- rebuild click targets each frame ----
  SM.clearClickables();

  // entities register themselves if they are clickable
  for (const e of entities) e.register(SM);

  // optional: scene-level UI can register clickables too
  // SM.scene?.registerClickables?.(SM);

  // ---- one-shot click routing ----
  const consumed = SM.handleClick();

  // tools run only if click not consumed
  if (!consumed) Toolbelt.update(dt);

  updateEntities(dt);
  drawEntities();

  Toolbelt.drawOverlay(ctx);
  drawHUD();
  drawExtra(now);
  SM.drawOverlay(ctx);

  // end-of-frame resets
  Input.beginFrame();
  mouse.clicked = false;

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
