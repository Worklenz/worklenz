import {
  mapLabelsToIssueType,
  matchesLabelFilter,
  renderImportedDescription,
} from '../services/github/github-issue-mapping';

describe('mapLabelsToIssueType', () => {
  it('maps bug-like labels to bug, even alongside feature labels', () => {
    expect(mapLabelsToIssueType(['Bug'])).toBe('bug');
    expect(mapLabelsToIssueType(['enhancement', 'bug'])).toBe('bug');
    expect(mapLabelsToIssueType(['bug: crash'])).toBe('bug');
  });

  it('maps feature-like labels to story', () => {
    expect(mapLabelsToIssueType(['Enhancement'])).toBe('story');
    expect(mapLabelsToIssueType(['feature'])).toBe('story');
  });

  it('defaults to task', () => {
    expect(mapLabelsToIssueType([])).toBe('task');
    expect(mapLabelsToIssueType(['docs', 'good first issue'])).toBe('task');
  });
});

describe('matchesLabelFilter', () => {
  it('accepts everything with an empty filter', () => {
    expect(matchesLabelFilter(['a'], [])).toBe(true);
    expect(matchesLabelFilter([], undefined)).toBe(true);
  });

  it('requires at least one matching label, case-insensitively', () => {
    expect(matchesLabelFilter(['Worklenz', 'x'], ['worklenz'])).toBe(true);
    expect(matchesLabelFilter(['x'], ['worklenz'])).toBe(false);
    expect(matchesLabelFilter([], ['worklenz'])).toBe(false);
  });
});

describe('renderImportedDescription', () => {
  const source = { fullName: 'acme/web', number: 7, url: 'https://github.com/acme/web/issues/7' };

  it('escapes HTML and links back to the issue', () => {
    const html = renderImportedDescription('<script>alert(1)</script>\nsecond', source);
    expect(html).toContain('Imported from GitHub: acme/web#7');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<p>second</p>');
  });

  it('handles an empty body and truncates very long bodies', () => {
    expect(renderImportedDescription(null, source)).toContain('Imported from GitHub');
    const long = renderImportedDescription('x'.repeat(10000), source);
    expect(long.replace(/<[^>]+>/g, '').length).toBeLessThanOrEqual(5100);
  });
});
