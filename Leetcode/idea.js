const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

//helpers
function clamp(v,min,max){
    return Math.max(min,Math.min(max,v))
}
function deepClone(obj){
    return JSON.parse(JSON.stringify(obj))
}
function makeStats(fill = 0){
    return{
        pAtk: fill, eAtk: fill, range: fill, //melee
        maxHP:fill, spd: fill, castSpd: fill,
        size: fill, stamina: fill, energy: fill,
        recoverStamina: fill, recoverEnergy: fill,
    }
}
function addStats(a,b){
    return{
        pAtk: (a.pAtk??0) + (b.pAtk??0),
        eAtk: (a.eAtk??0) + (b.eAtk??0),
        range: (a.range??0) + (b.range??0),
        maxHP: (a.maxHP??0) + (b.maxHP??0),
        spd: (a.spd??0) + (b.spd??0),
        castSpd: (a.castSpd??0) + (b.castSpd??0),
        size: (a.size??0) + (b.size??0),
        stamina: (a.stamina??0) + (b.stamina??0),
        energy: (a.energy??0) + (b.energy??0),
        recoverStamina: (a.recoverStamina??0) + (b.recoverStamina??0), //recovers x per second
        recoverEnergy: (a.recoverEnergy??0) + (b.recoverEnergy??0),
    }
}
function multStats(a,b){
    return{
        pAtk: (a.pAtk??1) * (b.pAtk??1),
        eAtk: (a.eAtk??1) * (b.eAtk??1),
        range: (a.range??1) * (b.range??1),
        maxHP: (a.maxHP??1) * (b.maxHP??1),
        spd: (a.spd??1) * (b.spd??1),
        castSpd: (a.castSpd??1) * (b.castSpd??1),
        size: (a.size??1) * (b.size??1),
        stamina: (a.stamina??1) * (b.stamina??1),
        energy: (a.energy??1) * (b.energy??1),
        recoverStamina: (a.recoverStamina??1) * (b.recoverStamina??1),
        recoverEnergy: (a.recoverEnergy??1) * (b.recoverEnergy??1),
    }
}



