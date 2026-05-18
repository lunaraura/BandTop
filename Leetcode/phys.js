const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const v = (x,y) => { return {x:x,y:y} }

class RigidBody{
    constructor(pos, rot = 0){
        this.pos = v(pos.x, pos.y);
        this.rot = rot;
        this.centerOfMass = v(pos.x, pos.y);
        this.elasticity = 0.4;
        this.mass = 0;
        this.inertia = 0;
        this.vel = v(0,0);
        this.angVel = 0;
        this.mesh = [];
        this.sizeRadius = 0;
        this.skipCalculations = false;
    }
    initialize(pointCloud){
        let totalMass = 0;
        let weightedCenter = v(0,0);
        for (let i = 0; i < pointCloud.length; i++){
            const point = pointCloud[i];
            totalMass += point.mass;
            weightedCenter.x += point.pos.x * point.mass;
            weightedCenter.y += point.pos.y * point.mass;
        }
        const center = v(weightedCenter.x / totalMass, weightedCenter.y / totalMass);
        this.mesh = pointCloud.map(point => ({
            localPos: v(point.pos.x - center.x, point.pos.y - center.y),
            pos: v(this.pos.x, this.pos.y),
            mass: point.mass,
            friction: point.friction,
        }));
        this.mass = totalMass || 1;
        this.inertia = this.mesh.reduce((sum, p) => {
            const r2 = p.localPos.x * p.localPos.x + p.localPos.y * p.localPos.y;
            return sum + p.mass * r2;
        }, 0) || 1;
        this.centerOfMass = v(this.pos.x, this.pos.y);
        this.updateWorldPositions();
        this.sizeRadius = Math.max(...this.mesh.map(p => Math.sqrt(p.localPos.x * p.localPos.x + p.localPos.y * p.localPos.y)));
    }
    calculateCenterOfMass(){
        return v(this.pos.x, this.pos.y);
    }
    checkResolveGroundedStatic(){
        if (this.pos.y < canvas.height - this.sizeRadius) {
            this.skipCalculations = false;
            return;
        }
        const totalVelocity = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
        if (totalVelocity < 0.01){
            this.vel.x = 0;
            this.vel.y = 0;
            this.angVel = 0;
            this.skipCalculations = true
        } else {
            this.skipCalculations = false;
        }
    }
    localToWorld(local){
        const cos = Math.cos(this.rot);
        const sin = Math.sin(this.rot);
        return {
            x: this.pos.x + local.x * cos - local.y * sin,
            y: this.pos.y + local.x * sin + local.y * cos,
        };
    }
    updateWorldPositions(){
        for (let i = 0; i < this.mesh.length; i++){
            const point = this.mesh[i];
            const world = this.localToWorld(point.localPos);
            point.pos.x = world.x;
            point.pos.y = world.y;
        }
    }
    update(){
        this.checkResolveGroundedStatic();
        if (this.skipCalculations) return;
        this.applyGravity();
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;
        this.rot += this.angVel;
        this.updateWorldPositions();
        this.resolveCollisions();
        this.updateWorldPositions();
        this.centerOfMass = this.calculateCenterOfMass();
    }
    resolveCollisions(){
        for (let i = 0; i < this.mesh.length; i++){
            const point = this.mesh[i];
            const normal = this.getBoundaryNormal(point);
            if (!normal){
                continue;
            }
            const r = {
                x: point.pos.x - this.pos.x,
                y: point.pos.y - this.pos.y,
            };
            const pointVel = {
                x: this.vel.x - this.angVel * r.y,
                y: this.vel.y + this.angVel * r.x,
            };
            const normalVel = pointVel.x * normal.x + pointVel.y * normal.y;
            const tangent = {x: -normal.y, y: normal.x};
            const tangentVel = pointVel.x * tangent.x + pointVel.y * tangent.y;
            const invMass = 1 / this.mass;
            const rn = r.x * normal.y - r.y * normal.x;
            const denomN = invMass + (rn * rn) / this.inertia;
            const jn = -(1 + this.elasticity) * normalVel / denomN;
            const frictionMax = Math.abs(jn) * point.friction;
            const rt = r.x * tangent.y - r.y * tangent.x;
            const denomT = invMass + (rt * rt) / this.inertia;
            let jt = -tangentVel / denomT;
            if (jt > frictionMax) jt = frictionMax;
            if (jt < -frictionMax) jt = -frictionMax;
            const impulse = {
                x: normal.x * jn + tangent.x * jt,
                y: normal.y * jn + tangent.y * jt,
            };
            this.applyImpulse(impulse, r);
            const penetration = this.getPenetrationDepth(point, normal);
            this.pos.x += normal.x * penetration;
            this.pos.y += normal.y * penetration;
        }
    }
    getBoundaryNormal(point){
        if (point.pos.x < 0) return {x: 1, y: 0};
        if (point.pos.x > canvas.width) return {x: -1, y: 0};
        if (point.pos.y < 0) return {x: 0, y: 1};
        if (point.pos.y > canvas.height) return {x: 0, y: -1};
        return null;
    }
    getPenetrationDepth(point, normal){
        if (normal.x === 1) return -point.pos.x;
        if (normal.x === -1) return point.pos.x - canvas.width;
        if (normal.y === 1) return -point.pos.y;
        if (normal.y === -1) return point.pos.y - canvas.height;
        return 0;
    }
    applyImpulse(impulse, r){
        this.vel.x += impulse.x / this.mass;
        this.vel.y += impulse.y / this.mass;
        const torque = r.x * impulse.y - r.y * impulse.x;
        this.angVel += torque / this.inertia;
    }
    applyGravity(){
        this.vel.y += 0.1; // Simple gravity effect
    }
}

