import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import OtpInput from './OtpInput';

/** Controlled wrapper so the component behaves as it does in the form. */
const Harness = ({ onChange }) => {
  const [value, setValue] = useState('');
  return (
    <OtpInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

describe('OtpInput', () => {
  it('renders one box per digit and reports the full code as it is typed', async () => {
    const user = userEvent.setup();
    const seen = [];
    render(<Harness onChange={(value) => seen.push(value)} />);

    expect(screen.getAllByRole('textbox')).toHaveLength(6);

    await user.type(screen.getByLabelText('Digit 1 of 6'), '123456');

    expect(seen[seen.length - 1]).toBe('123456');
    expect(screen.getByLabelText('Digit 6 of 6')).toHaveValue('6');
  });

  it('distributes a pasted code across the boxes', async () => {
    const user = userEvent.setup();
    const seen = [];
    render(<Harness onChange={(value) => seen.push(value)} />);

    await user.click(screen.getByLabelText('Digit 1 of 6'));
    await user.paste('987654');

    expect(seen[seen.length - 1]).toBe('987654');
    expect(screen.getByLabelText('Digit 3 of 6')).toHaveValue('7');
  });

  it('ignores non-digit characters', async () => {
    const user = userEvent.setup();
    const seen = [];
    render(<Harness onChange={(value) => seen.push(value)} />);

    await user.click(screen.getByLabelText('Digit 1 of 6'));
    await user.paste('12ab34');

    expect(seen[seen.length - 1]).toBe('1234');
  });

  it('deletes the previous digit when backspacing on an empty box', async () => {
    const user = userEvent.setup();
    const seen = [];
    render(<Harness onChange={(value) => seen.push(value)} />);

    await user.type(screen.getByLabelText('Digit 1 of 6'), '12');
    // Focus sits on the third box (which is empty) — backspace steps back.
    await user.keyboard('{Backspace}');

    expect(seen[seen.length - 1]).toBe('1');
  });

  it('disables every box while a request is in flight', () => {
    render(<OtpInput value="" onChange={() => {}} disabled />);
    screen.getAllByRole('textbox').forEach((box) => expect(box).toBeDisabled());
  });
});
