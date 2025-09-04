const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");
const globalSpeed = 10;
const globalCSpeed = 100; //in ticks probably
const solid = "solid";
const liquid = "liquid";
const gas = "gas";
const plasma = "plasma";
let drawing = [];
let entityList = []
let projectileList = [];
let iteration = 0
//composite dictionary for monster makeup
//modus dictionary for monster brain: decides pool of composites
//moveType dictionary for dmg/energy ability makeup
//move dictionary for ability
//family for broad group of monsters
//species for more specific group of monsters
//

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
//maybe if u supereffective the inner composite, monster faints ez
const modusEncephalus = { //or not, prob wont be used
    organicBrain: [composites.organicAnimal, composites.organicPlant, composites.slime],
    electroCPU: [composites.stone, composites.crystalline, composites.metal,
        composites.slime, composites.organicAnimal, composites.organicPlant],
    arcane: [composites.stone, composites.crystalline, composites.metal, composites.organicAnimal, composites.organicPlant,
        composites.slime, composites.lava, composites.gas, composites.fire, composites.frost, composites.arcane],
}
//how much it bypasses x resistance: if enemy monster (size 1) has 0.5 electric resist,
//a move with damage of 1 will use 1 whole resistance. It ends with 0.5 damage.
//probably.
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
        falloffStart: 20, rangeEnd: 50, baseCD: 120},
    bite: {baseDmg: 5, types: [moveType.drill], rangeType:"melee", baseCD: 30},
    burn: {baseDmg: 10, types: [moveType.fire, moveType.cold], rangeType: "projectile", projSpeed: 5,
        falloffStart: 5, rangeEnd: 10, baseCD: 50},
    chill: {baseDmg: 10, types: [moveType.wind], rangeType: "area",
        falloffStart: 5, rangeEnd: 20, baseCD: 30},
    light_blast: {baseDmg: 30, types: [moveType.electric]},
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
    mechBird: {name: "Mecha Bird", family: family.bird, baseSize: 15},
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
        x: fromEntity.x,
        y: fromEntity.y,
        dir: direction,
        move: moveset,      // keep full move here
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

    // simple lifetime and hit check
    if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height){
      projectileList.splice(i,1); continue;
    }
    for (const e of entityList){
      if (e === p.from) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= e.size*0.5){
        e.receiveAttack(p.move, p.from);  // use the full move, not just dmg
        projectileList.splice(i,1);
        break;
        }

    }
    ctx.fillRect(p.x, p.y, 3, 3)
  }
}

