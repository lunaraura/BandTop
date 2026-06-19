const v = (x = 0, y = 0, z = 0, w = 0) => ({ x, y, z, w });

const vAdd = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
const vSub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w);
const vScale = (a, s) => v(a.x * s, a.y * s, a.z * s, a.w * s);
const vDot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
const vLen = a => Math.sqrt(vDot(a, a));
const vNorm = a => vLen(a) > 1e-12 ? vScale(a, 1 / vLen(a)) : v();
const vClone = a => v(a.x, a.y, a.z, a.w);

const vCross3 = (a, b) => v(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x,
    0
);

function rotatePlane(p, axisA, axisB, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const out = vClone(p);
    const a = p[axisA];
    const b = p[axisB];

    out[axisA] = a * c - b * s;
    out[axisB] = a * s + b * c;

    return out;
}

function rotate4D(p, rot) {
    let out = p;
    if (rot.xy) out = rotatePlane(out, "x", "y", rot.xy);
    if (rot.xz) out = rotatePlane(out, "x", "z", rot.xz);
    if (rot.xw) out = rotatePlane(out, "x", "w", rot.xw);
    if (rot.yz) out = rotatePlane(out, "y", "z", rot.yz);
    if (rot.yw) out = rotatePlane(out, "y", "w", rot.yw);
    if (rot.zw) out = rotatePlane(out, "z", "w", rot.zw);
    return out;
}

const squareMap = {
    0: v(-1, -1, -1, -1), 1: v(1, -1, -1, -1), 2: v(1, 1, -1, -1), 3: v(-1, 1, -1, -1),
    4: v(-1, -1, 1, -1), 5: v(1, -1, 1, -1), 6: v(1, 1, 1, -1), 7: v(-1, 1, 1, -1),
    8: v(-1, -1, 1, 1), 9: v(1, -1, 1, 1), 10: v(1, 1, 1, 1), 11: v(-1, 1, 1, 1),
    12: v(-1, -1, -1, 1), 13: v(1, -1, -1, 1), 14: v(1, 1, -1, 1), 15: v(-1, 1, -1, 1)
};

const AXES = {
    "1D": ["x"],
    "2D": ["x", "y"],
    "3D": ["x", "y", "z"],
    "4D": ["x", "y", "z", "w"]
};

function coordsOf(p, axes) {
    return axes.map(ax => p[ax]);
}

function deriveEdges(vertexMap, axes) {
    const ids = Object.keys(vertexMap).map(Number);
    const edges = [];

    for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
            const a = coordsOf(vertexMap[ids[i]], axes);
            const b = coordsOf(vertexMap[ids[j]], axes);

            let diffCount = 0;
            for (let k = 0; k < a.length; k++) {
                if (Math.abs(a[k] - b[k]) > 1e-9) diffCount++;
            }

            if (diffCount === 1) edges.push([ids[i], ids[j]]);
        }
    }

    return edges;
}

