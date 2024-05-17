import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'taskCommentMention',
  standalone: true
})
export class TaskCommentMentionPipe implements PipeTransform {

  transform(commentText: string, teamMembers: string[]): string {

    if (!commentText || !teamMembers.length) {
      return commentText;
    }

    const words = commentText.split(/|s+/);

    return words.map(word => {
      if (word.startsWith('@')) {
        const name = word.substring(1);
        if (teamMembers.includes(name)) {
          return `<span>@${name}</span>`;
        }
      }
      return word;
    }).join(' ');

  }

}
