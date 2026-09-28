// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartScreen } from './StartScreen';
import { createKitchenStore } from '../kitchen/store';
import { CaptionFeed } from '../voice/captionFeed';
import type { ChefSession } from '../voice/useChefSession';

function fakeSession(overrides: Partial<ChefSession> = {}): ChefSession {
  return {
    phase: 'idle', error: null, wakeCount: 0, captions: new CaptionFeed(),
    voice: { ears: 'asleep', pushToTalk: false, userSpeaking: false, chefSpeaking: false, muted: false },
    start: vi.fn(), stop: vi.fn(), announce: vi.fn(), setPushToTalk: vi.fn(), toggleMute: vi.fn(),
    levels: () => ({ mic: 0, out: 0 }), audioTime: () => 0,
    ...overrides,
  } as unknown as ChefSession;
}

describe('StartScreen', () => {
  const store = createKitchenStore(() => 0);
  const setup = store.getState();

  it("previews tonight's first calls and updates with the menu", async () => {
    render(<StartScreen state={setup} session={fakeSession()} hasKey onPrepare={vi.fn()} onBegin={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('plan-preview')).toHaveTextContent('7:22');
    await userEvent.click(screen.getByTestId('menu-western'));
    expect(screen.getByTestId('plan-preview')).toHaveTextContent(/potatoes/i);
  });

  it('continues with voice, or cooks without it', async () => {
    const onPrepare = vi.fn();
    render(<StartScreen state={setup} session={fakeSession()} hasKey onPrepare={onPrepare} onBegin={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByTestId('serve-in-60'));
    await userEvent.click(screen.getByTestId('start-continue'));
    expect(onPrepare).toHaveBeenLastCalledWith('indian', 60, true);
    await userEvent.click(screen.getByTestId('start-cook-without-voice'));
    expect(onPrepare).toHaveBeenLastCalledWith('indian', 60, false);
  });

  it('explains a missing key and blocks voice start', () => {
    render(<StartScreen state={setup} session={fakeSession()} hasKey={false} onPrepare={vi.fn()} onBegin={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByTestId('start-continue')).toBeDisabled();
    expect(screen.getByText(/VITE_ASSEMBLYAI_API_KEY/)).toBeInTheDocument();
  });

  describe('sound check', () => {
    store.prepare('indian', 45);
    const ready = store.getState();

    it('waits for the connection, then lets the cook start', () => {
      const onBegin = vi.fn();
      const { rerender } = render(<StartScreen state={ready} session={fakeSession({ phase: 'connecting' })} hasKey onPrepare={vi.fn()} onBegin={onBegin} onBack={vi.fn()} />);
      expect(screen.getByTestId('soundcheck-start')).toBeDisabled();
      rerender(<StartScreen state={ready} session={fakeSession({ phase: 'live' })} hasKey onPrepare={vi.fn()} onBegin={onBegin} onBack={vi.fn()} />);
      expect(screen.getByTestId('soundcheck-start')).toBeEnabled();
      expect(screen.getByTestId('soundcheck-heard')).toHaveTextContent(/hey chef/i);
    });

    it('confirms once Chef heard the wake phrase', () => {
      render(<StartScreen state={ready} session={fakeSession({ phase: 'live', wakeCount: 1 })} hasKey onPrepare={vi.fn()} onBegin={vi.fn()} onBack={vi.fn()} />);
      expect(screen.getByTestId('soundcheck-heard')).toHaveTextContent('Heard you.');
    });

    it('offers a way forward when the voice connection fails', async () => {
      const onWithoutVoice = vi.fn();
      render(
        <StartScreen
          state={ready}
          session={fakeSession({ phase: 'error', error: 'Microphone is blocked. Allow it from the icon in the address bar, then try again.' })}
          hasKey
          onPrepare={vi.fn()}
          onBegin={vi.fn()}
          onBack={vi.fn()}
          onWithoutVoice={onWithoutVoice}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(/microphone is blocked/i);
      await userEvent.click(screen.getByRole('button', { name: /cook without voice/i }));
      expect(onWithoutVoice).toHaveBeenCalled();
    });
  });
});
