export function normalizedSearch(text: string, dropX = true): string {
  let out = "";
  for (const character of text.normalize("NFD")) {
    if (/\p{M}/u.test(character)) continue;
    if (/^[\p{L}\p{N}]$/u.test(character)) out += character.toLocaleLowerCase("en-US");
    else if (character === "*") out += "x";
  }
  out = out.replaceAll("×", "x");
  return dropX ? out.replace(/(?<=\d)x(?=\d)/g, "") : out;
}

export function searchMatches(query: string, cells: readonly string[]): boolean {
  if (!normalizedSearch(query)) return true;
  const dropped = cells.map((cell) => normalizedSearch(cell));
  const kept = cells.map((cell) => normalizedSearch(cell, false));
  const found = (text: string): boolean => {
    const droppedText = normalizedSearch(text), keptText = normalizedSearch(text, false);
    return dropped.some((cell) => cell.includes(droppedText)) || kept.some((cell) => cell.includes(keptText));
  };
  if (found(query)) return true;
  const words = query.trim().split(/\s+/).filter(Boolean);
  const isName = (word: string): boolean => Array.from(word).some((character) => /\p{L}/u.test(character) && character.toLocaleLowerCase("en-US") !== "x");
  return words.length >= 2 && words.some(isName) && words.every((word) => !normalizedSearch(word) || normalizedSearch(word) === "x" || found(word));
}
