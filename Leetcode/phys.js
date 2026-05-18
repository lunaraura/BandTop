const canvas = document.getElementById("canvas");
if (!canvas) throw new Error("Missing canvas element with id='canvas'.");

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not get 2D canvas context.");

const v = (x = 0, y = 0) => ({ x, y });

const add = (a, b) => v(a.x + b.x, a.y + b.y);
const sub = (a, b) => v(a.x - b.x, a.y - b.y);
const mul = (a, s) => v(a.x * s, a.y * s);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const lenSq = a => a.x * a.x + a.y * a.y;
const len = a => Math.sqrt(lenSq(a));
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

class RigidBody {
    constructor(pos, rot = 0) {
        this.pos = v(pos.x, pos.y);
        this.prevPos = v(pos.x, pos.y);

        this.rot = rot;
        this.prevRot = rot;

        this.centerOfMass = v(pos.x, pos.y);

        this.mass = 1;
        this.invMass = 1;

        this.inertia = 1;
        this.invInertia = 1;

        this.elasticity = 0.35;
        this.staticFriction = 0.8;
        this.kineticFriction = 0.55;

        this.vel = v(0, 0);
        this.angVel = 0;

        this.gravity = 0.1;
        this.linearDamping = 0.998;
        this.angularDamping = 0.995;

        this.mesh = [];
        this.sizeRadius = 0;

        this.sleeping = false;
        this.sleepSpeed = 0.015;
        this.sleepAngularSpeed = 0.002;
        this.sleepFramesRequired = 40;
        this.sleepCounter = 0;

        this.contactIterations = 8;
        this.positionCorrectionPercent = 0.85;
        this.positionSlop = 0.01;
    }

    initialize(pointCloud) {
        if (!pointCloud.length) {
            throw new Error("RigidBody requires at least one point.");
        }

        let totalMass = 0;
        let weightedCenter = v(0, 0);

        for (const point of pointCloud) {
            const m = point.mass ?? 1;
            totalMass += m;
            weightedCenter.x += point.pos.x * m;
            weightedCenter.y += point.pos.y * m;
        }

        if (totalMass <= 0) totalMass = 1;

        const localCenter = v(
            weightedCenter.x / totalMass,
            weightedCenter.y / totalMass
        );

        this.mesh = pointCloud.map(point => {
            const m = point.mass ?? 1;
            const f = point.friction ?? 1;

            return {
                localPos: v(
                    point.pos.x - localCenter.x,
                    point.pos.y - localCenter.y
                ),
                pos: v(this.pos.x, this.pos.y),
                prevPos: v(this.pos.x, this.pos.y),
                mass: m,
                friction: f
            };
        });

        this.mass = totalMass;
        this.invMass = 1 / this.mass;

        this.inertia = this.mesh.reduce((sum, p) => {
            return sum + p.mass * lenSq(p.localPos);
        }, 0);

        if (this.inertia <= 0) this.inertia = 1;
        this.invInertia = 1 / this.inertia;

        this.centerOfMass = v(this.pos.x, this.pos.y);

        this.sizeRadius = Math.max(
            ...this.mesh.map(p => len(p.localPos))
        );

        this.updateWorldPositions();
        this.savePreviousWorldPositions();
    }

    localToWorld(local) {
        const c = Math.cos(this.rot);
        const s = Math.sin(this.rot);

        return {
            x: this.pos.x + local.x * c - local.y * s,
            y: this.pos.y + local.x * s + local.y * c
        };
    }

    updateWorldPositions() {
        for (const point of this.mesh) {
            const world = this.localToWorld(point.localPos);
            point.pos.x = world.x;
            point.pos.y = world.y;
        }
    }

    savePreviousWorldPositions() {
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
        this.prevRot = this.rot;

        for (const point of this.mesh) {
            point.prevPos.x = point.pos.x;
            point.prevPos.y = point.pos.y;
        }
    }

    getPointVelocity(r) {
        return {
            x: this.vel.x - this.angVel * r.y,
            y: this.vel.y + this.angVel * r.x
        };
    }

