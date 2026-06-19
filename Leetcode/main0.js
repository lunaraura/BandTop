// ===== Camera: casts analytic rays in 1D/2D/3D screen configurations =====
// The object is ALWAYS rotated in full 4D, then perspective-divided w->3D->2D
// down to a projected 3D shape. `configuration` only changes how rays fan out
// on screen (1 axis, 2 axes, or full 2D screen + depth).

class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.pos = v(0, 0, -5, 0);
        this.rot = v(0, 0, 0, 0); // camera's own look rotation (yaw/pitch), not object rotation
        this.configuration = "3D"; // "1D" | "2D" | "3D"
        this.maxCloudPoints = 200;
        this.fov = 90;
        this.aspect = canvas.width / canvas.height;
        this.near = 0.1;
        this.far = 100;
        this.f = 1 / Math.tan(this.fov * 0.5 * Math.PI / 180);
        this.wTolerance = 2;
    }

    // ---- Step 1: project the object's 4D world vertices down to camera-space 3D ----
    // Perspective divide by w first (4D->3D), then later by z (3D->2D) happens per-ray-test.
    projectTo3D(worldVertices) {
        const out = {};

        for (const id in worldVertices) {
            const p = worldVertices[id];

            out[id] = {
                pos: v(p.x, p.y, p.z, 0),
                w: p.w
            };
        }

        return out;
    }
    // Camera-space transform: subtract camera pos, apply camera look rotation (yaw/pitch around x/y)
    toCameraSpace(p) {
        let rel = vSub(p, this.pos);

        rel = rotatePlane(rel, 'x', 'z', -this.rot.y);
        rel = rotatePlane(rel, 'y', 'z', -this.rot.x);

        return rel;
    }

    // ---- Ray generation ----
    // Returns an array of { origin, dir, screenX, screenY } rays depending on configuration.
    generateRays(resX, resY) {
        const rays = [];
        const tanHalfFov = Math.tan(this.fov * 0.5 * Math.PI / 180);

        if (this.configuration === "1D") {
            // Single scanline of rays varying only in screen-x, fixed screen-y = 0
            for (let i = 0; i < resX; i++) {
                const ndcX = (2 * (i + 0.5) / resX - 1) * tanHalfFov * this.aspect;
                const dir = vNorm(v(ndcX, 0, 1, 0));
                rays.push({ origin: v(0, 0, 0, 0), dir, screenX: i, screenY: 0 });
            }
        } else if (this.configuration === "2D") {
            // Rays fan over screen-x AND screen-y, but all at a fixed depth plane (orthographic-ish 2D fan)
            // True 2D raycasting: origin is camera pos, dir varies only in x/y plane (z component flattened)
            for (let i = 0; i < resX; i++) {
                const ndcX = (2 * (i + 0.5) / resX - 1) * tanHalfFov * this.aspect;
                const dir = vNorm(v(ndcX, 0, 1, 0)); // z is the "forward" axis of the 2D plane (x,z)
                rays.push({ origin: v(0, 0, 0, 0), dir, screenX: i, screenY: 0 });
            }
        } else { // "3D"
            for (let j = 0; j < resY; j++) {
                for (let i = 0; i < resX; i++) {
                    const ndcX = (2 * (i + 0.5) / resX - 1) * tanHalfFov * this.aspect;
                    const ndcY = (1 - 2 * (j + 0.5) / resY) * tanHalfFov;
                    const dir = vNorm(v(ndcX, ndcY, 1, 0));
                    rays.push({ origin: v(0, 0, 0, 0), dir, screenX: i, screenY: j });
                }
            }
        }
        return rays;
    }

    // ---- Ray vs segment (used for 1D point-crossing tests and 2D edge tests) ----
    // Ray: origin + t*dir (t>=0). Segment in the XZ plane (2D raycasting plane): a -> b.
    // Returns smallest valid t, or null.
    static rayVsSegment2D(origin, dir, a, b) {
        // Work in (x,z) plane
        const ox = origin.x, oz = origin.z;
        const dx = dir.x, dz = dir.z;
        const ax = a.x, az = a.z;
        const bx = b.x, bz = b.z;
        const sx = bx - ax, sz = bz - az;

        const denom = dx * sz - dz * sx;
        if (Math.abs(denom) < 1e-12) return null; // parallel

        const t = ((ax - ox) * sz - (az - oz) * sx) / denom;
        const u = ((ax - ox) * dz - (az - oz) * dx) / denom;

        if (t >= 0 && u >= 0 && u <= 1) return t;
        return null;
    }

    // ---- Ray vs triangle (Möller–Trumbore) ----
    static rayVsTriangle(origin, dir, p0, p1, p2) {
        const e1 = vSub(p1, p0);
        const e2 = vSub(p2, p0);
        const h = vCross3(dir, e2);
        const a = vDot(e1, h);
        if (Math.abs(a) < 1e-12) return null; // parallel

        const f = 1 / a;
        const s = vSub(origin, p0);
        const u = f * vDot(s, h);
        if (u < 0 || u > 1) return null;

        const q = vCross3(s, e1);
        const w = f * vDot(dir, q);
        if (w < 0 || u + w > 1) return null;

        const t = f * vDot(e2, q);
        return t > 1e-9 ? t : null;
    }

    // ---- Main entry point: cast all rays for current configuration against an object ----
    // object: RigidObject. Returns array of hit results aligned with generateRays() order.
    raycast(object, resX, resY = 1) {
        const worldVerts = object.getWorldVertices();
        const projected = this.projectTo3D(worldVerts); // 4D -> 3D (w divided out)

        // transform into camera space
        const camVerts = {};

        for (const id in projected) {
            camVerts[id] = {
                pos: this.toCameraSpace(projected[id].pos),
                w: projected[id].w
            };
        }
        const rays = this.generateRays(resX, resY);
        const hits = [];

        if (this.configuration === "3D") {
            const tris = object.getTriangles();
            for (const ray of rays) {
                let closestT = Infinity;
                let hitTri = null;
                let closestW = 0;
                for (const [i0, i1, i2] of tris) {
                const p0 = camVerts[i0];
                const p1 = camVerts[i1];
                const p2 = camVerts[i2];
                if (!p0 || !p1 || !p2) continue;
                const t = Camera.rayVsTriangle(
                    ray.origin,
                    ray.dir,
                    p0.pos,
                    p1.pos,
                    p2.pos
                );

                if (t !== null && t < closestT) {
                    closestT = t;
                    hitTri = [i0, i1, i2];

                    closestW =
                        (p0.w + p1.w + p2.w) / 3;
                }
                }
                hits.push(
                    hitTri
                        ? {
                            screenX: ray.screenX,
                            screenY: ray.screenY,
                            t: closestT,
                            w: closestW,
                            tri: hitTri
                        }
                        : null);
            }
        } else {
            // 1D and 2D both raycast against edges in the XZ plane
            const edges = object.getEdges();
            for (const ray of rays) {
                let closestT = Infinity;
                let hitEdge = null;
                let closestW = 0;
                for (const [i0, i1] of edges) {
                    const p0 = camVerts[i0];
                    const p1 = camVerts[i1];

                    const t = Camera.rayVsSegment2D(
                        ray.origin,
                        ray.dir,
                        p0.pos,
                        p1.pos
                    );

                    if (t !== null && t < closestT) {
                        closestT = t;
                        hitEdge = [i0, i1];

                        closestW =
                            (p0.w + p1.w) / 2;
                    }
                }
                hits.push(
                    hitEdge
                        ? {
                            screenX: ray.screenX,
                            screenY: ray.screenY,
                            t: closestT,
                            w: closestW,
                            edge: hitEdge
                        }
                        : null
                ); 
            }
        }

        return hits;
    }
}

