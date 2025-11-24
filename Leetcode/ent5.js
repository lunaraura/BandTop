const math = {
    rng(seed = Date.now()) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    reseedNoise(seed) {
        return this.rng(seed);
    },

    noise2(x, y, rng = Math.random) {
        // nonce/simple value noise
        const sx = Math.floor(x);
        const sy = Math.floor(y);
        const fx = x - sx;
        const fy = y - sy;
        // sample pseudo-random corners
        const sample = (ix, iy) =>
            Math.abs(Math.sin((ix * 374761393 + iy * 668265263) ^ 0x9e3779b9)) % 1;
        const a = sample(sx, sy);
        const b = sample(sx + 1, sy);
        const c = sample(sx, sy + 1);
        const d = sample(sx + 1, sy + 1);
        const lerp = (u, v, t) => u + (v - u) * t;
        const x1 = lerp(a, b, fx);
        const x2 = lerp(c, d, fx);
        return lerp(x1, x2, fy);
    },

    fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
        let amp = 1;
        let freq = 1;
        let sum = 0;
        let max = 0;
        for (let i = 0; i < octaves; i++) {
            sum += this.noise2(x * freq, y * freq) * amp;
            max += amp;
            amp *= gain;
            freq *= lacunarity;
        }
        return sum / max;
    },

    clamp(v, a = 0, b = 1) {
        return Math.max(a, Math.min(b, v));
    },
};
function shape(x, z, seed = 0) {
    // returns base biome scalar(s)
    const noise = math.fbm(x * 0.001, z * 0.001, 5);
    return noise;
}

function weightsAtCell(x, z, seed = 0) {
    // convert shape values to biome weights
    const s = shape(x, z, seed);
    // trivial partition
    return {
        desert: math.clamp((s - 0.6) / 0.4, 0, 1),
        plains: math.clamp((s - 0.25) / 0.35, 0, 1),
        tundra: math.clamp((0.4 - s) / 0.4, 0, 1),
    };
}
function biomeMix(x, z, seed = 0) {
    const w = weightsAtCell(x, z, seed); 
    // normalize
    const sum = (w.desert + w.plains + w.tundra) || 1;
    return {
        desert: w.desert / sum,
        plains: w.plains / sum,
        tundra: w.tundra / sum,
    };
}
function heightfieldSample(x, z, seed = 0) {
    const h = math.fbm(x * 0.0007 + seed * 1.1, z * 0.0007 - seed * 0.7, 6);
    return Math.floor(h * 200);
}
const biomeData = {
    biomeList: {
        desert: "desert",
        plains: "plains",
        tundra: "tundra",
    },
    heightData: {
        desert: {amplitude: 5, frequency: 0.05},
        plains: {amplitude: 10, frequency: 0.03},
        tundra: {amplitude: 15, frequency: 0.02},
    },
    floraData: {
        desert: { type: 'cactus', density: 0.1 },
        plains: { type: 'grass', density: 0.5 },
        tundra: { type: 'pine', density: 0.3 },
    }
}
const chunkParams = {
    block: {size: 1},
    chunk: {size: 16},
    world: {size: 0, loadRadius: 5}
}
class Chunk{
    constructor(cx, cz, size){
        this.cx = cx;
        this.cz = cz;
        this.size = size;
        this.blocks = null;
        this.entities = new Set();
        this.generated = false;
        this.loaded = false;
    }
    generate(seed = 0){
        this.blocks = [];
        for (let x = 0; x < this.size; x++) {
            this.blocks[x] = [];
            for (let z = 0; z < this.size; z++) {
                const wx = this.cx * this.size + x;
                const wz = this.cz * this.size + z;
                const h = heightfieldSample(wx, wz, seed);
                this.blocks[x][z] = { height: h, biome: biomeMix(wx, wz, seed) };
            }
        }
        this.generated = true;
    }
}
class ChunkManager{
    constructor() {
        this.chunks = new Map(); // key "cx,cz" -> Chunk
    }

    key(cx, cz) {
        return `${cx},${cz}`;
    }

    getChunk(cx, cz) {
        const k = this.key(cx, cz);
        if (!this.chunks.has(k)) {
            const c = new Chunk(cx, cz, chunkParams.chunk.size);
            this.chunks.set(k, c);
        }
        return this.chunks.get(k);
    }