//effectiveness: overall ability effectiveness against the creature, based on solid,liquid,gas 
//properties: old way of calculating extra base stats, might be defunct compared to effectiveness and hurtscale
//hurtScale: energy atk effectiveness, may include physical atks in replacement of properties
//statBoost: stat boost per 5 size units when initializing or morphing a creature
//maybe add recovery stat for stamina and energy: some soaks slow it down/speed it up/restore it for certain comps, etc
const composites = {
    animal: {
        name: "animal", effectiveness:{physical: 1, energy: 1}, 
        eHurtScale: {tempChange: 1, chem: 1, water: 0.75, electric: 1},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        baselines: {temp: 0.5, water: 0, electric: 0.0, chemical: 0}, //The ratio of capacity soaks that it will bleed to.
        capacityScale: {water: 1, electric: 1, chemical: 1},
        tempCapHot: 1,   // how much positive temp deviation it can absorb per size unit
        tempCapCold: 1,  // how much negative temp deviation it can absorb per size unit
        tempThresholds: {hot: 0.7, cold: 0.3},
        statBoost: {pAtk: 1, eAtk: 0, maxHP:1, spd: 0},
        specialEffects: []
    },
    plant: {
        name: "plant", effectiveness:{physical: 1, energy: 1}, 
        eHurtScale: {tempChange: 1.5, chem: 1, water: 0.75, electric: 1},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        baselines: {temp: 0.5, water: 0.1, electric: 0.1, chemical: 0},
        capacityScale: {water: 1, cold: 1, hot: 1, electric: 1, chemical: 1}, //per 1 size unit
        tempThresholds: {hot: 0.6, cold:0.4},
        statBoost: {maxHP:1, pAtk: 1, eAtk: 0, spd: 0},
        specialEffects: ["waterHeal"]
    },
    water: {
        name: "water", effectiveness:{physical: 0.75, energy: 1.25}, 
        eHurtScale: {tempChange: 1.25, chem: 1, water: 0.75, electric: 1.5},
        pHurtScale: {pierce: 0.75, slash: 0.75, impact: 1.25, drill: 1},
        baselines: {temp: 0.5, water: 1, electric: 0, chemical: 0},
        capacityScale: {water: 2, cold: 1, hot: 1, electric: 2, chemical: 1},
        tempThresholds: {hot: 0.7, cold:0.3},
        statBoost: {maxHP:2, pAtk: 0, eAtk: 2, spd: 1},
        specialEffects: ["waterAdd"]
    },
    voltage: {
        name: "voltage", effectiveness:{physical: 1.5, energy: 0.75}, 
        eHurtScale: {tempChange: 0.5, chem: 0.5, water: 0.5, electric: 0.5},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        baselines: {temp: 0.5, water: 0, electric: 1, chemical: 0},
        capacityScale: {water: 1, cold: 0.5, hot: 0.5, electric: 2, chemical: 1},
        tempThresholds: {hot: 1, cold:0.0},
        statBoost: {maxHP:0, pAtk: 0, eAtk: 3, spd: 3},
        specialEffects: ["waterVolt"]
    },
    fire: {
        name: "fire", effectiveness:{physical: 0.5, energy: 1.75}, 
        eHurtScale: {tempChange: 1.5, chem: 0.5, water: 1.5, electric: 0.5},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        baselines: {temp: 0.9, water: 0, electric: 1, chemical: 0},
        capacityScale: {water: 1, cold: 3, hot: 1, electric: 1, chemical: 1},
        tempThresholds: {hot: 1, cold:0.8},
        statBoost: {maxHP:0, pAtk: 0, eAtk: 3, spd: 3},
        specialEffects: ["fireUp", "burnoff"]
    },
    frost: {
        name: "frost", effectiveness:{physical: 0.5, energy: 0.75},
        eHurtScale: {tempChange: 1.5, chem: 0.25, water: 0.75, electric: 0.75},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        baselines: {temp: 0.1, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, electric: 0.5, chemical: 0.5},
        tempCapHot: 2,   // large — tolerates a lot of heat before threshold
        tempCapCold: 2,
        tempThresholds: {hot: 0.3, cold: 0},
        statBoost: {maxHP:3, pAtk: 2, eAtk: 2, spd: 0},
        specialEffects: []
    },
    lava: {
        name: "lava", effectiveness:{physical: 0.75, energy: 0.75},
        eHurtScale: {tempChange: 0.5, chem: 0.25, water: 1.5, electric: 0.5},
        pHurtScale: {pierce: 0.75, slash: 0.75, impact: 1.25, drill: 1},
        baselines: {temp: 0.9, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, cold: 2, hot: 2, electric: 0.5, chemical: 0.5},
        tempThresholds: {hot: 1, cold:0.8},
        statBoost: {maxHP:3, pAtk: 2, eAtk: 2, spd: 0},
        specialEffects: ["waterHarden", "fireUp", "burnoff"]
    },
    ice: {
        name: "ice", effectiveness:{physical: 0.75, energy: 0.75},
        eHurtScale: {tempChange: 1.5, chem: 0.25, water: 1, electric: 0.5},
        pHurtScale: {pierce: 1.5, slash: 0.75, impact: 1.75, drill: 1},
        baselines: {temp: 0.2, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, cold: 2, hot: 2, electric: 0.5, chemical: 0.5},
        tempThresholds: {hot: 0.3, cold:0},
        statBoost: {maxHP:3, pAtk: 2, eAtk: 2, spd: 0},
        specialEffects: ["waterHarden", "solidIce"]
    },
    rock: {
        name: "rock", effectiveness:{physical: 1, energy: 0.5},
        eHurtScale: {tempChange: 0.5, chem: 0.25, water: 1.5, electric: 0.25},
        pHurtScale: {pierce: 0.5, slash: 0.5, impact: 1.25, drill: 1.5},
        baselines: {temp: 0.9, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, cold: 1, hot: 1, electric: 1, chemical: 1},
        tempThresholds: {hot: 0.7, cold:0.3},
        statBoost: {maxHP:3, pAtk: 5, eAtk: 0, spd: 0},
        specialEffects: ["hardSurface"]
    },
    metal: {
        name: "metal", effectiveness:{physical: 0.75, energy: 1.25},
        eHurtScale: {tempChange: 0.5, chem: 0.5, water: 1, electric: 0.25},
        pHurtScale: {pierce: 0.5, slash: 0.5, impact: 1.25, drill: 1},
        baselines: {temp: 0.5, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, electric: 1.5, chemical: 0.5},
        tempCapHot: 1.5, tempCapCold: 0.5,
        tempThresholds: {hot: 0.8, cold: 0.2},
        statBoost: {pAtk: 3, eAtk: 0, maxHP: 2, spd: 0},
        specialEffects: []
    },
}

