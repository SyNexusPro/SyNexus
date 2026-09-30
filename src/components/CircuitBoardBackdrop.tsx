import { isNativeAndroid } from "../lib/bootExperience";

type Props = {
  className?: string;
  alive?: boolean;
};

const TRACES = [
  "M0 40 H70 L90 60 H150 L170 40 H240",
  "M0 120 H40 L60 100 H110",
  "M130 120 H190 L210 140 H240",
  "M0 200 H90 L110 180 H160 L180 200 H240",
  "M40 0 V30 L60 50 V90",
  "M200 0 V20 L180 40",
  "M110 100 V160 L130 180",
  "M60 240 V210 L80 190 H100",
  "M190 240 V220 L210 200",
  "M160 60 V90 L180 110 V140",
  "M20 150 H60 L75 165 V240",
];

const CHIPS: [number, number, number, number][] = [
  [96, 128, 30, 22],
  [196, 72, 26, 18],
  [20, 70, 22, 16],
];

/**
 * Traces that run from the screen edges into the logo, with pulses flowing inward:
 * [path, duration s, delay s]. x is relative to the horizontal center; y is px from the
 * top, matching the brand mark (~432px wide, centered ~237px down) in HomeFeed.
 */
const FEEDERS: [string, number, number][] = [
  ["M-1000 120 H-320 L-278 162 H-119", 4.5, 0],
  ["M-1000 240 H-148", 3.8, 1.6],
  ["M-1000 360 H-460 L-400 300 H-138", 5.2, 0.8],
  ["M-1000 470 H-300 L-250 420 H-190", 4.8, 2.9],
  ["M1000 120 H320 L278 162 H119", 4.6, 2.2],
  ["M1000 240 H148", 4, 0.4],
  ["M1000 360 H460 L400 300 H138", 5, 3.3],
  ["M1000 470 H300 L250 420 H190", 4.4, 1.2],
  ["M-60 1000 V560 L-30 530 V470", 3.6, 1.9],
  ["M60 1000 V560 L30 530 V470", 3.9, 3.6],
];

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Neon circuit board on black with light pulses feeding the logo on web. Android WebView and
 * reduced-motion users get the static board (no animation) to avoid WebView freezes.
 */
export function CircuitBoardBackdrop({ className, alive = true }: Props) {
  const animate = alive && typeof window !== "undefined" && !isNativeAndroid() && !prefersReducedMotion();
  return (
    <div
      className={`circuit-board matrix-rain matrix-rain--static${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="synexus-circuit" width="240" height="240" patternUnits="userSpaceOnUse">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <g stroke="rgba(57, 255, 20, 0.018)" strokeWidth="5">
                {TRACES.map((d) => (
                  <path key={`g${d}`} d={d} />
                ))}
              </g>
              <g stroke="rgba(120, 255, 60, 0.07)" strokeWidth="1">
                {TRACES.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
              {CHIPS.map(([x, y, w, h]) => (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="3"
                  stroke="rgba(120, 255, 60, 0.06)"
                  strokeWidth="1"
                  fill="rgba(57, 255, 20, 0.012)"
                />
              ))}
            </g>
          </pattern>
          <radialGradient id="synexus-circuit-hush" cx="50%" cy="32%" r="45%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.92" />
            <stop offset="60%" stopColor="#000" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#000" />
        <rect width="100%" height="100%" fill="url(#synexus-circuit)" />
        <rect width="100%" height="100%" fill="url(#synexus-circuit-hush)" />
        <svg x="50%" y="0" overflow="visible">
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <g stroke="rgba(57, 255, 20, 0.04)" strokeWidth="5">
              {FEEDERS.map(([d]) => (
                <path key={`g${d}`} d={d} />
              ))}
            </g>
            <g stroke="rgba(120, 255, 60, 0.15)" strokeWidth="1.2">
              {FEEDERS.map(([d]) => (
                <path key={d} d={d} />
              ))}
            </g>
            {animate
              ? FEEDERS.map(([d, dur, delay]) => (
                  <g key={`p${d}`}>
                    <path d={d} pathLength={100} stroke="rgba(120, 255, 60, 0.35)" strokeWidth="6" strokeDasharray="5 300" strokeDashoffset="5">
                      <animate attributeName="stroke-dashoffset" from="5" to="-100" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
                    </path>
                    <path d={d} pathLength={100} stroke="rgba(200, 255, 120, 0.95)" strokeWidth="2" strokeDasharray="5 300" strokeDashoffset="5">
                      <animate attributeName="stroke-dashoffset" from="5" to="-100" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
                    </path>
                  </g>
                ))
              : null}
          </g>
        </svg>
      </svg>
      <div className="matrix-rain__veil" />
    </div>
  );
}
