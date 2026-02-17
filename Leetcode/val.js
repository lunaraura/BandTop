//global
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
class SceneManager {
  constructor(defs, startId) {
    this.defs = defs;
    this.id = null;
    this.scene = null;
    this.t = 0;
    this.state = {};
    this._events = [];
    this.set(startId);
  }

  set(id, payload = {}) {
    if (this.scene?.onExit) this.scene.onExit(this, payload);
    this.id = id;
    this.scene = this.defs[id];
    this.t = 0;
    this.state = {};
    this._events = [];
    if (!this.scene) throw new Error(`Unknown scene: ${id}`);
    if (this.scene.onEnter) this.scene.onEnter(this, payload);
  }

  // schedule callbacks relative to scene start
  at(timeSec, fn) {
    this._events.push({ t: timeSec, fn, fired: false });
    this._events.sort((a,b)=>a.t-b.t);
  }

  update(dt) {
    this.t += dt;

    // fire scheduled events
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
}
class Entity {
  constructor(wx, wy) {
    this.wx = wx;
    this.wy = wy;

    this.vx = 0;
    this.vy = 0;

    this.rotation = 0;
    this.scale = 1;

    this.alive = true;
  }

  update(dt) {
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
  }

  draw(ctx, camera) {
    // override in subclasses
  }
}
const pickedFlowers = new Set();
const flowerKey = (tx, ty) => `${tx},${ty}`;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function clampByte(n) {
  return Math.max(0, Math.min(255, n | 0));
}
function hash2i(x, y, seed = 1337) {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 1442695041);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
function noise2D(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
function lerp(a,b,t){ return a + (b-a)*t; }
function fade(t){ return t*t*(3-2*t); }
function noise1D(x, seed=1234){
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const t = fade(x - x0);
  const v0 = ((hash2i(x0, 0, seed) & 0xffff) / 65536) * 2 - 1;
  const v1 = ((hash2i(x1, 0, seed) & 0xffff) / 65536) * 2 - 1;
  return lerp(v0, v1, t);
}
function worldToTile(wx, wy) {
  return { tx: Math.floor(wx / blockSize), ty: Math.floor(wy / blockSize) };
}
function tileToChunk(tx, ty) {
  return { cx: Math.floor(tx / chunkSize), cy: Math.floor(ty / chunkSize) };
}
function localInChunk(tx, ty, cx, cy) {
  return { lx: tx - cx * chunkSize, ly: ty - cy * chunkSize };
}
function tileColor(type, tx, ty) {
  const def = globalBlockPointers[type] || genedBlockDefinitions[0];
  if (!def || !def.color) return "rgba(0,0,0,0)";
  const base = hexToRgb(def.color);
  const v = def.colorVariation || { r: 0, g: 0, b: 0 };
  const h = hash2i(tx, ty, 9001);
  const u1 = (h & 0xffff) / 65536;
  const u2 = ((h >>> 16) & 0xffff) / 65536;
  const r = clampByte(base.r + (u1 - 0.5) * v.r);
  const g = clampByte(base.g + (u2 - 0.5) * v.g);
  const b = clampByte(base.b + (((u1 + u2) * 0.5) - 0.5) * v.b);
  return `rgb(${r},${g},${b})`;
}
function drawVisibleWorld() {
  const minTX = Math.floor(camera.x / blockSize) - 1;
  const minTY = Math.floor(camera.y / blockSize) - 1;
  const maxTX = Math.floor((camera.x + canvas.width) / blockSize) + 1;
  const maxTY = Math.floor((camera.y + canvas.height) / blockSize) + 1;
  for (let ty = minTY; ty <= maxTY; ty++) {
    const sy = ty * blockSize - camera.y;
    for (let tx = minTX; tx <= maxTX; tx++) {
      const type = world.getTile(tx, ty);
      if (type === 0) continue;
      const sx = tx * blockSize - camera.x;
      ctx.fillStyle = tileColor(type, tx, ty);
      ctx.fillRect(sx, sy, blockSize, blockSize);
    }
  }
}
function clamp01(t){ return Math.max(0, Math.min(1, t)); }
function easeOutCubic(t){ t = clamp01(t); return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t){
  t = clamp01(t);
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
}

const backgroundSettings = {
  hills: {
    enabled: true,
    frequency: 0.03,
    color: '#1b6952',
    hillAmplitudes: [200, 100, 50],
    panSpeed: 0.02,
    visible: [],
    visibility: {high: 0.9, low: 0.4, direction: 'down'},
    z: 1
  },
  stars: {
    enabled: true,
    frequency: 0.002,
    color: '#ffffff',
    panSpeed: 0.01,
    visible: [],
    visibility: {high: 0.5, low: 0, direction: 'up'},
    z: 0.5
  },
  trees: {
    enabled: true,
    frequency: 0.005,
    color: '#2e8b57',
    panSpeed: 0.03,
    visible: [],
    visibility: {high: 0.7, low: 0.3, direction: "z"},
    z: 1.5
  }
}
const inventory = {
  toolIndex: 0,
  placeIndex: 0,
  flowers: [],
  blocks: new Map(),
};
function invGet(type){ return inventory.blocks.get(type) ?? 0; }
function invAdd(type, n=1){ inventory.blocks.set(type, invGet(type) + n); }
function invSpend(type, n=1){
  const have = invGet(type);
  if (have < n) return false;
  inventory.blocks.set(type, have - n);
  return true;
}
const PLACEABLE_TYPES = [1,2,3]; // grass,dirt,stone for now (adjust)
const Toolbelt = {
  tools: [],
  get active(){ return this.tools[inventory.toolIndex]; },
  next(){ inventory.toolIndex = (inventory.toolIndex + 1) % this.tools.length; },
  prev(){ inventory.toolIndex = (inventory.toolIndex - 1 + this.tools.length) % this.tools.length; },

  update(dt){
    const t = this.active;
    if (!t) return;

    if (mouse.clicked && t.onClick) t.onClick(dt);
    if (mouse.down && t.onHold) t.onHold(dt);
  },

  drawOverlay(ctx){
    const t = this.active;
    if (t?.drawOverlay) t.drawOverlay(ctx);
  }
};
const ShovelTool = {
  id: "shovel",
  label: "Shovel",

  onClick(){
    const mw = mouseWorld();
    const { tx, ty } = worldToTile(mw.wx, mw.wy);

    const type = world.getTile(tx, ty);
    if (type === 0) return;

    // optional: don't allow digging leaves/trunks etc
    if (!PLACEABLE_TYPES.includes(type)) return;

    // dig it
    world.setTile(tx, ty, 0);
    invAdd(type, 1);
  },

  drawOverlay(ctx){
    const mw = mouseWorld();
    const { tx, ty } = worldToTile(mw.wx, mw.wy);
    const sx = tx * blockSize - camera.x;
    const sy = ty * blockSize - camera.y;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, blockSize, blockSize);
    ctx.restore();
  }
};

// ---------- Tool: Block Placer ----------
const BlockPlacerTool = {
  id: "placer",
  label: "Place Block",

  cycleNext(){
    inventory.placeIndex = (inventory.placeIndex + 1) % PLACEABLE_TYPES.length;
  },

  onClick(){
    const placeType = PLACEABLE_TYPES[inventory.placeIndex];
    if (invGet(placeType) <= 0) return;

    const mw = mouseWorld();
    const { tx, ty } = worldToTile(mw.wx, mw.wy);

    // only place into air
    if (world.getTile(tx, ty) !== 0) return;

    // spend then place
    if (!invSpend(placeType, 1)) return;
    world.setTile(tx, ty, placeType);
  },

  drawOverlay(ctx){
    const placeType = PLACEABLE_TYPES[inventory.placeIndex];
    const mw = mouseWorld();
    const { tx, ty } = worldToTile(mw.wx, mw.wy);

    const sx = tx * blockSize - camera.x;
    const sy = ty * blockSize - camera.y;

    ctx.save();
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = tileColor(placeType, tx, ty);
    ctx.fillRect(sx, sy, blockSize, blockSize);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`${invGet(placeType)}`, sx + 2, sy - 2);
    ctx.restore();
  }
};

