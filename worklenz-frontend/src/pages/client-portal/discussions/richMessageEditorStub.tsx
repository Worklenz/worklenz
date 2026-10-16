import { useEffect, useState } from 'react';
import type { MentionOption } from '@/types/client-portal/v2';
import type { RichMessageChange } from './RichMessageEditor';

interface StubProps {
  value: string;
  controlled?: boolean;
  onChange: (change: RichMessageChange) => void;
  mentionOptions?: MentionOption[];
  onSubmit?: () => void;
  placeholder: string;
  ariaLabel: string;
}

/**
 * Test stand-in for RichMessageEditor (ProseMirror needs a real layout engine). A textarea plays the
 * editor, and one "Mention <name>" button per suggestion plays picking from the @ list. Like the real
 * editor, an id only counts while its @name is still in the text and the person is still suggestable.
 */
export const RichMessageEditorStub = ({ value, controlled = false, onChange, mentionOptions = [], onSubmit, placeholder, ariaLabel }: StubProps) => {
  const [text, setText] = useState('');
  const [ids, setIds] = useState<string[]>([]);

  const emit = (nextText: string, nextIds: string[]) => {
    const live = nextIds.filter(id => {
      const person = mentionOptions.find(option => option.id === id);
      return person && nextText.includes(`@${person.name}`);
    });
    setText(nextText);
    setIds(live);
    onChange({ html: nextText ? `<p>${nextText}</p>` : '', text: nextText, mentionIds: live });
  };

  useEffect(() => {
    if (value === '' && text !== '') {
      setText('');
      setIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const kept = ids.filter(id => mentionOptions.some(option => option.id === id));
    if (kept.length !== ids.length) emit(text, kept);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionOptions]);

  // A controlled editor (a form field) shows the value it is given and hands back what is typed as-is.
  if (controlled) {
    return (
      <textarea
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={event => onChange({ html: event.target.value, text: event.target.value, mentionIds: [] })}
      />
    );
  }

  return (
    <div>
      <textarea
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={event => emit(event.target.value, ids)}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') onSubmit?.();
        }}
      />
      {mentionOptions.map(person => (
        <button key={person.id} type="button" onClick={() => emit(`${text}@${person.name} `, [...ids, person.id])}>
          Mention {person.name}
        </button>
      ))}
    </div>
  );
};
