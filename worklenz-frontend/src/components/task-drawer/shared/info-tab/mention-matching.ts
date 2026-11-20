interface MentionMember {
  id: string;
  name: string;
}

export const normalizeMentionText = (value: string) => value.toLocaleLowerCase();

export const findMentionRanges = (text: string, members: MentionMember[]) => {
  const normalizedText = normalizeMentionText(text);
  const normalizedToOriginal = new Map<number, number>();
  normalizedToOriginal.set(0, 0);

  let originalOffset = 0;
  let normalizedOffset = 0;

  for (const character of text) {
    originalOffset += character.length;
    // Prefix lowercasing retains the context needed by locale-specific mappings.
    normalizedOffset = normalizeMentionText(text.slice(0, originalOffset)).length;
    normalizedToOriginal.set(normalizedOffset, originalOffset);
  }

  const ranges: Array<{ start: number; length: number }> = [];
  const orderedMembers = [...members].sort((a, b) => b.name.length - a.name.length);

  orderedMembers.forEach(member => {
    const mention = `@${member.name.trim()}`;
    if (mention.length < 2) return;

    const normalizedMention = normalizeMentionText(mention);
    let searchFrom = 0;
    let matchIndex = normalizedText.indexOf(normalizedMention, searchFrom);

    while (matchIndex !== -1) {
      const originalStart = normalizedToOriginal.get(matchIndex);
      const originalEnd = normalizedToOriginal.get(
        matchIndex + normalizedMention.length
      );

      if (originalStart !== undefined && originalEnd !== undefined) {
        const previousCharacter = originalStart > 0 ? text[originalStart - 1] : '';
        const nextCharacter = text[originalEnd] || '';

        const hasValidStart =
          !previousCharacter || /[\s([{,:;.!?]/.test(previousCharacter);
        const hasValidEnd =
          !nextCharacter || /[\s.,;:!?)}\]]/.test(nextCharacter);

        const overlapsExisting = ranges.some(
          range =>
            originalStart < range.start + range.length &&
            originalEnd > range.start
        );

        if (hasValidStart && hasValidEnd && !overlapsExisting) {
          ranges.push({
            start: originalStart,
            length: originalEnd - originalStart,
          });
        }
      }

      searchFrom = matchIndex + normalizedMention.length;
      matchIndex = normalizedText.indexOf(normalizedMention, searchFrom);
    }
  });

  return ranges;
};


export const removeActiveMentionQuery = (text: string, start: number, end: number) =>
  `${text.slice(0, start)} ${text.slice(end)}`;