    applyImpulse(impulse, r) {
        this.vel.x += impulse.x * this.invMass;
        this.vel.y += impulse.y * this.invMass;
        this.angVel += cross(r, impulse) * this.invInertia;
    }

    applyGravity() {
        this.vel.y += this.gravity;
    }

    applyDamping() {
        this.vel.x *= this.linearDamping;
        this.vel.y *= this.linearDamping;
        this.angVel *= this.angularDamping;
    }

    wake() {
        this.sleeping = false;
        this.sleepCounter = 0;
    }

    updateSleepState(contacts) {
        const speed = len(this.vel);

        const touchingGround = contacts.some(c => c.normal.y < 0);

        if (
            touchingGround &&
            speed < this.sleepSpeed &&
            Math.abs(this.angVel) < this.sleepAngularSpeed
        ) {
            this.sleepCounter++;

            if (this.sleepCounter >= this.sleepFramesRequired) {
                this.vel.x = 0;
                this.vel.y = 0;
                this.angVel = 0;
                this.sleeping = true;
            }
        } else {
            this.sleepCounter = 0;
            this.sleeping = false;
        }
    }

    integrateVelocity() {
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.rot += this.angVel;
    }

    update() {
        this.savePreviousWorldPositions();

        if (!this.sleeping) {
            this.applyGravity();
            this.applyDamping();
            this.integrateVelocity();
            this.updateWorldPositions();
        }

        this.applyBasicCCD();
        this.updateWorldPositions();

        const contacts = this.gatherContacts();

        if (contacts.length > 0) {
            this.wake();
            this.solveContacts(contacts);
            this.correctPosition(contacts);
            this.updateWorldPositions();

            const postCorrectionContacts = this.gatherContacts();
            this.updateSleepState(postCorrectionContacts);
        }

        this.centerOfMass = v(this.pos.x, this.pos.y);
    }

    gatherContacts() {
        const contacts = [];

        for (const point of this.mesh) {
            if (point.pos.x < 0) {
                contacts.push({
                    point,
                    normal: v(1, 0),
                    penetration: -point.pos.x
                });
            }

            if (point.pos.x > canvas.width) {
                contacts.push({
                    point,
                    normal: v(-1, 0),
                    penetration: point.pos.x - canvas.width
                });
            }

            if (point.pos.y < 0) {
                contacts.push({
                    point,
                    normal: v(0, 1),
                    penetration: -point.pos.y
                });
            }

            if (point.pos.y > canvas.height) {
                contacts.push({
                    point,
                    normal: v(0, -1),
                    penetration: point.pos.y - canvas.height
                });
            }
        }

        return contacts;
    }

    solveContacts(contacts) {
        for (let iter = 0; iter < this.contactIterations; iter++) {
            for (const contact of contacts) {
                const point = contact.point;
                const normal = contact.normal;

                const r = sub(point.pos, this.pos);
                const pointVel = this.getPointVelocity(r);

                const normalVel = dot(pointVel, normal);

                if (normalVel > 0) continue;

                const rn = cross(r, normal);
                const denomN = this.invMass + rn * rn * this.invInertia;

                if (denomN <= 0) continue;

                const jn = -(1 + this.elasticity) * normalVel / denomN;

                const tangent = v(-normal.y, normal.x);
                const tangentVel = dot(pointVel, tangent);

                const rt = cross(r, tangent);
                const denomT = this.invMass + rt * rt * this.invInertia;

                let jt = 0;

                if (denomT > 0) {
                    const desiredStaticImpulse = -tangentVel / denomT;
                    const staticLimit = Math.abs(jn) * this.staticFriction * point.friction;

                    if (Math.abs(desiredStaticImpulse) <= staticLimit) {
                        jt = desiredStaticImpulse;
                    } else {
                        const kineticLimit = Math.abs(jn) * this.kineticFriction * point.friction;
                        jt = clamp(desiredStaticImpulse, -kineticLimit, kineticLimit);
                    }
                }

                const impulse = add(
                    mul(normal, jn),
                    mul(tangent, jt)
                );

                this.applyImpulse(impulse, r);

                this.updateWorldPositions();
            }
        }
    }

