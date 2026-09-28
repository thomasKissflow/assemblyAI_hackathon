import { useEffect, useState, useSyncExternalStore } from 'react';
import { ChefHat } from 'lucide-react';
import type { CaptionFeed } from '../voice/captionFeed';
import { splitCaption } from '../voice/captions';
import { useFrame } from './useFrame';
import './Captions.css';

const LINGER_MS = 3500;
const WINDOW_WORDS = 18;

/** Rolling caption window, like live TV captions: the latest spoken words plus what's coming next. */
function windowed(spoken: string, upcoming: string): { spoken: string; upcoming: string } {
  const s = spoken ? spoken.split(' ') : [];
  const u = upcoming ? upcoming.split(' ') : [];
  const keepSpoken = Math.min(s.length, Math.max(8, WINDOW_WORDS - u.length));
  const shownSpoken = s.slice(s.length - keepSpoken);
  const shownUpcoming = u.slice(0, Math.max(0, WINDOW_WORDS - shownSpoken.length));
  return {
    spoken: (keepSpoken < s.length ? '… ' : '') + shownSpoken.join(' '),
    upcoming: shownUpcoming.join(' ') + (shownUpcoming.length < u.length ? ' …' : ''),
  };
}
const EXAMPLES = [
  '“Hey Chef, the curry needs ten more minutes.”',
  '“Hey Chef, what’s next?”',
  '“Hey Chef, guests are running late.”',
  '“Hey Chef, can I use butter instead of ghee?”',
  '“Hey Chef, I burnt the garlic.”',
];

function useRotating(items: string[], ms: number, active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setI(n => (n + 1) % items.length), ms);
    return () => window.clearInterval(t);
  }, [items.length, ms, active]);
  return items[i];
}

export function Captions({ feed, audioTime }: { feed: CaptionFeed; audioTime: () => number }) {
  const snap = useSyncExternalStore(feed.subscribe, feed.getSnapshot);
  const [view, setView] = useState({ spoken: '', upcoming: '', visible: false });
  const speaking = snap.chefStart !== null && snap.chefWords.length > 0;

  useFrame(() => {
    if (snap.chefStart === null) return;
    const elapsed = (audioTime() - snap.chefStart) * 1000;
    const lastEnd = Math.max(...snap.chefWords.map(w => w.endMs));
    const split = splitCaption(snap.chefWords, elapsed);
    const next = { ...windowed(split.spoken, split.upcoming), visible: snap.chefLive || elapsed < lastEnd + LINGER_MS };
    if (next.spoken !== view.spoken || next.upcoming !== view.upcoming || next.visible !== view.visible) setView(next);
  }, speaking && (snap.chefLive || view.visible || !view.spoken));

  const youVisible = snap.you.trim().length > 0;
  const chefVisible = speaking && view.visible;
  const idle = !chefVisible && !youVisible;
  const example = useRotating(EXAMPLES, 4500, idle);

  return (
    <section className="captions" aria-labelledby="captions-title">
      <h2 id="captions-title" className="visually-hidden">
        Live captions
      </h2>
      <div className={chefVisible ? 'cap cap-chef is-visible' : 'cap cap-chef'} data-testid="captions-chef" aria-hidden={!chefVisible}>
        <span className="cap-who">
          <ChefHat size={15} aria-hidden="true" /> Chef
        </span>
        <p className="cap-text">
          <span className="cap-spoken">{view.spoken}</span> <span className="cap-upcoming">{view.upcoming}</span>
        </p>
      </div>
      <div className={youVisible ? 'cap cap-you is-visible' : 'cap cap-you'} data-testid="captions-you" aria-hidden={!youVisible}>
        <span className="cap-who">You</span>
        <p className="cap-text">{youVisible ? `“${snap.you}”` : ''}</p>
      </div>
      {idle && (
        <div className="cap-hint">
          <p className="cap-hint-lead">Try saying</p>
          <p className="cap-hint-example" key={example}>
            {example}
          </p>
        </div>
      )}
    </section>
  );
}
