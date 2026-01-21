const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const objects = [];
const v = (x , y , z ) => ({ x, y, z });
const mag = (a) => Math.hypot(a.x, a.y, a.z);
const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mult = (a, s) => v(a.x * s, a.y * s, a.z * s);
const norm = (a) => { const m = mag(a); return m === 0 ? v(0,0,0) : v(a.x / m, a.y / m, a.z / m); };
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const toRadians = (deg) => (deg * Math.PI) / 180;
function rotateVector(vec, rot) {
    const radX = toRadians(rot.x);
    const radY = toRadians(rot.y);
    const radZ = toRadians(rot.z);
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
    const x1 = vec.x;
    const y1 = vec.y * cosX - vec.z * sinX;
    const z1 = vec.y * sinX + vec.z * cosX;
    const x2 = x1 * cosY + z1 * sinY;
    const y2 = y1;
    const z2 = -x1 * sinY + z1 * cosY;
    const x3 = x2 * cosZ - y2 * sinZ;
    const y3 = x2 * sinZ + y2 * cosZ;
    const z3 = z2;
    return v(x3, y3, z3);
}

const predefinedVectors = {
    seed: {properties: {pos:v(0,0,0), rot:v(0,0,0), mag:v(1,0,0)},
        spawnParts: ['stalk','leaf'], maxSpawns: 4, 
        randomTolerances: {rot: v(0,0,0), mag:v(0,0,0)}, isLine: false
    }, //seed
    stalk: {properties: {pos:v(0,0,0), rot:v(0,0,0), mag:v(0,10,0)},
        spawnParts: ['stalk','leaf'], maxSpawns: 3,
        randomTolerances: {rot: v(0,5,5), mag:v(2,0,0)}, isLine: true
    }, //stalk
    root: {properties: {pos:v(0,0,0), rot:v(0,-90,0), mag:v(10,0,0)},
        spawnParts: ['root'], maxSpawns: 2,
        randomTolerances: {rot: v(0,5,5), mag:v(2,0,0)}, isLine: true
    }, //root
    leaf: {properties: {pos:v(0,0,0), rot:v(25,-25,-25), mag:v(15,15,-15)},
        spawnParts: [], maxSpawns: 0,
        randomTolerances: {rot: v(5,5,5), mag:v(2,2,2)}, isLine: false
    },
}

class Flower {
    constructor(position, size) {
        this.position = position;
        this.size = size;
        objects.push(this);
        this.parts = [];
        this.growable = parts;
    }
    createSeed() {
        const seedPart = new Parts(this.position, predefinedVectors['seed']);
        this.growable.push(seedPart);
        this.parts.push(seedPart);
    }
    checkGrowable(){
        this.growable = this.parts.filter(part => part.children.length < partDefinition.maxSpawns);
    }
    tick(){
        for (let part of this.parts) {
        let chance = Math.random() * 100;
            if (part.children.length < partDefinition.maxSpawns) {
                const partDefinition = predefinedVectors[part.type];
                if (partDefinition && chance < 10) {
                    this.produceNewPart(part);
                }
            }
        }
    }
    produceNewPart(parentPart){
        let options = parentPart.requestedNewPart()
        if (options.length === 0) return;
        let randomIndex = Math.floor(Math.random() * options.length);
        let selectedPartType = options[randomIndex];
        const newPart = new Parts(v(0,0,0), predefinedVectors[selectedPartType]);
        newPart.inheritParentTransformations(parentPart);
        newPart.randomProperties(predefinedVectors[selectedPartType].randomTolerances);
        newPart.update();
        parentPart.children.push(newPart);
        newPart.parent = parentPart;
        this.parts.push(newPart);
        this.checkGrowable();
        this.gainMesh();
    }
}
class Parts {
    constructor(pos, partDefinition) {
        this.pos = pos;
        this.rot = partDefinition.properties.rot;
        this.mag = partDefinition.properties.mag;
        this.endp = add(this.pos, this.getDirection());
        this.maxChildren = partDefinition.maxSpawns;
        this.type = partDefinition;
        this.children = [];
        this.parent = null;
        objects.push(this);
    }
    inheritParentTransformations(parentPart) {
        this.pos = parentPart.endp;
        this.rot = v(
            parentPart.rot.x + this.rot.x,
            parentPart.rot.y + this.rot.y,
            parentPart.rot.z + this.rot.z
        );
    }
    randomProperties(tolerances) {
        this.rot = v(
            this.rot.x + (Math.random() - 0.5) * tolerances.rot.x,
            this.rot.y + (Math.random() - 0.5) * tolerances.rot.y,
            this.rot.z + (Math.random() - 0.5) * tolerances.rot.z
        );
        this.mag = v(
            this.mag.x + Math.random() * tolerances.mag.x,
            this.mag.y + Math.random() * tolerances.mag.y,
            this.mag.z + Math.random() * tolerances.mag.z
        );
    }
    connectPart(parentPart, childPart) {
        childPart.pos = parentPart.endp;
        childPart.update();
        parentPart.children.push(childPart);
        childPart.parent = parentPart;
    }
    update() {
        this.endp = add(this.pos, this.getDirection());
    }
    requestedNewPart(){
        return predefinedVectors[this.type].spawnParts;
    }
}
class Vector {
    constructor(pos = v(0,0,0), rot = v(0,0,0), mag = v(1,0,0)) {
        this.pos = pos;
        this.rot = rot;
        this.mag = mag;
        this.endp = add(this.pos, this.getDirection());
        this.children = [];
        this.parent = null;
        objects.push(this);
    }
    getDirection() {
        return rotateVector(this.mag, this.rot);
    }
    update() {
        this.endp = add(this.pos, this.getDirection());
    }
}
function draw(){
    ctx.clearRect(0,0,canvas.width, canvas.height);

}
draw();
