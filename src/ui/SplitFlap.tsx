import { useState, type CSSProperties } from 'react';
import './SplitFlap.css';

interface FlapProps {
  char: string;
  index: number;
}

function Flap({ char, index }: FlapProps) {
  const [current, setCurrent] = useState(char);
  const [previous, setPrevious] = useState<string | null>(null);
  const [flips, setFlips] = useState(0);
  if (char !== current) {
    setPrevious(current);
    setCurrent(char);
    setFlips(n => n + 1);
  }
  return (
    <span className="flap" style={{ '--i': index } as CSSProperties}>
      <span className="flap-half flap-top"><span className="flap-glyph">{current}</span></span>
      <span className="flap-half flap-bottom"><span className="flap-glyph">{previous ?? current}</span></span>
      {previous !== null && (
        <span className="flap-flip" key={flips}>
          <span className="flap-half flap-top flap-fold"><span className="flap-glyph">{previous}</span></span>
          <span className="flap-half flap-bottom flap-unfold" onAnimationEnd={() => setPrevious(null)}>
            <span className="flap-glyph">{current}</span>
          </span>
        </span>
      )}
    </span>
  );
}

export interface SplitFlapProps {
  value: string;
  label: string;
  tone?: 'ink' | 'saffron' | 'fire';
  size?: 'md' | 'lg' | 'xl';
  testId?: string;
}

export function SplitFlap({ value, label, tone = 'ink', size = 'md', testId }: SplitFlapProps) {
  const match = value.match(/^(.*?)\s?(AM|PM)?$/);
  const main = match?.[1] ?? value;
  const suffix = match?.[2] ?? '';
  return (
    <span
      className={`split-flap split-flap--${tone} split-flap--${size}`}
      data-testid={testId}
      data-value={value}
      role="img"
      aria-label={`${label}: ${value}`}
    >
      {[...main].map((c, i) =>
        c === ':' ? (
          <span key={i} className="flap-colon" aria-hidden="true">:</span>
        ) : (
          <Flap key={i} char={c} index={i} />
        ),
      )}
      {suffix && (
        <span className="flap-suffix" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  );
}
