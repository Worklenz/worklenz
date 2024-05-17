import { TaskCommentMentionPipe } from './task-comment-mention.pipe';

describe('TaskCommentMentionPipe', () => {
  it('create an instance', () => {
    const pipe = new TaskCommentMentionPipe();
    expect(pipe).toBeTruthy();
  });
});
