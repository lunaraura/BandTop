const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const objects = [];

const v = (x, y, z) => ({ x, y, z });
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const toRadians = (deg) => (deg * Math.PI) / 180;

function rotateVector(vec, rot) {
  const radX = toRadians(rot.x);
  const radY = toRadians(rot.y);
  const radZ = toRadians(rot.z);

  const cosX = Math.cos(radX), sinX = Math.sin(radX);
  const cosY = Math.cos(radY), sinY = Math.sin(radY);
  const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);

  const x1 = vec.x;
  const y1 = vec.y * cosX - vec.z * sinX;
  const z1 = vec.y * sinX + vec.z * cosX;

  const x2 = x1 * cosY + z1 * sinY;
  const y2 = y1;
  const z2 = -x1 * sinY + z1 * cosY;

  const x3 = x2 * cosZ - y2 * sinZ;
  const y3 = x2 * sinZ + y2 * cosZ;
  const z3 = z2;

  return v(x3, y3, z3);
}

const cloneV = (a) => v(a.x, a.y, a.z);

const predefinedVectors = {
  seed: {
    properties: { pos: v(0, 0, 0), rot: v(0, 0, 0), mag: v(1, 0, 0) },
    spawnParts: ["stalk", "leaf"],
    maxSpawns: 4,
    randomTolerances: { rot: v(0, 0, 0), mag: v(0, 0, 0) },
    isLine: false,
  },
  stalk: {
    properties: { pos: v(0, 0, 0), rot: v(0, 0, 0), mag: v(0, 10, 0) },
    spawnParts: ["stalk", "leaf"],
    maxSpawns: 3,
    randomTolerances: { rot: v(0, 5, 5), mag: v(2, 0, 0) },
    isLine: true,
  },
  root: {
    properties: { pos: v(0, 0, 0), rot: v(0, -90, 0), mag: v(10, 0, 0) },
    spawnParts: ["root"],
    maxSpawns: 2,
    randomTolerances: { rot: v(0, 5, 5), mag: v(2, 0, 0) },
    isLine: true,
  },
  leaf: {
    properties: { pos: v(0, 0, 0), rot: v(25, -25, -25), mag: v(15, 15, -15) },
    spawnParts: [],
    maxSpawns: 0,
    randomTolerances: { rot: v(5, 5, 5), mag: v(2, 2, 2) },
    isLine: false,
  },
};

class Flower {
  constructor(position, size = 1) {
    this.position = position;
    this.size = size;
    this.parts = [];
    this.growable = [];
    objects.push(this);
  }

  createSeed() {
    const seed = new Part(this.position, "seed");
    this.parts.push(seed);
    this.checkGrowable();
  }

  checkGrowable() {
    this.growable = this.parts.filter((p) => {
      const def = predefinedVectors[p.type];
      return p.children.length < def.maxSpawns;
    });
  }

  tick() {
    // Simple: each tick, each growable part has a chance to spawn.
    for (const part of this.growable) {
      const def = predefinedVectors[part.type];
      if (!def) continue;

      if (part.children.length >= def.maxSpawns) continue;

      const chance = Math.random() * 100;
      if (chance < 10) this.produceNewPart(part);
    }
  }

  produceNewPart(parentPart) {
    const options = parentPart.requestedNewPart();
    if (!options || options.length === 0) return;

    const selectedType = options[(Math.random() * options.length) | 0];
    const child = new Part(v(0, 0, 0), selectedType);

    child.inheritParentTransformations(parentPart);
    child.randomProperties(predefinedVectors[selectedType].randomTolerances);
    child.update();

    parentPart.children.push(child);
    child.parent = parentPart;

    this.parts.push(child);
    this.checkGrowable();
  }

  draw(ctx) {
    // World -> canvas: center on seed, Y up in world so invert for canvas.
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.85; // push “ground” down a bit

    ctx.lineWidth = 2;
    ctx.beginPath();

    for (const p of this.parts) {
      const def = predefinedVectors[p.type];
      if (!def?.isLine) continue;

      const x1 = cx + p.pos.x * this.size;
      const y1 = cy - p.pos.y * this.size;
      const x2 = cx + p.endp.x * this.size;
      const y2 = cy - p.endp.y * this.size;

      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }

    ctx.stroke();
  }
}

class Part {
  constructor(pos, typeKey) {
    this.type = typeKey; // IMPORTANT: store string key
    const def = predefinedVectors[typeKey];

    this.pos = cloneV(pos);
    this.rot = cloneV(def.properties.rot);
    this.mag = cloneV(def.properties.mag);

    this.children = [];
    this.parent = null;

    this.endp = add(this.pos, this.getDirection());
    objects.push(this);
  }

  getDirection() {
    return rotateVector(this.mag, this.rot);
  }

  inheritParentTransformations(parentPart) {
    this.pos = cloneV(parentPart.endp);
    this.rot = v(
      parentPart.rot.x + this.rot.x,
      parentPart.rot.y + this.rot.y,
      parentPart.rot.z + this.rot.z
    );
  }

  randomProperties(tolerances) {
    this.rot = v(
      this.rot.x + (Math.random() - 0.5) * tolerances.rot.x,
      this.rot.y + (Math.random() - 0.5) * tolerances.rot.y,
      this.rot.z + (Math.random() - 0.5) * tolerances.rot.z
    );

    // If you want symmetric +/- variation, do (Math.random()-0.5)*tol
    this.mag = v(
      this.mag.x + (Math.random() - 0.5) * tolerances.mag.x,
      this.mag.y + (Math.random() - 0.5) * tolerances.mag.y,
      this.mag.z + (Math.random() - 0.5) * tolerances.mag.z
    );
  }

  update() {
    this.endp = add(this.pos, this.getDirection());
  }

  requestedNewPart() {
    return predefinedVectors[this.type].spawnParts;
  }
}

// --- minimal loop ---
const flower = new Flower(v(0, 0, 0), 6);
flower.createSeed();

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  flower.tick();
  flower.draw(ctx);
  requestAnimationFrame(draw);
}

draw();