    updateNearby(cx, cz, range = 2, seed = 0) {
        for (let dx = -range; dx <= range; dx++) {
            for (let dz = -range; dz <= range; dz++) {
                const c = this.getChunk(cx + dx, cz + dz);
                if (!c.generated) c.generate(seed);
            }
        }
    }
}
class FloraManager{
    constructor() {
        this.floraInstances = new Set();
    }
    spawnAt(x, z, biome, seed = 0) {
        const f = { x, z, biome, id: `${x},${z}:${Date.now()}` };
        this.floraInstances.add(f);
        return f;
    }
    queryArea(x0, z0, x1, z1) {
        return Array.from(this.floraInstances).filter(
            (f) => f.x >= x0 && f.x <= x1 && f.z >= z0 && f.z <= z1
        );
    }
}
// ==== entity ====
const composites = {
    stone: {tough: 0.3, hard: 0.5, elastic: 0.1, porous: 0.2,
        tempBase: 0.5, tempCond: 0.1, electricBase: 0, electricConduct: 0.1,
        tempHurt: 0.1, electricHurt: 0.1, waterHurt: 0.4, chemHurt: 0.1
    },
    crystal: {tough: 0.2, hard: 0.6, elastic: 0.1, porous: 0.1,
        tempBase: 0.4, tempCond: 0.2, electricBase: 0.1, electricConduct: 0.3,
        tempHurt: 0.1, electricHurt: 0.2, waterHurt: 0.2, chemHurt: 0.1
    },
    metal: {tough: 0.4, hard: 0.5, elastic: 0.1, porous: 0.0,
        tempBase: 0.3, tempCond: 0.4, electricBase: 0.2, electricConduct: 0.5,
        tempHurt: 0.2, electricHurt: 0.3, waterHurt: 0.1, chemHurt: 0.2,
    },
    slime: {tough: 0.1, hard: 0.1, elastic: 0.6, porous: 0.2,
        tempBase: 0.6, tempCond: 0.2, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.2, electricHurt: 0.1, waterHurt: 0.2, chemHurt: 0.3,
    },
    organicAnimal: {tough: 0.3, hard: 0.2, elastic: 0.4, porous: 0.3,
        tempBase: 0.7, tempCond: 0.3, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.5, electricHurt: 0.2, waterHurt: 0.2, chemHurt: 0.4,
    },
    organicPlant: {tough: 0.2, hard: 0.1, elastic: 0.3, porous: 0.5,
        tempBase: 0.6, tempCond: 0.2, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.5, electricHurt: 0.1, waterHurt: 0.3, chemHurt: 0.4,
    },
    organicMecha: {tough: 0.4, hard: 0.4, elastic: 0.1, porous: 0.1,
        tempBase: 0.4, tempCond: 0.4, electricBase: 0.3, electricConduct: 0.5,
        tempHurt: 0.3, electricHurt: 0.4, waterHurt: 0.2, chemHurt: 0.2,
    },
    organicDino: {tough: 0.5, hard: 0.3, elastic: 0.2, porous: 0.2,
        tempBase: 0.7, tempCond: 0.3, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.4, electricHurt: 0.2, waterHurt: 0.3, chemHurt: 0.3,
    },
    organicKaiju: {tough: 0.6, hard: 0.4, elastic: 0.1, porous: 0.1,
        tempBase: 0.8, tempCond: 0.4, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.5, electricHurt: 0.3, waterHurt: 0.4, chemHurt: 0.4,
    },
    organicEldritch: {tough: 0.3, hard: 0.2, elastic: 0.3, porous: 0.4,
        tempBase: 0.5, tempCond: 0.2, electricBase: 0.1, electricConduct: 0.2,
        tempHurt: 0.2, electricHurt: 0.2, waterHurt: 0.2, chemHurt: 0.2,
    },
    ice: {tough: 0.2, hard: 0.4, elastic: 0.1, porous: 0.3,
        tempBase: 0.2, tempCond: 0.5, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.3, electricHurt: 0.1, waterHurt: 0.2, chemHurt: 0.2,
    },
    lava: {tough: 0.5, hard: 0.3, elastic: 0.1, porous: 0.1,
        tempBase: 0.9, tempCond: 0.4, electricBase: 0.1, electricConduct: 0.2,
        tempHurt: 0.4, electricHurt: 0.2, waterHurt: 0.3, chemHurt: 0.3,
    },
    water: {tough: 0.1, hard: 0.0, elastic: 0.7, porous: 0.5,
        tempBase: 0.5, tempCond: 0.3, electricBase: 0.0, electricConduct: 0.2,
        tempHurt: 0.2, electricHurt: 0.3, waterHurt: 0.0, chemHurt: 0.2,
    },
    electric: {tough: 0.2, hard: 0.2, elastic: 0.2, porous: 0.1,
        tempBase: 0.4, tempCond: 0.3, electricBase: 0.5, electricConduct: 0.6,
        tempHurt: 0.2, electricHurt: 0.0, waterHurt: 0.3, chemHurt: 0.2,
    },
    toxic: {tough: 0.1, hard: 0.1, elastic: 0.3, porous: 0.4,
        tempBase: 0.5, tempCond: 0.2, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.4, electricHurt: 0.1, waterHurt: 0.5, chemHurt: 0.1,
    },
    acid : {tough: 0.1, hard: 0.0, elastic: 0.2, porous: 0.5,
        tempBase: 0.6, tempCond: 0.2, electricBase: 0.0, electricConduct: 0.1,
        tempHurt: 0.3, electricHurt: 0.1, waterHurt: 0.4, chemHurt: 0.0,
    },
    spectral: {tough: 0.0, hard: 0.0, elastic: 0.0, porous: 0.0,
        tempBase: 0.5, tempCond: 0.0, electricBase: 0.0, electricConduct: 0.3,
        tempHurt: 0.0, electricHurt: 0.3, waterHurt: 0.0, chemHurt: 0.0,
    },
    arcane: {tough: 0.2, hard: 0.2, elastic: 0.2, porous: 0.2,
        tempBase: 0.5, tempCond: 0.2, electricBase: 0.2, electricConduct: 0.4,
        tempHurt: 0.2, electricHurt: 0.2, waterHurt: 0.2, chemHurt: 0.2,
    },
}
const physicalMoveTypes = {
    smash: {flatBypass: [{hard: 0.1}], scaleBypass: []},
    drill: {flatBypass: [{tough: 0.1}], scaleBypass: []},
    slash: {flatBypass: [{elastic: 0.1}], scaleBypass: []},
    pierce: {flatBypass: [{porous: 0.1}], scaleBypass: []},
}
const energyMoveTypes = {
    burn: {addSoak: [{temperature: 0.1}]},
    freeze: {addSoak: [{temperature: -0.1}]},
    electric: {addSoak: [{electricity: 0.1}]},
    water: {addSoak: [{water: 0.1}]},
    toxic: {addSoak: [{chemicals: 0.1}]},
}
const energyMoveSoak = {
    water: {addHurt: [{electricHurt: 0.1}]},
    electricity: {addHurt: [{waterHurt: 0.1}]},
    freezing: {addHurt: [{tempHurt: 0.1}]},
    burning: {addHurt: [{tempHurt: 0.1}]},
    toxic: {addHurt: [{chemHurt: 0.1}]}
}
const families = {
    canine: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 1.0,
        baseStats: {hp: 50, pAtk: 10, eAtk: 0, pDef: 8, spd: 12}, growthStats: {hp: 5, pAtk: 2, pDef: 2, spd: 1} },
    feline: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 0.8,
        baseStats: {hp: 40, pAtk: 8, eAtk: 0, pDef: 6, spd: 14}, growthStats: {hp: 4, pAtk: 2, pDef: 1, spd: 2} },
    ursine: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 1.5,
        baseStats: {hp: 70, pAtk: 12, eAtk: 0, pDef: 10, spd: 8}, growthStats: {hp: 7, pAtk: 3, pDef: 3, spd: 1} },
    reptile: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 1.0,
        baseStats: {hp: 45, pAtk: 9, eAtk: 0, pDef: 7, spd: 10}, growthStats: {hp: 4, pAtk: 2, pDef: 2, spd: 1} },
    avian: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 0.7,
        baseStats: {hp: 35, pAtk: 7, eAtk: 0, pDef: 5, spd: 16}, growthStats: {hp: 3, pAtk: 1, pDef: 1, spd: 3} },
    insect: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 0.3,
        baseStats: {hp: 25, pAtk: 5, eAtk: 0, pDef: 4, spd: 18}, growthStats: {hp: 2, pAtk: 1, pDef: 1, spd: 3} },
    crustacean: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 1.0,
        baseStats: {hp: 55, pAtk: 10, eAtk: 0, pDef: 9, spd: 9}, growthStats: {hp: 6, pAtk: 2, pDef: 3, spd: 1} },
    amphibian: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 0.8,
        baseStats: {hp: 38, pAtk: 7, eAtk: 0, pDef: 6, spd: 13}, growthStats: {hp: 4, pAtk: 1, pDef: 2, spd: 2} },
    piscine: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 0.6,
        baseStats: {hp: 32, pAtk: 6, eAtk: 0, pDef: 5, spd: 14}, growthStats: {hp: 3, pAtk: 1, pDef: 1, spd: 2} },
    lagomorph: { baseComposites: {in:"organicAnimal", out:"organicAnimal"}, baseSize: 0.5,
        baseStats: {hp: 30, pAtk: 6, eAtk: 0, pDef: 5, spd: 15}, growthStats: {hp: 3, pAtk: 1, pDef: 1, spd: 2} },
}
const species = {
    dog: {family: 'canine', sizeVariation: 1, ivVariationMultiplier: 5},
    cat: {family: 'feline', sizeVariation: 1, ivVariationMultiplier: 5},
    bear: {family: 'ursine', sizeVariation: 1, ivVariationMultiplier: 5},
    lizard: {family: 'reptile', sizeVariation: 1, ivVariationMultiplier: 5},
    bird: {family: 'avian', sizeVariation: 2, ivVariationMultiplier: 5},
    ant: {family: 'insect', sizeVariation: 3, ivVariationMultiplier: 5},
    crab: {family: 'crustacean', sizeVariation: 1, ivVariationMultiplier: 5},
}
const base_movesets = {
    rabbit: [{ id: 'tackle', type: 'melee' }],
    wolf: [{ id: 'bite', type: 'melee' }],
}
const itemEffects = {
    red_berry: (target) => ({ effects: [{efc: {heal: 20}, times: 1, duration: 1} ]}),
    yellow_berry: (target) => ({ effects: [{efc: {pAtk: 5}, times: 1, duration: 1} ]}),
    green_berry: (target) => ({ effects: [{efc:{heal:10}, times: 4, duration: 5} ]}),
    blue_berry: (target) => ({ effects: [{efc:"revive", times: 1, duration: 1} ]}),
}
class RosterService{
    constructor() {
        this.rosters = new Map(); // playerId -> roster array
    }