const tempStates = {
    sweltering: { effect: "melt", vulnerability: ["slash", "pierce", "drill"] },
    freezing:   { effect: "brittle", vulnerability: ["impact"] },
    normal:     { effect: "none", vulnerability: [] }
}
//might rework to make effects return functions for additional tick
const soakEffects = {
    water:    {name: "water",    effect: "none",   vulnerability: ["electric"], boost: "none",   per: 1},
    electric: {name: "electric", effect: "damage", vulnerability: [],           boost: "energy", per: 1},
    chemical: {name: "chemical", effect: "damage", vulnerability: [],           boost: "none",   per: 1},
}
const specialEffects = {
    waterVolt: {
        name: "Retain Voltage With Water",
        desc: "When soaked with water, retain electricity. Reduces physical attack effectiveness against creature by 0.25.",
        effect: null //put in function later for additional creature tick
    },
    waterHarden: {
        name: "Water Hardening",
        desc: "When soaked with water, solidify magma. The igneous rock boosts HP but reduces speed and energy attacks.",
        effect: null,
    },
    waterCrystal: {
        name: "Water Crystalized",
        desc: "When soaked with water, consume at a rate based on size to crystalize it as max HP.",
        effect: null,
    },
    solidIce: {
        name: "Solid Ice",
        desc: "When current temperature is scaled under 0.1, nullify all soak damage over time and vulnerability"
    },
    waterAdd: {
        name: "Water On Water",
        desc: "When soaked with water, add flat HP per water units."
    },
    waterHeal: {
        name: "Water Healing",
        desc: "Instead of normal water soak depletion, the creature consumes it to heal 1 health per 1 water unit"
    },
    fireUp: {
        name: "Fired up",
        desc: "When gaining heat, boost energy attacks from this creature."
    },
    burnoff: {
        name: "Burnoff",
        desc: "All soaks burn off twice as fast on this creature."
    },
    hardSurface:{
        name:"Hard Surface",
        desc: "All non-temperature soaks are consumed instantly as half damage on this creature"
    }
}
const abilities = {
    ram: {
        name: "ram", category: "melee", flatDmg: {p: 10, e: 0}, dmgScale: {p: 0.5, e: 0}, cooldown: 100,
        effects: [], soakAdd: [], args: [{maxCastRange:25}, {dash: {spd: 10, decay: "none"}}]//life? maybe until it actually hits
    },
    frostAOEInst: {
        name: "Frost Churn", category: "AOEInstant", flatDmg: {p: 0, e: 5}, dmgScale: {p: 0, e: 0.75}, cooldown: 200,
        effects: [], soakAdd: [{}], args: [{delayStart:10}, {maxCastRange:50}, {radius:50}, {pos: "fixed"}] //args arbitrary until theres a function/class to process it
    },
    frostAOELinger: {
        name: "Frost Wind", category: "AOELinger", flatDmg: {p: 0, e: 1}, dmgScale: {p: 0, e: 0.2}, cooldown: 200,
        effects: [], soakAdd: [], args: [{delayStart:0}, {maxCastRange:50}, {radius:50}, {pos: "anchorToEntity"}, {dps: 20}, {life: 100}] //just for planning, etc
    },
    zap: {
        name: "Zap", category: "Hitscan", flatDmg: {p: 0, e: 20}, dmgScale: {p: 0, e: 0.8}, cooldown: 100,
        effects: [], soakAdd: [{electric:3}], args: []
    }
}
const temporary = { //lazy
    baseStats: {pAtk: 10, eAtk: 0, maxHP:100, spd: 10, castSpd: 100, range: 10, size: 10, stamina: 20, energy: 0},
    morphStats: {pAtk: 10, eAtk: 0, maxHP:100, spd: 10, castSpd: 100, range: 10, size: 10, stamina: 20, energy: 0},
    maxVariation: {pAtk: 5, eAtk: 5, maxHP:20, spd: 10, castSpd: 50, range: 0, size: 5, stamina: 10, energy: 10},
    levelUp: {pAtk: 2, eAtk: 2, maxHP:10, spd: 5, castSpd: 10, range: 1, size: 1, stamina: 5, energy: 5},
    baseMoveset: ["ram"]
}
const species = {
    dog: {
        name: "Dog", baseStats: temporary.baseStats, maxVariation: temporary.maxVariation,
        levelUpBoost: temporary.levelUp, baseMoveset: temporary.baseMoveset,
        commonComp: {inner: ["animal"], outer: ["animal"]},
        morphs: { 
            stage1: { //add stuff for more base stats
                armoredDog: {name:"Steel Dog", composite: {inner: "animal", outer:"metal"}, morphPointsNeeded: [{metal: 50}], morphNeeded: "none",
                    baseStats: temporary.morphStats, allowedMoves: []
                },
                cyberDog: {name:"Cyber Dog", composite: {inner: "metal", outer:"animal"}, morphPointsNeeded: [{metal: 20}, {electric:20}],morphNeeded: "none",
                    baseStats: temporary.morphStats, allowedMoves: []
                },
            },
            stage2: {} //probably more base stats, allowed moves
        }
    },
    shrubling: {
        name: "Shrubling", baseStats: temporary.baseStats, maxVariation: temporary.maxVariation,
        levelUpBoost: temporary.levelUp,  baseMoveset: temporary.baseMoveset,
        commonComp: {inner: ["plant"], outer: ["plant"]}
    },
}


// global stuff
class TimeManager {
    constructor() {this.systems = [];}
    add(system) {this.systems.push(system);}
    remove(system) {this.systems = this.systems.filter(s => s !== system);}
    update(dt) {
        for (const s of this.systems) {
            if (s && typeof s.update === "function") s.update(dt);            
        }
    }
}
class Space {
    constructor(width, height) {
        this.width  = width;
        this.height = height;
    }
    clamp(x, z) {return {x: Math.max(0, Math.min(this.width,  x)),z: Math.max(0, Math.min(this.height, z))};}
    randomPoint() {return {x: Math.random() * this.width,z: Math.random() * this.height};
    }
}
class Camera {
    constructor() {
        this.x      = 0;
        this.z      = 0;
        this.zoom   = 3;
        this.target = null;
    }
    follow(entity) {this.target = entity;}
    worldToScreen(x, z) {return {sx: (x - this.x) * this.zoom + canvas.width  / 2,sz: (z - this.z) * this.zoom + canvas.height / 2};}
    screenToWorld(sx, sz) {return {x: (sx - canvas.width  / 2) / this.zoom + this.x,z: (sz - canvas.height / 2) / this.zoom + this.z};}

