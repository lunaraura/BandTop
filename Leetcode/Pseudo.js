/* =========================================================
   0. BOOTSTRAP
   ========================================================= */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

class Game {
    constructor() {
        this.input = new InputManager();
        this.world = new World();
        this.ui = new UIManager();

        this.lastTime = 0;
        this.isRunning = false;
    }

    initialize() {
        this.input.bind();

        this.world.initialize({
            seed: 12345,
            width: 3000,
            height: 3000
        });

        this.ui.initialize(this.world);
        this.isRunning = true;
    }

    update(dt) {
        this.world.update(dt, this.input);
        this.ui.update(dt, this.world, this.input);
    }

    draw() {
        this.world.draw(ctx);
        this.ui.draw(ctx, this.world);
    }

    loop(ts) {
        if (!this.isRunning) return;

        const dt = this.lastTime
            ? Math.min((ts - this.lastTime) / 1000, 0.05)
            : 0.016;

        this.lastTime = ts;

        this.update(dt);
        this.draw();

        requestAnimationFrame((next) => this.loop(next));
    }

    start() {
        this.initialize();
        requestAnimationFrame((ts) => this.loop(ts));
    }
}
/* =========================================================
   1. HELPERS / SHARED UTILS
   ========================================================= */

function clamp(v, min, max) {}
function lerp(a, b, t) {}
function dist2D(ax, az, bx, bz) {}
function normalize2D(x, z) {}
function deepClone(obj) {}
function randInt(min, max) {}
function randRange(min, max) {}

function makeStats(fill = 0) {
    return {
        pAtk: fill,
        eAtk: fill,
        range: fill,
        maxHP: fill,
        spd: fill,
        castSpd: fill,
        size: fill,
        stamina: fill,
        energy: fill,
        recoverStamina: fill,
        recoverEnergy: fill,
    };
}

function addStats(a, b) {}
function multStats(a, b) {}
/* =========================================================
   2. DEFINITIONS / REGISTRIES
   ========================================================= */

// materials / creature body composites
const composites = {};

// abilities / moves
const abilities = {};

// thermal states
const tempStates = {};

// soak states
const soakEffects = {};

// special rule hooks
const specialEffects = {};

// species / morph definitions
const species = {};

// items / food / tools / bait
const items = {};

// biome definitions and spawn tables
const biomes = {};

// optional world event definitions
const worldEvents = {};
/* =========================================================
   3. PERSISTENT PLAYER / CREATURE DATA
   ========================================================= */

class PlayerProfile {
    constructor() {
        this.id = null;
        this.name = "";

        this.currency = 0;

        this.inventory = new InventoryContainer();
        this.party = new PartyService(6);
        this.storage = new CreatureStorage();

        this.activePartyIndex = 0;

        this.flags = {};
        this.discoveries = {};
    }
}

class InventoryContainer {
    constructor() {
        this.items = new Map(); // itemKey -> qty
    }

    add(itemKey, qty = 1) {}
    remove(itemKey, qty = 1) {}
    has(itemKey, qty = 1) {}
    count(itemKey) {}
    all() {}
}

class PartyService {
    constructor(size = 6) {
        this.slots = new Array(size).fill(null); // owned creature ids
    }

    get(slotIndex) {}
    set(slotIndex, creatureId) {}
    swap(a, b) {}
    getActiveId(activeIndex) {}
    firstOpenSlot() {}
}

class CreatureStorage {
    constructor() {
        this.records = new Map(); // creatureId -> OwnedCreatureData
    }

    add(record) {}
    get(id) {}
    remove(id) {}
    all() {}
    filter(fn) {}
}

