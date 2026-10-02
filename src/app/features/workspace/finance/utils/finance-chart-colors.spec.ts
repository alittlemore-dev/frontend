import { financeChartColors } from './finance-chart-colors';

describe('financeChartColors', () => {
  it('starts with the accent and selects the most distant remaining theme hue first', () => {
    expect(financeChartColors(4)).toEqual([
      'var(--bs-primary)',
      'var(--bs-danger)',
      'var(--bs-info)',
      'var(--bs-warning)',
    ]);
  });

  it('bisects the widest adjacent hue gaps, including the gap across the circle origin', () => {
    const colors = financeChartColors(6);
    expect(colors[4]).toBe('color-mix(in oklch shorter hue, var(--bs-info), var(--bs-danger))');
    expect(colors[5]).toBe('color-mix(in oklch shorter hue, var(--bs-primary), var(--bs-info))');
  });

  it('extends rather than cycles the palette, keeping existing assignments when rows are added', () => {
    const colors = financeChartColors(24);
    expect(new Set(colors).size).toBe(24);
    expect(colors.slice(0, 12)).toEqual(financeChartColors(12));
    expect(financeChartColors(0)).toEqual([]);
  });
});
