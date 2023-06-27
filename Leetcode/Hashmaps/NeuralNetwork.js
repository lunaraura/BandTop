const inputs = [1, 1, 1, 1, 1, 1, 1];
const weights = [
  [1, 2, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 1],
  [1, 1, 1, 1, 1, 1, 1]
];
const biases = [0, 0, 0, 0, 0];

const layerOutput = [];
for (let i = 0; i < weights.length; i++) {
  const neuronWeights = weights[i];
  const neuronBias = biases[i];
  let neuronOutput = 0;

  for (let j = 0; j < inputs.length; j++) {
    const input = inputs[j];
    const weight = neuronWeights[j];
    neuronOutput += input * weight;
    console.log(neuronOutput);
  }
  neuronOutput += neuronBias;
  layerOutput.push(neuronOutput);
}

console.log(layerOutput);

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let output = layerOutput;

function text() {
    ctx.font = "48px serif";
    ctx.fillText(output.toString(), 50, 100);
}
text();
//end of output