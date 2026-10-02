interface ChartColor {
  hue: number;
  fill: string;
}

// Hue positions describe the existing theme's colour families. Actual colours (including
// light/dark variants) stay in CSS tokens; primary and success deliberately share one slot.
const THEME_COLORS: readonly ChartColor[] = [
  { hue: 145, fill: 'var(--bs-primary)' },
  { hue: 25, fill: 'var(--bs-danger)' },
  { hue: 235, fill: 'var(--bs-info)' },
  { hue: 90, fill: 'var(--bs-warning)' },
];

function hueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

export function financeChartColors(count: number): readonly string[] {
  const selected: ChartColor[] = [];
  const remaining = [...THEME_COLORS];

  while (selected.length < count && remaining.length) {
    const distances = remaining.map((color) =>
      selected.length ? Math.min(...selected.map((used) => hueDistance(color.hue, used.hue))) : 0,
    );
    const index = distances.indexOf(Math.max(...distances));
    selected.push(remaining.splice(index, 1)[0]);
  }

  while (selected.length < count) {
    const neighbors = [...selected].sort((left, right) => left.hue - right.hue);
    const gaps = neighbors.map((color, index) => {
      const next = neighbors[(index + 1) % neighbors.length];
      return (next.hue - color.hue + 360) % 360;
    });
    const index = gaps.indexOf(Math.max(...gaps));
    const left = neighbors[index];
    const right = neighbors[(index + 1) % neighbors.length];
    selected.push({
      hue: (left.hue + gaps[index] / 2) % 360,
      // All remaining gaps are < 180°, so the shorter OKLCH arc is the chosen gap.
      // Mixing in a polar space keeps intermediate hues colourful, rather than grey.
      fill: `color-mix(in oklch shorter hue, ${left.fill}, ${right.fill})`,
    });
  }

  return selected.map((color) => color.fill);
}
