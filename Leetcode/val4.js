const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const blockSize = 10;
const chunkSize = 16;
const backgroundSettings = {
  hills: { enabled: true, frequency: 0.03, 
    colors: {midnight: "#144234", noon: "#2aa165", sunset: "#7f8d46"},
    hillAmplitudes: [500, 100, 50], panSpeed: 0.02, baseHeight: 0.6 },
  stars: { enabled: true, frequency: 400,
    colors:{midnight: "#ffffff", noon: "#aaf2ff", sunset: "#ff4500"}, panSpeed: 0.01 },
  trees: { enabled: true, frequency: 0.005,
    colors: {midnight: "#2e8b57", noon: "#66cdaa", sunset: "#ff4500"}, panSpeed: 0.03, baseHeight: 0.4 },
  mountains: { enabled: true, frequency: 0.01,
    colors: {midnight: "#302011", noon: "#a0522d", sunset: "#ff4500"}, panSpeed: 0.015, baseHeight: 0.5 },
  sun: { enabled: true, colors:
    {midnight: "#000000", noon: "#ffff1d", sunset: "#c54719"}, panSpeed: 0.05 },
  sky: { enabled: true, colors: {
        midnight: {top: "#001d3d", bottom: "#000000"},
        noon: {top: "#87dceb", bottom: "#ffffff"},
        sunset: {top: "#ff7e5f", bottom: "#feb47b"}
    }},
};
const timeSettings = {
    dayColorTransition: 0.01, // how quickly the background transitions between day/night colors
    dayNightCycleSpeed: 0.00001, // how quickly time progresses (affects sun position and color)
    sunSize: 50, // radius of the sun
    sunPathHeight: 150, // how high the sun arcs in the sky
    timeOpacities: {
        day: {hills: 0.8, stars: 0.0, trees: 0.9, mountains: 0.7, sun: 1.0},
        night: {hills: 0.5, stars: 1.0, trees: 0.6, mountains: 0.4, sun: 0.0},
        sunset: {hills: 0.7, stars: 0.5, trees: 0.8, mountains: 0.6, sun: 1.0},
    },
    timeOpacityTransition: 0.01, // how quickly the opacity transitions between day/night settings
};
const petalShapes = { triangle: [{x:0,y:-1},{x:-0.5,y:0.5},{x:0.5,y:0.5}], oval: { arc:{x:0,y:0}, radiusX:0.5, radiusY:1 } };
const leafShapes = { oval: { arc:{x:0,y:0}, radiusX:0.5, radiusY:1 } };
const flowerLimits = { petalCount:{min:3,max:8}, leafCount:{min:2,max:5}, stemHeight:{min:1,max:3} };
const genedBlockDefinitions = {
  0: { name: "empty", color: "#000000", colorVariation: { r: 0, g: 0, b: 0 } },
  1: { name: "grass", color: "#00cc00", colorVariation: { r: 30, g: 30, b: 30 } },
  2: { name: "dirt", color: "#964B00", colorVariation: { r: 30, g: 30, b: 30 } },
  3: { name: "stone", color: "#888888", colorVariation: { r: 20, g: 20, b: 20 } }
};
const floraBlockDefinitions = {
  4: { name: "treeTrunk", color: "#8B4513", colorVariation: { r: 20, g: 10, b: 5 } },
  5: { name: "treeLeaves", color: "#228B22", colorVariation: { r: 20, g: 30, b: 20 } }
};
const playerBlockDefinitions = {
  6: { name: "table", color: "#c9a26b", colorVariation: { r: 10, g: 10, b: 10 } },
  7: { name: "heart", color: "#ff66aa", colorVariation: { r: 10, g: 10, b: 10 } }
};
const globalBlockPointers = { ...genedBlockDefinitions, ...floraBlockDefinitions, ...playerBlockDefinitions };
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ----------------- utils -----------------
function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
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
function lerp(a, b, t) { return a + (b - a) * t; }
function fade(t) { return t * t * (3 - 2 * t); }
function noise1D(x, seed = 1234) {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const t = fade(x - x0);
  const v0 = ((hash2i(x0, 0, seed) & 0xffff) / 65536) * 2 - 1;
  const v1 = ((hash2i(x1, 0, seed) & 0xffff) / 65536) * 2 - 1;
  return lerp(v0, v1, t);
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
const v2 = {
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    mul: (v, s) => ({ x: v.x * s, y: v.y * s }),
};
function snapToBlock(wx) { return Math.floor(wx / blockSize) * blockSize; }
function snapToGrid(wx, wy) {
  return { wx: Math.floor(wx / blockSize) * blockSize, wy: Math.floor(wy / blockSize) * blockSize };
}
class SceneManager {
    constructor(defs, startId, player) {
    this.defs = defs;
    this.id = null;
    this.scene = null;
    this.t = 0;
    this.state = {};
    this._events = [];
    this.clickables = new Set();
    this.entities = new Set();
    this.player = player;
    this.set(startId);
    this.drawer = new Drawer(player.camera, canvas, this);
  }
  set(id, payload = {}) {
    if (this.scene?.onExit) this.scene.onExit(this, payload);
    this.id = id;
    this.scene = this.defs[id];
    this.t = 0;
    this.state = {};
    this._events = [];
    if (!this.scene) throw new Error(`Unknown scene: ${id}`);
    if (this.scene.onEnter) this.scene.onEnter(this, this.player, payload);
    this.reloadClickables();
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
  draw(now) {
    if (this.scene?.draw) this.scene.draw(this, now);
  }
  reloadClickables() {
    this.clickables.clear();
    for (const e of this.entities) e.addToClickable?.(this);
    if (this.scene?.addClickables) this.scene.addClickables(this);
  }
  goto(id, payload) { this.set(id, payload); }
}
class World {
  constructor() {
    this.chunks = new Map();
    this.visibleChunks = []; 
  }
  key(cx, cy) { return `${cx},${cy}`; }
  getChunk(cx, cy) {
    const k = this.key(cx, cy);
    if (!this.chunks.has(k)) this.chunks.set(k, new Chunk(cx, cy));
    return this.chunks.get(k);
  }
  worldToChunk(wx, wy) {
    const cx = Math.floor(wx / (chunkSize * blockSize));
    const cy = Math.floor(wy / (chunkSize * blockSize));
    return { cx, cy };
  }
  updateVisible(camera, spawnEntity = null) {
    const minCX = Math.floor(camera.x / (chunkSize * blockSize)) - 1;
    const minCY = Math.floor(camera.y / (chunkSize * blockSize)) - 1;
    const maxCX = Math.floor((camera.x + canvas.width) / (chunkSize * blockSize)) + 1;
    const maxCY = Math.floor((camera.y + canvas.height) / (chunkSize * blockSize)) + 1;
    const visible = [];
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const ch = this.getChunk(cx, cy);
        if (!ch._decorated) {
          ch.decorate(spawnEntity ?? (() => {}));
          ch._decorated = true;
        }
        visible.push(ch);
      }
    }
    this.visibleChunks = visible;
  };
  getBlockAt(wx, wy) {
    const { cx, cy } = this.worldToChunk(wx, wy);
    return this.getChunk(cx, cy).getBlockAt(wx, wy);
  }
  setBlockAt(wx, wy, type) {
    const { cx, cy } = this.worldToChunk(wx, wy);
    this.getChunk(cx, cy).setBlockAt(wx, wy, type);
  }
  removeBlockAt(wx, wy) {
    const { cx, cy } = this.worldToChunk(wx, wy);
    this.getChunk(cx, cy).setBlockAt(wx, wy, null);
  }
}
class Chunk {
  constructor(cx, cy) {
    this.cx = cx;
    this.cy = cy;
    this.blocks = new Map();
    this.floraViable = [];
    this._decorated = false;
    this.generateProcedural();
  }
  _key(wx, wy) {
    const bx = snapToBlock(wx) - this.cx * chunkSize * blockSize;
    const by = snapToBlock(wy) - this.cy * chunkSize * blockSize;
    return `${bx},${by}`;
  }
  getBlockAt(wx, wy) {
    const key = this._key(wx, wy);
    return this.blocks.get(key) ?? null;
  }
  setBlockAt(wx, wy, type) {
    const key = this._key(wx, wy);
    if (type == null || type === 0) this.blocks.delete(key);
    else this.blocks.set(key, { type });
  }
  generateProcedural() {
    const worldX0 = this.cx * chunkSize * blockSize;
    const worldY0 = this.cy * chunkSize * blockSize;
    const grassThicknessPx = 4 * blockSize;
    const dirtDepthPx = 12 * blockSize;
    const start = Math.round(canvas.height / 1.5);
    for (let bx = 0; bx < chunkSize * blockSize; bx += blockSize) {
      let markedTop = false;
      for (let by = 0; by < chunkSize * blockSize; by += blockSize) {
        const wx = worldX0 + bx;
        const wy = worldY0 + by;
        const top = start + noise2D(wx * 0.0025, 0.5) * 15;
        if (wy >= top && wy < top + grassThicknessPx) {
          this.setBlockAt(wx, wy, 1);
          if (!markedTop) {
            markedTop = true;
            this.floraViable.push({ wx, wy });
          }
        } else if (wy >= top + grassThicknessPx && wy < top + grassThicknessPx + dirtDepthPx) {
          this.setBlockAt(wx, wy, 2);
        } else if (wy >= top + grassThicknessPx + dirtDepthPx) {
          this.setBlockAt(wx, wy, 3);
        }
      }
    }
  }
  decorate(spawnEntity) {
    for (const p of this.floraViable) {
      const tx = Math.floor(p.wx / blockSize);
      const ty = Math.floor(p.wy / blockSize);
      const h = hash2i(tx, ty, 7777);
      if ((h % 6) === 0) {
        spawnEntity(new FlowerEntity(tx, ty));
      }
      if ((h % 20) === 0) {
        this._placeTreeAt(p.wx, p.wy);
      }
      if ((h % 10) === 0) {
        spawnEntity(new BigFlower(p.wx + blockSize / 2, p.wy + blockSize / 2, h));
      }
    }
  }
  _placeTreeAt(wx, wy) {
    const hh = hash2i((wx / blockSize) | 0, (wy / blockSize) | 0, 2222);
    const height = 16 + (hh % 4);
    for (let i = 1; i <= height; i++) {
      this.setBlockAt(wx, wy - i * blockSize, 4); 
    }
    const topY = wy - height * blockSize;
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        const man = Math.abs(dx) + Math.abs(dy);
        if (man > 6) continue;  
        if (dx === 0 && dy === 0) continue;
        this.setBlockAt(wx + dx * blockSize, topY + dy * blockSize, 5);
      }
    }
  }
}
class Player {
  constructor() {
    this.sm = null;
    this.camera = { x: 0, y: 0 };
    this.mouse = { sx: 0, sy: 0, down: false, clicked: false };
    this.input = { down: Object.create(null), pressed: Object.create(null), released: Object.create(null) };
    this._bindEvents();
    this.inventory = {
      toolIndex: 0,
      placeIndex: 1,
      flowers: [],
      blocks: new Map()
    };
    this.bouquetPreview = {
      enabled: true,
      maxStems: 8,
      lastTile: null,
    };
    this.tools = new Toolbelt(this);
    this.holding = [];
  }
  _bindEvents() {
    const c = canvas;
    c.addEventListener("mousemove", (e) => {
      const r = c.getBoundingClientRect();
      this.mouse.sx = e.clientX - r.left;
      this.mouse.sy = e.clientY - r.top;
    });
    c.addEventListener("mousedown", () => { this.mouse.down = true; this.mouse.clicked = true; });
    window.addEventListener("mouseup", () => { this.mouse.down = false; });    window.addEventListener("keydown", (e) => {
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
  screenToWorld(sx, sy) { return { wx: sx + this.camera.x, wy: sy + this.camera.y }; }
  mouseWorld() { return this.screenToWorld(this.mouse.sx, this.mouse.sy); }
  invGet(type) { return this.inventory.blocks.get(type) ?? 0; }
  invAdd(type, n = 1) { this.inventory.blocks.set(type, this.invGet(type) + n); }
  invSpend(type, n = 1) {
    const have = this.invGet(type);
    if (have < n) return false;
    this.inventory.blocks.set(type, have - n);
    return true;
  }
  update(dt) {
    const speed = 300;
    let dx = 0, dy = 0;
    if (this.wasPressed("b")) {
      this.bouquetPreview.enabled = !this.bouquetPreview.enabled;
    }
    if (this.wasPressed("v") && this.sm?.scene) {
      this.tryPlaceBouquet(this.sm.scene);
    }
    if (this.isDown("ArrowLeft") || this.isDown("a")) dx -= 1;
    if (this.isDown("ArrowRight") || this.isDown("d")) dx += 1;
    if (this.isDown("ArrowUp") || this.isDown("w")) dy -= 1;
    if (this.isDown("ArrowDown") || this.isDown("s")) dy += 1;
    if (dx || dy) { this.camera.x += dx * speed * dt; this.camera.y += dy * speed * dt; }    if (this.mouse.clicked && this.sm?.scene) this.tools.useCurrentTool(this.sm.scene);
  }
  tryPlaceBouquet(scene) {
    const mw = this.mouseWorld();
    const tx = Math.floor(mw.wx / blockSize);
    const ty = Math.floor(mw.wy / blockSize);
    if (this.inventory.flowers.length <= 0) return;
    if (scene.getBlockAt(mw.wx, mw.wy)) return;
    //get data from flowers to bouquet
  }
}
class Toolbelt {
  constructor(player) {
    this.player = player;
    this.toolIndex = 0;
    this.tools = {
      0: { name: "Hand", action: (scene) => {
      const { wx, wy } = this.player.mouseWorld();
      for (const ent of scene.clickables) {
        if (ent.hitTest(wx, wy)) { ent.interaction?.(scene, this.player); break; }
      }
      }},
      1: { name: "Shovel", action: (scene) => {
        const { wx, wy } = this.player.mouseWorld();
        const block = scene.getBlockAt(wx, wy);
        if (block) { scene.removeBlockAt(wx, wy); this.player.invAdd(block.type, 1); }
      }},
      2: { name: "Placer", action: (scene) => {
        const { wx, wy } = this.player.mouseWorld();
        const type = this.player.inventory.placeIndex;
        if (type <= 0) return;
        if (this.player.invGet(type) <= 0) return;
        // only place into empty
        if (scene.getBlockAt(wx, wy)) return;
        scene.placeBlockAt(wx, wy, type);
        this.player.invSpend(type, 1);
      }},
      3: { name: "HeartWand", action: (scene) => {
        const { wx, wy } = this.player.mouseWorld();
        scene.addEntity(new HeartEntity(wx, wy));
        const vx = (Math.random() - 0.5) * 380;
        const vy = (Math.random() - 0.5) * 380;
        scene.addEntity(new FloatingHeart(wx, wy, { vx, vy, life: 2.8 + Math.random() * 1.2 }))
      }}
    };
  }
  isCurrentTool(name) { return this.currentTool().name === name; }
  currentTool() { return this.tools[this.toolIndex] ?? this.tools[0]; }
  useCurrentTool(scene) { this.currentTool().action?.(scene); }
}
class Drawer {
  constructor(camera, canvas, sm) {
    this.camera = camera;
    this.canvas = canvas;
    this.sm = sm;
  }
  worldToScreen(wx, wy) { return { sx: wx - this.camera.x, sy: wy - this.camera.y }; }
  drawBackground(now) {
    const w = this.canvas.width, h = this.canvas.height;
    const time = (now * timeSettings.dayNightCycleSpeed) % 1;
    const dayFactor = Math.max(0, Math.cos(time * Math.PI * 2));
    const sunsetFactor = 1 - Math.abs(dayFactor);
    const nightFactor = 1 - dayFactor;
    const topSkyColor = this.blendColors({
        midnight: backgroundSettings.sky.colors.midnight.top,
        noon: backgroundSettings.sky.colors.noon.top,
        sunset: backgroundSettings.sky.colors.sunset.top
    }, dayFactor);
    const bottomSkyColor = this.blendColors({
        midnight: backgroundSettings.sky.colors.midnight.bottom,
        noon: backgroundSettings.sky.colors.noon.bottom,
        sunset: backgroundSettings.sky.colors.sunset.bottom
    }, dayFactor);
    const colorBlendFactor = dayFactor;
    const skyColor = `linear-gradient(${topSkyColor}, ${bottomSkyColor})`;
    ctx.fillStyle = skyColor;
    ctx.fillRect(0, 0, w, h);

    if (backgroundSettings.stars.enabled) {        
        const pan = (time * backgroundSettings.stars.panSpeed * 0.001) % 1;
        const alphaBase = timeSettings.timeOpacities.day.stars ?? 0.5;
        ctx.fillStyle = this.blendColors(backgroundSettings.stars.colors, colorBlendFactor);
        // ctx.globalAlpha = alphaBase * ((dayFactor >= 0.5) ? (1 - dayFactor) / 0.5 : 1);
        for (let i=0; i < backgroundSettings.stars.frequency; i++) {
            const winkle = 0.5 + 1.5 * Math.sin(time * Math.random() * 10);
            const starX = (noise1D(i * 0.1, 2555) + 1) * 0.5 * w + pan * w;
            const starY = (noise1D(i * 0.1, 2556) + 1) * 0.5 * h + pan * h;
            const starSize = Math.max(0.5, noise1D(i * 0.1, 5557) * 1.5  * winkle);
            ctx.beginPath();
            ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    for (const layerKey of ["hills", "mountains", "trees", "stars"]) {
        const layer = backgroundSettings[layerKey];
        if (!layer.enabled) continue;
        const layerColor = this.blendColors(layer.colors, colorBlendFactor);
        ctx.fillStyle = layerColor;
        
        let opacity = timeSettings.timeOpacities.day[layerKey] ?? 0.5;
        if (dayFactor >= 0.5) {
        const t = (1 - dayFactor) / 0.5;
        const nightOp = timeSettings.timeOpacities.night[layerKey] ?? 0.5;
        opacity = timeSettings.timeOpacities.day[layerKey] + (nightOp - timeSettings.timeOpacities.day[layerKey]) * t;
        }
        ctx.globalAlpha = opacity;
        
        this.drawParallaxLayer(layerKey, layer.frequency, layer.panSpeed, w, h);
    }
    ctx.globalAlpha = 1.0;
    if (backgroundSettings.sun.enabled) {
        const sunColor = this.blendColors(backgroundSettings.sun.colors, colorBlendFactor);
        ctx.fillStyle = sunColor;
        const sunX = w * time;
        const sunY = h * 0.5 - Math.sin(time * Math.PI * 2) * timeSettings.sunPathHeight;
        ctx.beginPath();
        ctx.arc(sunX, sunY, timeSettings.sunSize, 0, Math.PI * 2);
        ctx.fill();
    }

  }
  drawParallaxLayer(layerKey, frequency, panSpeed, w, h) {
    const offset = ( panSpeed * 0.01) % w;
    ctx.beginPath();
    let y = h * 0.6;    
    for (let x = -w; x < w * 2; x += 10) {
        const noiseVal = noise2D((x + offset) * frequency, layerKey.charCodeAt(0));
        const waveY = y + noiseVal * 20;
        if (x === -w) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
    }
    ctx.lineTo(w * 2, h);
    ctx.lineTo(-w, h);
    ctx.closePath();
    ctx.fill();
  }
  blendColors(colors, factor) {
    const day = hexToRgb(colors.noon);
    const night = hexToRgb(colors.midnight);
    const sunset = hexToRgb(colors.sunset);
    const r = clampByte(day.r * factor + night.r * (1 - factor) + sunset.r * (1 - Math.abs(0.5 - factor) * 2));
    const g = clampByte(day.g * factor + night.g * (1 - factor) + sunset.g * (1 - Math.abs(0.5 - factor) * 2));
    const b = clampByte(day.b * factor + night.b * (1 - factor) + sunset.b * (1 - Math.abs(0.5 - factor) * 2));
    return `rgb(${r},${g},${b})`;
  }
  drawWorldBlocks(world) {
    for (const ch of world.visibleChunks) {
      const x0 = ch.cx * chunkSize * blockSize;
      const y0 = ch.cy * chunkSize * blockSize;      for (const [k, b] of ch.blocks) {
        const [bx, by] = k.split(",").map(Number);
        const wx = x0 + bx;
        const wy = y0 + by;
        const sx = wx - this.camera.x;
        const sy = wy - this.camera.y;
        if (sx + blockSize < 0 || sy + blockSize < 0 || sx > canvas.width || sy > canvas.height) continue;
        const tx = Math.floor(wx / blockSize);
        const ty = Math.floor(wy / blockSize);
        ctx.fillStyle = tileColor(b.type, tx, ty);
        ctx.fillRect(sx, sy, blockSize, blockSize);
      }
    }
  }
  drawEntities(entities) {
    const sorted = [...entities].sort((a, b) => (a.z - b.z) || (a.wy - b.wy));
    for (const e of sorted) {
        //find kind of entity and draw accordingly
        switch(e.type) {
            case "heart": this.drawHeartEntity(this.camera, e); break;
            case "floatingHeart": this.drawFloatingHeart(this.camera, e); break;
            case "flower": this.drawFlowerEntity(this.camera, e); break;
            case "flowerParticle": this.drawFlowerParticle(this.camera, e); break;
            case "bouquet": this.drawBouquetEntity(this.camera, e); break;
            case "bigFlower": this.drawBigFlower(this.camera, e); break;
        }
    }
  }
  drawFloatingHeart(camera, heart) {
    const x = heart.wx - camera.x;
    const y = heart.wy - camera.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(heart.scale, heart.scale);
    ctx.fillStyle = "pink";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-5, -5, -10, 5, 0, 10);
    ctx.bezierCurveTo(10, 5, 5, -5, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  drawFlowerEntity(camera, flower) {
    const screenX = flower.wx - camera.x;
    const screenY = flower.wy - camera.y;
    ctx.save();
    ctx.strokeStyle = "#2e8b57";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(screenX, screenY - flower.stemHeight * blockSize);
    ctx.stroke();
    ctx.fillStyle = flower.color;
    const flowerTopY = screenY - flower.stemHeight * blockSize;
    const radius = blockSize * 0.6;
    for (let i = 0; i < flower.petalCount; i++) {
      const angle = (Math.PI * 2 * i) / flower.petalCount;
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
  drawHeartEntity(camera, heart) {
    const x = heart.wx - camera.x;
    const y = heart.wy - camera.y;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, heart.life / 1.8));
    ctx.fillStyle = "pink";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 6, y - 6, x - 12, y + 4, x, y + 12);
    ctx.bezierCurveTo(x + 12, y + 4, x + 6, y - 6, x, y);
    ctx.fill();
    ctx.restore();
  }
  drawFlowerParticle(camera, particle) {
    const x = particle.wx - camera.x;
    const y = particle.wy - camera.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(particle.rot);
    const a = Math.max(0, Math.min(1, particle.life / 1.2));
    ctx.globalAlpha = a;
    ctx.fillStyle = particle.color;
    if (particle.shape === "leaf") {
      ctx.beginPath();
      ctx.ellipse(0, 0, particle.size * 0.9, particle.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  drawBouquetEntity(camera, bouquet) {
    const x = bouquet.wx - camera.x;
    const y = bouquet.wy - camera.y;
    this.drawBouquetGhost(x, y, bouquet.flowers, { alpha: 1.0, maxStems: bouquet.flowers.length, fan: 0.9, stemLen: 34, headR: 7 });
  }
  drawBigFlower(camera, bigFlower) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2e8b57";
    const segCountTotal = Math.max(0, bigFlower.nodes.length - 1);
    // when exploding, retract from current grown amount down to 0
    let segsToDraw = Math.min(segCountTotal, Math.floor(bigFlower.grow * segCountTotal));
    if (bigFlower.mode === "exploding") {
      const t = Math.min(1, bigFlower.explodeT / bigFlower.explodeDur);
      segsToDraw = Math.floor(segsToDraw * (1 - t));
      ctx.globalAlpha = 1 - t * 0.9;
    }
    // stems
    for (let i = 1; i <= segsToDraw; i++) {
      const n = bigFlower.nodes[i];
      const p = bigFlower.nodes[n.parent];
      const x1 = p.x - camera.x, y1 = p.y - camera.y;
      const x2 = n.x - camera.x, y2 = n.y - camera.y;

      ctx.lineWidth = Math.max(1, n.r * 0.6);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // attachments only when not exploding
    if (bigFlower.mode !== "exploding") {
      const aT = (bigFlower.mode === "blossom")
        ? 1
        : Math.max(0, (bigFlower.grow - 0.6) / 0.4);
      if (aT > 0) {
        ctx.globalAlpha = aT;
        for (const a of bigFlower.attachments) {
          if (a.node > segsToDraw) continue;
          const n = bigFlower.nodes[a.node];
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
  drawMessageBox(message) {
    if (!message.visible) return;
    const w = canvas.width;
    const h = canvas.height;
    const bw = Math.max(message.minW, Math.min(message.maxW, w * message.wFrac));
    const bh = message.h;
    const x = (w - bw) * 0.5;
    const y = h * message.y;
    ctx.save();
    ctx.globalAlpha = 0.92;
    this.roundRect(x, y, bw, bh, message.corner);
    ctx.fillStyle = "rgba(10,10,12,0.70)";
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    this.roundRect(x, y, bw, bh, message.corner);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const shown = message.text.slice(0, message.typed);
    this.drawWrappedTextCentered(shown, x + bw / 2, y + message.pad, bw - message.pad * 2, 24);
    if (message.done) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("click / space", x + bw / 2, y + bh - 14);
    }
    ctx.restore();
  }
  roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  drawWrappedText(text, x, y, maxW, lineH) {
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
  drawWrappedTextCentered(text, cx, y, maxW, lineH) {
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
  drawHUD(player) {
    const tool = player.tools.currentTool();
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(10, 10, 260, 70);
    ctx.fillStyle = "white";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`Tool: ${tool?.name ?? "?"} (1-4)`, 18, 32);
    ctx.fillText(`Blocks: grass=${player.invGet(1)} dirt=${player.invGet(2)} stone=${player.invGet(3)}`, 18, 52);
    ctx.fillText(`PlaceIndex: ${player.inventory.placeIndex} (Z/X to change)`, 18, 70);
    ctx.restore();
  }
  drawPetalShape(shapeId, scale = 1) {
    const shape = petalShapes[shapeId] ?? petalShapes.triangle;
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
  drawFlowerStamp(f, opts = {}) {
    const {
        headR = 6,
        centerR = 2.2,
        petalOffset = 0.9, 
        petalScale = 3.2,
    } = opts;
    const petalCount = f.petalCount ?? 6;
    const shapeId = f.petalShapeId ?? "triangle";
    ctx.save();
    ctx.fillStyle = f.color ?? "rgb(220,120,220)";
    for (let i = 0; i < petalCount; i++) {
        const a = (Math.PI * 2 * i) / petalCount;
        const px = Math.cos(a) * headR * petalOffset;
        const py = Math.sin(a) * headR * petalOffset;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);
        this.drawPetalShape(shapeId, petalScale);
        ctx.restore();
    }
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(0, 0, centerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  drawBouquetGhost(sx, sy, flowers, opts = {}) {
    const {
        maxStems = 7,
        fan = 0.55,
        stemLen = 26,
        stemW = 3,
        headR = 6,
        offsetY = 18,
        alpha = 0.55,
    } = opts;

    if (!flowers || flowers.length === 0) return;

    const n = Math.min(maxStems, flowers.length);
    const start = flowers.length - n;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy + offsetY);

    for (let i = 0; i < n; i++) {
        const f = flowers[start + i];
        const t = (n === 1) ? 0.5 : i / (n - 1);
        const ang = (t - 0.5) * fan;

        const tipX = Math.cos(ang) * 10;
        const tipY = -stemLen + Math.sin(ang) * 4;

        // stem
        ctx.save();
        ctx.strokeStyle = "#2e8b57";
        ctx.lineWidth = stemW;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        ctx.restore();

        // head
        ctx.save();
        ctx.translate(tipX, tipY);
        this.drawFlowerStamp(f, { headR, centerR: Math.max(2, headR * 0.35) });
        ctx.restore();
    }
    ctx.restore();
  }
  bouquetPreview(player){
        if (player.bouquetPreview?.enabled) {
            const mw = player.mouseWorld();
            const tx = Math.floor(mw.wx / blockSize);
            const ty = Math.floor(mw.wy / blockSize);
            const wx = tx * blockSize + blockSize / 2;
            const wy = ty * blockSize + blockSize / 2;

            const n = Math.min(player.bouquetPreview.maxStems, player.inventory.flowers.length);
            if (n > 0) {
            this.drawBouquetGhost(
                wx - player.camera.x,
                wy - player.camera.y,
                player.inventory.flowers.slice(0, n),
                { alpha: 0.55, maxStems: n, fan: 0.9, stemLen: 34, headR: 7 }
            );

            }
        }
  }
}

class Entity {
  constructor(wx, wy, clickable = false, radius = 0) {
    this.wx = wx;
    this.wy = wy;
    this.vx = 0;
    this.vy = 0;
    this.clickable = clickable;
    this.radius = radius;
    this.alive = true;
    this.type = "entity";
    this.z = 0;
  }
  update(dt) { this.wx += this.vx * dt; this.wy += this.vy * dt; }
  addToClickable(scene) { if (this.clickable) scene.clickables.add(this); }
  hitTest(wx, wy) {
    const dx = wx - this.wx, dy = wy - this.wy;
    return (dx * dx + dy * dy) <= (this.radius * this.radius);
  }
  interaction(scene, player) {} //for subclass override
  draw(camera) {
    //defunct, drawn in drawer
  }
}
class FloatingHeart extends Entity {
    constructor(wx, wy, opts = {}) {
    super(wx, wy, opts.clickable ?? true, opts.radius ?? 18);
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
    this.clickable = opts.clickable ?? true;
    this.radius = opts.radius ?? 18;
    this.alive = true;
    this.z = 0;
    this.type = "floatingHeart";
  }
  update(dt) {
    if (this.life !== Infinity) {
      this.life -= dt;
      if (this.life <= 0) { this.alive = false; return; }
    }
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
    this.vx *= 0.97;
    this.vy *= 0.97;

    const t = (this.life === Infinity) ? 1 : Math.max(0, Math.min(1, this.life / 2.0));
    this.scale = 1 + t * 0.5;
  }
}
class HeartEntity extends Entity {
    constructor(wx, wy, solid = false) {
        super(wx, wy, false, 10);
        this.vy = -60;
        this.solid = solid;
        this.init()
        this.life = 1000;
        this.type = "heart";
    }
    init() {
        if (!this.solid) {
            this.life = 1.8;
            this.clickable = false;
        } else {
            this.life = 1000;
            this.clickable = true;
        }
    }
    update(dt, scene) {
        this.life -= dt;
        if (this.life <= 0) { this.alive = false; return; }
        this.vy += 140 * dt;
        this.wx += this.vx * dt;
        this.wy += this.vy * dt;
        this.hitsGround(scene);
    }
    hitsGround(scene) {
        const below = scene.getBlockAt(this.wx, this.wy + blockSize);
        if (below) this.life = 0;
    }
}
class FlowerEntity extends Entity {
  constructor(tx, ty) {
    const wx = tx * blockSize + blockSize / 2;
    const wy = ty * blockSize + blockSize / 2;
    super(wx, wy, true, 8);
    this.tx = tx; this.ty = ty;
    this.z = 5;
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
    this.type = "flower";
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
  interaction(scene, player) {
    if (player.tools.isCurrentTool("Hand")){
        //pick flower
        player.inventory.flowers.push(this.exportDrawData());
        player.invAdd(4, 1);
        scene.entities.delete(this);
    } else if (player.tools.isCurrentTool("HeartWand")){
      //multiple hearts spawn outwards
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const vx = Math.cos(angle) * 50;
        const vy = Math.sin(angle) * 50;
        const heart = new HeartEntity(this.wx, this.wy);
        const extraHeart = new FloatingHeart(this.wx, this.wy, { vx, vy, life: 2.8 + Math.random() * 1.2 })
        heart.vx = vx;
        heart.vy = vy;
        extraHeart.vx = vx;
        extraHeart.vy = -vy;
        scene.entities.add(heart);
        scene.entities.add(extraHeart);
      }
    }
  }
  pickKey(obj) {
    const keys = Object.keys(obj);
    return keys[Math.floor(this.rand() * keys.length)];
  }
}
class BigFlower extends Entity {
  constructor(wx, wy, seed = 91234) {
    super(wx, wy, true, 20);
    this.z = 5;
    this.seed = seed >>> 0;
    
    this.nodes = [];
    this.attachments = []; 

    this.grow = 0;
    this.growRate = 0.35;
    this.delay = 0;

    this.mode = "growing";
    this.explodeT = 0;
    this.explodeDur = 0.9;
    this.noAttachAfterExplode = true;

    this.maxDepth = 3;
    this.maxSegmentsPerBranch = 10;
    this.baseLen = 4;
    this.lenJitter = 0.65;
    this.branchProb = 0.2;
    this.branchSpread = Math.PI * 0.2;
    this.trunkUpAngle = -Math.PI / 2;
    this.type = "bigFlower";
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
  _currentTipNodeIndex() {
    const segCountTotal = Math.max(0, this.nodes.length - 1);
    const segsToDraw = Math.min(segCountTotal, Math.floor(this.grow * segCountTotal));
    return Math.max(0, segsToDraw);
  }
  update(dt, scene) {
    if (this.delay > 0) { this.delay -= dt; return; }
    if (this.mode === "growing") {
      this.grow = Math.min(1, this.grow + this.growRate * dt);
      if (this.grow >= 1) {
        this.mode = "blossom";
      }
    } else if (this.mode === "exploding") {
      this.explodeT += dt;
      if (this.explodeT >= this.explodeDur) this.alive = false;
    }
  }
  hitTest(wx, wy) {
    const tipIdx = this._currentTipNodeIndex();
    const tip = this.nodes[tipIdx] ?? this.nodes[0] ?? { x: this.wx, y: this.wy };
    const dx = wx - tip.x;
    const dy = wy - tip.y;
    const r = 38; // world px
    return (dx*dx + dy*dy) <= r*r;
  }
  explode(scene) {
    if (this.mode === "exploding") return; 
    this.mode = "exploding";
    this.explodeT = 0;
    const tipIdx = this._currentTipNodeIndex();
    // burst from attachments that are already grown
    for (const a of this.attachments) {
      if (a.node > tipIdx) continue;
      const n = this.nodes[a.node];
      if (!n) continue;
      const count =
        a.kind === "petals" ? 10 :
        a.kind === "leaf"   ? 2  :
        a.kind === "bud"    ? 4  : 1;
      for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * 260;
        const up = -260 - Math.random() * 220;
        scene.entities.add(new FlowerParticle(n.x, n.y, {
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
    // extra ring burst from the tip
    const tip = this.nodes[tipIdx] ?? this.nodes[0] ?? { x: this.wx, y: this.wy };
    for (let i = 0; i < 18; i++) {
      const ang = (Math.PI * 2 * i) / 18;
      scene.entities.add(new FlowerParticle(tip.x, tip.y, {
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
  interaction(scene, player) {
    if (player.tools.isCurrentTool("Hand")) {
      if (this.mode === "growing" && this.grow < 1) return; 
      this.explode(scene);
      return;
    }
    // HeartWand can also pop (and you can keep your heart burst if you want)
    if (player.tools.isCurrentTool("HeartWand")) {
      this.explode(scene);
      // optional: keep heart burst from tip
      const tipIdx = this._currentTipNodeIndex();
      const tip = this.nodes[tipIdx] ?? { x: this.wx, y: this.wy };
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const vx = Math.cos(angle) * 80;
        const vy = Math.sin(angle) * 80;
        const heart = new HeartEntity(tip.x, tip.y);
        heart.vx = vx;
        heart.vy = vy;
        scene.entities.add(heart);
      }
    }
  }
}
class MessageBox extends Entity {
  constructor(wx, wy, text) {
    super(wx, wy, false, 0);
    this.z = 100;
    this.type = "messageBox";

    this.visible = true;
    this.text = text;
    this.typed = 0;
    this.timer = 0;
    this.speed = 60; // chars/sec
    this.done = false;
    this.wFrac = 0.72;
    this.maxW = 820;
    this.minW = 360;
    this.pad = 18;
    this.corner = 16;

    this.y = 0.26;
    this.h = 120; 
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
}
class FlowerParticle extends Entity {
  constructor(wx, wy, opts = {}) {
    super(wx, wy, false, 0);
    this.size = opts.size ?? 6;

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
}
class BouquetEntity extends Entity {
  constructor(tx, ty, flowers) {
    const wx = tx * blockSize + blockSize / 2;
    const wy = ty * blockSize + blockSize / 2;
    super(wx, wy, false, 0);
    this.tx = tx; this.ty = ty;
    this.flowers = flowers;
    this.isbeingheld = false;
    this.z = 6;
  }
  initAsHeld() {
    this.isbeingheld = true;
    this.clickable = false;
  }
  changeToGrounded() {
    this.isbeingheld = false;
    this.clickable = true;
  }
}
class CustomSpawner{
    constructor(scene, definition){
        this.scene = scene;
        this.def = definition;
        this.needed = false;
    }
    simpleRadiusOutwards(amt, velocity, diameter, entType){
        const angleStep = (Math.PI * 2) / amt;
        for(let i = 0; i < amt; i++){
            const angle = i * angleStep;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            const ent = new entType(this.def.wx, this.def.wy);
            ent.vx = vx;
            ent.vy = vy;
            this.scene.entities.add(ent);
        }
    }
    update(dt, sm){
        if (!this.needed) return;
        switch(this.def.type){
            case "heartBurst": {
                this.simpleRadiusOutwards(12, 80, 6, HeartEntity);
                break;
            }
            case "flowerBurst": {
                this.simpleRadiusOutwards(18, 120, 8, FlowerParticle);
                break;
            }
        }
        this.needed = false;
    }
}
class Scene {
  constructor() {
    this.world = new World();
    this.entities = new Set();
    this.clickables = new Set();

    this.MSG = new MessageBox(0,0,"");
    this.messageQueue = []
    this._messageIndex = 0;
    this.spawners = [];
  }
  onEnter(sm, player, payload ={}) {
    this.world.updateVisible(player.camera, (ent) => this.entities.add(ent));
    this.rebuildClickables(player);
    if (payload.messages?.length){
        this.startMessages(payload.messages);
    }
  }
  onExit(sm, payload ={}){
    //optional
  }
  rebuildClickables(){
    this.clickables.clear();
    for (const ent of this.entities) {
      if (ent.clickable) this.clickables.add(ent);
    }
  }
  handleClick(player) {
    const { wx, wy } = player.mouseWorld();
    for (const ent of this.clickables) {
      if (ent.hitTest(wx, wy)) { ent.interaction?.(this, player); break; }
    }
  }
  startMessages(messages) {
    this.messageQueue = messages.slice(); // copy
    this._messageIndex = 0;
    this.MSG.show(this.messageQueue[this._messageIndex], {speed: 40});
  }
  advanceMessage({hideOnDone = false} = {}) {
    if (!this.MSG.visible) return;
    if (!this.MSG.done) {
      this.MSG.advance({ hideOnDone });
      return;
    }
    this._messageIndex++;
    if (this._messageIndex < this.messageQueue.length) {
      this.MSG.show(this.messageQueue[this._messageIndex], {speed: 40});
    } else {
      this.MSG.visible = false;
    }
  }
  getBlockAt(wx, wy) { return this.world.getBlockAt(wx, wy); }
  placeBlockAt(wx, wy, type) { this.world.setBlockAt(wx, wy, type); }
  removeBlockAt(wx, wy) { this.world.removeBlockAt(wx, wy); }
  addEntity(ent) { this.entities.add(ent); }
  update(sm, dt) {
    const player = sm.player;
    this.world.updateVisible(player.camera, (ent) => this.entities.add(ent));
    this.MSG.update(dt);
    for (const ent of this.entities) {
      ent.update?.(dt, this);
    }
    for (const spawner of this.spawners) {
        spawner.update(dt, this);
    }
    for (const ent of this.entities) if (!ent.alive) this.entities.delete(ent);
    if (player.wasPressed(" ") && this.MSG.visible) {
        this.advanceMessage({ hideOnDone: true });
    }
    if(player.mouse.clicked){
        if (this.MSG.visible) this.advanceMessage({hideOnDone:true});
        else this.handleClick(player);
    }
    this.rebuildClickables();
  }
  periodicUpdate(dt) {
    this.rebuildClickables();
  }
  draw(sm, now) {
    const player = sm.player;
    const drawer = sm.drawer;
    drawer.drawBackground(now);
    drawer.drawWorldBlocks(this.world);
    drawer.drawEntities(this.entities);
    drawer.drawHUD(player);
    drawer.drawMessageBox(this.MSG);
  }
  drawOverlay(sm) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Garden Scene", canvas.width / 2, 42);
    ctx.restore();
  }
}

let lastTime = 0;
let now = 0;
const player = new Player();
const scenes = {
  scene: new Scene(),
};
const SM = new SceneManager(
  { scene: scenes.scene },
  "scene",
  player
);
player.sm = SM;

function loop(now){
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    player.update(dt);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    SM.update(dt);
    SM.draw(now);
    player.beginFrame();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