if (typeof module !== 'undefined') {
    module.exports = { Camera };
}
// ===== Geometry: vertex maps + derived edges/faces =====
// Each shape is defined purely by its vertices (coords in {-1,1}).
// Edges and faces are DERIVED programmatically so this generalizes to any dimension.

const squareMap = {
    0: v(-1, -1, -1, -1), 1: v(1, -1, -1, -1), 2: v(1, 1, -1, -1), 3: v(-1, 1, -1, -1),
    4: v(-1, -1, 1, -1), 5: v(1, -1, 1, -1), 6: v(1, 1, 1, -1), 7: v(-1, 1, 1, -1),
    8: v(-1, -1, 1, 1), 9: v(1, -1, 1, 1), 10: v(1, 1, 1, 1), 11: v(-1, 1, 1, 1),
    12: v(-1, -1, -1, 1), 13: v(1, -1, -1, 1), 14: v(1, 1, -1, 1), 15: v(-1, 1, -1, 1),
};

// Active axes per configuration: 1D uses x, 2D uses x/y, 3D uses x/y/z, 4D uses x/y/z/w
const AXES = { "1D": ['x'], "2D": ['x', 'y'], "3D": ['x', 'y', 'z'], "4D": ['x', 'y', 'z', 'w'] };

function coordsOf(p, axes) { return axes.map(ax => p[ax]); }

