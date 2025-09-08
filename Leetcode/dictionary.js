const solid = "solid";
const liquid = "liquid";
const gas = "gas";
const plasma = "plasma";

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
    canine: {pAtk:{t: 0.0, r: 10}, eAtk:{t: 0, r: 1}, maxHP: {t: 0, r: 20},
        speed: {t: 0, r: 1}, def: {t: 0.0, r: 2}, castSpd: {t: 0, r: 1}},
    feline: {pAtk:{t: 0.0, r: 10}, eAtk:{t: 0.0, r: 1}, maxHP: {t: 0, r: 15},
        speed: {t: 0, r: 2}, def: {t: 0.0, r: 1}, castSpd: {t: 0, r: 1}},
    reptile: {pAtk:{t: 0.0, r: 20}, eAtk:{t: 0.0, r: 1}, maxHP: {t: 0, r: 10},
        speed: {t: 0.0, r: 1}, def: {t: 0.0, r: 1}, castSpd: {t: 0.0, r: 1}},
    bird: {pAtk:{t: 1, r: 10}, eAtk:{t: 0, r: 10}, maxHP: {t: 0.0, r: 5},
        speed: {t: 1 , r: 2}, def: {t: 0.0, r: 1}, castSpd: {t: 0.0, r: 1}},
    bug: {pAtk:{t: 0.0, r: 5}, eAtk:{t: 0.0, r: 1}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 3}, def: {t: 0.0, r: 1}, castSpd: {t: 0.0, r: 1}},
    spectre: {pAtk:{t: 1, r: 5}, eAtk:{t: 0.0, r: 1}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 5}, def: {t: 0.0, r: 1}, castSpd: {t: 0.0, r: 1}},
    elemental: {pAtk:{t: 1, r: 5}, eAtk:{t: 0.0, r: 1}, maxHP: {t: 1, r: 10},
        speed: {t: 0, r: 2}, def: {t: 0.0, r: 1}, castSpd: {t: 0.0, r: 1}},
    mecha: {pAtk:{t: 0, r: 10}, eAtk:{t: 0, r: 10}, maxHP: {t: 0, r: 40},
        speed: {t: 0.0, r: 2}, def: {t: 0.0, r: 10}, castSpd: {t: 1, r: 10}},
}
const moveType = {
    light: {matter: plasma, dmg: {electro: 0.3, heat: 0.3}},
    electric: {matter: plasma, dmg: {electro: 1.0}, soak: {electro: 0.1}}, 
    water: {matter: liquid, dmg: {hard: 0.2, cold: 0.1}, soak: {water: 0.1}},
    fire: {matter: plasma, dmg: {heat: 0.9}, soak: {hot: 0.2}},
    ice: {matter: solid, dmg: {cold: 0.9}, soak: {cold: 0.05}},
    wind: {matter: gas, dmg: {cold: 0.3, elastic: 0.3}},
    corrode: {matter: liquid, dmg: {hard: 0.5, chem: 0.6}, soak: {chem: 0.2}},
    fumes: {matter: gas, dmg: {chem: 0.7}, soak: {chem: 0.05}},
    smash: {matter: solid, dmg: {tough: 0.9, hard: 0.1, elastic: 0.2}}, 
    slice: {matter: solid, dmg: {tough: 0.1, hard: 0.9, elastic: 0.05}},
    shockwave: {matter: solid, dmg: {tough: 0.5, hard: 0.1, elastic: 0.5}},
    drill: {matter: solid, dmg: {tough: 0.2, hard: 0.1, elastic: 0.8}},
    cold: {matter: gas, dmg: {cold: 0.7}, soak: {cold: 0.1}},
}
const moveEffects = {
    slow: {effectType: "movement", totalDuration: 50, speedChangeType: "easeIn", buff: 0, buffScale: 0.8},
    chilled: {effectType: "movement", totalDuration: 50, speedChangeType: "easeIn", buff: 0, buffScale: 0.8},
}
const movesAOE = {
    chill: {dmgScale: 0.2, types: [moveType.wind], abilityType: "area", falloffStart: 5, rangeEnd: 20, baseCD: 30},
    electrofield: {dmgScale: 0.2, types: [moveType.wind], abilityType: "area", falloffStart: 5, rangeEnd: 20, baseCD: 30},
}
const movesProjectile = {
    air_slice: {dmgScale: 0.7, types: [moveType.slice, moveType.cold], abilityType: "projectile", projSpeed: 20, falloffStart: 20, rangeEnd: 50, baseCD: 500},
    flame: {dmgScale: 0.6, types: [moveType.fire, moveType.cold], abilityType: "projectile", projSpeed: 5, falloffStart: 5, rangeEnd: 10, baseCD: 50},
}
const movesHitscan = {
    light_blast: {dmgScale: 0.5, types: [moveType.electric], abilityType: "hitscan", falloffStart: 0, rangeEnd: 30, baseCD:1000},
    zap: {dmgScale: 0.5, types: [moveType.electric], abilityType: "hitscan", falloffStart: 0, rangeEnd: 20, baseCD: 100},
}
const movesMelee = {
    bite: {dmgScale: 0.5, types: [moveType.drill], abilityType:"melee", baseCD: 30},
    claw: {dmgScale: 0.3, types: [moveType.slice], abilityType:"melee", baseCD: 30},
    drill: {dmgScale: 0.6, types: [moveType.drill], abilityType:"melee", baseCD: 30},
    kick: {dmgScale: 0.6, types: [moveType.smash], abilityType:"melee", baseCD: 30},
    punch: {dmgScale: 0.6, types: [moveType.smash], abilityType:"melee", baseCD: 30},
}
const movesMovement = {
    dash: {dmgScale: 0, types: [], abilityType: "movement", totalDuration: 20, speedChangeType: "ease out", buff: 5, buffScale: 1, baseCD: 100},
    teleport: {dmgScale: 0, types: [], abilityType: "movement", totalDuration: 1, speedChangeType: "instant", buff: 10, buffScale: 1, baseCD: 100},
    ram: {dmgScale: 0.5, types: [moveType.smash], abilityType: "movement", totalDuration: 30, speedChangeType: "ease in", buff: 3, buffScale: 1,  baseCD: 100},
}

