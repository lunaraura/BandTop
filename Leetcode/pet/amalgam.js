const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
class RNG{constructor(seed=123456789){this.s=(seed>>>0)||1;}next(){this.s=(1664525*this.s+1013904223)>>>0;return this.s;}float(){return (this.next()&0xffff)/0x10000;}int(a,b){return a + (this.next()%(b-a+1));}}
const F2=0.5*(Math.sqrt(3)-1), G2=(3-Math.sqrt(3))/6;
const grad3=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
let perm; function reseedNoise(seed=0){ const r=new RNG(seed||1); const p256=new Uint8Array(256); for(let i=0;i<256;i++) p256[i]=i; for(let i=255;i>0;i--){ const j=r.int(0,255); const t=p256[i]; p256[i]=p256[j]; p256[j]=t; } perm=new Uint8Array(512); for(let i=0;i<512;i++) perm[i]=p256[i&255]; } reseedNoise(1234);
function dot2(g,x,y){ return g[0]*x+g[1]*y; }
function noise2(xin,yin){
  let n0=0,n1=0,n2=0;
  const s=(xin+yin)*F2;
  const i=Math.floor(xin+s), j=Math.floor(yin+s);
  const t=(i+j)*G2, X0=i-t, Y0=j-t;
  const x0=xin-X0, y0=yin-Y0;
  let i1,j1; if(x0>y0){ i1=1;j1=0; } else { i1=0;j1=1; }
  const x1=x0-i1+G2, y1=y0-j1+G2;
  const x2=x0-1+2*G2, y2=y0-1+2*G2;
  const ii=i&255, jj=j&255;
  const gi0=perm[ii+perm[jj]]%8;
  const gi1=perm[ii+i1+perm[jj+j1]]%8;
  const gi2=perm[ii+1+perm[jj+1]]%8;
  let t0=0.5-x0*x0-y0*y0; if(t0>0){ t0*=t0; n0=t0*t0*dot2(grad3[gi0],x0,y0); }
  let t1=0.5-x1*x1-y1*y1; if(t1>0){ t1*=t1; n1=t1*t1*dot2(grad3[gi1],x1,y1); }
  let t2=0.5-x2*x2-y2*y2; if(t2>0){ t2*=t2; n2=t2*t2*dot2(grad3[gi2],x2,y2); }
  return 70*(n0+n1+n2);
}
const Params = { CELL:20, WATER_BASE:8, SEED:1335 };
const SHAPE = {
  Taiga:{ amp:142, freq:0.018, rough:0.55, base: 2, water: 0 },
  Meadow:{amp:118, freq:0.006, rough:0.30, base: 0, water: 0 },
  Beach:{ amp:106, freq:0.010, rough:0.25, base:-3, water:-1},
  Swamp:{ amp:108, freq:0.004, rough:0.25, base:-1, water: 2 },
};
const BiomeNoise = {
  biomeMix(x, z, seed) {
    const gx = Math.floor(x / Params.CELL);
    const gz = Math.floor(z / Params.CELL);
    const fx = x / Params.CELL - gx;
    const fz = z / Params.CELL - gz;

    const w00 = weightsAtCell(gx, gz, seed);
    const w10 = weightsAtCell(gx + 1, gz, seed);
    const w01 = weightsAtCell(gx, gz + 1, seed);
    const w11 = weightsAtCell(gx + 1, gz + 1, seed);

    const out = {};
    addScaled(out, w00, (1 - fx) * (1 - fz));
    addScaled(out, w10, fx * (1 - fz));
    addScaled(out, w01, (1 - fx) * fz);
    addScaled(out, w11, fx * fz);

    let s = 0;
    for (const v of Object.values(out)) s += v;
    if (s > 1e-6) {
      for (const k in out) {
        out[k] /= s;
      }
    }
    return out;
  },
};

