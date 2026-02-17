const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");



class Player {
  constructor() {
    this.mouse = { sx: 0, sy: 0, down: false, clicked: false };
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.input = { down: Object.create(null), pressed: Object.create(null), released: Object.create(null) };
    this.vx = 0; this.vy = 0;
    this._bindEvents();

    this.inventory = {
        items: [], // array of {type, quantity}
        selectedIndex: 0,
        flowers: []
    }
    this.tools = {};
  }
  init(toolDefs){
    for(const def of toolDefs){
        this.tools[def.type] = def;
    }
  }
  _bindEvents() {
    const c = canvas;
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      this.mouse.sx = e.clientX - r.left;
      this.mouse.sy = e.clientY - r.top;
    });
    c.addEventListener("mousedown", () => { this.mouse.down = true; this.mouse.clicked = true; });
    window.addEventListener("mouseup", () => { this.mouse.down = false; });

    window.addEventListener("keydown", (e) => {
      if (!this.input.down[e.key]) this.input.pressed[e.key] = true;
      this.input.down[e.key] = true;
    });
    window.addEventListener("keyup", (e) => {
      this.input.down[e.key] = false;
      this.input.released[e.key] = true;
    });
  }

  beginFrame() {
    this.input.pressed = Object.create(null);
    this.input.released = Object.create(null);
    this.mouse.clicked = false;
  }

  isDown(key) { return !!this.input.down[key]; }
  wasPressed(key) { return !!this.input.pressed[key]; }
  wasReleased(key) { return !!this.input.released[key]; }

  screenToWorld(sx, sy) { return { wx: sx + this.camera.x, wy: sy + this.camera.y }; }
  mouseWorld() { return this.screenToWorld(this.mouse.sx, this.mouse.sy); }

  update(dt) {
    // example camera pan from arrow keys
    const speed = 300;
    let dx = 0, dy = 0;
    if (this.isDown("ArrowLeft") || this.isDown("a")) dx -= 1;
    if (this.isDown("ArrowRight") || this.isDown("d")) dx += 1;
    if (this.isDown("ArrowUp") || this.isDown("w")) dy -= 1;
    if (this.isDown("ArrowDown") || this.isDown("s")) dy += 1;
    if (dx || dy) { this.camera.x += dx * speed * dt; this.camera.y += dy * speed * dt; }
  }
  clickedOn(x, y, hitboxSize = 20) {
    const { wx, wy } = this.mouseWorld();
    return Math.abs(wx - x) <= hitboxSize && Math.abs(wy - y) <= hitboxSize;
  }
}

