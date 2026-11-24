export function decimalForInput(value: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction = '', exponent = '0'] = match;
  const digits = integer + fraction;
  if (/^0+$/.test(digits)) return '0';
  const shift = Number(exponent);
  if (!Number.isInteger(shift) || Math.abs(shift) > 30) return value;
  const point = integer.length + shift;
  let whole: string;
  let decimal: string;
  if (point <= 0) {
    whole = '0';
    decimal = '0'.repeat(-point) + digits;
  } else if (point >= digits.length) {
    whole = digits + '0'.repeat(point - digits.length);
    decimal = '';
  } else {
    whole = digits.slice(0, point);
    decimal = digits.slice(point);
  }
  whole = whole.replace(/^0+(?=\d)/, '');
  decimal = decimal.replace(/0+$/, '');
  return `${sign === '-' ? '-' : ''}${whole}${decimal ? `.${decimal}` : ''}`;
}

export function adjustFinanceAmount(balance: string, delta: string, subtract = false): string {
  const parts = [balance, delta].map((value) => decimalForInput(value).split('.'));
  const scale = Math.max(...parts.map(([, fraction = '']) => fraction.length));
  const [one, two] = parts.map(([whole, fraction = '']) =>
    BigInt(whole + fraction.padEnd(scale, '0')),
  );
  const sum = one + (subtract ? -two : two);
  const digits = (sum < 0n ? -sum : sum).toString().padStart(scale + 1, '0');
  return (
    (sum < 0n ? '-' : '') + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits)
  );
}