// Two vertices are connected by an edge iff they differ in exactly one active axis.
function deriveEdges(vertexMap, axes) {
    const ids = Object.keys(vertexMap).map(Number);
    const seen = new Set();
    const edges = [];
    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = coordsOf(vertexMap[ids[i]], axes);
            const b = coordsOf(vertexMap[ids[j]], axes);
            let diffCount = 0;
            for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - b[k]) > 1e-9) diffCount++;
            if (diffCount === 1) {
                const key = `${ids[i]}-${ids[j]}`;
                if (!seen.has(key)) { seen.add(key); edges.push([ids[i], ids[j]]); }
            }
        }
    }
    return edges;
}

// A quad face: 4 vertices that agree on all-but-2 active axes, and those 2 axes
// take all 4 combinations of {-1,1}. We find them by grouping on the "fixed" axes.
function deriveFaces(vertexMap, axes) {
    if (axes.length < 3) return []; // faces only meaningful in 3D+
    const ids = Object.keys(vertexMap).map(Number);
    const faces = [];
    const n = axes.length;

    // choose every pair of "free" axes; remaining axes are "fixed"
    for (let f1 = 0; f1 < n; f1++) {
        for (let f2 = f1 + 1; f2 < n; f2++) {
            const fixedAxes = axes.filter((_, idx) => idx !== f1 && idx !== f2);
            // group vertices by their fixed-axis signature
            const groups = new Map();
            for (const id of ids) {
                const p = vertexMap[id];
                const sig = fixedAxes.map(ax => p[ax].toFixed(3)).join(',');
                if (!groups.has(sig)) groups.set(sig, []);
                groups.get(sig).push(id);
            }
            for (const group of groups.values()) {
                if (group.length !== 4) continue;
                // order the 4 vertices into a proper quad loop (CCW-ish) via angle around centroid
                const pts = group.map(id => ({ id, p: vertexMap[id] }));
                const cx = pts.reduce((s, o) => s + o.p[axes[f1]], 0) / 4;
                const cy = pts.reduce((s, o) => s + o.p[axes[f2]], 0) / 4;
                pts.sort((a, b) => {
                    const angA = Math.atan2(a.p[axes[f2]] - cy, a.p[axes[f1]] - cx);
                    const angB = Math.atan2(b.p[axes[f2]] - cy, b.p[axes[f1]] - cx);
                    return angA - angB;
                });
                faces.push(pts.map(o => o.id));
            }
        }
    }
    return faces;
}

// Triangulate a quad face (fan triangulation: [0,1,2] and [0,2,3])
function triangulateFace(face) {
    const tris = [];
    for (let i = 1; i + 1 < face.length; i++) {
        tris.push([face[0], face[i], face[i + 1]]);
    }
    return tris;
}

class RigidObject {
    constructor(vertexMap = squareMap) {
        this.pos = v(0, 0, 0, 0);
        this.rot = { xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0 };
        this.scale = v(1, 1, 1, 1);
        this.vertexMap = vertexMap;

        // Pre-derive topology at full 4D resolution; consumers slice down as needed per config.
        this._edges4D = deriveEdges(vertexMap, AXES["4D"]);
        this._faces4D = deriveFaces(vertexMap, AXES["4D"]);
    }

    // Returns world-space (rotated/scaled/translated) vertex map, still 4D.
    getWorldVertices() {
        const out = {};
        for (const id in this.vertexMap) {
            let p = this.vertexMap[id];
            p = v(p.x * this.scale.x, p.y * this.scale.y, p.z * this.scale.z, p.w * this.scale.w);
            p = rotate4D(p, this.rot);
            p = vAdd(p, this.pos);
            out[id] = p;
        }
        return out;
    }

    getEdges() { return this._edges4D; }
    getFaces() { return this._faces4D; }
    getTriangles() { return this._faces4D.flatMap(triangulateFace); }
}

