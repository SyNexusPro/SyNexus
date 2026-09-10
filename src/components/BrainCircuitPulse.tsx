import type { ReactNode } from "react";

type BrainCircuitPulseProps = {
  children: ReactNode;
  className?: string;
  /** Symbol = amber Titan mark; hero = green masthead brain. */
  variant?: "symbol" | "hero";
  /** Draw radiating circuit trunks (disable on very small marks). */
  circuits?: boolean;
  alive?: boolean;
};

const TRUNK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/** Wraps the SyNexus brain with a heartbeat scale and radiating circuit lines. */
export function BrainCircuitPulse({
  children,
  className = "",
  variant = "symbol",
  circuits = true,
  alive = true,
}: BrainCircuitPulseProps) {
  if (!alive) {
    return <>{children}</>;
  }

  return (
    <div
      className={`brain-pulse brain-pulse--${variant}${circuits ? " brain-pulse--circuits" : ""}${className ? ` ${className}` : ""}`}
    >
      {circuits && variant !== "hero" ? (
        <svg className="brain-pulse__circuits" viewBox="-50 -50 100 100" focusable="false">
          {TRUNK_ANGLES.map((deg) => (
            <g key={deg} className="brain-pulse__trunk" transform={`rotate(${deg})`}>
              <path className="brain-pulse__main" d="M 0 6 L 0 48" vectorEffect="non-scaling-stroke" />
              <path className="brain-pulse__branch" d="M 0 22 L 10 16" vectorEffect="non-scaling-stroke" />
              <path
                className="brain-pulse__branch brain-pulse__branch--alt"
                d="M 0 32 L -9 26"
                vectorEffect="non-scaling-stroke"
              />
              <circle className="brain-pulse__node" cx="0" cy="48" r="2.2" />
            </g>
          ))}
          <circle className="brain-pulse__core" cx="0" cy="0" r="3.5" />
        </svg>
      ) : null}
      {variant !== "hero" ? (
        <>
          <span className="brain-pulse__ring" />
          <span className="brain-pulse__ring brain-pulse__ring--echo" />
        </>
      ) : null}
      <div className="brain-pulse__content">{children}</div>
    </div>
  );
}
