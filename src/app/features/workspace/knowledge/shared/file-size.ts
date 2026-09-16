interface FileSizeUnit {
  divisor: number;
  unit: 'byte' | 'kilobyte' | 'megabyte' | 'gigabyte' | 'terabyte';
}

const FILE_SIZE_UNITS: readonly FileSizeUnit[] = [
  { divisor: 1, unit: 'byte' },
  { divisor: 1024, unit: 'kilobyte' },
  { divisor: 1024 ** 2, unit: 'megabyte' },
  { divisor: 1024 ** 3, unit: 'gigabyte' },
  { divisor: 1024 ** 4, unit: 'terabyte' },
];

export function formatFileSize(sizeBytes: number, locale: string): string {
  const selectedUnit =
    [...FILE_SIZE_UNITS].reverse().find((unit) => sizeBytes >= unit.divisor) ?? FILE_SIZE_UNITS[0]!;

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: selectedUnit.unit,
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(sizeBytes / selectedUnit.divisor);
}
