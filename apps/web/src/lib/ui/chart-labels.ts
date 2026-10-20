export const MAX_DIRECT_LABEL_SERIES = 6;

/** Direct end-labels are the primary identity encoding (palette has a low-contrast slot); legend only past 6 series. */
export function directLabelsFor(seriesCount: number): boolean {
  return seriesCount <= MAX_DIRECT_LABEL_SERIES;
}

/** Push overlapping end-labels apart (top→bottom), keeping their vertical order. */
export function placeEndLabels<T extends { key: string; y: number }>(items: T[], minGap: number): Array<T & { y: number }> {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const out: Array<T & { y: number }> = [];
  let lastY = -Infinity;
  for (const it of sorted) {
    const y = Math.max(it.y, lastY + minGap);
    out.push({ ...it, y });
    lastY = y;
  }
  return out;
}
