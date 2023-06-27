//Output canvas 
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const MyArray = {
    // Method to check if an array is empty
    isEmpty: function(arr) {
      return arr.length === 0;
    },
  
    // Method to get the length of an array
    length: function(arr) {
      return arr.length;
    },
  
    // Method to check if an array contains a specific element
    contains: function(arr, element) {
      return arr.includes(element);
    },
  
    // Method to find the index of a specific element in an array
    indexOf: function(arr, element) {
      return arr.indexOf(element);
    },
  
    // Method to add an element to the end of an array
    push: function(arr, element) {
      arr.push(element);
      return arr.length;
    },
  
    // Method to remove and return the last element of an array
    pop: function(arr) {
      return arr.pop();
    },
  
    // Method to add an element to the beginning of an array
    unshift: function(arr, element) {
      arr.unshift(element);
      return arr.length;
    },
  
    // Method to remove and return the first element of an array
    shift: function(arr) {
      return arr.shift();
    },
  
    // Method to reverse the order of elements in an array
    reverse: function(arr) {
      return arr.reverse();
    },
  
    // Method to join all elements of an array into a string
    join: function(arr, separator) {
      return arr.join(separator);
    },
  
    // Method to sort the elements of an array
    sort: function(arr) {
      return arr.sort();
    },
  
    // Method to get a subarray from an array based on start and end indices
    slice: function(arr, start, end) {
      return arr.slice(start, end);
    }
  };
  
  // Example usage
  const myArray = [1, 2, 3, 4, 5];
  
  console.log(MyArray.isEmpty(myArray)); // false
  console.log(MyArray.length(myArray)); // 5
  console.log(MyArray.contains(myArray, 3)); // true
  console.log(MyArray.indexOf(myArray, 4)); // 3
  
  MyArray.push(myArray, 6);
  console.log(myArray); // [1, 2, 3, 4, 5, 6]
  
  console.log(MyArray.pop(myArray)); // 6
  
  MyArray.unshift(myArray, 0);
  console.log(myArray); // [0, 1, 2, 3, 4, 5]
  
  console.log(MyArray.shift(myArray)); // 0
  
  console.log(MyArray.reverse(myArray)); // [5, 4, 3, 2, 1]
  
  console.log(MyArray.join(myArray, "-")); // "5-4-3-2-1"
  
  console.log(MyArray.sort(myArray)); // [1, 2, 3, 4, 5]
  
  console.log(MyArray.slice(myArray, 1, 4)); // [2, 3, 4]
  



let output = result;
function text() {
    ctx.font = "48px serif";
    ctx.fillText(output.toString(), 50, 100);
}
text();
