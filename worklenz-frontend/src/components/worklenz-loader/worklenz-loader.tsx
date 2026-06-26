import { memo, useEffect, useRef } from 'react';

const DURATION = 2800;
const SPIN_END = 0.55;
const MORPH_END = 0.75;
const HOLD_END = 0.88;

// ── TWEAKABLE LOGO TARGET POSITIONS ──────────────────────────────
// left/top = center of bar in px from spinner center
// rot = rotation in degrees, w/h = size in px
const LOGO_TARGETS = [
  { left: -12, top: -4, rot:  65, w: 32, h: 9 }, // bar1 — gray
  { left:  24, top: -5, rot: 112, w: 32, h: 9 }, // bar3 — blue
  { left:   1.5, top: -4, rot:  65, w: 32, h: 9 }, // bar2 — gray
  
];

// ── TWEAKABLE SPIN SHAPE ──────────────────────────────────────────
// rot = starting angle, w/h = size during spin
const SPIN_SHAPE = [
  { rot:   0, w: 20, h: 10 }, // bar1
  { rot: 120, w: 20, h: 10 }, // bar2
  { rot: 240, w: 20, h: 10 }, // bar3
];

const BAR_COLORS = ['#9ca3af', '#93c5fd','#9ca3af'];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function clamp01(t: number) { return Math.max(0, Math.min(1, t)); }

export const WorklenzLogoLoader = memo(() => {
  const spinnerRef = useRef<HTMLDivElement>(null);
  const bar1Ref = useRef<HTMLDivElement>(null);
  const bar2Ref = useRef<HTMLDivElement>(null);
  const bar3Ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const spinner = spinnerRef.current;
    const els = [bar1Ref.current, bar2Ref.current, bar3Ref.current];
    if (!spinner || els.some(e => !e)) return;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = ((ts - startRef.current) % DURATION) / DURATION;

      let spinAngle: number;
      let morphT: number;

      if (p < SPIN_END) {
        spinAngle = (p / SPIN_END) * 360;
        morphT = 0;
      } else if (p < MORPH_END) {
        spinAngle = 360;
        morphT = ease(clamp01((p - SPIN_END) / (MORPH_END - SPIN_END)));
      } else if (p < HOLD_END) {
        spinAngle = 360;
        morphT = 1;
      } else {
        spinAngle = 360;
        morphT = ease(clamp01(1 - (p - HOLD_END) / (1 - HOLD_END)));
      }

      spinner.style.transform = `rotate(${spinAngle}deg)`;

      for (let i = 0; i < 3; i++) {
        const el = els[i] as HTMLDivElement;
        const s = SPIN_SHAPE[i];
        const l = LOGO_TARGETS[i];

        const spinLeft = Math.cos((s.rot * Math.PI) / 180) * 5;
        const spinTop  = Math.sin((s.rot * Math.PI) / 180) * 5;

        const w    = lerp(s.w,     l.w,    morphT);
        const h    = lerp(s.h,     l.h,    morphT);
        const left = lerp(spinLeft, l.left, morphT);
        const top  = lerp(spinTop,  l.top,  morphT);
        const rot  = lerp(s.rot,   l.rot,  morphT);

        el.style.width     = `${w}px`;
        el.style.height    = `${h}px`;
        el.style.left      = `${left}px`;
        el.style.top       = `${top - h / 2}px`;
        el.style.transform = `rotate(${rot}deg)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const barStyle: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '9999px',
    transformOrigin: '0 50%',
  };

  return (
    <div
      role="status"
      style={{ position: 'relative', width: '120px', height: '70px' }}
    >
      <div
        ref={spinnerRef}
        style={{ position: 'absolute', top: '35px', left: '60px', width: 0, height: 0 }}
      >
        <div ref={bar1Ref} style={{ ...barStyle, background: BAR_COLORS[0] }} />
        <div ref={bar2Ref} style={{ ...barStyle, background: BAR_COLORS[1] }} />
        <div ref={bar3Ref} style={{ ...barStyle, background: BAR_COLORS[2] }} />
      </div>
      <span
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          borderWidth: 0,
        }}
      >
        Loading...
      </span>
    </div>
  );
});