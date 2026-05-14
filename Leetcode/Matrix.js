const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const W = () => canvas.width;
const H = () => canvas.height;

function makeCubeMesh() {
    const verts = new Float32Array([
        -1,-1,-1,  1,-1,-1,  1, 1,-1, -1, 1,-1,
        -1,-1, 1,  1,-1, 1,  1, 1, 1, -1, 1, 1
    ]);

    // Indexed triangles. Winding must be consistent.
    const indices = new Uint32Array([
        0,2,1, 0,3,2, // back
        4,5,6, 4,6,7, // front
        0,1,5, 0,5,4, // bottom
        3,7,6, 3,6,2, // top
        1,2,6, 1,6,5, // right
        0,4,7, 0,7,3  // left
    ]);

    return new Mesh(verts, indices);
}

class Mesh {
    constructor(vertices, indices) {
        this.local = vertices;
        this.indices = indices;
        this.world = new Float32Array(vertices.length);
        this.camera = new Float32Array(vertices.length);
        this.screen = new Float32Array((vertices.length / 3) * 2);
    }
}

class Object3D {
    constructor(mesh) {
        this.mesh = mesh;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.rx = 0;
        this.ry = 0;
        this.rz = 0;
        this.s = 1;
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.z = -5;
        this.rx = 0;
        this.ry = 0;
        this.rz = 0;
        this.fov = Math.PI / 2;
        this.near = 0.1;
        this.far = 100;
    }

    focal() {
        return 1 / Math.tan(this.fov * 0.5);
    }
}

const camera = new Camera();
const cube = new Object3D(makeCubeMesh());
cube.z = 5;
cube.s = 2;

const objects = [cube];
const drawList = [];

function rotateXYZ(x, y, z, rx, ry, rz) {
    let cx = Math.cos(rx), sx = Math.sin(rx);
    let cy = Math.cos(ry), sy = Math.sin(ry);
    let cz = Math.cos(rz), sz = Math.sin(rz);

    let y1 = y * cx - z * sx;
    let z1 = y * sx + z * cx;
    let x1 = x;

    let x2 = x1 * cy + z1 * sy;
    let z2 = -x1 * sy + z1 * cy;
    let y2 = y1;

    let x3 = x2 * cz - y2 * sz;
    let y3 = x2 * sz + y2 * cz;

    return [x3, y3, z2];
}

function transformObjectToWorld(obj) {
    const m = obj.mesh;
    const src = m.local;
    const dst = m.world;

    for (let i = 0; i < src.length; i += 3) {
        let x = src[i] * obj.s;
        let y = src[i + 1] * obj.s;
        let z = src[i + 2] * obj.s;

        const r = rotateXYZ(x, y, z, obj.rx, obj.ry, obj.rz);

        dst[i] = r[0] + obj.x;
        dst[i + 1] = r[1] + obj.y;
        dst[i + 2] = r[2] + obj.z;
    }
}

function transformWorldToCamera(obj, cam) {
    const m = obj.mesh;
    const src = m.world;
    const dst = m.camera;

    for (let i = 0; i < src.length; i += 3) {
        let x = src[i] - cam.x;
        let y = src[i + 1] - cam.y;
        let z = src[i + 2] - cam.z;

        const r = rotateXYZ(x, y, z, -cam.rx, -cam.ry, -cam.rz);

        dst[i] = r[0];
        dst[i + 1] = r[1];
        dst[i + 2] = r[2];
    }
}

function projectVertices(obj, cam) {
    const m = obj.mesh;
    const src = m.camera;
    const dst = m.screen;

    const f = cam.focal();
    const aspect = W() / H();

    for (let i = 0, j = 0; i < src.length; i += 3, j += 2) {
        const x = src[i];
        const y = src[i + 1];
        const z = src[i + 2];

        const ndcX = (x * f / aspect) / z;
        const ndcY = (y * f) / z;

        dst[j] = (ndcX + 1) * 0.5 * W();
        dst[j + 1] = (1 - ndcY) * 0.5 * H();
    }
}

function triangleOutsideFrustum(cam, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const f = cam.focal();
    const aspect = W() / H();

    if (az < cam.near && bz < cam.near && cz < cam.near) return true;
    if (az > cam.far && bz > cam.far && cz > cam.far) return true;

    const axLimit = az * aspect / f;
    const bxLimit = bz * aspect / f;
    const cxLimit = cz * aspect / f;

    const ayLimit = az / f;
    const byLimit = bz / f;
    const cyLimit = cz / f;

    if (ax < -axLimit && bx < -bxLimit && cx < -cxLimit) return true;
    if (ax >  axLimit && bx >  bxLimit && cx >  cxLimit) return true;

    if (ay < -ayLimit && by < -byLimit && cy < -cyLimit) return true;
    if (ay >  ayLimit && by >  byLimit && cy >  cyLimit) return true;

    return false;
}

function isBackFaceCamera(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;

    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;

    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    // Camera looks down +Z in this file.
    return nz < 0;
}

function buildDrawList() {
    drawList.length = 0;

    for (const obj of objects) {
        const m = obj.mesh;
        const camVerts = m.camera;
        const idx = m.indices;

        for (let i = 0; i < idx.length; i += 3) {
            const ia = idx[i] * 3;
            const ib = idx[i + 1] * 3;
            const ic = idx[i + 2] * 3;

            const ax = camVerts[ia],     ay = camVerts[ia + 1],     az = camVerts[ia + 2];
            const bx = camVerts[ib],     by = camVerts[ib + 1],     bz = camVerts[ib + 2];
            const cx = camVerts[ic],     cy = camVerts[ic + 1],     cz = camVerts[ic + 2];

            if (triangleOutsideFrustum(camera, ax, ay, az, bx, by, bz, cx, cy, cz)) continue;
            if (isBackFaceCamera(ax, ay, az, bx, by, bz, cx, cy, cz)) continue;

            drawList.push({
                obj,
                tri: i,
                z: (az + bz + cz) / 3
            });
        }
    }

    drawList.sort((a, b) => b.z - a.z);
}

function drawTriangle(item) {
    const m = item.obj.mesh;
    const idx = m.indices;
    const scr = m.screen;

    const i = item.tri;

    const a = idx[i] * 2;
    const b = idx[i + 1] * 2;
    const c = idx[i + 2] * 2;

    ctx.beginPath();
    ctx.moveTo(scr[a], scr[a + 1]);
    ctx.lineTo(scr[b], scr[b + 1]);
    ctx.lineTo(scr[c], scr[c + 1]);
    ctx.closePath();

    ctx.fillStyle = "rgba(200,200,200,0.8)";
    ctx.fill();

    ctx.strokeStyle = "black";
    ctx.stroke();
}

function render() {
    ctx.clearRect(0, 0, W(), H());

    for (const obj of objects) {
        transformObjectToWorld(obj);
        transformWorldToCamera(obj, camera);
        projectVertices(obj, camera);
    }

    buildDrawList();

    for (const item of drawList) {
        drawTriangle(item);
    }
}

document.addEventListener("keydown", e => {
    const step = 0.05;

    if (e.key === "a") cube.ry -= step;
    if (e.key === "d") cube.ry += step;
    if (e.key === "w") cube.rx -= step;
    if (e.key === "s") cube.rx += step;
    if (e.key === "q") cube.rz -= step;
    if (e.key === "e") cube.rz += step;
});

function animate() {
    cube.ry += 0.01;
    render();
    requestAnimationFrame(animate);
}

animate();
