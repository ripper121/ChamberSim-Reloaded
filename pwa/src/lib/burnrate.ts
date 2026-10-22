import { fillBurnFactors } from "./burnfactors";
import type { ProjectRecord } from "./projectdb";
import { searchMatches } from "./search";

export type BurnRateColumn = "maker" | "name" | "lot" | "ba" | "br" | "bp" | "brp" | "quality";
export type BurnRateFactor = "br" | "bp" | "brp";

export interface BurnRateRow {
  maker: string;
  name: string;
  lot: string;
  ba: number;
  br: number;
  bp: number;
  brp: number;
  quality: number;
}

const number = (record: ProjectRecord, name: string): number => {
  const value = Number(record[name] ?? 0);
  return Number.isFinite(value) ? value : 0;
};

export function burnRateRows(records: readonly ProjectRecord[], allLots = false): BurnRateRow[] {
  const rows = records.flatMap((record): BurnRateRow[] => {
    const ba = number(record, "Ba");
    if (!(ba > 0)) return [];
    const values = { ...record };
    if (!(number(record, "Br") > 0)) fillBurnFactors(values);
    const br = number(values, "Br");
    if (!(br > 0)) return [];
    return [{
      maker: String(record.mname ?? ""), name: String(record.pname ?? ""), lot: String(record.lotid ?? ""), ba,
      br, bp: number(values, "Bp"), brp: number(values, "Brp"), quality: number(record, "Qlty")
    }];
  });
  if (allLots) return rows;
  const newest = new Map<string, BurnRateRow>();
  for (const row of rows) {
    const key = `${row.maker.toLocaleLowerCase("en-US")}\n${row.name.toLocaleLowerCase("en-US")}`;
    const current = newest.get(key);
    if (!current || row.lot > current.lot) newest.set(key, row);
  }
  return [...newest.values()];
}

export function filterBurnRateRows(rows: readonly BurnRateRow[], query: string): BurnRateRow[] {
  return rows.filter((row) => searchMatches(query.trim(), [`${row.maker} ${row.name}`]));
}

export function sortBurnRateRows(rows: readonly BurnRateRow[], column: BurnRateColumn, direction: "asc" | "desc"): BurnRateRow[] {
  const sign = direction === "asc" ? 1 : -1;
  const collator = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });
  return [...rows].sort((left, right) => {
    const a = left[column], b = right[column];
    const difference = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
    return difference * sign || collator.compare(`${left.maker}\n${left.name}\n${left.lot}`, `${right.maker}\n${right.name}\n${right.lot}`);
  });
}
