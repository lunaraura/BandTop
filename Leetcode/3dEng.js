const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")
let blockList = []



const v = (x, y, z) => {return {x:x, y:y, z:z}};
const line = (v1, v2) => {return {start: v1, end: v2}};
const dot = (v1, v2) => {return v1.x*v2.x + v1.y*v2.y + v1.z*v2.z};
const cross = (v1, v2) => {return {
        x: v1.y*v2.z - v1.z*v2.y,
        y: v1.z*v2.x - v1.x*v2.z,
        z: v1.x*v2.y - v1.y*v2.x
    }
};
function multiplyMatrices(matrix1, matrix2) {
    let result = [];
    if (matrix1[0].length !== matrix2.length) {
        console.error("Matrix dimensions mismatch");
        return result;
    }
    for (let i = 0; i < matrix1.length; i++) {
        result[i] = [];
        for (let j = 0; j < matrix2[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < matrix1[0].length; k++) {
                sum += matrix1[i][k] * matrix2[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}
let zrotMat = [
    [Math.cos(this.anglex), -Math.sin(this.anglex), 0, 0],
    [Math.sin(this.anglex), Math.cos(this.anglex), 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
];
let yrotMat = [
    [Math.cos(this.angley), 0, Math.sin(this.angley), 0],
    [0, 1, 0, 0],
    [-Math.sin(this.angley), 0, Math.cos(this.angley), 0],
    [0, 0, 0, 1]
];
let xrotMat = [
    [1, 0, 0, 0],
    [0, Math.cos(this.anglez), -Math.sin(this.anglez), 0],
    [0, Math.sin(this.anglez), Math.cos(this.anglez), 0],
    [0, 0, 0, 1]
];
const matPresets = {
    zyx: multiplyMatrices(multiplyMatrices(zrotMat, yrotMat), xrotMat),
}
class Rigid {
    constructor(pos, scale, pivotOffset){
        this.translate = pos;
        this.scale = scale;
        this.rotate = v(0,0,0);
        this.pivot = pivotOffset
        this.anchoring = []
        this.impendingAnchoredChanges = [{
            translate: v(0,0,0),
            anchoredPivot: v(0,0,0),
            rotate: v(0,0,0),
            scale: v(1,1,1),
        }]
        this.lastTranslate = pos;
        this.lastScale = scale
        this.lastRotate = v(0,0,0)

        this.matrix = [];
        this.updateMatrix(); //center mat

        this.vertices = []
        this.faces = [] // face: {vertices, first three vertex's surface normal}

    }
    updateMatrix(){
        if (this.translate !== this.lastTranslate || this.scale !== this.lastScale || this.rotate !== this.lastRotate){
            //recalculate matrix
            this.lastTranslate = this.translate;
            this.lastScale = this.scale;
            this.lastRotate = this.rotate;
        }
        let scaleMat = [
            [this.scale.x, 0, 0, 0],
            [0, this.scale.y, 0, 0],
            [0, 0, this.scale.z, 0],
            [0, 0, 0, 1]
        ];
        let transMat = [
            [1, 0, 0, this.translate.x],
            [0, 1, 0, this.translate.y],
            [0, 0, 1, this.translate.z],
            [0, 0, 0, 1]
        ];
        let rotMat = matPresets.zyx; //fix later
        this.matrix = multiplyMatrices(transMat, multiplyMatrices(rotMat, scaleMat));
        return this.matrix;
    }
    initializeAnchors(...blocks){
        this.anchoring = blocks;
        for (let block of blocks){
            let restrainedPos = {
                x: this.translate.x - block.translate.x,
                y: this.translate.y - block.translate.y,
                z: this.translate.z - block.translate.z,
            }
            let restrainedAngle = {
                x: this.rotate.x - block.rotate.x,
                y: this.rotate.y - block.rotate.y,
                z: this.rotate.z - block.rotate.z,
            }
            let anchoredPivot = {
                x: this.pivot.x,
                y: this.pivot.y,
                z: this.pivot.z,
            }
            block.anchoring.push({block: this, offset: restrainedPos, angleOffset: restrainedAngle, anchoredPivot: anchoredPivot})
        }
    }
    updateAnchors(){
        for (let anchor of this.anchoring){
            let uploadTranslate = {
                x: this.translate.x - anchor.offset.x,
                y: this.translate.y - anchor.offset.y,
                z: this.translate.z - anchor.offset.z,
            }
            let uploadRotate = {
                x: this.rotate.x - anchor.angleOffset.x,
                y: this.rotate.y - anchor.angleOffset.y,
                z: this.rotate.z - anchor.angleOffset.z,
            }
            let uploadPivot = {
                x: this.pivot.x,
                y: this.pivot.y,
                z: this.pivot.z,
            }
            anchor.block.impendingAnchoredChanges.push({
                translate: uploadTranslate,
                rotate: uploadRotate,
                anchoredPivot: uploadPivot,
                scale: anchor.block.scale,
            })
        }
    }
    updateStats(pos, rot, scale){
        this.translate = pos;
        this.rotate = rot;
        this.scale = scale;
        this.updateMatrix();
        this.updateAnchors();
    }
}

function easyBlock(pos, offset, scale){ //center is offset. (1-offset
    const origin = {
        x: pos.x,
        y: pos.y,
        z: pos.z,
    } 
    const pivot = {
        x: pos.x + offset.x,
        y: pos.y + offset.y,
        z: pos.z + offset.z,
    }
    //pivot
    //real block:
    const preset = [
        {x:scale.x, y:scale.y, z:scale.z},//0
        {x:scale.x, y:-scale.y, z:scale.z},//1
        {x:-scale.x, y:-scale.y, z:scale.z},//2
        {x:-scale.x, y:scale.y, z:scale.z},//3
        {x:scale.x, y:scale.y, z:-scale.z},//4
        {x:scale.x, y:-scale.y, z:-scale.z},//5
        {x:-scale.x, y:-scale.y, z:-scale.z},//6
        {x:-scale.x, y:scale.y, z:-scale.z},//7
    ]
    let vertices = [
        {x:pos.x, y:pos.y, z:pos.z},//0
        {x:pos.x, y:pos.y, z:pos.z},//1
        {x:pos.x, y:pos.y, z:pos.z},//2
        {x:pos.x, y:pos.y, z:pos.z},//3
        {x:pos.x, y:pos.y, z:pos.z},//4
        {x:pos.x, y:pos.y, z:pos.z},//5
        {x:pos.x, y:pos.y, z:pos.z},//6
        {x:pos.x, y:pos.y, z:pos.z},//7
    ];
    for (let i = 0; i < vertices.length; i++){
        vertices[i].x = vertices[i].x + preset[i].x;
        vertices[i].y = vertices[i].y + preset[i].y;
        vertices[i].z = vertices[i].z  +preset[i].z;
    }
    const faces = [
        [vertices[0], vertices[1], vertices[2], vertices[3]],//front
        [vertices[0], vertices[1], vertices[5], vertices[4]],//left
        [vertices[0], vertices[3], vertices[7], vertices[4]],//top
        [vertices[6], vertices[5], vertices[1], vertices[2]],//bottom
        [vertices[6], vertices[2], vertices[3], vertices[7]],//right
        [vertices[6], vertices[7], vertices[4], vertices[5]],//back
    ]
    const normals = faces.map(face => {
        const vector1 = {
            x: face[1].x - face[0].x,
            y: face[1].y - face[0].y,
            z: face[1].z - face[0].z,
        };
        const vector2 = {
            x: face[2].x - face[0].x,
            y: face[2].y - face[0].y,
            z: face[2].z - face[0].z,
        };
        return cross(vector1, vector2);
    });
    let block = new Rigid(pos, scale, pivot);
    block.origin = origin;
    block.vertices = vertices;
    block.faces = faces;
    block.normals = normals;
    blockList.push(block);
    return block
}
//offset = scale to rotate on +++ edge. keep 0 to pivot at center

const partsLibrary = {
    quadrupedTorso: easyBlock(v(0,0,0),v(0,0,0),v(1,0.8,1)), //pivot at center
    bipedalTorso: easyBlock(v(0,0,0),v(0,0,0),v(0.4,1,0.8)), //normally pivot at center
    quadrupedLimb: easyBlock(v(0,0,0),v(0,0.5,0),v(0.2,0.5,0.2)), //pivots at top of y
    bipedalLimb: easyBlock(v(0,0,0),v(0,0.5,0),v(0.15,0.5,0.15)), //pivots at top of y
    head: easyBlock(v(0,0,0),v(0,-0.4,0),v(0.4,0.4,0.4)),//pivots at bottom of y
    shortTail: easyBlock(v(0,0,0),v(0,0.2,0),v(0.1,0.2,0.1)),//pivots at top of y
}
let block = easyBlock(v(0,0,0),v(0,0,0),v(1,0.8,1))
console.log(easyBlock(v(0,0,0),v(0,0,0),v(1,0.8,1)))
const entityModelLibrary = { //all scale as if it were 1 block size
    simpleQuadruped: {
        style: 'quadruped',
        torso: partsLibrary.quadrupedTorso,
        legs: [partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb],
        head: partsLibrary.head,
    },
    simpleBipedal: {
        style: 'bipedal',
        torso: partsLibrary.bipedalTorso,
        legs: [partsLibrary.bipedalLimb, partsLibrary.bipedalLimb],
        head: partsLibrary.head,
    },
    quadrupedPlus: {
        style: 'quadruped',
        torso: partsLibrary.quadrupedTorso,
        legs: [partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb,
        partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb, partsLibrary.quadrupedLimb],
        head: partsLibrary.head,
    },
}
function stitchPresets(model){
    let torso = model.torso;
    let legs = model.legs;
    let arms = model.arms;
    let head = model.head;
    if (model == entityModelLibrary.simpleQuadruped){
        let torsoCenter = v(0,legs[0].scale.y + torso.scale.y/2,0)
        let legYpivot = legs[0].scale.y;
        let legDivide = v(legs[0].scale.x, 0, legs[0].scale.z)
        //leg width/
        //put legs in each corner of bottom of torso,
        //two legs: halfway in x axis, align with edges of z edge of torso
        //four legs: align with each corner of torso
        //anchor each to torso
        legs[0].translate = v(torsoCenter.x - legDivide.x, legYpivot, torsoCenter.z - legDivide.z)
        legs[1].translate = v(torsoCenter.x + legDivide.x, legYpivot, torsoCenter.z - legDivide.z)
        legs[2].translate = v(torsoCenter.x - legDivide.x, legYpivot, torsoCenter.z + legDivide.z)
        legs[3].translate = v(torsoCenter.x + legDivide.x, legYpivot, torsoCenter.z + legDivide.z)
        legs[0].pivot = v(0, legYpivot, 0)
        legs[1].pivot = v(0, legYpivot, 0)
        legs[2].pivot = v(0, legYpivot, 0)
        legs[3].pivot = v(0, legYpivot, 0)
        head.translate = v(torsoCenter.x, torsoCenter.y + torso.scale.y/2 + head.scale.y/2, torsoCenter.z - torso.scale.z/2 - head.scale.z/2)
        head.pivot = v(0,0,head.scale.z/2)
        torso.initializeAnchors(...legs, head);
    }
    
}
class Entity {
    constructor(species, pos){
        this.pos = pos; //(center, feet level, center)
        this.pivot = v(0,0,0) //center center center
        this.vel = v(0,0,0)
        this.rot = v(0,0,0)
        this.rotVel = v(0,0,0)
        this.scale = v(0,0,0)
        this.limbInternalRotation = {} //{limb:v(0,0,0)}
        this.modelParts = entityModelLibrary.simpleQuadruped;
        this.model = {}
        this.stitchModel();
        this.initializePosition();
    }
    stitchModel(){
        stitchPresets(this.modelParts);
    }
    initializePosition(){
        //update torso stats
        let torso = this.modelParts.torso;
        torso.updateStats(v(this.pos.x + this.modelParts.torso.translate.x, this.pos.y + this.modelParts.torso.translate.y, this.pos.z + this.modelParts.torso.translate.z), v(0,0,0), v(1,1,1))
        this.model['torso'] = torso;
        console.log(torso)
        console.log(this.modelParts.legs)
    }

}


let entity1 = new Entity(null, v(200,200,0))
console.log(blockList)
function draw(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "black"
    ctx.beginPath()
    for(let block of blockList){
        for (let face of block.faces){
            ctx.moveTo(face[0].x,face[0].y)
            ctx.lineTo(face[1].x,face[1].y)
            ctx.lineTo(face[2].x,face[2].y)
            ctx.lineTo(face[3].x,face[3].y)
            ctx.lineTo(face[0].x,face[0].y)
        }
    }
    ctx.stroke()
    //
}
setInterval(draw, 200)
