import { parseIssueKeys } from '../services/github/github-issue-key-parser';

describe('parseIssueKeys', () => {
  const known = ['PROJ', 'A', 'CORE'];

  it('finds keys in commit messages and branch names', () => {
    expect(parseIssueKeys('feat: add login PROJ-142', known)).toEqual([
      { projectKey: 'PROJ', taskNo: 142, closes: false },
    ]);
    expect(parseIssueKeys('feature/PROJ-104-login', known)).toEqual([
      { projectKey: 'PROJ', taskNo: 104, closes: false },
    ]);
    expect(parseIssueKeys('PROJ-104_fix_bug', known)).toHaveLength(1);
  });

  it('ignores unknown prefixes and lookalikes', () => {
    expect(parseIssueKeys('bump UTF-8 and CVE-2024', known)).toEqual([]);
    expect(parseIssueKeys('XPROJ-1', known)).toEqual([]);
  });

  it('supports single-character and mixed-case keys', () => {
    expect(parseIssueKeys('closes a-7', known)).toEqual([
      { projectKey: 'A', taskNo: 7, closes: true },
    ]);
  });

  it('detects closing keywords and shared keywords across a list', () => {
    const result = parseIssueKeys('Fixes PROJ-104 and PROJ-105, ref CORE-22', known);
    expect(result).toEqual([
      { projectKey: 'PROJ', taskNo: 104, closes: true },
      { projectKey: 'PROJ', taskNo: 105, closes: true },
      { projectKey: 'CORE', taskNo: 22, closes: false },
    ]);
  });

  it('de-duplicates and keeps closes if any mention closes', () => {
    expect(parseIssueKeys('PROJ-1 then resolves PROJ-1', known)).toEqual([
      { projectKey: 'PROJ', taskNo: 1, closes: true },
    ]);
  });

  it('returns nothing for empty input or no known keys', () => {
    expect(parseIssueKeys('', known)).toEqual([]);
    expect(parseIssueKeys(null, known)).toEqual([]);
    expect(parseIssueKeys('PROJ-1', [])).toEqual([]);
  });
});
