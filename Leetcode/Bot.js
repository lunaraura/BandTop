
class Bot{
    constructor(){
        this.attachedEntity = null;
        this.focusedEntity = null;
        this.observedEntitites = []
        this.requestedPosition = {x:0, y:0}
        //fight or flight scores, range from -1 to 1:
        this.totalFightFlight = 0;
        this.selfHealth = 0;
        this.enPressures = [];
        this.tePressures = [];
        botList.push(this)
    }
    initialize(entity){
        this.attachedEntity = entity;
        this.attachedEntity.hasBot = true;
    }
    observe(){
        for (let entity of entityList){
            if (!this.observedEntitites.includes(entity)){
                this.observedEntitites.push(entity)
            }
        }
    }
    weighSelf(){
        //weigh health, then whichever abilities are dmg and movement
        this.selfHealth = this.attachedEntity.HP / this.attachedEntity.maxHP;
        this.totalFightFlight = (this.selfHealth - 0.5) * 2; //scale to -1 to 1
        //add ability weights later
    }
    entitiesInRange(){
        //any that arent in same team, log their health.
        //then log their distance and then angle (or vector whichever is better)
        //used to decide if there are too many enemies or if
        //the entity can take them.
        const t = this.attachedEntity.team;
        let teamBackup = []
        let enemyPressure = [];
        for (let entity of this.observedEntitites){
            if (entity.team !== t){
                let pressure = {
                    health: entity.HP / entity.maxHP,
                    distance: Math.hypot(entity.x - this.attachedEntity.x, entity.y - this.attachedEntity.y),
                    angle: Math.atan2(entity.y - this.attachedEntity.y, entity.x - this.attachedEntity.x)
                }
                enemyPressure.push(pressure)
            }
        }
        for (let entity of this.observedEntitites){
            if (entity.team === t && entity !== this.attachedEntity){
                let pressure = {
                    health: entity.HP / entity.maxHP,
                    size : entity.size,
                    distance: Math.hypot(entity.x - this.attachedEntity.x, entity.y - this.attachedEntity.y),
                    angle: Math.atan2(entity.y - this.attachedEntity.y, entity.x - this.attachedEntity.x)
                }
                teamBackup.push(pressure)
            }
        }
        this.enPressures = enemyPressure;
        this.tePressures = teamBackup;
    }
    gatherBestSpots(){
        const personalSpace = this.attachedEntity.size;
        const safeRange = this.attachedEntity.size * 2
        let potentialPositions = []
        //might wanna add distance conditions so entities dont clump together
        if (this.tePressures.length === 0){
            //if more healthy, go towards enemies
            for (let enemy of this.enPressures){
                if (this.selfHealth > 0.5){
                    //go towards enemy
                    if (enemy.distance < safeRange + enemy.size/2) {
                        enemy.angle *= -1;
                    }; //dont get too close
                    let pos = {
                        x: this.attachedEntity.x + Math.cos(enemy.angle) * personalSpace,
                        y: this.attachedEntity.y + Math.sin(enemy.angle) * personalSpace
                    }
                    potentialPositions.push(pos)
                } else {
                    //go away from enemy
                    let pos = {
                        x: this.attachedEntity.x - Math.cos(enemy.angle) * personalSpace,
                        y: this.attachedEntity.y - Math.sin(enemy.angle) * personalSpace
                    }
                    potentialPositions.push(pos)
                }
            }            
        } else {
            for (let pressure of this.tePressures){
                for (let enemy of this.enPressures){
                    let angleDiff = Math.abs(pressure.angle - enemy.angle);
                    if (angleDiff < Math.PI / 2){
                        if (pressure.health <= this.selfHealth){
                            //get in front of teammate
                            let pos = {
                                x: this.attachedEntity.x + Math.cos(pressure.angle) * personalSpace,
                                y: this.attachedEntity.y + Math.sin(pressure.angle) * personalSpace
                            }
                            potentialPositions.push(pos)
                        }
                    } else {
                        if (pressure.health >= this.selfHealth){
                            //get behind teammate
                            let pos = {
                                x: this.attachedEntity.x - Math.cos(pressure.angle) * personalSpace,
                                y: this.attachedEntity.y - Math.sin(pressure.angle) * personalSpace
                            }
                            potentialPositions.push(pos)
                        }
                    }
                }
            }
        }
        if (potentialPositions.length > 0){
            let avgX = 0; let avgY = 0;
            for (let pos of potentialPositions){
                avgX += pos.x; avgY += pos.y;
            }
            avgX /= potentialPositions.length;
            avgY /= potentialPositions.length;
            this.requestedPosition = {x: avgX, y: avgY}
        } else {
            this.requestedPosition = {x: this.attachedEntity.x, y: this.attachedEntity.y}
        }
    }
    decideFocus(){
        //decide which entity to focus on based on position and health
        let bestScore = -Infinity;
        for (let entity of this.observedEntitites){
            if (entity === this.attachedEntity) continue;
            let dist = Math.hypot(entity.x - this.attachedEntity.x, entity.y - this.attachedEntity.y);
            let healthScore = (entity.HP / entity.maxHP);
            let positionScore = 1 / (dist + 1); //closer better
            let totalScore = (1 - healthScore) + positionScore; //prefer weaker and closer
            if (totalScore > bestScore){
                bestScore = totalScore;
                this.focusedEntity = entity;
            }
        }
    }
    chooseBestSpotOrFocus(){
        if (this.focusedEntity.health == 0){
            this.requestedPosition = {x: this.focusedEntity.x, y: this.focusedEntity.y}
        } else {
            this.gatherBestSpots();
        }
    }
    requestMelee(){
        if (this.focusedEntity){
            this.attachedEntity.requestMelee(this.focusedEntity)
        }
    }
    rangedAbilityDecide(){
        if (this.focusedEntity){
            let dir = {
                x: this.focusedEntity.x - this.attachedEntity.x,
                y: this.focusedEntity.y - this.attachedEntity.y
            }
            const mag = Math.hypot(dir.x, dir.y) || 1;
            dir.x /= mag; dir.y /= mag;
            this.attachedEntity.requestAbility(dir, null, moves.air_slice)
        }
    }
    urgentMovement(){
        if (this.selfHealth < 0.3){
            let dir = {
                x: this.requestedPosition.x - this.attachedEntity.x,
                y: this.requestedPosition.y - this.attachedEntity.y
            }
            const mag = Math.hypot(dir.x, dir.y) || 1;
            dir.x /= mag; dir.y /= mag;
            // this.attachedEntity.requestAbility(null, dir, moves.dash)
        }
    }
    requestChildToMove(){
        let dir = {
            x: this.requestedPosition.x - this.attachedEntity.x,
            y: this.requestedPosition.y - this.attachedEntity.y
        }
        this.attachedEntity.requestedMove = dir;
    }
    loop(){
        this.observe();
        this.weighSelf();
        this.entitiesInRange();
        this.decideFocus();
        this.chooseBestSpotOrFocus();
        this.rangedAbilityDecide();
        this.urgentMovement();
        this.requestChildToMove();
        this.requestMelee();
        this.observedEntitites = []
    }
}
