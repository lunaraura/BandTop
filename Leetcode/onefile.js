//pretend all the js is .lua

//core
//EventBus
class EventBus{
    constructor(){
        this.m = new Map();
    }
    on(t, fn){
        const arr = (this.m.get(t) || this.m.set(t,[]).get(t));
        arr.push(fn)
        this.off(t,fn);
    }
    off(t, fn){
        const a = this.m.get(t);
        if (!a) return;
        const i = a.indexOf(fn);
        if (i >= 0) a.splice(i,1);
    }
    emit(t, payload){
        const a = this.m.get(t);
        if (!a) return;
        for (const fn of [...a]) fn(payload)
    }
}
//RNG
class RNG{
    constructor(seed=1234){
        this.s = seed >>> 0;
    }
    next(){
        this.s = (this.s*1664525 +1013904223)>>>0;
        return (this.s&0xffff)/0x10000;
    }
    int(a,b){
        return a + Math.floor(this.next()*(b-a+1));
    }
    num(a,b){
        return a + this.next()*(b-a)
    }
}
//Types
//TickLoop
// <!-- replicatedstorage -->
// "floraDictionary.js"
const cosmeticFlora = {
    oak_tree : {name: "oak_tree"},
    willow_tree : {name: "willow_tree"},
    pine_tree : {name: "pine_tree"},
    mangrove_tree : {name: "mangrove_tree"},
    shrub : {name: "shrub"},
}
const interactiveFlora = {
    blue_berry_shrub : {name: "blue_berry_shrub"},
    yellow_berry_shrub : {name: "yellow_berry_shrub"},
    red_berry_shrub : {name: "red_berry_shrub"},
}
// "biomeDictionary.js"
// 
const biomes = {
    "forest": {
        name: "forest",
        groundType: "grass",
        lowGroundType: "dirt",
        highGroundType: "stone",
        floraTypes: [{name:"oak_tree", rate: 0.2, specialCondition: []},
            {name:"pine_tree", rate: 0.1, specialCondition: []}, 
            {name:"shrub", rate: 0.2, specialCondition: []},
            {name:"blue_berry_shrub", rate: 0.05, specialCondition: []}
        ],
        amplitude: 1.0,
        frequency: 1.0,
        lakeFrequency: 0.1,
        waterYOffset: -2,
    },
    "desert": {
        name: "desert",
        groundType: "sand",
        lowGroundType: "sandstone",
        highGroundType: "stone",
        floraTypes: [{name:"shrub", rate: 0.1, specialCondition: []}],
        amplitude: 0.5,
        frequency: 0.5,
        lakeFrequency: 0.05,
        waterYOffset: -1,
    }

}

// "ItemDictionary.js"
// "ToolDictionary.js"
// "EntityFamilyDictionary.js"
// "EntityCompositeDictionary.js"

// scripts to create models instead of workspace models
// "floraModelCreate.js"
// "EntityModelCreate.js"
// "ItemSprites.js"

