export interface ObtNode { node: number; timeMs: number }

const maxNode = 24.5;
const millimetersPerInch = 25.4;
const odd = { a: 4.42642857e-3, b: 2.84942857e-2, c: -3.18785714e-3, d: 2.91180952e-2 };
const even = { a: 4.40803571e-3, b: 2.68380952e-2, c: -2.40148810e-3, d: 4.39015873e-2 };

export function obtTimeMs(node: number, barrelLengthMm: number): number {
  const constants = Math.floor(node) % 2 === 0 ? even : odd;
  return (constants.a * node + constants.b) * (barrelLengthMm / millimetersPerInch) + constants.c * node + constants.d;
}

export function nearestObtNode(bulletLeadTimeMs: number, barrelLengthMm: number, halfNodes = true): ObtNode | undefined {
  if (!(barrelLengthMm > 0) || !(bulletLeadTimeMs > 0)) return undefined;
  const step = halfNodes ? 0.5 : 1;
  let best = { node: 0, timeMs: obtTimeMs(0, barrelLengthMm) };
  for (let node = step; node <= maxNode; node += step) {
    const timeMs = obtTimeMs(node, barrelLengthMm);
    if (Math.abs(timeMs - bulletLeadTimeMs) < Math.abs(best.timeMs - bulletLeadTimeMs)) best = { node, timeMs };
  }
  return best;
}
