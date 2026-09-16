import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it.each([
    { sizeBytes: 512, expected: '512 byte' },
    { sizeBytes: 1024, expected: '1 kB' },
    { sizeBytes: 1024 * 1024, expected: '1 MB' },
    { sizeBytes: 1024 * 1024 * 1024, expected: '1 GB' },
  ])('formats $sizeBytes bytes as $expected', ({ sizeBytes, expected }) => {
    expect(formatFileSize(sizeBytes, 'en-US')).toBe(expected);
  });
});
