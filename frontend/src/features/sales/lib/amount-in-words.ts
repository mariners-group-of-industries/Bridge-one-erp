const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(value: number): string {
  if (value < 20) return ONES[value];
  return [TENS[Math.floor(value / 10)], ONES[value % 10]].filter(Boolean).join(" ");
}

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** Whole number in the South Asian system: crore, lakh, thousand, hundred. */
export function integerInWords(value: number): string {
  if (value === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(value / 10_000_000);
  let rest = value % 10_000_000;
  if (crore) parts.push(`${crore >= 100 ? integerInWords(crore) : belowHundred(crore)} Crore`);
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** 64827.28 → "Sixty Four Thousand Eight Hundred Twenty Seven Taka and Twenty Eight Paisa Only". */
export function amountInWords(amount: number): string {
  const paisaTotal = Math.round(Math.abs(amount) * 100);
  const taka = Math.floor(paisaTotal / 100);
  const paisa = paisaTotal % 100;
  const words = `${integerInWords(taka)} Taka${paisa ? ` and ${belowHundred(paisa)} Paisa` : ""} Only`;
  return amount < 0 ? `Minus ${words}` : words;
}
