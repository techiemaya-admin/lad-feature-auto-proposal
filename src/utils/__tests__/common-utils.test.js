const { parseContactInfo, CommonUtil } = require('../common-utils');

describe('Common Utilities - parseContactInfo', () => {
  it('correctly parses standard "First Last <email@example.com>" string', () => {
    const result = parseContactInfo('John Doe <john.doe@example.com>');

    expect(result).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    });
  });

  it('correctly handles multi-word and middle names', () => {
    const result = parseContactInfo('Mary Jane Watson-Parker <mary.jane@marvel.com>');

    expect(result).toEqual({
      firstName: 'Mary',
      lastName: 'Jane Watson-Parker',
      email: 'mary.jane@marvel.com',
    });
  });

  it('handles single-name contacts with no last name', () => {
    const result = parseContactInfo('Madonna <madonna@music.org>');

    expect(result).toEqual({
      firstName: 'Madonna',
      lastName: '',
      email: 'madonna@music.org',
    });
  });

  it('trims leading/trailing and intermediate whitespace', () => {
    const result = parseContactInfo('   Robert   Downey   Jr.   <  robert@stark.com  >  ');

    expect(result).toEqual({
      firstName: 'Robert',
      lastName: 'Downey Jr.',
      email: 'robert@stark.com',
    });
  });

  it('returns null for strings without angle brackets or malformed email format', () => {
    expect(parseContactInfo('john.doe@example.com')).toBeNull();
    expect(parseContactInfo('John Doe john@example.com')).toBeNull();
    expect(parseContactInfo('Plain Text')).toBeNull();
  });

  it('returns null for empty strings, null, undefined, and non-string inputs', () => {
    expect(parseContactInfo('')).toBeNull();
    expect(parseContactInfo(null)).toBeNull();
    expect(parseContactInfo(undefined)).toBeNull();
    expect(parseContactInfo(12345)).toBeNull();
    expect(parseContactInfo({})).toBeNull();
    expect(parseContactInfo(['John <john@example.com>'])).toBeNull();
  });

  it('exposes parseContactInfo on CommonUtil namespace for backward compatibility', () => {
    expect(CommonUtil.parseContactInfo).toBe(parseContactInfo);
    expect(CommonUtil.parseContactInfo('Jane Doe <jane@example.com>')).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });
  });
});
