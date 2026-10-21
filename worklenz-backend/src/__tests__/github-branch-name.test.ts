import { isValidBranchName } from '../services/github/github-branch-name';

describe('isValidBranchName', () => {
  it('accepts typical branch names', () => {
    expect(isValidBranchName('feature/PROJ-42-user-auth')).toBe(true);
    expect(isValidBranchName('bugfix/web_12.fix')).toBe(true);
  });

  it('rejects unsafe or malformed names', () => {
    for (const name of ['', '-x', '/x', 'x/', 'a..b', 'a//b', 'a b', 'a.lock', 'a/.hidden', 'a~b', 'a:b', 'a?b', 'x.', 'x\n']) {
      expect(isValidBranchName(name)).toBe(false);
    }
    expect(isValidBranchName(undefined)).toBe(false);
    expect(isValidBranchName('a'.repeat(201))).toBe(false);
  });
});
