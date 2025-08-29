const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

let CW = canvas.width;
let CH = canvas.height;

function checkRange(x, y, radius, entityList, flag){
  let inRange = [];
  for (let i = 0; i < entityList.length; i++){
    let entity = entityList[i];
    let dx = entity.pos.x - x;
    let dy = entity.pos.y - y;
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
    primary: {dmg: 2, spread: 0.1, mag: 30, rof: 60, falloffStart: 50, diminish: 0.1, wpnType: "projectile"}, //diminish dmg by x per 1 unit
    secondary: {dmg: 10, spread: 0.1, mag: 8, rof: 40, falloffStart: 50, diminish: 0.1, wpnType: "projectile"}, //rof or tick cooldown
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
        this.pos.x = team.x +(( Math.random()-0.5)*30);
        this.pos.y = team.y + ((Math.random()-0.5)*30);
        entitiesList.push(this)
        team.players.push(this)
    }
    moveCommand(){
        this.pos.x += this.vel.x * this.walkSpd;
        this.pos.y += this.vel.y * this.walkSpd;
        this.pos.x = Math.min(CW, Math.max(0,this.pos.x))
        this.pos.y = Math.min(CH, Math.max(0,this.pos.y))
        this.vel = {x:0, y:0};
    }
    aimCommand(){
        this.aim.x += this.aimvel.x;
        this.aim.y += this.aimvel.y;
        this.aimvel = {x:0, y:0};
    }
    fireReq(globalTime){
        //this.lastFiredAuto = 0
        if (this.reloading){
            return null;
        }
        if ((globalTime - this.lastFired.auto) >= 1/this.equipped.rof*10){
          this.fireCommand();
          this.lastFired.auto = globalTime
        }
    }
    meleeReq(globalTime){
        if (this.reloading){
            return null;
        }
        if((globalTime - this.lastFired.melee) >= 1/this.CD.melee*100){
          this.meleeCommand();
        }
    }
    fireCommand(){
      switch(this.equipped.wpnType){
        case "melee":
          break;
        case "hitscan":
          break;
        case "projectile":
          createProjectile(this.pos, this.aim, this.team.id)
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
    this.pressures = []
    botsList.push(this)
    this.initialize(x, y, team)

  }
  initialize(x, y, team){
    let avatar = new Avatar(x, y, team)
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
        pos: entity.pos,
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
        let legroom = this.connected.size * 3;
        //find a spot at legroom distance at
        //somewhat perpendicular to
        //friendly's aim vector
        let angle = Math.atan2(data.aimDir.y, data.aimDir.x) + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2);
        let pos = {
          x: data.pos.x + Math.cos(angle) * legroom,
          y: data.pos.y + Math.sin(angle) * legroom,
        };
        desirablePositions.push(pos)
      }

    }
    decideE(){
      //all vectors might be same magnitude for movement
      //can end up strafing to fight or chasing low hp enemies
      //fight/flight actions depending on vector
      //aim down but lose running on fuller hp
      //strafe but lose accuracy
      let pressureVectors = [];
      let safeDist = this.connected.equipped.falloffStart;
      for (let data of this.enemyData){
        let pressure = Math.min(safeDist / data.dist, 1); // Pressure decreases with distance
        let hpRatio = data.hp / data.maxhp;
        pressure *= (1 - hpRatio/2); 
        let selfHealthRatio = this.connected.hp / this.connected.maxHealth;
        if (selfHealthRatio < 0.3) {
          pressure *= 0.5; 
        }
        let magazineRatio = this.connected.magazineCurrent / this.connected.equipped.mag;
        pressure *= magazineRatio;
        let aimAngle = Math.atan2(this.connected.aim.y, this.connected.aim.x);
        let enemyAngle = Math.atan2(data.aimDir.y, data.aimDir.x);
        let angleDiff = Math.abs(aimAngle - enemyAngle);
        if (angleDiff < Math.PI / 4) {
          pressure *= 1.1; // Increase pressure if directly aiming at enemy
        } else if (angleDiff > (3 * Math.PI) / 4) {
          pressure *= 0.9; // Decrease pressure if enemy is behind
        }
        let p = {
          x: data.dir.x * pressure,
          y: data.dir.y * pressure,
          vel: data.velDir, 
          healthPressure: hpRatio - selfHealthRatio
        };
        pressureVectors.push(p);
        this.pressures = pressureVectors;
      }
    }
    decideAction(tick){
      let seed = Math.random(); //might be used later
      if (this.pressures.length > 0 ){ //simple
        let dist = this.enemyData[0].dist * 1
        let aimAt = {x:this.pressures[0].x + this.pressures[0].vel.x * dist, y: this.pressures[0].y + this.pressures[0].vel.y * dist};
        this.fireDecision = true;
        this.connected.fireReq(tick)//or just this
        //move aiming velocity to aimAt
        this.connected.aimvel.x = (aimAt.x - this.connected.aim.x) * 0.9;
        this.connected.aimvel.y = (aimAt.y - this.connected.aim.y) * 0.9;

        let h = this.pressures[0].healthPressure
        if (h < 0.3 && h > -0.3){
          let perp = {
          x: -this.pressures[0].y,
          y: this.pressures[0].x
          };
          this.connected.vel.x += perp.x * 0.5;
          this.connected.vel.y += perp.y * 0.5;
        } else if (h < -0.3){
          this.connected.vel.x -= this.pressures[0].x;
          this.connected.vel.y -= this.pressures[0].y;
        } else if (h > 0.3){
          this.connected.vel.x += this.pressures[0].x;
          this.connected.vel.y += this.pressures[0].y;
        }
      }
      this.pressures = [];
      this.friendlyData = []
      this.enemyData = []
    }
    actionLoop(tick){
      this.reviewInstance();
      this.weighEntityPositions();
      this.decideF();
      this.decideE();
      this.decideAction(tick);
    }
}

