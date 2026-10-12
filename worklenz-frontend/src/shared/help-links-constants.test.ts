import { describe, expect, it } from 'vitest';

import * as helpLinks from './help-links-constants';

// Every exported *_URL except the mailto: link, which is checked separately.
const webLinkEntries = Object.entries(helpLinks).filter(
  ([name]) => name.endsWith('_URL') && name !== 'WORKLENZ_SUPPORT_MAILTO_URL'
);

describe('help-links-constants', () => {
  it('should export at least the web links the Help page lists', () => {
    expect(webLinkEntries.length).toBeGreaterThanOrEqual(9);
  });

  it.each(webLinkEntries)('%s should be a valid https URL', (_name, url) => {
    expect(() => new URL(url)).not.toThrow();
    expect(new URL(url).protocol).toBe('https:');
  });

  // Guards against a placeholder URL being committed for a link nobody has confirmed yet.
  it('should have no placeholder URLs left', () => {
    const placeholders = webLinkEntries
      .filter(([, url]) => /todo/i.test(url))
      .map(([name]) => name);

    expect(placeholders).toEqual([]);
  });

  describe('support email', () => {
    const mailto = new URL(helpLinks.WORKLENZ_SUPPORT_MAILTO_URL);

    it('should be a mailto: link to the support address', () => {
      expect(helpLinks.WORKLENZ_SUPPORT_EMAIL).toBe('support@worklenz.com');
      expect(mailto.protocol).toBe('mailto:');
      expect(mailto.pathname).toBe('support@worklenz.com');
    });

    it('should prefill the subject', () => {
      expect(mailto.searchParams.get('subject')).toBe(helpLinks.WORKLENZ_SUPPORT_EMAIL_SUBJECT);
      expect(helpLinks.WORKLENZ_SUPPORT_EMAIL_SUBJECT.trim()).not.toBe('');
    });

    it('should encode spaces as %20, which mail apps read literally (unlike "+")', () => {
      expect(helpLinks.WORKLENZ_SUPPORT_MAILTO_URL).toBe(
        'mailto:support@worklenz.com?subject=Worklenz%20support%20request'
      );
      expect(helpLinks.WORKLENZ_SUPPORT_MAILTO_URL).not.toContain('+');
    });
  });
});