//
//ability movement can take new velocity input or current entity velocity
//aim direction can take new aim dir input or current
function abilityProcess(ability, entity, targetEntity = null, aimDirection = null, moveDirection = null){
    if (!targetEntity && !aimDirection && !moveDirection) return null;
    let preDamage = 0;
    for (let type of ability.types){
        if (type.matter == solid){
            preDamage += type.dmgScale * entity.pAtk;
        } else {
            preDamage += type.dmgScale * entity.eAtk;
        }
    }
    if (ability.abilityType == "movement"){
        let dir = {x:0, y:0, z:0};
        if (moveDirection){
            dir = moveDirection;
        } else {
            dir = entity.aimDir;
        }
        entity.buffs.push({type: "speed", totalDuration: ability.totalDuration, speedChangeType: ability.speedChangeType,
        buff: ability.buff, buffScale: ability.buffScale, dir: entity.aimDir})
    } else if (ability.abilityType == "melee"){
        if (!targetEntity) return null;
        addSoakToEntity(ability, targetEntity)
        dealDamage(entity, targetEntity);
    }

}

function dealDamage(fromEntity, toEntity){
    //fromEntity sometimes for team score stats etc.

    //damage multiplier: electric deals more damage if holds water
    if (toEntity.soak[element] > 0){
        //etc etc etc.
    }
}
function addSoakToEntity(ability, entity){
    if (entity.soak[element] >= entity.capacity[element]){
        //cant hold any more soak
    }
}

let entity = {
    pos: {x:0, y:0, z:0},
    aimDir: {x:0.45, y:0.45, z:0.45},
    vel: {x:0, y:0, z:0},
    ability1: movesAOE.chill,
    ability2: movesMelee.bite,
    buffs: [],
    pAtk: 10,
    eAtk: 20,
    HP: 200,
    speed: 1,
}
let entity2 = {
    pos: {x:3, y:3, z:3},
    aimDir: {x:0.45, y:0.45, z:0.45},
    vel: {x:0, y:0, z:0},
    ability1: movesAOE.chill,
    ability2: movesMelee.bite,
    buffs: [],
    pAtk: 20,
    eAtk: 10,
    HP: 200
}
console.log(entity.abilityProcess(entity.ability1, entity2 ))