    addToRoster(playerId, creature) {
        if (!this.rosters.has(playerId)) this.rosters.set(playerId, []);
        this.rosters.get(playerId).push(creature);
    }

    getRoster(playerId) {
        return this.rosters.get(playerId) || [];
    }
}
class CreatureStorage{
    constructor() {
        this.storage = new Map(); // id -> creature data
    }

    save(creature) {
        this.storage.set(creature.id, creature);
    }

    load(id) {
        return this.storage.get(id) || null;
    }
}
class Effects{
    constructor() {
        this.active = [];
    }
    add(effect) {
        this.active.push(effect);
    }
    tick(dt) {
        // process durations, apply effects
        this.active = this.active.filter((e) => {
            if (e.duration != null) e.duration -= dt;
            return e.duration == null || e.duration > 0;
        });
    }
}
class Cooldowns{
    constructor() {
        this.map = new Map();
    }
    set(key, cd) {
        this.map.set(key, cd);
    }
    tick(dt) {
        for (const [k, v] of this.map.entries()) {
            const nv = v - dt;
            if (nv <= 0) this.map.delete(k);
            else this.map.set(k, nv);
        }
    }
    ready(key) {
        return !this.map.has(key);
    }
}
class LevelSystem{
    constructor() {}
    xpToLevel(xp) {
        return Math.floor(Math.sqrt(xp));
    }
    addXP(creature, xp) {
        creature.level = this.xpToLevel((creature.xp || 0) + xp);
    }
}
class MorphService{
    constructor() {}
    tryMorph(creature, augmentItem) {
    }
}
class Player{
    constructor(pos = {x:100, y:100, z:100}, id ){
        this.id = id;
        this.pos = pos;
    }
    starterPick(){}
        mapCommandsToIntent(playerInput) {
        return { move: playerInput.move || null, ability: playerInput.ability || null };
    }
    // collectWildCreature(spawnDescriptor) {
    //     const spec = entities.data_families.species[spawnDescriptor.species] || {};
    //     const c = new Creature({
    //         id: `wild:${Date.now()}`,
    //         species: spawnDescriptor.species,
    //         level: spec.baseLevel || 1,
    //         x: spawnDescriptor.x,
    //         z: spawnDescriptor.z,
    //         mode: 'wild',
    //     });
    //     return c;
    // }
    // useItem(actor, itemId) {
    //     const effectFn = entities.data.itemEffects[itemId];
    //     if (effectFn) return effectFn(actor);
    //     return null;
    // }
}
class Creature{
    constructor({ id, species, level = 1, x = 0, z = 0, type = 'roster' } = {}) {
        this.id = id || `creature:${Date.now()}`;
        this.species = species || 'unknown';
        this.level = level;
        this.x = x;
        this.z = z;
        this.intent = null;
        this.type = type; // 'wild' | 'roster' | 'boss'
        this.effects = new Effects();
        this.cooldowns = new Cooldowns();
        this.moveset = base_movesets[this.species] || [];
        this.initialize(species)
    }
    initialize(spc){
        const rng = math.rng(this.id.length + this.level);
        const spec = species[spc] || {};
        const familyKey = spec.family
        const fam = families[spec.family] || {};
        this.size = fam.baseSize * (1 + (rng() - 0.5) * 0.1 * (spec.sizeVariation || 1));
        const innateVariationRNG = (multiplier) => Math.floor((rng() - 0.5) * 2 * multiplier);
        this.innateStats = {
            hp: innateVariationRNG(spec.ivVariationMultiplier || 5),
            pAtk: innateVariationRNG(spec.ivVariationMultiplier || 5),
            eAtk: innateVariationRNG(spec.ivVariationMultiplier || 5),
            pDef: innateVariationRNG(spec.ivVariationMultiplier || 5),
            spd: innateVariationRNG(spec.ivVariationMultiplier || 5),
        };
        this.baseStats = {
            hp: (fam.baseStats.hp || 10) + (fam.growthStats.hp || 2) * (this.level - 1),
            pAtk: (fam.baseStats.pAtk || 5) + (fam.growthStats.pAtk || 1) * (this.level - 1),
            eAtk: (fam.baseStats.eAtk || 5) + (fam.growthStats.eAtk || 1) * (this.level - 1),
            pDef: (fam.baseStats.pDef || 5) + (fam.growthStats.pDef || 1) * (this.level - 1),
            spd: (fam.baseStats.spd || 5) + (fam.growthStats.spd || 1) * (this.level - 1),
        };
        this.stats = {
            hp: this.baseStats.hp + this.innateStats.hp,
            pAtk: this.baseStats.pAtk + this.innateStats.pAtk,
            eAtk: this.baseStats.eAtk + this.innateStats.eAtk,
            pDef: this.baseStats.pDef + this.innateStats.pDef,
            spd: this.baseStats.spd + this.innateStats.spd,
        };
        // current HP tracked independently (used by CombatManager)
        this.currentHp = this.stats.hp;
    }
    initializeComposites(fam){
        // Resolve species -> family -> composite objects
        const speciesData = (typeof globalThis !== 'undefined' ? globalThis : window);
        // use the module-level 'species' mapping
        const specData = (typeof species !== 'undefined') ? species[this.species] || {} : {};
        const familyKey = specData.family;
        const family = fam || (familyKey ? (families[familyKey] || {}) : {});
        const innerName = family.baseComposites?.in;
        const outerName = family.baseComposites?.out;
        const innerComposite = innerName ? (composites[innerName] || {}) : {};
        const outerComposite = outerName ? (composites[outerName] || {}) : {};
         this.morphStage = 0;
         this.composites = { inner: innerComposite, outer: outerComposite };
         
         let immunes = []
        const temperatureBase = ((innerComposite.tempBase || 0.5) + (outerComposite.tempBase || 0.5)) / 2;
         if (temperatureBase == 1) immunes.push('burning');
         if (temperatureBase == 0) immunes.push('freezing');
         if ((outerComposite.electricHurt || 0) === 0 && (innerComposite.electricHurt || 0) === 0) immunes.push('electricity');
         if ((outerComposite.waterHurt || 0) === 0 && (innerComposite.waterHurt || 0) === 0) immunes.push('water');
         if ((outerComposite.chemHurt || 0) === 0 && (innerComposite.chemHurt || 0) === 0) immunes.push('toxic');

         this.soakCapacities = {
             heatCap: (0.5 + temperatureBase) * this.size,
             coldCap: (0.5 + (1 - temperatureBase)) * this.size,                
             electricityCap: (innerComposite.electricBase) * this.size,
             waterCap: (outerComposite.porous) * this.size,
         }
         this.capacityHurtScale = {
             heatHurtScale: temperatureBase >= 0.5 ? 1 + (innerComposite.tempHurt + outerComposite.tempHurt) / 2 : 1,
             coldHurtScale: temperatureBase < 0.5 ? 1 + (innerComposite.tempHurt + outerComposite.tempHurt) / 2 : 1,
             electricityHurtScale: 1 + (innerComposite.electricHurt + outerComposite.electricHurt) / 2,
             waterHurtScale: 1 + (innerComposite.waterHurt + outerComposite.waterHurt) / 2,
             chemicalHurtScale: 1 + (innerComposite.chemHurt + outerComposite.chemHurt) / 2,
         }
         this.immunities = immunes;
     }
     setIntent(intent) {
         this.intent = intent;
     }
 