class OwnedCreatureData {
    constructor() {
        this.id = null;
        this.ownerId = null;

        this.speciesKey = null;
        this.nickname = "";

        this.level = 1;
        this.xp = 0;

        this.baseStats = makeStats(0);
        this.inherentStats = makeStats(0);
        this.learnedStats = makeStats(0);
        this.modifiedStats = makeStats(0);

        this.moveset = [];
        this.unlockedMoves = [];

        this.composites = {
            inner: null,
            outer: null
        };

        this.morphStage = 0;
        this.morphPath = null;
        this.morphPoints = {};

        this.bond = 0;
        this.loyalty = 0;
        this.temperament = "neutral";

        this.tags = [];
    }
}
/* =========================================================
   4. PLAYER IN THE WORLD
   ========================================================= */

class PlayerEntity {
    constructor(profile, x, z) {
        this.profile = profile;

        this.pos = { x, z };
        this.vel = { x: 0, z: 0 };
        this.angle = 0;

        this.spd = 140;
        this.interactRange = 40;

        this.controlMode = "player"; // player, pet_manual, pet_command, menu
        this.intent = this.makeEmptyIntent();

        this.summonedCreatureId = null;
        this.manualControlCreatureId = null;

        this.alive = true;
    }

    makeEmptyIntent() {
        return {
            move: { x: 0, z: 0 },
            interact: false,
            summonToggle: false,
            recall: false,
            useItem: null,
            partyNext: false,
            partyPrev: false,
            manualControl: false,
            targetPos: null
        };
    }

    readInput(inputManager) {}
    update(dt, world) {}
    applyMovement(dt, world) {}
    handleInteraction(world) {}
    handlePartyControl(world) {}
    handlePetControl(world) {}
}

/* =========================================================
   5. WORLD / TERRAIN / BIOME
   ========================================================= */

class Space {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    clamp(x, z) {}
    randomPoint() {}
}

class ChunkManager {
    constructor(world) {
        this.world = world;
        this.seed = 0;
        this.loadedChunks = new Map();
    }

    initialize(seed) {}
    ensureChunksAround(x, z) {}
    unloadFarChunks(playerPos) {}
    generateChunk(cx, cz) {}

    getTerrainAt(x, z) {}
    setTerrainAt(x, z, blockType) {}

    spawnChunkResources(cx, cz) {}
    spawnChunkInteractables(cx, cz) {}
}

class BiomeService {
    constructor(world) {
        this.world = world;
    }

    getBiomeAt(x, z) {}
    getCreatureSpawnTable(biomeKey) {}
    getInteractableSpawnTable(biomeKey) {}
    getMorphPointRules(biomeKey) {}
}
/* =========================================================
   6. WORLD ENTITIES / NODES / ENCOUNTERS
   ========================================================= */

class WorldEntity {
    constructor(x, z) {
        this.pos = { x, z };
        this.alive = true;
    }

    update(dt, world) {}
    draw(ctx, camera) {}
}

class InteractableNode extends WorldEntity {
    constructor(x, z, nodeType) {
        super(x, z);
        this.nodeType = nodeType;
        this.state = "ready";
        this.cooldown = 0;
    }

    canInteract(actor) {}
    interact(actor, world) {}
}

class BerryBush extends InteractableNode {}
class Shrub extends InteractableNode {}
class OreNode extends InteractableNode {}
class Barrier extends InteractableNode {}

class Encounter {
    constructor(creature, sourceType) {
        this.creature = creature;
        this.sourceType = sourceType; // wild, biome, event, lure
        this.state = "idle";          // idle, engaged, fled, captured, defeated
        this.visible = true;
    }

    canStart(playerEntity) {}
    start(playerEntity, world) {}
    resolve(result, world) {}
}
/* =========================================================
   7. CREATURE RUNTIME
   ========================================================= */

