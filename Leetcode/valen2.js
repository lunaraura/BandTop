const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ---------------- Player ----------------
class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { sx: 0, sy: 0, down: false, clicked: false };
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.input = {
      down: Object.create(null),
      pressed: Object.create(null),
      released: Object.create(null),
    };

    this.inventory = { items: [], selectedIndex: 0, flowers: [] };
    this.tools = {};

    this._bindEvents();
  }

  init(toolDefs) {
    for (const def of toolDefs) this.tools[def.type] = def;
  }

  _bindEvents() {
    const c = this.canvas;

    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      this.mouse.sx = e.clientX - r.left;
      this.mouse.sy = e.clientY - r.top;
    });

    c.addEventListener("mousedown", () => {
      this.mouse.down = true;
      this.mouse.clicked = true; // one-shot (cleared in beginFrame)
    });

    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });

    window.addEventListener("keydown", (e) => {
      if (!this.input.down[e.key]) this.input.pressed[e.key] = true;
      this.input.down[e.key] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.input.down[e.key] = false;
      this.input.released[e.key] = true;
    });
  }

  // call at END of frame
  beginFrame() {
    this.input.pressed = Object.create(null);
    this.input.released = Object.create(null);
    this.mouse.clicked = false;
  }

  isDown(key) { return !!this.input.down[key]; }
  wasPressed(key) { return !!this.input.pressed[key]; }
  wasReleased(key) { return !!this.input.released[key]; }

  // If you keep zoom, do the correct transforms now:
  screenToWorld(sx, sy) {
    const z = this.camera.zoom || 1;
    return {
      wx: sx / z + this.camera.x,
      wy: sy / z + this.camera.y,
    };
  }

  worldToScreen(wx, wy) {
    const z = this.camera.zoom || 1;
    return {
      sx: (wx - this.camera.x) * z,
      sy: (wy - this.camera.y) * z,
    };
  }

  mouseWorld() {
    return this.screenToWorld(this.mouse.sx, this.mouse.sy);
  }

  update(dt) {
    const speed = 300;
    let dx = 0, dy = 0;
    if (this.isDown("ArrowLeft") || this.isDown("a")) dx -= 1;
    if (this.isDown("ArrowRight") || this.isDown("d")) dx += 1;
    if (this.isDown("ArrowUp") || this.isDown("w")) dy -= 1;
    if (this.isDown("ArrowDown") || this.isDown("s")) dy += 1;
    if (dx || dy) {
      this.camera.x += dx * speed * dt;
      this.camera.y += dy * speed * dt;
    }
  }
}

// ---------------- SceneManager (click resolver) ----------------
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
    if (!this.scene) throw new Error(`Unknown scene: ${id}`);

    this.t = 0;
    this.state = {};
    this._events = [];
    this.clearClickables();

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
    this.scene?.update?.(this, dt);
  }

  drawBackground(ctx) { this.scene?.drawBackground?.(this, ctx); }
  drawWorld(ctx, camera) { this.scene?.drawWorld?.(this, ctx, camera); }
  drawOverlay(ctx) { this.scene?.drawOverlay?.(this, ctx); }

  goto(id, payload) { this.set(id, payload); }

  clearClickables() {
    this.clickables.length = 0;
    this._orderCounter = 0;
  }

  // contract: { z, space: "world"|"screen", hitTest(pt)->bool, onClick(ctx)->(false to passthrough) }
  registerClickable(c) {
    if (c._order == null) c._order = ++this._orderCounter;
    this.clickables.push(c);
  }

  handleClick(g) {
    const { player } = g;
    if (!player.mouse.clicked) return false;

    const ptScreen = { x: player.mouse.sx, y: player.mouse.sy };
    const w = player.screenToWorld(ptScreen.x, ptScreen.y);
    const ptWorld = { x: w.wx, y: w.wy };

    const list = this.clickables
      .slice()
      .sort((a, b) => (b.z - a.z) || ((b._order ?? 0) - (a._order ?? 0)));

    for (const c of list) {
      const pt = (c.space === "screen") ? ptScreen : ptWorld;
      if (c.hitTest(pt)) {
        const consumed = c.onClick({
          g,
          player,
          world: g.world,
          sm: this,
          target: c,
          ptWorld,
          ptScreen
        }) !== false;
        if (consumed) return true;
      }
    }
    return false;
  }
}

// ---------------- Entities ----------------
class Entity {
  constructor(wx, wy, { clickable = false, z = 0, space = "world" } = {}) {
    this.wx = wx;
    this.wy = wy;
    this.vx = 0;
    this.vy = 0;

    this.clickable = clickable;
    this.z = z;
    this.space = space;

    this.rotation = 0;
    this.scale = 1;
    this.alive = true;
  }

  update(dt) {
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
  }

  draw(ctx, camera) {}

  // opt-in registration
  register(sm) {
    if (this.clickable) sm.registerClickable(this);
  }
}