     tick(dt) {
         // apply effects and cooldown ticks
         this.effects.tick(dt);
         this.cooldowns.tick(dt);
     }
 }
class Bot{
    constructor(creature) {
        this.creature = creature;
        this.mode = "auto"; //wild must be autonomous,
    }
    decide(worldState) {
        this.creature.intent = { move: null, ability: null };
    }
}

class Projectile{
    constructor({ x, z, vx, vz, speed = 10, owner = null, data = {} } = {}) {
        this.x = x;
        this.z = z;
        this.vx = vx;
        this.vz = vz;
        this.speed = speed;
        this.owner = owner;
        this.data = data;
        this.alive = true;
    }
    tick(dt) {
        this.x += this.vx * this.speed * dt;
        this.z += this.vz * this.speed * dt;
    }
}

class AreaEffects{
    constructor({ x, z, radius = 1.0, duration = 1.0, data = {} } = {}) {
        this.x = x;
        this.z = z;
        this.radius = radius;
        this.duration = duration;
        this.data = data;
    }
    tick(dt) {
        if (this.duration != null) this.duration -= dt;
    }
    isExpired() {
        return this.duration != null && this.duration <= 0;
    }
}
const combatdata = {
    moveCategories: ['melee', 'projectile', 'area'],
    abilities: {
        tackle: { category: 'melee', power: 5 },
        bite: { category: 'melee', power: 8 },
        spit: { category: 'projectile', power: 6 },
        fireBurst: { category: 'area', power: 12, radius: 3 },
    }
}
class AbilityTranslater{
    constructor(combatData) {
        this.combatData = combatData;
    }