// <!-- serversScriptStorage/gen? or modules-->
function noise(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
}
function fbm(x, y, octaves, persistence, lacunarity) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;  // Used for normalizing result to 0.0 - 1.0
    for (let i = 0; i < octaves; i++) {
        total += noise(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}
// "FloraGen.js"
function poisson2D(pts, min2, x, z){
    for (const pt of pts){
        const dx = pt.x - x;
        const dz = pt.z - z;
        if (dx*dx + dz*dz < min2){
            return false;
        }
    }
    return true;    
}
class FloraGen {
    constructor(rng){
        this.rng = rng;
        this.floraBuffer = []
    }
    flagAsPotentialFloraSpot(x, z) {
        const scale = 0.03;
        const n = fbm(x * scale, z * scale, 4, 0.5, 2);
        return n > 0.6;
    }
    runFloraGenAtChunk(cx, cz, chunkSize, biomeGen){
        const floraPositions = [];
        for(let x=0; x<chunkSize; x++){
            for(let z=0; z<chunkSize; z++){
                const worldX = cx*chunkSize + x;
                const worldZ = cz*chunkSize + z;
                const biome = biomeGen.biomeMix(worldX, worldZ);
                if(this.flagAsPotentialFloraSpot(worldX, worldZ)){
                    floraPositions.push({x:worldX, z:worldZ, biome:biome});
                }
            }
        }
        this.floraBuffer = floraPositions;
    }
    generateFloraAt(x, z, biome) {
        const floraTypes = biome.floraTypes;
        const totalRate = floraTypes.reduce((sum, flora) => sum + flora.rate, 0);
        const rand = this.rng.num(0, totalRate);

        let cumulativeRate = 0;
        for (const flora of floraTypes) {
            cumulativeRate += flora.rate;
            if (rand <= cumulativeRate) {
                return flora;
            }
        }
        return null; // Fallback in case no flora is selected
    }
}
// "BiomeGen.js"
class BiomeGen {
    constructor() {
        this.biomeList = Object.values(biomes); // Convert biomes to an array
        this.totalBiomes = this.biomeList.length;
        this.waterYOffset = 0;
    }
    biomeMix(x, z) {
        const scale = 0.01;
        const n = fbm(x * scale, z * scale, 4, 0.5, 2);
        const biomeIndex = Math.floor(n * this.totalBiomes) % this.totalBiomes;

        return this.biomeList[biomeIndex]; // Access biome from the array
    }
    isWater(x, z) {
        return this. lakeOverride(x, z) || this.riverOverride(x, z);
    }
    lakeOverride(x, z) {
        const scale = 0.05;
        const n = fbm(x * scale, z * scale, 4, 0.5, 2);
        return n < 0.3;
    }
    riverOverride(x, z) {
        const scale = 0.02;
        const n = fbm(x * scale, z * scale, 4, 0.5, 2);
        return n > 0.45 && n < 0.55;
    }
}
// "WorldGen.js"

class WorldGenerate {
    constructor(seed){
        this.rng = new RNG(seed);
        this.biomeGen = new BiomeGen();
        this.floraGen = new FloraGen(this.rng);
    }
    flagAsWater(x, z) {
        return this.biomeGen.lakeOverride(x, z) || this.biomeGen.riverOverride(x, z);
    }
    flagAsPotentialFlora(x, z){
        const scale = 0.03;
        const n = fbm(x*scale, z*scale, 4, 0.5, 2);
        return n > 0.6;
    }
    generateChunkData(chunkX, chunkZ, chunkSize) {
        const chunkData = {
            heightmap: [],
            floraPositions: []
        };
        for (let x = 0; x < chunkSize; x++) {
            chunkData.heightmap[x] = [];
            for (let z = 0; z < chunkSize; z++) {
                const worldX = chunkX * chunkSize + x;
                const worldZ = chunkZ * chunkSize + z;

                // Generate biome data
                const biome = this.biomeGen.biomeMix(worldX, worldZ);

                // Generate heightmap data
                const scale = biome.frequency;
                const amplitude = biome.amplitude;
                const waterYOffset = biome.waterYOffset || 0;
                const n = fbm(worldX * scale, worldZ * scale, 6, 0.5, 2);
                const height = Math.floor(n * amplitude * 20) + waterYOffset;
                chunkData.heightmap[x][z] = height;

                // Generate flora data
                if (!this.biomeGen.isWater(worldX, worldZ) && this.floraGen.flagAsPotentialFloraSpot(worldX, worldZ)) {
                    const flora = this.floraGen.generateFloraAt(worldX, worldZ, biome);
                    chunkData.floraPositions.push({ x: worldX, z: worldZ, biome, flora });
                }
            }
        }

        return chunkData;
    }
    smoothGrid(grid, chunkSize) {
        const kernel = [
            [1, 1, 1],
            [1, 8, 1],
            [1, 1, 1]
        ];
        const kernelSum = kernel.flat().reduce((a, b) => a + b, 0);

        const smoothed = [];
        for (let x = 0; x < chunkSize; x++) {
            smoothed[x] = [];
            for (let z = 0; z < chunkSize; z++) {
                let sum = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const nx = x + dx;
                        const nz = z + dz;
                        if (nx >= 0 && nx < chunkSize && nz >= 0 && nz < chunkSize) {
                            sum += grid[nx][nz] * kernel[dx + 1][dz + 1];
                        }
                    }
                }
                smoothed[x][z] = Math.floor(sum / kernelSum);
            }
        }
        return smoothed;
    }
}
// <!-- replicatedstorage/entities -->
class AbilitySet{
    constructor(){
        this.abilities = new Map();
    }
    addAbility(name, ability){
        this.abilities.set(name, ability);
    }
    getAbility(name){
        return this.abilities.get(name);
    }
}
class StatsSet{
    constructor(){
        this.familyStats = new Map();
        this.individualStats = new Map();
        this.baseStats = new Map();
        this.effectsStats = new Map();
        this.finalStats = new Map();
    }
    setBaseStat(family, rng){
        // Example: set base stats based on family and rng
    }
}
// "EntityGen.js"
class Entity {
    constructor(pos, family){
        this.pos = pos;
        this.desiredPos = {x:0,y:0,z:0}
        this.eid = Math.random()
        this.family = family;
        this.abilities = new AbilitySet();
        this.cooldowns = new Cooldowns();
        this.stats = new StatsSet();
        this.brain = new Bot(this);
        this.playerControlled = false;
        this.playerCommands = {};

    }
    initialize(){
        if (!this.family){
            console.warn("Entity created without family:", this);
        }

    }
}
// "EntityBrain.js"
class Bot{
    constructor(e){
        this.e = e;
    }
}
// <!-- serversScriptStorage/gameloop-->
// "PlayerListener.js"
// "InventoryService.js"
class Inventory{
    constructor(bus){
        this.bus = bus;
        this.byPlayer = new Map();
    }
    inv(pid){
        return this.byPlayer.get(pid) || (this.byPlayer.set(pid, {red:0,yellow:0,blue:0}), this.byPlayer.get(pid))
    }
    add(pid, kind){
        const inv = this.inv(pid);
        inv[kind] = (inv[kind] || 0) + 1;
        this.bus.emit("inventoryChanged", {pid:pid, inventory:inv});
    }
    use(pid, kind){
        const inv = this.inv(pid);
        if ((inv[kind] || 0) > 0){
            inv[kind] = inv[kind] - 1;
            this.bus.emit("inventoryChanged", {pid:pid, inventory:inv});
            return true;
        }
    }
}
// "CreatureRoster.js"
class RosterService{
    constructor(bus){
        this.bus = bus;
        this.map = new Map();
    }
    get(pid){
        return this.map.get(pid) || {list:{}, active:null};
    }
    setActive(pid, id){
        const r = this.get(pid);
        if(r.list[id]){
            r.active = id;
            this.bus.emit('roster:changed', {pid, roster:r});
        }
    }
}
class PlayerCreatureStorage{
    constructor(){
        this.storage = new Map();
    }
    store(pid, creature){
        this.storage.set(pid, creature);
    }
    retrieve(pid){
        return this.storage.get(pid);
    }
}
// "ItemService.js"
class ItemService{

}
// "EntityBrainService.js"
// <!-- flora: useful flora's interactions with entities -->
// "FloraService.js"
// <!-- chunk: generate, load, unload -->
// "ChunkService.js"
class ChunkService{
    constructor(gen, chunkSize){
        this.gen = gen;
        this.size = chunkSize;
        this.loaded = new Map();
    }
    key(cx, cz){
        return `${cx},${cz}`
    }
    ensure(cx, cz){
        const k = this.key(cx, cz);
        if(this.loaded.has(k)) return this.loaded.get(k);
        const data = this.gen.generateChunkData(cx, cz, this.size);
        this.loaded.set(k, data);
        return data; 
    }
    unloadFar(cx, cz, radius,cb){
        for(const k of this.loaded.keys()){
            const [ocx, ocz] = k.split(',').map(Number);
            if (Math.abs(ocx - cx) > radius || Math.abs(ocz - cz) > radius){
                const data = this.loaded.get(k);
                cb(data, ocx, ocz);
                this.loaded.delete(k);
            }
        }
    }
}
// <!-- Apply entity's logic -->
// "EntityService.js"
class Cooldowns {
    constructor(){
        this.map = new Map();
    }
    set(key, sec){
        this.map.set(key, performance.now()+sec+1000);
    }
    left(key){
        return Math.max(0, (this.map.get(key)||0)-performance.now())
    }
}
// <!-- Apply entity's requests for abilities, etc -->
// "BattleService.js"
// <!-- starterplaerscripts -->
// "StarterUI.js"
// "OptionsUI.js"
// "CurrentCreatureUI.js"
// "Controller.js"

