import { sanitizeFilename } from './sanitize-filename.js';

describe('sanitizeFilename', () => {
  it('replaces characters outside the allowed set with dashes', () => {
    expect(sanitizeFilename('Invoice 42 EU.pdf')).toBe('Invoice-42-EU.pdf');
    expect(sanitizeFilename('report€ v2.pdf')).toBe('report--v2.pdf');
  });

  it('strips path separators to prevent traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeFilename('a\\b/c.pdf')).toBe('abc.pdf');
  });

  it('strips leading dots so hidden-segment names are not produced', () => {
    expect(sanitizeFilename('.bashrc')).toBe('bashrc');
    expect(sanitizeFilename('..report.pdf')).toBe('report.pdf');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  report final.pdf ')).toBe('report-final.pdf');
  });

  it('leaves allowed characters untouched', () => {
    expect(sanitizeFilename('My.File_v2-FINAL.PDF')).toBe(
      'My.File_v2-FINAL.PDF',
    );
    expect(sanitizeFilename('README')).toBe('README');
  });

  it('truncates to 80 characters while preserving the extension', () => {
    const sanitized = sanitizeFilename('a'.repeat(95) + '.pdf');
    expect(sanitized.length).toBe(80);
    expect(sanitized.endsWith('.pdf')).toBe(true);
  });

  it('truncates extension-less names to 80 characters', () => {
    expect(sanitizeFilename('b'.repeat(100))).toBe('b'.repeat(80));
  });

  it('degrades to dashes or an empty segment for invalid names', () => {
    expect(sanitizeFilename('???')).toBe('---');
    expect(sanitizeFilename('')).toBe('');
  });
});
