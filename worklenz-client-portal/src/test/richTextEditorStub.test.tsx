import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditorStub } from './richTextEditorStub';

const Controlled = () => {
  const [value, setValue] = useState('');
  const [text, setText] = useState('');
  return (
    <>
      <RichTextEditorStub
        value={value}
        placeholder="Type here"
        ariaLabel="Message"
        onChange={change => {
          setValue(change.html);
          setText(change.text);
        }}
      />
      <output data-testid="emitted-text">{text}</output>
    </>
  );
};

describe('RichTextEditorStub', () => {
  it('keeps spaces between words while typing, round-tripped through the controlled value', async () => {
    render(<Controlled />);
    const box = screen.getByLabelText('Message');
    await userEvent.type(box, 'Pro plan, double opt-in please');
    expect(box).toHaveValue('Pro plan, double opt-in please');
    expect(screen.getByTestId('emitted-text')).toHaveTextContent('Pro plan, double opt-in please');
  });
});