//javascript only debug
class Player{
    constructor(x,y,z){
        this.x = x;
        this.y = y;
        this.z = z;
    }
}
class Canvas {
    constructor(biomeGen) {
        this.objects = [];
        this.UI = [];
        this.biomeGen = biomeGen; // Store BiomeGen instance
    }

    renderWorld() {
        for (const object of this.objects) {
            if (object.type === "water") {
                const biome = this.biomeGen.biomeMix(object.x, object.z);
                const waterYOffset = biome.waterYOffset || 0;
                drawWater(object.x, object.z, waterYOffset); // Adjust water rendering by Y offset
            } else if (object.type === "flora") {
                drawObject(object);
            }
        }
        this.objects = []
    }

    renderUI() {
        // Render UI elements
    }
}
class World {
    constructor(seed) {
        this.generator = new WorldGenerate(seed);
        this.chunks = new Map();
    }

    generateAroundPlayer(px, pz, radius, chunkSize, canvas) {
        const chunkX = Math.floor(px / chunkSize);
        const chunkZ = Math.floor(pz / chunkSize);

        // Generate new chunks
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const cx = chunkX + dx;
                const cz = chunkZ + dz;
                const chunkKey = `${cx},${cz}`;
                if (!this.chunks.has(chunkKey)) {
                    const chunkData = this.generator.generateChunkData(cx, cz, chunkSize);
                    this.chunks.set(chunkKey, chunkData);

                    // Add objects to the canvas
                    for (const flora of chunkData.floraPositions) {
                        canvas.objects.push({
                            type: "flora",
                            x: flora.x,
                            z: flora.z,
                            biome: flora.biome,
                            flora: flora.flora
                        });
                    }

                    for (let x = 0; x < chunkData.heightmap.length; x++) {
                        for (let z = 0; z < chunkData.heightmap[x].length; z++) {
                            const wx = cx*chunkSize + x;
                            const wz = cz*chunkSize + z;
                            if (this.generator.flagAsWater(wx, wz)) {
                                canvas.objects.push({
                                    type: "water",
                                    x: cx * chunkSize + x,
                                    z: cz * chunkSize + z
                                });
                            }
                        }
                    }
                }
            }
        }

        // Unload distant chunks
        for (const key of this.chunks.keys()) {
            const [cx, cz] = key.split(',').map(Number);
            if (Math.abs(cx - chunkX) > radius || Math.abs(cz - chunkZ) > radius) {
                this.chunks.delete(key);
            }
        }
    }
}
function createFloraModel(flora){
    // Placeholder function to create flora model
    return {type: "flora", name: flora.name};
}
function placeModelAt(model, x, y, z){
    // Placeholder function to place model at given coordinates
    console.log(`Placing ${model.name} at (${x}, ${y}, ${z})`);
}
function getHeightAt(x, z){
    // Placeholder function to get height at given coordinates
    return 0;
}
//use squares
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

