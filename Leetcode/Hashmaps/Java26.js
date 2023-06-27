var removeDuplicates = function(nums) {
    if (nums.length === 0) {
      return 0;
    }
    let k = 1;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1]) {
        nums[k] = nums[i]; // Shift unique elements to the front
        k++;
      }
    }
  
    return k;
  };
  
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  let nums = [1, 1, 2, 2, 3, 4, 4, 5, 5, 5, 6];
  let output = removeDuplicates(nums);
  
  function text() {
    ctx.font = "48px serif";
    ctx.fillText(output.toString(), 50, 100);
  }
  
  text();