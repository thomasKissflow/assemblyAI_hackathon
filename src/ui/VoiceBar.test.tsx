// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VoiceBar } from './VoiceBar';

const base = { ears: 'asleep' as const, pushToTalk: false, userSpeaking: false, chefSpeaking: false, muted: false };
const props = () => ({ phase: 'live' as const, levels: () => ({ mic: 0, out: 0 }), onToggleMute: vi.fn(), onPushToTalk: vi.fn() });

it('tells the cook how to wake Chef, then shows listening and follow-up', () => {
  const p = props();
  const { rerender } = render(<VoiceBar voice={base} {...p} />);
  expect(screen.getByTestId('voice-bar')).toHaveAttribute('data-ears', 'asleep');
  expect(screen.getByTestId('voice-bar')).toHaveTextContent(/hey chef/i);
  rerender(<VoiceBar voice={{ ...base, ears: 'awake' }} {...p} />);
  expect(screen.getByTestId('voice-bar')).toHaveAttribute('data-ears', 'awake');
  expect(screen.getByTestId('voice-bar')).toHaveTextContent(/listening/i);
  rerender(<VoiceBar voice={{ ...base, ears: 'followup' }} {...p} />);
  expect(screen.getByTestId('voice-bar')).toHaveTextContent(/go on/i);
});

it('says when Chef is talking and when the mic is muted', () => {
  const p = props();
  const { rerender } = render(<VoiceBar voice={{ ...base, chefSpeaking: true }} {...p} />);
  expect(screen.getByTestId('voice-bar')).toHaveTextContent(/chef is talking/i);
  rerender(<VoiceBar voice={{ ...base, muted: true }} {...p} />);
  expect(screen.getByTestId('voice-bar')).toHaveTextContent(/muted/i);
});

it('mute toggles and hold-to-talk presses and releases', () => {
  const p = props();
  render(<VoiceBar voice={base} {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /mute mic/i }));
  expect(p.onToggleMute).toHaveBeenCalled();
  const ptt = screen.getByRole('button', { name: /hold to talk/i });
  fireEvent.pointerDown(ptt);
  fireEvent.pointerUp(ptt);
  expect(p.onPushToTalk).toHaveBeenNthCalledWith(1, true);
  expect(p.onPushToTalk).toHaveBeenNthCalledWith(2, false);
});