function deriveFaces(vertexMap, axes) {
    if (axes.length < 3) return [];

    const ids = Object.keys(vertexMap).map(Number);
    const faces = [];
    const n = axes.length;

    for (let f1 = 0; f1 < n; f1++) {
        for (let f2 = f1 + 1; f2 < n; f2++) {
            const fixedAxes = axes.filter((_, idx) => idx !== f1 && idx !== f2);
            const groups = new Map();

            for (const id of ids) {
                const p = vertexMap[id];
                const sig = fixedAxes.map(ax => p[ax].toFixed(3)).join(",");

                if (!groups.has(sig)) groups.set(sig, []);
                groups.get(sig).push(id);
            }

            for (const group of groups.values()) {
                if (group.length !== 4) continue;

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

        this._edges4D = deriveEdges(vertexMap, AXES["4D"]);
        this._faces4D = deriveFaces(vertexMap, AXES["4D"]);
    }

    getWorldVertices() {
        const out = {};

        for (const id in this.vertexMap) {
            let p = this.vertexMap[id];

            p = v(
                p.x * this.scale.x,
                p.y * this.scale.y,
                p.z * this.scale.z,
                p.w * this.scale.w
            );

            p = rotate4D(p, this.rot);
            p = vAdd(p, this.pos);
            out[id] = p;
        }

        return out;
    }

    getEdges() {
        return this._edges4D;
    }

    getFaces() {
        return this._faces4D;
    }

    getTriangles() {
        return this._faces4D.flatMap(triangulateFace);
    }
}

class Camera {
    constructor(canvas) {
        this.canvas = canvas;
        this.pos = v(0, 0, -5, 0);
        this.rot = v(0, 0, 0, 0);
        this.configuration = "3D";

        this.fov = 90;
        this.aspect = canvas.width / canvas.height;
        this.near = 0.1;
        this.far = 100;
        this.f = 1 / Math.tan(this.fov * 0.5 * Math.PI / 180);

        this.wDistance = 5;
        this.wTolerance = 2;
        this.wOverlaySteps = 9;
    }

    projectTo3D(worldVertices) {
        const out = {};

        for (const id in worldVertices) {
            const p = worldVertices[id];

            const relW = p.w - this.pos.w;
            const denom = this.wDistance - relW;

            if (Math.abs(denom) < 1e-6) continue;

            const wScale = this.wDistance / denom;

            out[id] = {
                pos: v(
                    p.x * wScale,
                    p.y * wScale,
                    p.z * wScale,
                    0
                ),
                w: p.w
            };
        }

        return out;
    }

    toCameraSpace(p) {
        let rel = vSub(p, this.pos);

        rel = rotatePlane(rel, "x", "z", -this.rot.y);
        rel = rotatePlane(rel, "y", "z", -this.rot.x);

        return rel;
    }

    generateRays(resX, resY) {
        const rays = [];
        const tanHalfFov = Math.tan(this.fov * 0.5 * Math.PI / 180);

        if (this.configuration === "1D" || this.configuration === "2D") {
            for (let i = 0; i < resX; i++) {
                const ndcX = (2 * (i + 0.5) / resX - 1) * tanHalfFov * this.aspect;
                const dir = vNorm(v(ndcX, 0, 1, 0));

                rays.push({
                    origin: v(0, 0, 0, 0),
                    dir,
                    screenX: i,
                    screenY: 0
                });
            }
        } else {
            for (let j = 0; j < resY; j++) {
                for (let i = 0; i < resX; i++) {
                    const ndcX = (2 * (i + 0.5) / resX - 1) * tanHalfFov * this.aspect;
                    const ndcY = (1 - 2 * (j + 0.5) / resY) * tanHalfFov;
                    const dir = vNorm(v(ndcX, ndcY, 1, 0));

                    rays.push({
                        origin: v(0, 0, 0, 0),
                        dir,
                        screenX: i,
                        screenY: j
                    });
                }
            }
        }

        return rays;
    }

    raycastAtW(object, resX, resY, cameraW) {
        const oldW = this.pos.w;
        this.pos.w = cameraW;

        const worldVerts = object.getWorldVertices();
        const projected = this.projectTo3D(worldVerts);

        const camVerts = {};
        for (const id in projected) {
            camVerts[id] = {
                pos: this.toCameraSpace(projected[id].pos),
                w: projected[id].w
            };
        }

        const rays = this.generateRays(resX, resY);
        const hits = this.castAgainstProjected(object, rays, camVerts);

        this.pos.w = oldW;
        return hits;
    }

    raycastOverlay(object, resX, resY = 1) {
        const oldW = this.pos.w;
        const layers = [];

        const steps = Math.max(1, this.wOverlaySteps | 0);
        const maxOffset = Math.max(this.wTolerance, 0.0001);

        for (let i = 0; i < steps; i++) {
            const u = steps === 1 ? 0.5 : i / (steps - 1);
            const offset = (u * 2 - 1) * maxOffset;
            const cameraW = oldW + offset;
            const alpha = 1 - Math.abs(offset) / maxOffset;

            const hits = this.raycastAtW(object, resX, resY, cameraW);

            layers.push({
                offset,
                cameraW,
                alpha,
                hits
            });
        }

        this.pos.w = oldW;
        return layers;
    }

    castAgainstProjected(object, rays, camVerts) {
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

                    const t = Camera.rayVsTriangle(ray.origin, ray.dir, p0.pos, p1.pos, p2.pos);

                    if (t !== null && t < closestT) {
                        closestT = t;
                        hitTri = [i0, i1, i2];
                        closestW = (p0.w + p1.w + p2.w) / 3;
                    }
                }

                hits.push(hitTri ? {
                    screenX: ray.screenX,
                    screenY: ray.screenY,
                    t: closestT,
                    w: closestW,
                    tri: hitTri
                } : null);
            }
        } else {
            const edges = object.getEdges();

            for (const ray of rays) {
                let closestT = Infinity;
                let hitEdge = null;
                let closestW = 0;

                for (const [i0, i1] of edges) {
                    const p0 = camVerts[i0];
                    const p1 = camVerts[i1];

                    if (!p0 || !p1) continue;

                    const t = Camera.rayVsSegment2D(ray.origin, ray.dir, p0.pos, p1.pos);

                    if (t !== null && t < closestT) {
                        closestT = t;
                        hitEdge = [i0, i1];
                        closestW = (p0.w + p1.w) / 2;
                    }
                }

                hits.push(hitEdge ? {
                    screenX: ray.screenX,
                    screenY: ray.screenY,
                    t: closestT,
                    w: closestW,
                    edge: hitEdge
                } : null);
            }
        }

        return hits;
    }

    raycast(object, resX, resY = 1) {
        return this.raycastOverlay(object, resX, resY);
    }

    static rayVsSegment2D(origin, dir, a, b) {
        const ox = origin.x;
        const oz = origin.z;
        const dx = dir.x;
        const dz = dir.z;

        const ax = a.x;
        const az = a.z;
        const bx = b.x;
        const bz = b.z;

        const sx = bx - ax;
        const sz = bz - az;

        const denom = dx * sz - dz * sx;
        if (Math.abs(denom) < 1e-12) return null;

        const t = ((ax - ox) * sz - (az - oz) * sx) / denom;
        const u = ((ax - ox) * dz - (az - oz) * dx) / denom;

        return t >= 0 && u >= 0 && u <= 1 ? t : null;
    }

    static rayVsTriangle(origin, dir, p0, p1, p2) {
        const e1 = vSub(p1, p0);
        const e2 = vSub(p2, p0);
        const h = vCross3(dir, e2);
        const a = vDot(e1, h);

        if (Math.abs(a) < 1e-12) return null;

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
}

