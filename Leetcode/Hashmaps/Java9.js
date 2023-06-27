var isPalindrome = function(x) {
    const str = String(x);
    let i = 0;
    let j = str.length - 1;

    while (i < j) {
        if (str[i] !== str[j]){
            return false;
        }
        i++;
        j++;
    }
    return true;
};

//Output canvas
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let output = highestAverageStudent;

function text() {
  ctx.font = "48px serif";
  ctx.fillText(output.toString(), 50, 100);
  ctx.fillText(output2.toString(), 50, 100);
}
text();
//end of output
