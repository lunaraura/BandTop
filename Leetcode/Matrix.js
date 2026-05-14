const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const v = (x,y,z) => [x,y,z,0];
const v3 = (x,y,z) => [x,y,z];
const add3 = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub3 = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mul3 = (v, s) => [v[0]*s, v[1]*s, v[2]*s];
const cross3 = (a,b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
];
const length3 = (v) => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
const normalize3 = (v) => {
    const len = length3(v);
    return len > 0 ? [v[0]/len, v[1]/len, v[2]/len] : [0,0,0];
}
const dot3 = (a,b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
function triangulateFace(face){
    const triangles = [];
    if (!face || face.length < 3) return triangles;
    for (let i = 1; i < face.length - 1; i++) {
        triangles.push([face[0], face[i], face[i + 1]]);
    }
    return triangles;
}
function pointInTriangle(pt, v1, v2, v3){
    const v0 = sub3(v3, v1);
    const v1v = sub3(v2, v1);
    const v2v = sub3(pt, v1);
    const dot00 = dot3(v0, v0);
    const dot01 = dot3(v0, v1v);
    const dot02 = dot3(v0, v2v);
    const dot11 = dot3(v1v, v1v);
    const dot12 = dot3(v1v, v2v);
    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < 1e-8) return false;
    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    return u >= 0 && v >= 0 && u + v <= 1;
}
function raycastFace(rayOrigin, dir, mesh){
    let bestT = Infinity;
    let bestN = null;
    let bestHit = null;
    for(let fi = 0; fi < mesh.triangles.length; fi++){
        const [i0, i1, i2] = mesh.triangles[fi];
        const v0 = mesh.vertices[i0];
        const v1 = mesh.vertices[i1];
        const v2 = mesh.vertices[i2];
        const n = mesh.faceNormals[fi];
        const denom = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
        if (Math.abs(denom) > 0.0001){
            const t = (n[0] * (v0[0] - rayOrigin[0]) + n[1] * (v0[1] - rayOrigin[1]) + n[2] * (v0[2] - rayOrigin[2])) / denom;
            if (t > 0 && t < bestT){
                const hitPoint = add3(rayOrigin, mul3(dir, t));
                if (pointInTriangle(hitPoint, v0, v1, v2)){
                    bestT = t;
                    bestN = n;
                    bestHit = hitPoint;
                }
            }
        }
    }
    return bestHit ? {point: bestHit, normal: bestN} : null;
}
const hardlimitResolution = 10;
function enhanceMeshResolution(rigidBody, divideByN){
    if (divideByN < 2 || divideByN > hardlimitResolution) return;
    const newVertices = [];
    const newFaces = [];
    const step = 1 / divideByN;
    const faceCount = rigidBody.triangles.length / 3;
    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++){
        const i0 = rigidBody.triangles[faceIndex * 3];
        const i1 = rigidBody.triangles[faceIndex * 3 + 1];
        const i2 = rigidBody.triangles[faceIndex * 3 + 2];
        const v0 = rigidBody.base.slice(i0 * 3, i0 * 3 + 3);
        const v1 = rigidBody.base.slice(i1 * 3, i1 * 3 + 3);
        const v2 = rigidBody.base.slice(i2 * 3, i2 * 3 + 3);
        const faceVertexBase = newVertices.length;
        const rowStart = new Array(divideByN + 2);
        for (let r = 0; r <= divideByN; r++){
            rowStart[r] = (r * (2 * divideByN - r + 3)) / 2;
        }

        for (let u = 0; u <= divideByN; u++){
            for (let v = 0; v <= divideByN - u; v++){
                const uu = u * step;
                const vv = v * step;
                const w = 1 - uu - vv;
                const newVertex = [
                    v0[0] * w + v1[0] * uu + v2[0] * vv,
                    v0[1] * w + v1[1] * uu + v2[1] * vv,
                    v0[2] * w + v1[2] * uu + v2[2] * vv
                ];
                newVertices.push(newVertex);
            }
        }

        for (let u = 0; u < divideByN; u++){
            for (let v = 0; v < divideByN - u; v++){
                const iA = faceVertexBase + rowStart[u] + v;
                const iB = faceVertexBase + rowStart[u + 1] + v;
                const iC = faceVertexBase + rowStart[u] + v + 1;
                const iD = faceVertexBase + rowStart[u + 1] + v + 1;
                newFaces.push([iA, iB, iC]);
                if (v < divideByN - u - 1){
                    newFaces.push([iC, iB, iD]);
                }
            }
        }
    }
    rigidBody.buildMesh(newVertices, newFaces);
}

