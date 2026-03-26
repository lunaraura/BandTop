class Creature{
    constructor(){
        //init 
        this.species = null;
        this.family = null;
        this.brain = null; //ai controller class
        //composite
        this.composites = {inner: null, outer: null}
        //stats
        this.baseStats = {}; //initialized from species & composites
        this.inherentStats = {}; //individual values
        this.learnedStats = {} //effort values
        this.statMultipliers = {} //multipliers
        this.currentStats = {} //current stats used in comb
        //soak capacities
        this.soak = {}
        //moveset
        this.moveset = {}
        this.effects = {}
        this.cooldown = {}
        //status
        this.windingAttack = false;
        this.moving = false;
        this.inWorld = false;
        this.pos = {x:null, y:null}
        this.vel = {x: 0, y: 0}
        this.aiming = 0; //radians
        this.aimVel = 0;
        this.canIntendToMove = true;
        this.canIntendToAim = true;
        //intents set by controller
        this.intent = {
            vel: {x: 0, y: 0},
            rotVel: 0,
            ab: {ab1: false, ab2: false, ab3: false, ab4: false},
            
        }
    }
    init(){
        //set stats from species and then both composites' bonus
    }
}

//effectiveness: overall ability effectiveness against the creature, based on solid,liquid,gas 
//properties: old way of calculating extra base stats, might be defunct compared to effectiveness and hurtscale
//hurtScale: energy atk effectiveness, may include physical atks in replacement of properties
//statBoost: flat statboosts when initializing or morphing a creature (physical defense and energy resistance may be replaced by hurtScale)
const composite = {
    organic: {
        name: "organic", effectiveness:{physical: 1, energy: 1}, 
        prop: {tough:0.60,hard:0.30,energy:0.20,elastic:0.70,tempBaseline:0.50,chemResist:0.20,electroResist:0.30,density:0.60,porosity:0.50},
        eHurtScale: {tempChange: 1, chem: 1, water: 0.75, electric: 1.5},
        pHurtScale: {pierce: 1, slash: 1, impact: 1, drill: 1},
        statBoost: {hp:0, pAtk: 5, eAtk: 0, speed: 0},
    }
}
