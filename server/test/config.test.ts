import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults so the app runs with no configuration', () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(4000);
    expect(config.FAKESTORE_BASE_URL).toBe('https://fakestoreapi.com');
    expect(config.FEATURED_PRODUCT_IDS).toEqual([]);
  });

  it('parses the featured product list', () => {
    expect(loadConfig({ FEATURED_PRODUCT_IDS: ' 3, 11 ,,12 ' }).FEATURED_PRODUCT_IDS).toEqual([
      '3',
      '11',
      '12',
    ]);
  });

  it('fails at startup with a message listing every invalid value', () => {
    expect(() => loadConfig({ SALES_INBOX_EMAIL: 'nope', SMTP_PORT: 'abc' })).toThrow(
      /SALES_INBOX_EMAIL[\s\S]*SMTP_PORT/,
    );
  });
});
