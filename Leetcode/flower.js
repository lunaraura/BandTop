class Flower {
  constructor(pos, birthData = {}) {
    this.pos = this.snap(pos);
    this.dna = birthData;

    // tuning knobs (easy to tweak)
    this.targetStemHeight = this.dna.targetStemHeight ?? 8;     // how tall before bud
    this.leafStartY = this.dna.leafStartY ?? 2;                 // no leaves at base
    this.leafChance = this.dna.leafChance ?? 0.35;              // chance a stem tick makes a leaf (when allowed)

    this.limits = {
      stem: { overall: 40 },
      leaf: { overall: 20 },
      flowerBud: { overall: 1 },
      flowerPetal: { overall: 12 }
    };

    // Rules are still here, but tick() will gate them.
    this.clusterVoxSpawn = {
      seed: { stem: { amt: 1, type: "chain", dir: "up" } },

      // stem can extend upward; leaves are "side"; bud only when tall enough
      stem: {
        stem: { amt: 1, type: "chain", dir: "up" },
        leaf: { amt: 1, type: "leafBlade", dir: "side" },
        flowerBud: { amt: 1, type: "chain", dir: "up" }
      },

      // leaves don't recursively spawn more leaves by default (keeps it from bush-ing out)
      leaf: {},

      // bud spawns petals as a ring, then becomes non-growable
      flowerBud: { flowerPetal: { amt: 10, type: "ring", dir: "side" } }
    };

    this.growablePart = [];
    this.allParts = [];
    this.occupied = new Set(); // "x,y,z" keys for O(1) occupancy

    this.spawnSeed();
  }

  // ---------- utils ----------
  key(p) { return `${p.x},${p.y},${p.z}`; }
  snap(p) { return v(Math.round(p.x), Math.round(p.y), Math.round(p.z)); }

  dirVec(dir) {
    switch (dir) {
      case "up": return v(0, 1, 0);
      case "down": return v(0, -1, 0);
      case "left": return v(-1, 0, 0);
      case "right": return v(1, 0, 0);
      case "front": return v(0, 0, 1);
      case "back": return v(0, 0, -1);
      case "side": {
        const sides = [v(1,0,0), v(-1,0,0), v(0,0,1), v(0,0,-1)];
        return sides[Math.floor(Math.random() * sides.length)];
      }
      default: return v(0, 1, 0);
    }
  }

  isOccupied(p) { return this.occupied.has(this.key(p)); }

  // ---------- spawning ----------
  spawnSeed() {
    this.newPart("seed", null, this.pos);
  }

  colorFor(type) {
    if (type === "stem") return 0x8B4513;
    if (type === "leaf") return 0x00ff00;
    if (type === "flowerBud") return 0xff00ff;
    if (type === "flowerPetal") return 0xffff00;
    if (type === "seed") return 0xaf6600;
    return 0xffffff;
  }

  newPart(type, parent, position) {
    const pos = this.snap(position);
    const k = this.key(pos);
    if (this.occupied.has(k)) return null;

    const part = {
      type,
      pos,
      parent,
      canGrow: true
    };

    this.growablePart.push(part);
    this.allParts.push(part);
    this.occupied.add(k);

    const voxel = new Voxel(pos.x, pos.y, pos.z, 1, this.colorFor(type));
    voxel.addToScene(scene);
    return part;
  }

  countParts(type) {
    let n = 0;
    for (const p of this.allParts) if (p.type === type) n++;
    return n;
  }

  atOverallLimit(type) {
    const lim = this.limits[type];
    if (!lim) return false;
    return this.countParts(type) >= lim.overall;
  }

  // ---------- position generators ----------
  getNewVoxelPosition(origin, spawnPattern, dir) {
    origin = this.snap(origin);

    if (spawnPattern === "chain") {
      const d = this.dirVec(dir);
      return v(origin.x + d.x, origin.y + d.y, origin.z + d.z);
    }

    if (spawnPattern === "ring") {
      // clean integer ring in XZ plane
      const ring = [
        v(1,0,0), v(-1,0,0), v(0,0,1), v(0,0,-1),
        v(1,0,1), v(-1,0,1), v(1,0,-1), v(-1,0,-1),
      ];
      const d = ring[Math.floor(Math.random() * ring.length)];
      return v(origin.x + d.x, origin.y, origin.z + d.z);
    }

    if (spawnPattern === "leafBlade") {
      // makes a 2–3 voxel "blade": one side, maybe one diagonal, sometimes one down
      const side = this.dirVec("side");
      const options = [
        v(side.x, 0, side.z),
        v(side.x * 2, 0, side.z * 2),
        v(side.x, 0, side.z + (side.x !== 0 ? 1 : 0)),
        v(side.x + (side.z !== 0 ? 1 : 0), 0, side.z),
        v(side.x, -1, side.z)
      ];
      const d = options[Math.floor(Math.random() * options.length)];
      return v(origin.x + d.x, origin.y + d.y, origin.z + d.z);
    }

    // fallback
    return v(origin.x, origin.y + 1, origin.z);
  }

  // ---------- growth logic ----------
  chooseSpawnFor(part) {
    const rules = this.clusterVoxSpawn[part.type];
    if (!rules || Object.keys(rules).length === 0) return null;

    // Stage gating to prevent “bush”
    if (part.type === "seed") return { spawnType: "stem", ...rules.stem };

    if (part.type === "stem") {
      const stemHeight = part.pos.y - this.pos.y;

      // Prefer growing upward until target height
      if (stemHeight < this.targetStemHeight && !this.atOverallLimit("stem")) {
        // small chance to make leaves once we're above leafStartY
        if (stemHeight >= this.leafStartY && !this.atOverallLimit("leaf") && Math.random() < this.leafChance) {
          return { spawnType: "leaf", ...rules.leaf };
        }
        return { spawnType: "stem", ...rules.stem };
      }

      // Once tall enough, make exactly one bud at the top (and stop making more stems)
      if (!this.atOverallLimit("flowerBud") && this.countParts("flowerBud") === 0) {
        return { spawnType: "flowerBud", ...rules.flowerBud };
      }

      // After bud exists, stop stem growth at/near top
      return null;
    }

    if (part.type === "flowerBud") {
      // petals once
      if (this.atOverallLimit("flowerPetal")) return null;
      return { spawnType: "flowerPetal", ...rules.flowerPetal };
    }

    return null;
  }

  tick() {
    if (this.growablePart.length === 0) return;

    const growIdx = Math.floor(Math.random() * this.growablePart.length);
    const part = this.growablePart[growIdx];

    const choice = this.chooseSpawnFor(part);
    if (!choice) {
      part.canGrow = false;
      this.growablePart.splice(growIdx, 1);
      return;
    }

    const { spawnType, amt = 1, type: pattern, dir = "up" } = choice;

    // overall limit gate
    if (this.atOverallLimit(spawnType)) {
      // don't kill the site; just stop this attempt
      return;
    }

    let spawned = 0;
    for (let i = 0; i < amt; i++) {
      let placed = false;

      // retries prevent “one collision kills branch”
      for (let tries = 0; tries < 10; tries++) {
        const candidate = this.snap(this.getNewVoxelPosition(part.pos, pattern, dir));
        if (this.isOccupied(candidate)) continue;

        // If petals, keep them on bud level (already true) and stop vertical drift
        this.newPart(spawnType, part, candidate);
        spawned++;
        placed = true;
        break;
      }

      if (!placed) break;
    }

    // once bud has spawned petals, retire it so it doesn't keep trying forever
    if (part.type === "flowerBud" && spawned > 0) {
      part.canGrow = false;
      this.growablePart.splice(growIdx, 1);
    }
  }
}