    correctPosition(contacts) {
        let correction = v(0, 0);
        let count = 0;

        for (const contact of contacts) {
            const depth = Math.max(contact.penetration - this.positionSlop, 0);

            if (depth <= 0) continue;

            correction.x += contact.normal.x * depth;
            correction.y += contact.normal.y * depth;
            count++;
        }

        if (count === 0) return;

        correction.x = correction.x / count * this.positionCorrectionPercent;
        correction.y = correction.y / count * this.positionCorrectionPercent;

        this.pos.x += correction.x;
        this.pos.y += correction.y;
    }

    applyBasicCCD() {
        let earliestT = 1;
        let hitNormal = null;

        for (const point of this.mesh) {
            const from = point.prevPos;
            const to = point.pos;
            const motion = sub(to, from);

            if (motion.x < 0) {
                const t = (0 - from.x) / motion.x;
                if (t >= 0 && t < earliestT) {
                    earliestT = t;
                    hitNormal = v(1, 0);
                }
            }

            if (motion.x > 0) {
                const t = (canvas.width - from.x) / motion.x;
                if (t >= 0 && t < earliestT) {
                    earliestT = t;
                    hitNormal = v(-1, 0);
                }
            }

            if (motion.y < 0) {
                const t = (0 - from.y) / motion.y;
                if (t >= 0 && t < earliestT) {
                    earliestT = t;
                    hitNormal = v(0, 1);
                }
            }

            if (motion.y > 0) {
                const t = (canvas.height - from.y) / motion.y;
                if (t >= 0 && t < earliestT) {
                    earliestT = t;
                    hitNormal = v(0, -1);
                }
            }
        }

        if (!hitNormal || earliestT >= 1) return;

        this.pos.x = this.prevPos.x + (this.pos.x - this.prevPos.x) * earliestT;
        this.pos.y = this.prevPos.y + (this.pos.y - this.prevPos.y) * earliestT;
        this.rot = this.prevRot + (this.rot - this.prevRot) * earliestT;

        const vn = dot(this.vel, hitNormal);

        if (vn < 0) {
            this.vel.x -= (1 + this.elasticity) * vn * hitNormal.x;
            this.vel.y -= (1 + this.elasticity) * vn * hitNormal.y;
        }
    }
}

const meshDefs = {
    stick: [
        { pos: v(-100, 0), mass: 1, friction: 1 },
        { pos: v(100, 0), mass: 1, friction: 1 }
    ],

    triangle: [
        { pos: v(10, 10), mass: 1, friction: 1 },
        { pos: v(-10, 10), mass: 1, friction: 1 },
        { pos: v(10, -10), mass: 1, friction: 1 }
    ],

    triangleHeavy: [
        { pos: v(10, 10), mass: 1, friction: 1 },
        { pos: v(-10, 10), mass: 10, friction: 1 },
        { pos: v(10, -10), mass: 1, friction: 1 }
    ]
};

const rigidBodies = [];

function createRigidBody(meshDef, pos, rot = 0) {
    const body = new RigidBody(pos, rot);
    body.initialize(meshDef);
    rigidBodies.push(body);
    return body;
}

function drawRigidBody(body) {
    if (body.mesh.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(body.mesh[0].pos.x, body.mesh[0].pos.y);

    for (let i = 1; i < body.mesh.length; i++) {
        const point = body.mesh[i];
        ctx.lineTo(point.pos.x, point.pos.y);
    }

    if (body.mesh.length > 2) {
        ctx.closePath();
    }

    ctx.stroke();

    ctx.beginPath();
    ctx.arc(body.pos.x, body.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
}

createRigidBody(meshDefs.triangle, v(180, 100), 0.3);
createRigidBody(meshDefs.triangleHeavy, v(240, 100), -0.5);

ctx.lineWidth = 3;

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const body of rigidBodies) {
        body.update();
        drawRigidBody(body);
    }

    requestAnimationFrame(update);
}

update();