class CreatureRuntime {
    constructor(x, z, speciesKey, team = 0) {
        this.id = null;

        this.pos = { x, z };
        this.vel = { x: 0, z: 0 };
        this.angle = 0;

        this.speciesKey = speciesKey;
        this.team = team;
        this.isDead = false;

        this.baseStats = makeStats(0);
        this.modifiedStats = makeStats(0);

        this.currentHP = 0;
        this.currentStamina = 0;
        this.currentEnergy = 0;

        this.composites = { inner: null, outer: null };

        this.moveset = [];
        this.cooldowns = {};

        this.abilityManager = null;
        this.effectManager = null;

        this.soaks = {
            water: 0,
            electric: 0,
            chemical: 0,
            temp: 0
        };

        this.soakCap = {
            water: 0,
            electric: 0,
            chemical: 0
        };

        this.soakBaseline = {
            water: 0,
            electric: 0,
            chemical: 0,
            temp: 0
        };

        this.tempCapHot = 0;
        this.tempCapCold = 0;
        this.tempRatio = 0;

        this.intent = null;
        this.brain = null;

        this.ownerId = null;
        this.runtimeMode = "wild"; // wild, pet, summoned, hostile

        this.morphStage = 0;
        this.morphPath = null;
        this.morphPoints = {};
    }

    tick(dt, world) {}
    applyRecovery(dt) {}
    applyMovement(dt, world) {}
    updateFacing() {}
    draw(ctx, camera) {}
}

/* =========================================================
   8. CREATURE CREATION / SYNC
   ========================================================= */

class CreatureFactory {
    constructor() {}

    createWild(speciesKey, spawnPos, biomeKey) {}
    createFromOwnedData(record, spawnPos, team = 0) {}
    writeBackToOwned(runtimeCreature, ownedRecord) {}

    rollEntityStats(speciesKey, compositeKeys) {}
    rollStarterMoves(speciesKey) {}
    generateVariation(maxVariation) {}
    scaleStats(statBoost, multiplier) {}

    initSoakCaps(size, compKeys) {}
    initTempCaps(size, compKeys) {}
    initSoakBaselines(compKeys) {}
    calcTempRatio(creature) {}
}

/* =========================================================
   9. PROGRESSION / MORPH / MATERIAL HELPERS
   ========================================================= */

const LevelService = {
    ensure(creatureOrRecord) {},
    xpNeeded(level) {},
    addXP(creatureOrRecord, amount) {},
    recomputeStats(creatureOrRecord) {}
};

const MorphService = {
    canMorph(creatureOrRecord, morphKey) {},
    applyMorph(creatureOrRecord, morphKey) {},
    grantMorphPoints(creatureOrRecord, materialKey, amount) {}
};

function recomputeModifiedStats(creatureOrRecord) {}

function getCompositeList(creature) {}
function getCompositeThresholds(creature) {}
function getTempState(creature) {}

function applyDamage(target, amount, damageType, ability) {}
function applySoak(target, soakType, amount) {}
function decaySoaks(creature, dt) {}
function applyCompositeSpecialEffects(creature, dt) {}

/* =========================================================
   10. COMBAT / ABILITIES / EFFECTS
   ========================================================= */

class AbilityManager {
    constructor(creature) {
        this.host = creature;
        this.cooldowns = {};
        this.slots = [null, null, null, null];
    }

    initFromMoveset(movesetKeys) {}
    tick(dt) {}
    canUse(key) {}
    use(key, world, aimAt, targetId = null) {}
    execute(key, world, aimAt, targetId = null) {}
    entitiesInRadius(world, center, radius) {}
}

class EffectManager {
    constructor(creature) {
        this.host = creature;
        this.activeEffects = [];
    }

    add(effectKey, source = null) {}
    remove(effectKey) {}
    tick(dt, world) {}
}

class CombatService {
    constructor(world) {
        this.world = world;
    }

    resolveAbilityUse(source, abilityKey, targetOrPoint) {}
    resolveMeleeHit(source, target, ability) {}
    resolveProjectileHit(projectile, target) {}
    resolveAreaEffect(areaEffect, targets) {}
}
/* =========================================================
   11. PROJECTILES / AOE / ADJACENT COMBAT ENTITIES
   ========================================================= */