const FlowerBouquetTool = {
  id: "flowers",
  label: "Flowers",

  // how many flowers a placed bouquet uses
  bundleSize: 6,

  onClick() {
    const mw = mouseWorld();
    const { tx, ty } = worldToTile(mw.wx, mw.wy);

    // 1) If a flower exists at this tile, pick it
    for (const e of entities) {
      if (e instanceof Flower && e.tx === tx && e.ty === ty) {
        e.alive = false;
        pickedFlowers.add(flowerKey(tx, ty)); // prevents respawn
        inventory.flowers.push(e.exportDrawData?.() ?? { tx, ty, type: "flower" });
        return;
      }
    }

    // 2) Otherwise place a bouquet (if we have flowers)
    if (!inventory.flowers.length) return;

    // Snap placement to tile center (feels consistent with blocks)
    const c = tileCenterWorld(tx, ty);

    // Take last N flowers (or all if fewer)
    const n = Math.min(this.bundleSize, inventory.flowers.length);
    const flowers = inventory.flowers.splice(inventory.flowers.length - n, n);

    entities.add(new Bouquet(c.wx, c.wy, flowers));
  },

  drawOverlay(ctx) {
    if (!inventory.flowers.length) return;

    const n = Math.min(this.bundleSize, inventory.flowers.length);
    const preview = inventory.flowers.slice(inventory.flowers.length - n);

    drawBouquetGhost(ctx, mouse.sx, mouse.sy, preview, {
      maxStems: this.bundleSize,
      fan: 0.7,
      stemLen: 30,
      headR: 6,
      offsetY: 18
    });
  }
};


