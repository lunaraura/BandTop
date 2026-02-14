const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

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

function worldToTile(wx, wy) {
  return { tx: Math.floor(wx / blockSize), ty: Math.floor(wy / blockSize) };
}
function tileToChunk(tx, ty) {
  return { cx: Math.floor(tx / chunkSize), cy: Math.floor(ty / chunkSize) };
}
function localInChunk(tx, ty, cx, cy) {
  return { lx: tx - cx * chunkSize, ly: ty - cy * chunkSize };
}
const entities = new Set();

const mouse = { x: 0, y: 0 };
const camera = { x: -window.innerWidth / 2, y: -window.innerHeight / 2 };

//per visual pixel
const blockSize = 10;
//per block
const chunkSize = 16;
const visibleChunks = 3;
const backgroundSettings = {
  hills: {
    enabled: true,
    frequency: 0.001,
    color: '#1b6952',
    hillAmplitudes: [60, 20, 5],
    panSpeed: 0.02,
    visible: [],
    visibility: {high: 0.8, low: 0.2, direction: 'down'},
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
  selectedTool: 1,
  selectedTile: 1,
  flowers: [],
  bouquets: [],
  blocks: {
    dirt: 0,
    grass: 0,
    stone: 0,
  },
  bouquet: null
};
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
  6: { name: "table",}, space: { nx: 1, px: 1, ny: 0, py: 2}, //additional space it occupies in adjacent tiles
  7: { name: "heart",  space: { nx: 0, px: 0, ny: 0, py: 0}},
}
const globalBlockPointers = {
  ...genedBlockDefinitions,
  ...floraBlockDefinitions,
  ...playerBlockDefinitions
}

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
          type = 1; // grass band
        }
        else if (worldTY > surfaceY &&
                worldTY <= surfaceY + dirtDepth) {
          type = 2; // dirt
        }
        else if (worldTY > surfaceY + dirtDepth) {
          type = 3; // stone
        }
        else {
          type = 0; // air
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
    for (const key of this.generatedChunks.keys()) {
      if (!newVisible.has(key)) {
        this.generatedChunks.delete(key);
      }
    }
  }
}
function shouldHaveTree(tx, ty) {
  const groundType = world.getTile(tx, ty);
  const aboveType = world.getTile(tx, ty - 1);

  if (groundType !== 1) return false;   // must be grass
  if (aboveType !== 0) return false;    // space above must be air

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

class Flower extends Entity {
  constructor(tx, ty) {
    const wx = tx * blockSize + blockSize / 2;
    const wy = ty * blockSize;
    super(wx, wy);

    this.tx = tx;
    this.ty = ty;

    // Deterministic seed
    this.seed = hash2i(tx, ty, 4242);

    // Generate traits
    this.petalCount = this.randomRange(
      flowerLimits.petalCount.min,
      flowerLimits.petalCount.max
    );

    this.leafCount = this.randomRange(
      flowerLimits.leafCount.min,
      flowerLimits.leafCount.max
    );

    this.stemHeight = this.randomRange(
      flowerLimits.stemHeight.min,
      flowerLimits.stemHeight.max
    );

    this.petalShape = this.pickFrom(petalShapes);
    this.leafShape = this.pickFrom(leafShapes);

    this.color = this.randomColor();
  }

  // Deterministic random
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

    // Stem
    ctx.strokeStyle = "#2e8b57";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(screenX, screenY - this.stemHeight * blockSize);
    ctx.stroke();

    // Petals
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

    // Center
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
      petalShape: this.petalShape,
      leafShape: this.leafShape,
      color: this.color
    }
  }
}
function ensureFlowerAt(tx, ty) {
  const type = world.getTile(tx, ty);
  const above = world.getTile(tx, ty - 1);

  if (type !== 1) return;
  if (above !== 0) return;

  const h = hash2i(tx, ty, 5555);
  if (h % 14 !== 0) return;

  // Prevent duplicates by checking if entity already exists
  for (const e of entities) {
    if (e instanceof Flower && e.tx === tx && e.ty === ty) {
      return;
    }
  }

  entities.add(new Flower(tx, ty));
}

class FloatingHeart extends Entity {
  constructor(wx, wy) {
    super(wx, wy);

    this.vy = -20; // float upward
    this.life = 2; // seconds
  }

  update(dt) {
    super.update(dt);

    this.life -= dt;
    this.scale = 1 + (2 - this.life) * 0.5;

    if (this.life <= 0) {
      this.alive = false;
    }
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

  }
  draw(ctx, camera) {
  }
}
const EntityManager = {
  list: new Set(),

  add(e) { this.list.add(e); },

  update(dt) {
    for (const e of this.list) e.update(dt);
    for (const e of this.list) {
      if (!e.alive) this.list.delete(e);
    }
  },

  draw(ctx, camera) {
    [...this.list]
      .sort((a, b) => a.wy - b.wy)
      .forEach(e => e.draw(ctx, camera));
  }
};

function update(dt) {
  for (const e of entities) {
    e.update(dt);
  }

  for (const e of entities) {
    if (!e.alive) entities.delete(e);
  }
}

function draw() {
  const sorted = [...entities].sort((a, b) => a.wy - b.wy);

  for (const e of sorted) {
    e.draw(ctx, camera);
  }
}