    update(dt) {
        if (!this.target) return;
        const lerp = 10 * dt;
        this.x += (this.target.x - this.x) * lerp;
        this.z += (this.target.z - this.z) * lerp;
    }
}
class World {
    constructor(space) {
        this.space       = space;
        this.entities    = [];
        this.projectiles = [];
        this.areaEffects = [];
        this.spawnField = null;
    }
    addEntity(e)      { this.entities.push(e);      return e; }
    addProjectile(p)  { this.projectiles.push(p);   return p; }
    addAreaEffect(a)  { this.areaEffects.push(a);   return a; }
    setSpawnField(field) {this.spawnField = field;}
    update(dt) {
        if (this.spawnField) {
            this.spawnField.update(dt);
        }
        this.entities.forEach(e    => e.update(dt, this));
        this.projectiles.forEach(p => p.update(dt, this));
        this.areaEffects.forEach(a => a.update(dt, this));

        this.entities    = this.entities.filter(e => e.alive);
        this.projectiles = this.projectiles.filter(p => p.alive);
        this.areaEffects = this.areaEffects.filter(a => a.alive);
    }
    draw(ctx, camera) {
        ctx.fillStyle = "#6aa56a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.areaEffects.forEach(a => a.draw(ctx, camera));
        this.entities.forEach(e    => e.draw(ctx, camera));
        this.projectiles.forEach(p => p.draw(ctx, camera));
    }
}
class SpawnField {
    constructor(world, player, options = {}) {
        this.world  = world;
        this.player = player;
        this.radius          = options.radius || 120;
        this.innerNoSpawn    = options.innerNoSpawn || 40; 
        this.maxWild         = options.maxWild || 6;
        this.spawnInterval   = options.spawnInterval || 2.5;
        this.timer = 0;
        this.speciesPool = options.speciesPool || ["dog", "shrubling"];
    }
    update(dt) {
        this.timer += dt;
        if (this.timer >= this.spawnInterval) {this.timer = 0;this.trySpawn();}
        this.cleanup();
    }
    trySpawn() {
        const currentWild = this.world.entities.filter(e => e instanceof WildEntity).length;
        if (currentWild >= this.maxWild) return;
        const speciesKey = this.speciesPool[Math.floor(Math.random() * this.speciesPool.length)];
        const pos = this.randomSpawnPoint();
        if (!pos) return;
        const factory = new CreatureFactory(speciesKey, "wild", 0, 1);
        const creature = factory.createEntity();
        this.world.addEntity(new WildEntity(this.world, creature, pos.x, pos.z));
    }
    randomSpawnPoint() {
        const px = this.player.x;
        const pz = this.player.z;
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist  = this.innerNoSpawn + Math.random() * (this.radius - this.innerNoSpawn);
            const x = px + Math.cos(angle) * dist; const z = pz + Math.sin(angle) * dist;
            if (x < 0 || x > this.world.space.width) continue;
            if (z < 0 || z > this.world.space.height) continue;
            return { x, z };
        }
        return null;
    }
    cleanup() {
        const px = this.player.x;
        const pz = this.player.z;
        this.world.entities = this.world.entities.filter(e => {
            if (!(e instanceof WildEntity)) return true;
            const dx = e.x - px;
            const dz = e.z - pz;
            const dist = Math.hypot(dx, dz);

            if (dist > this.radius * 1.8) { 
                return false; 
            }
            return true;
        });
    }
}
const MorphService = {
    canMorph(creature, morphKey) {
        const spec = species[creature.species];
        const morph = spec.morphs.stage1[morphKey]; // check stage
        if (!morph) return false;
        return morph.morphPointsNeeded.every(req => {
            const [mat, amt] = Object.entries(req)[0];
            return (creature.morphPoints?.[mat] ?? 0) >= amt;
        });
    },
    applyMorph(creature, morphKey) {
        if (!MorphService.canMorph(creature, morphKey)) return false;
        const spec = species[creature.species];
        const morph = spec.morphs.stage1[morphKey];
        creature.composites = morph.composite;
        creature.morphPath = morphKey;
        creature.morphStage = 1;

        const allComps = [morph.composite.inner, morph.composite.outer]; // strings, not arrays
        const factory = new CreatureFactory(creature.species, null, creature.team, 1);
        creature.soakCap      = factory.initSoakCaps(creature.baseStats.size, allComps);
        const tempCaps        = factory.initTempCaps(creature.baseStats.size, allComps);
        creature.tempCapHot   = tempCaps.hot;
        creature.tempCapCold  = tempCaps.cold;
        creature.soakBaseline = factory.initSoakBaselines(allComps);
        creature.tempRatio    = factory.calcTempRatio(creature);
        
        recomputeModifiedStats(creature);
        return true;
    }
};
const LevelService = {
    ensure(creature) {
        if (!creature.level)   creature.level = 1;
        if (!creature.xp)      creature.xp = 0;
        if (!creature.nextXP)  creature.nextXP = 10;
        if (!creature.baseStats) {
            creature.baseStats = { ...creature.stats };
        }
    },
    xpNeeded(level) {
        return 10 * level; // same simple curve
    },
    recomputeStats(creature) {
        recomputeModifiedStats(creature);
    },
    addXP(creature, amount) {
        if (amount <= 0) return;
        LevelService.ensure(creature);
        creature.xp += amount;
        while (creature.xp >= creature.nextXP) {
            creature.xp -= creature.nextXP;
            creature.level += 1;
            creature.nextXP = LevelService.xpNeeded(creature.level);
            LevelService.recomputeStats(creature);
        }
    }
};
function recomputeModifiedStats(creature) {
    const base = creature.baseStats;
    const L = creature.level ?? 1;
    const spec = species[creature.species];

    // level bonus scales species.levelUpBoost per level gained
    const lvlBonus = makeStats(0);
    for (const key in lvlBonus) {
        lvlBonus[key] = (spec.levelUpBoost?.[key] ?? 0) * (L - 1);
    }

    // morph bonus from composite statBoosts if morphed
    let morphBonus = makeStats(0);
    if (creature.morphPath) {
        const stageKey = `stage${creature.morphStage}`;
        const morph = spec.morphs?.[stageKey]?.[creature.morphPath];
        if (morph) {
            const allComps = [morph.composite.inner, morph.composite.outer];
            const size = base.size + lvlBonus.size; // use grown size for scaling
            allComps.forEach(compKey => {
                const comp = composites[compKey];
                if (!comp?.statBoost) return;
                const multiplier = size / 5;
                const boost = Object.fromEntries(
                    Object.entries(comp.statBoost).map(([k, v]) => [k, v * multiplier])
                );
                morphBonus = addStats(morphBonus, boost);
            });
        }
    }

    creature.modifiedStats = addStats(addStats(base, lvlBonus), morphBonus);
    creature.currentHP = Math.min(creature.currentHP, creature.modifiedStats.maxHP);
}