const Heightfield = {
  sample(x, z, seed) {
    const w = BiomeNoise.biomeMix(x, z, seed);
    let amp = 0, freq = 0, rough = 0, base = 0, water = 0;

    for (const [name, wt] of Object.entries(w)) {
      const p = SHAPE[name];
      if (p) {
        amp += wt * p.amp;
        freq += wt * p.freq;
        rough += wt * p.rough;
        base += wt * p.base;
        water += wt * p.water;
      }
    }

    const n = fbm(x, z, seed, freq, rough);
    const nh = clamp(0.5 + 0.5 * n, 0, 1);
    const yG = base + amp * nh;
    const yW = Params.WATER_BASE + water;

    return { yG, yW, weights: w };
  },
};
function weightsAtCell(ix,iz,seed){
  const x=(ix+0.5)*Params.CELL, z=(iz+0.5)*Params.CELL;
  const T = clamp(0.5 + 0.5*noise2(x*0.00035, z*0.00035 + seed*0.11), 0, 1);
  const W = clamp(0.5 + 0.5*noise2(x*0.00070, z*0.00070 + seed*0.37), 0, 1);
  const wTaiga  = (1-T)*(1-W);
  const wMeadow = T*(1-W);
  const wSwamp  = (1-T)*W*0.7 + T*W*0.3;
  const coast   = 0.5 + 0.5*noise2(x*0.00090, z*0.00090 + seed*0.59);
  const near    = clamp(1 - Math.abs(coast - 0.5)*8, 0, 1);
  const wBeach  = near*0.9;
  const s = wTaiga+wMeadow+wSwamp+wBeach || 1;
  return { Taiga:wTaiga/s, Meadow:wMeadow/s, Swamp:wSwamp/s, Beach:wBeach/s };
}
function biomeMix(x,z,seed){
  const gx=Math.floor(x/Params.CELL), gz=Math.floor(z/Params.CELL);
  const fx=x/Params.CELL-gx, fz=z/Params.CELL-gz;
  const w00=weightsAtCell(gx,gz,seed), w10=weightsAtCell(gx+1,gz,seed);
  const w01=weightsAtCell(gx,gz+1,seed), w11=weightsAtCell(gx+1,gz+1,seed);
  const out={}; const add=(t,s)=>{ for(const k in t){ out[k]=(out[k]||0)+t[k]*s; } };
  add(w00,(1-fx)*(1-fz)); add(w10,fx*(1-fz)); add(w01,(1-fx)*fz); add(w11,fx*fz);
  let s=0; for(const v of Object.values(out)) s+=v; for(const k in out) out[k]/=s||1;
  return out;
}
function blend(components){
  const out=[0,0,0]; let total=0;
    for(const [wt,col] of components){
        out[0]+=col[0]*wt; out[1]+=col[1]*wt; out[2]+=col[2]*wt; total+=wt;
    }
    if(total>0){
        out[0]/=total; out[1]/=total; out[2]/=total;
    }
    return out;
}
function rgb(col){ return `rgb(${col[0]|0},${col[1]|0},${col[2]|0})`; }
function mix(c1,c2,t){
  const it=1-t;
    return [
        c1[0]*it + c2[0]*t,
        c1[1]*it + c2[1]*t,
        c1[2]*it + c2[2]*t,
    ];
}
function fbm(x,z,seed,f,rough){
  let sum=0, amp=1; rough=clamp(rough,0.15,0.95);
  for(let i=1;i<=3;i++){ sum += noise2(x*f, z*f + (seed||0)*i*0.137)*amp; f*=2; amp*=rough; }
  return sum;
}
function heightSample(x,z,seed){
  const w = biomeMix(x,z,seed);
  let amp=0,freq=0,rough=0,base=0,water=0;
  for(const [name,wt] of Object.entries(w)){
    const p=SHAPE[name]; if(!p) continue;
    amp += wt*p.amp; freq += wt*p.freq; rough += wt*p.rough; base += wt*p.base; water += wt*p.water;
  }
  const n   = fbm(x,z,seed,freq,rough);
  const nh  = clamp(0.5 + 0.5*n, 0, 1);
  const yG  = base + amp*nh;
  const yW  = Params.WATER_BASE + water;
  return { yG, yW, weights:w };
}
class World{
    constructor(){
        this.seed = 1335
        this.renderer = new Renderer();
        this.chunkManager = new ChunkManager();
        this.player = null;
    }
    tick(){
        if(this.player){
            this.chunkTick(this.player);
            this.chunkRender();
        }
    }
    chunkTick(player){
        const pcx = Math.floor(player.x / (Params.CELL * CELLS_PER_CHUNK));
        const pcz = Math.floor(player.z / (Params.CELL * CELLS_PER_CHUNK));
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                if (!this.chunkManager.chunks.has(`${cx},${cz}`)){
                    console.log(`Generating chunk ${cx}, ${cz}`);
                    this.chunkManager.generateChunk(cx, cz);
                } else {
                    const chunk = this.chunkManager.loadChunk(cx, cz);
                }
            }
        }
    }
    chunkRender(){
        //render chunks around player
        this.renderer.render(this.chunkManager.activeChunks);
    }
}
class ChunkManager{
    constructor(){
        this.chunks = new Map();
        this.activeChunks = new Set();
    }
    generateChunk(cx, cz){
        const chunk = new Chunk(cx, cz);
        chunk.generateChunk();
        this.chunks.set(`${cx},${cz}`, chunk);
    }
    loadChunk(cx, cz){
        const chunk = this.chunks.get(`${cx},${cz}`);
    }
    unloadChunk(cx, cz){
        this.activeChunks.delete(`${cx},${cz}`);
    }

}
class Chunk{
    constructor(cx, cz){
        this.cx = cx;
        this.cz = cz;
        this.data = new Map();
    }
    generateChunk(){
        for(let iz=0; iz<CELLS_PER_CHUNK; iz++){
            for(let ix=0; ix<CELLS_PER_CHUNK; ix++){
                const wx = (this.cx*CELLS_PER_CHUNK + ix)*Params.CELL;
                const wz = (this.cz*CELLS_PER_CHUNK + iz)*Params.CELL;
                const h = heightSample(wx, wz, Params.SEED);
                this.data.set(`${ix},${iz}`, h);
            }
        }
    }
}
class FloraManager {
    constructor() {
        this.buffer = [];
    }
    checkIfWater(x, z, seed) {
        const h = heightSample(x, z, seed);
        return h.yG < h.yW;
    }
    biomeFloraPicker(biome) {
        const floraOptions = {
            Taiga: ['Pine Tree', 'Fir Tree', 'Berry Bush'],
            Meadow: ['Oak Tree', 'Flower Patch', 'Berry Bush'],
            Beach: ['Palm Tree', 'Cactus', 'Seaweed'],
            Swamp: ['Mangrove Tree', 'Reed Patch', 'Mushroom Cluster'],
        };
        return floraOptions[biome] || [];
    }
    spawnFloraInChunk(chunkX, chunkZ, seed) {
        for (let iz = 0; iz < CELLS_PER_CHUNK; iz++) {
            for (let ix = 0; ix < CELLS_PER_CHUNK; ix++) {
                const wx = (chunkX * CELLS_PER_CHUNK + ix) * Params.CELL;
                const wz = (chunkZ * CELLS_PER_CHUNK + iz) * Params.CELL;
                if (this.checkIfWater(wx, wz, seed)) continue;
                const h = heightSample(wx, wz, seed);
                const dominantBiome = dominant(h.weights);
                const floraOptions = this.biomeFloraPicker(dominantBiome);
                if (floraOptions.length > 0) {
                    const rng = new RNG((wx * 73856093) ^ (wz * 19349663) ^ seed);
                    const spawnChance = 0.1; // 10% chance to spawn flora in a cell
                    if (rng.float() < spawnChance) {
                        const floraType = floraOptions[rng.int(0, floraOptions.length - 1)];
                        this.buffer.push({ type: floraType, x: wx, z: wz });
                    }
                }
            }
        }
    }
    playerInteractWithFlora(playerX, playerZ, interactionRadius) {
        this.buffer = this.buffer.filter(flora => {
            const dx = flora.x - playerX;
            const dz = flora.z - playerZ;
            const distSq = dx * dx + dz * dz;
            if (distSq <= interactionRadius * interactionRadius) {
                console.log(`Player interacted with ${flora.type} at (${flora.x.toFixed(1)}, ${flora.z.toFixed(1)})`);
                return false; // Remove flora after interaction
            }
            return true; // Keep flora if not interacted with
        });
    }
    despawnFloraOutsideRadius(playerX, playerZ, despawnRadius) {
        this.buffer = this.buffer.filter(flora => {
            const dx = flora.x - playerX;
            const dz = flora.z - playerZ;
            const distSq = dx * dx + dz * dz;
            return distSq <= despawnRadius * despawnRadius;
        });
    }
}
class CreatureManager {
    constructor() {
        this.entities = [];
    }
    spawnCreature(type, x, z) {
        const entity = new Creature(type, x, z);
        this.entities.push(entity);
        return entity;
    }
    tickEntities(dt) {
        for (const entity of this.entities) {
            // Update entity logic here (movement, behavior, etc.)
        }
    }
    despawnCreature(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
    }
}
class WorldEntityManager{
    constructor(type, x, z){
        this.type=type;
        this.x=x; this.z=z;
        this.life = 100;
        this.entityState={};
    }
    createTargetedProjectile(abilityName, targetX, targetZ){
        // Logic to create and launch a projectile towards (targetX, targetZ)
    }
    createFreeProjectile(abilityName, directionX, directionZ){
        // Logic to create and launch a projectile in the direction (directionX, directionZ)
    }
    createFreeAreaEffect(abilityName, centerX, centerZ, radius){
        // Logic to create an area effect at (centerX, centerZ) with the specified radius
    }
    createTargetedAreaEffect(abilityName, targetX, targetZ, radius){
        // Logic to create an area effect centered on a target at (targetX, targetZ) with the specified radius
    }
    tick(dt){
        // Update entity logic here (movement, behavior, etc.)
    }
}
class AbilitySet{
    constructor(abilities){
        this.abilities = abilities; // abilities is a dictionary of abilityName -> abilityFunction
    }
    useAbility(abilityName, user, target){
        const abilityFunc = this.abilities[abilityName];
        if(abilityFunc){
            abilityFunc(user, target);
        }
    }
    requestAbilityUse(abilityName, user, target){
        // In a real Roblox environment, this would send a request to the server
        user.FireClient(abilityName, target);
        if(!user.cooldowns.isOnCooldown(abilityName)){
            this.useAbility(abilityName, user, target);
        }
    }
}
class Cooldowns{
    constructor(){
        this.cooldowns = {}; // abilityName -> timeRemaining
    }
    setCooldown(abilityName, duration){
        this.cooldowns[abilityName] = duration;
    }
    tick(dt){
        for(const abilityName in this.cooldowns){
            this.cooldowns[abilityName] -= dt;
            if(this.cooldowns[abilityName] <= 0){
                delete this.cooldowns[abilityName];
            }
        }
    }
    isOnCooldown(abilityName){
        return this.cooldowns.hasOwnProperty(abilityName);
    }
}
class StatsSet{
    constructor(stats){
        this.baseStats = stats; // baseStats is a dictionary of statName -> baseValue
        this.extraStats = {};
        this.finalStats = {};
    }
    recalculateStats(){}
}
class StatusEffects {
  constructor() {
    this.effects = []; // Array of active effects
  }