const vAdd = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2], 0];
const vSub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2], 0];
const vMul = (v, s) => [v[0]*s, v[1]*s, v[2]*s, 0];
const matMult = (a,b) => {
    // general matrix multiplication: a (m x n) * b (n x p) => res (m x p)
    const m = a.length;
    const n = a[0].length;
    const p = b[0].length;
    const res = new Array(m);
    for (let i = 0; i < m; i++) {
        res[i] = new Array(p).fill(0);
        for (let j = 0; j < p; j++) {
            let sum = 0;
            for (let k = 0; k < n; k++) {
                sum += a[i][k] * b[k][j];
            }
            res[i][j] = sum;
        }
    }
    return res;
}
const rotX = (x) =>{return [
    [1, 0, 0, 0],
    [0, Math.cos(x), -Math.sin(x), 0],
    [0, Math.sin(x), Math.cos(x), 0],
    [0, 0, 0, 1]
];}
const rotY = (y) =>{return [
    [Math.cos(y), 0, Math.sin(y), 0],
    [0, 1, 0, 0],
    [-Math.sin(y), 0, Math.cos(y), 0],
    [0, 0, 0, 1]
];}
const rotZ = (z) =>{return [
    [Math.cos(z), -Math.sin(z), 0, 0],
    [Math.sin(z), Math.cos(z), 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
];}
const scale = (s) =>{return [
    [s, 0, 0, 0],
    [0, s, 0, 0],
    [0, 0, s, 0],
    [0, 0, 0, 1]
];}
const translate = (x,y,z) =>{return [
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1]
];}

class Camera{
    constructor(){
        this.pos = v(0,0,-5);
        this.rot = v(0,0,0);
        this.fov = 90;
        this.aspect = canvas.width / canvas.height;
        this.near = 0.1;
        this.far = 100;
        this.f = 1 / Math.tan(this.fov * 0.5 * Math.PI / 180);
    }
    getViewMatrix(){
        const rX = rotX(this.rot[0]);
        const rY = rotY(this.rot[1]);
        const rZ = rotZ(this.rot[2]);
        const t = translate(-this.pos[0], -this.pos[1], -this.pos[2]);
        return matMult(rZ, matMult(rY, matMult(rX, t)));
    }
}