// Example flower: fix super() ordering + click API
class FlowerEntity extends Entity {
  constructor(wx, wy, opts = {}) {
    super(wx, wy, { clickable: opts.clickable ?? true, z: opts.z ?? 1, space: "world" });

    this.seed = hash2i(wx | 0, wy | 0, 4242);
    this.hitboxSize = 10;
    this.color = this.randomColor();

    // you can set these later via init, but set defaults so draw() doesn't explode
    this.petalCount = 6;
    this.stemHeight = 2;
  }

  rand() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967295;
  }

  randomColor() {
    const r = 150 + Math.floor(this.rand() * 100);
    const g = 50 + Math.floor(this.rand() * 150);
    const b = 150 + Math.floor(this.rand() * 100);
    return `rgb(${r},${g},${b})`;
  }

  hitTest(pt) {
    // simple square hitbox in WORLD space
    return (
      Math.abs(pt.x - this.wx) <= this.hitboxSize &&
      Math.abs(pt.y - this.wy) <= this.hitboxSize
    );
  }

  onClick({ g }) {
    // example: pick flower, mark dead, etc.
    // this.alive = false;
    // g.player.inventory.flowers.push(...)
  }

  draw(ctx, camera) {
    // NOTE: you referenced blockSize; use tileSize or define blockSize.
    const blockSize = tileSize;

    const x = this.wx - camera.x;
    const y = this.wy - camera.y;

    ctx.save();
    ctx.strokeStyle = "#2e8b57";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - this.stemHeight * blockSize);
    ctx.stroke();

    ctx.fillStyle = this.color;
    const topY = y - this.stemHeight * blockSize;
    const radius = blockSize * 0.6;

    for (let i = 0; i < this.petalCount; i++) {
      const a = (Math.PI * 2 * i) / this.petalCount;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * radius, topY + Math.sin(a) * radius, blockSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(x, topY, blockSize * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// BigFlower: standardize hitTest(pt) + onClick() logic + register()
class BigFlower extends Entity {
  constructor(wx, wy, seed = 91234) {
    super(wx, wy, { clickable: true, z: 10, space: "world" });

    this.seed = seed >>> 0;
    this.nodes = [];
    this.attachments = [];

    this.grow = 0;
    this.growRate = 0.35;
    this.delay = 0;

    this.mode = "growing";
    this.explodeT = 0;
    this.explodeDur = 0.9;

    // TODO: you reference v2, snapWorldYToGround, FlowerParticle elsewhere.
    // Keep your existing generate() etc.

    // this.generate();
  }

  hitTest(pt) {
    const dx = pt.x - this.wx;
    const dy = pt.y - this.wy;
    const r = 80;
    return dx * dx + dy * dy <= r * r;
  }

  onClick() {
    // FIX: explode only if currently growing
    if (this.mode === "growing") this.explode();
  }

  explode() {
    this.mode = "exploding";
    this.explodeT = 0;
    // spawn particles as you already do...
  }
}

// ---------------- Utilities you already had ----------------
const tileSize = 10;
const chunkSize = 16;
const visibleChunks = 3;

function hash2i(x, y, seed = 1337) {
  let h = (x * 374761393) ^ (y * 668265263) ^ (seed * 1442695041);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
function noise2D(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

// ---------------- Game loop skeleton (the missing part) ----------------
const entities = new Set();
const player = new Player(canvas);

// stub scenes so this file runs; replace with your real scenes
const scenes = {
  valentine: {
    onEnter(sm) {
      // spawn demo clickables
      entities.add(new BigFlower(200, 200));
      entities.add(new FlowerEntity(260, 240));
    },
    update(sm, dt) {},
    drawBackground(sm, ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
    drawWorld(sm, ctx, camera) {}
  }
};

const SM = new SceneManager(scenes, "valentine");

// minimal world stub so handleClick ctx has g.world
const world = {}; // replace with your World()

function updateEntities(dt) {
  for (const e of entities) e.update(dt);
  for (const e of [...entities]) if (!e.alive) entities.delete(e);
}

function drawEntities() {
  const sorted = [...entities].sort((a, b) => (a.wy - b.wy) || (a.z - b.z));
  for (const e of sorted) e.draw(ctx, player.camera);
}

function loop(now) {
  if (!loop.last) loop.last = now;
  const dt = Math.min(0.05, (now - loop.last) / 1000);
  loop.last = now;

  // update input-driven camera, then scene
  player.update(dt);
  SM.update(dt);

  // rebuild clickable list for this frame
  SM.clearClickables();
  // scene can register UI clickables here if you want:
  // SM.scene?.collectClickables?.({ player, world, SM, entities });

  for (const e of entities) e.register(SM);

  // resolve one-shot click
  const consumed = SM.handleClick({ player, world, SM, entities });

  // draw
  SM.drawBackground(ctx);
  SM.drawWorld(ctx, player.camera);
  drawEntities();
  SM.drawOverlay(ctx);

  // end-of-frame: clear one-shots
  player.beginFrame();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