//Creature
let newID = 0
class Creature{
    constructor(pos, species, team){
        this.pos = pos; this.vel = {x:0,z:0};
        this.angle = 0; this.angVel = 0; //in rads rn
        this.species = species;
        this.team = team; this.id = newID++; this.isDead = false;

        this.baseStats = makeStats();
        this.modifiedStats = makeStats();
        this.composites = null; this.morphStage = 0;
        this.soaks =        { water: 0, electric: 0, temp: 0, chemical: 0 }
        this.soakCap =      { water: 0, electric: 0, chemical: 0 }
        this.soakBaseline = { water: 0, electric: 0, temp: 0, chemical: 0 }
        this.tempCapHot  = 0;   // max positive temp deviation
        this.tempCapCold = 0;   // max negative temp deviation (stored as positive)
        this.tempRatio   = null; // derived each tick
    }
}
function getTempState(creature) {
    const ratio = creature.tempRatio; // baseline + offset
    const thresholds = getCompositeThresholds(creature); // averaged across composites
    if (ratio >= thresholds.hot) return "sweltering";
    if (ratio <= thresholds.cold) return "freezing";
    return "normal";
}
function getCompositeThresholds(creature) {
    const inner = Array.isArray(creature.composites.inner) 
        ? creature.composites.inner : [creature.composites.inner];
    const outer = Array.isArray(creature.composites.outer) 
        ? creature.composites.outer : [creature.composites.outer];
    const comps = [...inner, ...outer];
    let hot = 0, cold = 0;
    comps.forEach(key => {
        hot  += composites[key].tempThresholds.hot;
        cold += composites[key].tempThresholds.cold;
    });
    return { hot: hot / comps.length, cold: cold / comps.length };
}
//ufncion or class?
class CreatureFactory{
    constructor(type, origin, teamNumber, amtOfTeams){
        this.type = type
        this.origin = origin;
        this.teamNumber = teamNumber;
        this.amtOfTeam = amtOfTeams;
    }
    spawnpoint(){
        for(let i = 0; i < 100; i++){
            let pos = {x: Math.random()*1000, z: Math.random()*1000} //placeholder, make sure to spawn within bounds and not on top of other creatures
            if(this.isValidSpawn(pos)) return pos;
        }
    }
    createEntity() {
        const spec = species[this.type];
        const comp = spec.commonComp; // {inner: [...], outer: [...]}
        const allComps = [...comp.inner, ...comp.outer];

        // 1. Roll stats
        const stats = this.rollEntityStats(this.type, allComps);

        // 2. Roll moveset
        const moveset = this.rollStarterEntityMoves(this.type);

        // 3. Build creature
        const pos = this.spawnpoint();
        const creature = new Creature(pos, this.type, this.teamNumber);

        creature.level = 1;
        creature.baseStats = stats;
        creature.modifiedStats = { ...stats };
        creature.composites = comp;
        creature.morphStage = 0;
        creature.morphPath = null; // e.g. "armoredDog" once morphed

        // 4. Current resource pools
        creature.currentHP = stats.maxHP;
        creature.currentStamina = stats.stamina;
        creature.currentEnergy = stats.energy;

        // 5. Recovery rates (can be tweaked per composite later)
        creature.recovery = { stamina: 2, energy: 1 };

        // 6. Init soaks
        creature.soakCap      = this.initSoakCaps(stats.size, allComps);
        creature.soakBaseline = this.initSoakBaselines(allComps);
        const tempCaps        = this.initTempCaps(stats.size, allComps);
        creature.tempCapHot   = tempCaps.hot;
        creature.tempCapCold  = tempCaps.cold;
        creature.soaks        = { ...creature.soakBaseline, temp: 0 }; // temp offset starts at 0
        creature.tempRatio    = this.calcTempRatio(creature);

        // 7. Per-creature cooldown state
        creature.moveset = moveset;
        creature.cooldowns = {};
        moveset.forEach(key => creature.cooldowns[key] = 0);

        // 8. Active status effects
        creature.statusEffects = [];
        creature.tameProgress = 0;
        creature.isDead = false; // fixed the global bug

        return creature;
    }
    initSoakCaps(size, compKeys) {
        const cap = { water: 0, electric: 0, chemical: 0 };
        compKeys.forEach(key => {
            const scale = composites[key].capacityScale;
            for (const s in cap) cap[s] += (scale[s] ?? 1) * size;
        });
        return cap;
    }
    initTempCaps(size, compKeys) {
        let hot = 0, cold = 0;
        compKeys.forEach(key => {
            const comp = composites[key];
            hot  += (comp.tempCapHot  ?? 1) * size;
            cold += (comp.tempCapCold ?? 1) * size;
        });
        return { hot, cold };
    }
    initSoakBaselines(compKeys) {
        const base = { water: 0, electric: 0, temp: 0, chemical: 0 };
        compKeys.forEach(key => {
            const bl = composites[key].baselines;
            for (const s in base) base[s] += (bl[s] ?? 0) / compKeys.length;
        });
        return base;
    }
    calcTempRatio(creature) {
        const baseline = creature.soakBaseline.temp; // e.g. 0.9 for fire
        const offset   = creature.soaks.temp;        // signed deviation
        if (offset >= 0) {
            return baseline + (offset / (creature.tempCapHot  || 1)) * (1 - baseline);
        } else {
            return baseline + (offset / (creature.tempCapCold || 1)) * baseline;
        }
    }
    rollEntityStats(speciesKey, compositesKeys) {
        const spec = species[speciesKey];
        let finalStats = addStats(spec.baseStats, this.generateVariation(spec.maxVariation));
        compositesKeys.forEach(key => {
            const comp = composites[key];
            if (comp.statBoost) {
                // If size is 10, and boost is per 5 units, mult by 2
                const multiplier = finalStats.size / 5; 
                const boost = this.scaleStats(comp.statBoost, multiplier);
                finalStats = addStats(finalStats, boost);
            }
        });
        return finalStats;
    }
    generateVariation(maxVariation) {
        const v = makeStats(0);
        for (const key in maxVariation) {
            v[key] = Math.round((Math.random() ) * (maxVariation[key] ?? 0));
        }
        return v;
    }
    scaleStats(statBoost, multiplier) {
        const out = makeStats(0);
        for (const key in statBoost) {
            out[key] = (statBoost[key] ?? 0) * multiplier;
        }
        return out;
    }
    rollStarterEntityMoves(speciesKey) {
        return [...species[speciesKey].baseMoveset];
    }
    isValidSpawn(){
        return true;
    }
}

