type NumericRecord = Record<string, string | number | boolean>;

const shape = [1.56077, 0.123187, -0.509118, -2.00729, -0.00771699, 0.428304, -0.281728, -0.542881, 1.54258, 2.34569,
  0.000267063, -0.0146042, 0.00620305, -0.159374, -0.0548813, 0.167131, -0.0660242, 0.843872, -1.20759, -0.883327] as const;

export function progressivityShape(a0: number, z1: number, z2: number): number {
  const values = [a0, z1, z2];
  let sum = shape[0], n = 1;
  for (let i = 0; i < 3; ++i) sum += shape[n++]! * values[i]!;
  for (let i = 0; i < 3; ++i) for (let j = i; j < 3; ++j) sum += shape[n++]! * values[i]! * values[j]!;
  for (let i = 0; i < 3; ++i) for (let j = i; j < 3; ++j) for (let k = j; k < 3; ++k) sum += shape[n++]! * values[i]! * values[j]! * values[k]!;
  return sum;
}

export function fillBurnFactors(record: NumericRecord): void {
  const number = (name: string): number => Number(record[name] ?? 0);
  const ba = number("Ba"), heat = number("Qex"), ratio = number("k");
  let br = 0, bp = 0, brp = 0;
  if (ba > 0 && heat > 0 && ratio > 1) {
    br = Math.sqrt(2 * (ratio - 1)) * ba * heat / 10_000;
    bp = br * progressivityShape(number("a0"), number("z1"), number("z2"));
    brp = Math.sqrt((br * br + bp * bp) / 2);
  }
  record.Br = br; record.Bp = bp; record.Brp = brp;
}
