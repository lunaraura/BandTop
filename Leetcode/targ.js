function matMult(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
        return [];
    }

    if (!Array.isArray(a[0])) {
        a = [a];
    }
    if (!Array.isArray(b[0])) {
        b = [b];
    }

    const rowsA = a.length;
    const colsA = a[0].length;
    const colsB = b[0].length;

    if (colsA !== b.length) {
        throw new Error('Incompatible matrix dimensions for multiplication');
    }

    return Array.from({ length: rowsA }, (_, rowIndex) =>
        Array.from({ length: colsB }, (_, colIndex) => {
            let total = 0;
            for (let k = 0; k < colsA; k += 1) {
                total += a[rowIndex][k] * b[k][colIndex];
            }
            return total;
        })
    );
}

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const normalizeForNode = (node, value) => {
    const range = node.range || [0, 1];
    const span = range[1] - range[0] || 1;
    return (value - range[0]) / span;
};

const denormalizeForNode = (node, value) => {
    const range = node.range || [0, 1];
    const span = range[1] - range[0] || 1;
    return value * span + range[0];
};

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

class Node {
    constructor(range = [0, 1], bias = 0) {
        this.bias = bias;
        this.range = range;
        this.weight = Math.random() * 2 - 1;
        this.value = 0;
        this.error = 0;
    }
}

class Brain {
    constructor(config = {}) {
        this.config = { ...defaultConfig, ...config };
        this.inputLayer = [];
        this.hiddenLayer = [];
        this.outputLayer = [];
        this.inputWeights = [];
        this.hiddenWeights = [];
        this.inputBiases = [];
        this.hiddenBiases = [];
        this.lastError = 0;
        this.init();
    }

    init() {
        const inputNodes = this.config.inputNodes || 2;
        const hiddenNodes = this.config.hiddenNodes || 2;
        const outputNodes = this.config.outputNodes || 1;

        this.inputLayer = Array.from({ length: inputNodes }, () => new Node(this.config.inputRange || [0, 1]));
        this.hiddenLayer = Array.from({ length: hiddenNodes }, () => new Node([0, 1]));
        this.outputLayer = Array.from({ length: outputNodes }, () => new Node(this.config.outputRange || [0, 1]));

        this.inputWeights = Array.from({ length: hiddenNodes }, () =>
            Array.from({ length: inputNodes }, () => (Math.random() * 2 - 1) * 0.5)
        );
        this.hiddenWeights = Array.from({ length: outputNodes }, () =>
            Array.from({ length: hiddenNodes }, () => (Math.random() * 2 - 1) * 0.5)
        );
        this.inputBiases = Array.from({ length: hiddenNodes }, () => (Math.random() * 2 - 1) * 0.5);
        this.hiddenBiases = Array.from({ length: outputNodes }, () => (Math.random() * 2 - 1) * 0.5);
    }

    feedForward(inputs = []) {
        const normalizedInputs = this.inputLayer.map((node, index) => {
            const value = inputs[index] ?? 0;
            const normalized = normalizeForNode(node, clamp(value, node.range[0], node.range[1]));
            node.value = normalized;
            return normalized;
        });

        this.hiddenLayer.forEach((node, hiddenIndex) => {
            let sum = this.inputBiases[hiddenIndex] || 0;
            normalizedInputs.forEach((inputValue, inputIndex) => {
                sum += inputValue * this.inputWeights[hiddenIndex][inputIndex];
            });
            node.value = sigmoid(sum);
        });

        this.outputLayer.forEach((node, outputIndex) => {
            let sum = this.hiddenBiases[outputIndex] || 0;
            this.hiddenLayer.forEach((hiddenNode, hiddenIndex) => {
                sum += hiddenNode.value * this.hiddenWeights[outputIndex][hiddenIndex];
            });
            node.value = sigmoid(sum);
        });

        return this.outputLayer.map((node) => node.value);
    }

    predict(inputs = []) {
        const rawOutput = this.feedForward(inputs);
        return rawOutput.map((value, index) => denormalizeForNode(this.outputLayer[index], value));
    }

    train(inputs = [], targets = [], iterations = 1) {
        let totalError = 0;

        for (let epoch = 0; epoch < iterations; epoch += 1) {
            this.feedForward(inputs);

            const normalizedTargets = targets.map((target, index) => {
                const node = this.outputLayer[index] || new Node(this.config.outputRange || [0, 1]);
                return normalizeForNode(node, clamp(target, node.range[0], node.range[1]));
            });

            const outputErrors = this.outputLayer.map((node, index) => {
                const error = normalizedTargets[index] - node.value;
                node.error = error * node.value * (1 - node.value);
                return node.error;
            });

            const hiddenErrors = this.hiddenLayer.map((node, hiddenIndex) => {
                let error = 0;
                outputErrors.forEach((outputError, outputIndex) => {
                    error += outputError * this.hiddenWeights[outputIndex][hiddenIndex];
                });
                node.error = error * node.value * (1 - node.value);
                return node.error;
            });

            this.hiddenLayer.forEach((node, hiddenIndex) => {
                this.inputBiases[hiddenIndex] += this.config.learningRate * node.error;
                this.inputLayer.forEach((inputNode, inputIndex) => {
                    this.inputWeights[hiddenIndex][inputIndex] += this.config.learningRate * node.error * inputNode.value;
                });
            });

            this.outputLayer.forEach((node, outputIndex) => {
                this.hiddenBiases[outputIndex] += this.config.learningRate * outputErrors[outputIndex];
                this.hiddenLayer.forEach((hiddenNode, hiddenIndex) => {
                    this.hiddenWeights[outputIndex][hiddenIndex] += this.config.learningRate * outputErrors[outputIndex] * hiddenNode.value;
                });
            });

            totalError += outputErrors.reduce((sum, error) => sum + Math.abs(error), 0) / Math.max(outputErrors.length, 1);
        }

        this.lastError = totalError / Math.max(iterations, 1);
        return this.lastError;
    }
}

