var intToRoman = function(num) {
  const romanSymbols = {
    1000: 'M',
    900: 'CM',
    500: 'D',
    400: 'CD',
    100: 'C',
    90: 'XC',
    50: 'L',
    40: 'XL',
    10: 'X',
    9: 'IX',
    5: 'V',
    4: 'IV',
    1: 'I',
  };

  let romanNumeral = '';

  for (const symbolValue of Object.keys(romanSymbols).reverse()) {
    const symbol = romanSymbols[symbolValue];

    while (num >= symbolValue) {
      romanNumeral += symbol;
      num -= symbolValue;
    }
  }

  return romanNumeral;
};
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const numberToConvert = 19; // Replace with the integer you want to convert
  const output = intToRoman(numberToConvert);
  
  function text() {
    ctx.font = "48px serif";
    ctx.fillText(output.toString(), 50, 100);
  }
  
  text();