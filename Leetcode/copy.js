const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

let CW = canvas.width;
let CH = canvas.height;

function checkRange(x, y, radius, entityList, flag){
  let inRange = [];
  for (let i = 0; i < entityList.length; i++){
    let entity = entityList[i];
    let dx = entity.x - x;
    let dy = entity.y - y;
    let dist = Math.sqrt(dx*dx + dy*dy) 
    if (flag == 1){
      dist = dist - entity.radius;
    }
    if (dist <= radius) {
      inRange.push(entity);
    }
  }
  return inRange;
}

// playerControls
let playerControls = {w: 0, a:0, s:0, d:0, space:0, pointX:0, pointY:0, click: 0}
canvas.addEventListener("mousedown", () => {
  playerControls.click = 1
});
canvas.addEventListener("mouseup", () => {
  playerControls.click = 0;
});
canvas.addEventListener("mousemove", (event) => {
  playerControls.pointX = event.offsetX;
  playerControls.pointY = event.offsetY;
})
document.addEventListener("keyup", (event) => {
  switch(event.key){
    case "q":
      playerControls.q = 0;
      break;
    case "w":
      playerControls.w = 0;      
      break;
    case "e":
      playerControls.e = 0;
      break;
    case "a":
      playerControls.a = 0;      
      break;
    case "s":
      playerControls.s = 0;
      break;
    case "d":
      playerControls.d = 0;      
      break;
  }
});
document.addEventListener("keydown", (event) => {
  switch(event.key){
    case "q":
      playerControls.q = 1;
      break;
    case "w":
      playerControls.w = 1;      
      break;
    case "e":
      playerControls.e = 1;
      break;
    case "a":
      playerControls.a = 1;      
      break;
    case "s":
      playerControls.s = 1;
      break;
    case "d":
      playerControls.d = 1;      
      break;
  }
});
//
const base = {
    mh: 100,
    walkSpd: 1,
    runSpd: 3,
    size: 5,
    meleeRange: 10,
    primary: {dmg: 2, spread: 0.1, mag: 30, rof: 10, falloffStart: 50, diminish: 0.1, wpnType: "hitscan"}, //diminish dmg by x per 1 unit
    secondary: {dmg: 10, spread: 0.1, mag: 8, rof: 40, falloffStart: 50, diminish: 0.1, wpnType: "hitscan"}, //rof or tick cooldown
    melee: 10,
    ab1: 200,
    ab2: 400
}
//
let entitiesList = []
let teams = []
let projectileList = []
let botsList = []

let entityID = 0

class Avatar{
    constructor(x, y, team){
        this.id = entityID++;
        this.team = team;
        this.pos = {x:x, y:y};
        this.aim = {x:0, y:0};
        this.vel = {x:0, y:0};
        this.aimvel = {x:0, y:0};
        
        this.maxHealth = base.mh;
        this.hp = this.maxHealth;
        this.walkSpd = base.walkSpd;
        this.runSpd = base.runSpd;
        this.size = base.size;
        this.meleeRange = this.size + base.meleeRange;
        this.magazineCurrent = 30;
        this.primary = base.primary;
        this.secondary = base.secondary;
        this.equipped = this.primary
        this.lastFired = {auto: 0, melee: 0, ability1: 0, ability2: 0}
        this.CD = {auto: this.equipped.rof, melee: base.melee, ability1: base.ab1, ability2: base.ab2}
        this.spawn(this.team)
    }
    spawn(team){
        this.x = team.x +(( Math.random()-0.5)*30);
        this.y = team.y + ((Math.random()-0.5)*30);
        entitiesList.push(this)
        team.players.push(this)
    }
    moveCommand(){
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
    }
    aimCommand(){
        this.aim.x += this.aimvel.x
        this.aim.x += this.aimvel.x
    }
    fireReq(globalTime){
        //this.lastFiredAuto = 0
        if (this.reloading){
            return null;
        }
        if ((globalTime - this.lastFired.auto) >= 1/this.equipped.rof*10){
          this.fireCommand();
        }
    }
    meleeReq(globalTime){
        if (this.reloading){
            return null;
        }
        if((globalTime - this.lastFired.melee) >= 1/this.CD.melee*10){
          this.meleeCommand();
        }
    }
    fireCommand(){
      switch(this.equipped.type){
        case "melee":
          break;
        case "hitscan":
          break;
        case "projectile":
          break;   
      }
    }
    meleeCommand(){

    }
    actionLoop(time){
      this.moveCommand();
      this.aimCommand();
    }
}

