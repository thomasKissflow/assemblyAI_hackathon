import { useRef } from 'react';
import { useFrame } from './useFrame';

const IS_JSDOM = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

/** Scrolling bar waveform drawn from a level source (0..1 RMS). Color comes from CSS `color`. */
export function Waveform({
  level,
  bars = 36,
  gain = 7,
  className,
  active = true,
}: {
  level: () => number;
  bars?: number;
  gain?: number;
  className?: string;
  active?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<number[]>(new Array(bars).fill(0));
  const last = useRef({ push: 0, colorAt: 0, color: '#888' });

  useFrame(t => {
    const el = canvas.current;
    if (!el || IS_JSDOM) return;
    if (t - last.current.push > 45) {
      last.current.push = t;
      history.current.push(Math.min(1, level() * gain));
      history.current.shift();
    }
    if (t - last.current.colorAt > 120) {
      last.current.colorAt = t;
      last.current.color = getComputedStyle(el).color;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = last.current.color;
    const gap = 3;
    const bw = Math.max(1, (w - gap * (bars - 1)) / bars);
    history.current.forEach((v, i) => {
      const bh = Math.max(3, v * h);
      ctx.beginPath();
      ctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2);
      ctx.fill();
    });
  }, active);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
