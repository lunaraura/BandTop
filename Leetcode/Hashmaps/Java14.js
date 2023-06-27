var longestCommonPrefix = function(strs) {
  if (strs.length === 0) {
    return "";
  }

  let prefix = strs[0];

  for (let i = 1; i < strs.length; i++) {
    while (strs[i].indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, prefix.length - 1);
      if (prefix === "") {
        return "";
      }
    }
  }
  return prefix;
};
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const strs = ["flower","flow","florida", "flavor"];
  const output = longestCommonPrefix(strs);
  
  function text() {
    ctx.font = "48px serif";
    ctx.fillText(output.toString(), 50, 100);
  }
  
  text();