class RigidBody{
    constructor(){
        this.pos = v(0,0,0);
        this.rot = v(0,0,0);
        this.scale = 1;
        this.base = null
        this.world = null;
        this.camera = null
        this.baseCloud = []
        this.currentCloud = []
        this.normals = [];
    }
    buildMesh(vertices, faces){
        const flat = []
        for (const p of vertices){
            flat.push(p[0],p[1],p[2])
        }
        const flatTris = []
        for (const face of faces){
            const tris = triangulateFace(face);
            for (const tri of tris){
                flatTris.push(tri[0], tri[1], tri[2]);
            }
        }
        this.base = new Float32Array(flat)
        this.world = new Float32Array(flat.length)
        this.camera = new Float32Array(flat.length)
        this.screen = new Float32Array((flat.length/3)*2)
        
        this.triangles = new Uint32Array(flatTris)
    }
}
const predefinedShapesTwo = {
    cube: {
        vertices: [
            v3(-1,-1,-1), v3(1,-1,-1), v3(1,1,-1), v3(-1,1,-1),
            v3(-1,-1,1), v3(1,-1,1), v3(1,1,1), v3(-1,1,1)
        ],
        // bt // -1-1 rbk 1-1 rfr 11 lfr 1-1 lbk
        // tp // -1-1 rbk 1-1 rfr 11 lfr 1-1 lbk

        faceIndex: [
            [0,1,2,3], //bot
            [6,5,4,7], //top
            [0,4,5,1], //right
            [6,7,3,2], //left
            [6,2,1,5], // front
            [0,3,7,4] // back
        ]
    },
    pyramid: {
        vertices: [
            v3(0,1,0), v3(-1,-1,-1), v3(1,-1,-1), v3(1,-1,1), v3(-1,-1,1)
        ],
        faceIndex: [
            [0,1,2], // front
            [0,2,3], // right
            [0,3,4], // back
            [0,4,1], // left
            [1,4,3,2] // bottom
        ]
    },
    planeFloor: {
        vertices: [
            v3(-1,0,-1),v3(-1,0,1),v3(1,0,1),v3(1,0,-1)
        ],
        faceIndex: [
            [0,3,2,1]
        ]
    }
}
function isBackFaceCamera(obj, i0, i1, i2){
    const cam = obj.camera;

    const ai = i0 * 3;
    const bi = i1 * 3;
    const ci = i2 * 3;

    const ax = cam[ai], ay = cam[ai+1], az = cam[ai+2];
    const bx = cam[bi], by = cam[bi+1], bz = cam[bi+2];
    const cx = cam[ci], cy = cam[ci+1], cz = cam[ci+2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    return (nx * ax + ny * ay + nz * az) <= 0;
}

function triangleOutsideCameraView(obj, i0, i1, i2, camera){
    const cam = obj.camera;

    const ai = i0 * 3;
    const bi = i1 * 3;
    const ci = i2 * 3;

    const ax = cam[ai], ay = cam[ai+1], az = cam[ai+2];
    const bx = cam[bi], by = cam[bi+1], bz = cam[bi+2];
    const cx = cam[ci], cy = cam[ci+1], cz = cam[ci+2];

    if (az < camera.near && bz < camera.near && cz < camera.near) return true;
    if (az > camera.far && bz > camera.far && cz > camera.far) return true;

    const axLimit = az * camera.aspect / camera.f;
    const bxLimit = bz * camera.aspect / camera.f;
    const cxLimit = cz * camera.aspect / camera.f;

    const ayLimit = az / camera.f;
    const byLimit = bz / camera.f;
    const cyLimit = cz / camera.f;

    if (ax < -axLimit && bx < -bxLimit && cx < -cxLimit) return true;
    if (ax >  axLimit && bx >  bxLimit && cx >  cxLimit) return true;
    if (ay < -ayLimit && by < -byLimit && cy < -cyLimit) return true;
    if (ay >  ayLimit && by >  byLimit && cy >  cyLimit) return true;

    return false;
}

function buildDrawingList(objs, camera){
    const drawList = [];

    for (let objIndex = 0; objIndex < objs.length; objIndex++){
        const obj = objs[objIndex];
        const cam = obj.camera;
        const tris = obj.triangles;

        for (let triIndex = 0; triIndex < tris.length; triIndex += 3){
            const i0 = tris[triIndex];
            const i1 = tris[triIndex + 1];
            const i2 = tris[triIndex + 2];

            if (triangleOutsideCameraView(obj, i0, i1, i2, camera)) continue;
            if (isBackFaceCamera(obj, i0, i1, i2)) continue;

            const z = (
                cam[i0 * 3 + 2] +
                cam[i1 * 3 + 2] +
                cam[i2 * 3 + 2]
            ) / 3;

            drawList.push({ obj, i0, i1, i2, z });
        }
    }

    drawList.sort((a, b) => b.z - a.z);
    return drawList;
}
function updateWorldVertices(obj){
    const src = obj.base
    const dst = obj.world
    const sx = obj.scale;
    const rx = obj.rot[0], ry = obj.rot[1], rz = obj.rot[2];
    const cx = Math.cos(rx), sxr = Math.sin(rx);
    const cy = Math.cos(ry), syr = Math.sin(ry);
    const cz = Math.cos(rz), szr = Math.sin(rz);
    for (let i = 0; i < src.length; i+=3){
        let x = src[i] * sx;
        let y = src[i+1] * sx;
        let z = src[i+2] * sx;
        let y1 = y * cx - z * sxr;
        let z1 = y * sxr + z * cx;
        let x2 = x * cy + z1 * syr;
        let z2 = -x * syr + z1 * cy;
        let x3 = x2 * cz - y1 * szr;
        let y3 = x2 * szr + y1 * cz;
        dst[i] = x3 + obj.pos[0];
        dst[i+1] = y3 + obj.pos[1];
        dst[i+2] = z2 + obj.pos[2];
    }
}
function updateCameraAndScreenVertices(obj, camera){
    const src = obj.world
    const cam = obj.camera;
    const scr = obj.screen;
    for (let i = 0; i < src.length; i+=3){
        const x = src[i] - camera.pos[0];
        const y = src[i+1] - camera.pos[1];
        const z = src[i+2] - camera.pos[2];
        const cosY = Math.cos(-camera.rot[1]);
        const sinY = Math.sin(-camera.rot[1]);
        const cosX = Math.cos(-camera.rot[0]);

        cam[i] = x;
        cam[i+1] = y;
        cam[i+2] = z;
        const ndcX = (x * camera.f / camera.aspect) / z;
        const ndcY = (y * camera.f) / z;
        scr[(i/3)*2] = (ndcX + 1) * canvas.width / 2;
        scr[(i/3)*2 + 1] = (1 - ndcY) * canvas.height / 2;
    }
}
const camToCanvas = (point) => {
    return [point[0] * canvas.width / 2 + canvas.width / 2, -point[1] * canvas.height / 2 + canvas.height / 2];
}
const fillPolygon = (points, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for(let i=1; i<points.length; i++){
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.closePath();
    ctx.fill();
}

function raycastNormal(point){
    const dir = normalize3(sub3(point, camera.pos));
    const hit = raycastFace([camera.pos[0], camera.pos[1], camera.pos[2]], dir, cube);
    return hit ? hit.normal : null;
}
function drawNormalAtHit(){
    const origin = [camera.pos[0], camera.pos[1], camera.pos[2]];
    const normal = raycastNormal(cube.pos);
    if (normal) {
        const endPoint = vAdd(origin, vMul(normal, 0.5));
        const p1 = camToCanvas(camera.project(origin));
        const p2 = camToCanvas(camera.project(endPoint));
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.strokeStyle = "blue";
        ctx.stroke();
    }
}
function drawTriangle(obj, i0, i1, i2, color){
    const s = obj.screen;

    const ai = i0 * 2;
    const bi = i1 * 2;
    const ci = i2 * 2;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(s[ai], s[ai+1]);
    ctx.lineTo(s[bi], s[bi+1]);
    ctx.lineTo(s[ci], s[ci+1]);
    ctx.closePath();
    ctx.fill();
}
function drawScene(objs, camera){
    let ind = 0
    ctx.beginPath();
    let colorInd = {
        0: '#F00',
        1: "#FA0",
        2: "#FF0",
        3: "#AF0",
        4: "#0F0",
        5: "#0FA",
        6: "#0FF",
        7: "#0AF",
        8: "#00F",
        9: "#A0F",
        10: "#F0F"
    }
    const drawList = buildDrawingList(objs, camera);

    for (const item of drawList){
        const color = colorInd[ind % 11] || "#FFF";
        ind++;
        drawTriangle(item.obj, item.i0, item.i1, item.i2, color);}
}
document.getElementById("canvas").addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const rayTarget = [
        (mouseX / canvas.width) * 2 - 1,
        -(mouseY / canvas.height) * 2 + 1,
        1
    ];
    const rayDir = normalize3( rayTarget);
    const hit = raycastFace(camera.pos, rayDir, cube);
    if (hit) {
        console.log("Hit at:", hit.point, "Normal:", hit.normal);
    }
});
//event listener key
document.addEventListener("keydown", (e) => {
    const step = 0.01;
    const moveStep = 2.0;
    if (e.key === "w") cube.rot[2] -= step;
    if (e.key === "s") cube.rot[2] += step;
    if (e.key === "a") cube.rot[0] -= step;
    if (e.key === "d") cube.rot[0] += step;
    if (e.key === "q") cube.rot[1] -= step;
    if (e.key === "e") cube.rot[1] += step;
    if (e.key === "ArrowUp") camera.pos[2] += moveStep;
    if (e.key === "ArrowDown") camera.pos[2] -= moveStep;
    if (e.key === "ArrowLeft") camera.pos[0] -= moveStep;
    if (e.key === "ArrowRight") camera.pos[0] += moveStep;
    if (e.key === "j") camera.rot[1] -= step;
    if (e.key === "l") camera.rot[1] += step;
    if (e.key === "i") camera.rot[2] -= step;
    if (e.key === "k") camera.rot[2] += step;
});

