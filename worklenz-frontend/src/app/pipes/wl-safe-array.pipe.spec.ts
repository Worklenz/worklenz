import {WlSafeArrayPipe} from './wl-safe-array.pipe';

describe('WlSafeArrayPipe', () => {
  it('create an instance', () => {
    const pipe = new WlSafeArrayPipe();
    expect(pipe).toBeTruthy();
  });
});
