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
const world = {
    biomes: {
        // biome parameter definitions
        parameters: {
            desert: { heat: 1.0, humidity: 0.1 },
            plains: { heat: 0.5, humidity: 0.5 },
            tundra: { heat: 0.0, humidity: 0.2 },
        },

        shape(x, z, seed = 0) {
            // returns base biome scalar(s)
            const noise = math.fbm(x * 0.001, z * 0.001, 5);
            return noise;
        },

        weightsAtCell(x, z, seed = 0) {
            // convert shape values to biome weights
            const s = this.shape(x, z, seed);
            // trivial partition
            return {
                desert: math.clamp((s - 0.6) / 0.4, 0, 1),
                plains: math.clamp((s - 0.25) / 0.35, 0, 1),
                tundra: math.clamp((0.4 - s) / 0.4, 0, 1),
            };
        },

        biomeMix(x, z, seed = 0) {
            const w = this.weightsAtCell(x, z, seed);
            // normalize
            const sum = (w.desert + w.plains + w.tundra) || 1;
            return {
                desert: w.desert / sum,
                plains: w.plains / sum,
                tundra: w.tundra / sum,
            };
        },
    },
        heightfieldSample(x, z, seed = 0) {
        // sample height from noise-based heightfield
        const h = math.fbm(x * 0.0007 + seed * 1.1, z * 0.0007 - seed * 0.7, 6);
        // scale to world units
        return Math.floor(h * 200);
    },
        Chunk: class {
        constructor(cx, cz, size = 16) {
            this.cx = cx;
            this.cz = cz;
            this.size = size;
            this.blocks = null; // placeholder
            this.entities = new Set();
            this.generated = false;
        }

        generate(seed = 0) {
            this.blocks = [];
            for (let x = 0; x < this.size; x++) {
                this.blocks[x] = [];
                for (let z = 0; z < this.size; z++) {
                    const wx = this.cx * this.size + x;
                    const wz = this.cz * this.size + z;
                    const h = world.heightfieldSample(wx, wz, seed);
                    this.blocks[x][z] = { height: h, biome: world.biomes.biomeMix(wx, wz, seed) };
                }
            }
            this.generated = true;
        }
    },
    ChunkManager: class {
        constructor() {
            this.chunks = new Map(); // key "cx,cz" -> Chunk
        }

        key(cx, cz) {
            return `${cx},${cz}`;
        }

        getChunk(cx, cz) {
            const k = this.key(cx, cz);
            if (!this.chunks.has(k)) {
                const c = new world.Chunk(cx, cz);
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
    },
        FloraManager: class {
        constructor() {
            this.floraInstances = new Set();
        }

        spawnAt(x, z, biome, seed = 0) {
            // create flora instance placeholder
            const f = { x, z, biome, id: `${x},${z}:${Date.now()}` };
            this.floraInstances.add(f);
            return f;
        }

        queryArea(x0, z0, x1, z1) {
            // naive filter
            return Array.from(this.floraInstances).filter(
                (f) => f.x >= x0 && f.x <= x1 && f.z >= z0 && f.z <= z1
            );
        }
    },
    data: {
        biomes: ['desert', 'plains', 'tundra'],
        cosmeticFlora: [{ id: 'grass' }, { id: 'flower' }],
        interactableFlora: [{ id: 'berry_bush', lootTable: ['berries'] }],
        items: [{ id: 'berries', stack: 10 }],
    },
        collectInteractable(player, pos, radius = 2) {
        // placeholder: return items collected
        // TODO: query chunk/interactables
        return [];
    },

    wildSpawnfield(chunkManager, floraManager, seed = 0) {
        // generate wild spawn positions per chunk (placeholder)
        // returns list of spawn descriptors
        // return [{ species: 'rabbit', x: 0, z: 0 }];
    },

    chunkUpdater(worldInstance) {
        // stub for periodic chunk updates
        // e.g., flora growth, interactables regen
        // called by World.tick
    },
}

const entities = {
    data_composites: {
        composites: {
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
        },
        physicalMoveTypes: {
            smash: {flatBypass: [{hard: 0.1}], scaleBypass: []},
            drill: {flatBypass: [{tough: 0.1}], scaleBypass: []},
            slash: {flatBypass: [{elastic: 0.1}], scaleBypass: []},
            pierce: {flatBypass: [{porous: 0.1}], scaleBypass: []},
        }, //move effectiveness vs composites
        energyMoveTypes: {
            burn: {addSoak: [{temperature: 0.1}]},
            freeze: {addSoak: [{temperature: -0.1}]},
            electric: {addSoak: [{electricity: 0.1}]},
            water: {addSoak: [{water: 0.1}]},
            toxic: {addSoak: [{chemicals: 0.1}]},
        }, // can add soak in an entity's capacity
        energyMoveSoak: {
            water: {addHurt: [{electricHurt: 0.1}]},
            electricity: {addHurt: [{waterHurt: 0.1}]},
            freezing: {addHurt: [{tempHurt: 0.1}]},
            burning: {addHurt: [{tempHurt: 0.1}]},
            toxic: {addHurt: [{chemHurt: 0.1}]}
        },// entities can hurt depending on how many points in capacity
    },
    data_families: {
        families: {
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
        },
        species: {
            dog: {family: 'canine', sizeVariation: 1, ivVariationMultiplier: 5},
            cat: {family: 'feline', sizeVariation: 1, ivVariationMultiplier: 5},
            bear: {family: 'ursine', sizeVariation: 1, ivVariationMultiplier: 5},
            lizard: {family: 'reptile', sizeVariation: 1, ivVariationMultiplier: 5},
            bird: {family: 'avian', sizeVariation: 2, ivVariationMultiplier: 5},
            ant: {family: 'insect', sizeVariation: 3, ivVariationMultiplier: 5},
            crab: {family: 'crustacean', sizeVariation: 1, ivVariationMultiplier: 5},
        },
        base_movesets: {
            rabbit: [{ id: 'tackle', type: 'melee' }],
            wolf: [{ id: 'bite', type: 'melee' }],
        },
    },
    data_entity: {
        itemEffects: {
            red_berry: (target) => ({ effects: [{efc: {heal: 20}, times: 1, duration: 1} ]}),
            yellow_berry: (target) => ({ effects: [{efc: {pAtk: 5}, times: 1, duration: 1} ]}),
            green_berry: (target) => ({ effects: [{efc:{heal:10}, times: 4, duration: 5} ]}),
            blue_berry: (target) => ({ effects: [{efc:"revive", times: 1, duration: 1} ]}),
        },
    },

    // -----------------------------
    // entities/Player-Roster
    // -----------------------------
    RosterSystem: class {
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
    },

    CreatureStorage: class {
        constructor() {
            this.storage = new Map(); // id -> creature data
        }

        save(creature) {
            this.storage.set(creature.id, creature);
        }

        load(id) {
            return this.storage.get(id) || null;
        }
    },

    mapCommandsToIntent(playerInput) {
        // converts client commands to internal intent structure
        return { move: playerInput.move || null, ability: playerInput.ability || null };
    },

    collectWildCreature(spawnDescriptor) {
        const spec = entities.data.species[spawnDescriptor.species] || {};
        const c = new entities.Creature({
            id: `wild:${Date.now()}`,
            species: spawnDescriptor.species,
            level: spec.baseLevel || 1,
            x: spawnDescriptor.x,
            z: spawnDescriptor.z,
            mode: 'wild',
        });
        return c;
    },
    useItem(actor, itemId) {
        const effectFn = entities.data.itemEffects[itemId];
        if (effectFn) return effectFn(actor);
        return null;
    },
    Effects: class {
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
    },

    Cooldowns: class {
        constructor() {
            this.map = new Map();
        }
        set(key, cd) {
            this.map.set(key, cd);
        }
        tick(dt) {
            for (const [k, v] of this.map.entries()) {
                v -= dt;
                if (v <= 0) this.map.delete(k);
                else this.map.set(k, v);
            }
        }
        ready(key) {
            return !this.map.has(key);
        }
    },

    Creature: class {
        constructor({ id, species, level = 1, x = 0, z = 0, type = 'roster' } = {}) {
            this.id = id || `creature:${Date.now()}`;
            this.species = species || 'unknown';
            this.level = level;
            this.x = x;
            this.z = z;
            this.intent = null;
            this.type = mode; // 'wild' | 'roster' | 'boss'
            this.effects = new entities.Effects();
            this.cooldowns = new entities.Cooldowns();

            this.moveset = entities.data.movesets[this.species] || [];
            this.initialize(species)
        }
        initialize(spc){
            const rng = math.rng(this.id.length + this.level);
            const spec = entities.data_families.species[spc] || {};
            const fam = entities.data_families.families[spec.family] || {};
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
        }
        initializeComposites(fam){
            const family = fam || entities.data_families.families[entities.data_families.species[this.species].family];
            const outerComposite = family.outerComposite
            const innerComposite = family.innerComposite
            this.morphStage = 0;
            this.composites = { inner: innerComposite, outer: outerComposite };
            
            let immunes = []
            const temperatureBase = ((innerComposite.tempBase + outerComposite.tempBase) / 2);
            if (temperatureBase == 1) immunes.push('burning');
            if (temperatureBase == 0) immunes.push('freezing');
            if (outerComposite.electricHurt == 0.0 && innerComposite.electricHurt == 0.0) immunes.push('electricity');
            if (outerComposite.waterHurt == 0.0 && innerComposite.waterHurt == 0.0) immunes.push('water');
            if (outerComposite.chemHurt == 0.0 && innerComposite.chemHurt == 0.0) immunes.push('toxic');

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
            // movement/ability processing happens in services
        }
    },
    Bot: class {
        constructor(creature) {
            this.creature = creature;
            this.mode = auto; //wild must be autonomous, roster switches between autonomous, fully manual, or have auto movement with ability commands
        }
        decide(worldState) {
            this.creature.intent = { move: null, ability: null };
        }
    },
    LevelSystem: class {
        constructor() {}
        xpToLevel(xp) {
            return Math.floor(Math.sqrt(xp));
        }
        addXP(creature, xp) {
            // placeholder
            creature.level = this.xpToLevel((creature.xp || 0) + xp);
        }
    },

    MorphSystem: class {
        constructor() {}
        tryMorph(creature) {
            //use a morph item to change either composite
        }
    },

    Projectile: class {
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
            // collision checks should be done by World or CombatManager
        }
    },

    AreaEffects: class {
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
    },
};
const combat = {
    data: {
        moveCategories: ['melee', 'projectile', 'area'],
        abilities: {
            tackle: { category: 'melee', power: 5 },
            bite: { category: 'melee', power: 8 },
            spit: { category: 'projectile', power: 6 },
            fireBurst: { category: 'area', power: 12, radius: 3 },
        },
    },

    // -----------------------------
    // combat/mediate
    // -----------------------------
    AbilityTranslater: class {
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
                        projectile: new entities.Projectile({
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
                        area: new entities.AreaEffects({
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
    },

    CombatManager: class {
        constructor(worldInstance) {
            this.world = worldInstance;
            this.translater = new combat.AbilityTranslater(combat.data);
        }

        resolveAbility(owner, abilityId, target) {
            const action = this.translater.translate(owner, abilityId, target, this.world);
            if (!action) return;
            switch (action.type) {
                case 'damage':
                    target.hp -= action.amount;
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
    },
};
class World {
    constructor(seed = 0) {
        this.seed = seed;
        this.players = new Map(); // playerId -> player object
        this.entities = new Map(); // id -> entity (Creature, Projectile, AreaEffects)
        this.worldEntities = new Set(); // Projectiles/Areas
        this.chunkManager = new world.ChunkManager();
        this.floraManager = new world.FloraManager();
        this.combat = new combat.CombatManager(this);
        this.tickRate = 60;
    }

    addPlayer(player) {
        // player: { id, position, input, inventoryServiceRef, ... }
        this.players.set(player.id, player);
        // create starter roster entity etc.
    }

    spawnEntity(e) {
        if (e.id == null) e.id = `entity:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        this.entities.set(e.id, e);
        if (e instanceof entities.Projectile || e instanceof entities.AreaEffects) {
            this.worldEntities.add(e);
        }
        return e;
    }

    removeEntity(e) {
        this.entities.delete(e.id);
        this.worldEntities.delete(e);
    }

    processPlayerInput(player, dt) {
        //  (client to server)process player keys and options
        // map to intents
        const intent = entities.mapCommandsToIntent(player.input || {});
        // (InventoryService)process inventory requests - placeholder
        // (Roster/StorageService)process player roster/storage requests - placeholder
        // (map intent) overwrite bot intent if creature in manual - placeholder
        player.intent = intent;
    }

    processEntities(dt) {
        for (const ent of this.entities.values()) {
            if (ent instanceof entities.Creature) {
                // (BrainService) fill intent if auto
                if (ent.mode === 'wild' && !ent.intent) {
                    const bot = new entities.Bot(ent);
                    bot.decide(this); // sets ent.intent
                }
                // (EntityService) Request intents (move) then (ability)
                // (TimeService)Cooldowns check occurs in creature.tick
                ent.tick(dt);
                // resolve move intent -> change position (placeholder)
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
            if (we instanceof entities.AreaEffects && we.isExpired()) {
                this.removeEntity(we);
            }
            if (we instanceof entities.Projectile && !we.alive) {
                this.removeEntity(we);
            }
        }
    }

    tick(dt = 1 / 60) {
        // For each player
        for (const player of this.players.values()) {
            this.processPlayerInput(player, dt);
            // send position data to ChunkService & Interactables & spawnfield (placeholder)
            const cx = Math.floor(player.position.x / 16);
            const cz = Math.floor(player.position.z / 16);
            this.chunkManager.updateNearby(cx, cz, 2, this.seed);
        }

        // For each entity
        this.processEntities(dt);

        // Combat and time services
        this.combat.tick(dt);

        // For each worldEntity
        this.processWorldEntities(dt);

        // global world updates (flora growth / interactables)
        world.chunkUpdater(this);

        // send data to clients (placeholder)
        //for JS, data goes to UI
    }
}

// -----------------------------
// instance creations & helpers
// -----------------------------
function starterEntity(species = 'rabbit', x = 0, z = 0) {
    return new entities.Creature({
        id: `starter:${Date.now()}`,
        species,
        level: 1,
        x,
        z,
        mode: 'roster',
    });
}

function captureWild(worldInstance, wildCreature, playerRoster) {
    // remove wild creature and add to player's roster as new creature (simplified)
    worldInstance.removeEntity(wildCreature);
    const tamed = new entities.Creature({
        id: `roster:${Date.now()}`,
        species: wildCreature.species,
        level: wildCreature.level,
        x: wildCreature.x,
        z: wildCreature.z,
        mode: 'roster',
    });
    playerRoster.push(tamed);
    return tamed;
}
