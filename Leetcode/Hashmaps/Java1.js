function twoSum(nums, target) {
    const hashTable = {};
    
    for (let i = 0; i < nums.length; i++) {
        const diff = target - nums[i];
        if (diff in hashTable) {
            return [hashTable[diff], i];
        }
        hashTable[nums[i]] = i;
    }
    return null;
}

const nums = [5, 3, 88, 15, 22, 36, 8, 1];
const target = 9;
const result = twoSum(nums, target);

//Output canvas 
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let output = result;
function text() {
    ctx.font = "48px serif";
    ctx.fillText(output.toString(), 50, 100);
}
text();
