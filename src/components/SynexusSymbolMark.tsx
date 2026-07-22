import { BrainCircuitPulse } from "./BrainCircuitPulse";

type SynexusSymbolMarkProps = {
  className?: string;
  size?: "panel" | "chat" | "fab";
  /** Heartbeat + circuit animation (fab keeps pulse only). */
  alive?: boolean;
};

/** SyNexus emblem only — cropped from the full logo asset, scaled to fit the box. */
export function SynexusSymbolMark({ className = "", size = "panel", alive = true }: SynexusSymbolMarkProps) {
  const showCircuits = alive && size === "panel";

  return (
    <div
      className={`synexus-symbol-box synexus-symbol-box--${size}${alive ? " synexus-symbol-box--alive" : ""}${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    >
      <BrainCircuitPulse variant="symbol" alive={alive} circuits={showCircuits}>
        <img className="synexus-symbol-box__img" src="/synexus-symbol.png?v=5" alt="" />
      </BrainCircuitPulse>
    </div>
  );
}
