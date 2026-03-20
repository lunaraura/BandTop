//pok simulator
const types = {
    normal: {name: "normal", immune: [ghost], weak: [fighting], strong: []},
    fire: {name :"fire", immune: [], weak: [water, rock], strong: [grass, ice, bug, steel]},
    water: {name :"water", immune: [], weak: [electric, grass], strong: [fire, ground, rock]},
    electric: {name :"electric", immune: [], weak: [ground], strong: [flying, water]},
    ice: {name :"ice", immune: [], weak: [fire, fighting, rock, steel], strong: [grass, ground, flying, dragon]},
    fighting: {name :"fighting", immune: [], weak: [flying, psychic, fairy], strong: [normal, ice, rock, dark, steel]},
    poison: {name :"poison", immune: [], weak: [ground, psychic], strong: [grass, fairy]},
    ground: {name : "ground", immune: [electric], weak: [water, grass, ice], strong: [fire, electric, poison, rock]},
    flying: {name : "flying", immune: [], weak: [electric, ice, rock], strong: [fighting, bug, grass]},
    bug: {name : "bug", immune: [], weak: [fire, flying, rock], strong: [grass, psychic, dark]},
    rock: {name : "rock", immune: [], weak: [water, grass, fighting, ground], strong: [fire, ice, flying, bug]},
    ghost: {name : "ghost", immune: [normal], weak: [ghost], strong: [ghost]},
    dragon: {name : "dragon", immune: [], weak: [ice, dragon, fairy], strong: [dragon]},
    dark: {name : "dark", immune: [fighting], weak: [fighting, bug, fairy], strong: [ghost, psychic]},
    steel: {name : "steel", immune: [poison], weak: [fire, fighting, ground], strong: [ice, rock]},
    fairy: {name : "fairy", immune: [dragon], weak: [poison, steel], strong: [fighting, dragon, dark]},
}
const movePool = {
    HeadlongRush: {cat: "physical", power: 120, type: "ground", acc: 1, pp: 5, effects: []},
    Earthquake: {cat: "physical", power: 100, type: "ground", acc: 1, pp: 10, effects: []},
    IceSpinner: {cat: "physical", power: 80, type: "ice", acc: 1, pp: 15,effects: []},
    KnockOff: {cat: "physical", power: 80, type: "dark", acc: 1, pp: 15,effects: []},
    KnockOff: {cat: "physical", power: 80, type: "dark", acc: 1, pp: 15,effects: []},
    CloseCombat: {cat: "physical", power: 80, type: "fighting", acc: 1, pp: 15,effects: []},
    DrainPunch: {cat: "physical", power: 80, type: "fighting", acc: 1, pp: 15,effects: []},
}
const presets = {
    GreatTusk: {base: {hp: 115, atk:131, def:131, spatk:53, spdef:53, speed:87}, typing: [ground, fighting], movePool: []}
}

class Pocket {
    constructor(){
        this.current = null;
        this.team = {
            active: null,
            bench: []
        }
    }
}
class Monster {
    constructor(preset){

    }
    initialize(){
        this.stats = {
            hp: 0,
            atk: 0,
            spatk: 0,
            def: 0,
            spdef: 0,
            speed: 0,
        }
        this.multiplyStage = {
            atk: 0,
            spatk: 0,
            def: 0,
            spdef: 0,
            speed: 0,
            accuracy: 0,
            evasion: 0,
        }
        this.battleStats = {
            hp: 0,
            atk: 0,
            spatk: 0,
            def: 0,
            spdef: 0,
            speed: 0,

        }
    }
}
