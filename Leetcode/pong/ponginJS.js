const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");

canvas.setAttribute("tabindex", "0");
document.body.style.backgroundColor = 'black';

function Paddle(speed, color, x, y, width, length) {
    this.speed = speed;
    this.color = color;
    this.x = x;
    this.y = y;
    this.width = width;
    this.length = length;

    this.draw = function() {
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.length);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
      };

      this.moveUp = function() {
        this.y -= this.speed;
      };
      this.moveDown = function() {
        this.y += this.speed;
      };
}

function Ball(xVector, yVector, color, x, y, width, length, radius) {
    this.color = color;
    this.x = x;
    this.y = y;
    this.width = width;
    this.length = length;
    this.xVector = xVector;
    this.yVector = yVector;
    this.radius = radius
    this.draw = function() {
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.length);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
      };
    
    this.xMove = function() {
        this.x += this.xVector;
    }
    this.yMove = function() {
        this.y += this.yVector;
    }

}


let ball = new Ball(5, 5, "white", 400, 300, 20, 20, 20);
let paddle_a = new Paddle(50, "white", 50, 300, 20, 80);
let paddle_b = new Paddle(50, "white", 750, 300, 20, 80);

canvas.addEventListener("keydown", (event) => {
    if (event.code === "KeyW") {
        paddle_a.moveUp();
    } else if (event.code === "KeyS") {
        paddle_a.moveDown();
    } else if (event.code === "KeyU") {
        paddle_b.moveUp();
    } else if (event.code === "KeyJ") {
        paddle_b.moveDown();
    }
});

function collision() {
    if (ball.y - ball.radius < 0) {
      ball.yVector = -ball.yVector;
    }
  
    if (ball.y + ball.radius > canvas.height) {
      ball.yVector = -ball.yVector;
    }
  
    if (ball.x - ball.radius < 0) {
      ball.x = 300;
      ball.y = 300;
      ball.xVector = -ball.xVector;
    }
  
    if (ball.x + ball.radius > canvas.width) {
      ball.x = 300;
      ball.y = 300;
      ball.xVector = -ball.xVector;
    }
  
    if (
      ball.x - ball.radius <= paddle_a.x + paddle_a.width &&
      ball.y >= paddle_a.y &&
      ball.y <= paddle_a.y + paddle_a.length
    ) {
      ball.xVector = Math.abs(ball.xVector);
    }
  
    if (
      ball.x + ball.radius >= paddle_b.x &&
      ball.y >= paddle_b.y &&
      ball.y <= paddle_b.y + paddle_b.length
    ) {
      ball.xVector = -Math.abs(ball.xVector);
    }
  }

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paddle_a.draw();
    paddle_b.draw();
    ball.draw();
    ball.xMove();
    ball.yMove();
    collision();

    requestAnimationFrame(update);
}
requestAnimationFrame(update);