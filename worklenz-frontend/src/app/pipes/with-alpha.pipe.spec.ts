import {WithAlphaPipe} from './with-alpha.pipe';

describe('WithAlphaPipe', () => {
  it('create an instance', () => {
    const pipe = new WithAlphaPipe();
    expect(pipe).toBeTruthy();
  });
});
