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
        size: fill, stamina: fill, energy: fill
    }
}
function addStats(){}
function multStats(){}



//effectiveness: overall ability effectiveness against the creature, based on solid,liquid,gas 
//properties: old way of calculating extra base stats, might be defunct compared to effectiveness and hurtscale
//hurtScale: energy atk effectiveness, may include physical atks in replacement of properties
//statBoost: stat boost per 5 size units when initializing or morphing a creature
//maybe add recovery stat for stamina and energy: some soaks slow it down/speed it up/restore it for certain comps, etc
const composite = {
    animal: {
        name: "animal", effectiveness:{physical: 1, energy: 1}, 
        eHurtScale: {tempChange: 1, chem: 1, water: 0.75, electric: 1},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        baselines: {temp: 0.5, water: 0, electric: 0.0, chemical: 0}, //The ratio of capacity soaks that it will bleed to.
        capacityScale: {water: 1, cold: 1, hot: 1, electric: 1, chemical: 1}, //per 1 size unit
        tempThresholds: {hot: 0.7, cold:0.3}, //ratios indicating threshold before temp change actually does damage
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
        capacityScale: {water: 1, cold: 2, hot: 2, electric: 0.5, chemical: 0.5},
        statBoost: {maxHP:3, pAtk: 2, eAtk: 2, spd: 0},
        specialEffects: []
    },
    lava: {
        name: "lava", effectiveness:{physical: 0.75, energy: 0.75},
        eHurtScale: {tempChange: 0.5, chem: 0.25, water: 1.5, electric: 0.5},
        pHurtScale: {pierce: 0.75, slash: 0.75, impact: 1.25, drill: 1},
        baselines: {temp: 0.9, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, cold: 2, hot: 2, electric: 0.5, chemical: 0.5},
        statBoost: {maxHP:3, pAtk: 2, eAtk: 2, spd: 0},
        specialEffects: ["waterHarden", "fireUp", "burnoff"]
    },
    ice: {
        name: "ice", effectiveness:{physical: 0.75, energy: 0.75},
        eHurtScale: {tempChange: 1.5, chem: 0.25, water: 1, electric: 0.5},
        pHurtScale: {pierce: 1.5, slash: 0.75, impact: 1.75, drill: 1},
        baselines: {temp: 0.2, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, cold: 2, hot: 2, electric: 0.5, chemical: 0.5},
        statBoost: {maxHP:3, pAtk: 2, eAtk: 2, spd: 0},
        specialEffects: ["waterHarden", "solidIce"]
    },
    rock: {
        name: "rock", effectiveness:{physical: 1, energy: 0.5},
        eHurtScale: {tempChange: 0.5, chem: 0.25, water: 1.5, electric: 0.5},
        pHurtScale: {pierce: 0.5, slash: 0.5, impact: 1.25, drill: 1.5},
        baselines: {temp: 0.9, water: 0, electric: 0, chemical: 0},
        capacityScale: {water: 1, cold: 1, hot: 1, electric: 1, chemical: 1},
        statBoost: {maxHP:3, pAtk: 5, eAtk: 5, spd: 0},
        specialEffects: ["hardSurface"]
    }
}

//might rework to make effects return functions for additional tick
const soakEffects = {
    water: {name: "water", effect: "none", vulnerability: ["electric"], boost: "none", per: 1},
    electric: {name: "electric", effect: "damage", vulnerability: [], boost: "energy", per: 1},
    cold: {name: "freezing", effect: "brittle", vulnerability: ["impact"], boost: "none", per: 1}, 
    hot: {name: "sweltering", effect: "melt", vulnerability: ["slash", "pierce", "drill"], boost: "none", per: 1},  
    chemical: {name: "chemical", effect: "damage", vulnerability: "none", boost: "none", per: 1},
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
    waterHealed: {
        name: "Water Healing",
        desc: "Instead of normal water soak depletion, consume it to heal 1 health per 1 water unit"
    },
    fireUp: {
        name: "Fired up",
        desc: "When gaining heat, boost energy attacks from this creature."
    },
    burnoffAll: {
        name: "Burnoff",
        desc: "All soaks burn off twice as fast on this creature."
    },
    hardSurface:{
        name:"Hard Surface",
        desc: "All soaks are consumed instantly as half damage on this creature"
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
        name: "Frost Wind", category: "AOEInstant", flatDmg: {p: 0, e: 1}, dmgScale: {p: 0, e: 0.2}, cooldown: 200,
        effects: [], soakAdd: [], args: [{delayStart:0}, {maxCastRange:50}, {radius:50}, {pos: "anchorToEntity"}, {dps: 20}, {life: 100}] //just for planning, etc
    },
    zap: {
        name: "Zap", category: "Hitscan", flatDmg: {p: 0, e: 20}, dmgScale: {p: 0, e: 0.8}, cooldown: 100,
        effects: [], soakAdd: ["electric"], args: []
    }
}
const temp = { //lazy
    baseStats: {pAtk: 10, eAtk: 0, maxHP:100, spd: 10, castSpd: 100, range: 10, size: 10, stamina: 20, energy: 0},
    maxVariation: {pAtk: 5, eAtk: 5, maxHP:20, spd: 10, castSpd: 50, range: 0, size: 5, stamina: 10, energy: 10},
    levelUp: {pAtk: 2, eAtk: 2, maxHP:10, spd: 5, castSpd: 10, range: 1, size: 1, stamina: 5, energy: 5},
    baseMoveset: ["ram"]
}
const species = {
    dog: {
        name: "Dog", baseStats: temp.baseStats, maxVariation: temp.maxVariation,
        levelUpBoost: temp.levelUp, baseMoveset: temp.baseMoveset,
        commonComp: {inner: ["animal"], outer: ["animal"]},
        morphs: { 
            stage1: { //add stuff for more base stats
                armoredDog: {name:"Steel Dog", composite: {inner: "animal", outer:"metal"}, morphPointsNeeded: [{metal: 50}]}, morphNeeded: n,
                cyberDog: {name:"Cyber Dog", composite: {inner: "metal", outer:"animal"}, morphPointsNeeded: [{metal: 20}, {electric:20}]}
            },
            stage2: {} //probably more base stats, allowed moves
        }
    },
    shrubling: {
        name: "Shrubling", baseStats: temp.baseStats, maxVariation: temp.maxVariation,
        levelUpBoost: temp.levelUp,  baseMoveset: temp.baseMoveset,
        commonComp: {inner: ["plant"], outer: ["plant"]}
    },
}