    translate(owner, abilityId, target, worldInstance) {
        const def = this.combatData.abilities[abilityId];
        if (!def) return null;
        switch (def.category) {
            case 'melee':
                return { type: 'damage', amount: def.power, target };
            case 'projectile':
                return {
                    type: 'spawnProjectile',
                    projectile: new Projectile({
                        x: owner.x,
                        z: owner.z,
                        vx: Math.sign((target?.x ?? owner.x) - owner.x) || 1,
                        vz: Math.sign((target?.z ?? owner.z) - owner.z) || 0,
                        owner,
                        data: { power: def.power },
                    }),
                };
            case 'area':
                return {
                    type: 'spawnArea',
                    area: new AreaEffects({
                        x: target?.x ?? owner.x,
                        z: target?.z ?? owner.z,
                        radius: def.radius,
                        data: { power: def.power },
                    }),
                };
            default:
                return null;
        }
    }
}
class CombatManager{
    constructor(worldInstance) {
        this.world = worldInstance;
        this.translater = new AbilityTranslater(combatdata);
    }

    resolveAbility(owner, abilityId, target) {
        const action = this.translater.translate(owner, abilityId, target, this.world);
        if (!action) return;
        switch (action.type) {
            case 'damage':
                // apply to currentHp (defensive checks)
                if (target && typeof target.currentHp === 'number') {
                    target.currentHp = Math.max(0, target.currentHp - action.amount);
                }
                break;
            case 'spawnProjectile':
                this.world.spawnEntity(action.projectile);
                break;
            case 'spawnArea':
                this.world.spawnEntity(action.area);
                break;
        }
    }