const defaultConfig = {
    layertimeout: 0,
    learningRate: 0.1,
    targetError: 0.001,
    inputNodes: 2,
    hiddenNodes: 2,
    outputNodes: 1,
    inputRange: [0, 1],
    outputRange: [0, 1],
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Brain,
        Node,
        defaultConfig,
        normalizeForNode,
        denormalizeForNode,
        sigmoid,
        matMult,
    };
}

if (typeof window !== 'undefined') {
    window.Brain = Brain;
    window.defaultConfig = defaultConfig;
    window.normalizeForNode = normalizeForNode;
    window.denormalizeForNode = denormalizeForNode;
    window.sigmoid = sigmoid;
}
const clampValue = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function drawGraph(canvas, config, history, predictions = [], accuracy = null) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const minValue = config.minValue ?? 0;
    const maxValue = config.maxValue ?? 1;

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i += 1) {
        const y = (i / 5) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    const scaleY = (value) => height - ((value - minValue) / (maxValue - minValue || 1)) * height;

    const drawLine = (values, color, lineWidth = 2) => {
        if (!values.length) return;
        ctx.beginPath();
        ctx.moveTo(20, scaleY(values[0]));
        values.forEach((value, index) => {
            const x = 20 + (index / Math.max(values.length - 1, 1)) * (width - 40);
            ctx.lineTo(x, scaleY(value));
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    };

    drawLine(history, config.strokeStyle || 'lime', 2);

    if (Array.isArray(predictions) && predictions.length) {
        const forecastWidth = Math.min(140, width - 60);
        const startX = width - forecastWidth - 10;
        const step = predictions.length > 1 ? forecastWidth / (predictions.length - 1) : 0;
        const lastHistoryValue = history[history.length - 1];

        ctx.beginPath();
        ctx.moveTo(startX, scaleY(lastHistoryValue));
        predictions.forEach((value, index) => {
            const x = startX + index * step;
            const y = scaleY(value);
            ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        predictions.forEach((value, index) => {
            const x = startX + index * step;
            const y = scaleY(value);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ff4d4d';
            ctx.fill();
        });
    }

    if (accuracy !== null) {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Recent accuracy: ${(accuracy * 100).toFixed(1)}%`, 20, 20);
    }
}

function predictFuture(brain, history, steps = 5) {
    const window = history.slice(-Math.max(1, brain.config?.inputNodes || 3));
    const predictions = [];
    let currentWindow = [...window];

    for (let i = 0; i < steps; i += 1) {
        const nextValue = brain.predict(currentWindow)[0];
        predictions.push(nextValue);
        currentWindow = currentWindow.slice(1).concat(nextValue);
    }

    return predictions;
}

function calculateAccuracy(history, predictions) {
    if (!history.length || !predictions.length) return null;
    const compareCount = Math.min(history.length - 1, predictions.length);
    if (compareCount <= 0) return null;

    const recentHistory = history.slice(-compareCount);
    const recentPredictions = predictions.slice(0, compareCount);

    let totalError = 0;
    recentHistory.forEach((value, index) => {
        const prediction = recentPredictions[index];
        if (typeof prediction === 'number') {
            totalError += Math.abs(value - prediction);
        }
    });

    const meanError = totalError / compareCount;
    return Math.max(0, 1 - meanError);
}

function loopGraph(canvas, config, brain, history) {
    let frame = 0;

    function animate() {
        const nextRealValue = 0.5 + 0.2 * Math.sin(frame * 0.05) //+ 0.3 * Math.random() * Math.cos(frame * 0.02) + 0.05 * Math.sin(frame * 0.1);
        const inputWindow = history.slice(-50);

        history.push(nextRealValue);
        if (history.length > config.historyLength) {
            history.shift();
        }

        const nextPrediction = predictFuture(brain, history, config.predictionSteps || 8);
        const accuracy = calculateAccuracy(history, nextPrediction);
        drawGraph(canvas, config, history, nextPrediction, accuracy);
        brain.train(inputWindow, [nextRealValue], 100);

        frame += 1;
        requestAnimationFrame(animate);
    }
    animate();
}

function trainBrain(brain, trainingData, iterations) {
    for (let i = 0; i < iterations; i += 1) {
        const data = trainingData[Math.floor(Math.random() * trainingData.length)];
        brain.train(data.inputs, data.targets);
    }
}

const canvas = document.getElementById('canvas');
if (!canvas) {
    console.warn('No canvas element found with id "canvas".');
} else {
    canvas.width = canvas.clientWidth || 600;
    canvas.height = canvas.clientHeight || 400;

    const config = {
        historyLength: 1000,
        predictionSteps: 100,
        minValue: 0,
        maxValue: 1,
        strokeStyle: 'lime',
        lineWidth: 2,
    };
    const brain = new Brain({
        inputNodes: 30,
        hiddenNodes: 25,
        outputNodes: 1,
        learningRate: 0.7,
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
    const trainingData = [
        { inputs: [0.1, 0.2, 0.3], targets: [0.4] },
        { inputs: [0.2, 0.3, 0.4], targets: [0.5] },
        { inputs: [0.3, 0.4, 0.5], targets: [0.6] },
        { inputs: [0.4, 0.5, 0.6], targets: [0.7] },
        { inputs: [0.5, 0.6, 0.7], targets: [0.8] },
    ];
    trainBrain(brain, trainingData, 500);
    const history = [0.2, 0.35, 0.5, 0.65, 0.8];
    loopGraph(canvas, config, brain, history);
}