function renderOverlayHits(ctx, canvas, layers, configuration, resX, resY) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = "lighter";

    for (const layer of layers) {
        const alpha = Math.max(0, Math.min(1, layer.alpha));
        const wDir = Math.sign(layer.offset);

        let maxT = 1;
        for (const h of layer.hits) {
            if (h && h.t < Infinity) maxT = Math.max(maxT, h.t);
        }

        ctx.globalAlpha = Math.max(0.035, alpha * 0.7);

        if (configuration === "3D") {
            const cellW = canvas.width / resX;
            const cellH = canvas.height / resY;

            for (const h of layer.hits) {
                if (!h) continue;

                const depthShade = Math.max(0, 1 - h.t / maxT);
                const shade = depthShade * Math.max(0.08, alpha);

                const base = 50 + shade * 205;

                const red = base * (wDir < 0 ? 1 : 0.25);
                const green = base * (wDir === 0 ? 1 : 0.55);
                const blue = base * (wDir > 0 ? 1 : 0.25);

                ctx.fillStyle = `rgb(${red | 0}, ${green | 0}, ${blue | 0})`;

                ctx.fillRect(
                    h.screenX * cellW,
                    h.screenY * cellH,
                    cellW + 1,
                    cellH + 1
                );
            }
        } else {
            const cellW = canvas.width / resX;
            const stripH = configuration === "1D" ? canvas.height : canvas.height * 0.5;
            const stripY = configuration === "1D" ? 0 : canvas.height * 0.25;

            for (const h of layer.hits) {
                if (!h) continue;

                const depthShade = Math.max(0, 1 - h.t / maxT);
                const shade = depthShade * Math.max(0.08, alpha);

                const base = 50 + shade * 205;

                const red = base * (wDir < 0 ? 1 : 0.25);
                const green = base * (wDir === 0 ? 1 : 0.55);
                const blue = base * (wDir > 0 ? 1 : 0.25);

                ctx.fillStyle = `rgb(${red | 0}, ${green | 0}, ${blue | 0})`;

                ctx.fillRect(
                    h.screenX * cellW,
                    stripY,
                    cellW + 1,
                    stripH
                );
            }

            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = "#2a3340";
            ctx.strokeRect(0, stripY, canvas.width, stripH);
            ctx.globalCompositeOperation = "lighter";
        }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
}