if (typeof module !== 'undefined') {
    module.exports = { squareMap, AXES, deriveEdges, deriveFaces, triangulateFace, RigidObject };
}
// ===== Vector utilities (4D-capable, degrade gracefully to 3D/2D/1D) =====

const v = (x = 0, y = 0, z = 0, w = 0) => ({ x, y, z, w });

const vAdd = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
const vSub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w);
const vScale = (a, s) => v(a.x * s, a.y * s, a.z * s, a.w * s);
const vDot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
const vLen = (a) => Math.sqrt(vDot(a, a));
const vNorm = (a) => {
    const l = vLen(a);
    return l > 1e-12 ? vScale(a, 1 / l) : v(0, 0, 0, 0);
};
const vCross3 = (a, b) => v(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
    0
);
const vClone = (a) => v(a.x, a.y, a.z, a.w);
const vEquals = (a, b, eps = 1e-9) =>
    Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps &&
    Math.abs(a.z - b.z) < eps && Math.abs(a.w - b.w) < eps;

// 4D rotation: rotates in a single plane defined by two axis names ('x','y','z','w')
// Works for 3D rotation too (e.g. rotatePlane(p, 'x', 'z', angle) is a standard yaw)
function rotatePlane(p, axisA, axisB, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const out = vClone(p);
    const a = p[axisA], b = p[axisB];
    out[axisA] = a * c - b * s;
    out[axisB] = a * s + b * c;
    return out;
}

// Apply all 6 rotation planes in sequence. `rot` = {xy,xz,xw,yz,yw,zw} angles in radians.
function rotate4D(p, rot) {
    let out = p;
    if (rot.xy) out = rotatePlane(out, 'x', 'y', rot.xy);
    if (rot.xz) out = rotatePlane(out, 'x', 'z', rot.xz);
    if (rot.xw) out = rotatePlane(out, 'x', 'w', rot.xw);
    if (rot.yz) out = rotatePlane(out, 'y', 'z', rot.yz);
    if (rot.yw) out = rotatePlane(out, 'y', 'w', rot.yw);
    if (rot.zw) out = rotatePlane(out, 'z', 'w', rot.zw);
    return out;
}

if (typeof module !== 'undefined') {
    module.exports = { v, vAdd, vSub, vScale, vDot, vLen, vNorm, vCross3, vClone, vEquals, rotatePlane, rotate4D };
}
// ===== Renderer: draws raycast hits to the 2D canvas context =====

function renderHits(    ctx,
    canvas,
    hits,
    configuration,
    resX,
    resY,
    cameraW,
    wTolerance) {
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (configuration === "3D") {
        const cellW = canvas.width / resX;
        const cellH = canvas.height / resY;
        let maxT = 1;
        for (const h of hits) if (h && h.t < Infinity) maxT = Math.max(maxT, h.t);
const wDiff = h.w - cameraW;
        for (const h of hits) {
            
            if (!h) continue;
            const safeTolerance = Math.max(wTolerance, 0.0001);

            const wDiff = h.w - cameraW;

            // direction: -1 = red side, +1 = blue side
            const wDir = Math.sign(wDiff);

            // strength based on distance
            const wStrength = Math.max(0, 1 - Math.abs(wDiff) / safeTolerance);

            // base depth shading
            const depthShade = Math.max(0, 1 - h.t / maxT);

            // combine
            const shade = depthShade * wStrength;

            // grayscale base
            const base = 60 + shade * 195;

            // color tint
            const red   = base * (wDir < 0 ? 1 : 0.3);
            const green = base * 1.0;
            const blue  = base * (wDir > 0 ? 1 : 0.3);

            ctx.fillStyle = `rgb(${red|0}, ${green|0}, ${blue|0})`;
        }
    } else {
        // 1D and 2D: draw as a horizontal strip of hit/miss + depth shading
        const cellW = canvas.width / resX;
        const stripH = configuration === "1D" ? canvas.height : canvas.height * 0.5;
        const stripY = configuration === "1D" ? 0 : canvas.height * 0.25;

        let maxT = 1;
        for (const h of hits) if (h && h.t < Infinity) maxT = Math.max(maxT, h.t);

        for (let i = 0; i < hits.length; i++) {
            const h = hits[i];
            if (!h) continue;

            const safeTolerance = Math.max(wTolerance, 0.0001);

            const wDelta = Math.abs(h.w - cameraW);

            const wShade = Math.max(
                0,
                1 - wDelta / safeTolerance
            );

            const depthShade = Math.max(
                0,
                1 - h.t / maxT
            );

            const shade = depthShade * wShade;

            const g = Math.floor(60 + shade * 195);

            ctx.fillStyle =
                `rgb(${Math.floor(g * 0.3)}, ${g}, ${Math.floor(g * 0.85)})`;

            ctx.fillRect(
                i * cellW,
                stripY,
                cellW + 1,
                stripH
            );
        }

        ctx.strokeStyle = '#2a3340';
        ctx.strokeRect(0, stripY, canvas.width, stripH);
    }
}

