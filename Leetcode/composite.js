const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");
const globalSpeed = 20;
const globalCSpeed = 100;
const solid = "solid";
const liquid = "liquid";
const gas = "gas";
const plasma = "plasma";
let drawing = [];
let botList = []
let entityList = []
let projectileList = [];
let iteration = 0
const composites = {
    stone:       {name: "stone", matter: solid,  tough: 0.30, hard: 0.8, energy: 0.0, elastic: 0.0, tempBaseline: 0.5, chemResist: 0.6,
        electroResist: 1.0, density: 0.9, porosity: 0.0,  thermCond: 0.05, electCond: 0.1},
    crystalline: {name: "crystalline", matter: solid,  tough: 0.15, hard: 0.9, energy: 0.0, elastic: 0.0, tempBaseline: 0.5, chemResist: 0.5,
        electroResist: 1.0, density: 0.8, porosity: 0.0,  thermCond: 0.05, electCond: 0.5},
    metal:       {name: "metal", matter: solid,  tough: 0.80, hard: 0.7, energy: 0.0, elastic: 0.2, tempBaseline: 0.5, chemResist: 0.55,
        electroResist: 0.1, density: 0.95, porosity: 0.05,  thermCond: 1.0, electCond: 0.95},
    //
    organicAnimal:{name: "organicAnimal", matter: solid, tough: 0.60, hard: 0.3, energy: 0.2, elastic: 0.7, tempBaseline: 0.5, chemResist: 0.20,
        electroResist: 0.3, density: 0.6, porosity: 0.5,  thermCond: 0.4, electCond: 0.45},
    organicPlant: {name: "organicPlant", matter: solid, tough: 0.40, hard: 0.5, energy: 0.4, elastic: 0.6, tempBaseline: 0.45, chemResist: 0.15,
        electroResist: 0.4, density: 0.55, porosity: 0.3,  thermCond: 0.3, electCond: 0.4},
    slime:       {name: "slime", matter: solid, tough: 0.50, hard: 0.1, energy: 0.4, elastic: 1.0, tempBaseline: 0.4, chemResist: 0.15,
        electroResist: 0.2, density: 0.4, porosity: 0.6,  thermCond: 0.6, electCond: 0.5},
    //
    water:       {name: "water", matter: liquid, tough: 0.00, hard: 0.0, energy: 0.5, elastic: 1.0, tempBaseline: 0.45, chemResist: 0,
        electroResist: 0.1, density: 0.5, porosity: 0.2,  thermCond: 0.9, electCond: 0.9},
    lava:        {name: "lava", matter: liquid, tough: 0.60, hard: 0.2, energy: 0.7, elastic: 0.3, tempBaseline: 1.0, chemResist: .3,
        electroResist: 0.6, density: 0.85, porosity: 0.4,  thermCond: 0.1, electCond: 0.1},
    gas:         {name: "gas", matter: gas, tough: 0.00, hard: 0.0, energy: 0.8, elastic: 1.0, tempBaseline: 0.6, chemResist: 0.3,
        electroResist: 0.6, density: 0.05, porosity: 0.0,  thermCond: 0.1, electCond: 0.05},
    fire:        {name: "fire", matter: plasma, tough: 0.00, hard: 0.0, energy: 0.9, elastic: 1.0, tempBaseline: 1.0, chemResist: 0.9,
        electroResist: 0.8, density: 0.02, porosity: 0.0,  thermCond: 0.0, electCond: 0.05},
    frost:       {name: "frost", matter: gas, tough: 0.00, hard: 0.1, energy: 1.0, elastic: 0.0, tempBaseline: 0.0, chemResist: 0.9,
        electroResist: 0.8, density: 0.06, porosity: 0.0,  thermCond: 0.0, electCond: 0.05},
    arcane:      {name: "arcane", matter: plasma, tough: 0.00, hard: 0.0, energy: 0.9, elastic: 1.0, tempBaseline: 1.0, chemResist: 0.9,
        electroResist: 0.5, density: 0.1, porosity: 0.0,  thermCond: 0.0, electCond: 0.3},
}
const modusEncephalus = {
    organicBrain: [composites.organicAnimal, composites.organicPlant, composites.slime],
    electroCPU: [composites.stone, composites.crystalline, composites.metal,
        composites.slime, composites.organicAnimal, composites.organicPlant],
    arcane: [composites.stone, composites.crystalline, composites.metal, composites.organicAnimal, composites.organicPlant,
        composites.slime, composites.lava, composites.gas, composites.fire, composites.frost, composites.arcane],
}
const moveType = {
    light: {matter: plasma, electro: 0.3, heat: 0.3},
    electric: {matter: plasma, dmgElectro: 1.0}, 
    water: {matter: liquid, dmgHard: 0.2, dmgCold: 0.1},
    fire: {matter: plasma, dmgHeat: 0.9},
    ice: {matter: solid, dmgCold: 0.9},
    wind: {matter: gas, dmgCold: 0.3, dmgElastic: 0.3},
    corrode: {matter: liquid, dmgHard: 0.5, dmgChem: 0.6},
    fumes: {matter: gas, dmgChem: 0.7},
    smash: {matter: solid, dmgTough: 0.9, dmgHard: 0.1, dmgElastic: 0.2}, 
    slice: {matter: solid, dmgTough: 0.1, dmgHard: 0.9, dmgElastic: 0.0},
    shockwave: {matter: solid, dmgTough: 0.5, dmgHard: 0.1, dmgElastic: 0.5},
    drill: {matter: solid, dmgTough: 0.2, dmgHard: 0.1, dmgElastic: 0.8},
    cold: {matter: gas, dmgCold: 0.9},
}
const moves = {
    air_slice: {baseDmg: 10, types: [moveType.slice, moveType.cold], rangeType: "projectile", projSpeed: 20, 
        falloffStart: 20, rangeEnd: 50, baseCD: 500},
    bite: {baseDmg: 5, types: [moveType.drill], rangeType:"melee", baseCD: 30},
    burn: {baseDmg: 10, types: [moveType.fire, moveType.cold], rangeType: "projectile", projSpeed: 5,
        falloffStart: 5, rangeEnd: 10, baseCD: 50},
    chill: {baseDmg: 10, types: [moveType.wind], rangeType: "area",
        falloffStart: 5, rangeEnd: 20, baseCD: 30},
    dash: {rangeType: "movement", totalDuration: 20, speedChangeType: "ease out",  baseCD: 100},
    light_blast: {baseDmg: 30, types: [moveType.electric], rangeType: "hitscan", rangeEnd: 30, baseCD:1000},
    zap: {baseDmg: 20, types: [moveType.electric], rangeType: "hitscan",
        falloffStart: 0, rangeEnd: 20, baseCD: 100},
}
const family = {
    canine: {baseIn: {type: composites.organicAnimal, variation: 0.3}, baseOut: {type: composites.organicAnimal, variation: 0.2}, modus: modusEncephalus.organicBrain},
    feline: {baseIn: {type: composites.organicAnimal, variation: 0.05}, baseOut: {type: composites.organicAnimal, variation: 0.1}, modus: modusEncephalus.organicBrain},
    reptile: {baseIn: {type: composites.organicAnimal, variation: 0.05}, baseOut: {type: composites.organicAnimal, variation: 0.1}, modus: modusEncephalus.organicBrain},
    bird: {baseIn: {type: composites.organicAnimal, variation: 0.05}, baseOut: {type: composites.organicAnimal, variation: 0.2}, modus: modusEncephalus.organicBrain},
    bug: {baseIn: {type: composites.organicAnimal, variation: 0.05}, baseOut: {type: composites.organicAnimal, variation: 0.2}, modus: modusEncephalus.organicBrain},
    spectre: {baseIn: {type: composites.gas, variation: 0.0}, baseOut: {type: composites.gas, variation: 0.2}, modus: modusEncephalus.arcane},
    elemental: {baseIn: {type: composites.arcane, variation: 0.0}, baseOut: {type: composites.organicAnimal, variation: 1.0}, modus: modusEncephalus.arcane},
    mecha: {baseIn: {type: composites.metal, variation: 0.1}, baseOut: {type: composites.metal, variation: 0.1}, modus: modusEncephalus.electroCPU},
} 
const species = {
    houseDog: {name: "Dog", family: family.canine, baseSize: 10},
    houseCat: {name: "Cat", family: family.feline, baseSize: 6},
    wolf: {name: "Wolf", family: family.canine, baseSize: 12},
    bird: {name: "Bird", family: family.bird, baseSize: 3},
    mechBird: {name: "Mecha Bird", family: family.mecha, baseSize: 20},
}
const familyInnateVariation = {
    canine: {pAtk:{t: 0.5, r: 10}, eAtk:{t: 0, r: 1}, maxHP: {t: 0.5, r: 20},
        speed: {t: 0, r: 1}, def: {t: 0.5, r: 2}, castSpd: {t: 0.5, r: 1}},
    feline: {pAtk:{t: 0.5, r: 10}, eAtk:{t: 0.5, r: 1}, maxHP: {t: 0.5, r: 15},
        speed: {t: 0, r: 2}, def: {t: 0.5, r: 1}, castSpd: {t: 0.5, r: 1}},
    reptile: {pAtk:{t: 0.5, r: 20}, eAtk:{t: 0.5, r: 1}, maxHP: {t: 0.5, r: 10},
        speed: {t: 0.5, r: 1}, def: {t: 0.5, r: 1}, castSpd: {t: 0.5, r: 1}},
    bird: {pAtk:{t: 1, r: 10}, eAtk:{t: 0, r: 10}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 3}, def: {t: 0.5, r: 1}, castSpd: {t: 0.5, r: 1}},
    bug: {pAtk:{t: 0.5, r: 5}, eAtk:{t: 0.5, r: 1}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 3}, def: {t: 0.5, r: 1}, castSpd: {t: 0.5, r: 1}},
    spectre: {pAtk:{t: 1, r: 5}, eAtk:{t: 0.5, r: 1}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 5}, def: {t: 0.5, r: 1}, castSpd: {t: 0.5, r: 1}},
    elemental: {pAtk:{t: 1, r: 5}, eAtk:{t: 0.5, r: 1}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 2}, def: {t: 0.5, r: 1}, castSpd: {t: 0.5, r: 1}},
    mecha: {pAtk:{t: 0, r: 10}, eAtk:{t: 0, r: 10}, maxHP: {t: 0, r: 40},
        speed: {t: 0.5, r: 10}, def: {t: 0.5, r: 10}, castSpd: {t: 1, r: 10}},
}
function clamp01(v){ return Math.max(0, Math.min(1, v))}
function soakBuilder(inner, outer, size) {
    const wO = 0.7, wI = 0.3;
    const mix = (k, def = 0.5) =>
    wO * (outer?.[k] ?? def) + wI * (inner?.[k] ?? outer?.[k] ?? def);
    const porosity = clamp01(mix('porosity', 0.3))
    const density = clamp01(mix('density', 0.6))
    const thermalCond = clamp01(mix('thermCond', 0.5))
    const electroCond = clamp01(mix('electCond', 0.3))
    const tBase = clamp01(mix('tempBaseline', 0.5))
    const capBase = 10 * size; //capacityBase
    const maxContainWater  = capBase * (0.6*porosity + 0.2*(1-density) + 0.2);
    const maxContainChem   = capBase * (0.5*porosity + 0.2*(1-density) + 0.3);
    const maxContainCharge = capBase * (0.6*electroCond + 0.2*(1-porosity) + 0.2);
    const maxContainArcane = capBase * (0.2*(1-electroCond) + 0.2*(1-density) + 0.6);
    const thermalMass = 0.4*thermalCond + 0.4*density + 0.2;
    const maxContainHot = capBase * thermalMass * (0.2 + 0.8*(1-tBase))
    const maxContainCold = capBase * thermalMass * (0.2 + 0.8*(tBase))
    const leakWater = 0.3 + 0.18*porosity;
    const leakChem = 0.2 + 0.14*porosity;
    const leakCharge = 0.2 + 0.2*electroCond;
    const leakHot = 0.2 + 0.18*thermalCond;
    const leakCold = 0.2 + 0.18*thermalCond;
    return {
        caps: {
            waterMax: maxContainWater, chemMax:maxContainChem,
            chargeMax: maxContainCharge, hotMax: maxContainHot,
            coldMax: maxContainCold, arcaneMax: maxContainArcane
        },
        leaks: {
            water:leakWater, chem:leakChem, charge:leakCharge,
            hot: leakHot, cold:leakCold
        }
    }
}
function generateProjectile(direction, fromEntity, moveset){
    if (!moveset.projSpeed){
        moveset.projSpeed = 1;
        console.error("move has no proj speed fix")
    }
    let projectile = {
        from: fromEntity,
        team: fromEntity.team,
        x: fromEntity.x,
        y: fromEntity.y,
        dir: direction,
        move: moveset,
        speed: moveset.projSpeed,
        };

    projectileList.push(projectile)
}
function projectileLoop(){
  for (let i = projectileList.length - 1; i >= 0; i--){
    const p = projectileList[i];
    const mag = Math.hypot(p.dir.x, p.dir.y) || 1;
    p.x += (p.dir.x / mag) * p.speed;
    p.y += (p.dir.y / mag) * p.speed;

    if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height){
      projectileList.splice(i,1); continue;
    }
    for (const e of entityList){
      if (e === p.from) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.size*0.5){
            e.receiveAttack(p.move, p.from);
            projectileList.splice(i,1);
            break;
        }

    }
    ctx.fillRect(p.x, p.y, 3, 3)
  }
}
function moveEffects(move, target, wasMelee = false){
  const matter = (move.types?.[0]?.matter) ?? solid;
  let injectMultiplier = 1;
  let hadASolid = false;
  switch (matter) {
    case solid:
      injectMultiplier = wasMelee ? 1.15 : 1.0;
      hadASolid = true;
      break;
    case liquid:
      injectMultiplier = 1.2;
      break;
    case gas:
      injectMultiplier = 1.1;
      break;
    case plasma:
      injectMultiplier = 1.0;
      break;
  }
  return { injectMultiplier, hadASolid };
}
function makeRNG(seed=123456789){
    let s = seed >>> 0;
    return function rand(){
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17; s >>>= 0;
        s ^= s << 5; s >>>= 0;
        return (s >>> 0) / 0xFFFFFFFF
    }
}
class Entity{
    constructor(species, x, y, team, extraSize = 0){
        this.x = x;
        this.y = y;
        this.requestedMove = {x:0, y:0}
        this.vel = { x: 0, y: 0 };
        //stats
        this.originalStats = null;
        this.size = species.baseSize + extraSize;
        this.HP = null; this.maxHP = null;
        this.pAtk = null; this.eAtk = null;
        this.def = null; this.speed = null;
        this.castSpd = null;
        //resists
        this.heatResist = 0; this.coldResist = 0;
        this.chemResist = 0; this.electroResist = 0;
        this.maxContain = 0;
        this.containCold = 0; this.containHeat = 0;
        this.containTox = 0; this.containWater = 0;
        this.containCharge = 0; this.containArcane = 0;
        //abilities
        this.abilities = {ab1: null, ab2: null, ab3: null, ab4: null}
        this.buffs = []
        //timer
        this.CD = {melee: 0, ab1: 0, ab2: 0, ab3: 0, ab4: 0}
        this.CDCurrent = {melee: 0, ab1: 0, ab2: 0, ab3: 0, ab4: 0}
        //extra
        this.species = species.name;
        this.team = team;
        this.hasBot = false;
        this.generateEntity(species)
        this.initialize();
        entityList.push(this)
    }
    initialize(){
        this.abilities.ab1 = moves.bite;
        this.CD.ab1 = moves.bite.baseCD;
        this.abilities.ab2 = moves.air_slice;
        this.CD.ab2 = moves.air_slice.baseCD;
        this.abilities.ab3 = moves.chill;
        this.CD.ab3 = moves.chill.baseCD;
        this.abilities.ab4 = moves.zap;
        this.CD.ab4 = moves.zap.baseCD;
    }
    generateEntity(species) {
        const rng = makeRNG(Math.floor(Math.random()*1e9));
        let thresholdIn = species.family.baseIn.variation;
        let thresholdOut = species.family.baseOut.variation;
        let originalIn = species.family.baseIn.type;
        let originalOut = species.family.baseOut.type;
        let modus = species.family.modus;

        const rolledInner = this.rollCompositeType(originalIn,  thresholdIn, rng(), modus);
        const rolledOuter = this.rollCompositeType(originalOut, thresholdOut, rng(), composites);
        const familyName = Object.keys(family).find(key => family[key] === species.family);
        const innateVariation = familyInnateVariation[familyName];
        if (!innateVariation) {
            console.error(`No innate variation found for family: ${familyName}`);
            return null;
        }
        const entitySize = this.size;
        const stats = this.inheritBaseStats(rolledInner, rolledOuter, entitySize);
        const finalStats = this.addInnateStats(stats, innateVariation)
        this.species = species.name
        this.innerComposite = rolledInner;
        this.outerComposite = rolledOuter;
        this.originalStats = finalStats;
        this.setStats(finalStats)
    }
    rollCompositeType(baseComposite, variation, random, compositePool) {
        if (random < variation) {
            const availableComposites = Object.values(compositePool).filter(
                comp => comp.name !== baseComposite.name
            );
            const newComposite =
                availableComposites[Math.floor(Math.random() * availableComposites.length)];
            return { ...newComposite };
        }
        return { ...baseComposite };
    }
    inheritBaseStats(innerComposite, outerComposite, entitySize, globalSpeed = 10) {
        const healthCalc = (comp, size) => (comp.tough + comp.hard + comp.elastic) * size;
        const physAtkCalc = (comp, size) => (comp.hard + comp.tough) * size;
        const energAtkCalc = (comp, size) => comp.energy * size;
        const defenseCalc = (comp, size) => (comp.tough + comp.density) * size;
        const resistCalc = (comp, size) => Math.max(0,(comp.density - comp.porosity)) * size;

        const maxHP = healthCalc(innerComposite, entitySize) + healthCalc(outerComposite, entitySize);
        const pAtk = physAtkCalc(innerComposite, entitySize) + physAtkCalc(outerComposite, entitySize);
        const eAtk = energAtkCalc(innerComposite, entitySize) + energAtkCalc(outerComposite, entitySize);
        const def = defenseCalc(outerComposite, entitySize);
        const capacity = soakBuilder(innerComposite, outerComposite, entitySize);
        const res = resistCalc(outerComposite, entitySize) + resistCalc(innerComposite, entitySize);
        const speed = globalSpeed / entitySize;
        const castSpd = Math.max(0.1, globalCSpeed / Math.max(1, entitySize));
        this.reservoirs = capacity;

        return {
            maxHP: +Math.max(0, maxHP).toFixed(3),
            pAtk:  +Math.max(0, pAtk).toFixed(3),
            eAtk:  +Math.max(0, eAtk).toFixed(3),
            def:   +Math.max(0, def).toFixed(3),
            res,
            capacity,
            speed: +Math.max(0.1, speed).toFixed(3),
            castSpd: +Math.max(0.1, castSpd).toFixed(3),
        };

    }
    receiveAttack(move, attacker = null) {
        let totalDamage = 0;
        const cap = this.capacity; // soakBuilder results

        for (const type of move.types) {
        let dmg = move.baseDmg;
        if (type.dmgTough)   dmg *= (1 - this.def / (this.def + 10));
        if (type.dmgHard)    dmg *= (1 - this.def / (this.def + 10));
        if (type.dmgElastic) dmg *= (1 - this.res / (this.res + 10));

        if (type.dmgHeat) {
            const leak = cap.leaks.hot;
            const left = Math.max(0, dmg - leak);
            this.containHeat = Math.min(cap.caps.hotMax, this.containHeat + left);
            dmg = left * 0.5; // half leaks through as HP damage
        }
        if (type.dmgCold) {
            const leak = cap.leaks.cold;
            const left = Math.max(0, dmg - leak);
            this.containCold = Math.min(cap.caps.coldMax, this.containCold + left);
            dmg = left * 0.5;
        }
        if (type.dmgChem) {
            const leak = cap.leaks.chem;
            const left = Math.max(0, dmg - leak);
            this.containTox = Math.min(cap.caps.chemMax, this.containTox + left);
            dmg = left;
        }
        if (type.dmgElectro) {
            const leak = cap.leaks.charge;
            const left = Math.max(0, dmg - leak);
            this.containCharge = Math.min(cap.caps.chargeMax, this.containCharge + left);
            dmg = left;
        }
        if (type.dmgArcane) {
            this.containArcane = Math.min(cap.caps.arcaneMax, this.containArcane + dmg);
            dmg *= 0.8;
        }

        totalDamage += dmg;
        }

        this.HP = Math.max(0, this.HP - totalDamage);
        // console.log(`${this.species} took ${totalDamage.toFixed(2)} damage. HP left: ${this.HP}`);
    }
    addInnateStats(stats, vari){
        let add = {
            maxHP: (Math.random() - vari.maxHP.t) * vari.maxHP.r,
            pAtk: (Math.random() - vari.pAtk.t) * vari.pAtk.r,
            eAtk: (Math.random() - vari.eAtk.t) * vari.eAtk.r,
            def: (Math.random() - vari.def.t) * vari.def.r,
            speed: (Math.random() - vari.speed.t) * vari.speed.r,
            castSpd: (Math.random() - vari.castSpd.t) * vari.castSpd.r,
        }
        return {
            maxHP: Math.max(0, (stats.maxHP + add.maxHP).toFixed(3)),
            pAtk: Math.max(0, (stats.pAtk + add.pAtk).toFixed(3)),
            eAtk: Math.max(0, (stats.eAtk + add.eAtk).toFixed(3)),
            def: Math.max(0, (stats.def + add.def).toFixed(3)),
            res: Math.max(0, (stats.res)),
            speed: Math.max(0.1, (stats.speed + add.speed).toFixed(3)),
            castSpd: Math.max(0.1, Math.round(stats.castSpd + add.castSpd)),
            capacity: stats.capacity
        }
    }
    setStats(stat){
        this.maxContain = this.size * (this.innerComposite.density + this.outerComposite.density)
        this.maxHP = stat.maxHP; this.HP = stat.maxHP;
        this.pAtk = stat.pAtk; this.eAtk = stat.eAtk;
        this.def = stat.def; this.res = stat.res;
        this.speed = stat.speed; this.castSpd = stat.castSpd;
        this.capacity = stat.capacity;
    }
    requestMelee(entity){
        //in range
        const dist = Math.hypot(entity.x - this.x, entity.y - this.y)
        if (dist <= this.size  + entity.size){
            this.attack(entity)
        }
    }
    attack(entity){
        if (this.CDCurrent.melee <= 0){
            this.CDCurrent.melee = this.CD.melee;
            entity.receiveAttack(this.abilities.ab1, this)
        }
    }
    requestAbility(aimDir, moveDir, abilityArg){
        let ability = null;
        if (abilityArg == this.abilities.ab1){ ability = "ab1"}
        if (abilityArg == this.abilities.ab2){ ability = "ab2"}
        if (abilityArg == this.abilities.ab3){ ability = "ab3"}
        if (abilityArg == this.abilities.ab4){ ability = "ab4"}
        if (abilityArg && this.CDCurrent[ability] <= 0){
            this.CDCurrent[ability] = this.CD[ability] / this.castSpd;
            const move = this.abilities[ability];
            if (move.rangeType === "movement"){
                //add buff
                let movementAbility = abilityArg;
                //turn into buff
                let buff = {...movementAbility, duration: movementAbility.totalDuration, totalDuration: movementAbility.totalDuration}
                this.buffs.push({buff})
                return;
            }
            if (move.rangeType === "melee"){
                //find entity in front of moveDir
                let target = null;
                let minDist = Infinity;
                for (let entity of entityList){
                    if (entity === this) continue;
                    const toEntity = {x: entity.x - this.x, y: entity.y - this.y};
                    const mag = Math.hypot(toEntity.x, toEntity.y) || 1;
                    const normToEntity = {x: toEntity.x / mag, y: toEntity.y / mag};
                    const dot = normToEntity.x * moveDir.x + normToEntity.y * moveDir.y;
                    if (dot > 0.7){ // roughly within 45 degrees
                        const dist = Math.hypot(toEntity.x, toEntity.y);
                        if (dist < minDist && dist <= this.size * 0.5 + entity.size * 0.5 + 5){
                            minDist = dist;
                            target = entity;
                        }
                    }
                }
                if (target){
                    target.receiveAttack(move, this);
                }
            } else if (move.rangeType === "projectile"){
                generateProjectile(aimDir, this, move);
            } else if (move.rangeType === "hitscan"){
                //instant hit in aimDir up to rangeEnd
                let target = null;
                let minDist = Infinity;
                for (let entity of entityList){
                    if (entity === this) continue;
                    const toEntity = {x: entity.x - this.x, y: entity.y - this.y};
                    const mag = Math.hypot(toEntity.x, toEntity.y) || 1;
                    const normToEntity = {x: toEntity.x / mag, y: toEntity.y / mag};
                    const dot = normToEntity.x * aimDir.x + normToEntity.y * aimDir.y;
                    if (dot > 0.7){ // roughly within 45 degrees
                        const dist = Math.hypot(toEntity.x, toEntity.y);
                        if (dist < minDist && dist <= move.rangeEnd){
                            minDist = dist;
                            target = entity;
                        }
                    }
                }
                if (target){
                    target.receiveAttack(move, this);
                }
            }
        }
    }
    move() {
        //normalize
        const mag = Math.hypot(this.requestedMove.x, this.requestedMove.y) || 1;
        this.vel.x = this.requestedMove.x / mag;
        this.vel.y = this.requestedMove.y / mag;
        //move
        this.x += this.vel.x * this.speed;
        this.y += this.vel.y * this.speed;
        if (this.x < 0) this.x = canvas.width/2; 
        if (this.x > canvas.width)  this.x = canvas.width/2;
        if (this.y < 0) this.y= canvas.height/2
        if (this.y > canvas.height)  this.y = canvas.height/2
    }
    timerTick(){
        for (let key in this.CDCurrent){
            if (this.CDCurrent[key] > 0){
                this.CDCurrent[key] -= 1;
            }
        }
        for (let buff in this.buffs){
            this.buffs[buff].duration -= 1;
            if (this.buffs[buff].duration <= 0){
                this.buffs.splice(buff, 1);
            }
        }
    }
    buffUpdate(){
        //apply buffs effects
        //movement: speedChangeTypes: ease in, ease out, instant
        //changeMagnify: 0 to 1, 
        for (let buff of this.buffs){
            if (buff.type === "speed"){
                if (buff.speedChangeType === "instant"){
                    this.speed *= buff.changeMagnify;
                } else if (buff.speedChangeType === "ease in"){
                    this.speed *= 1 + (buff.changeMagnify - 1) * (1 - buff.duration / buff.totalDuration);
                } else if (buff.speedChangeType === "ease out"){
                    this.speed *= 1 + (buff.changeMagnify - 1) * (buff.duration / buff.totalDuration);
                }
            }
        }
    }
    checkAlive(){
        if (this.HP <= 0){
            this.setStats(this.originalStats)
            //placeholder spawn
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
        }
    }
    action(){
        this.move();
    }
    loop(){
        this.action();
        this.checkAlive();
        this.timerTick();
    }
}
class Bot{
    constructor(){
        this.attachedEntity = null;
        this.focusedEntity = null;
        this.observedEntitites = []
        this.requestedPosition = {x:0, y:0}
        //fight or flight scores, range from -1 to 1:
        this.totalFightFlight = 0;
        this.selfHealth = 0;
        this.enPressures = []; //angles of enemy positions
        this.tePressures = []; //angles of teammate positions
        botList.push(this)
    }
    initialize(entity){
        this.attachedEntity = entity;
        this.attachedEntity.hasBot = true;
    }
    observe(){
        for (let entity of entityList){
            if (!this.observedEntitites.includes(entity)){
                this.observedEntitites.push(entity)
            }
        }
    }
    weighSelf(){
        //weigh health, then whichever abilities are dmg and movement
        this.selfHealth = this.attachedEntity.HP / this.attachedEntity.maxHP;
        this.totalFightFlight = (this.selfHealth - 0.5) * 2; //scale to -1 to 1
        //add ability weights later
    }
    entitiesInRange(){
        //any that arent in same team, log their health.
        //then log their distance and then angle (or vector whichever is better)
        //used to decide if there are too many enemies or if
        //the entity can take them.
        const t = this.attachedEntity.team;
        let teamBackup = []
        let enemyPressure = [];
        for (let entity of this.observedEntitites){
            if (entity.team !== t){
                let pressure = {
                    health: entity.HP / entity.maxHP,
                    distance: Math.hypot(entity.x - this.attachedEntity.x, entity.y - this.attachedEntity.y),
                    angle: Math.atan2(entity.y - this.attachedEntity.y, entity.x - this.attachedEntity.x)
                }
                enemyPressure.push(pressure)
            }
        }
        for (let entity of this.observedEntitites){
            if (entity.team === t && entity !== this.attachedEntity){
                let pressure = {
                    health: entity.HP / entity.maxHP,
                    size : entity.size,
                    distance: Math.hypot(entity.x - this.attachedEntity.x, entity.y - this.attachedEntity.y),
                    angle: Math.atan2(entity.y - this.attachedEntity.y, entity.x - this.attachedEntity.x)
                }
                teamBackup.push(pressure)
            }
        }
        this.enPressures = enemyPressure;
        this.tePressures = teamBackup;
    }
    gatherBestSpots(){
        const personalSpace = this.attachedEntity.size;
        const safeRange = this.attachedEntity.size * 2
        let potentialPositions = []
        //might wanna add distance conditions so entities dont clump together
        if (this.tePressures.length === 0){
            //if more healthy, go towards enemies
            for (let enemy of this.enPressures){
                if (this.selfHealth > 0.5){
                    //go towards enemy
                    if (enemy.distance < safeRange + enemy.size/2) {
                        enemy.angle *= -1;
                    }; //dont get too close
                    let pos = {
                        x: this.attachedEntity.x + Math.cos(enemy.angle) * personalSpace,
                        y: this.attachedEntity.y + Math.sin(enemy.angle) * personalSpace
                    }
                    potentialPositions.push(pos)
                } else {
                    //go away from enemy
                    let pos = {
                        x: this.attachedEntity.x - Math.cos(enemy.angle) * personalSpace,
                        y: this.attachedEntity.y - Math.sin(enemy.angle) * personalSpace
                    }
                    potentialPositions.push(pos)
                }
            }            
        } else {
            for (let pressure of this.tePressures){
                for (let enemy of this.enPressures){
                    let angleDiff = Math.abs(pressure.angle - enemy.angle);
                    if (angleDiff < Math.PI / 2){
                        if (pressure.health <= this.selfHealth){
                            //get in front of teammate
                            let pos = {
                                x: this.attachedEntity.x + Math.cos(pressure.angle) * personalSpace,
                                y: this.attachedEntity.y + Math.sin(pressure.angle) * personalSpace
                            }
                            potentialPositions.push(pos)
                        }
                    } else {
                        if (pressure.health >= this.selfHealth){
                            //get behind teammate
                            let pos = {
                                x: this.attachedEntity.x - Math.cos(pressure.angle) * personalSpace,
                                y: this.attachedEntity.y - Math.sin(pressure.angle) * personalSpace
                            }
                            potentialPositions.push(pos)
                        }
                    }
                }
            }
        }
        if (potentialPositions.length > 0){
            let avgX = 0; let avgY = 0;
            for (let pos of potentialPositions){
                avgX += pos.x; avgY += pos.y;
            }
            avgX /= potentialPositions.length;
            avgY /= potentialPositions.length;
            this.requestedPosition = {x: avgX, y: avgY}
        } else {
            this.requestedPosition = {x: this.attachedEntity.x, y: this.attachedEntity.y}
        }
    }
    decideFocus(){
        //decide which entity to focus on based on position and health
        let bestScore = -Infinity;
        for (let entity of this.observedEntitites){
            if (entity === this.attachedEntity) continue;
            let dist = Math.hypot(entity.x - this.attachedEntity.x, entity.y - this.attachedEntity.y);
            let healthScore = (entity.HP / entity.maxHP);
            let positionScore = 1 / (dist + 1); //closer better
            let totalScore = (1 - healthScore) + positionScore; //prefer weaker and closer
            if (totalScore > bestScore){
                bestScore = totalScore;
                this.focusedEntity = entity;
            }
        }
    }
    chooseBestSpotOrFocus(){
        if (this.focusedEntity.health == 0){
            this.requestedPosition = {x: this.focusedEntity.x, y: this.focusedEntity.y}
        } else {
            this.gatherBestSpots();
        }
    }
    requestMelee(){
        if (this.focusedEntity){
            this.attachedEntity.requestMelee(this.focusedEntity)
        }
    }
    rangedAbilityDecide(){
        if (this.focusedEntity){
            let dir = {
                x: this.focusedEntity.x - this.attachedEntity.x,
                y: this.focusedEntity.y - this.attachedEntity.y
            }
            const mag = Math.hypot(dir.x, dir.y) || 1;
            dir.x /= mag; dir.y /= mag;
            this.attachedEntity.requestAbility(dir, null, moves.air_slice)
        }
    }
    urgentMovement(){
        if (this.selfHealth < 0.3){
            let dir = {
                x: this.requestedPosition.x - this.attachedEntity.x,
                y: this.requestedPosition.y - this.attachedEntity.y
            }
            const mag = Math.hypot(dir.x, dir.y) || 1;
            dir.x /= mag; dir.y /= mag;
            // this.attachedEntity.requestAbility(null, dir, moves.dash)
        }
    }
    requestChildToMove(){
        let dir = {
            x: this.requestedPosition.x - this.attachedEntity.x,
            y: this.requestedPosition.y - this.attachedEntity.y
        }
        this.attachedEntity.requestedMove = dir;
    }
    loop(){
        this.observe();
        this.weighSelf();
        this.entitiesInRange();
        this.decideFocus();
        this.chooseBestSpotOrFocus();
        this.rangedAbilityDecide();
        this.urgentMovement();
        this.requestChildToMove();
        this.requestMelee();
        this.observedEntitites = []
    }
}