  addEffect(effect) {
    this.effects.push(effect);
  }

  tick(dt) {
    this.effects = this.effects.filter(effect => {
      effect.duration -= dt;
      if (effect.duration <= 0) {
        if (effect.onExpire) effect.onExpire();
        return false; // Remove expired effect
      }
      if (effect.onTick) effect.onTick(dt);
      return true; // Keep active effect
    });
  }
}
const keys=new Set();
addEventListener('keydown', e=>{ keys.add(e.code); if(["KeyQ","KeyE"].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', e=>{ keys.delete(e.code); });

class WorldEntity {
    constructor(world, x = 0, z = 0) {
        this.id    = NEXT_ID++;
        this.world = world;
        this.x     = x;
        this.z     = z;
        this.vx    = 0;
        this.vz    = 0;
        this.alive = true;
    }
    update(dt /*, world */) {
        this.x += this.vx * dt;
        this.z += this.vz * dt;
    }
    draw(ctx, camera) {
    }
}
class AreaEffect extends WorldEntity {
}

class Projectile extends WorldEntity {
    constructor(world, x, z) {
        super(world, x, z);
        this.lifetime = 1.5; // seconds
        this.radius   = 4;
    }
    update(dt, world) {
        super.update(dt, world);
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.alive = false;
    }
    draw(ctx, camera) {
        const { sx, sz } = camera.worldToScreen(this.x, this.z);
        ctx.fillStyle = "yellow";
        ctx.beginPath();
        ctx.arc(sx, sz, this.radius * camera.zoom * 0.5, 0, Math.PI * 2);
        ctx.fill();
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
   setSpawnField(field) {
        this.spawnField = field;
    }
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
World.prototype.findMeleeTarget = function(attacker, range) {
    const r2 = range * range;
    let best = null;
    let bestD2 = r2;

    for (const e of this.entities) {
        if (e === attacker) continue;
        if (!(e instanceof Entity)) continue;        // only real combatants
        if (e.team === attacker.team) continue;      // skip allies

        const dx = e.x - attacker.x;
        const dz = e.z - attacker.z;
        const d2 = dx*dx + dz*dz;
        if (d2 < bestD2) {
            bestD2 = d2;
            best = e;
        }
    }
    return best;
};
class SpawnField {
    constructor(world, player, options = {}) {
        this.world  = world;
        this.player = player;

        // Configurable
        this.radius          = options.radius || 120;
        this.innerNoSpawn    = options.innerNoSpawn || 40; // avoid spawning on top of player
        this.maxWild         = options.maxWild || 6;
        this.spawnInterval   = options.spawnInterval || 2.5;

        this.timer = 0;
        this.speciesPool = options.speciesPool || [ SpeciesDB.Cat, SpeciesDB.Dog ];
    }

    update(dt) {
        this.timer += dt;

        // try spawn
        if (this.timer >= this.spawnInterval) {
            this.timer = 0;
            this.trySpawn();
        }

        // despawn out of radius
        this.cleanup();
    }

    trySpawn() {
        const currentWild = this.world.entities.filter(e => e instanceof WildEntity).length;
        if (currentWild >= this.maxWild) return;

        // Choose random species
        const species = this.speciesPool[
            Math.floor(Math.random() * this.speciesPool.length)
        ];

        // Get a random spawn point
        const pos = this.randomSpawnPoint();
        if (!pos) return;

        this.world.addEntity(new WildEntity(this.world, species, pos.x, pos.z));
    }

    randomSpawnPoint() {
        const px = this.player.x;
        const pz = this.player.z;

        for (let i = 0; i < 10; i++) { // try up to 10 random samples
            const angle = Math.random() * Math.PI * 2;
            const dist  = this.innerNoSpawn + Math.random() * (this.radius - this.innerNoSpawn);

            const x = px + Math.cos(angle) * dist;
            const z = pz + Math.sin(angle) * dist;

            // clamp inside space
            if (x < 0 || x > this.world.space.width) continue;
            if (z < 0 || z > this.world.space.height) continue;

            return { x, z };
        }

        return null; // couldn't find spot
    }

    cleanup() {
        const px = this.player.x;
        const pz = this.player.z;

        this.world.entities = this.world.entities.filter(e => {
            if (!(e instanceof WildEntity)) return true;

            const dx = e.x - px;
            const dz = e.z - pz;
            const dist = Math.hypot(dx, dz);

            if (dist > this.radius * 1.8) {  // smaller pop in/out by adding buffer
                return false; // despawn
            }

            return true;
        });
    }
}
class Entity extends Collidables {
    constructor(world, species, x, z) {
        super(world, x, z, 8);
        this.species = species;
        this.team = species.team ?? 0;
        this.data = {
            maxHP: species.baseHP,
            hp:    species.baseHP,
            pAtk:  species.basePATK || species.baseATK || 10,
            eAtk:  species.baseEATK || 0,
            spd:   species.baseSPD
        };
        this.compositeKey = species.compositeKey || "organicAnimal";

        this.currentCommand = null;
        this.brain = null;
    }
    applyCommand(cmd) {
        this.currentCommand = cmd;
    }
    update(dt, world) {
        if (this.currentCommand) {
            switch (this.currentCommand.type) {
                case COMMAND.MOVE: {
                    const {dx, dz} = this.currentCommand;
                    const len = Math.hypot(dx, dz) || 1;
                    this.vx = (dx / len) * this.data.spd;
                    this.vz = (dz / len) * this.data.spd;
                    break;
                }
                case COMMAND.STOP:
                    this.vx = 0;
                    this.vz = 0;
                    break;

                case COMMAND.ABILITY:
                    this.handleAbility(world, this.currentCommand);
                    break;
            }
            this.currentCommand = null;
        }
        super.update(dt, world);
    }
    handleAbility(world, cmd) {
        // Map input key → ability id
        let abilityId = cmd.ability;

        if (abilityId === "Q") abilityId = "fang";
        // later: if (abilityId === "E") abilityId = "dash"; etc.

        if (!abilityId) return;

        Abilities.cast(abilityId, {
            world,
            caster: this
        });
    }

    draw(ctx, camera) {
        const { sx, sz } = camera.worldToScreen(this.x, this.z);
        ctx.fillStyle = this.species.color || "#f0f";
        ctx.fillRect(sx - 5, sz - 5, 10, 10);
        if (this.data){
            ctx.fillText(this.data.hp, sx + 10, sz - 30)
            ctx.fillText(this.data.maxHP, sx + 10, sz - 10)
            ctx.fillText(this.data.pAtk, sx + 10, sz + 10)
            ctx.fillText(this.data.spd, sx + 10, sz +30)
        }
    }
}
class RosterEntity extends Entity {
    constructor(world, species, owner, x, z) {
        super(world, species, x, z);
        this.owner = owner;
        this.team  = 1;
        this.brain = BrainService.makePetBrain("aggressive");
    }

    update(dt, world) {
        // interpret any currentCommand from BrainService
        if (this.currentCommand) {
            switch (this.currentCommand.type) {
                case COMMAND.MOVE: {
                    const {dx, dz} = this.currentCommand;
                    const len = Math.hypot(dx, dz) || 1;
                    this.vx = (dx / len) * this.data.spd;
                    this.vz = (dz / len) * this.data.spd;
                    break;
                }
                case COMMAND.STOP:
                    this.vx = 0;
                    this.vz = 0;
                    break;
                case COMMAND.ABILITY:
                    this.handleAbility(world, this.currentCommand);
                    this.currentCommand = null;
                    break;
            }
        }
        super.update(dt, world);
    }
}

class WildEntity extends Entity {
    constructor(world, species, x, z) {
        super(world, species, x, z);
        this.brain = BrainService.makeWildBrain("neutral");
    }

    update(dt, world) {
        if (this.currentCommand) {
            switch (this.currentCommand.type) {
                case COMMAND.MOVE: {
                    const {dx, dz} = this.currentCommand;
                    const len = Math.hypot(dx, dz) || 1;
                    this.vx = (dx / len) * this.data.spd;
                    this.vz = (dz / len) * this.data.spd;
                    break;
                }
                case COMMAND.STOP:
                    this.vx = 0;
                    this.vz = 0;
                    break;
                case COMMAND.ABILITY:
                    this.handleAbility(world, this.currentCommand);
                    this.currentCommand = null;
                    break;
            }
        }
        super.update(dt, world);
    }
}


class BossEntity extends Entity {
    constructor(world, species, x, z) {
        super(world, species, x, z);
        this.phase  = 1;
        this.enrage = false;
        // TODO: scripted patterns
    }
}

const SpeciesDB = {
    Cat: {
        name: "Cat",
        baseHP: 40,
        baseATK: 10,
        baseSPD: 30,
        color: "#f6863a",
        compositeKey: "organicMammal"
    },
    Dog: {
        name:    "Dog",
        baseHP:  55,
        baseATK:  8,
        baseSPD: 24,
        color:   "#3a8df6",
        compositeKey: "organicMammal"
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
        const base = creature.baseStats;
        const L = creature.level;
        const hpMul   = 1 + 0.2 * (L - 1);
        const statMul = 1 + 0.1 * (L - 1);
        creature.stats = {
            maxHP: Math.floor(base.maxHP * hpMul),
            pAtk:  Math.floor(base.pAtk  * statMul),
            eAtk:  Math.floor(base.eAtk  * statMul),
            def:   Math.floor(base.def   * statMul),
            spd:   Math.floor(base.spd   * statMul)
        };
        creature.hp = Math.min(creature.hp, creature.stats.maxHP);
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

const space      = new Space(300, 300);
const world      = new World(space);
const camera     = new Camera();
const abilities  = new AbilityManager(world);
const time       = new TimeManager();

class Entity {
    constructor(x, y) {
        this.pos   = { x, y };
        this.team  = 0;   // 0 = neutral / wild, 1 = player, others = future teams
        this.intents = { vel: { x: 0, y: 0 }, ab1: null };
        this.target  = null;
        this.alive   = true;
        this.inWorld = true;
        this.range  = 50;
        this.maxHP  = 10;
        this.hp     = 10;
        this.atk    = 1;
    }
    applyIntent(world) {
        this.pos.x += this.intents.vel.x;
        this.pos.y += this.intents.vel.y;
        if (this.intents.ab1 && this.target) {
            const dx   = this.target.pos.x - this.pos.x;
            const dy   = this.target.pos.y - this.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.range) {
                this.processAbility(this.intents.ab1, this.target);
            } else {
                console.log("Target out of range!");
            }
            this.intents.ab1 = null;
        }
    }
    processAbility(abilityName, target) {
        if (!target) return;
        const def = abilities[abilityName];
        if (!def) return;
        target.hp -= def.atk;
        console.log(
            `Entity at (${this.pos.x.toFixed(1)}, ${this.pos.y.toFixed(1)}) ` +
            `used ${abilityName} on target at (${target.pos.x.toFixed(1)}, ${target.pos.y.toFixed(1)}). ` +
            `Target HP: ${target.hp}`
        );
    }
    checkAlive() {
        if (this.hp <= 0) {
            this.alive = false;
        }
        return this.alive;
    }
    update(world) {
        if (this.alive) {
            this.applyIntent(world);
            this.checkAlive();
        } else {
            captureListen(world, this); 
        }
    }
    draw(ctx) {
        ctx.fillRect(this.pos.x - HSIZE, this.pos.y - HSIZE, SIZE, SIZE);
    }
}class Bot {
    constructor(entity) {
        this.e = entity;
        this.commandedIntent = { vel: { x: 0, y: 0 }, ab1: null };
        this.outputIntent = { vel: { x: 0, y: 0 }, ab1: null };
        this.bestTarget = null;
    }
    tick(world) {
        if (this.commandedIntent.vel.x === 0 && this.commandedIntent.vel.y === 0) {
            this.e.intents.vel.x = Math.random() - 0.5;
            this.e.intents.vel.y = Math.random() - 0.5;
        } else {
            this.e.intents.vel.x = this.commandedIntent.vel.x;
            this.e.intents.vel.y = this.commandedIntent.vel.y;
        }
        this.findTarget(world);
        this.e.target = this.bestTarget;
        if (this.bestTarget && this.commandedIntent.ab1) {
            const dx   = this.bestTarget.pos.x - this.e.pos.x;
            const dy   = this.bestTarget.pos.y - this.e.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.e.range) {
                this.e.intents.ab1 = "example";
            }
        }
        this.commandedIntent = { vel: { x: 0, y: 0 }, ab1: null };
        this.outputIntent = { vel: { x: 0, y: 0 }, ab1: null };
    }
    findTarget(world) {
        let closestDist = Infinity;
        this.bestTarget = null;
        for (let i = 0; i < world.entities.length; i++) {
            const potentialTarget = world.entities[i];
            if (potentialTarget === this.e) continue;
            if (potentialTarget.team === this.e.team) continue;
            const dx   = potentialTarget.pos.x - this.e.pos.x;
            const dy   = potentialTarget.pos.y - this.e.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
                closestDist   = dist;
                this.bestTarget = potentialTarget;
            }
        }
    }
}class RosterSystem {
    constructor() {
        this.maxSlots = 3;
        this.members  = [];
    }
    canAdd() {
        return this.members.length < this.maxSlots;
    }
    addFromEntity(entity) {
        if (!this.canAdd()) return false;
        this.members.push(entity);
        return true;
    }
}class StorageSystem {
    constructor() {
        this.maxSlots = 50;
        this.members  = [];
    }
    canAdd() {
        return this.members.length < this.maxSlots;
    }
    addFromEntity(entity) {
        if (!this.canAdd()) return false;
        this.members.push(entity);
        return true;
    }
}class Player {
    constructor(x, y) {
        this.pos = { x, y };
        this.inventory = [];
        this.roster = new RosterSystem();
        this.storage   = new StorageSystem();
        this.commands = {
            player: { x: 0, y: 0 },
            entity: { x: 0, y: 0 },
            ab1: null,
        };
        this.activeEntity   = null;
        this.activeEntityBot = null;
    }
    update(commands, world) {
        this.commands.player.x = commands.player.x;
        this.commands.player.y = commands.player.y;
        this.commands.entity.x = commands.entity.x;
        this.commands.entity.y = commands.entity.y;
        this.commands.ab1 = commands.ab1;
        this.sendCommandToPet();
        this.moveSelf();
    }
    sendCommandToPet() {
        if (!this.activeEntityBot) return;
        this.activeEntityBot.commandedIntent.vel.x = this.commands.entity.x;
        this.activeEntityBot.commandedIntent.vel.y = this.commands.entity.y;
        this.activeEntityBot.commandedIntent.ab1   = this.commands.ab1 ? "example" : null;
    }
    moveSelf() {
        this.pos.x += this.commands.player.x;
        this.pos.y += this.commands.player.y;
    }
    draw(ctx) {
        ctx.fillRect(this.pos.x - HSIZE, this.pos.y - HSIZE, SIZE, SIZE);
    }
}
class World {
    constructor() {
        this.player = null;
        this.entities = [];
        this.bots = [];
        this.renderList = [];
        this.debugRenderList = [];
    }
    setPlayer(player) {
        this.player = player;
    }
    addEntity(entity, withBot = false, team = 0) {
        entity.team = team;
        entity.inWorld = true;
        this.entities.push(entity);
        if (withBot) {
            const bot = new Bot(entity);
            this.bots.push(bot);
            return bot;
        }
        return null;
    }
    toggleRosterEntity(slotIndex) {
        if (!this.player) return;
        const roster = this.player.roster;
        const member = roster.members[slotIndex];
        if (!member) return;
        if (!member.inWorld) {
            member.inWorld = true;
            member.team    = 1;
            member.pos.x = this.player.pos.x + 16 * (slotIndex + 1);
            member.pos.y = this.player.pos.y;
            this.entities.push(member);
            const bot = new Bot(member);
            this.bots.push(bot);
            if (!this.player.activeEntity) {
                this.player.activeEntity    = member;
                this.player.activeEntityBot = bot;
            }
        } else {
            member.inWorld = false;
            this.entities = this.entities.filter(e => e !== member);
            for (let i = 0; i < this.bots.length; i++) {
                if (this.bots[i].e === member) {
                    if (this.player.activeEntityBot === this.bots[i]) {
                        this.player.activeEntity    = null;
                        this.player.activeEntityBot = null;
                    }
                    this.bots.splice(i, 1);
                    break;
                }
            }
        }
    }
    update(commands) {
        if (!this.player) return;
        this.player.update(commands, this);
        if (commands.bringSlot !== null) {
            this.toggleRosterEntity(commands.bringSlot);
        }
        for (let i = 0; i < this.bots.length; i++) {
            this.bots[i].tick(this);
        }
        for (let i = 0; i < this.entities.length; i++) {
            this.entities[i].update(this);
        }
        this.entities = this.entities.filter(e => e.alive || e.team === 0);
        this.bots = this.bots.filter(b => b.e.alive);
    }
    render(ctx) {
        if (this.player) {
            this.player.draw(ctx);
        }
        this.renderList = this.entities;
        for (let i = 0; i < this.renderList.length; i++) {
            this.renderList[i].draw(ctx);
        }
    }
    debugUI(ctx) {
        for (let i = 0; i < this.debugRenderList.length; i++) {
            ctx.fillText(this.debugRenderList[i].info, 30, 30 + i * 20);
        }
    }
}
function captureListen(world, entity) {
    if (entity.team !== 0) return;
    const playerPos = world.player.pos;
    const dx   = playerPos.x - entity.pos.x;
    const dy   = playerPos.y - entity.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= 20) return;
    const roster = world.player.roster;
    const storage = world.player.storage;
    const canAddR = roster.canAdd();
    const canAddS = storage.canAdd();
    if (!canAddR && !canAddS) {
        console.log("No space in roster or storage.");
        return;
    }
    if (canAddR) {
        roster.addFromEntity(entity);
        console.log("Captured entity -> roster slot", roster.members.length - 1);
    } else {
        storage.addFromEntity(entity);
        console.log("Captured entity -> storage");
    }
    entity.inWorld = false;
    const idx = world.entities.indexOf(entity);
    if (idx > -1) {
        world.entities.splice(idx, 1);
    }
    for (let i = 0; i < world.bots.length; i++) {
        if (world.bots[i].e === entity) {
            world.bots.splice(i, 1);
            break;
        }
    }
}
