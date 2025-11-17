const canvas = document.getElementById("canvas");
const ctx  = canvas.getContext("2d");

//ctx UI
class GUIComponent{
    constructor(x,y,w,h){
        this.contains = [];
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.text = "";
    }
    draw(){
        console.log("drawing")
        ctx.strokeRect(this.x, this.y, this.w, this.h);
        ctx.fillText(this.text, this.x + 5, this.y + 15);
        for (const comp of this.contains){
            comp.draw();
        }
    }
}
class Frame extends GUIComponent{
    constructor(x,y,w,h){
        super(x,y,w,h);
    }
}
class Label extends GUIComponent{
    constructor(x,y,w,h,text){
        super(x,y,w,h);
        this.text = text;
    }
}
class Button extends GUIComponent{
    constructor(x,y,w,h,text, onClick){
        super(x,y,w,h);
        this.text = text;
        this.onClick = onClick;
    }
    click(){
        this.onClick();
    }
}

//
class GameManager{
    constructor(scenes){
        this.currentStateName = "";
        this.currentState = null;
        this.stateList = []
        this.loadSceneDictionary = scenes;
        this.initialScene();
    }
    initialScene(){
        this.currentStateName = "Main Menu"
        this.currentState = () => {
            const frame = new Frame(50,50,200,300);
            const label = new Label(60,60,180,30,"Welcome to the Game!");
            const button = new Button(60,100,180,30,"Start Game", () => {
                this.currentStateName = "Game";
                this.currentState = this.gameState;
            });
            frame.contains.push(label);
            frame.contains.push(button);
            frame.draw();
        }
    }
}

class World{
    constructor(tickInterval){
        this.tickInterval = tickInterval;
        this.owners = new Owners();
        this.chunkManager = new ChunkManager();
        this.entityManager = new EntityManager();
        this.currentMap = {};
        this.mapList = [];
    }
    run(){
        //ignites inside a GameManager scene
        this.initialize();
        setInterval(() => this.tick(this.tickInterval), this.tickInterval);
    }
    initialize(){
        //load first map
        //load owners
        //load chunkManager
        //load entityManager
    }
    tick(dt){
        //update owner tick
        //update chunkManager tick
        //update entityManager tick
    }
}
