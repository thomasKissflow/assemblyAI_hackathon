import { useEffect } from 'react';

export interface ShortcutMap {
  down: Record<string, () => void>;
  up?: Record<string, () => void>;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};
const keyName = (e: KeyboardEvent) => (e.key === ' ' ? 'space' : e.key.toLowerCase());

export function useShortcuts(map: ShortcutMap) {
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      const fn = map.down[keyName(e)];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const fn = map.up?.[keyName(e)];
      if (fn && !isTyping(e.target)) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [map]);
}