function entitySpawner(speciesKey, x, y, team, extraSize = 0){
    const spec = species[speciesKey];
    if (!spec){
        console.error("species not found: " + speciesKey)
        return;
    }
    let entity = new Entity(spec, x, y, team, extraSize);
    return entity;
}
function teamSpawner(team, count, speciesKey, extraSize = 0){
    for (let i = 0; i < count; i++){
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        entitySpawner(speciesKey, x, y, team, extraSize)
    }
}
//spawning entities
teamSpawner("A", 5, "houseDog", 0);
// let mechBird = entitySpawner("mechBird", canvas.width/2, canvas.height/2, "B", 0);
teamSpawner("B", 10, "bird", 0);

function addBotToEntity(){
    for (let entity of entityList){
        if (!entity.hasBot){
            let bot = new Bot();
            entity.bot = bot
            bot.initialize(entity)
        }
    }
}
addBotToEntity();

function draw(size, HP, name, pos){
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.arc(pos.x, pos.y, size/2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillText(name, pos.x, pos.y - 10)
    ctx.fillText(Math.round(HP) + "HP", pos.x + 10 + size, pos.y + 15);
}

function gloop(){
    ctx.clearRect(0,0,canvas.width, canvas.height)
    projectileLoop();
    for (let bot of botList){
        bot.loop();
    }
    for (let entity of entityList){
        entity.loop();
        draw(entity.size, entity.HP, entity.species, {x: entity.x, y: entity.y})
    }
    // console.log(mechBird.bot.focusedEntity.species)
    // requestAnimationFrame(gloop)
}
setInterval(gloop, 100)
// gloop();
