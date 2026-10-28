interface KeyboardRange {
  index: number;
  length: number;
}

interface KeyboardContext {
  event: KeyboardEvent;
}

export const createMentionEnterBinding = <T,>(
  isMentionActive: () => boolean,
  getSelectedMention: () => T | undefined,
  insertMention: (mention: T) => void
) => ({
  key: 'Enter',
  handler: (_range: KeyboardRange, context: KeyboardContext) => {
    if (context.event.isComposing || context.event.keyCode === 229 || !isMentionActive()) {
      return true;
    }

    const mention = getSelectedMention();
    if (!mention) return true;

    insertMention(mention);
    return false;
  },
});