const camera = new Camera();
const cube = new RigidBody();
const pyramid = new RigidBody();
const floor = new RigidBody()
cube.buildMesh(predefinedShapesTwo.cube.vertices, predefinedShapesTwo.cube.faceIndex);
enhanceMeshResolution(cube, 3);
cube.pos = v(0,1,10);
cube.rot = v(0.6,0.1,0.0);
cube.scale = 2;
pyramid.buildMesh(predefinedShapesTwo.pyramid.vertices, predefinedShapesTwo.pyramid.faceIndex);
pyramid.pos = v(2,0,5);
pyramid.rot = v(0.6,0.1,0.0);
pyramid.scale = 1;
// enhanceMeshResolution(pyramid, 2);
floor.buildMesh(predefinedShapesTwo.planeFloor.vertices, predefinedShapesTwo.planeFloor.faceIndex);
// enhanceMeshResolution(floor, 10)
floor.pos = v(0,-4,5)
floor.rot = v(0,0,0)
floor.scale = 6;
let objs = [cube, pyramid, floor];


function animateDebug(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objs.forEach(obj => {
        updateWorldVertices(obj)
        updateCameraAndScreenVertices(obj, camera)
    }
    );
    drawScene(objs, camera);
    pyramid.rot[1] += 0.01;
    requestAnimationFrame(animateDebug);
}
animateDebug();