function moveEffects(move, target, wasMelee = false){
  const O = target.outerComposite;
  const I = target.innerComposite;

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
    constructor(species, x, y, extraSize = 0){
        this.x = x;
        this.y = y;
        //stats
        this.originalStats = null;
        this.size = species.baseSize + extraSize;
        this.HP = null; this.maxHP = null;
        this.pAtk = null; this.eAtk = null;
        this.def = null; this.speed = null;
        this.castSpd = null;
        // resists
        this.heatResist = 0; this.coldResist = 0;
        this.chemResist = 0; this.electroResist = 0;
        this.maxContain = 0;
        this.containCold = 0; this.containHeat = 0;
        this.containTox = 0; this.containWater = 0;
        this.containCharge = 0; this.containArcane = 0;
        //
        this.species = species.name;
        this.generateEntity(species)
        entityList.push(this)
    }
    generateEntity(species) {
        const rng = makeRNG(Math.floor(Math.random()*1e9));

        let thresholdIn = species.family.baseIn.variation;
        let thresholdOut = species.family.baseOut.variation;

        let originalIn = species.family.baseIn.type;
        let originalOut = species.family.baseOut.type;
        let modus = species.family.modus;

        const rolledInner = this.rollCompositeType(originalIn,  thresholdIn, rng, modus);
        const rolledOuter = this.rollCompositeType(originalOut, thresholdOut, rng, composites);
        const familyName = Object.keys(family).find(key => family[key] === species.family);
        const innateVariation = familyInnateVariation[familyName];
        if (!innateVariation) {
            console.error(`No innate variation found for family: ${familyName}`);
            return null;
        }
        const entitySize = this.size;
        const stats = this.inheritBaseStats(rolledInner, rolledOuter, entitySize);
        const finalStats = this.addInnateStats(stats, innateVariation)
        //for draw
        draw(this.size, finalStats.HP, finalStats.maxHP, {x: this.x, y: this.y})
        //
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
            capacity, // (consider renaming to reservoirs/caps)
            speed: +Math.max(0.1, speed).toFixed(3),
            castSpd: +Math.max(0.1, castSpd).toFixed(3),
        };

    }
    receiveAttack(move, attacker = null) {
        let totalDamage = 0;
        const cap = this.originalStats.capacity; // soakBuilder results

        for (const type of move.types) {
        let dmg = move.baseDmg;
        console.log(dmg)
        // Defensive mitigation
        if (type.dmgTough)   dmg *= (1 - this.def / (this.def + 10));
        if (type.dmgHard)    dmg *= (1 - this.def / (this.def + 10));
        if (type.dmgElastic) dmg *= (1 - this.res / (this.res + 10));

        // Elemental containers
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

        // Apply to HP
        this.HP = Math.max(0, this.HP - totalDamage);

        // Debug
        console.log(`${this.species} took ${totalDamage.toFixed(2)} damage. HP left: ${this.HP}`);
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
        this.capacity = stat.capacity
    }
    aiMove() {
        const safe = this.size * 2;
        let closestEntity = null;
        let closestDistance = Infinity;

        for (let entity of entityList) {
            if (entity === this) continue;
            const realvect = { x: entity.x - this.x, y: entity.y - this.y };
            const dist = Math.hypot(realvect.x, realvect.y);

            if (dist < closestDistance) {
                closestDistance = dist;
                closestEntity = entity;
            }
        }
        if (!closestEntity) return;

        const realvect = { x: closestEntity.x - this.x, y: closestEntity.y - this.y };
        const vect = {
            x: realvect.x - closestEntity.size / 2 - this.size / 2,
            y: realvect.y - closestEntity.size / 2 - this.size / 2,
        };
        const dist = Math.hypot(vect.x, vect.y);
        const dir = { x: vect.x / dist, y: vect.y / dist };

        if (dist > safe) {
            this.x += dir.x * this.speed;
            this.y += dir.y * this.speed;
            let rand = Math.random();
            if (rand < 0.05){
                generateProjectile(dir, this, moves.air_slice)
            }
        } else if (dist < safe && dist > this.size) {
            this.attack(closestEntity);
        } else {
            this.x -= dir.x * this.speed;
            this.y -= dir.y * this.speed;
        }
    }
    attack(entity){
        //blablabla pretend in range
        //and also tick count cooldown replaced with (atk / 100)
        //if cooldowns come in, this gets to choose between abilities etc
        entity.HP -= this.pAtk / 50;
    }
    checkAlive(){
        if (this.HP <= 0){
            this.setStats(this.originalStats)
            //placeholder spawn
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
        }
    }
    loop(){
        this.aiMove()
        this.checkAlive();
    }
}

let dogEntity = new Entity(species.houseDog, 20, 20, 5);
let catEntity = new Entity(species.houseCat, 80, 50, 5);
let bird1 = new Entity(species.bird, Math.random()*canvas.width, Math.random()*canvas.height, 5);
let bird2 = new Entity(species.bird, Math.random()*canvas.width, Math.random()*canvas.height, 5);
let bird3 = new Entity(species.bird, Math.random()*canvas.width, Math.random()*canvas.height, 5);
let bird4 = new Entity(species.bird, Math.random()*canvas.width, Math.random()*canvas.height, 5);
let bird5 = new Entity(species.bird, Math.random()*canvas.width, Math.random()*canvas.height, 5);
let bird6 = new Entity(species.bird, Math.random()*canvas.width, Math.random()*canvas.height, 5);

function draw(size, HP, name, pos){
    ctx.fillRect(pos.x - size/2, pos.y - size/2, size, size)
    // ctx.fillText(Math.round(maxHP) + "maxHP", pos.x + 5 + size, pos.y + 5);
    ctx.fillText(name, pos.x, pos.y - 10)
    ctx.fillText(Math.round(HP) + "HP", pos.x + 10 + size, pos.y + 15);

}

function gloop(){
    ctx.clearRect(0,0,canvas.width, canvas.height)
    projectileLoop();
    for (let entity of entityList){
        entity.loop();
        draw(entity.size, entity.HP, entity.species, {x: entity.x, y: entity.y})
    }
    // requestAnimationFrame(gloop)
}
setInterval(gloop, 30)
// gloop();