class SceneManager {
  constructor(defs, startId) {
    this.defs = defs;
    this.id = null;
    this.scene = null;
    this.t = 0;
    this.state = {};
    this._events = [];
    this.clickables = []
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
  at(timeSec, fn) {
    this._events.push({ t: timeSec, fn, fired: false });
    this._events.sort((a,b)=>a.t-b.t);
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
  drawBackground(ctx) {
    if (this.scene?.drawBackground) this.scene.drawBackground(this, ctx);
  }
  drawWorld(ctx, camera) {
    if (this.scene?.drawWorld) this.scene.drawWorld(this, ctx, camera);
  }
  drawOverlay(ctx) {
    if (this.scene?.drawOverlay) this.scene.drawOverlay(this, ctx);
  }
  goto(id, payload) { this.set(id, payload); }
  clearClickables() {
    this.clickables.length = 0;
  }
  registerClickable(c){
    this.clickables.push(c);
  }
  handleClick(g) {
    const { player } = g;
    if (!player.mouse.clicked) return;

    const ptScreen = { x: player.mouse.sx, y: player.mouse.sy };
    const w = player.screenToWorld(ptScreen.x, ptScreen.y);
    const ptWorld = { x: w.wx, y: w.wy };

    const list = this.clickables.slice().sort((a,b)=> (b.z - a.z || ((b._order ?? 0) - (a._order ?? 0))));
    for (const c of list) {
        const pt = (c.space === "screen") ? ptScreen : ptWorld;
        if (c.hitTest(pt.x, pt.y)) {
            c.onClick({
                g,
                player,
                world: g.world,
                sm: this,
                target: c,
                ptWorld,
                ptScreen
            });
            return true;
        }
    }
    return false;
  }
}

// --- Constants & Utilities ---
const tileSize = 10;
const chunkSize = 16;
const visibleChunks = 3;

function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function clampByte(n) { return Math.max(0, Math.min(255, n | 0)); }
function hash2i(x, y, seed = 1337) {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 1442695041);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
function noise2D(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
function worldToTile(wx, wy) { return { tx: Math.floor(wx / tileSize), ty: Math.floor(wy / tileSize) }; }
function tileToChunk(tx, ty) { return { cx: Math.floor(tx / chunkSize), cy: Math.floor(ty / chunkSize) }; }
function localInChunk(tx, ty, cx, cy) { return { lx: tx - cx * chunkSize, ly: ty - cy * chunkSize }; }

class Chunk {
  constructor(cx, cy, size) {
    this.cx = cx;
    this.cy = cy;
    this.size = size;
    this.tiles = [];
    this.decorated = false;
  }

  generateProcedural() {
    this.tiles = [];
    const baseSurfaceY = 35;
    const dirtDepth = 8;
    for (let y = 0; y < this.size; y++) {
      const row = [];
      const worldTY = this.cy * this.size + y;

      for (let lx = 0; lx < this.size; lx++) {
        const worldTX = this.cx * this.size + lx;
        if (worldTY < baseSurfaceY) {
          row.push(0);
        } else if (worldTY === baseSurfaceY) {
          row.push(1); // grass
        } else if (worldTY <= baseSurfaceY + dirtDepth) {
          row.push(2); // dirt
        } else {
          row.push(3); // stone
        }
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
    if (type === 0) {
      this.edits.delete(editKey);
    } else {
      this.edits.set(editKey, type);
    }
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
  shouldHaveTree(tx, ty) {
    const groundType = this.getTile(tx, ty);
    if (groundType !== 1) return false; // only on grass
    const aboveType = this.getTile(tx, ty - 1);
    if (aboveType !== 0) return false;
    const noiseVal = noise2D(tx * 0.1, ty * 0.1);
    return noiseVal > 0.6; // adjust threshold for density
  }
  ensureTree(tx, ty) {
    if (this.shouldHaveTree(tx, ty)) {
      const wx = tx * tileSize + tileSize / 2;
      const wy = ty * tileSize;
      const tree = new TreeEntity(wx, wy);
      entities.add(tree);
    }
  }
  shouldHaveFlower(tx, ty) {
    const groundType = this.getTile(tx, ty);
    if (groundType !== 1) return false;
    const aboveType = this.getTile(tx, ty - 1);
    if (aboveType !== 0) return false;
    const noiseVal = noise2D(tx * 0.2 + 100, ty * 0.2 + 100);
    return noiseVal > 0.7; // adjust threshold for density
  }
  ensureFlower(tx, ty) {
    if (!this.shouldHaveFlower(tx, ty)) return;
    const wx = tx * tileSize + tileSize / 2;
    const wy = ty * tileSize;
    const flower = new FlowerEntity(wx, wy);
    entities.add(flower);
  }
  decorateChunk(cx, cy) {
    const chunk = this.getOrCreateChunk(cx, cy);
    if (chunk.decorated) return;
    chunk.decorated = true;
    for (let ly = 0; ly < chunk.size; ly++) {
      for (let lx = 0; lx < chunk.size; lx++) {
        const worldTX = cx * chunk.size + lx;
        const worldTY = cy * chunk.size + ly;
        this.ensureTree(worldTX, worldTY);
        this.ensureFlower(worldTX, worldTY);
      }
    }
  }
  tileCenterToWorld(tx, ty) {
    return { wx: tx * tileSize + tileSize / 2, wy: ty * tileSize + tileSize / 2 };
  }
}
class Entity {
    constructor(wx, wy, clickable, z){
        this.wx = wx; this.wy = wy;
        this.clickable = clickable; //boolean
        this.z = z;
        
        this.vx = 0;this.vy = 0;
        this.rotation = 0;
        this.scale = 0;
        this.alive = true;
    }
    initialize(scene){
        if (this.clickable) scene.clickable.push(this);
    }
    update(dt) {
        this.wx += this.vx * dt;
        this.wy += this.vy * dt;
    }
    draw(ctx, camera) {} 
}
class FlowerEntity extends Entity {
    constructor(wx, wy, clickable, z){
        this.wx = wx;
        this.wy = wy;
        this.clickable = clickable ?? true;
        this.z = z ?? 1;
        super(wx, wy, this.clickable, this.z);
        this.hitboxSize = 10;
        this.hitbox = {x: this.wx - this.hitboxSize/2, y: this.wy - this.hitboxSize, width: this.hitboxSize, height: this.hitboxSize};

        this.seed = hash2i(wx, wy, 4242);


        this.color = this.randomColor();
    }
    initialize(scene, flowerLimits){
        if (this.clickable) scene.clickable.push(this);

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
        petalShapeId: this.petalShapeId,
        leafShapeId: this.leafShapeId,
        color: this.color
      };
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
    pickFrom(obj) {
        const keys = Object.keys(obj);
        return obj[keys[Math.floor(this.rand() * keys.length)]];
    }
    pickKey(obj) {
    const keys = Object.keys(obj);
        return keys[Math.floor(this.rand() * keys.length)];
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

  hitTest(pt) {
    const dx = pt.x - this.wx;
    const dy = pt.y - this.wy;
    return (dx*dx + dy*dy) <= 10000;
  }
  onClick() {
    if (this.mode !== "growing") {
        this.explode();
    }
  }
  register(sm){
    sm.registerClickable(this);
  }
  explode() {

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

//

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
const messageQueue = [];
function startMessages() {
  let i = 0;
  MSG.show(messageQueue[i], { speed: 85 });

  return () => {
    if (!MSG.done) { MSG.advance(); return; }
    i++;
    if (i < messageQueue.length) MSG.show(messageQueue[i], { speed: 85 });
  };
}
//




//
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

let externalImgs = []
const imgCat = new Image();
imgCat.src = "cat.jpg";
externalImgs.push(imgCat);

const entities = new Set();
const player = new Player();

function init() {}

function loop(now) {
  if (!loop.last) loop.last = now;
  const dt = Math.min(0.05, (now - loop.last) / 1000);
  loop.last = now;
  
  SM.update(dt);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
