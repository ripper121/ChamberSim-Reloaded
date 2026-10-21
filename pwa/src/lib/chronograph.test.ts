import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { chronographFormatName, readChronograph } from "./chronograph";

const fixture = (name: string): Uint8Array => readFileSync(resolve("../tests/fixtures/xero", name));

describe("native chronograph compatibility", () => {
  it("reads MagnetoSpeed series and omits missed shots", () => {
    const text = "Series,15, Shots:,3\r\nMin,2721, Max,2770\r\nAvg,2746,S-D,10.1\r\nES,49\r\n\r\n"
      + "Series,Shot,Speed\r\n15, 1, 2721, ft/s\r\n15, 2, 2722, ft/s\r\n15, 3, 2745, ft/s\r\n"
      + "----,----,----,----\r\n\r\nSeries,16, Shots:,2\r\nSeries,Shot,Speed\r\n16, 1, 830.5, m/s\r\n16, 2, 0, m/s\r\n";
    const parsed = readChronograph(new TextEncoder().encode(text));
    expect(parsed.format).toBe("magnetospeed");
    expect(chronographFormatName(parsed.format)).toBe("MagnetoSpeed");
    expect(parsed.series).toHaveLength(2);
    expect(parsed.series[0]!.name).toBe("Series 15");
    expect(parsed.series[0]!.velocitiesMs[0]).toBeCloseTo(2721 * 0.3048, 12);
    expect(parsed.series[1]!.velocitiesMs).toEqual([830.5]);
  });

  it("reads NUL-padded Labradar V0 values", () => {
    const text = "sep=;\r\nDevice ID;LBR-1;;\0   \r\n\0Series No;0003;;\0  \r\n\0Units velocity;fps;;\0  \r\n\0\r\n"
      + "Shot ID;V0;V1;V2;Ke0\r\n0001;2755;2754;2752;2393;\r\n0002;;2752;2751;;\r\n0003;2754;2753;2751;2391;\r\n";
    const parsed = readChronograph(new TextEncoder().encode(text));
    expect(parsed.format).toBe("labradar");
    expect(parsed.series[0]!.name).toBe("SR0003");
    expect(parsed.series[0]!.velocitiesMs).toHaveLength(2);
    expect(parsed.series[0]!.velocitiesMs[1]).toBeCloseTo(2754 * 0.3048, 12);
  });

  it("reads the project Garmin CSV and FIT goldens", () => {
    const csv = readChronograph(fixture("garmin-xero.csv"));
    expect(csv.format).toBe("garmin-xero");
    expect(csv.series[0]!.name).toBe("Rifle Cartridge, 150,0 gr");
    expect(csv.series[0]!.velocitiesMs).toHaveLength(3);
    expect(csv.series[0]!.velocitiesMs[1]).toBeCloseTo(2670.3 * 0.3048, 12);

    const fit = readChronograph(fixture("garmin-xero.fit"));
    expect(fit.series[0]!.name).toMatch(/^Xero /);
    expect(fit.series[0]!.velocitiesMs).toEqual([812.345, 815.2, 809.8, 811, 813.6]);
  });

  it.each([
    ["06-18-2024_15-47-11.fit", 10, 265.391],
    ["06-18-2024_15-50-06.fit", 15, 286.795],
    ["06-18-2024_15-56-35.fit", 22, 384.820],
    ["08-10-2026_10-44-31.fit", 5, 980.278],
    ["Hornady_VMAX_64gr__2024-10-04_18-41-13.csv", 4, 696.7],
    ["Shotview_a.csv", 10, 488.3],
    ["Shotview_i_de.csv", 4, 924.3],
    ["Shotview_i.csv", 19, 2808.2 * 0.3048]
  ] as const)("matches the native fixture result for %s", (name, shots, firstMs) => {
    const parsed = readChronograph(fixture(name));
    expect(parsed.format).toBe("garmin-xero");
    expect(parsed.series).toHaveLength(1);
    expect(parsed.series[0]!.velocitiesMs).toHaveLength(shots);
    expect(parsed.series[0]!.velocitiesMs[0]).toBeCloseTo(firstMs, 6);
  });

  it("preserves localized titles and rejects malformed or foreign data", () => {
    expect(readChronograph(fixture("Shotview_a.csv")).series[0]!.name).toBe("Marlin,.357, 15,3grs W296, 158,0 gr");
    expect(() => readChronograph(fixture("broken.fit"))).toThrow();
    expect(() => readChronograph(new TextEncoder().encode("a,b,c\n1,2,3\n"))).toThrow("Not a Garmin Xero, MagnetoSpeed or Labradar file.");
    expect(() => readChronograph(new TextEncoder().encode("Series,1, Shots:,0\r\n"))).toThrow("The file contains no shots.");

    const fit = fixture("garmin-xero.fit").slice();
    expect(() => readChronograph(fit.slice(0, -20))).toThrow("The FIT file is truncated.");
    fit[14 + 21 + 1] = 4;
    expect(() => readChronograph(fit)).toThrow("This FIT file is not a shot session of a chronograph.");
  });
});
