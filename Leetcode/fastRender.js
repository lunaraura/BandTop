const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const v = (x,y,z) => [x,y,z,0];
const vAdd = (a,b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2], 0];
const vSub = (a,b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2], 0];
const vMul = (v, s) => [v[0]*s, v[1]*s, v[2]*s, 0];
const matMult = (a,b) => {
    const res = [];
    for(let i=0; i<4; i++){
        res[i] = [];
        for(let j=0; j<4; j++){
            res[i][j] = 0;
            for(let k=0; k<4; k++){
                res[i][j] += a[i][k] * b[k][j];
            }
        }
    }    return res;
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
        const f = 1 / Math.tan(fov * 0.5 * Math.PI / 180);
        const projectionMatrix = [
            [f/aspect, 0, 0, 0],
            [0, f, 0, 0],
            [0, 0, (100+near)/(near-100), (2*100*near)/(near-100)],
            [0, 0, -1, 0]
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
    buildCloud(points){
        this.baseCloud = points;
        this.currentCloud = points;
    }
    //new version
    buildFaces(faceList){
        this.baseCloud = faceList.vertices;
        this.currentCloud = faceList.vertices;
        for(let face of faceList.faceIndex){
            const v1 = this.baseCloud[face[0]];
            const v2 = this.baseCloud[face[1]];
            const v3 = this.baseCloud[face[2]];
            const edge1 = vSub(v2, v1);
            const edge2 = vSub(v3, v1);
            const normal = [
                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                edge1[0] * edge2[1] - edge1[1] * edge2[0],
                0
            ];
            this.normals.push(normal);
        }
    }
    update(){
        const rX = rotX(this.rot[0]);
        const rY = rotY(this.rot[1]);
        const rZ = rotZ(this.rot[2]);
        const s = scale(this.scale);
        const t = translate(this.pos[0], this.pos[1], this.pos[2]);
        const modelMatrix = matMult(t, matMult(rZ, matMult(rY, matMult(rX, s))));
        this.currentCloud = this.baseCloud.map(point => {
            const transformed = matMult(modelMatrix, [[point[0]], [point[1]], [point[2]], [1]]);
            return [transformed[0][0], transformed[1][0], transformed[2][0]];
        }
        );
    }
    rebuildNormals(){
        this.normals = [];
        for(let i=0; i<this.currentCloud.length; i+=4){
            const v1 = this.currentCloud[i];
            const v2 = this.currentCloud[i+1];
            const v3 = this.currentCloud[i+2];
            const edge1 = vSub(v2, v1);
            const edge2 = vSub(v3, v1);
            const normal = [
                edge1[1] * edge2[2] - edge1[2] * edge2[1],
                edge1[2] * edge2[0] - edge1[0] * edge2[2],
                edge1[0] * edge2[1] - edge1[1] * edge2[0],
                0
            ];
            this.normals.push(normal);
        }
    }
}

const predefinedShapes = {
    cube: [
        v(-1,-1,-1), v(1,-1,-1), v(1,1,-1), v(-1,1,-1),
        v(-1,-1,1), v(1,-1,1), v(1,1,1), v(-1,1,1)
    ],
    cubeUncentered: [
        v(0,0,0), v(2,0,0), v(2,2,0), v(0,2,0),
        v(0,0,2), v(2,0,2), v(2,2,2), v(0,2,2)
    ]
}
const predefinedShapesTwo = {
    cube: {
        vertices: [
            v(-1,-1,-1), v(1,-1,-1), v(1,1,-1), v(-1,1,-1),
            v(-1,-1,1), v(1,-1,1), v(1,1,1), v(-1,1,1)
        ],
        faceIndex: [
            [0,1,2,3],
            [4,5,6,7],
            [0,1,5,4],
            [2,3,7,6],
            [1,2,6,5],
            [0,3,7,4]
        ]
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

const camera = new Camera();
const cube = new RigidBody();
cube.buildFaces(predefinedShapesTwo.cube);
cube.pos = v(0,0,5);
cube.rot = v(0.5,0.5,0);
cube.scale = 1;


function raycastNormal(point){
    const rayDir = vSub(point, camera.pos);
    let closestFace = null;
    let closestDist = Infinity;
    for(let i=0; i<cube.currentCloud.length; i+=4){
        const v1 = cube.currentCloud[i];
        const v2 = cube.currentCloud[i+1];
        const v3 = cube.currentCloud[i+2];
        const edge1 = vSub(v2, v1);
        const edge2 = vSub(v3, v1);
        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0],
            0
        ];
        const denom = normal[0] * rayDir[0] + normal[1] * rayDir[1] + normal[2] * rayDir[2];
        if(Math.abs(denom) > 0.0001){
            const t = (normal[0] * (v1[0] - camera.pos[0]) + normal[1] * (v1[1] - camera.pos[1]) + normal[2] * (v1[2] - camera.pos[2])) / denom;
            if(t > 0 && t < closestDist){
                closestDist = t;
                closestFace = normal;
            }
        }
    }
    return closestFace;
}
function drawLineOnNormal(point){
    const normal = raycastNormal(point);
    if(normal){
        const endPoint = vAdd(point, vMul(normal, 0.5));
        const p1 = camToCanvas(camera.project(point));
        const p2 = camToCanvas(camera.project(endPoint));
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.strokeStyle = "blue";
        ctx.stroke();
    }
}

function animateWireframe(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cube.update();
    const projectedPoints = cube.currentCloud.map(point => camera.project(point));
    ctx.beginPath();
    for(let i=0; i<4; i++){
        const p1 = camToCanvas(projectedPoints[i]);
        const p2 = camToCanvas(projectedPoints[(i+1)%4]);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        const p3 = camToCanvas(projectedPoints[i+4]);
        const p4 = camToCanvas(projectedPoints[((i+1)%4)+4]);
        ctx.moveTo(p3[0], p3[1]);
        ctx.lineTo(p4[0], p4[1]);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p3[0], p3[1]);
    }
    ctx.strokeStyle = "black";
    ctx.stroke();
    requestAnimationFrame(animateWireframe);
}
function animateSolid(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cube.update();
    const projectedPoints = cube.currentCloud.map(point => camera.project(point));
    ctx.beginPath();
    for(let i=0; i<4; i++){
        const p1 = camToCanvas(projectedPoints[i]);
        const p2 = camToCanvas(projectedPoints[(i+1)%4]);
        const p3 = camToCanvas(projectedPoints[i+4]);
        const p4 = camToCanvas(projectedPoints[((i+1)%4)+4]);
        fillPolygon([p1, p2, p4, p3], "rgba(200, 0, 0, 0.5)");
    }
    requestAnimationFrame(animateSolid);
}
function animateDebug(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    cube.update();
    const projectedPoints = cube.currentCloud.map(point => camera.project(point));
    ctx.beginPath();
    for(let i=0; i<4; i++){
        const p1 = camToCanvas(projectedPoints[i]);
        const p2 = camToCanvas(projectedPoints[(i+1)%4]);
        const p3 = camToCanvas(projectedPoints[i+4]);
        const p4 = camToCanvas(projectedPoints[((i+1)%4)+4]);
        fillPolygon([p1, p2, p4, p3], "rgba(200, 0, 0, 0.5)");
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.moveTo(p3[0], p3[1]);
        ctx.lineTo(p4[0], p4[1]);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p3[0], p3[1]);
    }
    // Draw normals
    for(let i=0; i<cube.currentCloud.length; i+=4){
        const v1 = cube.currentCloud[i];
        const v2 = cube.currentCloud[i+1];
        const v3 = cube.currentCloud[i+2];
        const edge1 = vSub(v2, v1);
        const edge2 = vSub(v3, v1);
        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0],
            0
        ];
        const center = vMul(vAdd(vAdd(v1, v2), v3), 1/3);
        const endPoint = vAdd(center, vMul(normal, 0.5));
        const p1 = camToCanvas(camera.project(center));
        const p2 = camToCanvas(camera.project(endPoint));
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
    }
    ctx.strokeStyle = "black";
    ctx.stroke();
    requestAnimationFrame(animateDebug);
}
animateDebug();