let tick = 0;
let ms = 20;
let rate = ms/1000;
function teamCreate(teamnum, nop){
  let centerX = CW / 2;
  let centerY = CH / 2;
  let radius = Math.min(CW, CH) / 10; // Distance from center
  for (let i = 0; i < teamnum; i++) {
    let angle = (2 * Math.PI / teamnum) * i;
    let spawnX = centerX + Math.cos(angle) * radius;
    let spawnY = centerY + Math.sin(angle) * radius;
    let team = { players: [], x: spawnX, y: spawnY , id: i, casualties: 0};

    for (let j = 0; j < nop; j++) {
      spawnX += Math.random() * 10;
      spawnY += Math.random() * 10;
      let bot = new Bot(spawnX, spawnY, team)
    }
    teams.push(team);
  }
}
teamCreate(2,2)

function createProjectile(position, dir, teamID){
  let projectile = {
    pos: {x: position.x, y: position.y},
    teamID: teamID,
    vel: {x: dir.x, y: dir.y},
    speed: 5,
    range: 200,
    traveled: 0,
    dmg: 5,
  }
  let mag = Math.hypot(projectile.vel.x, projectile.vel.y);
  projectile.vel.x = (projectile.vel.x / mag) * projectile.speed;
  projectile.vel.y = (projectile.vel.y / mag) * projectile.speed;
  projectileList.push(projectile);
}
function updateProjectiles(){
  for (let i = projectileList.length - 1; i >= 0; i--){
    let p = projectileList[i];
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.traveled += p.speed;
    if (p.traveled >= p.range){
      projectileList.splice(i, 1);
      continue;
    }
    //check collision with entities
    let hitEntities = checkRange(p.pos.x, p.pos.y, 3, entitiesList, 0);
    for (let entity of hitEntities){
      if (entity.team.id !== p.teamID){
        entity.hp -= p.dmg;
        console.log(entity.hp, entity.id)
        projectileList.splice(i, 1);
        break;
      }
    }
  }
}

function animate(){
  ctx.clearRect(0, 0, CW, CH)
  for(let avatar of entitiesList){
    ctx.fillRect(avatar.pos.x, avatar.pos.y, 10, 10)
  }
  for(let proj of projectileList){
    ctx.fillRect(proj.pos.x, proj.pos.y, 2, 2)
  }
}
function calculate(tick){
  for (let bot of botsList){
    bot.actionLoop(tick);
  }
  for (let avatar of entitiesList){
    avatar.actionLoop();
  }
  updateProjectiles();
}
function loop(rate){
  animate();
  calculate(tick)
  tick += rate;
}

setInterval(() => loop(rate), ms)