    tick(dt) {
        // process combat related per-tick if needed
    }
}
class WorldManager{
    constructor(world, lRadius){
        this.world = world || null;
        this.loadChunkRadius = lRadius;
    }
    grabPlayerLocation(){}
    collectInteractable(position, radius){}
    wildSpawnfield(chunkManager, floraManager, seed){}
    chunkUpdater(){
    }
    captureWildCreature(){}
}
class World{
    constructor(seed = 0){
        this.seed = seed;
        this.player = new Player({x:0,y:0,z:0}, 1);
        this.players = new Map();
        this.entities = new Map();
        this.worldEntities = new Set();
        this.chunkManager = new ChunkManager();
        this.floraManager = new FloraManager();
        this.worldManager = new WorldManager();
        this.combat = new CombatManager(this);
        this.tickRate = 24;
        this.IDIteration = {p: 0, e: 0}
    }
    addPlayer(player) {
        // player: { id, position, input, inventoryServiceRef, ... }
        this.players.set(player.id, player);
        // create starter roster entity etc.
    }

    spawnEntity(e) {
        if (e.id == null) e.id = `entity:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        this.entities.set(e.id, e);
        if (e instanceof Projectile || e instanceof AreaEffects) {
            this.worldEntities.add(e);
        }
        return e;
    }

    removeEntity(e) {
        this.entities.delete(e.id);
        this.worldEntities.delete(e);
    }

    processPlayerInput(player, dt) {
        // use the passed player object (should be a Player instance)
        const intent = (player && typeof player.mapCommandsToIntent === 'function')
            ? player.mapCommandsToIntent(player.input || {})
            : { move: null, ability: null };
         player.intent = intent;
    }

    processEntities(dt) {
        for (const ent of this.entities.values()) {
            if (ent instanceof Creature) {
                if (ent.type === 'wild' && !ent.intent) {
                    const bot = new Bot(ent);
                    bot.decide(this);
                }
                ent.tick(dt);
                if (ent.intent && ent.intent.move) {
                    ent.x += (ent.intent.move.x || 0) * dt;
                    ent.z += (ent.intent.move.z || 0) * dt;
                }
                if (ent.intent && ent.intent.ability) {
                    this.combat.resolveAbility(ent, ent.intent.ability.id, ent.intent.ability.target);
                }
            }
        }
    }

    processWorldEntities(dt) {
        for (const we of Array.from(this.worldEntities)) {
            if (we.tick) we.tick(dt);
            if (we instanceof AreaEffects && we.isExpired()) {
                this.removeEntity(we);
            }
            if (we instanceof Projectile && !we.alive) {
                this.removeEntity(we);
            }
        }
    }

    tick(dt = 1 / 60) {
        for (const player of this.players.values()) {
            this.processPlayerInput(player, dt);
            const cx = Math.floor(player.pos.x / 16);
            const cz = Math.floor(player.pos.z / 16);
            this.chunkManager.updateNearby(cx, cz, 2, this.seed);
        }
        this.processEntities(dt);
        this.combat.tick(dt);
        this.processWorldEntities(dt);

    }
}

//setup starter pick
//starter creature of either x, y, or z
//begin world generation 

class Scene {
    constructor() {
        this.world = new World(12345);
        this.stage = null;
    }
    starterPick(playerId, choice) {
        const speciesMap = { x: 'dog', y: 'cat', z: 'lizard' };
        const species = speciesMap[choice];
        if (!species) return;
        const creature = new Creature({ species, level: 1, type: 'roster' });
        // create and register a Player instance so player methods exist
        const player = new Player({ x: 0, y: 0, z: 0 }, playerId);
        this.world.addPlayer(player);
        this.world.spawnEntity(creature);
        const rosterService = new RosterService();
        rosterService.addToRoster(player.id, creature);
    }
    startGame() {
        this.stage = 'playing';
    }
}

const canvas = document.getElementById('game');
canvas.width = innerWidth;
canvas.height = innerHeight;
const ctx = canvas.getContext('2d');

// create scene / world from your file
const scene = new Scene();
const world = scene.world;

// create player and starter creature (mirrors Scene.starterPick)
const playerId = 'player1';
const player = new Player({x:0,y:0,z:0}, playerId);
world.addPlayer(player);

// spawn a roster creature and attach to player
const starter = new Creature({ species: 'dog', level: 1, x: 0, z: 0, type: 'roster' });
world.spawnEntity(starter);
player.roster = [starter];            // simple link for demo
player.activeCreatureId = starter.id; // runner will control this creature

// input state
const keys = { w:0,a:0,s:0,d:0, q:0 };
window.addEventListener('keydown', e => { if (e.key) keys[e.key.toLowerCase()] = 1; });
window.addEventListener('keyup', e => { if (e.key) keys[e.key.toLowerCase()] = 0; });

// helper to get controlled creature
function getActiveCreature() {
    return world.entities.get(player.activeCreatureId) || null;
}

// convert keys to simple intent
function updatePlayerIntent() {
    const c = getActiveCreature();
    if (!c) return;
    let vx = 0, vz = 0;
    if (keys.w) vz -= 1;
    if (keys.s) vz += 1;
    if (keys.a) vx -= 1;
    if (keys.d) vx += 1;
    // normalize
    const L = Math.hypot(vx, vz) || 1;
    vx /= L; vz /= L;
    // set intent on creature so World.processEntities will apply it
    c.intent = { move: { x: vx * 60, z: vz * 60 }, ability: null };
    if (keys.q) {
    // simple ability trigger: use 'bite' if available
    c.intent.ability = { id: 'bite', target: null };
    }
}

// simple render
function render() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // camera just centers on active creature
    const c = getActiveCreature();
    const camX = c ? c.x : 0;
    const camZ = c ? c.z : 0;

    // draw grid for reference
    ctx.strokeStyle = '#7d9ab7ff';
    ctx.lineWidth = 1;
    const scale = 2; // world -> screen scale
    for (let gx = -1000; gx <= 1000; gx += 32) {
    ctx.beginPath();
    ctx.moveTo((gx - camX) * scale + canvas.width/2, 0);
    ctx.lineTo((gx - camX) * scale + canvas.width/2, canvas.height);
    ctx.stroke();
    }

    // draw creatures
    for (const ent of world.entities.values()) {
    if (ent instanceof Creature) {
        const sx = (ent.x - camX) * scale + canvas.width/2;
        const sz = (ent.z - camZ) * scale + canvas.height/2;
        ctx.beginPath();
        ctx.fillStyle = ent === c ? '#ffcc66' : '#66aaff';
        const r = Math.max(4, (ent.size || 1) * 6);
        ctx.arc(sx, sz, r, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillText(ent.species + ' ' + Math.round(ent.currentHp || ent.stats.hp), sx - r, sz - r - 6);
    }
    }

    // draw worldEntities (projectiles / areas)
    for (const we of world.worldEntities) {
    if (we instanceof Projectile) {
        const sx = (we.x - camX) * scale + canvas.width/2;
        const sz = (we.z - camZ) * scale + canvas.height/2;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(sx, sz, 3, 0, Math.PI*2);
        ctx.fill();
    } else if (we instanceof AreaEffects) {
        const sx = (we.x - camX) * scale + canvas.width/2;
        const sz = (we.z - camZ) * scale + canvas.height/2;
        ctx.strokeStyle = 'rgba(255,100,0,0.4)';
        ctx.beginPath();
        ctx.arc(sx, sz, we.radius * scale, 0, Math.PI*2);
        ctx.stroke();
    }
    }
}

// game loop
let last = performance.now();
function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    updatePlayerIntent();
    // world.tick expects dt in seconds
    world.tick(dt);

    render();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// resize handling
window.addEventListener('resize', () => { canvas.width = innerWidth; canvas.height = innerHeight; });
