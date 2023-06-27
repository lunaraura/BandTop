function multiplyAll(arr) {
    let product = 1;
    console.log(arr);
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr[i].length; j++) {
        product *= arr[i][j];
      }
    }
  console.log(product);
    return product;
  }
//Output canvas
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let arr = [[1, 1], [2, 4], [5, 1, 3]];
let output = multiplyAll(arr);

function text() {
  ctx.font = "48px serif";
  ctx.fillText(output.toString(), 50, 100);
}
text();