// test
const factory = new CreatureFactory("dog", "wild", 0, 1);
const c = factory.createEntity();
console.log("base stats:", c.baseStats);
console.log("temp ratio:", c.tempRatio);

LevelService.addXP(c, 50);
console.log("after level up:", c.level, c.modifiedStats);

// force morph — bypass point check
c.morphPoints = { metal: 20, electric: 20 };
MorphService.applyMorph(c, "cyberDog");
console.log("after morph:", c.composites, c.soakCap, c.tempCapHot);

LevelService.addXP(c, 100);
console.log("after level up:", c.level, c.modifiedStats);

class TemporaryArena {
    constructor(teams, entOnEach, options = {}) {
        this.teamNumber = teams;
        this.entityOnEach = entOnEach;

        this.teamList = [];
        this.allCreatures = [];

        this.width = options.width ?? 1000;
        this.height = options.height ?? 1000;

        this.started = false;
        this.ended = false;
        this.winnerTeam = null;

        this.time = 0;
        this.round = 0;
    }

    initTeams() {
        this.teamList = [];
        this.allCreatures = [];

        for (let teamID = 0; teamID < this.teamNumber; teamID++) {
            const team = [];

            for (let j = 0; j < this.entityOnEach; j++) {
                const factory = new CreatureFactory("dog", "arena", teamID, this.teamNumber);
                const creature = factory.createEntity();

                creature.team = teamID;
                creature.arenaSlot = j;

                team.push(creature);
                this.allCreatures.push(creature);
            }

            this.teamList.push(team);
        }
    }

