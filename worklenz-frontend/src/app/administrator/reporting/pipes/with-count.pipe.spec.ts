import {WithCountPipe} from './with-count.pipe';

describe('WithCountPipe', () => {
  it('create an instance', () => {
    const pipe = new WithCountPipe();
    expect(pipe).toBeTruthy();
  });
});