class Projectile extends WorldEntity {
    constructor(x, z, ownerId, team, payload) {
        super(x, z);
        this.ownerId = ownerId;
        this.team = team;
        this.payload = payload;

        this.vel = { x: 0, z: 0 };
        this.life = 0.75;
        this.radius = 5;
    }

    update(dt, world) {}
    onHit(target, world) {}
}

class HomingProjectile extends Projectile {
    constructor(x, z, ownerId, team, payload) {
        super(x, z, ownerId, team, payload);
        this.targetId = null;
        this.turnRate = 3;
    }

    update(dt, world) {}
}

class AreaEffect extends WorldEntity {
    constructor(x, z, payload) {
        super(x, z);
        this.payload = payload;
        this.radius = 30;
        this.life = 1.0;
    }

    update(dt, world) {}
}

/* =========================================================
   12. AI / BRAINS
   ========================================================= */

class Brain {
    constructor() {
        this.host = null;

        this.type = "wild";
        this.mode = "auto";
        this.nature = "passive";

        this.aggroRange = 60;
        this.followDistance = 0;
        this.leashDistance = 0;
        this.wanderEnable = false;

        this.targetFocus = null;
        this.intentRequest = this.makeEmptyIntent();

        this.observedCreatures = [];
        this.enemyCreatures = [];
        this.observedProjectiles = [];
        this.enemyProjectiles = [];
    }

    makeEmptyIntent() {
        return {
            move: { x: 0, z: 0 },
            ability: null,
            targetId: null,
            aimAt: null,
            dodge: false
        };
    }

    attachTo(creature) {}
    think(world, dt) {}

    scanEntities(world) {}
    decideTarget() {}
    decideAction() {}
    decideMovement() {}
    decideAbility(dt) {}
    writeIntoHost() {}
}

class PlayerControlledBrain extends Brain {
    constructor(playerEntity) {
        super();
        this.playerEntity = playerEntity;
    }

    think(world, dt) {
        // convert player input into creature intent
    }
}

/* =========================================================
   13. WORLD SERVICES
   ========================================================= */

class SpawnField {
    constructor(world, player, options = {}) {
        this.world = world;
        this.player = player;

        this.radius = options.radius ?? 160;
        this.innerNoSpawn = options.innerNoSpawn ?? 40;
        this.maxWild = options.maxWild ?? 8;
        this.spawnInterval = options.spawnInterval ?? 2;
        this.timer = 0;
    }

    update(dt) {}
    trySpawnWild() {}
    randomSpawnPoint() {}
    cleanupFarCreatures() {}
}

class SpawnService {
    constructor(world, creatureFactory) {
        this.world = world;
        this.creatureFactory = creatureFactory;
    }

    spawnWild(speciesKey, pos, biomeKey) {}
    despawnCreature(creatureId) {}
    findValidSpawnPointNear(pos, radius) {}
}

class SummonService {
    constructor(world, creatureFactory) {
        this.world = world;
        this.creatureFactory = creatureFactory;
    }

    summonActiveCreature(playerEntity) {}
    recallCreature(playerEntity) {}
    findSummonPointNearPlayer(playerEntity) {}
}

class InteractionService {
    constructor(world) {
        this.world = world;
    }

    findInteractTarget(actor) {}
    validateInteraction(actor, target, itemKey = null) {}
    applyInteraction(actor, target, itemKey = null) {}
}

class EncounterService {
    constructor(world) {
        this.world = world;
    }

    buildEncounterForCreature(creature, sourceType = "wild") {}
    tryStartEncounter(playerEntity, targetCreature) {}
    resolveEncounter(encounter, result) {}
}

class AttractionService {
    constructor(world) {
        this.world = world;
    }

    getAttractionScore(playerEntity, biomeKey, speciesKey) {}
    getSpawnWeightModifier(playerEntity, biomeKey, speciesKey) {}
}