    placeTeams() {
        const centerX = this.width / 2;
        const centerZ = this.height / 2;
        const teamRadius = Math.min(this.width, this.height) * 0.35;

        for (let teamID = 0; teamID < this.teamList.length; teamID++) {
            const team = this.teamList[teamID];
            const teamAngle = (teamID / this.teamList.length) * Math.PI * 2;

            const teamCenterX = centerX + Math.cos(teamAngle) * teamRadius;
            const teamCenterZ = centerZ + Math.sin(teamAngle) * teamRadius;

            for (let i = 0; i < team.length; i++) {
                const creature = team[i];
                const offset = (i - (team.length - 1) / 2) * 30;

                creature.pos.x = teamCenterX + Math.cos(teamAngle + Math.PI / 2) * offset;
                creature.pos.z = teamCenterZ + Math.sin(teamAngle + Math.PI / 2) * offset;
            }
        }
    }

    start() {
        this.initTeams();
        this.placeTeams();
        this.started = true;
        this.ended = false;
        this.winnerTeam = null;
        this.time = 0;
        this.round = 1;
    }

    getLivingCreatures() {
        return this.allCreatures.filter(c => !c.isDead);
    }

    getLivingTeams() {
        return this.teamList
            .map((team, index) => ({
                teamID: index,
                members: team.filter(c => !c.isDead)
            }))
            .filter(t => t.members.length > 0);
    }

    getEnemiesOf(creature) {
        return this.getLivingCreatures().filter(c => c.team !== creature.team);
    }

    findNearestEnemy(creature) {
        const enemies = this.getEnemiesOf(creature);
        if (enemies.length === 0) return null;

        let best = enemies[0];
        let bestDist = Infinity;

        for (const enemy of enemies) {
            const dx = enemy.pos.x - creature.pos.x;
            const dz = enemy.pos.z - creature.pos.z;
            const dist = Math.hypot(dx, dz);

            if (dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }

        return best;
    }

    checkWinner() {
        const livingTeams = this.getLivingTeams();

        if (livingTeams.length <= 1) {
            this.ended = true;
            this.winnerTeam = livingTeams.length === 1 ? livingTeams[0].teamID : null;
            return true;
        }

        return false;
    }

    step(dt) {
        if (!this.started || this.ended) return;
        this.time += dt;
        for (const creature of this.getLivingCreatures()) {
            const target = this.findNearestEnemy(creature);
            if (!target) continue;

        }

        this.checkWinner();
    }

    run(maxSteps = 1000, dt = 0.1) {
        let steps = 0;

        while (!this.ended && steps < maxSteps) {
            this.step(dt);
            steps++;
        }

        return {
            ended: this.ended,
            winnerTeam: this.winnerTeam,
            steps
        };
    }
}
class Brain {
    constructor() {
        this.host = null;
        this.observedCreatures   = [];
        this.enemyCreatures      = [];
        this.observedProjectiles = [];
        this.enemyProjectiles    = [];

        this.type           = 'wild';
        this.mode           = 'auto';
        this.nature         = 'passive';
        this.followDistance = 0;
        this.leashDistance  = 0;
        this.aggroRange     = 60;

        this.targetFocus = null;
        this.viable      = { move: 1, fight: 1 };
        this.commit      = { target: 1, movePlan: 1, actionPlan: 1 };
        this.redecide    = false;
        this.intentRequest = this._makeEmptyIntent();
    }

    _makeEmptyIntent() {
        return { move: { x: 0, z: 0 }, ability: null, targetId: null, aimAt: null, dodge: false };
    }

    think(world, dt) {
        if (!this.host || this.host.isDead) return;
        this.intentRequest = this._makeEmptyIntent();

        this.scanEntities(world);
        this.decideTarget();
        this.decideAction();
        this.decideMovement();
        this.decideAbility(dt);
        this.writeIntoHost();
    }
    scanEntities(world) {
        this.observedCreatures   = [];
        this.enemyCreatures      = [];
        this.observedProjectiles = [];
        this.enemyProjectiles    = [];

        const h  = this.host;
        const px = h.pos?.x ?? h.x;
        const pz = h.pos?.z ?? h.z;
        const sightRange = (h.modifiedStats?.range ?? 40) * 3; // perception range

        for (const e of world.entities) {
            if (e === h || e.isDead) continue;
            const ex   = e.pos?.x ?? e.x;
            const ez   = e.pos?.z ?? e.z;
            const dist = Math.hypot(ex - px, ez - pz);
            if (dist > sightRange) continue;

            this.observedCreatures.push({ entity: e, dist });
            if (e.team !== h.team) this.enemyCreatures.push({ entity: e, dist });
        }

        for (const p of world.projectiles ?? []) {
            if (p.team === h.team) continue;
            const dist = Math.hypot((p.x - px), (p.z - pz));
            if (dist < sightRange) this.enemyProjectiles.push({ proj: p, dist });
        }
    }