const meshDefs = {
    stick: [
        {pos: v(-100,0), mass: 1, friction: 1},
        {pos: v(100,0), mass: 1, friction: 1},
    ],
    triangle: [
        {pos: v(10,10), mass: 1, friction: 1},
        {pos: v(-10,10), mass: 1, friction: 1},
        {pos: v(10,-10), mass: 1, friction: 1},
    ],
    triangleHeavy: [
        {pos: v(10,10), mass: 1, friction: 1},
        {pos: v(-10,10), mass: 10, friction: 1},
        {pos: v(10,-10), mass: 1, friction: 1},
    ]
}

let rigidBodies = [];

function createRigidBody(meshDef, pos, rot = 0){
    const body = new RigidBody(pos, rot);
    body.initialize(meshDef);
    rigidBodies.push(body);
}
function drawRigidBody (body) {
    ctx.beginPath();
    ctx.moveTo(body.mesh[0].pos.x, body.mesh[0].pos.y);
    for (let i = 1; i < body.mesh.length; i++){
        const point = body.mesh[i];
        ctx.lineTo(point.pos.x, point.pos.y);
    }
    ctx.lineTo(body.mesh[0].pos.x, body.mesh[0].pos.y);
    ctx.closePath();
    ctx.stroke();
}


createRigidBody(meshDefs.triangle, v(200,100));
createRigidBody(meshDefs.triangleHeavy, v(200,100));
ctx.lineWidth = 5

function update(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < rigidBodies.length; i++){
        const body = rigidBodies[i];
        body.update();
        drawRigidBody(body);
    }
    requestAnimationFrame(update);
}
update();

// 1. Solve multiple contacts together
// Gather all colliding vertices each frame.
// Compute a combined impulse solution instead of applying one vertex at a time.
// This is the biggest accuracy improvement for real rigid-body behavior.
// Maybe use flags to find contacts at the same time in the step-velocity and then calculate stuff
// 2. Improve boundary contact handling
// Use a proper contact normal and penetration correction per vertex.
// Handle corner contacts by detecting both axes and resolving them together.
// Avoid moving this.pos separately for each vertex; instead compute a single correction from the set of contacts.
// 3. Separate normal and friction impulses correctly
// Keep normal impulse jn and friction impulse jt separate.
// Use friction limits based on |jn| * friction.
// Add static friction behavior:
// if tangential relative velocity is below a threshold, try to zero it
// otherwise apply kinetic friction
// 4. Use proper rigid-body kinematics
// Compute point world velocity from vel and angVel via v_point = v_body + omega × r.
// Update body vel / angVel from impulses only after solving all contacts, not inside per-vertex iteration.
// 5. Fix penetration correction
// After impulse resolution, apply a single consistent position correction.
// For each contact, project out penetration along the normal.
// Blend corrections if multiple contacts exist to avoid nonphysical translation.
// 6. Add continuous collision detection (CCD)
// Raycast vertex motion against boundaries between frames.
// Detect the exact impact time instead of only reacting after overlap.
// This prevents tunneling at high speed.
// 7. Add damping and energy loss
// Apply a small drag factor to vel and angVel.
// This makes motion more realistic and prevents perpetual bouncing.
// 8. Optional: upgrade contact model
// Treat edges instead of only vertices.
// Or approximate a convex hull and use actual contact geometry.
