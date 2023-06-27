var mergeTwoLists = function (list1, list2) {
  const mergedList = [];

  let i = 0;
  let j = 0;

  while (i < list1.length && j < list2.length) {
    if (list1[i] <= list2[j]) {
      mergedList.push(list1[i]);
      i++;
    } else {
      mergedList.push(list2[j]);
      j++;
    }
  }
  while (i < list1.length) {
    mergedList.push(list1[i]);
    i++;
  }
  while (j < list2.length) {
    mergedList.push(list2[j]);
    j++;
  }
  return mergedList;
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const list1 = [3, 5, 8, 9];
const list2 = [2, 4, 6, 7, 8, 12];
const output = mergeTwoLists(list1, list2);

function text() {
  ctx.font = "48px serif";
  ctx.fillText(output.toString(), 50, 100);
}
text();