    _scoreTarget(enemyEntry) {
        const { entity: e, dist } = enemyEntry;
        // Prefer hurt enemies, then close ones
        const hpRatio  = (e.currentHP ?? e.modifiedStats.maxHP) / (e.modifiedStats.maxHP || 1);
        const distNorm = dist / 200; // normalise to ~0-1 over 200 units
        return hpRatio * 0.5 + distNorm * 0.5;
    }

    decideTarget() {
        if (this.enemyCreatures.length === 0) {
            this.targetFocus = null;
            return;
        }

        if (this.targetFocus && !this.targetFocus.isDead) {
            const stillSeen = this.enemyCreatures.find(e => e.entity === this.targetFocus);
            if (stillSeen) return;
        }

        let best = null, bestScore = Infinity;
        for (const entry of this.enemyCreatures) {
            const score = this._scoreTarget(entry);
            if (score < bestScore) { bestScore = score; best = entry.entity; }
        }
        this.targetFocus = best;
    }

    decideAction() {
        const h = this.host;
        if (!this.targetFocus || this.nature === 'passive') {
            this.viable.fight = 0;
            this.viable.move  = 1;
            return;
        }

        const hpRatio = (h.currentHP ?? 1) / (h.modifiedStats?.maxHP || 1);

        if (hpRatio < 0.25) {
            this.viable.fight = -1; 
            this.viable.move  = 1;
            return;
        }

        // Check incoming projectile threat
        const incomingThreat = this.enemyProjectiles.some(p => p.dist < 30);
        if (incomingThreat) this.intentRequest.dodge = true;

        this.viable.fight = 1;
        this.viable.move  = 1;
    }
    decideMovement() {
        const h  = this.host;
        const px = h.pos?.x ?? h.x;
        const pz = h.pos?.z ?? h.z;

        if (!this.targetFocus) {
            this.intentRequest.move = { x: 0, z: 0 };
            return;
        }

        const tx   = this.targetFocus.pos?.x ?? this.targetFocus.x;
        const tz   = this.targetFocus.pos?.z ?? this.targetFocus.z;
        const dist = Math.hypot(tx - px, tz - pz);
        const dx   = (tx - px) / (dist || 1);
        const dz   = (tz - pz) / (dist || 1);

        const attackRange = h.modifiedStats?.range ?? 20;

        if (this.viable.fight === -1) {
            // Flee: move directly away
            this.intentRequest.move = { x: -dx, z: -dz };
        } else if (dist > attackRange) {
            // Chase
            this.intentRequest.move = { x: dx, z: dz };
        } else {
            // In range — hold position
            this.intentRequest.move = { x: 0, z: 0 };
        }
    }

    decideAbility(dt) {
        if (this.viable.fight !== 1 || !this.targetFocus) return;

        const h   = this.host;
        const px  = h.pos?.x ?? h.x;
        const pz  = h.pos?.z ?? h.z;
        const tx  = this.targetFocus.pos?.x ?? this.targetFocus.x;
        const tz  = this.targetFocus.pos?.z ?? this.targetFocus.z;
        const dist = Math.hypot(tx - px, tz - pz);

        for (const key in h.cooldowns) {
            if (h.cooldowns[key] > 0) h.cooldowns[key] -= dt * 100; // dt in seconds → hundredths
        }//might move to abilitymanager or similar

        let bestKey = null, bestScore = -Infinity;

        for (const key of (h.moveset ?? [])) {
            const ability = abilities[key];
            if (!ability) continue;
            if ((h.cooldowns[key] ?? 0) > 0) continue;
            const rangeArg = ability.args?.find(a => a.maxCastRange !== undefined);
            const castRange = rangeArg?.maxCastRange ?? 999;
            if (dist > castRange) continue;
            const energyCost = ability.flatDmg?.e ?? 0;
            if (energyCost > 0 && (h.currentEnergy ?? 0) < energyCost) continue;
            const dmgScore = (ability.flatDmg?.p ?? 0)  + (ability.flatDmg?.e ?? 0)
                           + (ability.dmgScale?.p ?? 0) * (h.modifiedStats?.pAtk ?? 0)
                           + (ability.dmgScale?.e ?? 0) * (h.modifiedStats?.eAtk ?? 0);

            if (dmgScore > bestScore) { bestScore = dmgScore; bestKey = key; }
        }

        if (bestKey) {
            this.intentRequest.ability  = bestKey;
            this.intentRequest.targetId = this.targetFocus.id;
            this.intentRequest.aimAt    = { x: tx, z: tz };
        }
    }
    writeIntoHost() {
        const h = this.host;
        h.intent = { ...this.intentRequest };
    }
    attachTo(creature) {
        this.host = creature;
        creature.brain = this;
    }
}
