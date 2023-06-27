function calculateHighestAverageGrade(grades) {
    const gradeSum = {};
    const gradeCount = {};
    
    for (const gradeObj of grades) {
      const { name, grade } = gradeObj;
      
      if (name in gradeSum) {
        gradeSum[name] += grade;
        gradeCount[name]++;
      } else {
        gradeSum[name] = grade;
        gradeCount[name] = 1;
      }
    }
    
    let highestAverage = -Infinity;
    let highestAverageStudent = null;
    
    for (const name in gradeSum) {
      const average = gradeSum[name] / gradeCount[name];
      
      if (average > highestAverage) {
        highestAverage = average;
        highestAverageStudent = name;
      }
    }
    
    return highestAverageStudent;
  }
  
  // Example usage:
  const grades = [
    { name: 'Alice', grade: 85 },
    { name: 'Bob', grade: 92 },
    { name: 'Alice', grade: 90 },
    { name: 'Bob', grade: 88 },
    { name: 'Charlie', grade: 95 },
    { name: 'Charlie', grade: 0 }
  ];
  
  const highestAverageStudent = calculateHighestAverageGrade(grades);

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