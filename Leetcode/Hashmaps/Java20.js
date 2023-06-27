var isValid = function(s) {
  const stack = [];

  const bracketsMap = {
    '(': ')',
    '{': '}',
    '[': ']'
  };

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    console.log(i);
    if (char === '(' || char === '{' || char === '[') {
      stack.push(char);
      console.log("add char");
    }
    else if (char === ')' || char === '}' || char === ']') {
      if (stack.length === 0 || bracketsMap[stack.pop()] !== char) {
        console.log("le false");
        return false;
      }
      console.log("remove char");
    }
    console.log(char);
    console.log(stack);
  }
  //if stack length 0, then function = true
  return stack.length === 0;
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const s = "{(())}";
const output = isValid(s);

function text() {
  ctx.font = "48px serif";
  ctx.fillText(output.toString(), 50, 100);
}

text();