class Bot {
  constructor(x, y, team){
    this.connected = null;
    this.observedEntities = [];
    this.friendlyData = [];
    this.enemyData = [];
    this.autonomyRatio = 0.3;
    this.desirablePositions = []
    this.pressurePositions = []
    botsList.push(this)
    this.initialize(x, y, team)

  }
  initialize(x, y, team){
    let avatar = new Avatar(x,y,team)
    this.connected = avatar;
  }
  reviewInstance(){
    let view = 200;
    this.observedEntities = checkRange(this.connected.pos.x, this.connected.pos.y, view, entitiesList)
  }
  weighEntityPositions(){
    const bot = this.connected;
    for (let entity of this.observedEntities){
      if (entity.id === bot.id) continue;
      const dx = entity.pos.x - bot.pos.x;
      const dy = entity.pos.y - bot.pos.y;
      const dist = Math.hypot(dx, dy);
      const aimVector = {x: dx/dist, y: dy/dist};
      let data = {
        entity: entity.id,
        hp: entity.hp,
        maxhp: entity.maxHealth,
        wpnType: entity.equipped.type,
        dist: dist,
        dir: aimVector,
        velDir: entity.vel,
        aimDir: entity.aim,
      }
      if (entity.team === bot.team){
        this.friendlyData.push(data)
      } else {
        this.enemyData.push(data)
        }
      }
    }
    wanderMovement(){
      //explore for something
    }
    decideF(){
      let desirablePositions = [];
      //sort by closest?
      for (let data of this.friendlyData){
        let legroom = this.connected.size * 2;
        //find a spot at legroom distance at
        //somewhat perpendicular to
        //friendly's aim vector
        let angle = Math.atan2(data.aimDir.y, data.aimDir.x) + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
        let pos = {
          x: this.data.pos.x + Math.cos(angle) * legroom,
          y: this.data.pos.y + Math.sin(angle) * legroom,
        };
        desirablePositions.push(pos)
      }
    }
    decideE(){
      let pressureVectors = [];
      //all vectors might be same magnitude for movement
      //can end up strafing to fight or chasing low hp enemies
      //fight/flight actions depending on vector
      //aim down but lose running on fuller hp
      //strafe but lose accuracy
      let safeDist = this.connected.equipped.falloffStart;
      for (let data of this.enemyData){
        let pressure = Math.min(safeDist / data.dist, 1); // Pressure decreases with distance
        let hpRatio = data.hp / data.maxhp;
        pressure *= (1 - hpRatio/2); // More pressure on lower hp enemies
        let selfHealthRatio = this.connected.hp / this.connected.maxHealth;
        if (selfHealthRatio < 0.3) {
          pressure *= 0.5; // Reduce pressure if self hp is low
        }
        let magazineRatio = this.connected.magazineCurrent / this.connected.equipped.mag;
        pressure *= magazineRatio; // More pressure with more ammo
        //if looking at enemy right now, weigh closer to fight
        //if not, aim weight towards enemy.
        //if enemy is aiming at player (data.dir.x * -1. .y * -1), flight
        let aimAngle = Math.atan2(this.connected.aim.y, this.connected.aim.x);
        let enemyAngle = Math.atan2(data.aimDir.y, data.aimDir.x);
        let angleDiff = Math.abs(aimAngle - enemyAngle);
        if (angleDiff < Math.PI / 4) {
          pressure *= 1.2; // Increase pressure if directly aiming at enemy
        } else if (angleDiff > (3 * Math.PI) / 4) {
          pressure *= 0.8; // Decrease pressure if enemy is behind
        }
        let vector = {
          x: data.dir.x * pressure,
          y: data.dir.y * pressure,
        };
        console.log(vector)
        pressureVectors.push(vector);
      }
    }
    actionLoop(){
      this.reviewInstance();
      this.weighEntityPositions();
      this.decideF();
      this.decideE();
    }
}

let tick = 0;
let ms = 1000
let rate = ms/100;
let team1 = {x: 10, y: 10, id: 1, players: []}
let team2 = {x: 30, y: 30, id: 1, players: []}
let bot1 = new Bot(10, 10, team1)
let bot2 = new Bot(30, 30, team2)

function animate(){
  ctx.clearRect(0, 0, CW, CH)
  for(let avatar of entitiesList){
    ctx.fillRect(avatar.pos.x, avatar.pos.y, 10, 10)
  }
}
function calculate(tick){
  for (let bot of botsList){
    bot.actionLoop();
  }
  for (let avatar of entitiesList){
    avatar.actionLoop();
  }
}
function loop(rate){
  animate();
  calculate(tick)
  tick += rate;
}

setInterval(() => loop(rate), ms)
