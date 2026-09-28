import { useState, useSyncExternalStore } from 'react';
import { ChefHat } from 'lucide-react';
import type { CaptionFeed } from '../voice/captionFeed';
import { splitCaption } from '../voice/captions';
import { useFrame } from './useFrame';
import './Captions.css';

const LINGER_MS = 3500;

export function Captions({ feed, audioTime }: { feed: CaptionFeed; audioTime: () => number }) {
  const snap = useSyncExternalStore(feed.subscribe, feed.getSnapshot);
  const [view, setView] = useState({ spoken: '', upcoming: '', visible: false });

  useFrame(() => {
    let next = { spoken: '', upcoming: '', visible: false };
    if (snap.chefStart !== null && snap.chefWords.length) {
      const elapsed = (audioTime() - snap.chefStart) * 1000;
      const lastEnd = Math.max(...snap.chefWords.map(w => w.endMs));
      next = { ...splitCaption(snap.chefWords, elapsed), visible: snap.chefLive || elapsed < lastEnd + LINGER_MS };
    }
    if (next.spoken !== view.spoken || next.upcoming !== view.upcoming || next.visible !== view.visible) setView(next);
  });

  const youVisible = snap.you.trim().length > 0;
  const idle = !view.visible && !youVisible;

  return (
    <section className="captions" aria-label="Live captions">
      <div className={view.visible ? 'cap cap-chef is-visible' : 'cap cap-chef'} data-testid="captions-chef" aria-hidden={!view.visible}>
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
        <p className="cap-hint">
          Say <strong>“Hey Chef”</strong> to ask anything, or to tell Chef what the food is doing.
        </p>
      )}
    </section>
  );
}
