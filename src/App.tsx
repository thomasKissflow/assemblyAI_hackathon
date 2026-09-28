import { useEffect, useState } from 'react';
import { createKitchenStore, useKitchen, type KitchenStore } from './kitchen/store';
import { callText, greetingText } from './kitchen/calls';
import type { MenuId } from './kitchen/recipes';
import { hasApiKey, useChefSession } from './voice/useChefSession';
import { playBell, unlockSound } from './ui/sound';
import { StartScreen } from './ui/StartScreen';
import { KitchenScreen } from './ui/KitchenScreen';

const store = createKitchenStore();
const DEBUG = new URLSearchParams(location.search).has('debug');
if (DEBUG) (window as unknown as { __kitchen: KitchenStore }).__kitchen = store;

export default function App() {
  const state = useKitchen(store);
  const session = useChefSession(store);
  const [voiceOn, setVoiceOn] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => store.tick(), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase === 'setup' || state.phase === 'ready']);

  useEffect(() => store.onKitchenEvents(events => {
    for (const e of events) {
      const text = callText(e);
      if (text) {
        store.log('call', text);
        playBell();
      }
    }
  }), []);

  const prepare = (menu: MenuId, serveIn: number, withVoice: boolean) => {
    unlockSound();
    store.prepare(menu, serveIn);
    const voice = withVoice && !DEBUG;
    setVoiceOn(voice);
    if (voice) void session.start();
    else store.begin();
  };

  const begin = () => {
    store.begin();
    const s = store.getState();
    if (voiceOn && s.plan) session.announce(greetingText(s.plan, s.now));
  };

  const withoutVoice = () => {
    setVoiceOn(false);
    void session.stop();
    store.begin();
  };

  const cookAgain = () => {
    void session.stop();
    store.reset();
  };

  if (state.phase === 'setup' || state.phase === 'ready') {
    return (
      <StartScreen
        state={state}
        session={session}
        hasKey={hasApiKey}
        onPrepare={prepare}
        onBegin={begin}
        onBack={cookAgain}
        onWithoutVoice={withoutVoice}
      />
    );
  }
  return <KitchenScreen store={store} state={state} session={voiceOn ? session : null} onCookAgain={cookAgain} />;
}