const tileSize = 1;
function drawWater(x, z, yOffset) {
    ctx.fillStyle = "blue"
    ctx.fillRect(x * tileSize, (z - yOffset) * tileSize, tileSize, tileSize);
}
function drawObject(object) {
    ctx.fillStyle = "green"
    ctx.fillRect(object.x * tileSize, object.z * tileSize, tileSize, tileSize);
}
function drawBiomeOverlay(world) {
    for (const [key, chunk] of world.chunks) {
        for (let x = 0; x < chunk.heightmap.length; x++) {
            for (let z = 0; z < chunk.heightmap[x].length; z++) {
                const biome = world.generator.biomeGen.biomeMix(x, z);
                ctx.fillStyle = biome.name === "Forest" ? "green" : "yellow";
                ctx.fillRect(x * tileSize, z * tileSize, tileSize, tileSize);
            }
        }
    }
}
function drawDebugOverlay(world) {
    for (const [key, chunk] of world.chunks) {
        for (const flora of chunk.floraPositions) {
            ctx.strokeStyle = "red";
            ctx.strokeRect(flora.x * tileSize, flora.z * tileSize, tileSize, tileSize);
        }
    }
}
let world = new World(1234);
let canvasRender = new Canvas(world.generator.biomeGen);
let player = new Player(canvas.width/2,canvas.height/2,canvas.width/2);
world.generateAroundPlayer(player.x, player.z, 2, 16, canvasRender);
for(const [key, chunk] of world.chunks){
    const [cx, cz] = key.split(',').map(Number);
}
function gameLoop() {
    // Update world
    world.generateAroundPlayer(player.x, player.z, 2, 16, canvasRender);

    // Render world
    canvasRender.renderWorld();

    // Render UI
    canvasRender.renderUI();

    // requestAnimationFrame(gameLoop); // Keep the loop running
}
gameLoop(); // Start the game loop
