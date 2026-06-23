import { describe, it, expect } from 'vitest';

describe('Test setup verification', () => {
  it('should have fake-indexeddb available', () => {
    expect(indexedDB).toBeDefined();
  });

  it('should support jsdom environment', () => {
    expect(document).toBeDefined();
    expect(window).toBeDefined();
  });
});
