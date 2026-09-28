import { useEffect, useRef } from 'react';

/** Runs `fn` every animation frame while mounted; a no-op where rAF is unavailable (tests). */
export function useFrame(fn: (t: number) => void, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active || typeof requestAnimationFrame !== 'function') return;
    let id = 0;
    const loop = (t: number) => {
      ref.current(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
}