if (typeof module !== 'undefined') {
    module.exports = { renderHits };
}
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cam = new Camera(canvas);
cam.configuration = "3D";

const cubeMap = {};
for (let i = 0; i < 8; i++) cubeMap[i] = squareMap[i];

let object = new RigidObject(squareMap); // default: tesseract
let shapeName = 'tesseract';

const statsEl = document.getElementById('stats');
let autoSpin = false;

function rebuildObject() {
    object = new RigidObject(shapeName === 'cube' ? cubeMap : squareMap);
    object.rot.xy = deg(document.getElementById('rotXY').value);
    object.rot.xz = deg(document.getElementById('rotXZ').value);
    object.rot.xw = deg(document.getElementById('rotXW').value);
    object.rot.yw = deg(document.getElementById('rotYW').value);
    object.rot.zw = deg(document.getElementById('rotZW').value);
}
function deg(d) { return Number(d) * Math.PI / 180; }

function draw() {
    object.rot.xy = deg(document.getElementById('rotXY').value);
    object.rot.xz = deg(document.getElementById('rotXZ').value);
    object.rot.xw = deg(document.getElementById('rotXW').value);
    object.rot.yw = deg(document.getElementById('rotYW').value);
    object.rot.zw = deg(document.getElementById('rotZW').value);
    

    cam.pos = v(0,0,-Number(document.getElementById('camZ').value), Number(document.getElementById('camW').value))
    cam.wTolerance =
        Number(document.getElementById('wTolerance').value);
    const res = Number(document.getElementById('resSlider').value);
    const resX = res;
    const resY = cam.configuration === "3D" ? res : 1;

    const t0 = performance.now();
    const hits = cam.raycast(object, resX, resY);
    const t1 = performance.now();
    renderHits(
        ctx,
        canvas,
        hits,
        cam.configuration,
        resX,
        resY,
        cam.pos.w,
        cam.wTolerance
    );
    const hitCount = hits.filter(h => h).length;
    statsEl.textContent =
`config:    ${cam.configuration}
shape:     ${shapeName}
rays:      ${hits.length} (${resX}x${resY})
hits:      ${hitCount}
edges:     ${object.getEdges().length}
faces:     ${object.getFaces().length}
tris:      ${object.getTriangles().length}
cast time: ${(t1 - t0).toFixed(2)}ms`;
}

document.querySelectorAll('button.cfg[data-cfg]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('button.cfg[data-cfg]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        cam.configuration = btn.dataset.cfg;
        draw();
    });
});

document.getElementById('shapeSelect').addEventListener('change', (e) => {
    shapeName = e.target.value;
    rebuildObject();
    draw();
});

['rotXY','rotXZ','rotXW','rotYW','rotZW','camZ','camW', 'wDistance','resSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        const labelMap = { rotXY:'vXY', rotXZ:'vXZ', rotXW:'vXW', rotYW:'vYW', rotZW:'vZW', camZ:'vZ', camW:'vW', wDistance:'vWD', resSlider:'vRes' };
        const lbl = document.getElementById(labelMap[id]);
        const suffix = id.startsWith('rot') ? '°' : '';
        lbl.textContent = document.getElementById(id).value + suffix;
        draw();
    });
});

document.getElementById('autoXW').addEventListener('click', () => { autoSpin = true; });
document.getElementById('autoStop').addEventListener('click', () => { autoSpin = false; });

function loop() {
    if (autoSpin) {
        const slider = document.getElementById('rotXW');
        let val = (Number(slider.value) + 1) % 360;
        slider.value = val;
        document.getElementById('vXW').textContent = val + '°';
        draw();
    }
    requestAnimationFrame(loop);
}

rebuildObject();
draw();
loop();
