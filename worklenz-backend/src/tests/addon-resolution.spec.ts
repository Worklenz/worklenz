import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveAddonDir } from '../addons/load-addons';

describe('add-on directory resolution', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'worklenz-addon-resolution-'));
    jest.spyOn(process, 'cwd').mockReturnValue(root);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });
  it('prefers the separate nested add-ons repository', () => {
    const nested = path.join(root, 'addons', 'worklenz-addons', 'sample');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(root, 'addons', 'sample'), { recursive: true });
    expect(resolveAddonDir('sample')).toBe(nested);
  });
  it('continues to find add-ons in the original direct layout', () => {
    const direct = path.join(root, 'addons', 'sample');
    fs.mkdirSync(direct, { recursive: true });
    expect(resolveAddonDir('sample')).toBe(direct);
  });
});
