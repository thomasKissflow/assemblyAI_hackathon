// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SplitFlap } from './SplitFlap';

it('exposes its value for tests and assistive tech, and updates it', () => {
  const { rerender } = render(<SplitFlap value="8:00 PM" label="Serving at" testId="serve-time" />);
  const el = screen.getByTestId('serve-time');
  expect(el).toHaveAttribute('data-value', '8:00 PM');
  expect(el).toHaveAttribute('aria-label', 'Serving at: 8:00 PM');
  rerender(<SplitFlap value="8:10 PM" label="Serving at" testId="serve-time" />);
  expect(screen.getByTestId('serve-time')).toHaveAttribute('data-value', '8:10 PM');
});

it('starts a flip only on the characters that changed', () => {
  const { container, rerender } = render(<SplitFlap value="8:00 PM" label="Serving at" />);
  expect(container.querySelectorAll('.flap-flip')).toHaveLength(0);
  rerender(<SplitFlap value="8:10 PM" label="Serving at" />);
  expect(container.querySelectorAll('.flap-flip')).toHaveLength(1);
});
