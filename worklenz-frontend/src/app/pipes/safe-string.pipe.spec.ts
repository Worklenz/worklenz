import {SafeStringPipe} from './safe-string.pipe';

describe('SafeStringPipe', () => {
  it('create an instance', () => {
    const pipe = new SafeStringPipe();
    expect(pipe).toBeTruthy();
  });
});