class MorphPointService {
    constructor(world) {
        this.world = world;
    }

    grantFromBattle(creatureOrRecord, result) {}
    grantFromBiomeExposure(creatureOrRecord, biomeKey, dt) {}
    grantFromInteraction(creatureOrRecord, nodeType, result) {}
}

class ItemService {
    constructor(world) {
        this.world = world;
    }

    canUseItem(playerEntity, itemKey, target = null) {}
    useItem(playerEntity, itemKey, target = null) {}
}
/* =========================================================
   14. WORLD CONTAINER
   ========================================================= */

class World {
    constructor() {
        this.space = null;
        this.chunkManager = null;
        this.biomeService = null;

        this.creatureFactory = null;
        this.spawnService = null;
        this.summonService = null;
        this.interactionService = null;
        this.encounterService = null;
        this.attractionService = null;
        this.morphPointService = null;
        this.itemService = null;
        this.combatService = null;

        this.player = null;
        this.camera = null;

        this.creatures = [];
        this.projectiles = [];
        this.areaEffects = [];
        this.interactables = [];
        this.spawnFields = [];

        this.pendingAdds = [];
        this.pendingRemoves = [];

        this.time = 0;
        this.activeEvent = null;
    }

    initialize(config) {
        // create world bounds
        // create chunk manager and generate starting area
        // create services
        // create player profile and player entity
        // create camera and follow player
        // create spawnfield(s)
    }

    update(dt, inputManager) {
        // 1. advance world time
        // 2. read player input
        // 3. update player
        // 4. update chunk loading around player
        // 5. update spawn fields
        // 6. run brains for creatures
        // 7. tick creatures
        // 8. tick projectiles and area effects
        // 9. tick interactables
        // 10. apply cleanup
        // 11. update camera
    }

    draw(ctx) {
        // background / terrain
        // interactables
        // creatures
        // projectiles
        // area effects
        // player
        // overlays
    }

    addCreature(creature) {}
    addProjectile(projectile) {}
    addAreaEffect(areaEffect) {}
    addInteractable(entity) {}

    queryCreaturesInRadius(x, z, radius) {}
    queryInteractablesInRadius(x, z, radius) {}
    cleanup() {}
}
/* =========================================================
   15. CAMERA / INPUT
   ========================================================= */

class Camera {
    constructor() {
        this.x = 0;
        this.z = 0;
        this.zoom = 1;
        this.target = null;
    }

    follow(entity) {}
    update(dt) {}
    worldToScreen(x, z) {}
    screenToWorld(sx, sz) {}
}

class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = {};
    }

    bind() {}
    isDown(code) {}
    consumePress(code) {}
}

/* =========================================================
   16. UI / MENUS
   ========================================================= */

class UIManager {
    constructor() {
        this.hud = null;
        this.creatureMenu = null;
        this.inventoryMenu = null;
    }

    initialize(world) {
        this.hud = new HUD(world);
        this.creatureMenu = new CreatureMenuUI(world.player.profile);
        this.inventoryMenu = new InventoryUI(world.player.profile);
    }

    update(dt, world, inputManager) {}
    draw(ctx, world) {}
}

class HUD {
    constructor(world) {
        this.world = world;
    }

    draw(ctx) {}
}

class CreatureMenuUI {
    constructor(playerProfile) {
        this.playerProfile = playerProfile;
        this.visible = false;
        this.selectedCreatureId = null;
    }

    open() {}
    close() {}
    draw(ctx) {}

    showParty() {}
    showStorage() {}
    inspectCreature(recordId) {}
    moveCreatureToParty(recordId, slot) {}
    moveCreatureToStorage(recordId) {}
    renameCreature(recordId, newName) {}
}

class InventoryUI {
    constructor(playerProfile) {
        this.playerProfile = playerProfile;
        this.visible = false;
    }

    open() {}
    close() {}
    draw(ctx) {}
}
