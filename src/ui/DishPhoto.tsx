import { useState, type CSSProperties } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import './DishPhoto.css';

/** A dish photo or plate art in a circle. A missing image falls back to a plain plate, never a broken icon. */
export function DishPhoto({ src, size, className = '' }: { src: string; size: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const art = src.endsWith('.svg');
  if (failed === src) {
    return (
      <span className={`dish-photo is-missing ${className}`} style={{ '--photo-size': `${size}px` } as CSSProperties} aria-hidden="true">
        <UtensilsCrossed strokeWidth={2} />
      </span>
    );
  }
  return (
    <img
      className={`dish-photo${art ? ' is-art' : ''} ${className}`}
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      onError={() => setFailed(src)}
    />
  );
}
