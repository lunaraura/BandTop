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
function transformPoint(matrix, point){
    const transformed = matMult(matrix, [[point[0]], [point[1]], [point[2]], [1]]);
    return [transformed[0][0], transformed[1][0], transformed[2][0], transformed[3][0]];
}
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
    const oldVertices = rigidBody.baseCloud;
    const oldTriangles = rigidBody.triangles;
    const newVertices = [];
    const newTriangles = [];
    function addVertex(p){
        newVertices.push([p[0], p[1], p[2]]);
        return newVertices.length - 1;
    }
    for (let tri of oldTriangles){
        const a = oldVertices[tri[0]];
        const b = oldVertices[tri[1]];
        const c = oldVertices[tri[2]];
        const grid = [];
        for (let i = 0; i <= divideByN; i++){
            grid[i] = [];
            for (let j = 0; j <= divideByN - i; j++){
                const p = [
                    a[0] + (b[0] - a[0]) * (i / divideByN) + (c[0] - a[0]) * (j / divideByN),
                    a[1] + (b[1] - a[1]) * (i / divideByN) + (c[1] - a[1]) * (j / divideByN),
                    a[2] + (b[2] - a[2]) * (i / divideByN) + (c[2] - a[2]) * (j / divideByN)
                ];
                grid[i][j] = addVertex(p);
            }
        }
        for (let i = 0; i < divideByN; i++){
            for (let j = 0; j < divideByN - i; j++){
                newTriangles.push([grid[i][j], grid[i+1][j], grid[i][j+1]]);
                if (j < divideByN - i - 1){
                    newTriangles.push([grid[i+1][j], grid[i+1][j+1], grid[i][j+1]]);
                }
            }
        }
    }
    rigidBody.baseCloud = newVertices;
    rigidBody.currentCloud = newVertices.map(p => [p[0], p[1], p[2]]);
    rigidBody.triangles = newTriangles;
    rigidBody.faceNormals = newTriangles.map(tri => {
        const a = rigidBody.baseCloud[tri[0]];
        const b = rigidBody.baseCloud[tri[1]];
        const c = rigidBody.baseCloud[tri[2]];
        const edge1 = sub3(b, a);
        const edge2 = sub3(c, a);
        return normalize3(cross3(edge1, edge2));
    });
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
    }
    getViewMatrix(){
        const rX = rotX(this.rot[0]);
        const rY = rotY(this.rot[1]);
        const rZ = rotZ(this.rot[2]);
        const t = translate(-this.pos[0], -this.pos[1], -this.pos[2]);
        return matMult(rZ, matMult(rY, matMult(rX, t)));
    }
    project(point){
        const fov = 90;
        const aspect = canvas.width / canvas.height;
        const near = 0.1;
        const f = 1 / Math.tan(fov * 0.3 * Math.PI / 180);
        const projectionMatrix = [
            [f/aspect, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (100+near)/(near-100), (2*100*near)/(near-100)],
            [0, 0, 1, 0]
        ];
        const viewMatrix = this.getViewMatrix();
        const transformed = matMult(projectionMatrix, matMult(viewMatrix, [[point[0]], [point[1]], [point[2]], [1]]));
        return [transformed[0][0] / transformed[3][0], transformed[1][0] / transformed[3][0]];
    }
}