// ---------- Tool: Heart Wand ----------
const HeartWandTool = {
  id: "hearts",
  label: "Heart Wand",

  onClick(){
    const mw = mouseWorld();

    const n = 4 + (hash2i((mw.wx|0), (mw.wy|0), 123) % 4);
    for (let i = 0; i < n; i++) {
      const vx = (Math.random() - 0.5) * 160;
      const vy = -40 - Math.random() * 120;
      entities.add(new FloatingHeart(mw.wx, mw.wy, {
        vx, vy,
        life: 2.5 + Math.random() * 1.5,
        interaction: "none"
      }));
    }
  }
};
Toolbelt.tools = [ShovelTool, BlockPlacerTool, FlowerBouquetTool, HeartWandTool];
const genedBlockDefinitions = {
  0: { name: "empty", color: "#000000", colorVariation: { r: 0, g: 0, b: 0 } },
  1: { name: "grass", color: "#00cc00", colorVariation: { r: 30, g: 30, b: 30 } },
  2: { name: "dirt",  color: "#964B00", colorVariation: { r: 30, g: 30, b: 30 } },
  3: { name: "stone", color: "#888888", colorVariation: { r: 20, g: 20, b: 20 } },
}
const floraBlockDefinitions = {
  4: { name: "treeTrunk", color: "#8B4513", colorVariation: { r: 20, g: 10, b: 5 } },
  5: { name: "treeLeaves", color: "#228B22", colorVariation: { r: 20, g: 30, b: 20 } },
}
const playerBlockDefinitions = {
  6: { name: "table", color: "#c9a26b", colorVariation: { r: 10, g: 10, b: 10 }, space: { nx: 1, px: 1, ny: 0, py: 2 } },
  7: { name: "heart", color: "#ff66aa", colorVariation: { r: 10, g: 10, b: 10 }, space: { nx: 0, px: 0, ny: 0, py: 0 } },
};
const globalBlockPointers = {
  ...genedBlockDefinitions,
  ...floraBlockDefinitions,
  ...playerBlockDefinitions
}
class Chunk {
  constructor(cx, cy, size) {
    this.cx = cx;
    this.cy = cy;
    this.size = size;
    this.tiles = [];
  }
  generateProcedural() {
    this.tiles = [];
    const baseSurfaceY = 35;
    const heightVariation = 1;
    const grassThickness = 3;
    const dirtDepth = 8;
    for (let y = 0; y < this.size; y++) {
      const row = [];
      const worldTY = this.cy * this.size + y;
      for (let lx = 0; lx < this.size; lx++) {
        const worldTX = this.cx * this.size + lx;
        const surfaceY = Math.floor(
          baseSurfaceY +
          noise2D(worldTX / 300, 0.5) * heightVariation
        );
        let type = 0;
        if (worldTY >= surfaceY - (grassThickness - 1) &&
            worldTY <= surfaceY) {
          type = 1;
        }
        else if (worldTY > surfaceY &&
                worldTY <= surfaceY + dirtDepth) {
          type = 2;
        }
        else if (worldTY > surfaceY + dirtDepth) {
          type = 3;
        }
        else {
          type = 0;
        }
        row.push(type);
      }
      this.tiles.push(row);
    }
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
      decorateChunk(chunk);
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
    const editKey = this.tileKey(tx, ty);

    // Store ALL edits, including 0 = "air"
    this.edits.set(editKey, type);
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
function shouldHaveTree(tx, ty) {
  const groundType = world.getTile(tx, ty);
  const aboveType = world.getTile(tx, ty - 1);

  if (groundType !== 1) return false;
  if (aboveType !== 0) return false;

  const h = hash2i(tx, ty, 999);
  return h % 40 === 0; 
}
function ensureTree(tx, ty) {
  if (!shouldHaveTree(tx, ty)) return;
  if (world.getTile(tx, ty - 1) === 4) return;
  const height = 4 + (hash2i(tx, ty, 1234) % 3);
  for (let i = 1; i <= height; i++) {
    world.setTile(tx, ty - i, 4);
  }
  const topY = ty - height;
  for (let lx = -2; lx <= 2; lx++) {
    for (let ly = -2; ly <= 2; ly++) {
      if (Math.abs(lx) + Math.abs(ly) <= 3) {
        if (world.getTile(tx + lx, topY + ly) === 0) {
          world.setTile(tx + lx, topY + ly, 5);
        }
      }
    }
  }
}
function decorateChunk(chunk) {
  if (chunk.decorated) return;
  chunk.decorated = true;

  const baseTX = chunk.cx * chunk.size;
  const baseTY = chunk.cy * chunk.size;

  for (let ly = 0; ly < chunk.size; ly++) {
    const ty = baseTY + ly;
    for (let lx = 0; lx < chunk.size; lx++) {
      const tx = baseTX + lx;

      if (world.getTile(tx, ty) !== 1) continue;

      ensureTree(tx, ty);
      ensureFlowerAt(tx, ty);
    }
  }
}
function tileCenterWorld(tx, ty) {
  return {
    wx: tx * blockSize + blockSize / 2,
    wy: ty * blockSize + blockSize / 2,
  };
}

function groundScreenYAtCenter() {
  const baseSurfaceY = 35;
  const heightVariation = 1;
  const centerWX = camera.x + canvas.width / 2;
  const centerTX = centerWX / blockSize;
  const surfaceY =
    baseSurfaceY + noise2D(centerTX / 300, 0.5) * heightVariation; // no floor
  return surfaceY * blockSize - camera.y;
}
function backgroundArt(now) {
  const w = canvas.width, h = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#071a2a");
  sky.addColorStop(1, "#0b3b3a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (backgroundSettings.stars.enabled) {
    const s = backgroundSettings.stars;
    const par = s.panSpeed;
    const size = 2; 
    const cols = Math.ceil(w / size);
    const rows = Math.ceil(h / size);
    const ox = camera.x * par;
    const oy = camera.y * par;
    ctx.fillStyle = s.color;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const sx = x + Math.floor(ox / size);
        const sy = y + Math.floor(oy / size);

        const hh = hash2i(sx, sy, 7777);
        const chance = Math.max(0.0005, s.frequency);
        const threshold = Math.floor(1 / chance);
        if (hh % threshold === 0) {
          const b = ((hh >>> 8) & 255) / 255
          const alpha = s.visibility
            ? (s.visibility.low + b * (s.visibility.high - s.visibility.low))
            : (0.2 + b * 0.5);
          ctx.globalAlpha = alpha;
          const px = x * size + (hh & 1);
          const py = y * size + ((hh >>> 1) & 1);
          ctx.fillRect(px, py, 1 + (hh & 1), 1 + ((hh >>> 2) & 1));
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  if (backgroundSettings.hills.enabled) {
    const hill = backgroundSettings.hills;
    const { r, g, b } = hexToRgb(hill.color);
    const w = canvas.width, h = canvas.height;
    const baseline = h * 0.85
    const thickness = 400;
    const freq = hill.frequency ?? 0.004;
    for (let i = hill.hillAmplitudes.length - 1; i >= 0; i--) {
        const amp = hill.hillAmplitudes[i] * 0.35;
        const layerPar = hill.panSpeed * (0.35 + i * 0.25);
        const t = now * 0.00008 * (i + 1);
        const baseY = baseline + i * 20;
        ctx.beginPath();
        ctx.moveTo(0, h + thickness);
        for (let x = 0; x <= w; x++) {
        const nx = (x + camera.x * layerPar) * freq + t;
        const n = noise1D(nx, 1000 + i * 37);
        const y = baseY - n * amp;
        ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h + thickness);
        ctx.closePath();
        const alpha = 0.9 + (i / hill.hillAmplitudes.length) * 0.25;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
    }
  }
}
function cameraCenterWorld() {
  return { wx: camera.x + canvas.width / 2, wy: camera.y + canvas.height / 2 };
}

//
const v2 = {
  add: (a,b)=>({x:a.x+b.x,y:a.y+b.y}),
  sub: (a,b)=>({x:a.x-b.x,y:a.y-b.y}),
  mul: (a,s)=>({x:a.x*s,y:a.y*s}),
  len: (a)=>Math.hypot(a.x,a.y),
  norm: (a)=>{ const l=Math.hypot(a.x,a.y)||1; return {x:a.x/l,y:a.y/l}; },
};

const petalShapes = {
  triangle: [{ x: 0, y: -1 }, { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }],
  heart: [
    { x: 0, y: -1 },
    { x: -0.5, y: -0.5 },
    { x: -0.5, y: 0.5 },
    { x: 0, y: 1 },
    { x: 0.5, y: 0.5 },
    { x: 0.5, y: -0.5 },
  ],
  oval: { arc: { x: 0, y: 0 }, radiusX: 0.5, radiusY: 1 },
  tulip: [
    { x: 0, y: -1 },
    { x: -0.5, y: 0 },
    { x: -0.25, y: 0.5 },
    { x: 0.25, y: 0.5 },
    { x: 0.5, y: 0 },
  ]
}
const leafShapes = {
  oval: {arc: {x: 0, y: 0}, radiusX: 0.5, radiusY: 1},
  pointy: [
    { x: 0, y: -1 },
    { x: -0.5, y: 0.5 },
    { x: 0.5, y: 0.5 },
  ]
}
const flowerLimits = {
  petalCount: { min: 3, max: 8 },
  leafCount: { min: 2, max: 5 },
  stemHeight: { min: 1, max: 3 },
}

class Flower extends Entity {
  constructor(tx, ty) {
    const wx = tx * blockSize + blockSize / 2;
    const wy = ty * blockSize;
    super(wx, wy);

    this.tx = tx;
    this.ty = ty;

    this.seed = hash2i(tx, ty, 4242);

    this.petalCount = this.randomRange(
      flowerLimits.petalCount.min,
      flowerLimits.petalCount.max
    );

    this.leafCount = this.randomRange(
      flowerLimits.leafCount.min,
      flowerLimits.leafCount.max
    );
    this.petalShapeId = this.pickKey(petalShapes);
    this.leafShapeId  = this.pickKey(leafShapes);

    this.stemHeight = this.randomRange(
      flowerLimits.stemHeight.min,
      flowerLimits.stemHeight.max
    );

    this.petalShape = this.pickFrom(petalShapes);
    this.leafShape = this.pickFrom(leafShapes);

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
  pickFrom(obj) {
    const keys = Object.keys(obj);
    return obj[keys[Math.floor(this.rand() * keys.length)]];
  }
  randomColor() {
    const r = 150 + Math.floor(this.rand() * 100);
    const g = 50 + Math.floor(this.rand() * 150);
    const b = 150 + Math.floor(this.rand() * 100);
    return `rgb(${r},${g},${b})`;
  }
  draw(ctx, camera) {
    const screenX = this.wx - camera.x;
    const screenY = this.wy - camera.y;
    ctx.save();

    ctx.strokeStyle = "#2e8b57";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(screenX, screenY - this.stemHeight * blockSize);
    ctx.stroke();

    ctx.fillStyle = this.color;

    const flowerTopY = screenY - this.stemHeight * blockSize;
    const radius = blockSize * 0.6;

    for (let i = 0; i < this.petalCount; i++) {
      const angle = (Math.PI * 2 * i) / this.petalCount;
      const px = screenX + Math.cos(angle) * radius;
      const py = flowerTopY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.arc(px, py, blockSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(screenX, flowerTopY, blockSize * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
  exportDrawData() {
    return {
      type: "flower",
      tx: this.tx,
      ty: this.ty,
      petalCount: this.petalCount,
      leafCount: this.leafCount,
      stemHeight: this.stemHeight,
      petalShapeId: this.petalShapeId,
      leafShapeId: this.leafShapeId,
      color: this.color
    };
  }

  pickKey(obj) {
  const keys = Object.keys(obj);
    return keys[Math.floor(this.rand() * keys.length)];
  }
}
function ensureFlowerAt(tx, ty) {
  if (pickedFlowers.has(flowerKey(tx, ty))) return;

  const type = world.getTile(tx, ty);
  const above = world.getTile(tx, ty - 1);

  if (type !== 1) return;
  if (above !== 0) return;

  const h = hash2i(tx, ty, 5555);
  if (h % 14 !== 0) return;

  for (const e of entities) {
    if (e instanceof Flower && e.tx === tx && e.ty === ty) return;
  }

  entities.add(new Flower(tx, ty));
}
function drawPetalShape(ctx, shapeId, scale = 1) {
  const shape = petalShapes[shapeId] ?? petalShapes.triangle;

  // polygon shapes
  if (Array.isArray(shape)) {
    ctx.beginPath();
    ctx.moveTo(shape[0].x * scale, shape[0].y * scale);
    for (let i = 1; i < shape.length; i++) {
      ctx.lineTo(shape[i].x * scale, shape[i].y * scale);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }

  // oval-ish shapes
  if (shape.arc) {
    ctx.beginPath();
    ctx.ellipse(
      shape.arc.x * scale,
      shape.arc.y * scale,
      shape.radiusX * scale,
      shape.radiusY * scale,
      0, 0, Math.PI * 2
    );
    ctx.fill();
  }
}

function drawFlowerStamp(ctx, f, opts = {}) {
  const {
    headR = 6,          // overall size in px
    centerR = 2.2,
    petalOffset = 0.9,  // how far petals sit from center (in headR units)
    petalScale = 3.2,   // size of each petal shape (in px-ish)
  } = opts;

  const petalCount = f.petalCount ?? 6;
  const shapeId = f.petalShapeId ?? "triangle";

  // petals
  ctx.save();
  ctx.fillStyle = f.color ?? "rgb(220,120,220)";

  for (let i = 0; i < petalCount; i++) {
    const a = (Math.PI * 2 * i) / petalCount;
    const px = Math.cos(a) * headR * petalOffset;
    const py = Math.sin(a) * headR * petalOffset;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    drawPetalShape(ctx, shapeId, petalScale);
    ctx.restore();
  }

  // center
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(0, 0, centerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
function findSurfaceTYAtTX(tx, startTY, maxScan = 200) {
  // Scan downward for the first non-air tile
  for (let ty = startTY; ty < startTY + maxScan; ty++) {
    if (world.getTile(tx, ty) !== 0) return ty; // solid
  }
  return null;
}

function snapWorldYToGround(wx, wy) {
  const { tx, ty } = worldToTile(wx, wy);
  const surfaceTY = findSurfaceTYAtTX(tx, ty);
  if (surfaceTY == null) return wy; // fallback if nothing found
  return surfaceTY * blockSize; // top of the surface tile (matches your Flower base)
}
class CatFace extends Entity {
  constructor(wx, wy) {
    wy = snapWorldYToGround(wx, wy);
    super(wx, wy);

    this.emoji = "😼";
    this.fontPx = 28;

    this.speed = 70;          // px/s
    this.turn = 6;            // steering strength
    this.wanderRadius = 260;  // around camera center

    this.tx = wx; // target world x
    this.ty = wy; // target world y

    this.bobT = Math.random() * 10;
    this.pickNewTarget();
  }

  pickNewTarget() {
    const c = cameraCenterWorld();
    const x = c.wx + (Math.random() * 2 - 1) * this.wanderRadius;
    const y = c.wy + (Math.random() * 2 - 1) * (this.wanderRadius * 0.35);

    this.tx = x;
    this.ty = snapWorldYToGround(x, y);
  }

  update(dt) {
    // occasional retarget
    const dxT = this.tx - this.wx;
    const dyT = this.ty - this.wy;
    const d = Math.hypot(dxT, dyT);

    if (d < 18 || Math.random() < dt * 0.15) {
      this.pickNewTarget();
    }

    // steer toward target
    const dir = d > 1e-4 ? { x: dxT / d, y: dyT / d } : { x: 0, y: 0 };
    const desiredVx = dir.x * this.speed;
    const desiredVy = dir.y * this.speed;

    // critically damped-ish blend
    this.vx += (desiredVx - this.vx) * this.turn * dt;
    this.vy += (desiredVy - this.vy) * this.turn * dt;

    // move
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;

    // keep on ground (comment out if you want floating)
    this.wy = snapWorldYToGround(this.wx, this.wy);

    this.bobT += dt;
  }

  draw(ctx, camera) {
    const x = this.wx - camera.x;
    const y = this.wy - camera.y;

    const bob = Math.sin(this.bobT * 3.2) * 2.5;

    ctx.save();
    ctx.font = `${this.fontPx}px system-ui, "Apple Color Emoji", "Segoe UI Emoji"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // tiny shadow so it reads on bright tiles
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "black";
    ctx.fillText(this.emoji, x + 2, y + bob + 2);

    ctx.globalAlpha = 1;
    ctx.fillStyle = "white";
    ctx.fillText(this.emoji, x, y + bob);

    ctx.restore();
  }
}

class BigFlower extends Entity {
  constructor(wx, wy, seed = 91234) {
    wy = snapWorldYToGround(wx, wy);
    super(wx, wy);
    this.seed = seed >>> 0;

    this.nodes = [];
    this.attachments = [];

    this.grow = 0;
    this.growRate = 0.35;
    this.delay = 0;

    // explode state
    this.mode = "growing";      // "growing" | "exploding"
    this.explodeT = 0;          // seconds since explosion
    this.explodeDur = 0.9;      // stems retract over this time
    this.noAttachAfterExplode = true;

    // tuning
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

      if (depth >= 1 && i > 1 && this.rand() < 0.35) {
        const leafAngle = angle + (this.rand() < 0.5 ? -1 : 1) * this.rrange(0.6, 1.2);
        this.attachments.push({
          kind: "leaf",
          node: next,
          angle: leafAngle,
          size: this.rrange(10, 22) * (1 - depth * 0.12),
          color: "#2e8b57",
        });
      }

      if (depth < this.maxDepth && i > 1 && this.rand() < this.branchProb) {
        const sideCount = this.rint(1, 2);
        for (let s = 0; s < sideCount; s++) {
          const sideAngle = angle + this.rrange(-this.branchSpread, this.branchSpread);
          this.growBranch(next, sideAngle, depth + 1);
        }
      }

      current = next;
    }

    this.attachments.push({
      kind: "bud",
      node: current,
      angle,
      size: this.rrange(10, 18) * (1 - depth * 0.08),
      color: "#ffd700",
    });

    if (this.rand() < 0.85) {
      this.attachments.push({
        kind: "petals",
        node: current,
        angle,
        size: this.rrange(16, 26) * (1 - depth * 0.08),
        color: `rgb(${150 + this.rint(0,100)},${50 + this.rint(0,150)},${150 + this.rint(0,100)})`,
      });
    }
  }

  // pick a reasonable click target: the highest grown node (canopy-ish)
  _currentTipNodeIndex() {
    const segCountTotal = Math.max(0, this.nodes.length - 1);
    const segsToDraw = Math.min(segCountTotal, Math.floor(this.grow * segCountTotal));
    return Math.max(0, segsToDraw);
  }

  hitTest(wx, wy) {
    const tipIdx = this._currentTipNodeIndex();
    const tip = this.nodes[tipIdx] ?? this.nodes[0];
    const dx = wx - tip.x;
    const dy = wy - tip.y;
    const r = 38; // clickable radius in world px
    return (dx*dx + dy*dy) <= r*r;
  }

  explode() {
    if (this.mode !== "growing") return;

    this.mode = "exploding";
    this.explodeT = 0;

    // spawn particles from attachments that are currently "grown"
    const tipIdx = this._currentTipNodeIndex();
    for (const a of this.attachments) {
      if (a.node > tipIdx) continue;
      const n = this.nodes[a.node];
      if (!n) continue;

      const count =
        a.kind === "petals" ? 10 :
        a.kind === "leaf"   ? 2 :
        a.kind === "bud"    ? 4 : 1;

      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 260;
        const up = -260 - Math.random() * 220;

        entities.add(new FlowerParticle(n.x, n.y, {
          vx: spread,
          vy: up,
          life: 0.8 + Math.random() * 0.9,
          size: (a.size ?? 14) * (0.35 + Math.random() * 0.35),
          color: a.color ?? "pink",
          shape: (a.kind === "leaf") ? "leaf" : "circle",
          gravity: 480,
          drag: 0.99,
        }));
      }
    }

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
      if (this.explodeT >= this.explodeDur) {
        this.alive = false;
      }
    }
  }

  draw(ctx, camera) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2e8b57";

    const segCountTotal = Math.max(0, this.nodes.length - 1);

    // when exploding, retract from current grown amount down to 0
    let segsToDraw = Math.min(segCountTotal, Math.floor(this.grow * segCountTotal));
    if (this.mode === "exploding") {
      const t = Math.min(1, this.explodeT / this.explodeDur);
      segsToDraw = Math.floor(segsToDraw * (1 - t));
      ctx.globalAlpha = 1 - t * 0.9;
    }

    // stems
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

    // attachments only when not exploding
    if (this.mode === "growing") {
      const aT = Math.max(0, (this.grow - 0.6) / 0.4);
      if (aT > 0) {
        ctx.globalAlpha = aT;

        for (const a of this.attachments) {
          if (a.node > segsToDraw) continue;

          const n = this.nodes[a.node];
          const x = n.x - camera.x;
          const y = n.y - camera.y;

          if (a.kind === "leaf") {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a.angle);
            ctx.fillStyle = a.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, a.size * 0.9, a.size * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (a.kind === "bud") {
            ctx.fillStyle = a.color;
            ctx.beginPath();
            ctx.arc(x, y, a.size * 0.25, 0, Math.PI * 2);
            ctx.fill();
          } else if (a.kind === "petals") {
            const count = 6;
            const radius = a.size * 0.55;
            ctx.fillStyle = a.color;
            for (let i = 0; i < count; i++) {
              const ang = (Math.PI * 2 * i) / count;
              const px = x + Math.cos(ang) * radius;
              const py = y + Math.sin(ang) * radius;
              ctx.beginPath();
              ctx.arc(px, py, a.size * 0.18, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }
}
class FloatingHeart extends Entity {
  constructor(wx, wy, opts = {}) {
    super(wx, wy);

    this.vx = opts.vx ?? 0;
    this.vy = opts.vy ?? -20;

    this.life = opts.life ?? 2.0;
    this.interaction = opts.interaction ?? "none";

    this.radius = opts.radius ?? 18; 
    this.dragStrength = opts.dragStrength ?? 14;
    this.attractStrength = opts.attractStrength ?? 6;

    this._held = false;
    this._holdDx = 0;
    this._holdDy = 0;
  }

  hitTest(wx, wy) {
    const dx = wx - this.wx, dy = wy - this.wy;
    return (dx*dx + dy*dy) <= (this.radius*this.radius);
  }

  update(dt) {
    if (this.life !== Infinity) {
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
    }

    if (this.interaction !== "none") {
      const mw = mouseWorld();

      if (this.interaction === "drag") {
        if (!this._held && mouse.down && this.hitTest(mw.wx, mw.wy)) {
          this._held = true;
          this._holdDx = this.wx - mw.wx;
          this._holdDy = this.wy - mw.wy;
        }
        if (this._held && !mouse.down) this._held = false;

        if (this._held) {
          const tx = mw.wx + this._holdDx;
          const ty = mw.wy + this._holdDy;

          const k = this.dragStrength;
          this.vx += (tx - this.wx) * k * dt;
          this.vy += (ty - this.wy) * k * dt;
        }
      } else if (this.interaction === "attract") {
        const k = this.attractStrength;
        this.vx += (mw.wx - this.wx) * k * dt;
        this.vy += (mw.wy - this.wy) * k * dt;
      }
    }

    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
    this.vx *= 0.97;
    this.vy *= 0.97;

    const t = (this.life === Infinity) ? 0 : (1 - (this.life / 2)); // assumes default 2s
    this.scale = 1 + t * 0.5;
  }

  draw(ctx, camera) {
    const x = this.wx - camera.x;
    const y = this.wy - camera.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(this.scale, this.scale);

    ctx.fillStyle = "pink";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-5, -5, -10, 5, 0, 10);
    ctx.bezierCurveTo(10, 5, 5, -5, 0, 0);
    ctx.fill();

    ctx.restore();
  }
}
class Bouquet extends Entity {
  constructor(wx, wy, flowers) {
    super(wx, wy);
    this.flowers = flowers;
    this.seed = hash2i(wx|0, wy|0, 8888);
  }

  draw(ctx, camera) {
    const sx = this.wx - camera.x;
    const sy = this.wy - camera.y;

    drawBouquetGhost(ctx, sx, sy, this.flowers, {
      maxStems: 8,
      fan: 0.8,
      stemLen: 34,
      headR: 7,
      offsetY: 0,
      // if you later add jitter: seed: this.seed
    });
  }
}
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
    this.gravity = opts.gravity ?? 520; // px/s^2
    this.shape = opts.shape ?? "circle"; // "circle" | "leaf"
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

    const a = Math.max(0, Math.min(1, this.life / 1.2));
    ctx.globalAlpha = a;

    ctx.fillStyle = this.color;

    if (this.shape === "leaf") {
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * 0.9, this.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
function tryClickBigFlower() {
  if (!mouse.clicked) return false;

  const mw = mouseWorld();

  const list = [...entities];
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e instanceof BigFlower && e.hitTest(mw.wx, mw.wy)) {
      e.explode();
      return true;
    }
  }
  return false;
}



function drawBouquetGhost(ctx, sx, sy, flowers, opts = {}) {
  const {
    maxStems = 7,
    fan = 0.55, 
    stemLen = 26,
    stemW = 3,
    headR = 6,
    offsetY = 18,
  } = opts;

  if (!flowers || flowers.length === 0) return;

  const n = Math.min(maxStems, flowers.length);
  const start = flowers.length - n;

  ctx.save();
  ctx.translate(sx, sy + offsetY);

  for (let i = 0; i < n; i++) {
    const f = flowers[start + i];
    const t = (n === 1) ? 0.5 : i / (n - 1);
    const ang = (t - 0.5) * fan;

    ctx.save();
    ctx.translate(0, -stemLen);

    drawFlowerStamp(ctx, f, { headR, centerR: Math.max(2, headR * 0.35) });
    ctx.restore();

  }

  ctx.restore();
}
function drawHUD() {
  const t = Toolbelt.active;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(10, 10, 220, 60);
  ctx.fillStyle = "white";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(`Tool: ${t?.label ?? "none"} (Q/E)`, 18, 32);

  const placeType = PLACEABLE_TYPES[inventory.placeIndex];
  ctx.fillText(`Place: ${globalBlockPointers[placeType]?.name ?? placeType} x${invGet(placeType)} (R)`, 18, 52);
  ctx.restore();
}
class CenterMessageBox {
  constructor() {
    this.visible = false;
    this.text = "";
    this.typed = 0;
    this.timer = 0;
    this.speed = 60; // chars/sec
    this.done = false;

    // layout tuning
    this.wFrac = 0.72;     // fraction of canvas width
    this.maxW = 820;       // clamp
    this.minW = 360;
    this.pad = 18;
    this.corner = 16;

    this.y = 0.26;         // as % of height (under header)
    this.h = 120;          // panel height in px
  }

  show(text, opts = {}) {
    this.text = String(text ?? "");
    this.visible = true;

    this.speed = opts.speed ?? this.speed;
    this.typed = opts.instant ? this.text.length : 0;
    this.timer = 0;
    this.done = opts.instant ? true : (this.text.length === 0);
  }

  hide() {
    this.visible = false;
  }

  // click/space: if typing, finish; else hide (or keep shown, your choice)
  advance({ hideOnDone = false } = {}) {
    if (!this.visible) return;
    if (!this.done) {
      this.typed = this.text.length;
      this.done = true;
      return;
    }
    if (hideOnDone) this.hide();
  }

  update(dt) {
    if (!this.visible || this.done) return;

    this.timer += dt;
    const inc = Math.floor(this.timer * this.speed);
    if (inc > 0) {
      this.timer -= inc / this.speed;
      this.typed = Math.min(this.text.length, this.typed + inc);
      if (this.typed >= this.text.length) this.done = true;
    }
  }

  draw(ctx) {
    if (!this.visible) return;

    const w = canvas.width;
    const h = canvas.height;

    const bw = Math.max(this.minW, Math.min(this.maxW, w * this.wFrac));
    const bh = this.h;

    const x = (w - bw) * 0.5;
    const y = h * this.y; // under header

    ctx.save();

    // panel
    ctx.globalAlpha = 0.92;
    roundRect(ctx, x, y, bw, bh, this.corner);
    ctx.fillStyle = "rgba(10,10,12,0.70)";
    ctx.fill();
    ctx.globalAlpha = 1;

    // border
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    roundRect(ctx, x, y, bw, bh, this.corner);
    ctx.stroke();

    // text
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const shown = this.text.slice(0, this.typed);

    // wrap centered
    drawWrappedTextCentered(ctx, shown, x + bw / 2, y + this.pad, bw - this.pad * 2, 24);

    // subtle “continue” hint when done
    if (this.done) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("click / space", x + bw / 2, y + bh - 14);
    }

    ctx.restore();
  }
}
function drawWrappedTextCentered(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;

  for (let i = 0; i < words.length; i++) {
    const test = line ? (line + " " + words[i]) : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = words[i];
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function drawWrappedText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(/\s+/);
  let line = "";
  let yy = y;

  for (let i = 0; i < words.length; i++) {
    const test = line ? (line + " " + words[i]) : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = words[i];
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

//

const world = new World();
function updateEntities(dt) {
  for (const e of entities) e.update(dt);
  for (const e of entities) if (!e.alive) entities.delete(e);
}

function drawEntities() {
  const sorted = [...entities].sort((a, b) => a.wy - b.wy);
  for (const e of sorted) e.draw(ctx, camera);
}
const camSpeed = 300;

//
const messageQueue = [
  "Happy Valentine's Day!",
  "I made you a little garden.",
  "Click the big flowers to pop them.",
  "That's it 🙂"
];
function startMessages() {
  let i = 0;
  MSG.show(messageQueue[i], { speed: 85 });

  return () => {
    // when user advances:
    if (!MSG.done) { MSG.advance(); return; } // finishes typing
    i++;
    if (i < messageQueue.length) MSG.show(messageQueue[i], { speed: 85 });
  };
}

let advanceStory = null;
const MSG = new CenterMessageBox();
const scenes = {
  valentine: {
    onEnter(sm) {
      camera.x = -canvas.width / 2;
      camera.y = -canvas.height / 2;

      // place some big flowers relative to screen center
      const centerWX = camera.x + canvas.width / 2;
      const baseWY   = camera.y + canvas.height * 0.78;

      const spots = [-220, -80, 80, 220];

      spots.forEach((dx, i) => {
        const bf = new BigFlower(centerWX + dx, baseWY, 9000 + i * 123);
        bf.delay = i * 0.45;
        bf.growRate = 0.28 + i * 0.04;
        entities.add(bf);
      });
      advanceStory = startMessages();
      sm.at(0.2, () => sm.state.heartTimer = 0);
    },

    update(sm, dt) {
      MSG.update(dt);
      sm.state.heartTimer = (sm.state.heartTimer ?? 0) + dt;
      if (sm.state.heartTimer > 0.12) {
        sm.state.heartTimer = 0;
        const cx = (Math.random()-0.5) * 400 + camera.x + canvas.width / 2;
        const cy = (Math.random()-0.5) * 300 + camera.y + canvas.height * 0.62;
        const vx = (Math.random() - 0.5) * 120;
        const vy = -60 - Math.random() * 120;

        entities.add(new FloatingHeart(cx, cy, { vx, vy, life: 2.8 + Math.random() * 1.2 }));
      }
    },

    drawWorld(sm, ctx, camera) {
    },
    drawOverlay(sm, ctx) {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "48px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Happy Valentine's Day!", canvas.width / 2, canvas.height * 0.18);
      ctx.restore();
      MSG.draw(ctx);
    }

  }
};
const SM = new SceneManager(scenes, "valentine");
imgCat.onload = () => {
  console.log("loaded");
};
const handdrawnFlowerMesh = {
  stem: {
    vertices: [
      { x: 0, y: 12 }, { x: 1, y: 11 }, { x: 1, y: 0 },
      { x: 2, y: 0 }, { x: 2, y: 3 }, { x: 3, y: 3 },
      { x: 0, y: -10 },
      { x: -3, y: 3 }, { x: -2, y: 3 }, { x: -2, y: 0 },
      { x: -1, y: 0 }, { x: -1, y: 11 }, { x: 0, y: 12 },
    ],
    // pick an anchor point for rotation (base of stem feels right)
    anchor: { x: 0, y: 12 }
  }

}
function transformVerts(verts, opts) {
  const {
    x = 0, y = 0,               // screen offset
    scale = 1,
    angle = 0,
    anchor = { x: 0, y: 0 },    // local-space pivot
  } = opts;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return verts.map(v => {
    const lx = (v.x - anchor.x) * scale;
    const ly = (v.y - anchor.y) * scale;

    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;

    return { x: x + rx, y: y + ry };
  });
}

function drawPoly(ctx, pts, { fill, stroke, lineWidth = 1, close = true } = {}) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawExtra(now) {
  const catX = 150;
  const catY = canvas.height / 2;

  ctx.drawImage(imgCat, catX, catY, 128, 180);

  const stem = handdrawnFlowerMesh.stem;

  const angle = Math.sin(now * 0.0015) * 0.15;
  const scale = 1.8;

  const baseX = catX + 140;
  const baseY = catY + 140;

  const stemPts = transformVerts(stem.vertices, {
    x: baseX,
    y: baseY,
    scale,
    angle,
    anchor: stem.anchor
  });

  ctx.save();
  drawPoly(ctx, stemPts, {
    fill: "rgba(40,140,70,0.75)",
    stroke: "rgba(20,70,35,0.9)",
    lineWidth: 3
  });
  ctx.restore();
}
function loop(now) {
  if (!loop.last) loop.last = now;
  const dt = Math.min(0.05, (now - loop.last) / 1000);
  loop.last = now;

  const lockCam = !!SM.scene?.lockCamera;

  if (!lockCam) {
    if (Input.isDown("a") || Input.isDown("ArrowLeft"))  camera.x -= camSpeed * dt;
    if (Input.isDown("d") || Input.isDown("ArrowRight")) camera.x += camSpeed * dt;
    if (Input.isDown("w") || Input.isDown("ArrowUp"))    camera.y -= camSpeed * dt;
    if (Input.isDown("s") || Input.isDown("ArrowDown"))  camera.y += camSpeed * dt;
  }
  if (mouse.clicked || Input.wasPressed(" ")) {
    if (advanceStory) advanceStory();
  }


  if (Input.wasPressed("q")) Toolbelt.prev();
  if (Input.wasPressed("e")) Toolbelt.next();
  if (Input.wasPressed("r") && Toolbelt.active === BlockPlacerTool) BlockPlacerTool.cycleNext();

  SM.update(dt);

  world.manageVisibleChunks(camera.x + canvas.width / 2, camera.y + canvas.height / 2);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  backgroundArt(now);
  drawVisibleWorld();

  if (SM.scene?.drawWorld) SM.scene.drawWorld(SM, ctx, camera);
  const clickedBigFlower = tryClickBigFlower();
  if (!clickedBigFlower) {
    Toolbelt.update(dt);
  }

  updateEntities(dt);
  drawEntities();

  Toolbelt.drawOverlay(ctx);
  drawHUD();
  drawExtra(now);

  SM.drawOverlay(ctx);

  Input.beginFrame();
  mouse.clicked = false;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