class RigidBody{
    constructor(){
        this.pos = v(0,0,0);
        this.rot = v(0,0,0);
        this.scale = 1;
        this.baseCloud = []
        this.currentCloud = []
        this.normals = [];
    }
    buildMesh(vertices, faces){
        this.baseCloud = vertices.map(p => [p[0], p[1], p[2]]);
        this.currentCloud = this.baseCloud.map(p => [p[0], p[1], p[2]]);
        this.triangles = [];
        for (let f of faces) {
            this.triangles.push(...triangulateFace(f));
        }
        this.faceNormals = [];
    }
    update(){
        const rX = rotX(this.rot[0]);
        const rY = rotY(this.rot[1]);
        const rZ = rotZ(this.rot[2]);
        const s = scale(this.scale);
        const t = translate(this.pos[0], this.pos[1], this.pos[2]);
        const modelMatrix = matMult(t, matMult(rZ, matMult(rY, matMult(rX, s))));
        this.vertices = this.baseCloud.map(point => {
            const transformed = matMult(modelMatrix, [[point[0]], [point[1]], [point[2]], [1]]);
            return [transformed[0][0], transformed[1][0], transformed[2][0]];
        });
        this.normals = this.triangles.map(tri => {
            const a = this.vertices[tri[0]];
            const b = this.vertices[tri[1]];
            const c = this.vertices[tri[2]];
            const edge1 = vSub(b, a);
            const edge2 = vSub(c, a);
            return normalize3(cross3(edge1, edge2));
        });
        this.faceNormals = this.normals;
        this.currentCloud = this.vertices.map(p => [p[0], p[1], p[2]]);
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
            [0,1,2,3]
        ]
    }
}
function toCameraSpaceVertices(obj, camera){
    const viewMatrix = camera.getViewMatrix();
    obj.cameraCloud = obj.vertices.map(p => {
        const t = transformPoint(viewMatrix, p);
        return [t[0], t[1], t[2]]
    })
}
function isBackFaceCamera(obj, tri){
    const a = obj.cameraCloud[tri[0]];
    const b = obj.cameraCloud[tri[1]];
    const c = obj.cameraCloud[tri[2]];
    const ab = sub3(b,a)
    const ac = sub3(c,a)
    const n = cross3(ab, ac)
    return n[2] < 0;
}
function triangleOutsideCameraView(obj, tri){
    const a = obj.cameraCloud[tri[0]];
    const b = obj.cameraCloud[tri[1]];
    const c = obj.cameraCloud[tri[2]];
    return a[2] < 0 && b[2] < 0 && c[2] < 0;
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
function buildDrawingList(objs, camera){
    const drawList = [];
    for (let obj of objs){
        obj.projectedCloud = obj.currentCloud.map(point => camera.project(point));
        for (let tri of obj.triangles){
            if (triangleOutsideCameraView(obj, tri)) continue;
            if (isBackFaceCamera(obj, tri)) continue;
            const a = obj.projectedCloud[tri[0]];
            const b = obj.projectedCloud[tri[1]];
            const c = obj.projectedCloud[tri[2]];
            drawList.push({obj, tri, z: (a[2]+b[2]+c[2])/3});
        }
    }
    drawList.sort((a,b) => b.z - a.z);
    return drawList;
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
        const {obj, tri, z} = item;
        const a = obj.projectedCloud[tri[0]];
        const b = obj.projectedCloud[tri[1]];
        const c = obj.projectedCloud[tri[2]];
        fillPolygon([a, b, c], colorInd[ind % 10]);
        ind++;
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.closePath();
        ctx.stroke();
    }
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
    if (e.key === "w") cube.rot[2] -= step;
    if (e.key === "s") cube.rot[2] += step;
    if (e.key === "a") cube.rot[0] -= step;
    if (e.key === "d") cube.rot[0] += step;
    if (e.key === "q") cube.rot[1] -= step;
    if (e.key === "e") cube.rot[1] += step;
});

const camera = new Camera();
const cube = new RigidBody();
const pyramid = new RigidBody();
const floor = new RigidBody()
cube.buildMesh(predefinedShapesTwo.cube.vertices, predefinedShapesTwo.cube.faceIndex);
enhanceMeshResolution(cube, 10);
cube.pos = v(0,1,5);
cube.rot = v(0.6,0.1,0.0);
cube.scale = 2;
pyramid.buildMesh(predefinedShapesTwo.pyramid.vertices, predefinedShapesTwo.pyramid.faceIndex);
pyramid.pos = v(2,0,5);
pyramid.rot = v(0.6,0.1,0.0);
pyramid.scale = 1;
enhanceMeshResolution(pyramid, 2);
floor.buildMesh(predefinedShapesTwo.planeFloor.vertices, predefinedShapesTwo.planeFloor.faceIndex);
enhanceMeshResolution(floor, 10)
floor.pos = v(0,-4,5)
floor.rot = v(0,0,0)
floor.scale = 6;
let objs = [cube, pyramid, floor];


function animateDebug(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    objs.forEach(obj => {
        obj.update();
        toCameraSpaceVertices(obj, camera);
    });
    drawScene(objs, camera);
    pyramid.rot[1] += 0.01;
    requestAnimationFrame(animateDebug);
}
animateDebug();
